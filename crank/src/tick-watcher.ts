import { Connection, PublicKey } from "@solana/web3.js";

import { CONFIG } from "./config.js";
import { parseScaledUi } from "./scaled-ui.js";
import { enqueueTick, lastSeen, recordSeen } from "./store.js";
import { listAssets, multiplierHistory, type TickReason } from "./xstocks-client.js";

/**
 * Detect corporate actions by watching the mint accounts themselves.
 *
 * Two detectors, deliberately redundant:
 *   1. On-chain. newMultiplier or the activation timestamp differs from the last observation.
 *      This is authoritative and free.
 *   2. Issuer API. Cross-checked only to learn the REASON, because the chain does not say
 *      whether a change is a Dividend, a Split, a ReverseSplit or an Administrative
 *      correction.
 *
 * Only Dividend is harvested. A split is value-neutral in raw terms, since the share price
 * moves inversely to the multiplier, so harvesting one would sell real exposure for nothing.
 * Unknown is treated as not-a-dividend and skipped: the safe default is to do nothing.
 *
 * TIMING. This only fires on a change BETWEEN two observations, and enroll snapshots the
 * multiplier at the moment of enrollment. A tick that activates before the watcher is running
 * and the plan is enrolled is unharvestable, permanently. That is why the crank has to be up
 * before the expected activation, not after it.
 */

export interface WatchTarget {
  mint: string;
  symbol: string;
  /** false when a plan is enrolled on this mint, so the tick can actually be harvested. */
  watchOnly: boolean;
}

/** Resolve the configured watchlist symbols to mints, for detection without enrollment. */
export async function resolveWatchlist(): Promise<WatchTarget[]> {
  const assets = await listAssets();
  const bySymbol = new Map(assets.map((a) => [a.symbol, a]));
  const out: WatchTarget[] = [];
  for (const sym of CONFIG.watchlist) {
    const a = bySymbol.get(sym);
    if (a) out.push({ mint: a.mint, symbol: a.symbol, watchOnly: true });
  }
  return out;
}

async function reasonFor(symbol: string, newMultiplier: number): Promise<TickReason | "Unknown"> {
  try {
    const hist = await multiplierHistory(symbol);
    const match = hist.find((h) => Math.abs(h.multiplier - newMultiplier) < 1e-12);
    return match ? match.reason : "Unknown";
  } catch {
    return "Unknown";
  }
}

export interface PollResult {
  polled: number;
  changed: number;
  queued: number;
  skipped: number;
  firstSight: number;
}

export async function pollTicks(
  conn: Connection,
  targets: WatchTarget[],
): Promise<PollResult> {
  const res: PollResult = { polled: 0, changed: 0, queued: 0, skipped: 0, firstSight: 0 };
  if (targets.length === 0) return res;

  for (let i = 0; i < targets.length; i += 100) {
    const chunk = targets.slice(i, i + 100);
    const infos = await conn.getMultipleAccountsInfo(chunk.map((t) => new PublicKey(t.mint)));

    for (let j = 0; j < chunk.length; j++) {
      const info = infos[j];
      const t = chunk[j];
      if (!info) continue;
      res.polled++;

      const sui = parseScaledUi(Buffer.from(info.data));
      if (!sui) continue;

      const prev = lastSeen(t.mint);
      recordSeen(t.mint, {
        multiplier: sui.multiplier,
        newMultiplier: sui.newMultiplier,
        effectiveTs: sui.effectiveTs,
      });

      if (!prev) {
        // First sight. Record the baseline and never harvest history: whatever happened
        // before we were watching belongs to the holder.
        res.firstSight++;
        continue;
      }

      const changed =
        prev.newMultiplier !== sui.newMultiplier || prev.effectiveTs !== sui.effectiveTs;
      if (!changed) continue;
      res.changed++;

      const reason = await reasonFor(t.symbol, sui.newMultiplier);
      const isDividend = reason === "Dividend";
      const row = enqueueTick({
        mint: t.mint,
        symbol: t.symbol,
        m0: prev.newMultiplier,
        m1: sui.newMultiplier,
        activationTs: sui.effectiveTs,
        reason,
        state: isDividend && !t.watchOnly ? "queued" : "skipped",
        watchOnly: t.watchOnly,
      });
      if (!row) continue;

      if (isDividend && !t.watchOnly) res.queued++;
      else res.skipped++;

      const pct = ((sui.newMultiplier / prev.newMultiplier - 1) * 100).toFixed(4);
      const when = new Date(sui.effectiveTs * 1000).toISOString();
      const tag = t.watchOnly ? "watch-only" : row.state;
      console.log(
        `[tick-watcher] ${t.symbol} ${reason} +${pct}% effective ${when} -> ${tag}`,
      );
      if (t.watchOnly && isDividend) {
        console.log(
          `[tick-watcher]   real mainnet dividend detected on ${t.symbol}. ` +
            `No plan is enrolled on this mint, so nothing is harvested.`,
        );
      }
    }
  }
  return res;
}
