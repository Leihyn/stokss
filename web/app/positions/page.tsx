import Link from "next/link";
import Positions from "@/components/Positions";
import Providers from "@/components/WalletProvider";
import { fetchSession } from "@/lib/session";

export const revalidate = 30;

export default async function PositionsPage() {
  const session = await fetchSession("SPYx");
  const exposed = session.unpricedHoursAhead > 0;

  return (
    <Providers>
      <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-base-800 bg-base-950/95 px-(--gutter)">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-sans text-read font-semibold tracking-tight text-ink-100"
        >
          <span
            className={`inline-block h-2 w-2 rounded-[2px] ${session.openNow ? "bg-open-400" : "bg-shut-400"}`}
            aria-hidden
          />
          Closing Bell
        </Link>
        <span className="flex items-center gap-2 rounded-control border border-base-700 px-3 py-1.5 font-mono text-micro uppercase tracking-wider text-ink-300">
          US equities
          <span className={session.openNow ? "text-open-400" : "text-shut-400"}>
            · {session.openNow ? "Open" : "Closed"}
          </span>
        </span>
      </nav>

      <main id="main" className="mx-auto max-w-4xl px-(--gutter) py-14 sm:py-20">
        <p className="mb-4 font-mono text-micro uppercase text-shut-400">
          your exposure · read from chain
        </p>
        <h1 className="max-w-2xl text-display font-semibold">
          {exposed ? "Your position is about to sit in the dark." : "The underlying is priced right now."}
        </h1>

        <p className="mt-5 max-w-2xl text-read text-ink-300">
          {exposed ? (
            <>
              For the next{" "}
              <span className="tnum font-mono text-shut-400">
                {session.unpricedHoursAhead.toFixed(1)} hours
              </span>{" "}
              nobody can price what you are holding
              {!session.createRedeemEnabled && (
                <>
                  , and the issuer will not create or redeem
                  <span className="font-mono"> (maxOrderFiatValue: 0)</span>
                </>
              )}
              . Load a position below and preview the exit before you sign anything.
            </>
          ) : (
            <>
              The US regular session is open, so arbitrage is anchoring the token to a real
              share price. This is the window in which an exit is cheapest to judge. Load a
              position to see it.
            </>
          )}
        </p>

        <div className="mt-12">
          <Positions />
        </div>

        <section className="mt-14 border-t border-base-800 pt-8" aria-labelledby="how-h">
          <h2 id="how-h" className="text-lede font-medium">
            How the exit works
          </h2>
          <dl className="mt-5 grid gap-6 sm:grid-cols-3">
            {[
              [
                "Read",
                "Your Raydium CLMM positions are read straight off the chain through a server-side RPC proxy, so no provider key reaches your browser.",
              ],
              [
                "Simulate",
                "The real decreaseLiquidity transaction is executed against live mainnet with signature verification off. Nothing is broadcast and no funds move, so you see whether it works before committing.",
              ],
              [
                "Sign",
                "Raydium's decreaseLiquidity returns a transaction rather than executing one. Closing Bell builds it and your wallet signs it. There is no keeper, no delegate, and no program of ours in the path.",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-micro uppercase tracking-wider text-shut-400">{k}</dt>
                <dd className="mt-2 text-body text-ink-300">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-2xl text-body text-ink-500">
            One honest limit: the withdrawal sets <span className="font-mono">amountMin</span> to
            zero, so it accepts any output amount. That is acceptable for a full exit you inspect
            before signing and wrong for anything automated. Preview is how you inspect it.
          </p>
        </section>
      </main>
    </Providers>
  );
}
