/**
 * Detection-only entry point.
 *
 * Watches real mainnet mints for corporate actions and records them. Harvests nothing,
 * signs nothing, needs no SOL and no deployed program. This is the half of the crank that
 * can run today, and it is what puts a real mainnet corporate action in front of a judge
 * even while execution runs on devnet.
 *
 *   pnpm tsx src/watch.ts          continuous
 *   pnpm tsx src/watch.ts --once   single pass
 */
import { Connection } from "@solana/web3.js";

import { CONFIG } from "./config.js";
import { marketState } from "./market-clock.js";
import { pollTicks, resolveWatchlist } from "./tick-watcher.js";
import { allTicks, summary } from "./store.js";

async function pass(conn: Connection) {
  const targets = await resolveWatchlist();
  const market = await marketState();
  const r = await pollTicks(conn, targets);

  const s = summary();
  console.log(
    `[watch] ${new Date().toISOString()} polled ${r.polled}/${targets.length} mints, ` +
      `${r.changed} changed, ${r.firstSight} first sight | ` +
      `market ${market.open ? "OPEN" : "closed"} (${market.source}` +
      `${market.period ? `, ${market.period}` : ""}) | ` +
      `tracked ${s.mintsTracked}, ticks ${s.ticks}`,
  );

  const recent = allTicks().slice(0, 5);
  if (recent.length) {
    console.log("[watch] most recent detected ticks:");
    for (const t of recent) {
      const pct = ((t.m1 / t.m0 - 1) * 100).toFixed(4);
      console.log(
        `          ${t.symbol.padEnd(8)} ${t.reason.padEnd(14)} +${pct}%  ` +
          `${new Date(t.activationTs * 1000).toISOString()}  ${t.state}`,
      );
    }
  }
}

async function main() {
  // Detection reads mainnet. Execution, when it happens, uses the other endpoint.
  const conn = new Connection(CONFIG.rpcUrlMainnet, "confirmed");
  const version = await conn.getVersion();
  console.log(
    `[watch] connected to mainnet, solana-core ${version["solana-core"]}, ` +
      `watching ${CONFIG.watchlist.length} symbols`,
  );

  if (process.argv.includes("--once")) {
    await pass(conn);
    return;
  }
  for (;;) {
    try {
      await pass(conn);
    } catch (e) {
      console.error("[watch] pass failed:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, CONFIG.tickPollIntervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
