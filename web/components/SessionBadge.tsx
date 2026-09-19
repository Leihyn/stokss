"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/session";

function dur(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`
               : `${m}m ${String(sec).padStart(2, "0")}s`;
}

const utc = (iso: string | null) =>
  iso ? new Date(iso).toUTCString().replace(" GMT", " UTC").slice(5) : "—";

export default function SessionBadge({ initial }: { initial: SessionState }) {
  const [s, setS] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      fetch("/api/session").then((r) => r.json()).then(setS).catch(() => {});
    }, 30_000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  const live = s.openNow;
  const anchorOff = !s.createRedeemEnabled;
  const toRegular = new Date(s.nextRegularOpenAt).getTime() - now;
  const toIssuer = s.nextChangeAt ? new Date(s.nextChangeAt).getTime() - now : null;

  return (
    <div
      className={`rounded-card border p-5 ${
        live ? "border-open-400/25 bg-open-900/40" : "border-shut-400/25 bg-shut-900/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                live ? "bg-open-400" : "bg-shut-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                live ? "bg-open-400" : "bg-shut-400"
              }`}
            />
          </span>
          <span className="tnum font-mono text-body font-medium tracking-wide">
            {live ? "US MARKET OPEN" : "US MARKET CLOSED"}
          </span>
          <span className="tnum font-mono text-micro uppercase tracking-wider text-ink-500">
            {s.period ?? "unknown"} · {s.exchange ?? "—"} · via {s.source}
          </span>
        </div>
        {s.isTradingHalted && (
          <span className="rounded bg-danger-900/60 px-2 py-0.5 font-mono text-micro text-danger-400">
            TRADING HALTED
          </span>
        )}
      </div>

      {anchorOff && (
        <div className="mt-4 rounded-control border border-shut-400/25 bg-shut-900/50 px-4 py-3">
          <div className="tnum font-mono text-body font-medium text-shut-400">
            CREATION AND REDEMPTION DISABLED
          </div>
          <p className="mt-1.5 text-body leading-relaxed text-ink-300">
            The issuer caps orders at{" "}
            <span className="tnum font-mono text-ink-100">
              ${s.maxOrderFiatValue?.toLocaleString() ?? "0"}
            </span>{" "}
            during <span className="tnum font-mono">{s.period}</span>. Nothing is arbitraging the
            token back to net asset value, yet it keeps trading on Solana.
          </p>
        </div>
      )}

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="tnum font-mono text-micro uppercase tracking-wider text-ink-500">
            Underlying priced again in
          </dt>
          <dd className="tnum mt-1 font-mono text-2xl font-semibold tabular-nums text-shut-400">
            {dur(toRegular)}
          </dd>
          <dd className="mt-0.5 font-mono text-micro text-ink-500">
            {utc(s.nextRegularOpenAt)} · regular session
          </dd>
        </div>
        <div>
          <dt className="tnum font-mono text-micro uppercase tracking-wider text-ink-500">
            Issuer session changes in
          </dt>
          <dd className="tnum mt-1 font-mono text-2xl font-semibold tabular-nums text-ink-300">
            {toIssuer === null ? "—" : dur(toIssuer)}
          </dd>
          <dd className="mt-0.5 font-mono text-micro text-ink-500">
            {utc(s.nextChangeAt)} · create / redeem
          </dd>
        </div>
      </dl>

      {s.unpricedHoursAhead > 0 && (
        <p className="mt-4 border-t border-base-700 pt-3.5 text-body leading-relaxed text-ink-300">
          <span className="tnum font-mono font-semibold text-shut-400">
            {s.unpricedHoursAhead.toFixed(1)} hours
          </span>{" "}
          of trading ahead before anyone can price this asset again. Liquidity providers quote
          continuously through all of it.
        </p>
      )}
    </div>
  );
}
