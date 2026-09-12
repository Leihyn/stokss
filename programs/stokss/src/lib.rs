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
}
