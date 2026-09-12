# PULSE — Pipeline Rolling Context

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

## Decisions Log
| Decision | Rationale | Phase |
|----------|-----------|-------|

## Downstream Items
<!-- Owner-routed, non-blocking deferred work. Every skill reads on entry, actions rows it owns. See PULSE-PROTOCOL § Downstream Items. -->
| ID | Raised by | Owner phase | Pri | Item | Acceptance | Status |
|----|-----------|-------------|:---:|------|-----------|:------:|
| D-1 | intel | forge | P0 | PRD phase 1 must be the mainnet harvest path. Binding gate: live by end of Mon 15 Sep, ahead of the expected STRCx tick ~14-15 Sep. | PRD implementation plan phase 1 = detect tick + harvest + settle on mainnet | open |
| D-2 | intel | forge | P0 | Design the payout floor and accrual on day one. A 0.06% tick on a $200 position is $0.12, below sane swap size. | ARCHITECTURE.md specifies the threshold and the batching rule | open |
| D-3 | intel | forge | P1 | Do NOT design a Jupiter CPI. Use a keeper-signed swap with the program capping the movable amount to the increment. | ARCHITECTURE.md shows keeper-signed swap, no CPI into Jupiter | open |
| D-4 | intel | build | P0 | Open the Submit Project form early in the week and record its actual fields. Not scrapeable pre-submission. | SUBMISSION-CHECKLIST.md updated with real field names | open |
| D-5 | intel | deploy | P0 | Deployment must survive to 2026-10-02. No sleeping free tier. | Host chosen with no cold-sleep, verified after deploy | open |
| D-6 | intel | demo | P1 | Lead the pitch with the tax liability, not with income preference. Nobody is publicly complaining they want cash dividends; they are taxed on distributions they never receive. | Demo script opens on the tax framing | open |
| D-7 | intel | package | P1 | Disclose SolanaRWA as the adjacent product, and disclose issuer permanentDelegate/pausable control. | Both appear in the submission text | open |

## Skill Sections

### intel — 2026-09-12T08:28:29Z

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
