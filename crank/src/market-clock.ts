import { listAssets } from "./xstocks-client.js";

/**
 * Is the US equity market open?
 *
 * This matters more than it looks: 98.3% of the 583 recorded multiplier ticks activate while
 * the market is closed, clustered at 23:00 and 00:00 UTC. Selling into that window means
 * selling into a book with no primary-market arbitrage behind it, because the issuer's own
 * issuance and redemption run 24/5 and switch off with the market.
 *
 * Primary source is the issuer, which publishes currentPeriod, openNow and nextChangeAt on
 * every asset. The local calendar is only a fallback for when that API is unreachable.
 */

export interface MarketState {
  open: boolean;
  source: "issuer" | "calendar";
  nextOpen: Date;
  period: string | null;
}

/**
 * US market holidays. [ASSUMED] and only consulted when the issuer API is down.
 * Downstream item D-9 tracks verifying these against an exchange calendar.
 */
const HOLIDAYS = new Set([
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
]);

let cache: { at: number; state: MarketState } | null = null;

function calendarIsOpen(now: Date): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  if (HOLIDAYS.has(now.toISOString().slice(0, 10))) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  // Regular session 13:30 to 20:00 UTC while the US is on EDT.
  return mins >= 13 * 60 + 30 && mins < 20 * 60;
}

function nextOpenFrom(now: Date): Date {
  const d = new Date(now);
  for (let i = 0; i < 10; i++) {
    d.setUTCHours(13, 30, 0, 0);
    if (d > now && calendarIsOpen(d)) return d;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export async function marketState(): Promise<MarketState> {
  const now = new Date();
  if (cache && Date.now() - cache.at < 60_000) return cache.state;

  let state: MarketState;
  try {
    const assets = await listAssets();
    const a = assets.find((x) => x.openNow !== null && !x.isTradingHalted);
    if (a) {
      state = {
        open: !!a.openNow,
        source: "issuer",
        nextOpen: a.nextChangeAt ? new Date(a.nextChangeAt) : nextOpenFrom(now),
        period: a.currentPeriod,
      };
    } else {
      state = {
        open: calendarIsOpen(now), source: "calendar",
        nextOpen: nextOpenFrom(now), period: null,
      };
    }
  } catch {
    state = {
      open: calendarIsOpen(now), source: "calendar",
      nextOpen: nextOpenFrom(now), period: null,
    };
  }
  cache = { at: Date.now(), state };
  return state;
}
