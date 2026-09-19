import data from "@/data/measurements.json";
import SessionBadge from "@/components/SessionBadge";
import ExposurePanel from "@/components/ExposurePanel";
import LastPrint from "@/components/LastPrint";
import WeekBar from "@/components/WeekBar";
import { fetchSession } from "@/lib/session";

export const revalidate = 30;

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

function Meter({ pct, open }: { pct: number; open: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-[2px] bg-base-800">
      <div
        className={`h-full rounded-[2px] ${open ? "bg-open-400/80" : "bg-shut-400/80"}`}
        style={{ width: `${Math.min(pct * 2.4, 100)}%` }}
      />
    </div>
  );
}

export default async function Home() {
  const { sessions, headline, liquidity, issuerControl } = data;
  const session = await fetchSession("SPYx");

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="mb-12">
        <p className="mb-4 font-mono text-micro uppercase text-shut-400">
          Closing Bell · tokenized equity on Solana
        </p>
        <h1 className="max-w-3xl text-display font-semibold">
          Most tokenized stock trades when{" "}
          <span className="text-shut-400">nobody can price it.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-read text-ink-300">
          The US equity market prices these assets 32.5 hours a week. Solana trades them
          168. The issuer switches creation and redemption off entirely while the market is
          closed, so the mechanism that anchors the token to its net asset value is not
          running.
        </p>
      </header>

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { v: `${headline.volumeOutsideRegularSessionPct}%`, l: "of volume outside regular session" },
          { v: `${headline.volumeFullyClosedPct}%`, l: "while the market is fully closed" },
          { v: `+${headline.weekendExcessPct}%`, l: "more volatile on weekends than in session" },
        ].map((s) => (
          <div key={s.l} className="rounded-card border border-base-700 bg-base-900 p-4 sm:p-5">
            <div className="tnum font-mono text-[1.75rem] font-semibold leading-none text-shut-400">
              {s.v}
            </div>
            <div className="mt-2.5 text-body text-ink-300">{s.l}</div>
          </div>
        ))}
      </section>

      <section className="mb-4">
        <SessionBadge initial={session} />
      </section>

      <section className="mb-4">
        <WeekBar />
      </section>

      <section className="mb-4 grid gap-4 md:grid-cols-2">
        <LastPrint symbol="SPY" />
        <div className="rounded-card border border-base-700 bg-base-900 p-4 sm:p-5">
          <h3 className="mb-1 text-micro uppercase text-ink-500">
            Where {liquidity.token} liquidity sits
          </h3>
          <p className="mb-4 text-body text-ink-500">{liquidity.pools} pools</p>
          <div className="space-y-2.5">
            {liquidity.byVenue.map((v) => (
              <div key={v.venue} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate font-mono text-micro text-ink-300">
                  {v.venue}
                </span>
                <Meter pct={v.share} open={v.venue.startsWith("raydium")} />
                <span className="tnum w-11 shrink-0 text-right font-mono text-micro text-ink-500">
                  {v.share}%
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-body text-ink-500">
            The deepest pool is <span className="text-ink-300">STONK / SPYx</span>, a
            memecoin pair holding 51% of all {liquidity.token} liquidity.
          </p>
        </div>
      </section>

      <section className="mb-4">
        <ExposurePanel initial={session} />
      </section>

      <section className="mb-4 overflow-hidden rounded-card border border-base-700 bg-base-900">
        <div className="border-b border-base-800 px-4 py-3.5 sm:px-5">
          <h2 className="text-lede font-medium">Where the flow actually arrives</h2>
          <p className="mt-1 text-body text-ink-500">
            Hourly OHLCV, 14 days, classified by US equity session.
          </p>
        </div>
        <table className="w-full">
          <thead className="text-left font-mono text-micro uppercase text-ink-500">
            <tr className="border-b border-base-800">
              <th className="px-4 py-2.5 font-normal sm:px-5">Session</th>
              <th className="px-4 py-2.5 text-right font-normal">Hours</th>
              <th className="px-4 py-2.5 text-right font-normal">Volume</th>
              <th className="px-4 py-2.5 font-normal">Share</th>
              <th className="px-4 py-2.5 pr-4 text-right font-normal sm:pr-5">Hourly move</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const open = s.session === "MARKET";
              return (
                <tr key={s.session} className="border-b border-base-800 last:border-0">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="text-body text-ink-100">{s.label}</div>
                    <div className="font-mono text-micro text-ink-500">{s.session}</div>
                  </td>
                  <td className="tnum px-4 py-3 text-right font-mono text-value text-ink-300">
                    {s.hours}
                  </td>
                  <td className="tnum px-4 py-3 text-right font-mono text-value text-ink-300">
                    {usd(s.volumeUsd)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Meter pct={s.volumeShare} open={open} />
                      <span className="tnum w-11 shrink-0 text-right font-mono text-micro text-ink-500">
                        {s.volumeShare}%
                      </span>
                    </div>
                  </td>
                  <td
                    className={`tnum px-4 py-3 pr-4 text-right font-mono text-value sm:pr-5 ${
                      s.session === "WEEKEND" ? "font-semibold text-shut-400" : "text-ink-300"
                    }`}
                  >
                    {s.meanAbsHourlyReturnPct.toFixed(3)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-base-800 px-4 py-3.5 text-body text-ink-300 sm:px-5">
          Weekend volatility <span className="text-shut-400">exceeds</span> regular-session
          volatility. Coca-Cola does not move on a Saturday, but KOx moves 1.071% per hour,
          against 0.821% while Coca-Cola is actually trading.
        </p>
      </section>

      <section className="mb-10 rounded-card border border-base-700 bg-base-900 p-4 sm:p-5">
        <h3 className="mb-1 text-micro uppercase text-ink-500">
          What the issuer can do to your position
        </h3>
        <p className="mb-4 text-body text-ink-500">
          Both authorities scanned at 100% coverage over their full on-chain history.
          17,688 transactions decoded.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {issuerControl.authorities.map((a) => (
            <div key={a.address} className="rounded-control border border-base-800 bg-base-850 p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-medium text-ink-100">{a.role}</span>
                <span className="shrink-0 rounded-[4px] bg-open-900 px-2 py-0.5 font-mono text-micro text-open-400">
                  USED {a.timesUsedAgainstAHolder}×
                </span>
              </div>
              <p className="mt-2 text-body text-ink-300">{a.power}</p>
              <p className="tnum mt-2 font-mono text-micro text-ink-500">
                {a.decoded.toLocaleString()} tx · {a.coveragePct}% · {a.historyFrom} → {a.historyTo}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-body text-ink-300">{issuerControl.ondoContrast}</p>
      </section>

      <footer className="border-t border-base-800 pt-6 font-mono text-micro text-ink-500">
        Measured {data.measuredAt}. {data.coverage}
      </footer>
    </main>
  );
}
