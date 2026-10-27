import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import snapshot from "@/data/example-candidates.json";

const CLMM = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");

/** SPYx / USDC, the deepest tokenized-equity CLMM pool at the last exposure scan. */
export const EXAMPLE_POOL = "6truu3rZuiB9rKQg4VYC3Dt3QwV7DgwGqXrYUcrvnDDE";

/** 0.01 SOL: comfortably above the fee and priority fee of one decreaseLiquidity. */
const MIN_FEE_LAMPORTS = 10_000_000;

export interface Candidate {
  owner: string;
  nft: string;
}

/**
 * Funded wallets holding a live position in the pool, largest position first.
 *
 * Same PersonalPositionState layout as crank/src/exposure-scan.ts: nft_mint at 9, pool_id
 * at 41, liquidity u128 at 81. The position belongs to whoever holds its NFT; program-owned
 * holders (vault strategies) are skipped so the example is an ordinary wallet, and unfunded
 * wallets are skipped because their exit simulation fails before Raydium runs.
 */
export async function liveCandidates(rpc: string, limit: number, pool = EXAMPLE_POOL): Promise<Candidate[]> {
  // No 429 backoff: on the public RPC this scan is refused, and waiting it out cost ~15s.
  const conn = new Connection(rpc, { commitment: "confirmed", disableRetryOnRateLimit: true });
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

  const out: Candidate[] = [];
  for (const { nft } of ranked) {
    if (out.length >= limit) break;
    const largest = await conn.getTokenLargestAccounts(nft);
    const held = largest.value.find((v) => v.uiAmount === 1);
    if (!held) continue;
    const info = await conn.getParsedAccountInfo(held.address);
    const data = info.value?.data;
    const owner = data && "parsed" in data ? (data.parsed?.info?.owner as string | undefined) : undefined;
    if (!owner || !PublicKey.isOnCurve(new PublicKey(owner).toBytes())) continue;
    if ((await conn.getBalance(new PublicKey(owner))) < MIN_FEE_LAMPORTS) continue;
    if (!out.some((c) => c.owner === owner)) out.push({ owner, nft: nft.toBase58() });
  }
  return out;
}

/**
 * Picks a real liquidity provider from the example pool at the moment it is asked for.
 *
 * The example used to be a hardcoded address. That provider later left every tokenized
 * equity pool, and the "no wallet?" path quietly started showing an empty result.
 *
 * The live scan needs getProgramAccounts, which the public RPC rate-limits. When it is
 * refused, a shipped snapshot (scripts/example-candidates.mts) is re-checked with cheap
 * calls: the wallet must still hold the position NFT and still be funded.
 */
export async function findExampleOwner(
  rpc: string,
  fallback: Candidate[] = snapshot.candidates,
): Promise<PublicKey> {
  try {
    const [c] = await liveCandidates(rpc, 1);
    if (c) return new PublicKey(c.owner);
  } catch {
    // Rate-limited or refused: fall through to the snapshot.
  }
  const conn = new Connection(rpc, "confirmed");
  for (const c of fallback) {
    const owner = new PublicKey(c.owner);
    const held = await conn.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(c.nft) });
    const stillHeld = held.value.some((a) => a.account.data.parsed?.info?.tokenAmount?.uiAmount === 1);
    if (!stillHeld) continue;
    if ((await conn.getBalance(owner)) < MIN_FEE_LAMPORTS) continue;
    return owner;
  }
  throw new Error("No live liquidity provider found in the example pool.");
}
