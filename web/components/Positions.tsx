"use client";

import { useCallback, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import exposure from "@/data/exposure.json";
import {
  buildWithdrawal,
  loadRawPositions,
  simulateWithdrawal,
  type RawPosition,
  type SimulatedWithdrawal,
} from "@/lib/withdraw";

/**
 * A real liquidity provider in the SPYx/USDC pool, resolved on chain via
 * position NFT -> largest token account -> owner. Offered so the page is usable
 * by someone with no wallet and no position, which is every judge.
 */
const EXAMPLE_OWNER = "bygBkeZNTWKxBpkF8CRJYm9DkCMTf6e4xErQnYPqVmQ";

const rpcUrl = () =>
  typeof window === "undefined"
    ? "https://api.mainnet-beta.solana.com"
    : `${window.location.origin}/api/rpc`;

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

export default function Positions() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<RawPosition[] | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<PublicKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [sim, setSim] = useState<{ nft: string; r: SimulatedWithdrawal } | null>(null);
  const [showAll, setShowAll] = useState(false);

  /** poolId -> human name, so a position reads "SPYx / USDC" not "6tru…DDE". */
  const poolNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of exposure.pools) m.set(p.pool, p.name);
    return m;
  }, []);

  /**
   * An owner usually holds positions well outside tokenized equity. Only the equity ones
   * carry the exposure this product is about, so the rest are counted, not listed.
   */
  const { equity, other } = useMemo(() => {
    const eq: RawPosition[] = [];
    const ot: RawPosition[] = [];
    for (const r of rows ?? []) {
      (poolNames.has(r.poolId.toBase58()) ? eq : ot).push(r);
    }
    return { equity: eq, other: ot };
  }, [rows, poolNames]);

  const run = useCallback(
    async (owner: PublicKey) => {
      setBusy(true);
      setStatus("reading Raydium CLMM positions…");
      setRows(null);
      setSig(null);
      setSim(null);
      try {
        setLoadedOwner(owner);
        const t0 = performance.now();
        const p = await loadRawPositions(rpcUrl(), owner);
        setRows(p);
        const n = p.filter((x) => poolNames.has(x.poolId.toBase58())).length;
        setStatus(
          `${p.length} CLMM position${p.length === 1 ? "" : "s"} · ${n} in tokenized-equity pools · ${Math.round(performance.now() - t0)}ms`,
        );
      } catch (e) {
        setStatus("error: " + (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [poolNames],
  );

  const load = useCallback(() => {
    try {
      run(publicKey ?? new PublicKey(addr.trim()));
    } catch {
      setStatus("that is not a valid public key");
    }
  }, [addr, publicKey, run]);

  /** Dry run against live mainnet. No signature, no funds, nothing broadcast. */
  const preview = useCallback(
    async (pos: RawPosition, owner: PublicKey) => {
      setBusy(true);
      setStatus("simulating against live mainnet…");
      setSim(null);
      setSig(null);
      try {
        const r = await simulateWithdrawal(rpcUrl(), owner, pos, 1);
        setSim({ nft: pos.nftMint.toBase58(), r });
        setStatus(
          r.ok
            ? `this exit would execute · ${r.computeUnits?.toLocaleString()} compute units`
            : `this exit would fail · ${r.err}`,
        );
      } catch (e) {
        setStatus("error: " + (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Builds the exit and hands it to the wallet. We never hold the position. */
  const withdraw = useCallback(
    async (pos: RawPosition) => {
      if (!publicKey) {
        setStatus("connect a wallet to sign");
        return;
      }
      setBusy(true);
      setStatus("building the withdrawal…");
      setSig(null);
      try {
        const built = await buildWithdrawal(rpcUrl(), publicKey, pos, 1);
        setStatus("awaiting your signature…");
        const s = await sendTransaction(built.transaction as never, connection);
        setSig(s);
        setStatus(`withdrawn${built.closesPosition ? " · position closed" : ""}`);
      } catch (e) {
        setStatus("error: " + (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [publicKey, sendTransaction, connection],
  );

  const usingWallet = !!publicKey;

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-base-700 bg-base-900 p-5">
        <h2 className="text-lede font-medium">Find a position</h2>
        <p className="mt-1.5 max-w-xl text-body text-ink-300">
          Closing Bell never takes custody. It reads your positions, builds the exit, and your
          wallet signs it. Nothing here can move your funds.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <WalletMultiButton />
          {usingWallet && (
            <span className="tnum font-mono text-micro text-open-400">
              connected {short(publicKey.toBase58())}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="owner" className="sr-only">
            Owner public key
          </label>
          <input
            id="owner"
            value={usingWallet ? "" : addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder={usingWallet ? "using your connected wallet" : "paste any owner public key"}
            disabled={usingWallet}
            spellCheck={false}
            className="tnum h-11 min-w-0 flex-1 rounded-control border border-base-600 bg-base-950 px-3 font-mono text-base text-ink-100 outline-none transition-colors duration-150 ease-out placeholder:text-ink-500 hover:border-base-600 disabled:opacity-40"
          />
          <button
            onClick={load}
            disabled={busy || (!addr.trim() && !usingWallet)}
            className="h-11 shrink-0 rounded-control border border-base-600 bg-base-800 px-4 text-read font-medium text-ink-100 transition-colors duration-150 ease-out hover:bg-base-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : "Load positions"}
          </button>
        </div>

        {!usingWallet && (
          <button
            onClick={() => {
              setAddr(EXAMPLE_OWNER);
              run(new PublicKey(EXAMPLE_OWNER));
            }}
            disabled={busy}
            className="mt-3 text-body text-shut-400 underline decoration-shut-400/30 underline-offset-4 transition-colors duration-150 ease-out hover:decoration-shut-400 disabled:opacity-40"
          >
            No wallet? Load a real liquidity provider from the SPYx/USDC pool.
          </button>
        )}

        {status && (
          <p className="mt-4 border-t border-base-800 pt-3.5 font-mono text-body text-ink-300">
            {status}
          </p>
        )}
      </div>

      {rows !== null && rows.length > 0 && equity.length === 0 && !showAll && (
        <div className="rounded-card border border-base-700 bg-base-900 p-5">
          <p className="text-body text-ink-300">
            This address holds{" "}
            <span className="tnum font-mono text-ink-100">{rows.length}</span> CLMM position
            {rows.length === 1 ? "" : "s"}, but none in a tokenized-equity pool, so none carries
            the exposure Closing Bell is about.
          </p>
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 text-body text-shut-400 underline decoration-shut-400/30 underline-offset-4 hover:decoration-shut-400"
          >
            Show them anyway
          </button>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="rounded-card border border-base-700 bg-base-900 p-5">
          <p className="text-body text-ink-300">
            No Raydium CLMM positions on this address. Closing Bell reads concentrated-liquidity
            positions only, so liquidity in a Raydium AMM v4 pool does not create the
            <span className="font-mono"> PersonalPositionState </span> account this looks for.
          </p>
        </div>
      )}

      {rows !== null && (showAll ? rows : equity).length > 0 && (
        <ul className="space-y-3">
          {(showAll ? rows : equity).map((r) => {
            const nft = r.nftMint.toBase58();
            const pool = r.poolId.toBase58();
            const name = poolNames.get(pool);
            const s = sim?.nft === nft ? sim.r : null;
            return (
              <li key={nft} className="rounded-card border border-base-700 bg-base-900 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lede font-medium text-ink-100">
                      {name ?? `Pool ${short(pool)}`}
                    </p>
                    <p className="tnum mt-1 font-mono text-micro text-ink-500">
                      liquidity {r.liquidity.toString()} · ticks {r.tickLower} → {r.tickUpper}
                    </p>
                    <p className="tnum mt-0.5 truncate font-mono text-micro text-ink-500">{pool}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => loadedOwner && preview(r, loadedOwner)}
                      disabled={busy || !loadedOwner}
                      className="h-11 rounded-control border border-base-600 bg-base-800 px-4 text-read font-medium text-ink-100 transition-colors duration-150 ease-out hover:bg-base-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Preview exit
                    </button>
                    <button
                      onClick={() => withdraw(r)}
                      disabled={busy || !usingWallet}
                      title={usingWallet ? undefined : "Connect a wallet to sign"}
                      className="h-11 rounded-control border border-shut-400/40 bg-shut-900/60 px-4 text-read font-medium text-shut-400 transition-colors duration-150 ease-out hover:bg-shut-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Withdraw all
                    </button>
                  </div>
                </div>

                {s && (
                  <div
                    className={`f-rise mt-4 rounded-control border p-4 ${
                      s.ok
                        ? "border-open-400/25 bg-open-900/40"
                        : "border-danger-400/25 bg-danger-900/40"
                    }`}
                  >
                    <p
                      className={`flex items-center gap-2 text-read font-medium ${
                        s.ok ? "text-open-400" : "text-danger-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-[2px] ${s.ok ? "bg-open-400" : "bg-danger-400"}`}
                        aria-hidden
                      />
                      {s.ok ? "This exit would execute" : `This exit would fail — ${s.err}`}
                    </p>
                    <p className="tnum mt-1.5 font-mono text-micro text-ink-500">
                      simulated against live mainnet · {s.computeUnits?.toLocaleString() ?? "?"}{" "}
                      compute units · nothing signed, nothing broadcast
                    </p>
                    <details className="group mt-3">
                      <summary className="flex h-11 cursor-pointer items-center font-mono text-micro uppercase tracking-wider text-ink-500">
                        Program logs
                        <span className="ml-2 group-open:hidden">[ + ]</span>
                        <span className="ml-2 hidden group-open:inline">[ − ]</span>
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-micro leading-relaxed text-ink-500">
{s.logs.join("\n")}
                      </pre>
                    </details>
                  </div>
                )}

                {sig && (
                  <a
                    href={`https://solscan.io/tx/${sig}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tnum mt-4 block truncate font-mono text-micro text-shut-400 underline decoration-shut-400/30 underline-offset-4 hover:decoration-shut-400"
                  >
                    {sig}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!showAll && equity.length > 0 && other.length > 0 && (
        <p className="text-body text-ink-500">
          Plus <span className="tnum font-mono text-ink-300">{other.length}</span> further
          position{other.length === 1 ? "" : "s"} in non-equity pools, not shown.{" "}
          <button
            onClick={() => setShowAll(true)}
            className="text-shut-400 underline decoration-shut-400/30 underline-offset-4 hover:decoration-shut-400"
          >
            Show all
          </button>
        </p>
      )}
    </div>
  );
}
