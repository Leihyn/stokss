import { describe, it, expect } from "vitest";
import BN from "bn.js";
import { withdrawalMinimums, DEFAULT_SLIPPAGE_BPS } from "../withdraw";

/**
 * Fixture read off mainnet on 2026-09-23 from Raydium CLMM pool
 * 49iMatQtoyabsYAQc8GafVq6aeBFVDxSRH44oiatyyw6, a live position held by
 * bygBkeZNTWKxBpkF8CRJYm9DkCMTf6e4xErQnYPqVmQ. Pinning the integers means an SDK upgrade
 * that changes the tick math fails here instead of silently shipping a wrong floor into a
 * transaction a holder signs.
 */
const POSITION = {
  sqrtPriceCurrentX64: new BN("27706915002851346933"),
  tickLower: 7700,
  tickUpper: 8350,
  liquidity: new BN("4949944955925"),
};

describe("withdrawalMinimums", () => {
  it("reproduces the measured value of the position at the current price", () => {
    const { expectedA, expectedB } = withdrawalMinimums({ ...POSITION, slippageBps: 0 });
    expect(expectedA.toString()).toBe("35025776854");
    expect(expectedB.toString()).toBe("160421966287");
  });

  it("puts the floor 50bps under that, which is the default", () => {
    const { minA, minB } = withdrawalMinimums(POSITION);
    expect(DEFAULT_SLIPPAGE_BPS).toBe(50);
    expect(minA.toString()).toBe("34850647970");
    expect(minB.toString()).toBe("159619856456");
  });

  it("never returns a floor above the expected output", () => {
    // A floor above what the pool can pay would revert an honest exit.
    for (const slippageBps of [0, 1, 50, 100, 500]) {
      const a = withdrawalMinimums({ ...POSITION, slippageBps });
      expect(a.minA.lte(a.expectedA)).toBe(true);
      expect(a.minB.lte(a.expectedB)).toBe(true);
    }
  });

  it("widens the band monotonically as slippage rises", () => {
    const tight = withdrawalMinimums({ ...POSITION, slippageBps: 10 });
    const loose = withdrawalMinimums({ ...POSITION, slippageBps: 100 });
    expect(loose.minA.lt(tight.minA)).toBe(true);
    expect(loose.minB.lt(tight.minB)).toBe(true);
  });

  it("is zero-slippage-exact, so 0bps means no allowance at all", () => {
    const { expectedA, expectedB, minA, minB } = withdrawalMinimums({
      ...POSITION,
      slippageBps: 0,
    });
    expect(minA.eq(expectedA)).toBe(true);
    expect(minB.eq(expectedB)).toBe(true);
  });

  it("rejects a slippage that is not a fraction of the position", () => {
    // The old code path was effectively slippageBps = 10000 (accept anything). Guard it.
    expect(() => withdrawalMinimums({ ...POSITION, slippageBps: -1 })).toThrow();
    expect(() => withdrawalMinimums({ ...POSITION, slippageBps: 10_001 })).toThrow();
    expect(() => withdrawalMinimums({ ...POSITION, slippageBps: NaN })).toThrow();
  });
});
