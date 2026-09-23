"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/session";

/**
 * What to show while the anchor is still running.
 *
 * The divergence chart argues from a COMPLETED gap: two prints and the dead space between
 * them. While the anchor is on that space is zero, the two markers collapse onto one x
 * position, and the chart's annotations ("feed stops", "unpriced") state things that are
 * not true yet. So the chart is withheld and this panel runs instead.
 *
 * It counts down to the same moment the hero does — the issuer dropping maxOrderFiatValue
 * to zero — rather than to the closing bell. An earlier version counted to the bell and
 * claimed the mechanism switches off when it rings. Both are wrong: the Pyth equity feed
 * keeps publishing through the extended session, and the issuer keeps creating and
 * redeeming through the night at a smaller cap. The thing that actually stops is the
 * weekend.
 */

const hhmmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

export default function PricedNow({
  equityPrice,
  equityAgeSeconds,
  impliedPrice,
  session,
}: {
  equityPrice: number;
  equityAgeSeconds: number;
  impliedPrice: number;
  session: SessionState;
}) {
  const target = new Date(session.nextAnchorOffAt).getTime();

  // Seeded from the server's own figure so the first paint shows a real number rather than
  // a dead placeholder. The clock then diverges by the client/server skew, which is what
  // suppressHydrationWarning is for — this element is a clock, it is SUPPOSED to differ.
  const [left, setLeft] = useState(() => session.hoursUntilAnchorOff * 3_600_000);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  const gap = impliedPrice - equityPrice;
  const gapPct = equityPrice > 0 ? (gap / equityPrice) * 100 : 0;
  const throttled = session.anchorState === "reduced";

  return (
    <section
      className="border-b border-base-800 px-(--gutter) py-14 sm:py-20"
      aria-labelledby="priced-h"
    >
      <p className="mb-4 font-mono text-micro uppercase text-open-400">
        01 / priced now · the anchor is {throttled ? "throttled" : "working"}
      </p>
      <h2 id="priced-h" className="max-w-3xl text-lede font-medium">
        While the issuer still creates and redeems, arbitrage holds the token near its real
        value. That is the part of the week worth measuring against.
      </h2>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-base-700 bg-base-900 p-5">
          <p className="font-mono text-micro uppercase tracking-wider text-ink-500">
            Pyth Equity.US.SPY/USD
          </p>
          <p className="tnum mt-2 font-mono text-[2rem] font-semibold leading-none text-ink-100">
            ${equityPrice.toFixed(2)}
          </p>
          <p className="mt-2 text-body text-open-400">
            published{" "}
            {equityAgeSeconds < 120
              ? "seconds"
              : `${Math.round(equityAgeSeconds / 60)} minutes`}{" "}
            ago
          </p>
        </div>

        <div className="rounded-card border border-base-700 bg-base-900 p-5">
          <p className="font-mono text-micro uppercase tracking-wider text-ink-500">
            SPYx implied share price
          </p>
          <p className="tnum mt-2 font-mono text-[2rem] font-semibold leading-none text-ink-100">
            ${impliedPrice.toFixed(2)}
          </p>
          <p className="tnum mt-2 text-body text-ink-300">
            {gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)} · {gap >= 0 ? "+" : "−"}
            {Math.abs(gapPct).toFixed(3)}% from the equity
          </p>
        </div>

        <div className="rounded-card border border-shut-400/25 bg-shut-900/40 p-5">
          <p className="font-mono text-micro uppercase tracking-wider text-shut-400">
            Create / redeem hits zero in
          </p>
          <p
            className="tnum mt-2 font-mono text-[2rem] font-semibold leading-none text-shut-400"
            suppressHydrationWarning
          >
            {hhmmss(left)}
          </p>
          <p className="tnum mt-2 text-body text-ink-300">
            then ~48 hours with no arbitrage at all
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-body text-ink-300">
        That gap of{" "}
        <span className="tnum font-mono text-ink-100">{Math.abs(gapPct).toFixed(3)}%</span> is
        small because creation and redemption are running
        {throttled ? (
          <>
            {" "}
            — throttled to{" "}
            <span className="tnum font-mono text-ink-100">
              ${((session.maxOrderFiatValue ?? 0) / 1e6).toFixed(0)}M
            </span>{" "}
            overnight, but running
          </>
        ) : null}
        , so anyone can arbitrage the difference away. Every weekend the issuer sets that cap
        to zero and the gap has nothing holding it shut.
      </p>
    </section>
  );
}
