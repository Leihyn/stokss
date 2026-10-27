/**
 * Regenerates data/example-candidates.json: funded wallets holding a live SPYx/USDC position.
 *
 * The "No wallet?" button scans the pool live, but the public RPC rate-limits that scan, so
 * the button falls back to this snapshot and re-checks each entry with cheap calls. Run it
 * with a private RPC whenever the snapshot starts running dry:
 *
 *   SOLANA_RPC_URL_MAINNET=... npx tsx scripts/example-candidates.mts
 */
import { writeFileSync } from "node:fs";
import { liveCandidates, EXAMPLE_POOL } from "../lib/example-owner";

const rpc = process.env.SOLANA_RPC_URL_MAINNET ?? process.env.SOLANA_RPC_URL;
if (!rpc) throw new Error("Set SOLANA_RPC_URL_MAINNET; the public RPC refuses this scan.");

const candidates = await liveCandidates(rpc, 20);
writeFileSync(
  new URL("../data/example-candidates.json", import.meta.url),
  JSON.stringify({ measuredAt: new Date().toISOString(), pool: EXAMPLE_POOL, candidates }, null, 2) + "\n",
);
console.log(`${candidates.length} candidates written`);
