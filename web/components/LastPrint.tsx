"use client";

import { useEffect, useState } from "react";
import type { PythPrice } from "@/lib/pyth";

const age = (s: number) => {
  const h = Math.floor(s / 3600);
  if (h < 1) return `${Math.floor(s / 60)} minutes`;
  if (h < 48) return `${(s / 3600).toFixed(1)} hours`;
  return `${(s / 86400).toFixed(1)} days`;
};

/**
 * Pyth as evidence, not decoration. An equity feed's publish_time stops at the closing
 * bell, so the age of the last print IS the exposure window.
 */
export default function LastPrint({ symbol = "SPY" }: { symbol?: string }) {
  const [p, setP] = useState<PythPrice | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const go = () =>
      fetch(`/api/pyth?symbol=${symbol}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(setP)
        .catch((e) => setErr(e.message));
    go();
    const t = setInterval(go, 60_000);
    return () => clearInterval(t);
  }, [symbol]);

  const stale = (p?.ageSeconds ?? 0) > 3600;

  return (
    <div className="rounded-card border border-base-700 bg-base-900 p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-body font-medium">Last real price of {symbol}</h3>
        <span className="tnum font-mono text-micro uppercase tracking-wider text-ink-500">
          Pyth · read on-chain
        </span>
      </div>

      {err && <p className="tnum font-mono text-body text-danger-400">feed unavailable ({err})</p>}
      {!p && !err && <p className="tnum font-mono text-body text-ink-500">reading price account…</p>}

      {p && (
        <>
          <div className="flex items-baseline gap-3">
            <span className="tnum font-mono text-3xl font-semibold tabular-nums">
              ${p.price.toFixed(2)}
            </span>
            <span className="tnum font-mono text-body text-ink-500">±{p.confidence.toFixed(2)}</span>
          </div>
          <p
            className={`mt-2 text-body leading-relaxed ${stale ? "text-shut-400" : "text-open-400"}`}
          >
            Published <span className="tnum font-mono font-semibold">{age(p.ageSeconds)}</span> ago
            {stale ? ", and it has not moved since." : "."}
          </p>
          <p className="mt-2 text-body leading-relaxed text-ink-500">
            {stale
              ? "The reference price is frozen. Pyth cannot publish what the market is not quoting, yet the tokenized share keeps trading on Solana every second of it."
              : "The underlying is being priced right now."}
          </p>
          <p className="mt-3 truncate font-mono text-micro text-ink-500">
            {p.account}
          </p>
        </>
      )}
    </div>
  );
}
