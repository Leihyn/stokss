/**
 * What to show when the Pyth equity feed itself has stopped updating.
 *
 * The divergence chart measures an unpriced window from the age of Pyth's last print. That only
 * works while the feed is alive: the Equity.US.SPY/USD account on Solana stopped being written on
 * 28 Sep 2026, and charting a September print as "the close" reported a 788-hour unpriced window
 * across four weeks the market traded normally. A healthy feed is never older than a long weekend
 * (Friday close to Tuesday open is about 90 hours), so past that the page says the feed is down
 * instead of drawing a gap it cannot measure.
 */
export const FEED_DOWN_AFTER_SECONDS = 96 * 3600;

export default function FeedDown({
  equityPrice,
  publishTime,
  ageSeconds,
  impliedPrice,
}: {
  equityPrice: number | null;
  publishTime: number | null;
  ageSeconds: number | null;
  impliedPrice: number;
}) {
  const last = publishTime ? new Date(publishTime * 1000) : null;
  const days = ageSeconds != null ? Math.floor(ageSeconds / 86_400) : null;
  return (
    <section className="border-b border-base-800 px-(--gutter) py-14 sm:py-20" aria-labelledby="feed-down-h">
      <p className="mb-4 font-mono text-micro uppercase text-shut-400">01 / reference price · feed not updating</p>
      <h2 id="feed-down-h" className="max-w-3xl text-lede font-medium">
        The Pyth equity feed this page measures against has stopped publishing, so the gap between
        the token and the share cannot be measured right now.
      </h2>
      <p className="mt-5 max-w-2xl text-body text-ink-300">
        {last ? (
          <>
            Its last print on Solana was{" "}
            <span className="tnum font-mono text-ink-100">${equityPrice?.toFixed(2)}</span> at{" "}
            <span className="tnum font-mono text-ink-100">{last.toUTCString().slice(5, 22)} UTC</span>,{" "}
            <span className="tnum font-mono">{days}</span> days ago. A live feed is never older than a
            long weekend, so that print is not the last close and is not charted here.
          </>
        ) : (
          <>The feed account could not be read, so no reference price is shown.</>
        )}{" "}
        The token side is still live: SPYx implies{" "}
        <span className="tnum font-mono text-ink-100">${impliedPrice.toFixed(2)}</span> a share right now.
        The session clock, the issuer limits and the exposure below are unaffected.
      </p>
    </section>
  );
}
