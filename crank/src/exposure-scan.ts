import { Connection, PublicKey } from "@solana/web3.js";
import { writeFileSync } from "node:fs";
import { CONFIG } from "./config.js";

/**
 * How many liquidity providers are exposed right now?
 *
 * Raydium CLMM PersonalPositionState layout, verified empirically against live pools:
 *   0  discriminator (8)
 *   8  bump (1)
 *   9  nft_mint (32)
 *  41  pool_id (32)        <- memcmp filter lands here; offsets 9/40/42 all return zero
 *  73  tick_lower_index (i32)
 *  77  tick_upper_index (i32)
 *  81  liquidity (u128)
 */
const CLMM = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
const POOL_ID_OFFSET = 41;
const SLICE = { offset: 9, length: 88 }; // nft_mint .. liquidity

const XSTOCKS: Record<string, string> = {
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  QQQx: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  AAPLx: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  KOx: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ",
  STRCx: "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH",
  MCDx: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2",
};

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const gt = async (u: string) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
      if (r.ok) return r.json() as Promise<any>;
    } catch {}
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
};

interface PoolRow { symbol: string; pool: string; name: string; liqUsd: number; positions: number }

(async () => {
  const conn = new Connection(CONFIG.rpcUrlMainnet, "confirmed");
  const rows: PoolRow[] = [];
  let totalPositions = 0, totalPoolLiqUsd = 0;

  for (const [symbol, mint] of Object.entries(XSTOCKS)) {
    const d = await gt(`${GT}/tokens/${mint}/pools?page=1`);
    if (!d) { console.log(`${symbol}: pool lookup failed`); continue; }
    const pools = (d.data ?? []).filter((p: any) =>
      (p.relationships?.dex?.data?.id ?? "").startsWith("raydium"));
    for (const p of pools) {
      const a = p.attributes, pool = a.address;
      const liqUsd = Number(a.reserve_in_usd ?? 0);
      if (liqUsd < 1000) continue;
      try {
        const accts = await conn.getProgramAccounts(CLMM, {
          commitment: "confirmed",
          filters: [{ memcmp: { offset: POOL_ID_OFFSET, bytes: pool } }],
          dataSlice: SLICE,
        });
        rows.push({ symbol, pool, name: a.name, liqUsd, positions: accts.length });
        totalPositions += accts.length; totalPoolLiqUsd += liqUsd;
        console.log(`  ${symbol.padEnd(6)} ${a.name.padEnd(22)} $${liqUsd.toLocaleString("en-US",{maximumFractionDigits:0}).padStart(12)}  ${String(accts.length).padStart(5)} positions`);
      } catch (e) {
        console.log(`  ${symbol} ${a.name}: ERR ${(e as Error).message.slice(0, 40)}`);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    await new Promise((r) => setTimeout(r, 900));
  }

  rows.sort((a, b) => b.positions - a.positions);
  const out = {
    measuredAt: new Date().toISOString(),
    method: "Raydium CLMM PersonalPositionState accounts, memcmp on pool_id at offset 41 (verified empirically). Pools discovered via GeckoTerminal, raydium venues only, >=$1k liquidity.",
    totalPositions,
    totalPoolLiquidityUsd: Math.round(totalPoolLiqUsd),
    poolsScanned: rows.length,
    tokens: Object.keys(XSTOCKS).length,
    pools: rows,
  };
  writeFileSync("../web/data/exposure.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`\nTOTAL: ${totalPositions} CLMM positions across ${rows.length} xStocks pools`);
  console.log(`Pool liquidity covered: $${Math.round(totalPoolLiqUsd).toLocaleString()}`);
  console.log("wrote ../web/data/exposure.json");
})().catch((e) => { console.error(e); process.exit(1); });
