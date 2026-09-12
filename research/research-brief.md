# STOCKLANA — Research Brief

**Compiled:** 2026-09-12
**Intel Depth:** ID 8 (Deep) — reallocated, see note
**Sources:** Web research, official hackathon page, xStocks primary docs, Kraken support, on-chain Solana RPC, xStocks public API, DexScreener, Jupiter
**Prior work:** `ideate` (2026-09-12) verified dependencies and ran the collision search. Base-layer searches were not repeated. Depth was spent on the four gaps ideate could not see: late rule changes, judge/organizer signals, build-in-progress chatter, and competitor products shipped in the last two weeks.

---

## Overview

| Field | Value |
|-------|-------|
| Name | Stocklana |
| Organizer | Solana Foundation (hackathons.solana.com) |
| Platform | Custom site, not Devpost/DoraHacks/Devfolio |
| Deadline | 2026-09-18 20:00 UTC (Fri 4:00pm ET) |
| Judging ends | 2026-10-02 |
| Tracks | MAIN TRACK only, $100,000, 0 bounty tracks |
| Chain | Solana mainnet |
| Native token | SOL |
| Field | 177 registered, 14 submissions, submissions hidden |

### Submission Requirements
- Register, then Submit Project before the deadline
- At least ONE link: GitHub, live demo, or video
- One submission per team, original work, open-source components fine if disclosed
- Edits allowed until submissions close
- Teammates invited from the submit form (account username must be set)

---

## Demo Video Requirements

| Field | Value |
|-------|-------|
| Max length | Not published |
| Formats | Not published |
| Platform | Not published |
| Content notes | Video is one of three accepted link types, not mandatory |

No explicit demo video requirements published [A1 — official page]. **ASSUMED** 300s cap for planning. We are shipping video plus live app plus repo (demoFormat=both), so the assumption is not load-bearing.

---

## Submission Form Fields

Form is behind the Submit Project button and not scrapeable pre-submission. Observable requirements from the rules text: project name, at least one link, teammate invites. **Treat as unverified until the form is opened.** Open it early in the week rather than on Friday.

---

## Disqualifiers

Published:
- Not registered before submitting
- No link of any kind
- More than one submission per team
- Non-original work, or undisclosed closed-source reuse

Operational, not published but fatal:
- **A link that dies before 2 October.** Judging runs two weeks past the deadline. This is the single most likely self-inflicted loss on this event.
- Username not set on the account, which the site prompts for and which teammate invites depend on.

---

## Prizes

| Track | Prize | Notes |
|-------|-------|-------|
| MAIN TRACK | $100,000 | No published split across places. Awarded by the Solana Foundation. Winners contacted through the site. |

**BOTTOM LINE:** An unpublished split is a mild positive for a strong single entry.
**EVIDENCE:** Page states only "$100,000" and "The $100,000 prize pool is awarded by the Solana Foundation" [A1].
**CONFIDENCE:** High on the facts, Low on how many winners there will be.
**SO WHAT:** Do not optimise for a specific placement. Optimise for being unambiguously in the top handful.

---

## Judging Criteria

No weights published. Verbatim: *"One question: could this be a real app that people will actually use? Judges look for a real user and problem, a working end-to-end demo, a reason it belongs on Solana, and quality of execution."* [A1]

| Criterion | Derived weight | What it means | How to score high |
|-----------|:---:|---|---|
| Real user and problem | 25% | A named person with a problem, not a market | Name the user, quantify the loss they take today |
| Working end-to-end demo | 25% | It runs, in front of them | Real mainnet transaction, explorer link, not a mock |
| Reason it belongs on Solana | 25% | Not "fast and cheap" | A primitive that does not exist elsewhere |
| Quality of execution | 25% | Polish | Working UI, clean repo, no dead ends |

**SO WHAT:** "Pick one wedge and make it excellent" is in the rules text. A single mechanic executed cleanly beats a feature pile. This directly supports the stokss scope discipline.

---

## Workshop Signals

No workshop schedule published. No office hours, no sessions, no speakers found. There is no organizer signal channel for this event beyond the page itself.

---

## Tech Deep Dive

Full verified dependency list lives in `~/.claude/skills/hackathon-briefs/stocklana.md` §8 and is not repeated. Key points for the build:

- **Token-2022 Scaled UI Amount** is the mechanism xStocks uses on Solana for corporate actions. The mint carries `multiplier`, `newMultiplier`, and `newMultiplierEffectiveTimestamp`. Verified on the AAPLx mainnet mint [A1 — on-chain read].
- Mints also carry `permanentDelegate` and `pausableConfig`, both issuer-held, plus `confidentialTransferMint` and an inactive `transferHook`. `defaultAccountState: initialized`, so transfers are permissionless. **The issuer can seize and pause.** Disclose this in the submission.
- Decimals are 8 on the mints checked.
- **Price convention (verified this session):** DexScreener and Jupiter quote price per RAW token, which equals share price × multiplier. Confirmed against four mints by dividing out the multiplier and recovering a sane share price (AAPLx $332.44, KOx $87.67, NFLXx $76.17 post 10:1 split, TQQQx $71.55). Any valuation code must use raw × price-per-raw, never raw × share price.

---

## Network / Chain Infrastructure

| Field | Value |
|-------|-------|
| Chain | Solana mainnet-beta |
| RPC | Public endpoint works for reads but rate-limits hard. Use a paid RPC for the crank. |
| Devnet | Available, and required for the fallback demo rig |
| Faucet | https://faucet.solana.com |
| Deploy requirement | Not stated. Mainnet is implied because the assets exist only there. |

**Wrong-network risk is real here in an unusual way:** a devnet-only demo is not disqualified, but it is discounted against "working end-to-end demo". The assets cannot be reproduced on devnet with real value.

---

## Ecosystem Products

| Product | Purpose | Integration depth | Docs | Notes |
|---------|---------|---|------|-------|
| xStocks (Backed) | The asset itself, 732 mints on Solana | Deep, we read mint state and their public API | docs.xstocks.fi | Public endpoints need no auth. xChange RFQ needs an onboarded account we cannot get. |
| Jupiter | Swap routing for the harvest and the buy front door | Deep | dev.jup.ag | lite-api rate limits around 60 req/min. Back off. |
| Raydium | Where the actual xStock liquidity sits (CLMM) | Indirect, via Jupiter | — | AAPLx/USDC routes here |
| Kamino | Tokenized-stock lending, 82.6% share | Not integrated | docs.kamino.finance | Adjacent, not a dependency |
| Pyth | Equity, 24/7 index, and redemption-rate feeds | Not on the critical path | docs.pyth.network | Hermes REST returned 401 today without a key |
| Token-2022 | Scaled UI Amount extension | Deep | solana.com/docs/tokens/extensions | `spl-token update-ui-amount-multiplier` verified in CLI 5.4.0 |

---

## Capability Sheet

Native Solana primitives this event can be won on:

- **Scaled UI Amount (Token-2022).** An issuer publishes a multiplier, a pending next multiplier, and the timestamp it activates, on the mint itself. A program can read a corporate action *before it happens*. Backed's docs describe the EVM version as simply adjusting balances, with no scheduled-change field. **This is the sharpest "why Solana" available in this hackathon and almost nobody will use it.**
- **Sub-cent fees.** Dividend payouts of one to six dollars are only economical here.
- **Permanent delegate and pausable mints.** Issuer-grade control primitives that make regulated assets issuable at all.
- **Solana Subscriptions and Allowances.** Native pre-authorised recurring pull with spending caps, reported live on mainnet and audited by Cantina and Spearbit. Verify before depending on it.
- **Confidential transfer extension.** Present on the mints, unused by anyone. Unexplored surface.

---

## Competitor Landscape

**BOTTOM LINE:** The field is unobservable, and unusually, so is any indirect signal. Saturation is UNPRICED.
**EVIDENCE:** Submissions hidden on the site [A1]. Showcase page returns 0 projects [A1]. Five targeted searches for "Stocklana" across news, X, devlogs and general web returned zero results referencing this event by name [B2 — absence of evidence across multiple engines]. No Discord or Telegram link is published for the event. No judges named anywhere.
**CONFIDENCE:** High that the signal is absent. Zero confidence about what the 14 submissions contain.
**SO WHAT:** Shift weight to defences that survive duplication: a mechanic that is hard to copy in six days, a real mainnet transaction as evidence, and execution polish. Do not rely on "nobody else thought of this."

### Competitor Registry

| Project | Track | Threat | Tech | Source | Confidence |
|---------|-------|:---:|---|---|:---:|
| SolanaRWA (solanarwa.app) | Not a hackathon entry | MEDIUM | Reads the same multipliers, builds dividend income events for AU/US/UK/CA tax | dev.to post by the team [B2] | High |
| 14 unnamed Stocklana submissions | MAIN | UNKNOWN | Unknown | Site counter only [A1] | n/a |

SolanaRWA is the only product found that touches the same on-chain signal. It detects and reports for tax. It does not execute, sell, or pay. Named in our submission per the collision-disclosure rule.

### Competition Density Map

| Track | Est. Teams | Activity | Density |
|-------|:---:|---|:---:|
| MAIN (single track) | 14 submitted so far, 177 registered | Invisible | UNMEASURABLE |

Registered-to-submitted ratios on comparable events suggest a final field well below 177. 14 with six days left is consistent with a long tail arriving in the last 48 hours.

---

## Community Pain (Verbatim Quotes)

Autonomous run: no Discord or X review was performed, and no event community channel exists to review. These are verbatim quotes from primary documentation and one third-party product blog, which is what is available.

1. *"Rather than distributing cash, the dividend is reinvested into additional shares of the same stock."* — xStocks docs, Dividends and Stock Splits, docs.xstocks.fi/docs/dividends-and-stock-splits [A1]
2. *"There is no separate cash credit or line item, the increase appears as a higher effective token balance in your portfolio."* — Kraken xStocks FAQ, support.kraken.com/articles/xstocks-faq [A1]
3. *"When the underlying stock pays a dividend, the issuer doesn't airdrop tokens to thousands of wallets. It updates a single number, a multiplier, on the mint account itself."* — SolanaRWA, "On-Chain Dividends Are Silent. Your Tax Bill Isn't.", dev.to [B2]
4. *"As rebasing tokens, xStocks cannot integrate natively with DeFi protocols. Everything from AMMs to lending markets would be thrown off by referencing a token whose supply and balances are subject to periodic expansion."* — xStocks docs, Wrapped xStocks [A1]

**GAP:** No end-user complaints captured. Nobody is publicly complaining that tokenized stocks pay no cash, which is a double-edged finding: the problem is real and measurable on-chain, but it is not a problem users are loudly asking to have solved. Address this in the pitch by leading with the tax liability rather than with income preference.

---

## Contradiction Log

| Claim | Sources for | Sources against | Resolution |
|-------|-------------|-----------------|------------|
| Backed pays dividends as USDC airdrops on Solana | eco.com support article, repeated by several aggregators [D4] | xStocks docs [A1], Kraken FAQ [A1], all 583 multiplier events in the public API being reinvestment [A1] | **Rejected.** Circular reporting: one support article re-quoted across aggregators. Primary sources are unanimous. Do not re-litigate. |
| Tokenized equity supply on Solana is $684M | News coverage, mid-Sep 2026 [C3] | Our own measurement: $891M across just 29 dividend-paying names with DEX liquidity, raw supply × price-per-raw [B2, method verified] | **Unresolved, different universes.** The tracker figure likely excludes leveraged ETFs, preferreds and treasury-company tokens that our set includes. **Do not headline a total-market number in the submission.** Headline the event counts and per-name yields, which are definitionally clean. |

---

## Past Editions Analysis

No past editions. hackathons.solana.com is a new "productized hackathons" property with an empty showcase and two further events queued (Perps and Prediction Markets; Agentic Payments). Stocklana points builders to Colosseum's World's Fair as the next step, so this series appears to be a feeder rather than an accelerator pipeline in itself.

**SO WHAT:** No winning-shape precedent to copy, and no judge history to design toward. The published judging line is the only rubric that exists. Answer it literally, sentence by sentence, in the submission text.

---

## Broader Market Context

- Tokenized equity supply on Solana hit a record in mid-September 2026, reported up 47% in three weeks [C3].
- Q2 2026 tokenized-stock volume on Solana reported above $5.77B [C3].
- Solana holds the large majority of xStocks issuance and volume [B2].
- Kamino Lend holds roughly 82.6% of tokenized-stock lending [B2].

**SO WHAT:** The category is growing fast and the organizers know it, which is why this event exists. An entry that treats tokenized stocks as a live asset class rather than a demo prop reads correctly.

---

## Category Saturation

Grid and Copilot were unavailable this run (no PAT; the grid helper did not load). Substituted with direct on-chain measurement, which is stronger evidence for this specific domain than product counts:

| Category | Measure | Value | Saturation read |
|----------|---------|------:|-----------------|
| Tokenized stocks on Solana | Mints deployed | 732 | Supply-rich |
| Dividend-paying | Mints with >= 1 dividend event | 338 | Supply-rich |
| Actually tradeable | Mints with > $1k DEX liquidity | 29 | **Thin** |
| Deeply tradeable | Mints with > $250k DEX liquidity | 6 | **Very thin** |
| Corporate-action products | Products acting on multiplier ticks | 0 (1 read-only tracker) | **Empty** |

---

## Builder Project History

Copilot unavailable (no PAT). No prior-art corpus search performed. Bounded by absence of the tool, not proof of absence.

---

## Key Links & Resources

| Resource | URL |
|----------|-----|
| Hackathon page | https://hackathons.solana.com/hackathons/stocklana |
| xStocks docs | https://docs.xstocks.fi |
| Multiplier guide | https://docs.xstocks.fi/developers/multipliers |
| Public API base | https://api.backed.fi/api/v2/public |
| Multiplier history | /assets/{SYM}/multiplier/history?network=Solana |
| Scaled UI Amount docs | https://solana.com/docs/tokens/extensions/scaled-ui-amount |
| Jupiter quote | https://lite-api.jup.ag/swap/v1/quote |
| DexScreener | https://api.dexscreener.com/tokens/v1/solana/{mints} |
| Backed restricted countries | https://assets.backed.fi/legal-documentation/restricted-countries |
| Next stop after event | https://colosseum.com/worldsfair |

---

## Track Coverage Matrix

| Track | Prize | Judging Focus | Overlap Potential | Est. Submissions |
|-------|-------|--------------|-------------------|-----------------|
| MAIN TRACK | $100,000 | Real user, working demo, Solana reason, execution | n/a, single track | UNKNOWN |

Single track, so there is no multi-track arbitrage on this event. The equivalent lever is **wedge choice**: the rules name five wedges and instruct builders to pick one. stokss answers "credit and yield: dividends" and "infrastructure: corporate actions" literally. Both are named in the organizers' own words, and both are, on the evidence above, empty.

---

## Domain Knowledge Sources

| Source | URL | Covers | Essential? |
|--------|-----|--------|:---:|
| Scaled UI Amount integration guide | solana.com/docs/tokens/extensions/scaled-ui-amount/integration-guide | Converting raw to UI amounts correctly, `amountToUiAmount` | YES |
| xStocks multiplier guide | docs.xstocks.fi/developers/multipliers | Chain-specific multiplier semantics | YES |
| xStocks API quickstart | docs.xstocks.fi/developers/quickstart | Public endpoint shapes | YES |
| Jupiter swap API | dev.jup.ag | Quote and swap transaction building | YES |
| Anchor book | anchor-lang.com | Program scaffolding, delegate CPI | YES |
| Token-2022 delegate semantics | solana-program/token-2022 | `approve_checked` and delegated transfer with extensions | YES |
| Solana Subscriptions and Allowances | (verify at build time) | Native recurring pull with caps | NO, nice to have |

---

## Kill List

### 1. Saturated
Unmeasurable for this event. Structurally likely crowded, from the rules text itself: trading terminals, DCA apps, index baskets, borrow-against-stocks, card and spending demos. The rules name these five wedges to 177 people.

### 2. Broken Dependencies
- **xChange atomic RFQ** — needs an onboarded Backed client account. Kills anything requiring primary issuance or redemption.
- **Pyth Hermes REST** — 401 without a key today. Kills anything needing an off-hours mark on a deadline.
- **The 703 illiquid mints** — 732 exist, 29 are tradeable. Kills any product whose value depends on the long tail.

### 3. Already Built
- Index baskets: Symmetry, basketsolana.xyz
- DCA and recurring buys: Jupiter Recurring
- Borrow against stocks: Kamino, which also ships automated deleverage with a 72-hour margin-call grace period
- Dividend detection for tax: SolanaRWA

### 4. Zero Alignment
Anything not touching tokenized stocks. The single track has one subject.

---

## Quality Scorecard (self-assessed, autonomous mode)

| Dimension | Score | Reasoning |
|---|:---:|---|
| Specificity | 5 | Every number measured against this event's actual assets, this week |
| Evidence | 5 | Primary sources and on-chain reads; a contradiction log with resolutions |
| Novelty | 4 | Price-convention finding and the 98.3% off-hours finding are non-obvious; the market-size contradiction was caught before it shipped |
| Competitor Depth | 2 | **Weak, and irreducibly so.** One named adjacent product. The field is hidden and no indirect signal exists. |
| Actionability | 5 | Kill list, dependency blockers, and the wedge choice all directly shape forge |

**Average 4.2.** Competitor Depth scores 2 and cannot be raised by more searching: five targeted searches returned nothing because nothing exists to find. Recorded as a known gap rather than padded.
