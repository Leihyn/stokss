use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub keeper: Pubkey,
    /// Protocol fee in basis points, taken from the USDC proceeds. 0 for the hackathon.
    pub fee_bps: u16,
    /// Minimum USDC (6 decimals) before a plan is paid out. Below this, accrue.
    ///
    /// This is the ON-CHAIN floor and it governs PAYOUT. The crank has a separate
    /// MIN_SWAP_USD threshold that governs whether a SWAP is worth attempting. They are
    /// different thresholds doing different jobs: the swap floor stops us paying a
    /// transaction fee to convert dust, the payout floor stops us paying a transfer fee to
    /// deliver dust. Keep the swap floor at or below this one.
    pub payout_floor_usdc: u64,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PayoutMode {
    /// USDC to the holder's own token account.
    Cash,
    /// USDC forwarded to a named payee (a bill).
    Bill,
}

#[account]
#[derive(InitSpace)]
pub struct UserPlan {
    pub owner: Pubkey,
    /// The xStock mint this plan harvests.
    pub mint: Pubkey,
    /// Where USDC lands. A USDC token account.
    pub destination: Pubkey,
    pub mode: PayoutMode,
    /// f64 bit pattern of the multiplier at the last successful harvest.
    /// Stored as bits because f64 is not a borsh-stable type across targets.
    pub last_multiplier_bits: u64,
    /// Raw xStock units harvested but not yet settled.
    pub pending_raw: u64,

    // The (m0, m1, activation) triple for the CURRENT unsettled batch.
    //
    // A batch can span more than one tick: below the payout floor the crank holds and lets
    // the next dividend join, which S17 calls the normal path for small holders. So m0 is
    // anchored to the FIRST harvest of the batch and only m1 advances. The span then
    // telescopes exactly, and floor(R * (1 - m0/m1)) still describes the whole batch.
    // Overwriting m0 on every harvest, which an earlier draft did, made the receipt describe
    // only the last tick while reporting the combined delta.
    pub pending_m0_bits: u64,
    pub pending_m1_bits: u64,
    pub pending_activation_ts: i64,

    /// USDC accrued below the payout floor, held for the holder.
    pub accrued_usdc: u64,
    pub total_paid_usdc: u64,
    pub harvest_count: u32,
    pub closed: bool,
    pub bump: u8,
}

impl UserPlan {
    pub fn last_multiplier(&self) -> f64 {
        f64::from_bits(self.last_multiplier_bits)
    }
    pub fn set_last_multiplier(&mut self, m: f64) {
        self.last_multiplier_bits = m.to_bits();
    }
    /// True when nothing is outstanding, so the next harvest opens a fresh batch.
    pub fn batch_is_empty(&self) -> bool {
        self.pending_raw == 0
    }
}

#[account]
#[derive(InitSpace)]
pub struct HarvestReceipt {
    pub plan: Pubkey,
    pub mint: Pubkey,
    /// Multiplier at the start of the settled batch.
    pub m0_bits: u64,
    /// Multiplier at the end of the settled batch.
    pub m1_bits: u64,
    pub delta_raw: u64,
    pub usdc_paid: u64,
    /// Activation timestamp of the last tick in the batch.
    pub tick_activation_ts: i64,
    pub settled_ts: i64,
    pub bump: u8,
}
