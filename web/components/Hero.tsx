import type { SessionState } from "@/lib/session";

/**
 * The hero, and it renders in EVERY state.
 *
 * Two earlier versions of this file were wrong in ways worth recording.
 *
 * The first put the H1 inside the chart, so when the feed was live and the chart moved
 * below the grid, the page opened on a context-free 168-cell grid with no product
 * statement at all.
 *
 * The second counted down to the closing bell and claimed the issuer "switches creation
 * and redemption off" for every unpriced hour. Both halves were false. The Pyth equity
 * feed keeps publishing through the extended session, so at 21:00 UTC the countdown read
 * "0m" while the feed was seconds fresh. And 5,385 issuer polls over five days show
 * weeknights reporting `overnight` with a live $20M cap, not zero. Only the weekend
 * reports `closed`.
 *
 * So the headline is keyed to the anchor, which the issuer publishes and this page reads,
 * rather than to a bell the feed does not actually observe.
 */

const fmt = (h: number) => {
  if (h >= 24) return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
  if (h >= 1) return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
  return `${Math.round(h * 60)}m`;
};

const usd = (n: number | null) =>
  n === null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toLocaleString()}`;

export default function Hero({ session }: { session: SessionState }) {
  const { anchorState, hoursUntilAnchorOff, maxOrderFiatValue, marketMaxOrderFiatValue } =
    session;
  const off = anchorState === "off";

  return (
    <header className="border-b border-base-800 px-(--gutter) pb-14 pt-14 sm:pb-20 sm:pt-20">
      <p className="mb-4 flex items-center gap-2 font-mono text-micro uppercase text-shut-400">
        <span
          className={`inline-block h-2 w-2 rounded-[2px] ${off ? "bg-shut-400" : "bg-open-400"}`}
          aria-hidden
        />
        Closing Bell · tokenized equity on Solana
      </p>

      <h1 className="max-w-4xl text-display font-bold [font-stretch:88%]">
        {off ? (
          <>
            Nothing is pricing this.
            <br />
            It is still trading.
          </>
        ) : (
          <>
            The anchor switches off in{" "}
            <span className="tnum whitespace-nowrap text-shut-400">
              {fmt(hoursUntilAnchorOff)}
            </span>
            .<br />
            The token keeps trading.
          </>
        )}
      </h1>

      <p className="mt-6 max-w-2xl text-read text-ink-300">
        The US equity market prices these assets{" "}
        <span className="tnum font-mono text-ink-100">32.5</span> hours a week. Solana trades
        them <span className="tnum font-mono text-ink-100">168</span>.{" "}
        {off ? (
          <>
            The issuer is creating and redeeming{" "}
            <span className="tnum font-mono text-shut-400">nothing</span> right now
            (maxOrderFiatValue 0), so no arbitrage pulls the token back to the share price.
          </>
        ) : anchorState === "reduced" ? (
          <>
            The issuer is still creating and redeeming, throttled to{" "}
            <span className="tnum font-mono text-ink-100">{usd(maxOrderFiatValue)}</span>{" "}
            against {usd(marketMaxOrderFiatValue)} in session. It goes to zero for the
            weekend.
          </>
        ) : (
          <>
            Right now arbitrage still works. Every weekend the issuer drops
            maxOrderFiatValue to zero and it stops &mdash; observed continuously for{" "}
            <span className="tnum font-mono text-shut-400">42.1 hours</span>.
          </>
        )}
      </p>

      <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3">
        {[
          ["70.9%", "of volume arrives outside regular session"],
          ["0.689%", "weekend hourly move, against 0.570% in session"],
          ["2,777", "liquidity positions quoting through it"],
        ].map(([v, l]) => (
          <div key={l}>
            <dd className="tnum font-mono text-[1.75rem] font-semibold leading-none text-ink-100">
              {v}
            </dd>
            <dt className="mt-2 text-body text-ink-500">{l}</dt>
          </div>
        ))}
      </dl>
    </header>
  );
}
