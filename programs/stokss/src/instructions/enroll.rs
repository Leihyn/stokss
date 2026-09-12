use anchor_lang::prelude::*;

use crate::errors::StokssError;
use crate::events::Enrolled;
use crate::scaled_ui::parse_scaled_ui;
use crate::state::{PayoutMode, UserPlan};

pub const PLAN_SEED: &[u8] = b"plan";
pub const HARVEST_AUTHORITY_SEED: &[u8] = b"harvest_authority";

#[derive(Accounts)]
pub struct Enroll<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: raw Token-2022 mint account. Parsed by hand in scaled_ui.rs; never deserialized
    /// by Anchor because the extension layout is what we need, not the base mint.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: the holder's USDC token account, validated at payout time by settle.
    pub destination: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + UserPlan::INIT_SPACE,
        seeds = [PLAN_SEED, owner.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub plan: Account<'info, UserPlan>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Enroll>, mode: PayoutMode) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Snapshot the multiplier in force RIGHT NOW. Anything before this moment is not ours to
    // harvest: the holder keeps every dividend that landed before they enrolled.
    //
    // This is also why enrollment must happen BEFORE a tick activates. If the multiplier has
    // already moved, we snapshot the post-tick value and that dividend is unreachable.
    let m_now = {
        let mint_data = ctx.accounts.mint.try_borrow_data()?;
        let sui = parse_scaled_ui(&mint_data)?;
        sui.effective(now)
    };
    require!(m_now > 0.0, StokssError::MalformedMint);

    let plan = &mut ctx.accounts.plan;
    plan.owner = ctx.accounts.owner.key();
    plan.mint = ctx.accounts.mint.key();
    plan.destination = ctx.accounts.destination.key();
    plan.mode = mode;
    plan.set_last_multiplier(m_now);
    plan.pending_raw = 0;
    plan.pending_m0_bits = 0;
    plan.pending_m1_bits = 0;
    plan.pending_activation_ts = 0;
    plan.accrued_usdc = 0;
    plan.total_paid_usdc = 0;
    plan.harvest_count = 0;
    plan.closed = false;
    plan.bump = ctx.bumps.plan;

    emit!(Enrolled {
        owner: plan.owner,
        mint: plan.mint,
        multiplier_bits: plan.last_multiplier_bits,
        ts: now,
    });
    Ok(())
}
