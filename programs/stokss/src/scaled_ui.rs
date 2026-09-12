//! Manual TLV parser for the Token-2022 ScaledUiAmount extension, plus the delta formula.
//!
//! Layout verified against live mainnet mints AAPLx and KOx on 2026-09-12, and cross-checked
//! against the issuer's multiplier-history API on both values and both timestamps:
//!
//!   [0..82]   base SPL mint
//!   [82..165] padding
//!   [165]     account_type (1 = Mint)
//!   [166..]   TLV list of (u16 type_id, u16 length, body)
//!
//!   ScaledUiAmount: type_id = 25, length = 56
//!     body[0..32]  authority
//!     body[32..40] multiplier                          f64 LE
//!     body[40..48] new_multiplier_effective_timestamp  i64 LE
//!     body[48..56] new_multiplier                      f64 LE
//!
//! We parse by hand rather than through spl-token-2022's typed extension API because
//! anchor-spl 0.30.1 may pin a crate version predating the scaled_ui_amount module. This was
//! the single biggest compile risk in the build.

use anchor_lang::prelude::*;

use crate::errors::StokssError;

pub const ACCOUNT_TYPE_OFFSET: usize = 165;
pub const TLV_START: usize = 166;
pub const ACCOUNT_TYPE_MINT: u8 = 1;
pub const EXT_SCALED_UI_AMOUNT: u16 = 25;
pub const SCALED_UI_BODY_LEN: usize = 56;

/// Ceiling on a single tick's ratio, m1 / m0.
///
/// A dividend raises the multiplier. So does a FORWARD SPLIT and an administrative
/// correction, and neither is ours to harvest: a split is value-neutral in raw terms because
/// the share price moves inversely, so harvesting one sells real exposure for nothing.
/// Checking only the direction of the move (m1 > m0) does not catch that.
///
/// 1.03 was chosen against the data, not by feel. Across all 570 recorded Dividend events the
/// largest single step is WHGROx at +2.926%; a 1.03 ceiling rejects zero of them. The next
/// value down, 1.02, would reject six real dividends including NVOx at +2.541% on a tradeable
/// mint. Nothing is given up by sitting at 1.03: the smallest possible forward split is 2:1,
/// a ratio of 2.0, so any ceiling below 2.0 blocks every split.
///
/// Failure asymmetry, for whoever tunes this later: too tight costs a missed harvest and the
/// holder simply keeps the reinvestment, no loss. Too loose sells real shares. Keep it just
/// above the observed dividend distribution, and make a rejection loud rather than silent.
pub const MAX_TICK_RATIO: f64 = 1.03;

#[derive(Clone, Copy, Debug)]
pub struct ScaledUi {
    pub multiplier: f64,
    pub new_multiplier: f64,
    pub effective_ts: i64,
}

impl ScaledUi {
    /// The multiplier in force at `now`.
    pub fn effective(&self, now: i64) -> f64 {
        if now >= self.effective_ts {
            self.new_multiplier
        } else {
            self.multiplier
        }
    }
}

/// Read the ScaledUiAmount extension out of a raw Token-2022 mint account.
pub fn parse_scaled_ui(data: &[u8]) -> Result<ScaledUi> {
    require!(data.len() > TLV_START, StokssError::MalformedMint);
    require!(
        data[ACCOUNT_TYPE_OFFSET] == ACCOUNT_TYPE_MINT,
        StokssError::NotToken2022
    );

    let mut off = TLV_START;
    while off + 4 <= data.len() {
        let type_id = u16::from_le_bytes([data[off], data[off + 1]]);
        let len = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;

        // A zero header terminates the list.
        if type_id == 0 && len == 0 {
            break;
        }
        let body_start = off + 4;
        let body_end = body_start
            .checked_add(len)
            .ok_or(StokssError::MalformedMint)?;
        require!(body_end <= data.len(), StokssError::MalformedMint);

        if type_id == EXT_SCALED_UI_AMOUNT {
            require!(len >= SCALED_UI_BODY_LEN, StokssError::MalformedMint);
            let b = &data[body_start..body_end];
            let multiplier = f64::from_le_bytes(
                b[32..40].try_into().map_err(|_| StokssError::MalformedMint)?,
            );
            let effective_ts = i64::from_le_bytes(
                b[40..48].try_into().map_err(|_| StokssError::MalformedMint)?,
            );
            let new_multiplier = f64::from_le_bytes(
                b[48..56].try_into().map_err(|_| StokssError::MalformedMint)?,
            );
            return Ok(ScaledUi {
                multiplier,
                new_multiplier,
                effective_ts,
            });
        }
        off = body_end;
    }
    err!(StokssError::NoScaledUiExtension)
}

/// delta_raw = floor(R * (1 - M0/M1))
///
/// Rounds DOWN, leaving dust with the holder, per Solana's Scaled UI Amount integration
/// guide. Returns 0 when there is nothing to take. Rejects a decrease (reverse split) and a
/// jump larger than MAX_TICK_RATIO (forward split or administrative correction).
pub fn compute_delta_raw(raw_balance: u64, m0: f64, m1: f64) -> Result<u64> {
    require!(
        m0.is_finite() && m1.is_finite() && m0 > 0.0 && m1 > 0.0,
        StokssError::MalformedMint
    );
    require!(m1 >= m0, StokssError::MultiplierDecreased);
    require!(m1 <= m0 * MAX_TICK_RATIO, StokssError::TickTooLarge);

    if m1 == m0 || raw_balance == 0 {
        return Ok(0);
    }
    let ratio = 1.0_f64 - (m0 / m1);
    if ratio <= 0.0 {
        return Ok(0);
    }
    let delta = (raw_balance as f64) * ratio;
    require!(delta.is_finite(), StokssError::Overflow);
    let delta_floor = delta.floor();
    require!(delta_floor >= 0.0, StokssError::Overflow);
    require!(delta_floor <= raw_balance as f64, StokssError::Overflow);
    Ok(delta_floor as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every constant below is a REAL AAPLx multiplier transition, read from the mainnet mint
    // and cross-checked against api.backed.fi multiplier history on 2026-09-12.
    const AAPL_M0: f64 = 1.0026642075893797;
    const AAPL_M1: f64 = 1.0032690125398187;

    // The five real AAPLx ticks, oldest first.
    const AAPL_TICKS: [(f64, f64); 5] = [
        (1.0, 1.000781855115),
        (1.000781855115, 1.0013934869619912),
        (1.0013934869619912, 1.002018559465695),
        (1.002018559465695, 1.0026642075893797),
        (1.0026642075893797, 1.0032690125398187),
    ];

    #[test]
    fn delta_preserves_scaled_exposure() {
        let r: u64 = 1_000_000_000; // 10.0 tokens at 8 decimals
        for (m0, m1) in AAPL_TICKS {
            let d = compute_delta_raw(r, m0, m1).unwrap();
            let before = (r as f64) * m0;
            let after = ((r - d) as f64) * m1;
            assert!(after >= before, "holder went short on tick {m0} -> {m1}");
            assert!(after - before < m1, "dust exceeded one raw unit on {m0} -> {m1}");
        }
    }

    #[test]
    fn exact_value_for_the_2026_08_08_tick() {
        // Hand arithmetic said 602_956 during design. It was wrong: that took 122 raw units
        // too many and left the holder short, inverting the one invariant this formula holds.
        // The executed value is 602_834.
        let d = compute_delta_raw(1_000_000_000, AAPL_M0, AAPL_M1).unwrap();
        assert_eq!(d, 602_834);
    }

    #[test]
    fn no_tick_means_no_delta() {
        assert_eq!(compute_delta_raw(1_000_000, AAPL_M1, AAPL_M1).unwrap(), 0);
    }

    #[test]
    fn reverse_split_is_rejected() {
        assert!(compute_delta_raw(1_000_000, AAPL_M1, AAPL_M0).is_err());
    }

    #[test]
    fn forward_split_is_rejected() {
        // A 2:1 split doubles the multiplier. Direction alone would let this through and it
        // would sell half the position for nothing.
        assert!(compute_delta_raw(1_000_000_000, 1.0, 2.0).is_err());
        // A 10:1 split, as NFLXx actually did.
        assert!(compute_delta_raw(1_000_000_000, 1.0, 10.0).is_err());
        // Just inside the ceiling still works: the largest real dividend was +2.926%.
        assert!(compute_delta_raw(1_000_000_000, 1.0, 1.029).is_ok());
        // Just outside is refused.
        assert!(compute_delta_raw(1_000_000_000, 1.0, 1.031).is_err());
    }

    #[test]
    fn zero_balance_is_zero_delta() {
        assert_eq!(compute_delta_raw(0, AAPL_M0, AAPL_M1).unwrap(), 0);
    }

    #[test]
    fn effective_multiplier_switches_at_the_timestamp() {
        let s = ScaledUi {
            multiplier: AAPL_M0,
            new_multiplier: AAPL_M1,
            effective_ts: 1_786_149_000, // 2026-08-08T00:30:00Z, the real activation
        };
        assert_eq!(s.effective(1_786_148_999), AAPL_M0);
        assert_eq!(s.effective(1_786_149_000), AAPL_M1);
        assert_eq!(s.effective(1_786_149_001), AAPL_M1);
    }

    #[test]
    fn parser_reads_a_synthetic_mint_with_the_verified_layout() {
        // Build a mint whose TLV list matches the real AAPLx account: a few extensions before
        // ScaledUiAmount, so the parser has to walk the list rather than assume position.
        let mut data = vec![0u8; TLV_START];
        data[ACCOUNT_TYPE_OFFSET] = ACCOUNT_TYPE_MINT;

        // A decoy extension first (type 12, PermanentDelegate, 32-byte body).
        data.extend_from_slice(&12u16.to_le_bytes());
        data.extend_from_slice(&32u16.to_le_bytes());
        data.extend_from_slice(&[7u8; 32]);

        // ScaledUiAmount.
        data.extend_from_slice(&EXT_SCALED_UI_AMOUNT.to_le_bytes());
        data.extend_from_slice(&(SCALED_UI_BODY_LEN as u16).to_le_bytes());
        data.extend_from_slice(&[0u8; 32]); // authority
        data.extend_from_slice(&AAPL_M0.to_le_bytes());
        data.extend_from_slice(&1_786_149_000i64.to_le_bytes());
        data.extend_from_slice(&AAPL_M1.to_le_bytes());

        let s = parse_scaled_ui(&data).unwrap();
        assert_eq!(s.multiplier, AAPL_M0);
        assert_eq!(s.new_multiplier, AAPL_M1);
        assert_eq!(s.effective_ts, 1_786_149_000);
    }

    #[test]
    fn parser_reads_the_real_mainnet_aaplx_mint() {
        // 678 raw bytes captured from mainnet on 2026-09-12. This is the strongest check in
        // the crate: it proves the offsets against production data, not against our own
        // encoder. Values cross-checked with api.backed.fi multiplier history.
        let data = include_bytes!("../tests/fixtures/aaplx-mint.bin");
        let s = parse_scaled_ui(data).unwrap();
        assert_eq!(s.multiplier, 1.0026642075893797);
        assert_eq!(s.new_multiplier, 1.0032690125398187);
        assert_eq!(s.effective_ts, 1_786_149_000); // 2026-08-08T00:30:00Z
    }

    #[test]
    fn parser_reads_the_real_mainnet_kox_mint() {
        // A second production mint, so the parser is not fitted to one account's extension
        // ordering. KOx carries the same extension set in the same TLV order.
        let data = include_bytes!("../tests/fixtures/kox-mint.bin");
        let s = parse_scaled_ui(data).unwrap();
        assert_eq!(s.multiplier, 1.013779482672994);
        assert_eq!(s.new_multiplier, 1.0183317967386898);
        assert_eq!(s.effective_ts, 1_781_481_300); // 2026-06-14T23:55:00Z
    }

    #[test]
    fn delta_against_the_real_kox_tick() {
        // KOx's real 2026-06-14 dividend on a 100.0 token position at 8 decimals.
        let data = include_bytes!("../tests/fixtures/kox-mint.bin");
        let s = parse_scaled_ui(data).unwrap();
        let r: u64 = 10_000_000_000;
        let d = compute_delta_raw(r, s.multiplier, s.new_multiplier).unwrap();
        assert!(d > 0, "a real dividend must produce a positive delta");
        let before = (r as f64) * s.multiplier;
        let after = ((r - d) as f64) * s.new_multiplier;
        assert!(after >= before, "holder went short on the real KOx tick");
        assert!(after - before < s.new_multiplier, "dust over one raw unit");
    }

    #[test]
    fn parser_rejects_a_mint_without_the_extension() {
        let mut data = vec![0u8; TLV_START + 4];
        data[ACCOUNT_TYPE_OFFSET] = ACCOUNT_TYPE_MINT;
        assert!(parse_scaled_ui(&data).is_err());
    }
}
