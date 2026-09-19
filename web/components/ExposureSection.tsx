"use client";

import exposure from "@/data/exposure.json";

/**
 * Proposal 3's headline, with a visual that survives contact with a browser.
 *
 * The original rendered 2,777 individual marks and collapsed into an illegible grey
 * column. The finding does not need 2,777 marks — it needs the shape of the crowd, so
 * each pool is one proportional bar and the long tail is stated rather than drawn.
 */
const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}K`;

export default function ExposureSection({
  unpricedHoursAhead,
  marketOpen,
}: {
  unpricedHoursAhead: number;
  marketOpen: boolean;
}) {
  const live = exposure.pools.filter((p) => p.positions > 0).sort((a, b) => b.positions - a.positions);
  const shown = live.slice(0, 10);
  const tail = live.slice(10);
  const tailPositions = tail.reduce((n, p) => n + p.positions, 0);
  const max = shown[0]?.positions ?? 1;

  return (
    <section className="border-t border-base-800 px-(--gutter) py-16 sm:py-20" aria-labelledby="exposure-h">
      <p className="mb-4 font-mono text-micro uppercase text-shut-400">
        02 / the crowd · measured on chain
      </p>
      <h2 id="exposure-h" className="max-w-3xl text-display font-semibold">
        <span className="tnum">{exposure.totalPositions.toLocaleString()}</span> positions are
        standing in the dark.
      </h2>
      <p className="mt-5 max-w-2xl text-read text-ink-300">
        Every bar below is a real Raydium CLMM pool holding tokenized equity, sized by how many
        live liquidity positions sit in it. The US market is{" "}
        <span className="text-ink-100">{marketOpen ? "open" : "closed"}</span>
        {!marketOpen && (
          <>
            {" "}
            — for the next{" "}
            <span className="tnum font-mono text-shut-400">
              {unpricedHoursAhead.toFixed(1)} hours
            </span>{" "}
            nobody can price what any of them are holding, and the issuer will not create or
            redeem.
          </>
        )}
        {marketOpen && "."}
      </p>

      <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3">
        {[
          [exposure.totalPositions.toLocaleString(), "liquidity positions"],
          [usd(exposure.totalPoolLiquidityUsd), `across ${exposure.poolsScanned} pools`],
          [String(live.length), "pools actually holding positions"],
        ].map(([v, l]) => (
          <div key={l}>
            <dd className="tnum font-mono text-[2rem] leading-none font-semibold text-ink-100">{v}</dd>
            <dt className="mt-2 text-body text-ink-500">{l}</dt>
          </div>
        ))}
      </dl>

      <ul className="mt-10 space-y-2.5">
        {shown.map((p) => (
          <li key={p.pool} className="flex items-center gap-4">
            <span className="w-36 shrink-0 truncate font-mono text-body text-ink-300 sm:w-44">
              {p.name}
            </span>
            <span className="relative h-5 flex-1 rounded-[3px] bg-base-800">
              <span
                className="absolute inset-y-0 left-0 rounded-[3px] bg-shut-400/55"
                style={{ width: `${Math.max((p.positions / max) * 100, 1.5)}%` }}
              />
            </span>
            <span className="tnum w-12 shrink-0 text-right font-mono text-value text-ink-100">
              {p.positions}
            </span>
            <span className="tnum hidden w-16 shrink-0 text-right font-mono text-micro text-ink-500 sm:block">
              {usd(p.liqUsd)}
            </span>
          </li>
        ))}
      </ul>

      {tail.length > 0 && (
        <p className="mt-4 text-body text-ink-500">
          Plus <span className="tnum text-ink-300">{tailPositions}</span> further positions spread
          across <span className="tnum text-ink-300">{tail.length}</span> smaller pools, not drawn.
        </p>
      )}

      <p className="mt-8 max-w-2xl text-body text-ink-300">
        The deepest SPYx pool is <span className="text-ink-100">STONK / SPYx</span>, a memecoin
        pair. People also provide liquidity to McDonald&apos;s stock against FRIES, Coca-Cola
        against COKE, Apple against TREE. Nobody is holding these as equity exposure.
      </p>

      <p className="mt-6 font-mono text-micro text-ink-500">
        Position counts are a snapshot taken {exposure.measuredAt.slice(0, 10)}, not a live feed.
      </p>
    </section>
  );
}
