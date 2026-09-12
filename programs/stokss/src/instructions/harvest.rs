use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked};

use crate::errors::StokssError;
use crate::events::Harvested;
use crate::instructions::enroll::{HARVEST_AUTHORITY_SEED, PLAN_SEED};
use crate::instructions::initialize_config::CONFIG_SEED;
use crate::scaled_ui::{compute_delta_raw, parse_scaled_ui};
use crate::state::{Config, UserPlan};

#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [PLAN_SEED, plan.owner.as_ref(), plan.mint.as_ref()],
        bump = plan.bump
    )]
    pub plan: Account<'info, UserPlan>,

    #[account(address = plan.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: the same account as `mint`, passed again so we can read raw bytes without
    /// fighting Anchor's deserialization. Constrained to equal `mint`.
    #[account(address = mint.key())]
    pub mint_raw: UncheckedAccount<'info>,

    /// The holder's xStock token account. We move from here under the delegate.
    #[account(
        mut,
        constraint = holder_ata.owner == plan.owner @ StokssError::PlanClosed,
        constraint = holder_ata.mint == plan.mint @ StokssError::PlanClosed
    )]
    pub holder_ata: InterfaceAccount<'info, TokenAccount>,

    /// Keeper-held collection account. The increment lands here for the few minutes between
    /// harvest and settle.
    ///
    /// Bound to the DISCLOSED keeper, not merely to the mint. Without the owner constraint a
    /// keeper could route the increment to any account it liked while the disclosure said
    /// otherwise, which would make the trust story in the submission untrue.
    #[account(
        mut,
        constraint = collection_ata.mint == plan.mint @ StokssError::PlanClosed,
        constraint = collection_ata.owner == config.keeper @ StokssError::NotKeeper
    )]
    pub collection_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA the holder approved as delegate on `holder_ata`. Signs the transfer.
    #[account(seeds = [HARVEST_AUTHORITY_SEED], bump)]
    pub harvest_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<Harvest>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.config.paused, StokssError::Paused);
    require_keys_eq!(
        ctx.accounts.keeper.key(),
        ctx.accounts.config.keeper,
        StokssError::NotKeeper
    );
    require!(!ctx.accounts.plan.closed, StokssError::PlanClosed);

    // 1. Read the current effective multiplier and the activation straight off the mint.
    let (m1, activation_ts) = {
        let data = ctx.accounts.mint_raw.try_borrow_data()?;
        let sui = parse_scaled_ui(&data)?;
        (sui.effective(now), sui.effective_ts)
    };
    let m0 = ctx.accounts.plan.last_multiplier();

    // 2. A dividend raises the multiplier. So does a forward split, so direction alone is not
    //    enough: compute_delta_raw enforces BOTH ends, m0 <= m1 <= m0 * MAX_TICK_RATIO.
    require!(m1 > m0, StokssError::NoTick);

    // 3. Delta is computed here, from on-chain state. The keeper supplies no amount.
    let raw_balance = ctx.accounts.holder_ata.amount;
    let delta_raw = compute_delta_raw(raw_balance, m0, m1)?;
    require!(delta_raw > 0, StokssError::ZeroDelta);

    // 4. Move exactly delta_raw, under the delegate the holder approved.
    let bump = ctx.bumps.harvest_authority;
    let seeds: &[&[u8]] = &[HARVEST_AUTHORITY_SEED, &[bump]];
    let signer: &[&[&[u8]]] = &[seeds];

    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.holder_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.collection_ata.to_account_info(),
            authority: ctx.accounts.harvest_authority.to_account_info(),
        },
        signer,
    );
    transfer_checked(cpi, delta_raw, ctx.accounts.mint.decimals)?;

    // 5. Advance the watermark. A second harvest on the same tick computes m1 == m0, fails
    //    the NoTick check, and moves nothing, so a tick can never be taken twice.
    let plan = &mut ctx.accounts.plan;
    let m0_bits = plan.last_multiplier_bits;

    // Anchor m0 to the FIRST harvest of the batch. Below the payout floor a second dividend
    // can join before anything settles; if m0 were overwritten each time, the receipt would
    // describe only the last tick while reporting the combined delta. Anchoring makes the
    // span telescope, so floor(R * (1 - m0/m1)) still describes the whole batch.
    if plan.batch_is_empty() {
        plan.pending_m0_bits = m0_bits;
    }
    plan.pending_m1_bits = m1.to_bits();
    plan.pending_activation_ts = activation_ts;

    plan.set_last_multiplier(m1);
    plan.pending_raw = plan
        .pending_raw
        .checked_add(delta_raw)
        .ok_or(StokssError::Overflow)?;
    plan.harvest_count = plan.harvest_count.saturating_add(1);

    emit!(Harvested {
        owner: plan.owner,
        mint: plan.mint,
        m0_bits,
        m1_bits: plan.pending_m1_bits,
        delta_raw,
        batch_pending_raw: plan.pending_raw,
        ts: now,
    });
    Ok(())
}
