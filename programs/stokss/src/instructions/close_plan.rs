use anchor_lang::prelude::*;

use crate::errors::StokssError;
use crate::events::PlanClosed;
use crate::instructions::enroll::PLAN_SEED;
use crate::state::UserPlan;

#[derive(Accounts)]
pub struct ClosePlan<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [PLAN_SEED, owner.key().as_ref(), plan.mint.as_ref()],
        bump = plan.bump,
        has_one = owner
    )]
    pub plan: Account<'info, UserPlan>,
}

pub fn handler(ctx: Context<ClosePlan>) -> Result<()> {
    let plan = &ctx.accounts.plan;
    // Refuse to close over an unsettled batch. The increment is already out of the holder's
    // account and sitting with the keeper; closing here would strand it with no plan account
    // left to settle against.
    require!(plan.pending_raw == 0, StokssError::NothingPending);

    emit!(PlanClosed {
        owner: plan.owner,
        mint: plan.mint,
        total_paid_usdc: plan.total_paid_usdc,
        ts: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
