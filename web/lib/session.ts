/**
 * Three clocks disagree, and the gap between them is the product.
 *
 *   US regular session   32.5 h/week   the only hours the underlying is actually priced
 *   Issuer create/redeem 120 h/week    24/5; the NAV anchor. Off when currentPeriod=closed.
 *   Solana              168 h/week     always on
 *
 * The issuer publishes currentPeriod, openNow, nextChangeAt and limitsPerPeriod on every
 * asset. limitsPerPeriod[currentPeriod].maxOrderFiatValue === 0 is the load-bearing signal:
 * it means creation and redemption are disabled, so nothing is arbitraging the token back
 * to net asset value.
 */

export type Period = "market" | "extended" | "overnight" | "closed";

export interface SessionState {
  symbol: string;
  period: Period | null;
  openNow: boolean;
  isTradingHalted: boolean;
  exchange: string | null;
  /** False when the issuer will not create or redeem, i.e. the NAV anchor is off. */
  createRedeemEnabled: boolean;
  maxOrderFiatValue: number | null;
  /** Next issuer session transition, from the issuer itself. */
  nextChangeAt: string | null;
  /** Next US REGULAR session open. This is when the underlying gets priced again. */
  nextRegularOpenAt: string;
  /** Hours from now until the underlying is priced again. The exposure window. */
  unpricedHoursAhead: number;
  source: "issuer" | "calendar";
  fetchedAt: string;
}

const HOLIDAYS = new Set(["2026-09-07", "2026-11-26", "2026-12-25"]);

/**
 * Is the US on Daylight Time on this date?
 *
 * DST runs from the second Sunday in March to the first Sunday in November, switching at
 * 02:00 local. Day granularity is sufficient here: the transition happens hours before any
 * session boundary we care about.
 *
 * This matters because the regular session is 09:30-16:00 EASTERN, not a fixed UTC window.
 * Hardcoding 13:30-20:00 UTC is right for eight months of the year and an hour wrong for
 * the other four, and that constant propagates into the week grid and the chart axis.
 */
export function isUsDst(d: Date): boolean {
  const y = d.getUTCFullYear();
  const march = new Date(Date.UTC(y, 2, 1));
  const secondSunMarch = 8 + ((7 - march.getUTCDay()) % 7);
  const nov = new Date(Date.UTC(y, 10, 1));
  const firstSunNov = 1 + ((7 - nov.getUTCDay()) % 7);
  const start = Date.UTC(y, 2, secondSunMarch);
  const end = Date.UTC(y, 10, firstSunNov);
  const t = Date.UTC(y, d.getUTCMonth(), d.getUTCDate());
  return t >= start && t < end;
}

/** Regular session open/close in UTC minutes for the given date. */
export function sessionBoundsUtc(d: Date): { open: number; close: number } {
  // 09:30-16:00 Eastern. EDT = UTC-4, EST = UTC-5.
  return isUsDst(d) ? { open: 810, close: 1200 } : { open: 870, close: 1260 };
}

export function isRegularSession(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  if (HOLIDAYS.has(d.toISOString().slice(0, 10))) return false;
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  const { open, close } = sessionBoundsUtc(d);
  return m >= open && m < close;
}

export function nextRegularOpen(from: Date): Date {
  const d = new Date(from);
  for (let i = 0; i < 12; i++) {
    const c = new Date(d);
    const { open } = sessionBoundsUtc(d);
    c.setUTCHours(Math.floor(open / 60), open % 60, 0, 0);
    if (c > from && c.getUTCDay() !== 0 && c.getUTCDay() !== 6 && !HOLIDAYS.has(c.toISOString().slice(0, 10))) return c;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

const API = "https://api.backed.fi/api/v2/public";

export async function fetchSession(symbol = "SPYx"): Promise<SessionState> {
  const now = new Date();
  const nro = nextRegularOpen(now);
  const base = {
    symbol,
    nextRegularOpenAt: nro.toISOString(),
    unpricedHoursAhead: isRegularSession(now) ? 0 : (nro.getTime() - now.getTime()) / 3_600_000,
    fetchedAt: now.toISOString(),
  };
  try {
    const r = await fetch(`${API}/assets/${symbol}?network=Solana`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const t = j?.trading ?? {};
    const period = (t.currentPeriod ?? null) as Period | null;
    const lim = period ? t.limitsPerPeriod?.[period] : null;
    const maxOrder = typeof lim?.maxOrderFiatValue === "number" ? lim.maxOrderFiatValue : null;
    return {
      ...base,
      period,
      openNow: !!t.openNow,
      isTradingHalted: !!(t.isTradingHalted ?? j?.isTradingHalted),
      exchange: t.exchange?.abbreviation ?? t.exchange?.mic ?? null,
      createRedeemEnabled: maxOrder === null ? true : maxOrder > 0,
      maxOrderFiatValue: maxOrder,
      nextChangeAt: t.nextChangeAt ?? null,
      source: "issuer",
    };
  } catch {
    // Issuer unreachable. Degrade to the calendar rather than guessing the anchor is on.
    const open = isRegularSession(now);
    return {
      ...base,
      period: open ? "market" : "closed",
      openNow: open,
      isTradingHalted: false,
      exchange: null,
      createRedeemEnabled: open,
      maxOrderFiatValue: null,
      nextChangeAt: null,
      source: "calendar",
    };
  }
}
