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

/// Who owns the dividend that accrues while a gift sits in escrow.
///
/// This question does not exist for a plain token gift. It exists here because the vault
/// holds a RAW balance and a raw balance represents MORE shares after a multiplier tick, so
/// a gift crossing a corporate action is worth more at claim than at creation.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AccrualMode {
    /// The recipient keeps whatever accrued while the gift was wrapped.
    ToRecipient,
    /// The sender gets the accrued increment back; the recipient gets the shares intended.
    ToSender,
}

#[account]
#[derive(InitSpace)]
pub struct Gift {
    pub gift_id: u64,
    pub sender: Pubkey,
    pub mint: Pubkey,
    /// sha256 of the secret carried in the claim link. The link is the bearer instrument.
    pub claim_hash: [u8; 32],
    /// Raw units escrowed at creation. The vault balance is authoritative at claim time.
    pub amount_raw: u64,
    /// f64 bits of the multiplier at creation, anchoring the accrual computation.
    pub m0_bits: u64,
    /// Not claimable before this unix timestamp. 0 means immediately claimable.
    pub unlock_at: i64,
    /// Sender may reclaim on or after this. 0 means the gift can never be pulled back.
    pub expires_at: i64,
    pub accrual_mode: AccrualMode,
    /// Donor cost basis in USD cents per share, carried over with the gift. 0 = not
    /// recorded. This is information a plain on-chain transfer destroys permanently. It is
    /// a record, not tax advice.
    pub basis_cents_per_share: u64,
    pub basis_acquired_at: i64,
    pub claimed: bool,
    pub created_at: i64,
    pub bump: u8,
}
