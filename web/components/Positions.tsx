"use client";

import { useCallback, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium, CLMM_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";

/** xStocks mints, from the issuer's Solana deployments. */
export const XSTOCKS: Record<string, string> = {
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  QQQx: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  AAPLx: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  KOx: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ",
  STRCx: "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH",
};

export interface XPosition {
  nftMint: string;
  poolId: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
}

const rpcUrl = () =>
  typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`;

/**
 * Loads a wallet's Raydium CLMM positions.
 *
 * Raydium rather than Meteora on measured evidence: across all 20 SPYx pools, 93.2% of
 * liquidity is on raydium-clmm and Meteora holds none of the top twelve.
 */
export async function loadPositions(owner: PublicKey): Promise<XPosition[]> {
  const connection = new Connection(rpcUrl(), "confirmed");
  const raydium = await Raydium.load({ connection, owner, disableLoadToken: true });
  const raw = await raydium.clmm.getOwnerPositionInfo({ programId: CLMM_PROGRAM_ID });
  return raw.map((p) => ({
    nftMint: p.nftMint?.toBase58?.() ?? String(p.nftMint ?? ""),
    poolId: p.poolId?.toBase58?.() ?? String(p.poolId ?? ""),
    liquidity: p.liquidity?.toString?.() ?? "0",
    tickLower: Number(p.tickLower ?? 0),
    tickUpper: Number(p.tickUpper ?? 0),
  }));
}

export default function Positions() {
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<XPosition[]>([]);
  const [busy, setBusy] = useState(false);

  const go = useCallback(async () => {
    setBusy(true); setStatus("loading..."); setRows([]);
    try {
      const owner = new PublicKey(addr.trim());
      const t0 = performance.now();
      const p = await loadPositions(owner);
      setRows(p);
      setStatus(`${p.length} CLMM position(s) in ${Math.round(performance.now() - t0)}ms`);
    } catch (e) {
      setStatus("error: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [addr]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-1 text-sm font-medium">Raydium CLMM positions</h3>
      <p className="mb-4 text-xs text-white/45">
        93.2% of SPYx liquidity sits on raydium-clmm. Paste an owner address to load its
        positions through the server-side RPC proxy.
      </p>
      <div className="flex gap-2">
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="owner public key"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-amber-400/40"
        />
        <button
          onClick={go}
          disabled={busy || !addr.trim()}
          className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 font-mono text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          {busy ? "loading" : "load"}
        </button>
      </div>
      {status && <p className="mt-3 font-mono text-xs text-white/50">{status}</p>}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.nftMint} className="rounded border border-white/10 px-3 py-2 font-mono text-[11px]">
              <div className="truncate text-white/70">pool {r.poolId}</div>
              <div className="text-white/40">
                liquidity {r.liquidity} · ticks {r.tickLower} → {r.tickUpper}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 font-mono text-[11px] text-white/30">
        tracking {Object.keys(XSTOCKS).length} xStocks mints
      </p>
    </div>
  );
}
