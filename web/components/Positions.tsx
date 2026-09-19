"use client";

import { useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildWithdrawal, loadRawPositions, type RawPosition } from "@/lib/withdraw";

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
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setStatus("loading positions…"); setRows([]); setSig(null);
    try {
      const owner = publicKey ?? new PublicKey(addr.trim());
      const t0 = performance.now();
      const p = await loadRawPositions(rpcUrl(), owner);
      setRows(p);
      setStatus(`${p.length} CLMM position(s) · ${Math.round(performance.now() - t0)}ms`);
    } catch (e) {
      setStatus("error: " + (e as Error).message);
    } finally { setBusy(false); }
  }, [addr, publicKey]);

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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-1 text-sm font-medium">Raydium CLMM positions</h3>
      <p className="mb-4 text-xs leading-relaxed text-white/45">
        93.2% of SPYx liquidity sits on raydium-clmm. Closing Bell never takes custody: it
        builds the exit, your wallet signs it.
      </p>

      <div className="mb-3">
        <WalletMultiButton style={{ height: 34, fontSize: 12, lineHeight: "34px", borderRadius: 6 }} />
        {publicKey && (
          <p className="mt-2 font-mono text-[11px] text-emerald-300/80">
            connected {short(publicKey.toBase58())}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={addr} onChange={(e) => setAddr(e.target.value)}
          placeholder={publicKey ? "using connected wallet" : "or paste an owner public key"}
          disabled={!!publicKey} spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-amber-400/40 disabled:opacity-40"
        />
        <button
          onClick={load} disabled={busy || (!addr.trim() && !publicKey)}
          className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 font-mono text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          {busy ? "…" : "load"}
        </button>
      </div>

      {status && <p className="mt-3 font-mono text-xs text-white/50">{status}</p>}
      {sig && (
        <a
          href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer"
          className="mt-2 block truncate font-mono text-[11px] text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400"
        >
          {sig}
        </a>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => {
            const id = r.nftMint.toBase58();
            return (
              <li key={id} className="flex items-center gap-3 rounded border border-white/10 px-3 py-2">
                <div className="min-w-0 flex-1 font-mono text-[11px]">
                  <div className="truncate text-white/70">pool {short(r.poolId.toBase58())}</div>
                  <div className="text-white/40">
                    liquidity {r.liquidity.toString()} · ticks {r.tickLower} → {r.tickUpper}
                  </div>
                </div>
                <button
                  onClick={() => withdraw(r)} disabled={busy || !publicKey}
                  className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] text-amber-300 hover:bg-amber-400/15 disabled:opacity-40"
                >
                  withdraw all
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 font-mono text-[11px] text-white/30">
        tracking {Object.keys(XSTOCKS).length} xStocks mints
      </p>
    </div>
  );
}
