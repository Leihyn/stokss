import { CONFIG } from "./config.js";

/**
 * Typed access to the issuer's public API and DexScreener. Every endpoint, parameter and
 * response shape here was exercised live on 2026-09-12, including the two behaviours that
 * are easy to get wrong: the `network` parameter is required on multiplier history, and
 * price-data returns a null quote whenever the US market is closed.
 */

export interface XStockAsset {
  symbol: string;
  name: string;
  mint: string;
  isTradingHalted: boolean;
  currentPeriod: string | null; // "closed" | "market" | "extended" | "overnight"
  openNow: boolean | null;
  nextChangeAt: string | null;
}

export type TickReason = "Dividend" | "Split" | "ReverseSplit" | "Administrative";

export interface MultiplierEvent {
  id: string;
  reason: TickReason;
  multiplier: number;
  previousMultiplier: number;
  activationDateTime: string;
}

async function getJson<T>(url: string, timeoutMs = 25_000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

let assetCache: { at: number; assets: XStockAsset[] } | null = null;

/** Full catalogue. 732 Solana deployments as of 2026-09-12. Cached for ten minutes. */
export async function listAssets(force = false): Promise<XStockAsset[]> {
  if (!force && assetCache && Date.now() - assetCache.at < 600_000) return assetCache.assets;

  const out: XStockAsset[] = [];
  let page = 1;
  for (;;) {
    const d = await getJson<any>(`${CONFIG.backedApi}/assets?page=${page}&limit=100`);
    for (const n of d.nodes ?? []) {
      const dep = (n.deployments ?? []).find((x: any) => x.network === "Solana");
      if (!dep) continue;
      out.push({
        symbol: n.symbol,
        name: n.name,
        mint: dep.address,
        isTradingHalted: !!n.isTradingHalted,
        currentPeriod: n.trading?.currentPeriod ?? null,
        openNow: n.trading?.openNow ?? null,
        nextChangeAt: n.trading?.nextChangeAt ?? null,
      });
    }
    if (!d.page?.hasNextPage) break;
    page += 1;
  }
  assetCache = { at: Date.now(), assets: out };
  return out;
}

/**
 * Scheduled AND historical multiplier events.
 *
 * `network` is REQUIRED. Without it the API returns
 * {"error":"Validation error","details":[{"field":"network","message":"Required"}]}.
 */
export async function multiplierHistory(symbol: string): Promise<MultiplierEvent[]> {
  const d = await getJson<any>(
    `${CONFIG.backedApi}/assets/${symbol}/multiplier/history?network=Solana`,
  );
  return (d.nodes ?? []) as MultiplierEvent[];
}

/** Null when the US market is closed. Verified: {"quote": null} on a Saturday. */
export async function priceData(symbol: string): Promise<number | null> {
  try {
    const d = await getJson<any>(`${CONFIG.backedApi}/assets/${symbol}/price-data`);
    return d.quote ?? null;
  } catch {
    return null;
  }
}

export interface Liquidity {
  mint: string;
  priceUsdPerRawToken: number;
  liquidityUsd: number;
}

/**
 * DexScreener quotes price per RAW token, which equals share price times multiplier.
 * Verified against four mints by dividing out the multiplier and recovering a sane share
 * price. Max 30 mints per call.
 */
export async function liquidity(mints: string[]): Promise<Map<string, Liquidity>> {
  const out = new Map<string, Liquidity>();
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    try {
      const d = await getJson<any[]>(`${CONFIG.dexscreenerApi}/${chunk.join(",")}`);
      for (const p of d ?? []) {
        const mint = p.baseToken?.address;
        if (!mint) continue;
        const price = Number(p.priceUsd ?? 0);
        const liq = Number(p.liquidity?.usd ?? 0);
        const prev = out.get(mint);
        if (!prev || liq > prev.liquidityUsd) {
          out.set(mint, { mint, priceUsdPerRawToken: price, liquidityUsd: liq });
        }
      }
    } catch {
      // Non-fatal. Callers degrade: the income list loses its ordering, nothing on the
      // critical path breaks.
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}
