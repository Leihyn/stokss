use anchor_lang::prelude::*;

use crate::state::Config;

pub const CONFIG_SEED: &[u8] = b"config";

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    keeper: Pubkey,
    fee_bps: u16,
    payout_floor_usdc: u64,
) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.admin.key();
    c.keeper = keeper;
    c.fee_bps = fee_bps;
    c.payout_floor_usdc = payout_floor_usdc;
    c.paused = false;
    c.bump = ctx.bumps.config;
    msg!("stokss config initialized, keeper {}", keeper);
    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

pub fn set_paused_handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}
