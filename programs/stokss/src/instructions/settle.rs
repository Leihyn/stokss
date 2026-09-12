use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::errors::StokssError;
use crate::events::Settled;
use crate::instructions::enroll::PLAN_SEED;
use crate::instructions::initialize_config::CONFIG_SEED;
use crate::state::{Config, HarvestReceipt, UserPlan};

pub const RECEIPT_SEED: &[u8] = b"receipt";

#[derive(Accounts)]
pub struct Settle<'info> {
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

    /// Keeper's USDC account, holding the swap proceeds.
    #[account(
        mut,
        constraint = keeper_usdc.owner == config.keeper @ StokssError::NotKeeper
    )]
    pub keeper_usdc: InterfaceAccount<'info, TokenAccount>,

    /// The holder's USDC destination, recorded at enrollment.
    #[account(mut, address = plan.destination)]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = keeper,
        space = 8 + HarvestReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, plan.key().as_ref(), &plan.harvest_count.to_le_bytes()],
        bump
    )]
    pub receipt: Account<'info, HarvestReceipt>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Settle>, usdc_amount: u64, delta_raw_settled: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.config.paused, StokssError::Paused);
    require_keys_eq!(
        ctx.accounts.keeper.key(),
        ctx.accounts.config.keeper,
        StokssError::NotKeeper
    );

    let floor = ctx.accounts.config.payout_floor_usdc;
    let plan = &mut ctx.accounts.plan;
    require!(plan.pending_raw > 0, StokssError::NothingPending);
    require!(delta_raw_settled <= plan.pending_raw, StokssError::OverSettle);

    // Accrue first, then pay only once the floor is cleared. This is what makes a twelve-cent
    // dividend economical: it waits for company rather than paying a transfer fee to deliver
    // dust. Distinct from the crank's MIN_SWAP_USD, which decides whether a SWAP is worth
    // attempting at all. Swap floor <= payout floor.
    let accrued = plan
        .accrued_usdc
        .checked_add(usdc_amount)
        .ok_or(StokssError::Overflow)?;

    let (to_pay, remaining) = if accrued >= floor {
        (accrued, 0u64)
    } else {
        (0u64, accrued)
    };

    if to_pay > 0 {
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.keeper_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.keeper.to_account_info(),
            },
        );
        transfer_checked(cpi, to_pay, ctx.accounts.usdc_mint.decimals)?;
        plan.total_paid_usdc = plan
            .total_paid_usdc
            .checked_add(to_pay)
            .ok_or(StokssError::Overflow)?;
    }

    plan.accrued_usdc = remaining;
    plan.pending_raw = plan
        .pending_raw
        .checked_sub(delta_raw_settled)
        .ok_or(StokssError::Overflow)?;

    // Carry the real (m0, m1, activation) triple through from harvest, so the receipt states
    // which corporate action it settles and a reader can recompute the delta from it.
    let receipt = &mut ctx.accounts.receipt;
    receipt.plan = plan.key();
    receipt.mint = plan.mint;
    receipt.m0_bits = plan.pending_m0_bits;
    receipt.m1_bits = plan.pending_m1_bits;
    receipt.delta_raw = delta_raw_settled;
    receipt.usdc_paid = to_pay;
    receipt.tick_activation_ts = plan.pending_activation_ts;
    receipt.settled_ts = now;
    receipt.bump = ctx.bumps.receipt;

    // The batch is closed out. Clear the span so the next harvest opens a fresh one.
    if plan.pending_raw == 0 {
        plan.pending_m0_bits = 0;
        plan.pending_m1_bits = 0;
        plan.pending_activation_ts = 0;
    }

    emit!(Settled {
        owner: plan.owner,
        mint: plan.mint,
        delta_raw: delta_raw_settled,
        usdc_paid: to_pay,
        accrued_usdc: plan.accrued_usdc,
        ts: now,
    });
    Ok(())
}
