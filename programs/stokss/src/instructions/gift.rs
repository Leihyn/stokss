use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TransferChecked,
};

use crate::errors::StokssError;
use crate::events::{GiftClaimed, GiftCreated, GiftReclaimed};
use crate::scaled_ui::{compute_delta_raw, parse_scaled_ui};
use crate::state::{AccrualMode, Gift};

pub const GIFT_SEED: &[u8] = b"gift";

/// Splits an escrowed balance between recipient and sender at claim time.
///
/// Extracted as a pure function so the FAIL-OPEN behaviour below can be tested without a
/// validator. Returns `(to_recipient, to_sender)`.
///
/// `compute_delta_raw` refuses a jump above `MAX_TICK_RATIO` because that shape means a
/// split rather than a dividend. A harvest sees one tick at a time so it never reaches that
/// ceiling in normal use. A GIFT can sit in escrow across many ticks, so it reaches it
/// routinely: a 12%-a-year payer crosses 3% in about a quarter. Propagating that error would
/// make the claim revert and lock the gift permanently. Locking someone's gift is far worse
/// than the sender forgoing an accrual, so every error path here resolves to "the recipient
/// gets everything".
pub fn escrow_split(total: u64, m0: f64, m1: f64, mode: AccrualMode) -> (u64, u64) {
    let to_sender = match mode {
        AccrualMode::ToSender if m1 > m0 => {
            compute_delta_raw(total, m0, m1).unwrap_or(0).min(total)
        }
        _ => 0,
    };
    (total.saturating_sub(to_sender), to_sender)
}


/// Gifting a scaled-UI-amount position is not a plain transfer, because the vault holds a
/// RAW balance and a raw balance represents MORE shares after a dividend tick. A gift that
/// sits in escrow across a corporate action is therefore worth more shares at claim than it
/// was at creation, and someone has to own that difference. `AccrualMode` decides who.
#[derive(Accounts)]
#[instruction(gift_id: u64)]
pub struct CreateGift<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        init,
        payer = sender,
        space = 8 + Gift::INIT_SPACE,
        seeds = [GIFT_SEED, sender.key().as_ref(), &gift_id.to_le_bytes()],
        bump
    )]
    pub gift: Account<'info, Gift>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: same account as `mint`, passed again so the ScaledUiAmount TLV can be read
    /// from raw bytes. Constrained to equal `mint`.
    #[account(address = mint.key())]
    pub mint_raw: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = sender_ata.owner == sender.key() @ StokssError::NotGiftSender,
        constraint = sender_ata.mint == mint.key() @ StokssError::GiftMintMismatch
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    /// Escrow. Owned by the gift PDA, which signs the release.
    #[account(
        init,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = gift,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn create_handler(
    ctx: Context<CreateGift>,
    gift_id: u64,
    amount_raw: u64,
    claim_hash: [u8; 32],
    unlock_at: i64,
    expires_at: i64,
    accrual_mode: AccrualMode,
    basis_cents_per_share: u64,
    basis_acquired_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(amount_raw > 0, StokssError::ZeroDelta);
    // An expiry that has already passed would make the gift reclaimable before it is
    // claimable. 0 means it never expires.
    require!(
        expires_at == 0 || expires_at > unlock_at,
        StokssError::GiftExpiryBeforeUnlock
    );

    // Anchor the multiplier at creation. Every accrual question downstream is answered
    // against this number, exactly as UserPlan anchors m0 to the first harvest of a batch.
    let m0 = {
        let data = ctx.accounts.mint_raw.try_borrow_data()?;
        parse_scaled_ui(&data)?.effective(now)
    };

    let cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        },
    );
    transfer_checked(cpi, amount_raw, ctx.accounts.mint.decimals)?;

    let gift = &mut ctx.accounts.gift;
    gift.gift_id = gift_id;
    gift.sender = ctx.accounts.sender.key();
    gift.mint = ctx.accounts.mint.key();
    gift.claim_hash = claim_hash;
    gift.amount_raw = amount_raw;
    gift.m0_bits = m0.to_bits();
    gift.unlock_at = unlock_at;
    gift.expires_at = expires_at;
    gift.accrual_mode = accrual_mode;
    gift.basis_cents_per_share = basis_cents_per_share;
    gift.basis_acquired_at = basis_acquired_at;
    gift.claimed = false;
    gift.created_at = now;
    gift.bump = ctx.bumps.gift;

    emit!(GiftCreated {
        gift: gift.key(),
        sender: gift.sender,
        mint: gift.mint,
        amount_raw,
        m0_bits: gift.m0_bits,
        unlock_at,
        expires_at,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimGift<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [GIFT_SEED, gift.sender.as_ref(), &gift.gift_id.to_le_bytes()],
        bump = gift.bump
    )]
    pub gift: Account<'info, Gift>,

    #[account(address = gift.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: same account as `mint`, read as raw bytes for the TLV. Constrained to `mint`.
    #[account(address = mint.key())]
    pub mint_raw: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = gift,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = claimer_ata.owner == claimer.key() @ StokssError::NotGiftRecipient,
        constraint = claimer_ata.mint == gift.mint @ StokssError::GiftMintMismatch
    )]
    pub claimer_ata: InterfaceAccount<'info, TokenAccount>,

    /// Receives the escrow accrual under AccrualMode::ToSender, and always receives the
    /// vault rent when the vault is closed.
    #[account(
        mut,
        constraint = sender_ata.owner == gift.sender @ StokssError::NotGiftSender,
        constraint = sender_ata.mint == gift.mint @ StokssError::GiftMintMismatch
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: rent destination for the closed vault. Constrained to the recorded sender.
    #[account(mut, address = gift.sender)]
    pub sender: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn claim_handler(ctx: Context<ClaimGift>, secret: Vec<u8>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.gift.claimed, StokssError::GiftAlreadyClaimed);
    require!(now >= ctx.accounts.gift.unlock_at, StokssError::GiftLocked);
    require!(
        hash(&secret).to_bytes() == ctx.accounts.gift.claim_hash,
        StokssError::BadClaimSecret
    );

    let m1 = {
        let data = ctx.accounts.mint_raw.try_borrow_data()?;
        parse_scaled_ui(&data)?.effective(now)
    };
    let m0 = f64::from_bits(ctx.accounts.gift.m0_bits);

    // The vault balance, not the recorded amount, is the source of truth: anyone can send
    // tokens to a token account, and the claim must move whatever is actually there.
    let total = ctx.accounts.vault.amount;
    require!(total > 0, StokssError::NothingPending);

    // Escrow accrual. See escrow_split: every error path gives the recipient everything so
    // a claim can never be blocked by an accrual computation.
    let (to_recipient, to_sender) = escrow_split(total, m0, m1, ctx.accounts.gift.accrual_mode);
    require!(to_recipient > 0, StokssError::ZeroDelta);

    let sender_key = ctx.accounts.gift.sender;
    let gift_id_bytes = ctx.accounts.gift.gift_id.to_le_bytes();
    let bump = ctx.accounts.gift.bump;
    let seeds: &[&[u8]] = &[GIFT_SEED, sender_key.as_ref(), &gift_id_bytes, &[bump]];
    let signer: &[&[&[u8]]] = &[seeds];
    let decimals = ctx.accounts.mint.decimals;

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.claimer_ata.to_account_info(),
                authority: ctx.accounts.gift.to_account_info(),
            },
            signer,
        ),
        to_recipient,
        decimals,
    )?;

    if to_sender > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.sender_ata.to_account_info(),
                    authority: ctx.accounts.gift.to_account_info(),
                },
                signer,
            ),
            to_sender,
            decimals,
        )?;
    }

    // Vault is empty now. Reclaim its rent for the sender who paid it.
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.sender.to_account_info(),
            authority: ctx.accounts.gift.to_account_info(),
        },
        signer,
    ))?;

    // The Gift record is deliberately NOT closed. It is the on-chain provenance receipt
    // carrying the donor and the carried-over cost basis, which a plain transfer destroys.
    let gift = &mut ctx.accounts.gift;
    gift.claimed = true;

    emit!(GiftClaimed {
        gift: gift.key(),
        sender: gift.sender,
        recipient: ctx.accounts.claimer.key(),
        mint: gift.mint,
        to_recipient_raw: to_recipient,
        to_sender_raw: to_sender,
        m0_bits: gift.m0_bits,
        m1_bits: m1.to_bits(),
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ReclaimGift<'info> {
    #[account(mut, address = gift.sender @ StokssError::NotGiftSender)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [GIFT_SEED, gift.sender.as_ref(), &gift.gift_id.to_le_bytes()],
        bump = gift.bump
    )]
    pub gift: Account<'info, Gift>,

    #[account(address = gift.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = gift,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = sender_ata.owner == sender.key() @ StokssError::NotGiftSender,
        constraint = sender_ata.mint == gift.mint @ StokssError::GiftMintMismatch
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

pub fn reclaim_handler(ctx: Context<ReclaimGift>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.gift.claimed, StokssError::GiftAlreadyClaimed);
    // A gift with expires_at == 0 is a one-way promise and can never be pulled back.
    require!(ctx.accounts.gift.expires_at != 0, StokssError::GiftNotExpired);
    require!(
        now >= ctx.accounts.gift.expires_at,
        StokssError::GiftNotExpired
    );

    let total = ctx.accounts.vault.amount;
    require!(total > 0, StokssError::NothingPending);

    let sender_key = ctx.accounts.gift.sender;
    let gift_id_bytes = ctx.accounts.gift.gift_id.to_le_bytes();
    let bump = ctx.accounts.gift.bump;
    let seeds: &[&[u8]] = &[GIFT_SEED, sender_key.as_ref(), &gift_id_bytes, &[bump]];
    let signer: &[&[&[u8]]] = &[seeds];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.sender_ata.to_account_info(),
                authority: ctx.accounts.gift.to_account_info(),
            },
            signer,
        ),
        total,
        ctx.accounts.mint.decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.sender.to_account_info(),
            authority: ctx.accounts.gift.to_account_info(),
        },
        signer,
    ))?;

    let gift = &mut ctx.accounts.gift;
    gift.claimed = true;

    emit!(GiftReclaimed {
        gift: gift.key(),
        sender: gift.sender,
        mint: gift.mint,
        amount_raw: total,
        ts: now,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Real STRCx transitions read from mainnet on 2026-09-18. STRCx pays about every 15 days
    // at roughly 0.5%, which is why it is the asset that reaches MAX_TICK_RATIO fastest.
    const STRC_M0: f64 = 1.0753686544887686;
    const STRC_M1: f64 = 1.0808929977256367;
    const STRC_M2: f64 = 1.0863570205637327;

    const TOTAL: u64 = 1_000_000_000; // 10 tokens at 8 decimals

    #[test]
    fn to_recipient_never_diverts_anything() {
        for m1 in [STRC_M0, STRC_M1, STRC_M2, STRC_M0 * 2.0] {
            let (r, s) = escrow_split(TOTAL, STRC_M0, m1, AccrualMode::ToRecipient);
            assert_eq!(s, 0);
            assert_eq!(r, TOTAL);
        }
    }

    #[test]
    fn to_sender_takes_only_the_accrual() {
        let (r, s) = escrow_split(TOTAL, STRC_M0, STRC_M1, AccrualMode::ToSender);
        assert!(s > 0, "sender should receive the escrow accrual");
        assert_eq!(r + s, TOTAL, "split must conserve the vault balance");

        // The recipient must end up with at least the share exposure the sender intended.
        let intended_shares = (TOTAL as f64) * STRC_M0;
        let recipient_shares = (r as f64) * STRC_M1;
        assert!(recipient_shares >= intended_shares);
        assert!(recipient_shares - intended_shares < STRC_M1, "dust exceeded one raw unit");
    }

    #[test]
    fn fails_open_when_accrual_exceeds_the_split_guard() {
        // A gift held long enough to accrue past MAX_TICK_RATIO (1.03). compute_delta_raw
        // rejects this as split-shaped; the claim must still succeed.
        let m1 = STRC_M0 * 1.05;
        let (r, s) = escrow_split(TOTAL, STRC_M0, m1, AccrualMode::ToSender);
        assert_eq!(s, 0, "must not divert when the guard rejects");
        assert_eq!(r, TOTAL, "recipient must still receive the whole balance");
    }

    #[test]
    fn reverse_split_does_not_block_a_claim() {
        let (r, s) = escrow_split(TOTAL, STRC_M1, STRC_M0, AccrualMode::ToSender);
        assert_eq!(s, 0);
        assert_eq!(r, TOTAL);
    }

    #[test]
    fn no_tick_means_no_accrual() {
        let (r, s) = escrow_split(TOTAL, STRC_M1, STRC_M1, AccrualMode::ToSender);
        assert_eq!(s, 0);
        assert_eq!(r, TOTAL);
    }

    #[test]
    fn multi_tick_escrow_within_the_guard_still_splits() {
        // Two real consecutive STRCx ticks, cumulative ~1.02, inside the 1.03 ceiling.
        let (r, s) = escrow_split(TOTAL, STRC_M0, STRC_M2, AccrualMode::ToSender);
        assert!(s > 0);
        assert_eq!(r + s, TOTAL);
        assert!((r as f64) * STRC_M2 >= (TOTAL as f64) * STRC_M0);
    }

    #[test]
    fn split_conserves_balance_for_every_mode() {
        for mode in [AccrualMode::ToRecipient, AccrualMode::ToSender] {
            for total in [0u64, 1, 2, TOTAL, u64::MAX / 4] {
                let (r, s) = escrow_split(total, STRC_M0, STRC_M1, mode);
                assert_eq!(r.checked_add(s), Some(total), "conservation broke at {total}");
            }
        }
    }
}
