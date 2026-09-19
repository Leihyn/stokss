"use client";

import { useEffect, useState } from "react";

/**
 * The hero argument, in one chart.
 *
 * Pyth cannot publish a price the market is not quoting, so the equity feed's
 * publish_time stops at the closing bell. The tokenized share keeps trading
 * against that frozen number for the whole unpriced window.
 *
 * THE HONESTY RULE OF THIS CHART, which must survive every future edit:
 * exactly TWO points are plotted, and NOTHING is drawn between them. We hold no
 * tick series for the token, so a line would be a picture of nothing. The dashed
 * horizontal rule is not a price path either — it is the single frozen value the
 * feed keeps reporting, unchanged. The y-axis is truncated so the two prints
 * separate at all; the caption discloses the truncation and the x-axis is not
 * truncated, because the x-axis is the finding.
 */
export interface FrozenPrintProps {
  /** Pyth Equity.US.SPY/USD last print. */
  equityPrice: number;
  /** How stale that print is, in seconds. */
  equityAgeSeconds: number;
  /** SPYx implied share price now. */
  impliedPrice: number;
  /** Hours until the underlying is priced again. */
  unpricedHoursAhead: number;
  /** ISO timestamp of the next US regular session open. */
  nextRegularOpenAt: string;
  marketOpen: boolean;
  createRedeemEnabled: boolean;
}

/* ── chart domain ─────────────────────────────────────────────────────────
   x is hours since the last print. The regular session is 13:30–20:00 UTC,
   so the bell sits at 0 and the session opens at −6.5. Padding on both ends
   keeps the terminus and the next-print rule off the plot edges.          */
const SESSION_H = 6.5;
const PAD_LEFT_H = 2;
const PAD_RIGHT_H = 2.5;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Gridline values on a truncated axis, at steps a reader can add up in their head. */
function niceTicks(min: number, max: number): number[] {
  const span = max - min;
  const steps = [0.01, 0.02, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 1, 2, 5, 10, 25];
  const step = steps.find((s) => span / s <= 5) ?? 50;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    out.push(Number(v.toFixed(4)));
  }
  return out;
}

function fmtCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0h 00m 00s";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}h ${pad2(Math.floor((s % 3600) / 60))}m ${pad2(s % 60)}s`;
}

/** UTC only — a local-time format would not survive hydration. */
function fmtUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DAYS[d.getUTCDay()]} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`;
}

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FrozenPrint({
  equityPrice,
  equityAgeSeconds,
  impliedPrice,
  unpricedHoursAhead,
  nextRegularOpenAt,
  marketOpen,
  createRedeemEnabled,
}: FrozenPrintProps) {
  // Initialised from the prop so the first client render matches the server's,
  // then the interval takes over. No hydration mismatch, no frozen clock.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(nextRegularOpenAt).getTime();
    const tick = () => setRemainingMs(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRegularOpenAt]);

  const countdown =
    remainingMs === null
      ? fmtCountdown(unpricedHoursAhead * 3_600_000)
      : fmtCountdown(remainingMs);

  /* ── geometry ─────────────────────────────────────────────────────────── */
  const elapsedH = Math.max(equityAgeSeconds / 3600, 0);
  const aheadH = Math.max(unpricedHoursAhead, 0);
  // Never collapse the x-domain: a zero-length window puts every right-hand
  // annotation past the panel edge and widens the document.
  const windowH = Math.max(elapsedH + aheadH, SESSION_H);

  const xMin = -(SESSION_H + PAD_LEFT_H);
  const xMax = windowH + PAD_RIGHT_H;
  const px = (h: number) => ((h - xMin) / (xMax - xMin)) * 100;

  const X_OPEN = px(-SESSION_H);
  const X_BELL = px(0);
  const X_NOW = Math.min(Math.max(px(elapsedH), X_BELL), px(windowH));
  const X_NEXT = px(windowH);

  const gap = impliedPrice - equityPrice;
  const gapPct = equityPrice === 0 ? 0 : (gap / equityPrice) * 100;
  // Truncated on purpose: without it the two prints land on the same pixel.
  // The caption discloses the range. The x-axis is NOT truncated.
  const yRange = Math.max(0.55, Math.abs(gap) * 2.4);
  const mid = (equityPrice + impliedPrice) / 2;
  const yTop = mid + yRange / 2;
  const yBot = mid - yRange / 2;
  const py = (p: number) => ((yTop - p) / yRange) * 100;

  const Y_EQ = py(equityPrice);
  const Y_DEX = py(impliedPrice);
  // Ticks that land on the plot's own top or bottom rail print their label on
  // the panel border, so they are dropped rather than nudged.
  const ticks = niceTicks(yBot, yTop).filter((t) => py(t) > 4 && py(t) < 98);

  const gapLabel = `${gap >= 0 ? "+" : "−"}$${Math.abs(gap).toFixed(2)}`;
  const gapPctLabel = `${gapPct >= 0 ? "+" : "−"}${Math.abs(gapPct).toFixed(3)}%`;
  const nextPrint = fmtUtc(nextRegularOpenAt);
  const elapsedLabel = fmtHours(elapsedH);
  const aheadLabel = fmtHours(aheadH);
  const windowLabel = fmtHours(windowH);

  // The in-plot void annotation needs the dead space to the RIGHT of "now".
  // Once the markers sit past the middle there is none, so the caption carries
  // the sentence instead — the same trade the layout makes below xl.
  const voidInPlot = X_NOW < 44;
  // A short window puts "feed stops" and "next print" on the same pixels, and
  // puts "now" on top of "bell". Both shed their detail rather than collide.
  const roomForDetail = X_NEXT - X_BELL >= 50;
  const nowClearOfBell = X_NOW - X_BELL >= 6;

  const anchorOff = !createRedeemEnabled;
  const anchorSentence = anchorOff
    ? "creation and redemption are off, so no arbitrage pulls the token back to NAV."
    : "creation and redemption are on, so arbitrage can still pull the token back to NAV.";

  const altText =
    `Chart of two measured price points. The Pyth equity feed for SPY published ` +
    `${usd(equityPrice)} at the closing bell and has not published since; its value is held ` +
    `flat and its publish time is frozen ${elapsedLabel} ago. The SPYx tokenized share implies ` +
    `${usd(impliedPrice)} right now, ${elapsedLabel} after that last print, a gap of ` +
    `${gapLabel} or ${gapPctLabel}. No price path is drawn between the two points because no ` +
    `tick series was measured. ${aheadLabel} remain before the underlying is priced again, a ` +
    `${windowLabel} unpriced window in total.`;

  return (
    <section
      aria-labelledby="frozen-print-title"
      className="mx-auto w-full max-w-[1560px] pl-5 pt-10 pb-12 sm:pl-8 lg:pl-14 lg:pt-16 lg:pb-16"
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,min(34vw,420px))_minmax(0,1fr)] lg:items-start lg:gap-[clamp(26px,3.6vw,58px)]">
        {/* ── rail ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 pr-5 sm:pr-8 lg:pr-0 lg:pt-1.5">
          <div className="flex flex-wrap items-center gap-3.5">
            <span
              className={`inline-flex items-center gap-2 font-mono text-micro font-medium uppercase ${
                marketOpen ? "text-live-400" : "text-shut-400"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  marketOpen ? "bg-live-400" : "bg-shut-400"
                }`}
              />
              {marketOpen ? "Priced now" : "Unpriced now"}
            </span>
            <span className="tnum font-mono text-micro uppercase text-ink-500">
              Equity.US.SPY/USD
            </span>
          </div>

          <h1
            id="frozen-print-title"
            className="text-display font-bold text-ink-100 [font-stretch:88%]"
          >
            The feed stopped.
            <br />
            The token didn&rsquo;t.
          </h1>

          <p className="text-lede text-ink-300">
            {marketOpen ? (
              <>
                The US regular session is open, so Pyth is publishing SPY again and the two prints
                below are both live. The argument this page makes is about the{" "}
                <span className="tnum font-mono text-ink-100">135.5</span> hours a week when it
                is not.
              </>
            ) : (
              <>
                Pyth holds its last SPY print until the next session, because Pyth cannot publish a
                price the market isn&rsquo;t quoting. SPYx keeps trading against that frozen number
                for another <span className="tnum font-mono text-ink-100">{aheadLabel}</span>
                {anchorOff ? ", with creation and redemption switched off." : "."}
              </>
            )}
          </p>

          {/* the two measured prints, as cards */}
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-base-700 bg-base-700 sm:grid-cols-[1.18fr_1fr]">
            <div className="flex flex-col gap-1.5 bg-base-900 px-4 pt-4 pb-4">
              <span className="tnum font-mono text-micro uppercase text-ink-500">
                Last priced · Pyth
              </span>
              <span className="tnum font-mono text-[clamp(1.4rem,3.4vw,2.05rem)] font-medium leading-none tracking-[-0.02em] text-ink-100">
                {usd(equityPrice)}
              </span>
              <span className="text-body text-ink-500">
                <span className="tnum font-mono">publish_time</span> frozen{" "}
                <span className="tnum font-mono">{elapsedLabel}</span> ago
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-base-850 px-4 pt-4 pb-4">
              <span className="tnum font-mono text-micro uppercase text-live-400">
                Trading now · SPYx
              </span>
              <span className="tnum font-mono text-[clamp(1.4rem,3.4vw,2.05rem)] font-medium leading-none tracking-[-0.02em] text-ink-100">
                {usd(impliedPrice)}
              </span>
              <span className="text-body text-ink-500">Implied share price, continuous</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-y border-base-700 py-4">
            <span className="max-w-[26ch] min-w-0 font-mono text-micro uppercase text-ink-500">
              {marketOpen ? "Until the session closes again" : "Until the underlying is priced again"}
            </span>
            <span
              className="tnum shrink-0 font-mono text-[clamp(1.15rem,2.6vw,1.9rem)] font-medium leading-none tracking-[-0.02em] whitespace-nowrap text-shut-400"
              aria-live="off"
            >
              {countdown}
            </span>
          </div>

          <p className="border-l border-base-700 pl-3 text-body text-ink-500">
            Every figure here is read back from a measurement or a live feed. Nothing on this page
            is modelled, and nothing is drawn that was not observed.
          </p>
        </div>

        {/* ── the chart. it explains itself; there is no legend. ─────────── */}
        <div className="-ml-5 border-y border-base-700 bg-base-900 pt-4 sm:-ml-8 lg:ml-0 lg:rounded-l-card lg:border-l">
          <figure className="m-0">
            <div className="flex flex-wrap items-start gap-4 border-b border-base-800 px-5 pb-3.5">
              <div className="min-w-0">
                <div className="text-read font-semibold text-ink-100 [font-stretch:88%]">
                  Two measured prints, and the space between them
                </div>
                <div className="mt-1 text-body text-ink-500">
                  Pyth <span className="tnum font-mono">Equity.US.SPY/USD</span> against the SPYx
                  implied share price
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-micro uppercase text-ink-500">Gap</div>
                <div className="tnum font-mono text-value font-medium text-shut-400">
                  {gapLabel} · {gapPctLabel}
                </div>
              </div>
            </div>

            <div className="flex pt-3.5" role="img" aria-label={altText}>
              {/* y axis — bottom margin matches the x-axis strip so the labels
                  land on their own gridlines */}
              <div
                className="relative mb-[46px] w-[50px] shrink-0 sm:w-[62px]"
                aria-hidden="true"
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="tnum absolute right-2 -translate-y-1/2 font-mono text-[10.5px] leading-none whitespace-nowrap text-ink-500"
                    style={{ top: `${py(t)}%` }}
                  >
                    {t.toFixed(2)}
                  </span>
                ))}
              </div>

              <div className="relative h-[clamp(340px,62vw,430px)] min-w-0 flex-auto pr-[14px] lg:h-[clamp(320px,32vw,440px)]">
                <div
                  className="absolute top-0 right-[14px] bottom-[46px] left-0 overflow-hidden"
                  aria-hidden="true"
                >
                  {/* 1 · grid and the shut regions. flat washes of one hue, no gradient. */}
                  <div className="f-rise absolute inset-0">
                    <span
                      className="absolute top-0 bottom-0 bg-ink-100/[0.022]"
                      style={{ left: `${X_OPEN}%`, width: `${X_BELL - X_OPEN}%` }}
                    />
                    <span
                      className="absolute top-0 right-0 bottom-0 bg-shut-400/4"
                      style={{ left: `${X_BELL}%` }}
                    />
                    <span
                      className="absolute top-0 bottom-0 bg-shut-400/4"
                      style={{ left: `${X_NOW}%`, right: `${100 - X_NEXT}%` }}
                    />
                    {ticks.map((t) => (
                      <span
                        key={t}
                        className="absolute right-0 left-0 h-px bg-base-800"
                        style={{ top: `${py(t)}%` }}
                      />
                    ))}
                    <span className="absolute right-0 bottom-0 left-0 h-px bg-base-700" />
                  </div>

                  {/* 2 · the terminus, and the value the feed keeps reporting */}
                  <div className="f-rise absolute inset-0 [animation-delay:60ms] motion-reduce:[animation-delay:0ms]">
                    <span
                      className="absolute top-0 bottom-0 -ml-px w-0.5 bg-shut-400"
                      style={{ left: `${X_BELL}%` }}
                    >
                      <span className="absolute top-0 -left-1 h-[3px] w-2.5 bg-shut-400" />
                      <span className="absolute bottom-0 -left-1 h-[3px] w-2.5 bg-shut-400" />
                    </span>
                    {/* the stale rule — NOT a price path, the one frozen value */}
                    <span
                      className="absolute h-0 border-t border-dashed border-shut-400/55"
                      style={{
                        top: `${Y_EQ}%`,
                        left: `${X_BELL}%`,
                        right: `${100 - X_NEXT}%`,
                      }}
                    />
                    <span
                      className="absolute top-0 bottom-0 w-0 border-l border-dashed border-shut-400/55"
                      style={{ left: `${X_NEXT}%` }}
                    />
                  </div>

                  {/* 3 · the two measured points. nothing joins them. */}
                  <div className="f-rise absolute inset-0 [animation-delay:120ms] motion-reduce:[animation-delay:0ms]">
                    <span
                      className="absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 bg-ink-100 outline-4 outline-base-900"
                      style={{ left: `${X_BELL}%`, top: `${Y_EQ}%` }}
                    />
                    <span
                      className="absolute h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-live-400 bg-base-900 outline-[3px] outline-base-900"
                      style={{ left: `${X_NOW}%`, top: `${Y_DEX}%` }}
                    >
                      <span className="absolute inset-[2px] rounded-full bg-live-400" />
                    </span>
                    {/* the divergence, as a dimension line rather than a line of price */}
                    <span
                      className="absolute -ml-px w-px bg-shut-400/70"
                      style={{
                        left: `${X_NOW}%`,
                        top: `${Y_DEX}%`,
                        height: `${Y_EQ - Y_DEX}%`,
                      }}
                    >
                      <span className="absolute top-0 -left-1 h-px w-[9px] bg-shut-400/70" />
                      <span className="absolute bottom-0 -left-1 h-px w-[9px] bg-shut-400/70" />
                    </span>
                  </div>

                  {/* 4 · annotations live inside the plot. there is no legend. */}
                  <div className="f-rise absolute inset-0 [animation-delay:180ms] motion-reduce:[animation-delay:0ms]">
                    <span
                      className="absolute text-[10px] leading-[1.35] whitespace-nowrap text-ink-300 sm:text-[11px]"
                      style={{ left: `calc(${X_BELL}% + 8px)`, top: "3%" }}
                    >
                      <span className="block font-mono text-[9px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-shut-400 sm:text-[10px]">
                        Feed stops
                        <span className={roomForDetail ? "hidden md:inline" : "hidden"}> · 20:00:00 UTC</span>
                      </span>
                      <span className={roomForDetail ? "hidden md:inline" : "hidden"}>no further publish until the bell</span>
                    </span>

                    <span
                      className="absolute text-[10px] leading-[1.35] whitespace-nowrap text-ink-300 sm:text-[11px]"
                      style={{ left: `calc(${X_BELL}% + 8px)`, top: `calc(${Y_EQ}% + 9px)` }}
                    >
                      <span className="block font-mono text-[9px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-ink-500 sm:text-[10px]">
                        Last print<span className="hidden md:inline">, held</span>
                      </span>
                      <span className="tnum">
                        {usd(equityPrice)}
                        <span className="hidden md:inline"> · publish_time frozen</span>
                      </span>
                    </span>

                    <span
                      className="absolute text-[10px] leading-[1.35] whitespace-nowrap text-ink-300 sm:text-[11px]"
                      style={{ left: `calc(${X_NOW}% + 12px)`, top: `calc(${Y_DEX}% - 30px)` }}
                    >
                      <span className="block font-mono text-[9px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-live-400 sm:text-[10px]">
                        Trading now
                      </span>
                      <span className="tnum">
                        {usd(impliedPrice)}
                        <span className="hidden md:inline"> implied, no NAV anchor</span>
                      </span>
                    </span>

                    {/* the gap label sits left of the dimension line on wide screens,
                        and right of it once there is no room */}
                    <span
                      className="absolute hidden -translate-y-1/2 text-right text-[11px] leading-[1.35] whitespace-nowrap text-ink-300 md:block"
                      style={{ right: `calc(${100 - X_NOW}% + 11px)`, top: "50%" }}
                    >
                      <span className="tnum block font-mono text-[10px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-shut-400">
                        {gapLabel}
                      </span>
                      <span className="tnum">{gapPctLabel}</span>
                    </span>
                    <span
                      className="absolute text-[10px] leading-[1.35] whitespace-nowrap text-ink-300 md:hidden"
                      style={{ left: `calc(${X_NOW}% + 12px)`, top: "58%" }}
                    >
                      <span className="tnum block font-mono text-[9px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-shut-400">
                        {gapLabel}
                      </span>
                      <span className="tnum">{gapPctLabel}</span>
                    </span>

                    <span
                      className="absolute text-right text-[10px] leading-[1.35] whitespace-nowrap text-ink-300 sm:text-[11px]"
                      style={{ right: `calc(${100 - X_NEXT}% + 8px)`, top: "3%" }}
                    >
                      <span className="block font-mono text-[9px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-shut-400/75 sm:text-[10px]">
                        Next print
                        <span className={roomForDetail ? "hidden md:inline" : "hidden"}> · {nextPrint}</span>
                      </span>
                      <span className={roomForDetail ? "hidden md:inline" : "hidden"}>session reopens</span>
                    </span>

                    {/* the largest annotation on the chart says why it is empty */}
                    <p
                      className={`absolute top-[40%] left-[52%] hidden max-w-[38ch] border-t border-shut-400/25 pt-2.5 text-[12px] leading-[1.5] whitespace-normal text-ink-300 ${
                        voidInPlot ? "xl:block" : ""
                      }`}
                    >
                      <strong className="font-semibold text-ink-100">
                        Nothing is drawn here because nothing was measured.
                      </strong>{" "}
                      {anchorOff ? (
                        <>
                          The issuer holds{" "}
                          <code className="font-mono text-[11.5px] text-shut-400">
                            maxOrderFiatValue: 0
                          </code>{" "}
                          while the market is shut &mdash; {anchorSentence}
                        </>
                      ) : (
                        <>The issuer is still creating and redeeming &mdash; {anchorSentence}</>
                      )}
                    </p>
                  </div>

                  {/* 5 · time dimensions, FT style: caps and a knocked-out label */}
                  <div className="f-rise absolute inset-0 [animation-delay:240ms] motion-reduce:[animation-delay:0ms]">
                    <span
                      className="absolute bottom-[3%] h-px bg-base-600"
                      style={{ left: `${X_BELL}%`, width: `${X_NOW - X_BELL}%` }}
                    >
                      <span className="absolute -top-1 left-0 h-[9px] w-px bg-base-600" />
                      <span className="absolute -top-1 right-0 h-[9px] w-px bg-base-600" />
                    </span>
                    <span
                      className="absolute bottom-[3%] h-px bg-shut-400/55"
                      style={{ left: `${X_NOW}%`, width: `${X_NEXT - X_NOW}%` }}
                    >
                      <span className="absolute -top-1 left-0 h-[9px] w-px bg-shut-400/55" />
                      <span className="absolute -top-1 right-0 h-[9px] w-px bg-shut-400/55" />
                    </span>
                    <span
                      className="tnum absolute bottom-[3%] translate-x-[-50%] translate-y-1/2 bg-base-900 px-2 font-mono text-[10px] leading-none font-medium tracking-[0.09em] uppercase whitespace-nowrap text-ink-500"
                      style={{ left: `${(X_BELL + X_NOW) / 2}%` }}
                    >
                      {elapsedLabel} elapsed<span className="hidden md:inline">, unpriced</span>
                    </span>
                    <span
                      className="tnum absolute bottom-[3%] translate-x-[-50%] translate-y-1/2 bg-base-900 px-2 font-mono text-[10px] leading-none font-medium tracking-[0.09em] uppercase whitespace-nowrap text-shut-400"
                      style={{ left: `${(X_NOW + X_NEXT) / 2}%` }}
                    >
                      {aheadLabel} remaining
                    </span>
                  </div>
                </div>

                {/* x axis — not truncated, and it is the finding */}
                <div
                  className="absolute right-[14px] bottom-0 left-0 h-[46px] border-t border-base-700"
                  aria-hidden="true"
                >
                  {[X_OPEN, X_BELL, X_NOW, X_NEXT].map((x, i) => (
                    <span
                      key={i}
                      className="absolute top-0 h-1.5 w-px bg-base-600"
                      style={{ left: `${x}%` }}
                    />
                  ))}
                  <span
                    className="absolute top-[30px] hidden h-[5px] border border-t-0 border-base-600 xl:block"
                    style={{ left: `${X_OPEN}%`, width: `${X_BELL - X_OPEN}%` }}
                  />
                  <span
                    className="tnum absolute top-[11px] hidden font-mono text-[9px] leading-[1.3] font-medium tracking-[0.06em] uppercase whitespace-nowrap text-ink-500 sm:text-[10px] xl:block"
                    style={{ left: `${X_OPEN}%` }}
                  >
                    13:30
                    <b className="block font-medium text-ink-300">open</b>
                  </span>
                  <span
                    className={`tnum absolute top-[11px] -translate-x-1/2 font-mono text-[9px] leading-[1.3] font-medium tracking-[0.06em] uppercase whitespace-nowrap text-ink-500 sm:text-[10px] ${
                      nowClearOfBell ? "" : "hidden"
                    }`}
                    style={{ left: `${X_BELL}%` }}
                  >
                    20:00
                    <b className="block font-medium text-ink-300">bell</b>
                  </span>
                  <span
                    className="tnum absolute top-[11px] -translate-x-1/2 font-mono text-[9px] leading-[1.3] font-medium tracking-[0.06em] uppercase whitespace-nowrap text-ink-500 sm:text-[10px]"
                    style={{ left: `${X_NOW}%` }}
                  >
                    +{elapsedLabel}
                    <b className="block font-medium text-ink-300">now</b>
                  </span>
                  <span
                    className="tnum absolute top-[11px] -translate-x-full text-right font-mono text-[9px] leading-[1.3] font-medium tracking-[0.06em] uppercase whitespace-nowrap text-ink-500 sm:text-[10px]"
                    style={{ left: `${X_NEXT}%` }}
                  >
                    +{windowLabel}
                    <b className="block font-medium text-ink-300">next open</b>
                  </span>
                </div>
              </div>
            </div>

            <figcaption className="grid grid-cols-1 gap-2 border-t border-base-800 px-5 pt-4 pb-4.5">
              {/* Carries the in-plot void annotation at widths where the plot has no
                  room for it. Never rendered alongside it. */}
              <p
                className={`max-w-[96ch] text-[12px] leading-[1.55] text-ink-500 ${
                  voidInPlot ? "xl:hidden" : ""
                }`}
              >
                <strong className="font-semibold text-ink-100">
                  Nothing is drawn between the two points because nothing was measured.
                </strong>{" "}
                {anchorOff ? (
                  <>
                    The issuer holds{" "}
                    <span className="tnum font-mono text-shut-400">maxOrderFiatValue: 0</span>{" "}
                    while the market is shut &mdash; {anchorSentence}
                  </>
                ) : (
                  <>The issuer is still creating and redeeming &mdash; {anchorSentence}</>
                )}
              </p>
              <p className="max-w-[96ch] text-[12px] leading-[1.55] text-ink-500">
                <strong className="font-semibold text-ink-300">How to read this.</strong> Only two
                points on this chart were measured: the Pyth equity print at the bell, and the SPYx
                implied price right now.{" "}
                <strong className="font-semibold text-ink-300">
                  No path is drawn between them
                </strong>{" "}
                &mdash; we hold no tick series for the token, so inventing a line would be a picture
                of nothing. The dashed rule is not a price path either: it is the single frozen
                value the feed keeps reporting, unchanged, with a{" "}
                <span className="tnum font-mono">{elapsedLabel}</span>-old{" "}
                <span className="tnum font-mono">publish_time</span>.
              </p>
              <p className="max-w-[96ch] text-[12px] leading-[1.55] text-ink-500">
                The vertical scale is truncated to a{" "}
                <span className="tnum font-mono">${yRange.toFixed(2)}</span> range so the two prints
                separate; the price gap is{" "}
                <span className="tnum font-mono">{gapLabel}</span>, or{" "}
                <span className="tnum font-mono">{gapPctLabel}</span>. The horizontal scale is not
                truncated, and it is the finding. Through the whole shaded window the issuer holds{" "}
                <span className="tnum font-mono">
                  maxOrderFiatValue: {anchorOff ? "0" : "> 0"}
                </span>{" "}
                &mdash; {anchorSentence}
              </p>
            </figcaption>

            <details className="group border-t border-base-800">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-5 font-mono text-micro font-medium uppercase text-ink-500 transition-colors duration-150 ease-out hover:text-shut-400 [&::-webkit-details-marker]:hidden">
                Read this chart as a table
                <span aria-hidden="true" className="ml-2.5 text-base-600">
                  <span className="group-open:hidden">[ + ]</span>
                  <span className="hidden group-open:inline">[ &minus; ]</span>
                </span>
              </summary>
              <div
                className="overflow-x-auto px-5 pb-5"
                tabIndex={0}
                role="region"
                aria-label="Measured values behind the chart"
              >
                <table className="w-full min-w-[460px] border-collapse">
                  <caption className="pb-2.5 text-left font-mono text-micro uppercase text-ink-500">
                    Measured values behind the chart
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="border-b border-base-700 px-3 py-2.5 text-left font-mono text-[10px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-ink-500"
                      >
                        Series
                      </th>
                      <th
                        scope="col"
                        className="border-b border-base-700 px-3 py-2.5 text-right font-mono text-[10px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-ink-500"
                      >
                        Value
                      </th>
                      <th
                        scope="col"
                        className="border-b border-base-700 px-3 py-2.5 text-left font-mono text-[10px] leading-[1.2] font-medium tracking-[0.12em] uppercase text-ink-500"
                      >
                        Timing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="[&_td]:border-b [&_td]:border-base-800 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-baseline [&_td]:text-body [&_td]:text-ink-300 [&_tr:last-child_td]:border-b-0">
                    <tr>
                      <td>
                        Pyth <span className="tnum font-mono">Equity.US.SPY/USD</span>, last print
                      </td>
                      <td className="tnum text-right! font-mono text-ink-100!">
                        {usd(equityPrice)}
                      </td>
                      <td>
                        20:00:00 UTC · publish_time frozen {elapsedLabel} ago
                      </td>
                    </tr>
                    <tr>
                      <td>SPYx implied share price</td>
                      <td className="tnum text-right! font-mono text-ink-100!">
                        {usd(impliedPrice)}
                      </td>
                      <td>
                        Now · continuous, {anchorOff ? "no create / redeem" : "create / redeem on"}
                      </td>
                    </tr>
                    <tr>
                      <td>Gap between the two prints</td>
                      <td className="tnum text-right! font-mono text-ink-100!">{gapLabel}</td>
                      <td>{gapPctLabel}, derived</td>
                    </tr>
                    <tr>
                      <td>Price path between them</td>
                      <td className="tnum text-right! font-mono text-ink-100!">not measured</td>
                      <td>No tick series held, so none is drawn</td>
                    </tr>
                    <tr>
                      <td>Unpriced window</td>
                      <td className="tnum text-right! font-mono text-ink-100!">{windowLabel}</td>
                      <td>
                        {elapsedLabel} elapsed, {aheadLabel} remaining · next print {nextPrint}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </figure>
        </div>
      </div>
    </section>
  );
}
