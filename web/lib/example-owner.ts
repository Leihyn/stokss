import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const CLMM = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");

/** SPYx / USDC, the deepest tokenized-equity CLMM pool at the last exposure scan. */
export const EXAMPLE_POOL = "6truu3rZuiB9rKQg4VYC3Dt3QwV7DgwGqXrYUcrvnDDE";

/** 0.01 SOL: comfortably above the fee and priority fee of one decreaseLiquidity. */
const MIN_FEE_LAMPORTS = 10_000_000;

/**
 * Picks a real liquidity provider from the example pool at the moment it is asked for.
 *
 * The example used to be a hardcoded address. That provider later left every tokenized
 * equity pool, and the "no wallet?" path quietly started showing an empty result. Reading
 * the pool live means the example is exposed for as long as the pool has anyone in it.
 *
 * Same PersonalPositionState layout as crank/src/exposure-scan.ts: nft_mint at 9, pool_id
 * at 41, liquidity u128 at 81. The position belongs to whoever holds its NFT; program-owned
 * holders (vault strategies) are skipped so the example is an ordinary wallet.
 */
export async function findExampleOwner(rpc: string, pool = EXAMPLE_POOL): Promise<PublicKey> {
  const conn = new Connection(rpc, "confirmed");
  const accts = await conn.getProgramAccounts(CLMM, {
    commitment: "confirmed",
    dataSlice: { offset: 9, length: 88 },
    filters: [{ memcmp: { offset: 41, bytes: pool } }],
  });
  const ranked = accts
    .map((a) => ({
      nft: new PublicKey(a.account.data.subarray(0, 32)),
      liquidity: new BN(a.account.data.subarray(72, 88), "le"),
    }))
    .filter((p) => !p.liquidity.isZero())
    .sort((a, b) => b.liquidity.cmp(a.liquidity));

  for (const { nft } of ranked.slice(0, 10)) {
    const largest = await conn.getTokenLargestAccounts(nft);
    const held = largest.value.find((v) => v.uiAmount === 1);
    if (!held) continue;
    const info = await conn.getParsedAccountInfo(held.address);
    const data = info.value?.data;
    const owner = data && "parsed" in data ? (data.parsed?.info?.owner as string | undefined) : undefined;
    if (!owner || !PublicKey.isOnCurve(new PublicKey(owner).toBytes())) continue;
    // An unfunded wallet cannot pay the exit's fee, so its simulation fails before Raydium runs.
    if ((await conn.getBalance(new PublicKey(owner))) < MIN_FEE_LAMPORTS) continue;
    return new PublicKey(owner);
  }
  throw new Error("No live liquidity provider found in the example pool.");
}
