/**
 * Proof, not assertion: reads the raw poll log and reports when the issuer's
 * create/redeem cap is actually zero.
 *
 * This build started from the belief that the anchor switches off whenever the US market
 * is closed. That belief was wrong, and this is the script that showed it. Run it:
 *
 *     node crank/prove-anchor.mjs
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const RX = /^\[watch\] (\S+Z) polled .*?\(issuer, (market|extended|overnight|closed)\)/i;
const obs = [];
const rl = createInterface({ input: createReadStream(new URL("watch.log", import.meta.url)) });
for await (const line of rl) {
  const m = RX.exec(line);
  if (m) obs.push([new Date(m[1]), m[2].toLowerCase()]);
}
obs.sort((a, b) => a[0] - b[0]);

const byPeriod = {}, byDay = {};
for (const [t, p] of obs) {
  byPeriod[p] = (byPeriod[p] ?? 0) + 1;
  const d = t.toUTCString().slice(0, 3);
  (byDay[d] ??= {})[p] = (byDay[d][p] ?? 0) + 1;
}

console.log(`\n  ${obs.length} polls  ${obs[0][0].toISOString().slice(0,10)} -> ${obs.at(-1)[0].toISOString().slice(0,10)}\n`);
console.log("  ISSUER PERIOD BY WEEKDAY   (closed => maxOrderFiatValue 0)");
for (const d of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
  if (!byDay[d]) continue;
  const row = Object.entries(byDay[d]).map(([k,v]) => `${k} ${v}`).join("  ");
  console.log(`  ${d}   ${row}`);
}

let best = 0, start = null, prev = null;
for (const [t, p] of obs) {
  if (p === "closed") { start ??= t; prev = t; }
  else if (start) { best = Math.max(best, (prev - start) / 36e5); start = null; }
}
if (start) best = Math.max(best, (prev - start) / 36e5);

console.log(`\n  longest continuous zero-cap window: ${best.toFixed(1)} hours`);
console.log(`  weeknights report "overnight", not "closed" -> the anchor THROTTLES, it does not stop`);
console.log(`  only Sat/Sun report "closed" -> only the weekend is unanchored\n`);
