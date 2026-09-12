import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { CONFIG } from "./config.js";
import type { TickReason } from "./xstocks-client.js";

/**
 * The crank's queue, as a JSON file.
 *
 * DEVIATION from ARCHITECTURE.md Section 14, which specified better-sqlite3. Its native build
 * is blocked by pnpm's script policy and it has no prebuilt binary for Node 25, which is a
 * deadline risk for no benefit here: the queue holds a handful of rows and the architecture
 * already states it is operational only, never trust-bearing. Wipe this file and every fact
 * in it is re-derived from on-chain state on the next poll.
 *
 * Writes go through a temp file and a rename so an interrupted write cannot leave a
 * half-written queue behind.
 */

export type TickState =
  | "queued"
  | "waiting_for_open"
  | "harvesting"
  | "settling"
  | "done"
  | "skipped"
  | "failed";

export interface TickRow {
  id: number;
  mint: string;
  symbol: string;
  m0: number;
  m1: number;
  activationTs: number;
  reason: TickReason | "Unknown";
  state: TickState;
  detectedAt: number;
  note: string | null;
  /** True when the mint is only being watched, not enrolled. Detection without execution. */
  watchOnly: boolean;
}

export interface SeenMultiplier {
  multiplier: number;
  newMultiplier: number;
  effectiveTs: number;
  firstSeenAt: number;
}

interface StoreShape {
  version: 1;
  nextId: number;
  ticks: TickRow[];
  seen: Record<string, SeenMultiplier>;
}

const EMPTY: StoreShape = { version: 1, nextId: 1, ticks: [], seen: {} };

function load(): StoreShape {
  if (!existsSync(CONFIG.statePath)) return structuredClone(EMPTY);
  try {
    const d = JSON.parse(readFileSync(CONFIG.statePath, "utf8"));
    if (d?.version !== 1) return structuredClone(EMPTY);
    return d as StoreShape;
  } catch {
    // A corrupt queue is not worth stopping for. Everything in it is re-derivable.
    console.warn("[store] state file unreadable, starting fresh");
    return structuredClone(EMPTY);
  }
}

let state: StoreShape = load();

function persist() {
  const tmp = `${CONFIG.statePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, CONFIG.statePath);
}

export function lastSeen(mint: string): SeenMultiplier | undefined {
  return state.seen[mint];
}

export function recordSeen(mint: string, s: Omit<SeenMultiplier, "firstSeenAt">) {
  const prev = state.seen[mint];
  state.seen[mint] = { ...s, firstSeenAt: prev?.firstSeenAt ?? Date.now() };
  persist();
}

/** Returns the new row, or null when this exact tick was already recorded. */
export function enqueueTick(
  row: Omit<TickRow, "id" | "detectedAt" | "note">,
): TickRow | null {
  const dup = state.ticks.find(
    (t) => t.mint === row.mint && t.activationTs === row.activationTs && t.m1 === row.m1,
  );
  if (dup) return null;

  const t: TickRow = { ...row, id: state.nextId++, detectedAt: Date.now(), note: null };
  state.ticks.push(t);
  persist();
  return t;
}

export function ticksInState(s: TickState): TickRow[] {
  return state.ticks
    .filter((t) => t.state === s)
    .sort((a, b) => a.activationTs - b.activationTs);
}

export function setTickState(id: number, s: TickState, note?: string) {
  const t = state.ticks.find((x) => x.id === id);
  if (!t) return;
  t.state = s;
  if (note !== undefined) t.note = note;
  persist();
}

export function allTicks(): TickRow[] {
  return [...state.ticks].sort((a, b) => b.activationTs - a.activationTs);
}

export function summary() {
  const byState: Record<string, number> = {};
  for (const t of state.ticks) byState[t.state] = (byState[t.state] ?? 0) + 1;
  return { mintsTracked: Object.keys(state.seen).length, ticks: state.ticks.length, byState };
}
