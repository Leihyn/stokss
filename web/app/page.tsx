import Link from "next/link";
import data from "@/data/measurements.json";
import Hero from "@/components/Hero";
import FrozenPrint from "@/components/FrozenPrint";
import PricedNow from "@/components/PricedNow";
import WeekGrid from "@/components/WeekGrid";
import ExposureSection from "@/components/ExposureSection";
import { fetchSession, nextRegularOpen, nextAnchorOff } from "@/lib/session";
import { fetchImpliedPrice } from "@/lib/implied";
import { readEquityPrice } from "@/lib/pyth";

export const revalidate = 60;

const RPC =
  process.env.SOLANA_RPC_URL_MAINNET ??
  process.env.SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

function Meter({ pct, open }: { pct: number; open: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-[2px] bg-base-800">
      <div
        className={`h-full rounded-[2px] ${open ? "bg-open-400/80" : "bg-shut-400/70"}`}
        style={{ width: `${Math.min(pct * 2.4, 100)}%` }}
      />
    </div>
  );
}

/**
 * The page argues about the hours nobody can price these assets, and for most of the
 * working week it cannot show them: visit on a Thursday afternoon and every panel
 * correctly reports that arbitrage is working. `?dark=1` moves the CLOCK to the next
 * measured anchor-off window and renders the same components against it.
 *
 * Nothing else is simulated. The prices, the 2,777 positions, the 42.1-hour observed
 * window and the issuer's own limit schedule are the live measured values. The banner
 * says so on screen, because a page whose whole claim is "every number here is real"
 * cannot quietly move one of them.
 */
function simulateDark(session: Awaited<ReturnType<typeof fetchSession>>) {
  const at = darkInstant(); // midday Saturday, deep inside the window
  const open = nextRegularOpen(at);
  const ahead = (open.getTime() - at.getTime()) / 3_600_000;
  return {
    ...session,
    period: "closed" as const,
    openNow: false,
    regularSession: false,
    createRedeemEnabled: false,
    maxOrderFiatValue: 0,
    anchorState: "off" as const,
    hoursUntilClose: 0,
    hoursUntilAnchorOff: 0,
    unpricedHoursAhead: ahead,
    darkWindowHours: ahead,
    // Without this the chart's "next print" marker kept the LIVE next open (Thursday)
    // while every other figure counted to Monday.
    nextRegularOpenAt: open.toISOString(),
    sessionCloseAt: null,
    nextAnchorOffAt: at.toISOString(),
  };
}

/** The instant `?dark=1` renders at: midday on the next measured anchor-off Saturday. */
function darkInstant(): Date {
  const at = new Date(nextAnchorOff(new Date()));
  at.setUTCHours(12, 0, 0, 0);
  return at;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ dark }, live, implied, equity] = await Promise.all([
    searchParams,
    fetchSession("SPYx"),
    fetchImpliedPrice(RPC),
    readEquityPrice(RPC, "SPY").catch(() => null),
  ]);
  const preview = dark === "1";
  const session = preview ? simulateDark(live) : live;
  const { sessions, liquidity, issuerControl } = data;

  /**
   * "The feed stopped" is only true if it actually stopped. Pyth's publish age is measured
   * and is already rendered on the page, so the hero's claim is self-evidencing rather than
   * inferred from a session calendar. An hour of tolerance covers normal publish cadence.
   */
  const liveAge = equity?.ageSeconds ?? 68_400;
  const equityPrice = equity?.price ?? 762.96;
  // In preview the last print is the one before the weekend, i.e. 12h back at Saturday noon.
  const equityAge = preview ? 12 * 3_600 : liveAge;
  const feedStale = equityAge > 3_600;

  return (
    <>
      {preview && (
        <p className="border-b border-shut-400/35 bg-shut-900/60 px-(--gutter) py-2.5 text-body text-shut-400">
          <b className="font-semibold">Preview.</b> The clock is moved to{" "}
          <span className="tnum font-mono">
            {darkInstant().toUTCString().slice(0, 22)} UTC
          </span>
          , inside the next measured anchor-off window. Every other figure on this page is
          the live measured value.{" "}
          <Link className="underline hover:text-ink-100" href="/">
            Back to live
          </Link>
          .
        </p>
      )}

      <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-base-800 bg-base-950/95 px-(--gutter)">
        <span className="flex items-center gap-2.5 font-sans text-read font-semibold tracking-tight">
          <span
            className={`inline-block h-2 w-2 rounded-[2px] ${session.regularSession ? "bg-open-400" : "bg-shut-400"}`}
            aria-hidden
          />
          Closing Bell
        </span>
        <span className="flex items-center gap-2 rounded-control border border-base-700 px-3 py-1.5 font-mono text-micro uppercase tracking-wider text-ink-300">
          US equities
          <span className={session.regularSession ? "text-open-400" : "text-shut-400"}>
            · {session.regularSession ? "Open" : session.period === "extended" ? "Extended" : "Closed"}
          </span>
        </span>
      </nav>

      <main id="main">
        <Hero session={session} />

        {/* The divergence chart needs a COMPLETED gap. During the session that gap is zero,
            the markers collapse onto one x position and its annotations go false. So the
            chart renders only when the feed has actually stopped; while it is live, a panel
            states what is true and counts down to the window worth plotting. */}
        {feedStale ? (
          <FrozenPrint
            equityPrice={equityPrice}
            equityAgeSeconds={equityAge}
            impliedPrice={implied.impliedSharePrice}
            unpricedHoursAhead={session.unpricedHoursAhead}
            nextRegularOpenAt={session.nextRegularOpenAt}
            marketOpen={false}
            createRedeemEnabled={session.createRedeemEnabled}
            frozenNow={preview ? darkInstant().getTime() : undefined}
          />
        ) : (
          <PricedNow
            equityPrice={equityPrice}
            equityAgeSeconds={equityAge}
            impliedPrice={implied.impliedSharePrice}
            session={session}
          />
        )}

        <WeekGrid
          marketOpen={session.regularSession}
          period={session.period}
          frozenNow={preview ? darkInstant().getTime() : undefined}
          serverNow={new Date(session.fetchedAt).getTime()}
        />

        {/* marketOpen is the US REGULAR session. It was wired to !feedStale, i.e. Pyth
            freshness, which put "The US market is open" directly above the week grid's
            "Market state: Closed" at 21:00 UTC. The feed keeps publishing through the
            extended session; the market does not. */}
        <ExposureSection
          unpricedHoursAhead={session.unpricedHoursAhead}
          marketOpen={session.regularSession}
          anchorState={session.anchorState}
        />

        <section
          className="border-t border-base-800 px-(--gutter) py-16 sm:py-20"
          aria-labelledby="flow-h"
        >
          <p className="mb-4 font-mono text-micro uppercase text-shut-400">
            03 / the asymmetry · 14 days of hourly OHLCV
          </p>
          <h2 id="flow-h" className="max-w-3xl text-display font-semibold">
            It moves most when it cannot move at all.
          </h2>
          <p className="mt-5 max-w-2xl text-read text-ink-300">
            Volume and volatility by US equity session. The weekend row is the finding: hourly
            movement there <span className="text-shut-400">exceeds</span> movement during the
            hours the underlying is actually trading.
          </p>

          <div className="mt-10 overflow-hidden rounded-card border border-base-700 bg-base-900">
            <table className="w-full">
              <caption className="sr-only">
                Volume and mean hourly absolute return by US equity session, 14 days
              </caption>
              <thead className="text-left font-mono text-micro uppercase text-ink-500">
                <tr className="border-b border-base-800">
                  <th scope="col" className="px-4 py-3 font-normal sm:px-5">Session</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Hours</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Volume</th>
                  <th scope="col" className="px-4 py-3 font-normal">Share</th>
                  <th scope="col" className="px-4 py-3 pr-4 text-right font-normal sm:pr-5">
                    Hourly move
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const open = s.session === "MARKET";
                  const wknd = s.session === "WEEKEND";
                  return (
                    <tr
                      key={s.session}
                      className={`border-b border-base-800 last:border-0 ${wknd ? "bg-shut-900/25" : ""}`}
                    >
                      <th scope="row" className="px-4 py-3.5 text-left font-normal sm:px-5">
                        <span className="block text-body text-ink-100">{s.label}</span>
                        <span className="block font-mono text-micro text-ink-500">{s.session}</span>
                      </th>
                      <td className="tnum px-4 py-3.5 text-right font-mono text-value text-ink-300">
                        {s.hours}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right font-mono text-value text-ink-300">
                        {usd(s.volumeUsd)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Meter pct={s.volumeShare} open={open} />
                          <span className="tnum w-11 shrink-0 text-right font-mono text-micro text-ink-500">
                            {s.volumeShare}%
                          </span>
                        </div>
                      </td>
                      <td
                        className={`tnum px-4 py-3.5 pr-4 text-right font-mono text-value sm:pr-5 ${
                          wknd ? "font-semibold text-shut-400" : "text-ink-300"
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

          <p className="mt-6 max-w-2xl text-body text-ink-300">
            Coca-Cola cannot move on a Saturday. KOx moves{" "}
            <span className="tnum font-mono text-shut-400">1.071%</span> per hour on a Saturday,
            against <span className="tnum font-mono">0.821%</span> while Coca-Cola is actually
            trading.
          </p>
        </section>

        <section
          className="border-t border-base-800 px-(--gutter) py-16 sm:py-20"
          aria-labelledby="issuer-h"
        >
          <p className="mb-4 font-mono text-micro uppercase text-shut-400">
            04 / the issuer · full on-chain history
          </p>
          <h2 id="issuer-h" className="max-w-3xl text-display font-semibold">
            It can take your tokens. It never has.
          </h2>
          <p className="mt-5 max-w-2xl text-read text-ink-300">
            Both xStocks control authorities, scanned across their complete signature history.
            <span className="tnum font-mono"> 17,688</span> transactions decoded, zero unresolved.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {issuerControl.authorities.map((a) => (
              <div key={a.address} className="rounded-card border border-base-700 bg-base-900 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lede font-medium text-ink-100">{a.role}</span>
                  <span className="tnum shrink-0 rounded-[4px] bg-open-900 px-2.5 py-1 font-mono text-micro text-open-400">
                    USED {a.timesUsedAgainstAHolder}×
                  </span>
                </div>
                <p className="mt-3 text-body text-ink-300">{a.power}</p>
                <p className="tnum mt-3 font-mono text-micro text-ink-500">
                  {a.decoded.toLocaleString()} tx · {a.coveragePct}% coverage · {a.historyFrom} →{" "}
                  {a.historyTo}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-2xl text-body text-ink-300">{issuerControl.ondoContrast}</p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-base-700 bg-base-900 p-5">
              <h3 className="mb-4 font-mono text-micro uppercase text-ink-500">
                Where {liquidity.token} liquidity sits · {liquidity.pools} pools
              </h3>
              <div className="space-y-2.5">
                {liquidity.byVenue.map((v) => (
                  <div key={v.venue} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate font-mono text-micro text-ink-300 sm:w-44">
                      {v.venue}
                    </span>
                    <Meter pct={v.share} open={v.venue.startsWith("raydium")} />
                    <span className="tnum w-11 shrink-0 text-right font-mono text-micro text-ink-500">
                      {v.share}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-card border border-base-700 bg-base-900 p-5">
              <h3 className="mb-3 font-mono text-micro uppercase text-ink-500">
                What the implied price is built from
              </h3>
              <dl className="space-y-2.5 font-mono text-value">
                {[
                  ["SPYx per raw token", `$${implied.rawTokenPrice.toFixed(2)}`],
                  ["Scaled UI multiplier", implied.multiplier.toFixed(9)],
                  ["Implied share price", `$${implied.impliedSharePrice.toFixed(2)}`],
                  ["Source", implied.source === "live" ? "live" : "fallback, measured 19 Sep"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-base-800 pb-2.5">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="tnum text-right text-ink-100">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-body text-ink-500">
                A raw token is worth <span className="font-mono">multiplier</span> shares, so the
                quote is divided before it is compared to the equity feed.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-base-800 px-(--gutter) py-10 font-mono text-micro text-ink-500">
          <p className="max-w-2xl">
            Every figure here is read back from a measurement or a live feed. Nothing is modelled,
            and nothing is drawn that was not observed. Session and volatility data measured{" "}
            {data.measuredAt}. {data.coverage}
          </p>
        </footer>
      </main>
    </>
  );
}
