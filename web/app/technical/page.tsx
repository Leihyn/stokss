import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Closing Bell — technical",
  description:
    "How the Pyth read, the implied-price derivation, the measured anchor model and the non-custodial exit actually work, with the evidence for each.",
};

const CLAIMS = [
  {
    n: "01",
    code: `const RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
const FEED_ID_OFFSET = 41;

function decode(buf: Buffer) {
  const o = FEED_ID_OFFSET;
  return {
    price:       buf.readBigInt64LE(o + 32),
    expo:        buf.readInt32LE(o + 48),
    publishTime: buf.readBigInt64LE(o + 52),   // <- the mechanism
  };
}

const accts = await conn.getProgramAccounts(RECEIVER, {
  filters: [{ memcmp: { offset: FEED_ID_OFFSET, bytes: key } }],
});`,
    h: "Pyth is read on chain, not fetched from an API",
    file: "web/lib/pyth.ts",
    body: "Hermes returns 401 without a key, so the price is read from the receiver program rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ. getProgramAccounts with a memcmp on the feed id at offset 41, then price at +32, expo at +48 and publish_time at +52 of PriceUpdateV2. publish_time is not incidental — it IS the product's mechanism. When the feed stops, the page says so because the age was measured, not inferred from a calendar.",
    proof: "Offsets verified empirically: 9, 40 and 42 return zero; 41 returns the feed.",
  },
  {
    n: "02",
    code: `// A raw token is worth \`multiplier\` shares. The DEX quotes the RAW token.
return { impliedSharePrice: px / mult, rawTokenPrice: px, multiplier: mult };

// ...read straight off the mint, honouring the scheduled change:
const effTs = Number(sui.state.newMultiplierEffectiveTimestamp ?? 0);
return Number(now >= effTs ? sui.state.newMultiplier : sui.state.multiplier);`,
    h: "The implied share price requires dividing by an on-chain multiplier",
    file: "web/lib/implied.ts",
    body: "An xStock is a Token-2022 mint with the Scaled UI Amount extension: the raw balance is fixed and a mint-level multiplier grows to represent more shares. A DEX quotes the RAW token, so the quote is worth multiplier shares, not one. The implied share price is the DEX raw price divided by the multiplier read from the mint. Skip the division and every comparison against an equity feed is wrong by the multiplier.",
    proof: "TLV type 25, body 56 bytes, multiplier at [32..40] as f64. Parsed from live mints.",
  },
  {
    n: "03",
    code: `export function anchorStateFrom(
  current: number | null, marketCeiling: number | null,
): "full" | "reduced" | "off" {
  if (current === 0) return "off";          // weekend: no arbitrage at all
  if (current === null) return "full";
  if (marketCeiling !== null && current < marketCeiling) return "reduced";
  return "full";                            // weeknights THROTTLE, they do not stop
}`,
    h: "The anchor model is measured, and it corrected our own assumption",
    file: "web/lib/session.ts",
    body: "The build started from the belief that the issuer switches creation and redemption off whenever the market is closed. 5,385 polls between 18 and 23 September say otherwise: the issuer publishes a limit per period — $100M market and extended, $20M overnight, $0 closed. Weeknights throttle. Only the weekend zeroes, observed continuously for 42.1 hours. anchorStateFrom() classifies full / reduced / off from the issuer's own two numbers rather than from a calendar.",
    proof: "7 regression tests pin the limit schedule and the weekend boundary.",
  },
  {
    n: "04",
    code: `// roundUp=false on both legs: rounding a MINIMUM up would set a floor above
// what the pool can pay, and revert an honest exit.
const min = LiquidityMathUtil.getAmountsFromLiquidityWithSlippage(
  sqrtPriceCurrentX64, lower, upper, liquidity,
  false,               // amountMax=false -> the minimum side of the band
  false,
  slippageBps / 10_000,
);`,
    h: "The exit is non-custodial and carries a real slippage floor",
    file: "web/lib/withdraw.ts",
    body: "Raydium's decreaseLiquidity returns a transaction rather than executing one, so the holder signs and there is no keeper, no delegate and no program of ours in the path. The minimums are not zero: withdrawalMinimums() derives them from the position's own tick range via LiquidityMathUtil.getAmountsFromLiquidityWithSlippage with amountMax false, 50bps under the value at the pool's current sqrt price. roundUp is false on both legs, because rounding a minimum UP would set a floor above what the pool can pay and revert an honest exit.",
    proof: "Decoded instruction data on a live position: amount0Min 34749404351, amount1Min 159848267960 — non-zero on the wire. Simulated against mainnet: ok, 65,618 compute units.",
  },
  {
    n: "05",
    code: `$ npm run check
  eslint    clean
  next build  Compiled successfully
  vitest    Test Files  3 passed (3)
            Tests      29 passed (29)`,
    h: "Every headline number is re-runnable",
    file: "crank/",
    body: "70.9% of volume outside regular session, 0.689% weekend hourly movement against 0.570% in session, 2,777 positions across 76 pools holding $16.2M, and the issuer's delegate and pause authorities used zero times across 17,688 transactions at 100% scan coverage. None of these are quoted from a third party. Each comes from a script in this repo that can be run again.",
    proof: "lint clean · build clean · 29 tests passing.",
  },
];

export default function TechnicalPage() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-(--gutter) py-14 sm:py-20">
      <p className="mb-4 font-mono text-micro uppercase text-shut-400">
        technical · how it actually works
      </p>
      <h1 className="max-w-3xl text-display font-semibold">
        Five claims, and the evidence for each.
      </h1>
      <p className="mt-5 max-w-2xl text-read text-ink-300">
        A demo shows that something works. It cannot show whether the integration underneath
        is real. This page is the part a judge cannot see from the interface.{" "}
        <Link className="text-shut-400 underline underline-offset-4" href="/demo">
          The 84-second demo is here.
        </Link>
      </p>

      <ol className="mt-12 space-y-10">
        {CLAIMS.map((c) => (
          <li key={c.n} className="border-t border-base-800 pt-6">
            <p className="font-mono text-micro uppercase text-shut-400">
              {c.n} · <span className="text-ink-500">{c.file}</span>
            </p>
            <h2 className="mt-2 max-w-3xl text-lede font-medium text-ink-100">{c.h}</h2>
            <p className="mt-3 max-w-3xl text-body text-ink-300">{c.body}</p>
            <pre className="mt-4 max-w-3xl overflow-x-auto rounded-card border border-base-700 bg-base-950 p-4 font-mono text-[12px] leading-[1.6] text-ink-300">
              <code>{c.code}</code>
            </pre>
            <p className="mt-3 max-w-3xl border-l-2 border-open-400/40 pl-4 font-mono text-body text-open-400">
              {c.proof}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-base-800 pt-6 text-body">
        <Link className="text-shut-400 underline underline-offset-4" href="/">
          Live app
        </Link>
        <Link className="text-shut-400 underline underline-offset-4" href="/demo">
          Demo video
        </Link>
        <a
          className="text-shut-400 underline underline-offset-4"
          href="https://github.com/Leihyn/stokss"
        >
          Source
        </a>
      </p>
    </main>
  );
}
