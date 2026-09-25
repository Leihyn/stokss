import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { loadRawPositions, buildWithdrawal } from "../withdraw";

/**
 * Proof, not assertion: builds a real exit for a real mainnet position and decodes the
 * instruction bytes to show the slippage floor is actually on the wire.
 *
 * Skipped by `npm test` because it needs network. Run it yourself:
 *
 *     npm run prove
 *
 * The claim it defends: the withdrawal used to pass amountMin = 0, accepting any output.
 * It now carries minimums derived from the position's own tick range. A comment saying so
 * is worth nothing; these are the bytes the validator would see.
 */
const LIVE = process.env.PROVE_LIVE === "1";
const OWNER = "bygBkeZNTWKxBpkF8CRJYm9DkCMTf6e4xErQnYPqVmQ";
const CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

const rpc = () => {
  for (const f of ["../.env", ".env.local", ".env"]) {
    try {
      const s = readFileSync(f, "utf8");
      const m = s.match(/^SOLANA_RPC_URL_MAINNET=(.+)$/m) ?? s.match(/^SOLANA_RPC_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  return "https://api.mainnet-beta.solana.com";
};

const le64 = (b: Uint8Array, o: number) => new BN(Buffer.from(b.slice(o, o + 8)), "le");
const le128 = (b: Uint8Array, o: number) => new BN(Buffer.from(b.slice(o, o + 16)), "le");

describe.skipIf(!LIVE)("the slippage floor is on the wire", () => {
  it("encodes non-zero minimums into decreaseLiquidity", async () => {
    const owner = new PublicKey(OWNER);
    console.log(`\n  owner     ${OWNER}`);
    const positions = await loadRawPositions(rpc(), owner);
    const pos = positions.find((p) => !new BN(p.liquidity.toString()).isZero())!;
    console.log(`  pool      ${pos.poolId.toBase58()}`);
    console.log(`  ticks     ${pos.tickLower} -> ${pos.tickUpper}`);

    const built = await buildWithdrawal(rpc(), owner, pos, 1);
    console.log(`  slippage  ${built.slippageBps} bps`);
    console.log(`  expected  ${built.amounts.expectedA} / ${built.amounts.expectedB}`);
    console.log(`  floor     ${built.amounts.minA} / ${built.amounts.minB}`);

    const msg = (built.transaction as VersionedTransaction).message;
    const keys = msg.staticAccountKeys.map((k) => k.toBase58());
    let found = 0;
    for (const ix of msg.compiledInstructions) {
      if (keys[ix.programIdIndex] !== CLMM) continue;
      const d = ix.data;
      if (d.length < 40) continue;
      if (le128(d, 8).toString() !== built.liquidity) continue;
      const min0 = le64(d, 24);
      const min1 = le64(d, 32);
      console.log(`\n  DECODED FROM INSTRUCTION DATA`);
      console.log(`  amount0Min  ${min0.toString()}`);
      console.log(`  amount1Min  ${min1.toString()}`);
      console.log(`  both non-zero: ${!min0.isZero() && !min1.isZero()}\n`);
      expect(min0.isZero()).toBe(false);
      expect(min1.isZero()).toBe(false);
      expect(min0.toString()).toBe(built.amounts.minA.toString());
      expect(min1.toString()).toBe(built.amounts.minB.toString());
      found++;
    }
    expect(found).toBeGreaterThan(0);
  }, 180_000);
});
