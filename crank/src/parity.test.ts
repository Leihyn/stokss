/**
 * Parity check: the TypeScript parser and delta formula must agree with the Rust ones.
 *
 * Runs against the SAME fixture bytes as programs/stokss/src/scaled_ui.rs, captured from
 * mainnet AAPLx and KOx on 2026-09-12. If the two implementations ever drift, the crank would
 * build transactions the program rejects, or worse, compute a different delta than the one
 * the program enforces.
 *
 *   pnpm tsx src/parity.test.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import {
  computeDeltaRaw,
  effectiveMultiplier,
  parseScaledUi,
  TickRejected,
  MAX_TICK_RATIO,
} from "./scaled-ui.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "programs", "stokss", "tests", "fixtures");

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`);
  }
}

console.log("parity against the Rust implementation, same mainnet fixtures\n");

// Values asserted in programs/stokss/src/scaled_ui.rs.
const AAPL_M0 = 1.0026642075893797;
const AAPL_M1 = 1.0032690125398187;
const KO_M0 = 1.013779482672994;
const KO_M1 = 1.0183317967386898;

check("parses the real AAPLx mint to the same values as Rust", () => {
  const s = parseScaledUi(readFileSync(join(fixtures, "aaplx-mint.bin")));
  assert.ok(s, "parser returned null");
  assert.equal(s!.multiplier, AAPL_M0);
  assert.equal(s!.newMultiplier, AAPL_M1);
  assert.equal(s!.effectiveTs, 1786149000);
});

check("parses the real KOx mint to the same values as Rust", () => {
  const s = parseScaledUi(readFileSync(join(fixtures, "kox-mint.bin")));
  assert.ok(s, "parser returned null");
  assert.equal(s!.multiplier, KO_M0);
  assert.equal(s!.newMultiplier, KO_M1);
  assert.equal(s!.effectiveTs, 1781481300);
});

check("delta on the real 2026-08-08 AAPLx tick equals the Rust value 602834", () => {
  assert.equal(computeDeltaRaw(1_000_000_000n, AAPL_M0, AAPL_M1), 602_834n);
});

check("holder is never left short across all five real AAPLx ticks", () => {
  const ticks: [number, number][] = [
    [1.0, 1.000781855115],
    [1.000781855115, 1.0013934869619912],
    [1.0013934869619912, 1.002018559465695],
    [1.002018559465695, 1.0026642075893797],
    [1.0026642075893797, 1.0032690125398187],
  ];
  const r = 1_000_000_000n;
  for (const [m0, m1] of ticks) {
    const d = computeDeltaRaw(r, m0, m1);
    const before = Number(r) * m0;
    const after = Number(r - d) * m1;
    assert.ok(after >= before, `short on ${m0} -> ${m1}`);
    assert.ok(after - before < m1, `dust over one raw unit on ${m0} -> ${m1}`);
  }
});

check("delta on the real KOx tick preserves exposure", () => {
  const s = parseScaledUi(readFileSync(join(fixtures, "kox-mint.bin")))!;
  const r = 10_000_000_000n;
  const d = computeDeltaRaw(r, s.multiplier, s.newMultiplier);
  assert.ok(d > 0n, "real dividend produced no delta");
  const before = Number(r) * s.multiplier;
  const after = Number(r - d) * s.newMultiplier;
  assert.ok(after >= before);
});

check("no tick means no delta", () => {
  assert.equal(computeDeltaRaw(1_000_000n, AAPL_M1, AAPL_M1), 0n);
});

check("reverse split is rejected, matching Rust", () => {
  assert.throws(() => computeDeltaRaw(1_000_000n, AAPL_M1, AAPL_M0), TickRejected);
});

check("forward split is rejected, matching Rust", () => {
  assert.throws(() => computeDeltaRaw(1_000_000_000n, 1.0, 2.0), TickRejected);
  assert.throws(() => computeDeltaRaw(1_000_000_000n, 1.0, 10.0), TickRejected);
  assert.doesNotThrow(() => computeDeltaRaw(1_000_000_000n, 1.0, 1.029));
  assert.throws(() => computeDeltaRaw(1_000_000_000n, 1.0, 1.031), TickRejected);
});

check("MAX_TICK_RATIO matches the Rust constant", () => {
  const rust = readFileSync(
    join(here, "..", "..", "programs", "stokss", "src", "scaled_ui.rs"), "utf8");
  const m = rust.match(/MAX_TICK_RATIO:\s*f64\s*=\s*([\d.]+)/);
  assert.ok(m, "could not find MAX_TICK_RATIO in the Rust source");
  assert.equal(Number(m![1]), MAX_TICK_RATIO,
    `Rust has ${m![1]}, TypeScript has ${MAX_TICK_RATIO}`);
});

check("effective multiplier switches exactly at the activation timestamp", () => {
  const s = parseScaledUi(readFileSync(join(fixtures, "aaplx-mint.bin")))!;
  assert.equal(effectiveMultiplier(s, s.effectiveTs - 1), AAPL_M0);
  assert.equal(effectiveMultiplier(s, s.effectiveTs), AAPL_M1);
});

console.log(failures === 0 ? "\nparity: all checks passed" : `\nparity: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
