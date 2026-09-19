import { Connection, PublicKey } from "@solana/web3.js";

/**
 * SPYx's implied SHARE price.
 *
 * DexScreener quotes price per whole raw token. xStocks are Scaled UI Amount tokens, so a
 * raw token is worth `multiplier` shares. Dividing recovers the share price, which is the
 * only figure comparable to Pyth's equity feed. Comparing the raw quote directly to SPY
 * would be wrong by the multiplier.
 */
const SPYX_MINT = "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W";

export interface ImpliedPrice {
  impliedSharePrice: number;
  rawTokenPrice: number;
  multiplier: number;
  source: "live" | "fallback";
}

/** Measured 2026-09-19; used only when the live reads fail, and labelled as such. */
const FALLBACK: ImpliedPrice = {
  impliedSharePrice: 763.19,
  rawTokenPrice: 767.55,
  multiplier: 1.005714560286254,
  source: "fallback",
};

export async function fetchImpliedPrice(rpc: string): Promise<ImpliedPrice> {
  try {
    const [px, mult] = await Promise.all([
      fetch(`https://api.dexscreener.com/tokens/v1/solana/${SPYX_MINT}`, {
        next: { revalidate: 60 },
      })
        .then((r) => r.json())
        .then((pairs: unknown) => {
          const arr = Array.isArray(pairs) ? pairs : [];
          const best = arr
            .map((p) => p as Record<string, never>)
            .sort(
              (a, b) =>
                Number((b.liquidity as unknown as { usd?: number })?.usd ?? 0) -
                Number((a.liquidity as unknown as { usd?: number })?.usd ?? 0),
            )[0];
          return Number((best as unknown as { priceUsd?: string })?.priceUsd ?? 0);
        }),
      readMultiplier(rpc),
    ]);
    if (!(px > 0) || !(mult > 0)) return FALLBACK;
    return {
      impliedSharePrice: px / mult,
      rawTokenPrice: px,
      multiplier: mult,
      source: "live",
    };
  } catch {
    return FALLBACK;
  }
}

/** Reads the effective Scaled UI Amount multiplier straight off the mint. */
async function readMultiplier(rpc: string): Promise<number> {
  const conn = new Connection(rpc, "confirmed");
  const info = await conn.getParsedAccountInfo(new PublicKey(SPYX_MINT));
  const data = info.value?.data;
  if (!data || typeof data !== "object" || !("parsed" in data)) return 0;
  const exts = (data.parsed as { info?: { extensions?: unknown[] } })?.info?.extensions ?? [];
  const sui = exts.find(
    (e) => (e as { extension?: string })?.extension === "scaledUiAmountConfig",
  ) as { state?: { multiplier?: string; newMultiplier?: string; newMultiplierEffectiveTimestamp?: string } } | undefined;
  if (!sui?.state) return 0;
  const now = Math.floor(Date.now() / 1000);
  const effTs = Number(sui.state.newMultiplierEffectiveTimestamp ?? 0);
  return Number(now >= effTs ? sui.state.newMultiplier : sui.state.multiplier);
}
