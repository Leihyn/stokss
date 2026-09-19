"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/session";
import exposure from "@/data/exposure.json";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}K`;

/**
 * The whole point of the product, at population scale.
 *
 * The session badge says how long the underlying goes unpriced. This says who is standing
 * in it. Positions are Raydium CLMM PersonalPositionState accounts filtered by pool.
 */
export default function ExposurePanel({ initial }: { initial: SessionState }) {
  const [s, setS] = useState(initial);

  useEffect(() => {
    const t = setInterval(() => {
      fetch("/api/session").then((r) => r.json()).then(setS).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const exposed = s.unpricedHoursAhead > 0;
  const live = exposure.pools.filter((p) => p.positions > 0);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-medium">Who is standing in it right now</h2>
        <p className="mt-1 text-sm text-white/50">
          Every Raydium CLMM position in an xStocks pool, counted on chain.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="font-mono text-3xl font-semibold text-white">
            {exposure.totalPositions.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-white/45">liquidity positions</div>
        </div>
        <div>
          <div className="font-mono text-3xl font-semibold text-white">
            {usd(exposure.totalPoolLiquidityUsd)}
          </div>
          <div className="mt-1 text-sm text-white/45">
            across {exposure.poolsScanned} pools
          </div>
        </div>
        <div>
          <div
            className={`font-mono text-3xl font-semibold ${exposed ? "text-amber-400" : "text-emerald-400"}`}
          >
            {exposed ? `${s.unpricedHoursAhead.toFixed(1)}h` : "0h"}
          </div>
          <div className="mt-1 text-sm text-white/45">
            {exposed ? "until anyone can price it" : "market is open"}
          </div>
        </div>
      </div>

      {exposed && (
        <p className="mb-5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm leading-relaxed text-white/70">
          All{" "}
          <span className="font-mono font-semibold text-amber-300">
            {exposure.totalPositions.toLocaleString()}
          </span>{" "}
          of these positions are quoting continuously through{" "}
          <span className="font-mono font-semibold text-amber-300">
            {s.unpricedHoursAhead.toFixed(1)} hours
          </span>{" "}
          in which the underlying has no price and the issuer will not create or redeem.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left font-mono text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-2.5">Pool</th>
              <th className="px-4 py-2.5 text-right">Positions</th>
              <th className="px-4 py-2.5 text-right">Liquidity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {live.slice(0, 8).map((p) => (
              <tr key={p.pool}>
                <td className="px-4 py-2.5 font-mono text-xs text-white/70">{p.name}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-white/60">
                  {p.positions}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-white/45">
                  {usd(p.liqUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        The deepest pool pairs the S&amp;P 500 against a memecoin, and people are providing
        liquidity to McDonald&apos;s stock paired with FRIES. These are not being held as
        equity exposure.
      </p>
    </div>
  );
}
