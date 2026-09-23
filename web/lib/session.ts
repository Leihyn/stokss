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
  /**
   * Is the US REGULAR session running?
   *
   * Distinct from `openNow`, which is the issuer's 24/5 create-redeem window. At 21:00 UTC
   * the issuer reports open with period "extended" while the regular session closed an hour
   * earlier. Conflating the two put "Open" in the nav next to "The feed stopped" in the hero.
   */
  regularSession: boolean;
  /** Hours until the regular session closes. 0 when it is already shut. */
  hoursUntilClose: number;
  /** Length of the next unpriced window, in hours. */
  darkWindowHours: number;
  /** ISO timestamp of this session's close. Null when already shut. */
  sessionCloseAt: string | null;
  /**
   * How hard the NAV anchor is running, from the issuer's own published limits.
   *
   *   full     market / extended - maxOrderFiatValue at its ceiling
   *   reduced  overnight         - still creating and redeeming, at a smaller cap
   *   off      closed            - maxOrderFiatValue === 0, nothing pulls the token to NAV
   *
   * The earlier model collapsed this to a boolean and the page claimed the anchor was off
   * for every unpriced hour. Five days of polling says otherwise: weeknights report
   * `overnight` with a live cap. Only the weekend reports `closed`.
   */
  anchorState: "full" | "reduced" | "off";
  /** The issuer's cap during the regular session, for comparison against the current one. */
  marketMaxOrderFiatValue: number | null;
  /** Start of the next window in which the issuer will not create or redeem at all. */
  nextAnchorOffAt: string;
  /** Hours until that window opens. Zero when it is already open. */
  hoursUntilAnchorOff: number;
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
    regularSession: isRegularSession(now),
    hoursUntilClose: hoursUntilSessionClose(now),
    darkWindowHours: darkWindowLength(now),
    sessionCloseAt: sessionCloseIso(now),
    nextAnchorOffAt: nextAnchorOff(now).toISOString(),
    hoursUntilAnchorOff: Math.max(0, (nextAnchorOff(now).getTime() - now.getTime()) / 3_600_000),
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
    const mktLim = t.limitsPerPeriod?.market?.maxOrderFiatValue;
    const marketMax = typeof mktLim === "number" ? mktLim : null;
    return {
      ...base,
      anchorState: anchorStateFrom(maxOrder, marketMax),
      marketMaxOrderFiatValue: marketMax,
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
      anchorState: open ? "full" : "off",
      marketMaxOrderFiatValue: null,
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

/** Hours from now until the regular session closes. Zero when already shut. */
export function hoursUntilSessionClose(now: Date): number {
  if (!isRegularSession(now)) return 0;
  const { close } = sessionBoundsUtc(now);
  const c = new Date(now);
  c.setUTCHours(Math.floor(close / 60), close % 60, 0, 0);
  return Math.max(0, (c.getTime() - now.getTime()) / 3_600_000);
}

/**
 * How long the next unpriced stretch lasts.
 *
 * During the session it is close -> next open. Outside it, now -> next open. This is the
 * number the product exists to name, so it is computed rather than assumed.
 */
export function darkWindowLength(now: Date): number {
  const from = new Date(now);
  if (isRegularSession(now)) {
    const { close } = sessionBoundsUtc(now);
    from.setUTCHours(Math.floor(close / 60), close % 60, 0, 0);
  }
  return (nextRegularOpen(from).getTime() - from.getTime()) / 3_600_000;
}

/** ISO timestamp of the current session's close, or null when already shut. */
export function sessionCloseIso(now: Date): string | null {
  if (!isRegularSession(now)) return null;
  const { close } = sessionBoundsUtc(now);
  const c = new Date(now);
  c.setUTCHours(Math.floor(close / 60), close % 60, 0, 0);
  return c.toISOString();
}

/**
 * Classify the anchor from two numbers the issuer publishes itself.
 *
 * Zero is unambiguous: no creation, no redemption, no arbitrage. Anything below the
 * regular-session ceiling is a throttle, not a shutdown, and saying otherwise overstates
 * the problem on four nights out of seven.
 */
export function anchorStateFrom(
  current: number | null,
  marketCeiling: number | null,
): "full" | "reduced" | "off" {
  if (current === 0) return "off";
  if (current === null) return "full";
  if (marketCeiling !== null && current < marketCeiling) return "reduced";
  return "full";
}

/**
 * Start of the next stretch in which the issuer creates and redeems nothing.
 *
 * Measured, not assumed: 5,385 polls between 2026-09-18 and 2026-09-23 report `closed`
 * across the whole of Saturday and Sunday and at no other time except ~10-minute gaps at
 * session boundaries. The longest continuously observed run was 42.1 hours.
 */
export function nextAnchorOff(now: Date): Date {
  const d = new Date(now);
  const day = d.getUTCDay();
  if (day === 6 || day === 0) return now; // already inside it
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() + ((6 - day + 7) % 7 || 7));
  sat.setUTCHours(0, 0, 0, 0);
  return sat;
}
