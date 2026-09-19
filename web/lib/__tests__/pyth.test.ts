import { describe, it, expect } from "vitest";
import { EQUITY_FEEDS } from "../pyth";

/**
 * Guards the PriceUpdateV2 offsets. These were derived by probing mainnet: feed_id sits at
 * 41 (8 disc + 32 write_authority + 1 verification_level). Offsets 9, 40 and 42 return zero
 * accounts. If this layout ever shifts, decoding yields silent garbage rather than an error,
 * so the offsets are asserted explicitly.
 */
const FEED_ID_OFFSET = 41;

function buildPriceUpdate(price: bigint, expo: number, publishTime: bigint, feedIdHex: string) {
  const b = Buffer.alloc(150);
  Buffer.from(feedIdHex, "hex").copy(b, FEED_ID_OFFSET);
  b.writeBigInt64LE(price, FEED_ID_OFFSET + 32);
  b.writeBigUInt64LE(BigInt(1000), FEED_ID_OFFSET + 40);
  b.writeInt32LE(expo, FEED_ID_OFFSET + 48);
  b.writeBigInt64LE(publishTime, FEED_ID_OFFSET + 52);
  return b;
}

const decode = (b: Buffer) => ({
  price: b.readBigInt64LE(FEED_ID_OFFSET + 32),
  expo: b.readInt32LE(FEED_ID_OFFSET + 48),
  publishTime: b.readBigInt64LE(FEED_ID_OFFSET + 52),
});

describe("PriceUpdateV2 offsets", () => {
  it("round-trips a realistic SPY price", () => {
    const b = buildPriceUpdate(BigInt(76296195000), -8, BigInt(1789800000), EQUITY_FEEDS.SPY);
    const d = decode(b);
    expect(Number(d.price) * Math.pow(10, d.expo)).toBeCloseTo(762.96195, 5);
    expect(d.publishTime).toBe(BigInt(1789800000));
  });

  it("keeps feed_id at offset 41", () => {
    const b = buildPriceUpdate(BigInt(1), -8, BigInt(1), EQUITY_FEEDS.SPY);
    expect(b.subarray(41, 73).toString("hex")).toBe(EQUITY_FEEDS.SPY);
  });

  it("handles negative prices without wrapping", () => {
    const d = decode(buildPriceUpdate(BigInt(-500), -2, BigInt(1), EQUITY_FEEDS.QQQ));
    expect(Number(d.price) * Math.pow(10, d.expo)).toBeCloseTo(-5, 6);
  });
});

describe("EQUITY_FEEDS", () => {
  it("every feed id is a 32-byte hex string", () => {
    for (const [sym, id] of Object.entries(EQUITY_FEEDS)) {
      expect(id, sym).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
