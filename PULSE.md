# PULSE: Pipeline Rolling Context

## Active Facts
| Fact | Source | Phase |
|------|--------|-------|
| xStocks dividends are reinvestment-only; NO cash, NO USDC. Confirmed by xStocks docs + Kraken FAQ + all 583 API events. Third-party "USDC airdrop" claims are circular reporting from one support article. DO NOT RE-LITIGATE. | intel contradiction log | intel |
| DexScreener and Jupiter quote price per RAW token = share price x multiplier. Valuation code must use raw x price-per-raw. Verified on 4 mints. | intel phase 1 | intel |
| 98.3% of all 583 multiplier ticks activate while the US market is closed, clustered 23:00 and 00:00 UTC. This is why the harvest queues until the open. | ideate, re-checked | intel |
| Only 29 of 338 dividend-paying xStocks have >$1k DEX liquidity. 6 have >$250k. The tradeable universe is small. | ideate measurement | intel |
| Do NOT headline a total-market dollar figure. Our $891M measurement conflicts with a $684M third-party tracker figure; different universes, unresolved. Headline event counts and per-name yields instead. | intel contradiction log | intel |
| The event has ZERO public footprint: no press, no X chatter, no Discord, no judges named, showcase empty. Field saturation is UNPRICED. | intel phase 3 | intel |
| xChange RFQ (primary issuance/redemption) needs an onboarded Backed account. Unobtainable this week. Not on the critical path. | ideate | intel |
| Pyth Hermes REST returns 401 without a key as of 2026-09-12. Not on the critical path. | ideate | intel |
| Mints carry issuer-held permanentDelegate and pausableConfig. Issuer can seize and pause. Disclose in submission. | intel on-chain read | intel |
| ScaledUiAmount is TLV type 25, body 56 bytes: authority[0..32], multiplier f64[32..40], effective_ts i64[40..48], new_multiplier f64[48..56]. TLV list starts at offset 166, account_type byte at 165. Parsed from live AAPLx and KOx, cross-checked against the issuer API on both values and both timestamps. | forge phase_0b | forge |
| Transfer and approve/delegate amounts on a scaled-UI mint are RAW, never scaled. Round DOWN and leave dust with the holder. Source: Solana Scaled UI Amount integration guide. | forge phase_0b | forge |
| Jupiter has NO technical minimum swap size: quotes succeed down to 10 raw units of AAPLx (about $0.00003). The floor is economic. Price impact 0.098% at 10 raw, and tx cost dominates below roughly $0.20. Payout floor set to $1.00, min swap $0.50. | forge phase_0b | forge |
| Do NOT depend on spl-token-2022's typed scaled_ui_amount module. anchor-spl 0.30.1 may pin a version without it. The manual TLV parser in ARCHITECTURE.md Section 6 has no crate-version dependency. This was the single biggest compile risk. | forge phase_2 | forge |
| Forge documents live at the working_dir ROOT, not in a {project-name}/ subdirectory, because the conductor dispatch gate checks $wd/PRD.md, $wd/ARCHITECTURE.md and $wd/PLAN.md. | forge phase_4 | forge |

## Decisions Log
| Decision | Rationale | Phase |
|----------|-----------|-------|

## Downstream Items
<!-- Owner-routed, non-blocking deferred work. Every skill reads on entry, actions rows it owns. See PULSE-PROTOCOL § Downstream Items. -->
| ID | Raised by | Owner phase | Pri | Item | Acceptance | Status |
|----|-----------|-------------|:---:|------|-----------|:------:|
| D-1 | intel | forge | P0 | PRD phase 1 must be the mainnet harvest path. Binding gate: live by **Mon 14 Sep 22:00 UTC**, ahead of the expected STRCx activation ~23:00 UTC that same day. <!-- [CRITIQUE C-9] read "end of Mon 15 Sep". The E-2 fix corrected that date in PRD.md, PLAN.md, WINNER-BRIEF.md and concerns.md but not here, and PULSE is the one file every later skill reads on entry, so the stale date would have outlived the documents that were fixed. --> | PRD implementation plan phase 1 = detect tick + harvest + settle on mainnet | done |
| D-2 | intel | forge | P0 | Design the payout floor and accrual on day one. A 0.06% tick on a $200 position is $0.12, below sane swap size. | ARCHITECTURE.md specifies the threshold and the batching rule | done |
| D-3 | intel | forge | P1 | Do NOT design a Jupiter CPI. Use a keeper-signed swap with the program capping the movable amount to the increment. | ARCHITECTURE.md shows keeper-signed swap, no CPI into Jupiter | done |
| D-4 | intel | build | P0 | Open the Submit Project form early in the week and record its actual fields. Not scrapeable pre-submission. | SUBMISSION-CHECKLIST.md updated with real field names | open |
| D-5 | intel | deploy | P0 | Deployment must survive to 2026-10-02. No sleeping free tier. | Host chosen with no cold-sleep, verified after deploy | open |
| D-6 | intel | demo | P1 | Lead the pitch with the tax liability, not with income preference. Nobody is publicly complaining they want cash dividends; they are taxed on distributions they never receive. | Demo script opens on the tax framing | open |
| D-7 | intel | package | P1 | Disclose SolanaRWA as the adjacent product, and disclose issuer permanentDelegate/pausable control. | Both appear in the submission text | open |
| D-8 | forge | build | P0 | Revert the devnet rehearsal hack that treats reason `Unknown` as `Dividend` in tick-watcher.ts before deploying to mainnet. | git diff shows no Unknown->Dividend mapping at Phase 4 gate | open |
| D-9 | forge | build | P1 | Verify the US market holiday list in crank/src/market-clock.ts. It is tagged ASSUMED and only used when the issuer API is unreachable. | holiday dates checked against an authoritative exchange calendar | open |
| D-10 | forge | stress_test | P1 | The keeper holds the increment between harvest and settle. Bound the exposure in testing: confirm the delegate cap and the computed delta together make a larger take impossible. | a test attempts an over-harvest and fails at the program or the token program | open |
| D-11 | forge | verify_preflight | P2 | The peer AMPLIFIER (crossmodel-amplify.sh) is not provisioned, so its taste/logic pass did not run. The THESIS-2 blind re-derivation DID run via crossmodel-lead.sh and returned AGREE. | state which of the two ran | done |
| D-12 | forge cross-review | build | P2 | The EnrollPanel snippet shows only the approve instruction inline; the enroll instruction is described in prose as appended by the Anchor client. Make it explicit in code so the holder really does sign once. | one transaction containing both approve_checked and enroll | open |
| D-13 | forge cross-review | build | P2 | The payout-mode picker from the demo path is carried by the program's PayoutMode argument but is not shown in the panel UI. | destination choice visible in EnrollPanel before signing | open |
| D-14 | critique | build | P2 | `Config.fee_bps` is declared (PRD 4.1) and never read by `settle`. Either wire it before the transfer or delete the field. A dead revenue field reads as unfinished to a judge, and it is also the only place the business model would live, which interacts with DT-9. | `grep fee_bps` returns either a use in settle.rs or no hits at all | open |
| D-15 | critique | stress_test | P2 | No branch anywhere for the issuer pausing the mint or using its permanent delegate. ARCHITECTURE Section 3 confirms Pausable (26) and PermanentDelegate (12) on the real AAPLx and KOx mints, and Phase 10 already requires disclosing both, but `harvest` has no handling and there is no risk row or decision tree. Low likelihood inside six days; a judge probing custody will still ask "what stops the issuer". | a stated answer for a paused mint mid-window, and a `transfer_checked` failure path that does not wedge the crank | open |
| D-16 | critique | build | P1 | The Token-2022 `transfer_checked` CPI with a **PDA delegate** is tagged [UNVERIFIED] in ARCHITECTURE Section 10 and is the riskiest single item on the path to the Monday gate. DT-15 does not cover it: DT-15 covers `token_interface` import failure and the `scaled_ui_amount` module only. Exercise this shape first on devnet, ahead of everything else in Phase 4. | a devnet `harvest` moves a non-zero delta under a PDA delegate and confirms | open |

## Skill Sections

### intel: 2026-09-12T08:28:29Z

#### Done
- Read the active brief and the pre-supplied WINNER-BRIEF. Wrote config.json, research/research-brief.md, intel-state.json.
- Spent depth on the four gaps ideate could not cover, not on repeating verified dependency or collision work.

#### Additions (not in PRD/Architecture)
- Contradiction log in the research brief, with two resolved conflicts.

#### Deviations
- Wave 3 (Copilot/Grid) skipped: no PAT, grid helper failed to load. Substituted direct on-chain saturation measurement, which is stronger for this domain.
- Phase 2 social review skipped: autonomous mode, and the event publishes no Discord or Telegram at all.

#### Verified Facts
- See Active Facts above. All nine rows are new or re-confirmed this session.

#### Assumptions
- Demo video cap 300s ASSUMED; no requirement published. Not load-bearing since we ship three link types.
- Submission form fields inferred from the rules text, not observed. See D-4.

#### Blockers for Downstream
- None blocking forge.

#### Key Decisions
- Wedge: "credit and yield: dividends" plus "infrastructure: corporate actions", both named in the organizers' own words and both empty on the evidence.
- Do not headline a total-market dollar figure (contradiction unresolved).

#### For Next Skill
forge: the four judging criteria are equally weighted and unpublished, so answer the published sentence literally, clause by clause, in the PRD's positioning section. Competitor depth is 2/5 and irreducible, so do not build a differentiation argument that depends on knowing the field. Action D-1, D-2 and D-3, which are yours.

### forge: 2026-09-12T08:58:54Z

#### Done
- PRD.md (584 lines), ARCHITECTURE.md (3043 lines, 38 complete files), PLAN.md (902 lines, 11 phases, 37 tasks, 9 decision trees).
- Technical spike resolved both assigned unknowns to VERIFIED against live sources.
- FEATURE-OBSERVABLES.md (8 observables), credentials manifest, concerns.md, forge state.

#### Additions (not in PRD/Architecture)
- [NEW] Manual TLV parser for the ScaledUiAmount extension, in both Rust and TypeScript. Not in the original idea; added because it removes the biggest compile risk in the build.
- [NEW] Six-field Thesis block appended to WINNER-BRIEF.md, marked PROVISIONAL, because the ideate handoff predates that format.

#### Deviations
- [SKILL] Documents written to the working_dir root rather than {project-name}/, because the conductor gate checks the root. Recorded in forge state corrections.
- [SKILL] Peer amplifier (Phase 3.5 stage 1) skipped: crossmodel-amplify.sh is not provisioned. Non-blocking per the skill, recorded as a degradation rather than a pass.
- [SKILL] PRD build-day count corrected from five to six during the cross-doc audit.

#### Verified Facts
See the five new Active Facts rows above. All five came from live sources this session, not from documentation alone.

#### Assumptions
- US market holiday list in market-clock.ts is ASSUMED. See D-9.
- anchor-spl token_interface CPI shape is UNVERIFIED (not compiled here). DT-15 in PLAN.md covers the failure.

#### Blockers for Downstream
None blocking build. Two operational prerequisites are not yet satisfied and are Phase 0 tasks: a paid RPC, and a funded keeper.

#### Key Decisions
- Keeper-held collection account instead of a PDA, to avoid a Jupiter CPI on the critical path. Trust bounded by the delegate cap and the program-computed delta, and disclosed in the submission.
- One swap per mint per tick rather than per user. This is what makes a twelve-cent dividend economical.
- Splits and reverse splits are never harvested. They are value-neutral in raw terms.
- Build order is harvest-path first. The web app is required for the demo but not for the mechanic.

#### For Next Skill
critique: the highest-value attack surfaces are (1) the delta formula and its rounding direction, (2) whether the keeper trust model survives a hostile reading, (3) whether the Monday mainnet gate is actually reachable given Phase 0 prerequisites are unmet. Do not re-litigate the dividend premise; it is confirmed by three independent sources and is in Active Facts. D-8 through D-11 are open and owned by later phases.

## Cross-Review

```json
{"reviewer":"claude","phase":"thesis-2","verdict":"AGREE","findings":[{"claim_id":"thesis-2","question":"Does the demo script witness the thesis DEMO OBLIGATION and does the primary flow equal the HERO FLOW? Answer PASS or FAIL only.","lead_answer":"PASS","reviewer_answer":"PASS","reviewer_reasoning":"Checked WINNER-BRIEF.md thesis fields 3 (DEMO OBLIGATION) and 4 (HERO FLOW) against ARCHITECTURE.md. (1) DEMO OBLIGATION, 'judge WITNESSES a real mainnet dividend becoming real cash: tick detected on-chain, increment sold at the open, USDC arriving, with a transaction they can open in an explorer.' The demo apparatus in Section 16 delivers each clause on mainnet: scripts/seed-demo.ts buys REAL mainnet positions (STRCx the hero payer, KOx, MCDx, ~$60, printing Solscan links) and states 'No fabricated state'; tick detection is on-chain off the Token-2022 ScaledUiAmount TLV type 25 (Sections 3/6, tick-watcher); the sell is gated to the open by market-clock → harvest-executor → settlement-engine → Jupiter (Section 2 data flow, Section 14); USDC arrival is program settle (Section 11) with an on-chain HarvestReceipt readable without trusting the operator (web/app/api/receipts/route.ts); and scripts/capture-proof.ts emits submission/proof.md with Solscan links for the harvest tx, settle tx, mint, holder and the multiplier/new_multiplier/effective values 'after the first real harvest'. Section 19 adds queued-for-open.png and settled.png captures. The devnet rig (scripts/create-devnet-mint.ts) is explicitly labelled 'the FALLBACK demo rig. The primary demo is a real mainnet tick, and anything produced by this script is labelled as devnet on screen', which matches the brief's fallback clause and preserves the invariant against presenting devnet as mainnet. (2) HERO FLOW, 'Enroll a holding with one capped signature, a real tick fires, USDC arrives.' The primary app flow is exactly this: page.tsx leads with the dividend thesis plus the real on-chain calendar, then renders EnrollPanel, whose per-holding 'Get paid in cash' button builds an approve_checked with a raw cap of position/20 (~5%) to the harvest-authority PDA, with Section 9 stating the holder's single signature carries both the approve and the enroll instruction (Anchor client appends enroll 'so the holder signs exactly once'); enroll snapshots the current multiplier so no history is claimed; a real tick then drives harvest (delta recomputed on-chain, no caller-supplied amount) and settle pays USDC to the plan destination. Section 17's Layer 2 confirms the cap is the custody story. No drift-tripwire inversion: the primary flow is not led by a portfolio dashboard, index basket, yield percentages, or vault share accounting; the buy front door exists as a supporting surface (Section 2 web-app, /api/income-stocks) rather than the hero path. Minor slack noted but not disqualifying: the pasted EnrollPanel snippet shows only the approve instruction inline (the enroll ix is described in prose as appended by the Anchor client), and the payout-mode picker from the brief's Demo Path step 3 is carried by the program's PayoutMode argument rather than shown in the panel UI, neither alters the demo-obligation clauses or the enroll→tick→USDC hero sequence. Both checks hold, so the conjunction is PASS.","match":true,"resolution_note":"Weak-positive convergence; not proof."}],"resolved":false}
```

## Cross-Review

```json
{"reviewer":"claude","phase":"positioning","verdict":"AGREE","findings":[{"claim_id":"positioning","question":"Given the competitor landscape and the projects differentiation, is the market positioning: crowded, similar, differentiated, or unique? Answer with exactly one of: crowded|similar|differentiated|unique.","lead_answer":"differentiated","reviewer_answer":"differentiated","reviewer_reasoning":"Both canonical files support a clear, defensible distinction from named competitors, but stop short of a uniqueness claim, and do so explicitly.\n\nEvidence for strong differentiation: research-brief.md's Category Saturation table measures 'Corporate-action products / Products acting on multiplier ticks' at 0 (1 read-only tracker), read as 'Empty'. The Capability Sheet calls Scaled UI Amount 'the sharpest \"why Solana\" available in this hackathon and almost nobody will use it.' The Kill List's 'Already Built' entries are all adjacent, not overlapping: index baskets (Symmetry), DCA (Jupiter Recurring), borrow-against-stocks (Kamino), dividend detection for tax (SolanaRWA). PRD.md's differentiation is a specific mechanic, sell exactly the multiplier increment at the next market open and pay USDC, against a specific, quantified problem ($8.72M reinvested, zero paid as cash; taxed on a distribution never received).\n\nEvidence against 'unique': the brief names SolanaRWA as a MEDIUM-threat competitor reading the same on-chain multiplier signal (differing only in that it 'does not execute, sell, or pay'), so the signal itself is not unclaimed. More decisively, the Competitor Landscape bottom line is 'The field is unobservable... Saturation is UNPRICED,' with 14 hidden submissions at UNKNOWN threat, Competitor Depth self-scored 2/5, and an explicit instruction: 'Do not rely on \"nobody else thought of this.\"' PRD.md R11 encodes the same posture, 'Unmeasurable, so do not defend on novelty. Defend on a real mainnet harvest with an explorer link.' A project whose own risk register refuses to defend on novelty is not positioned as unique.\n\n'Crowded' and 'similar' are ruled out by the measured-empty execution category and the adjacent-only competitor set. 'Unique' is ruled out by an unpriced field, one competitor on the same signal, and the documents' own refusal of the novelty defense. That leaves differentiated: a distinct, hard-to-copy wedge in a landscape that cannot be proven empty.","match":true,"resolution_note":"Weak-positive convergence; not proof."}],"resolved":false}
```

---
### critique: 2026-09-12T12:05:00Z
**Status:** COMPLETE
**Session(s):** 2 (session 1 found E-1..E-5, applied the fixes, stalled before writing state)

#### Done
- Nine findings beyond E-1..E-5, ranked; seven fixed in place, two routed downstream.
- Highest: no on-chain bound on tick MAGNITUDE, so a forward split harvested real shares.
- Second: two unreconciled accrual floors, one of which silently broke the E-4 receipt triple.

#### Additions (not in PRD/Architecture)
- [SKILL] [NEW] `MAX_TICK_RATIO` (1.02) plus `TickTooLarge` and `BadCollectionAccount` errors, closes C-1 and C-8a, ARCHITECTURE Sections 5, 6, 10, 17.
- [SKILL] [NEW] Two tests, `forward_split_is_rejected` and `aaplx_tick_delta_is_exactly_602_834`, the split case only LOOKED covered, and E-1's constant was never asserted, ARCHITECTURE Section 6.
- No new documents, templates or checklists. Every fix amends existing text.

#### Deviations
- Read ARCHITECTURE.md by section (3, 6, 10, 11, 17, 23, 24) rather than whole-file, per dispatch. Section 5 opened for two lines only, to add the error variants my own edit referenced.
- E-1..E-5 taken as given and not re-verified, per dispatch.

#### Verified Facts
- [VF-C1] A forward split raises the multiplier, so `require!(m1 >= m0)` did not exclude it. Token-2022 reverts a delegate transfer above the allowance, so a 2x split reverted, but every non-dividend bump up to `m1/m0 = 1.0526` implied a delta at or under the 5% cap and executed in full. Source: ARCHITECTURE S6/S10 against PRD F2 step 4, which states splits arrive through this same channel.
- [VF-C2] Span telescoping holds exactly: `R*(1-m0/m1) + R*(m0/m1)*(1-m1/m2) == R*(1-m0/m2)`, so anchoring the receipt's `m0` to the first harvest of a batch keeps the recompute valid across accrued ticks. Source: algebra, checked against the S10/S11 field flow.
- [VF-C4] The repository contains no code: no Anchor.toml, no programs/, no crank/, no web/. All five Phase 0 tasks undone. Source: directory listing, 2026-09-12.

#### Assumptions
- [A-C1] `MAX_TICK_RATIO = 1.02` is calibrated on three observed ticks (AAPLx 0.060%, KOx 0.449%, STRCx ~0.51%), NICE-TO-HAVE. If a real dividend ever exceeds 2% the harvest fails closed, which is the safe direction; widen the constant rather than removing it.
- [A-C4] Phase 0's "~3 SOL for program rent" estimates a program that does not exist yet, NICE-TO-HAVE, error direction is safe.

#### Blockers for Downstream
None halting. One thing is wall-clock and is now the first instruction in Phase 0: ~4.5 SOL has to arrive on mainnet, and no amount of coding speed substitutes.

#### Key Decisions
- [D-C1] One gate, not two: Mon 14 Sep 22:00 UTC binds; Sun 13 Sep 20:00 UTC is the checkpoint that fires the cut list → affects build, deploy.
- [D-C2] Four cuts taken now rather than held in reserve: no web before the mainnet crank logs a tick, five instructions not six, STRCx-only at the gate, devnet rehearsal is the designated sacrifice → affects build.
- [D-C3] DT-9 leads with autonomy-under-a-clock instead of quoting the rulebook back, so the answer survives the front door being cut → affects demo, package.

#### For Next Skill
build: start Task 0.5 (fund ~4.5 SOL) before `anchor init`; it is the only item with hours of lead time. Phase 1 now expects 6 tests then 7, not 4 then 5. The gate is Monday 22:00 UTC and the four cuts in PLAN "Cuts taken now" are defaults, not contingencies. D-16 is P1 and owned by you: the PDA-delegate `transfer_checked` shape is [UNVERIFIED] and DT-15 does not cover it, so exercise it first on devnet. D-8 (revert the Unknown→Dividend hack) is now load-bearing for C-1, because that hack turns every unlabelled multiplier move into a harvest. Do not re-litigate the dividend premise.

### conductor: checkpoint 3 resolution, 2026-09-12T12:30:26Z

#### Done
Applied the Checkpoint 3 decisions: devnet first, all four critique cuts accepted, RPC key
search running against the machine.

#### Key Decisions
- [USER] Deploy to devnet rather than funding mainnet today. Reworked PLAN Phase 0 and Phase 5,
  added a mainnet cutover section, and updated the [C] demo concern.
- [USER] All four critique cuts accepted as defaults.
- [CONDUCTOR] Amended critique finding C-1: MAX_TICK_RATIO raised from 1.02 to 1.03 after
  checking all 570 recorded dividend events. 1.02 would have rejected six real dividends,
  one on a tradeable mint.

#### For Next Skill
build: the gate is now a DEVNET harvest running end to end, plus the crank watching real
mainnet mints for detection. Both halves are required. Every devnet artifact that appears in
the demo must be labelled devnet. D-8 (revert the Unknown-to-Dividend rehearsal hack) is now
MORE important, not less, because the fixture mint has no issuer record and will always report
reason Unknown.
