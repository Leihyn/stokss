# VERIFY REPORT — MILESTONE MODE

```
=======================================
HACKATHON VERIFY — MILESTONE REPORT
Project: Closing Bell
Mode: milestone
Time to deadline: ~5 days (Fri 25 Sep 2026 20:00 UTC)
Run date: 2026-09-19
Kill-Zone Escalation: NONE (no KZ triggered; 3 early warnings)
=======================================
```

## PREREQUISITE GATE — FAILED, PROCEEDED OUT OF ORDER

`debug` = pending, `wire` = pending, `build` = pending. Milestone requires debug and
wire complete-or-skipped. Proceeded deliberately: the conductor state is a stale artifact
of the abandoned **stokss** pipeline and does not describe the product that was built.

## THE HEADLINE FINDING — SPEC DRIFT IS TOTAL, NOT PARTIAL

Every planning document describes a different product.

| Doc | "Closing Bell" | "stokss" | Raydium / LP / CLMM |
|---|---|---|---|
| PRD.md | 0 | 19 | 1 |
| ARCHITECTURE.md | 0 | 108 | 0 |
| PLAN.md | 0 | 36 | 0 |
| FEATURE-OBSERVABLES.md | 0 | 3 | 0 |

**Closing Bell has no PRD, no architecture doc, no plan and no feature observables.**
The shipped product is undocumented. This is a pivot that was never written down.

## STEP 1 — PHASE OBJECTIVES
Unmeasurable against the documented plan (PLAN.md plans stokss). Against the working
plan actually followed: Saturday, Sunday and Monday objectives complete except the
funded mainnet position.

## STEP 2 — ARCHITECTURAL DRIFT: **MAJOR**
ARCHITECTURE.md components: `stokss-program`, `tick-watcher`, `harvest-executor`,
`settlement-engine`, `market-clock`.
Closing Bell uses `market-clock` only. `harvest-executor` and `settlement-engine` were
never built at all. The Anchor program (20 tests passing, plus gift escrow) is in-repo
and unused by the product.

## STEP 2.5 — PRD FEATURE DELTA
Claims extracted from PRD.md: all describe dividend harvesting. Measuring the built
product against them yields near-total MISSING, which is noise rather than signal.
**Finding: no spec exists for the shipped product.** Threshold (>30% MISSING/PARTIAL)
is met trivially → HOLD.

## STEP 2.6 — ARCHITECTURE COMPONENT CHECK
Planned 5, found 1 in the product path. Two core components (`harvest-executor`,
`settlement-engine`) never built. → HOLD against the documented architecture.

## STEP 2.7 — CONFIRMED URLS
All 10 stokss-era endpoints health-checked OK (RPCs, Jupiter, issuer API, DexScreener,
hackathon page). **No deployment URL exists or is reserved.** → WARN

## STEP 3 — DEMO PATH CHECK (executed, not inspected)
| Step | Status |
|---|---|
| 1. Landing page renders measured evidence | WORKS |
| 2. Live session badge, issuer clock | WORKS |
| 3. Exposure panel, 2,777 positions | WORKS |
| 4. /positions wallet connect + position load | WORKS (read path proven) |
| 5. Withdraw → real signature | **BROKEN — never executed** |

5-run reliability on the executable portion: **5/5 PASS**, zero server errors.
A BROKEN step on the critical demo path is an escalation.

## STEP 4 — KILL-ZONE EARLY WARNINGS
- **KZ-1 Demo reliability — WARNING.** 5/5 on what runs. The money shot has never
  executed once. Needs a ~$50 mainnet CLMM position.
- **KZ-2 Submission — WARNING (highest silent risk).** Submission form never opened,
  no draft saved, **registration status unverified**. Rules are "register, then submit".
- **KZ-3 Contract wrong network — N/A.** Closing Bell deploys no contract.
- **KZ-4 Sponsor integration — CLEAR.** Zero sponsors claimed, so no ghost integrations.
  Also zero bounty exposure; Pyth is unclaimed and nearly free.
- **KZ-5 Eligibility — WARNING.** Commit window 2026-09-12 to 2026-09-19 is inside the
  hackathon. **No LICENSE file.** Repo carries unrelated abandoned code.

## WINNING PATTERN CHECKS (advisory)
- WP-1 Landing Page: **PASS** — real data on first load, no wallet gate.
- WP-2 Test Ratio: **FAIL** — 0 tests across 11 source files in `web/`. Ratio 0.00.
- WP-3 Multi-Track: **WARN** — 0 of 0 tracks claimed.
- WP-4 Submission Dir: SKIPPED (milestone).
- WP-5 README Story: SKIPPED (milestone) — but no README exists at all.

## DECISION

```
MILESTONE CHECK — Closing Bell
Phase Completion: n/a (no plan for this product)
Architectural Drift: MAJOR
Demo Path: AT RISK (1 of 5 steps broken, and it is the money shot)
Kill-Zone Warnings: KZ-1, KZ-2, KZ-5

Decision: HOLD
```

## ACTION ITEMS — RANKED FOR 5 DAYS

1. **Verify hackathon registration, open the submission form, save a draft.** Binary and
   silent. If unregistered, everything else scores zero. ~15 min.
2. **Fund the ~$50 position and execute ONE withdrawal.** Converts the only broken demo
   step. Largest single score mover (demo reliability is the heaviest facet).
3. **Deploy to a public URL.** Submission needs a link resolving through 2 Oct.
4. **Write a README for Closing Bell.** No document describes the shipped product.
   README is judged directly.
5. **Add LICENSE.** 2 minutes, removes a KZ-5 risk.
6. **Integrate Pyth.** The brief asks for exactly the equity-vs-wrapper comparison already
   measured. Only bounty within reach.
7. **Date-stamp or refresh `exposure.json`.** 2,777 is a static snapshot and will go stale.
8. **Add tests to `web/`.** Ratio is 0.00.
9. **Delete or explain the abandoned Anchor program.** A judge browsing the repo finds a
   dividend harvester unrelated to the pitch.

=======================================
RECOMMENDATION: HOLD — fix items 1-3 before any further feature work
=======================================
