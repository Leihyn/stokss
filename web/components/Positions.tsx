"use client";

import { useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildWithdrawal, loadRawPositions, simulateWithdrawal,
  type RawPosition, type SimulatedWithdrawal } from "@/lib/withdraw";

export const XSTOCKS: Record<string, string> = {
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  QQQx: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  AAPLx: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  KOx: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ",
  STRCx: "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH",
};

const rpcUrl = () =>
  typeof window === "undefined" ? "https://api.mainnet-beta.solana.com" : `${window.location.origin}/api/rpc`;

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

export default function Positions() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<RawPosition[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<PublicKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [sim, setSim] = useState<SimulatedWithdrawal | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setStatus("loading positions…"); setRows([]); setSig(null);
    try {
      const owner = publicKey ?? new PublicKey(addr.trim());
      setLoadedOwner(owner);
      const t0 = performance.now();
      const p = await loadRawPositions(rpcUrl(), owner);
      setRows(p);
      setStatus(`${p.length} CLMM position(s) · ${Math.round(performance.now() - t0)}ms`);
    } catch (e) {
      setStatus("error: " + (e as Error).message);
    } finally { setBusy(false); }
  }, [addr, publicKey]);

  /** Dry run against live mainnet. No signature, no funds, nothing broadcast. */
  const preview = useCallback(async (pos: RawPosition, ownerKey: PublicKey) => {
    setBusy(true); setStatus("simulating against mainnet…"); setSim(null); setSig(null);
    try {
      const r = await simulateWithdrawal(rpcUrl(), ownerKey, pos, 1);
      setSim(r);
      setStatus(r.ok
        ? `exit would succeed · ${r.computeUnits?.toLocaleString()} compute units`
        : `exit would FAIL: ${r.err}`);
    } catch (e) {
      setStatus("error: " + (e as Error).message);
    } finally { setBusy(false); }
  }, []);

  /** Builds the exit, hands it to the wallet. We never hold the position or sign for it. */
  const withdraw = useCallback(async (pos: RawPosition) => {
    if (!publicKey) { setStatus("connect a wallet to sign"); return; }
    setBusy(true); setStatus("building withdrawal…"); setSig(null);
    try {
      const built = await buildWithdrawal(rpcUrl(), publicKey, pos, 1);
      setStatus("awaiting signature…");
      const s = await sendTransaction(built.transaction as never, connection);
      setSig(s);
      setStatus(`withdrawn from ${short(built.poolId)}${built.closesPosition ? " · position closed" : ""}`);
    } catch (e) {
      setStatus("error: " + (e as Error).message);
    } finally { setBusy(false); }
  }, [publicKey, sendTransaction, connection]);

  return (
    <div className="rounded-card border border-base-700 bg-base-900 p-5">
      <h3 className="mb-1 text-body font-medium">Raydium CLMM positions</h3>
      <p className="mb-4 text-body leading-relaxed text-ink-500">
        93.2% of SPYx liquidity sits on raydium-clmm. Closing Bell never takes custody: it
        builds the exit, your wallet signs it.
      </p>

      <div className="mb-3">
        <WalletMultiButton style={{ height: 34, fontSize: 12, lineHeight: "34px", borderRadius: 6 }} />
        {publicKey && (
          <p className="mt-2 font-mono text-micro text-open-400">
            connected {short(publicKey.toBase58())}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={addr} onChange={(e) => setAddr(e.target.value)}
          placeholder={publicKey ? "using connected wallet" : "or paste an owner public key"}
          disabled={!!publicKey} spellCheck={false}
          className="min-w-0 flex-1 rounded-control border border-base-600 bg-base-950 px-3 py-1.5 font-mono text-body text-ink-100 outline-none placeholder:text-ink-500 focus:border-shut-400/40 disabled:opacity-40"
        />
        <button
          onClick={load} disabled={busy || (!addr.trim() && !publicKey)}
          className="shrink-0 rounded-control border border-base-600 h-11 px-3 font-mono text-body text-ink-300 hover:bg-base-800 disabled:opacity-40"
        >
          {busy ? "…" : "load"}
        </button>
      </div>

      {status && <p className="mt-3 font-mono text-body text-ink-300">{status}</p>}
      {sig && (
        <a
          href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer"
          className="mt-2 block truncate font-mono text-micro text-shut-400 underline decoration-shut-400/30 hover:decoration-shut-400"
        >
          {sig}
        </a>
      )}

      {sim && (
        <div className={`mt-3 rounded-control border p-3 ${sim.ok ? "border-open-400/25 bg-open-900/40" : "border-danger-400/25 bg-danger-900/40"}`}>
          <div className={`font-mono text-body font-medium ${sim.ok ? "text-open-400" : "text-danger-400"}`}>
            {sim.ok ? "SIMULATED OK — this exit would execute" : `SIMULATED FAIL — ${sim.err}`}
          </div>
          <p className="tnum mt-1 font-mono text-micro text-ink-500">
            dry run against live mainnet · {sim.computeUnits?.toLocaleString() ?? "?"} CU · nothing signed, nothing broadcast
          </p>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-micro leading-relaxed text-ink-500">
{sim.logs.join("\n")}
          </pre>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => {
            const id = r.nftMint.toBase58();
            return (
              <li key={id} className="flex items-center gap-3 rounded border border-base-700 px-3 py-2">
                <div className="min-w-0 flex-1 font-mono text-micro">
                  <div className="truncate text-ink-300">pool {short(r.poolId.toBase58())}</div>
                  <div className="text-ink-500">
                    liquidity {r.liquidity.toString()} · ticks {r.tickLower} → {r.tickUpper}
                  </div>
                </div>
                <button
                  onClick={() => loadedOwner && preview(r, loadedOwner)} disabled={busy || !loadedOwner}
                  className="shrink-0 rounded-control border border-base-600 px-2.5 py-1 font-mono text-micro text-ink-300 hover:bg-base-800 disabled:opacity-40"
                >
                  preview exit
                </button>
                <button
                  onClick={() => withdraw(r)} disabled={busy || !publicKey}
                  className="shrink-0 rounded-control border border-shut-400/30 bg-shut-900/50 px-2.5 py-1 font-mono text-micro text-shut-400 hover:bg-shut-900/70 disabled:opacity-40"
                >
                  withdraw all
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 font-mono text-micro text-ink-500">
        tracking {Object.keys(XSTOCKS).length} xStocks mints
      </p>
    </div>
  );
}
