// TypeScript twin of programs/stokss/src/scaled_ui.rs. Both must agree exactly, and
// crank/src/parity.test.ts checks them against the same real mainnet fixtures.
//
// Layout verified against mainnet AAPLx and KOx on 2026-09-12:
//   [165]     account_type (1 = Mint)
//   [166..]   TLV list of (u16 type_id, u16 length, body)
//   ScaledUiAmount: type_id 25, length 56
//     body[0..32]  authority
//     body[32..40] multiplier                          f64 LE
//     body[40..48] new_multiplier_effective_timestamp  i64 LE
//     body[48..56] new_multiplier                      f64 LE

export const TLV_START = 166;
export const ACCOUNT_TYPE_OFFSET = 165;
export const ACCOUNT_TYPE_MINT = 1;
export const EXT_SCALED_UI_AMOUNT = 25;
export const SCALED_UI_BODY_LEN = 56;

/**
 * Ceiling on a single tick's ratio m1/m0. Must equal MAX_TICK_RATIO in scaled_ui.rs.
 *
 * A forward split raises the multiplier just as a dividend does, so direction alone is not a
 * guard. 1.03 clears every one of the 570 recorded dividends (largest observed +2.926%) and
 * still blocks every split, since the smallest possible forward split is 2:1.
 */
export const MAX_TICK_RATIO = 1.03;

export interface ScaledUi {
  multiplier: number;
  newMultiplier: number;
  effectiveTs: number;
}

export function parseScaledUi(data: Buffer): ScaledUi | null {
  if (data.length <= TLV_START) return null;
  if (data[ACCOUNT_TYPE_OFFSET] !== ACCOUNT_TYPE_MINT) return null;

  let off = TLV_START;
  while (off + 4 <= data.length) {
    const typeId = data.readUInt16LE(off);
    const len = data.readUInt16LE(off + 2);
    if (typeId === 0 && len === 0) break;

    const bodyStart = off + 4;
    const bodyEnd = bodyStart + len;
    if (bodyEnd > data.length) return null;

    if (typeId === EXT_SCALED_UI_AMOUNT) {
      if (len < SCALED_UI_BODY_LEN) return null;
      return {
        multiplier: data.readDoubleLE(bodyStart + 32),
        effectiveTs: Number(data.readBigInt64LE(bodyStart + 40)),
        newMultiplier: data.readDoubleLE(bodyStart + 48),
      };
    }
    off = bodyEnd;
  }
  return null;
}

export function effectiveMultiplier(s: ScaledUi, nowSec: number): number {
  return nowSec >= s.effectiveTs ? s.newMultiplier : s.multiplier;
}

export class TickRejected extends Error {
  constructor(public readonly reason: "decreased" | "too_large", message: string) {
    super(message);
    this.name = "TickRejected";
  }
}

/**
 * floor(R * (1 - M0/M1)). Rounds down; dust stays with the holder.
 *
 * Throws on a decrease or an oversized jump rather than returning 0, so the caller cannot
 * confuse "nothing to do" with "this is not a dividend". The program enforces the same two
 * bounds on-chain; this copy exists so the crank never builds a transaction that would fail.
 */
export function computeDeltaRaw(rawBalance: bigint, m0: number, m1: number): bigint {
  if (!Number.isFinite(m0) || !Number.isFinite(m1) || m0 <= 0 || m1 <= 0) {
    throw new TickRejected("decreased", `non-finite or non-positive multiplier ${m0} -> ${m1}`);
  }
  if (m1 < m0) {
    throw new TickRejected("decreased", `multiplier decreased ${m0} -> ${m1}, reverse split`);
  }
  if (m1 > m0 * MAX_TICK_RATIO) {
    throw new TickRejected(
      "too_large",
      `ratio ${(m1 / m0).toFixed(6)} exceeds MAX_TICK_RATIO ${MAX_TICK_RATIO}, looks like a split`,
    );
  }
  if (m1 === m0 || rawBalance === 0n) return 0n;

  const ratio = 1 - m0 / m1;
  if (ratio <= 0) return 0n;
  return BigInt(Math.floor(Number(rawBalance) * ratio));
}
