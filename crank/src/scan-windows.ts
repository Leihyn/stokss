import { CONFIG } from "./config.js";
import { multiplierHistory, type MultiplierEvent } from "./xstocks-client.js";

/**
 * Answers one operational question: which watchlist assets tick inside a given window?
 *
 * Two sources, in order of trust:
 *  1. SCHEDULED  - the issuer API returns future-dated events. Ground truth, not a guess.
 *  2. PREDICTED  - median interval between past Dividend events, projected forward.
 *
 * Enrollment must happen BEFORE a tick, because enroll snapshots m0 at the current
 * multiplier. A tick that fires first is unharvestable on that plan forever. This is the
 * tool that decides what to buy and enroll.
 */

const DEADLINE = Date.parse("2026-09-25T20:00:00Z");
const NOW = Date.now();
const DAY = 86_400_000;

interface Row {
  symbol: string;
  source: "SCHEDULED" | "PREDICTED" | "UNKNOWN";
  nextAt: number | null;
  intervalDays: number | null;
  samples: number;
  lastAt: number | null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function analyse(symbol: string, events: MultiplierEvent[]): Row {
  const dated = events
    .map((e) => ({ ...e, t: Date.parse(e.activationDateTime) }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

  const future = dated.filter((e) => e.t > NOW);
  if (future.length) {
    return { symbol, source: "SCHEDULED", nextAt: future[0].t, intervalDays: null, samples: dated.length, lastAt: null };
  }

  const divs = dated.filter((e) => e.reason === "Dividend");
  if (divs.length < 2) {
    return { symbol, source: "UNKNOWN", nextAt: null, intervalDays: null, samples: divs.length, lastAt: divs.at(-1)?.t ?? null };
  }

  const gaps: number[] = [];
  for (let i = 1; i < divs.length; i++) gaps.push(divs[i].t - divs[i - 1].t);
  const recent = gaps.slice(-6);
  const iv = median(recent);
  const last = divs.at(-1)!.t;

  return { symbol, source: "PREDICTED", nextAt: last + iv, intervalDays: iv / DAY, samples: divs.length, lastAt: last };
}

const fmt = (t: number | null) => (t === null ? "        —        " : new Date(t).toISOString().replace("T", " ").slice(0, 16));

async function main() {
  const symbols = CONFIG.watchlist;
  console.log(`[scan] ${symbols.length} watchlist symbols | now ${new Date(NOW).toISOString()} | deadline ${new Date(DEADLINE).toISOString()}\n`);

  const rows: Row[] = [];
  for (const s of symbols) {
    try {
      rows.push(analyse(s, await multiplierHistory(s)));
    } catch (e) {
      console.log(`[scan] ${s} FETCH-FAIL ${(e as Error).message}`);
      rows.push({ symbol: s, source: "UNKNOWN", nextAt: null, intervalDays: null, samples: 0, lastAt: null });
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  rows.sort((a, b) => (a.nextAt ?? Infinity) - (b.nextAt ?? Infinity));

  console.log("SYMBOL   SOURCE      NEXT ACTIVATION    IN DAYS  CADENCE  N   IN WINDOW");
  console.log("-".repeat(78));
  for (const r of rows) {
    const inDays = r.nextAt ? ((r.nextAt - NOW) / DAY).toFixed(1).padStart(7) : "      —";
    const cad = r.intervalDays ? `${r.intervalDays.toFixed(0)}d`.padStart(7) : "      —";
    const hit = r.nextAt !== null && r.nextAt > NOW && r.nextAt <= DEADLINE ? "  <== YES" : "";
    console.log(
      `${r.symbol.padEnd(8)} ${r.source.padEnd(11)} ${fmt(r.nextAt)}  ${inDays}  ${cad}  ${String(r.samples).padStart(2)}${hit}`,
    );
  }

  const hits = rows.filter((r) => r.nextAt !== null && r.nextAt > NOW && r.nextAt <= DEADLINE);
  console.log("\n" + "=".repeat(78));
  console.log(`IN-WINDOW (tick before ${new Date(DEADLINE).toISOString()}): ${hits.length}`);
  for (const h of hits) console.log(`  ${h.symbol}  ${fmt(h.nextAt)}  [${h.source}]`);

  const judging = rows.filter((r) => r.nextAt !== null && r.nextAt > DEADLINE && r.nextAt <= Date.parse("2026-10-02T23:59:00Z"));
  console.log(`\nDURING JUDGING (after deadline, before 2 Oct): ${judging.length}`);
  for (const h of judging) console.log(`  ${h.symbol}  ${fmt(h.nextAt)}  [${h.source}]`);
}

main().catch((e) => { console.error(e); process.exit(1); });
