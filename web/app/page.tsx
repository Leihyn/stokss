import data from "@/data/measurements.json";
import SessionBadge from "@/components/SessionBadge";
import { fetchSession } from "@/lib/session";

export const revalidate = 30;

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

function Bar({ pct, tone }: { pct: number; tone: "open" | "closed" }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5">
      <div
        className={`h-full rounded-full ${tone === "open" ? "bg-emerald-400/70" : "bg-amber-400/80"}`}
        style={{ width: `${Math.min(pct * 2.4, 100)}%` }}
      />
    </div>
  );
}

export default async function Home() {
  const { sessions, headline, liquidity, issuerControl } = data;
  const session = await fetchSession("SPYx");
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <header className="mb-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-amber-400/80">
          Closing Bell · tokenized equity on Solana
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Most tokenized stock trades when
          <br />
          <span className="text-amber-400">nobody can price it.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">
          The US equity market prices these assets 32.5 hours a week. Solana trades them 168.
          The issuer switches creation and redemption off entirely when the market is closed,
          so the mechanism that anchors the token to its net asset value is not running.
        </p>
      </header>

      <section className="mb-10">
        <SessionBadge initial={session} />
      </section>

      <section className="mb-14 grid gap-3 sm:grid-cols-3">
        {[
          { v: `${headline.volumeOutsideRegularSessionPct}%`, l: "of volume outside regular session" },
          { v: `${headline.volumeFullyClosedPct}%`, l: "while the market is fully closed" },
          { v: `+${headline.weekendExcessPct}%`, l: "more volatile on weekends than in session" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="font-mono text-3xl font-semibold text-amber-400">{s.v}</div>
            <div className="mt-1.5 text-sm leading-snug text-white/50">{s.l}</div>
          </div>
        ))}
      </section>

      <section className="mb-14">
        <h2 className="mb-1 text-lg font-medium">Where the flow actually arrives</h2>
        <p className="mb-5 text-sm text-white/45">
          Hourly OHLCV, 14 days, classified by US equity session.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left font-mono text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3">Share of volume</th>
                <th className="px-4 py-3 text-right">Hourly move</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sessions.map((s) => {
                const open = s.session === "MARKET";
                return (
                  <tr key={s.session} className={open ? "" : "bg-amber-400/[0.03]"}>
                    <td className="px-4 py-3.5">
                      <div className="font-medium">{s.label}</div>
                      <div className="font-mono text-[11px] text-white/35">{s.session}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-white/60">{s.hours}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-white/60">{usd(s.volumeUsd)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Bar pct={s.volumeShare} tone={open ? "open" : "closed"} />
                        <span className="w-12 shrink-0 text-right font-mono text-xs text-white/50">
                          {s.volumeShare}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-mono ${
                        s.session === "WEEKEND" ? "font-semibold text-amber-400" : "text-white/60"
                      }`}
                    >
                      {s.meanAbsHourlyReturnPct.toFixed(3)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-white/45">
          Weekend volatility <span className="text-amber-400">exceeds</span> regular-session
          volatility. Coca-Cola does not move on a Saturday, but KOx moves 1.071% per hour,
          against 0.821% while Coca-Cola is actually trading.
        </p>
      </section>

      <section className="mb-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-medium">
            Where {liquidity.token} liquidity sits · {liquidity.pools} pools
          </h3>
          <div className="space-y-2.5">
            {liquidity.byVenue.map((v) => (
              <div key={v.venue} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate font-mono text-xs text-white/55">{v.venue}</span>
                <Bar pct={v.share} tone={v.venue.startsWith("raydium") ? "open" : "closed"} />
                <span className="w-11 shrink-0 text-right font-mono text-xs text-white/45">{v.share}%</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/40">
            The deepest pool is <span className="text-white/65">STONK / SPYx</span>, a memecoin
            pair holding 51% of all {liquidity.token} liquidity.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-1 text-sm font-medium">What the issuer can do to your position</h3>
          <p className="mb-4 text-xs leading-relaxed text-white/45">
            Both authorities scanned at 100% coverage over their full on-chain history.
            17,688 transactions decoded.
          </p>
          <div className="space-y-3">
            {issuerControl.authorities.map((a) => (
              <div key={a.address} className="rounded-lg border border-white/10 bg-black/20 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-white/80">{a.role}</span>
                  <span className="shrink-0 rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                    USED {a.timesUsedAgainstAHolder} TIMES
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">{a.power}</p>
                <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-white/30">
                  {a.decoded.toLocaleString()} tx decoded · {a.coveragePct}% · {a.historyFrom} to{" "}
                  {a.historyTo}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/40">
            {issuerControl.ondoContrast}
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 pt-6 font-mono text-[11px] leading-relaxed text-white/30">
        Measured {data.measuredAt}. {data.coverage}
      </footer>
    </main>
  );
}
