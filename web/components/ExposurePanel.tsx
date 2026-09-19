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
    <div className="rounded-card border border-base-700 bg-base-900 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-medium">Who is standing in it right now</h2>
        <p className="mt-1 text-body text-ink-300">
          Every Raydium CLMM position in an xStocks pool, counted on chain.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="tnum font-mono text-3xl font-semibold text-white">
            {exposure.totalPositions.toLocaleString()}
          </div>
          <div className="mt-1 text-body text-ink-500">liquidity positions</div>
        </div>
        <div>
          <div className="tnum font-mono text-3xl font-semibold text-white">
            {usd(exposure.totalPoolLiquidityUsd)}
          </div>
          <div className="mt-1 text-body text-ink-500">
            across {exposure.poolsScanned} pools
          </div>
        </div>
        <div>
          <div
            className={`font-mono text-3xl font-semibold ${exposed ? "text-shut-400" : "text-open-400"}`}
          >
            {exposed ? `${s.unpricedHoursAhead.toFixed(1)}h` : "0h"}
          </div>
          <div className="mt-1 text-body text-ink-500">
            {exposed ? "until anyone can price it" : "market is open"}
          </div>
        </div>
      </div>

      {exposed && (
        <p className="mb-5 rounded-control border border-shut-400/25 bg-shut-900/50 px-4 py-3 text-body leading-relaxed text-ink-300">
          All{" "}
          <span className="tnum font-mono font-semibold text-shut-400">
            {exposure.totalPositions.toLocaleString()}
          </span>{" "}
          of these positions are quoting continuously through{" "}
          <span className="tnum font-mono font-semibold text-shut-400">
            {s.unpricedHoursAhead.toFixed(1)} hours
          </span>{" "}
          in which the underlying has no price and the issuer will not create or redeem.
        </p>
      )}

      <div className="overflow-hidden rounded-control border border-base-700">
        <table className="w-full text-body">
          <thead className="bg-base-850 text-left font-mono text-micro uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-2.5">Pool</th>
              <th className="px-4 py-2.5 text-right">Positions</th>
              <th className="px-4 py-2.5 text-right">Liquidity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-800">
            {live.slice(0, 8).map((p) => (
              <tr key={p.pool}>
                <td className="px-4 py-2.5 font-mono text-body text-ink-300">{p.name}</td>
                <td className="px-4 py-2.5 text-right font-mono text-body text-ink-300">
                  {p.positions}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-body text-ink-500">
                  {usd(p.liqUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-body leading-relaxed text-ink-500">
        The deepest pool pairs the S&amp;P 500 against a memecoin, and people are providing
        liquidity to McDonald&apos;s stock paired with FRIES. These are not being held as
        equity exposure.
      </p>
      <p className="mt-2 font-mono text-micro leading-relaxed text-ink-500">
        Position counts are a snapshot taken{" "}
        {new Date(exposure.measuredAt).toISOString().slice(0, 10)}, not a live feed. The
        clock above and the Pyth price update on their own.
      </p>
    </div>
  );
}
