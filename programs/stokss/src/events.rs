use anchor_lang::prelude::*;

#[event]
pub struct Enrolled {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub multiplier_bits: u64,
    pub ts: i64,
}

#[event]
pub struct Harvested {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub m0_bits: u64,
    pub m1_bits: u64,
    pub delta_raw: u64,
    pub batch_pending_raw: u64,
    pub ts: i64,
}

#[event]
pub struct Settled {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub delta_raw: u64,
    pub usdc_paid: u64,
    pub accrued_usdc: u64,
    pub ts: i64,
}

#[event]
pub struct PlanClosed {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub total_paid_usdc: u64,
    pub ts: i64,
}
