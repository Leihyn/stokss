use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod scaled_ui;
pub mod state;

use instructions::*;

declare_id!("EHm3a6HCDyJAcRbzd5oWGFBxXp5hBkKrWcF9cPE7rA2F");

#[program]
pub mod stokss {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        keeper: Pubkey,
        fee_bps: u16,
        payout_floor_usdc: u64,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, keeper, fee_bps, payout_floor_usdc)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::initialize_config::set_paused_handler(ctx, paused)
    }

    pub fn enroll(ctx: Context<Enroll>, mode: state::PayoutMode) -> Result<()> {
        instructions::enroll::handler(ctx, mode)
    }

    pub fn harvest(ctx: Context<Harvest>) -> Result<()> {
        instructions::harvest::handler(ctx)
    }

    pub fn settle(ctx: Context<Settle>, usdc_amount: u64, delta_raw_settled: u64) -> Result<()> {
        instructions::settle::handler(ctx, usdc_amount, delta_raw_settled)
    }

    pub fn close_plan(ctx: Context<ClosePlan>) -> Result<()> {
        instructions::close_plan::handler(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_gift(
        ctx: Context<CreateGift>,
        gift_id: u64,
        amount_raw: u64,
        claim_hash: [u8; 32],
        unlock_at: i64,
        expires_at: i64,
        accrual_mode: state::AccrualMode,
        basis_cents_per_share: u64,
        basis_acquired_at: i64,
    ) -> Result<()> {
        instructions::gift::create_handler(
            ctx,
            gift_id,
            amount_raw,
            claim_hash,
            unlock_at,
            expires_at,
            accrual_mode,
            basis_cents_per_share,
            basis_acquired_at,
        )
    }

    pub fn claim_gift(ctx: Context<ClaimGift>, secret: Vec<u8>) -> Result<()> {
        instructions::gift::claim_handler(ctx, secret)
    }

    pub fn reclaim_gift(ctx: Context<ReclaimGift>) -> Result<()> {
        instructions::gift::reclaim_handler(ctx)
    }
}
