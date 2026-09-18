# stokss: Product Requirements Document

**Version:** 1.0
**Date:** 2026-09-12
**Hackathon:** Stocklana (Solana Foundation), MAIN TRACK, $100,000
**Deadline:** 2026-09-25 20:00 UTC. Judging through 2026-10-02.
**Scope mode:** `standard` (6 days remaining, 6 build days plus submission day)
**Source:** ideate winner brief (`warroom/WINNER-BRIEF.md`), warroom phase skipped

---

## Section 1: Project Overview

**stokss** gives tokenized stocks their dividends back as cash.

### The problem, in one number

$8.72 million of dividends were paid into Solana-held tokenized stocks over the last 12 months, across 110 multiplier ticks on the 29 dividend-paying xStocks that have real liquidity. **Not one cent of it reached a holder as cash.**

When Coca-Cola pays a dividend, Backed does not send anything to KOx holders. It reinvests the cash into more shares and raises a single number on the mint: the Token-2022 Scaled UI Amount multiplier. Your balance display goes up. Nothing spendable arrives. Their own documentation is explicit: *"Rather than distributing cash, the dividend is reinvested into additional shares of the same stock."*

That leaves the holder in a position that has no equivalent in a brokerage account: **they are taxed on a distribution they never received.** SolanaRWA, which builds tax reports for exactly these assets, titled their writeup on it "On-Chain Dividends Are Silent. Your Tax Bill Isn't."

### The solution

When a tokenized stock's on-chain multiplier ticks up, stokss sells exactly that increment at the next US market open and routes the cash where the holder chose: their wallet, or a bill.

The whole product is one formula. If a holder's raw balance is `R` and the multiplier moves from `M0` to `M1`:

```
delta = floor(R * (1 - M0/M1))
```

Selling `delta` raw tokens leaves the holder with the identical number of underlying shares they had before the dividend, and `delta × price` is the dividend, in USDC. Nothing else needs inventing.

### Why it belongs on Solana

Not "fast and cheap". Three specific reasons:

1. **The corporate action is a first-class on-chain field.** The Token-2022 Scaled UI Amount extension publishes `multiplier`, `newMultiplier`, and `newMultiplierEffectiveTimestamp` on the mint account. A program can read a dividend *before it happens*. Backed's own docs describe the EVM implementation as adjusting balances directly, with no scheduled-change field. This mechanic does not exist off Solana.
2. **Payout sizes are only economical here.** A typical tick pays one to six dollars per position. A chain with sub-cent fees is the only place that clears.
3. **The market is here.** Solana carries the large majority of xStocks issuance and volume, and all 732 xStocks assets are deployed on it.

### Why this wins (mapped to the judging criteria)

The organizers ask one question: *could this be a real app that people will actually use?* Their four sub-criteria, answered literally:

| Criterion | Our answer |
|-----------|-----------|
| A real user and problem | Anyone holding a dividend-paying xStock. The problem is a tax liability on income they cannot spend, measurable on-chain, affecting 338 mints and 110 ticks a year on the liquid subset. |
| A working end-to-end demo | A real mainnet corporate action, harvested and settled, with an explorer link. Not a mock, not a token we minted. |
| A reason it belongs on Solana | Scaled UI Amount is a Solana-only primitive and the entire mechanic reads from it. |
| Quality of execution | One mechanic, one screen that matters, no feature pile. The rules say "pick one wedge and make it excellent." |

### Thesis framing

**Winning argument:** an entire asset class silently lost cash dividends, and one on-chain field is enough to give them back.
**Demo obligation:** the judge witnesses a real dividend becoming real cash, on mainnet, with a transaction they can open.
**Hero flow:** enroll a holding, a real tick fires, USDC arrives.
**Invariants:** we never move more than the increment; we never fabricate a corporate action; every number shown traces to on-chain state or the issuer's public API.
**Drift tripwires:** becoming a portfolio dashboard; becoming an index basket; leading the pitch with yield percentages.

---

## Section 2: System Architecture Overview

```
                            ┌──────────────────────────┐
                            │   Solana mainnet-beta    │
                            │                          │
                            │  Token-2022 xStock mints │
                            │   scaledUiAmountConfig:  │
                            │     multiplier           │
                            │     newMultiplier        │
                            │     effectiveTimestamp   │
                            └────────────┬─────────────┘
                                         │ reads mint state
                                         │
  ┌──────────────┐   enroll +    ┌───────▼────────────┐   harvest    ┌──────────────────┐
  │              │   capped      │                    │   (CPI       │                  │
  │   web-app    ├──delegate────►│  stokss-program    │◄──delegate───┤ harvest-executor │
  │  (Next.js)   │               │     (Anchor)       │   transfer)  │   (crank)        │
  │              │◄──receipts────┤                    │              │                  │
  └──────┬───────┘               │  Config            │◄──settle─────┤                  │
         │                       │  UserPlan (PDA)    │              └────────┬─────────┘
         │                       │  HarvestReceipt    │                       │
         │                       └────────────────────┘                       │
         │                                ▲                                   │
         │ reads                          │ queues                            │ swaps
         ▼                                │                                   ▼
  ┌──────────────┐              ┌─────────┴────────┐   open?    ┌──────────────────────┐
  │ indexer-api  │              │  tick-watcher    ├───────────►│  Jupiter (quote+swap)│
  │  (routes)    │              │    (crank)       │            └──────────────────────┘
  └──────┬───────┘              └─────────┬────────┘
         │                                │ asks
         │ uses                           ▼
         │                       ┌──────────────────┐
         └──────────────────────►│  market-clock    │
                                 │    (crank)       │
                                 └──────────────────┘
                                          │
  ┌────────────────┐                      │ both use
  │ xstocks-client ├──────────────────────┘
  │  (shared lib)  ├──────► api.backed.fi/api/v2/public  (assets, multiplier history, price)
  └────────────────┘──────► api.dexscreener.com          (liquidity, price per raw token)
```

### Component table

| # | Name | Type | Purpose | Key Dependencies |
|---|------|------|---------|------------------|
| 1 | `stokss-program` | Anchor program (Rust) | Holds enrollment plans, verifies each tick against on-chain mint state, moves exactly the increment under a capped delegate, records receipts | Token-2022, Solana runtime |
| 2 | `tick-watcher` | Crank module (Node/TS) | Polls enrolled mints for multiplier changes and pending changes, writes a queue entry per detected tick | `xstocks-client`, Solana RPC |
| 3 | `harvest-executor` | Crank module (Node/TS) | At market open, calls `harvest` for every enrolled plan on the ticked mint, batching per mint | `stokss-program`, `market-clock` |
| 4 | `settlement-engine` | Crank module (Node/TS) | Swaps the aggregated increment on Jupiter, then calls `settle` per plan to pay USDC out | Jupiter, `stokss-program` |
| 5 | `market-clock` | Crank module (Node/TS) | Answers "is the US equity market open right now", from the issuer's live trading state with a local calendar fallback | `xstocks-client` |
| 6 | `web-app` | Next.js 15 app | Enrollment, the receipts feed, the backfill view, the upcoming-tick calendar, the buy front door | Wallet adapter, `indexer-api` |
| 7 | `indexer-api` | Next.js route handlers | Server-side reads: portfolio with scaled balances, backfill computation, calendar, receipts | `xstocks-client`, Solana RPC |
| 8 | `xstocks-client` | Shared TS library | Typed client for the Backed public API and DexScreener, plus mint-extension parsing | none |

### Data flow

1. `tick-watcher` polls the mints that have at least one enrolled plan. It compares the on-chain `multiplier` / `newMultiplier` / `newMultiplierEffectiveTimestamp` triple against the last value it recorded, and cross-checks the issuer's published schedule.
2. On a change, it writes a queue entry: mint, `M0`, `M1`, activation timestamp.
3. `harvest-executor` waits until `market-clock` reports the US market open, then calls `harvest` once per enrolled plan on that mint. The program recomputes `delta` from on-chain state and moves exactly that, transferring to a keeper-held collection account.
4. `settlement-engine` swaps the collected total for USDC in one Jupiter route, then calls `settle` per plan with each plan's pro-rata share.
5. `settle` pays USDC to the plan's destination and writes a `HarvestReceipt`.
6. `web-app` renders receipts, the backfill, and the calendar from `indexer-api`.

### State: what persists where

| State | Location | Why |
|-------|----------|-----|
| Enrollment, destination, last harvested multiplier, accrued balance | On-chain `UserPlan` PDA | Must be trust-minimised and readable by anyone |
| Delegate allowance | Token-2022 account delegate field | The custody cap lives where the token program enforces it |
| Receipts | On-chain `HarvestReceipt` + program events | Judges can verify payouts without trusting our server |
| Tick queue, retry counters | Crank local store (SQLite) | Operational, not trust-bearing |
| Prices, liquidity, tick history | Fetched live, cached 60s | Never authoritative, always re-derivable |

---

## Section 3: User Flows

### F1: Enroll a holding

1. Holder opens the app and connects a wallet.
2. App reads their token accounts, filters to xStocks mints, and displays **scaled** balances (raw × multiplier), each with the underlying share count.
3. For any holding, the holder taps "Get paid in cash".
4. App shows what the last four ticks would have paid on their current position, computed from real tick history.
5. Holder picks a destination: their wallet (USDC), or a bill.
6. App builds one transaction: `approve_checked` setting the program's harvest authority as delegate with a **capped** raw allowance, plus the program's `enroll` instruction.
7. Holder signs. Plan is live.

**Error path:** holder has no xStocks → the app shows the buy front door instead (F6). Holder rejects the signature → nothing changes, no partial state.

### F2: A tick is detected and queued

1. `tick-watcher` polls every enrolled mint every 30 seconds.
2. It detects that `newMultiplier` differs from the recorded value, or that an activation timestamp has passed.
3. It cross-checks the issuer's public multiplier history for the same mint to confirm the event and capture its stated reason (Dividend, Split, ReverseSplit, Administrative).
4. **Splits and reverse splits are recorded and skipped.** They are value-neutral in raw terms: the share price moves inversely to the multiplier, so there is no dividend to harvest. Only `Dividend` events produce a harvest.
5. It writes a queue entry and emits a notification to enrolled holders.

**Error path:** RPC unavailable → exponential backoff, and the issuer's API schedule becomes the primary detector until RPC returns.

### F3: Harvest at the market open

1. `harvest-executor` sees a queued Dividend tick.
2. It asks `market-clock`. 98.3% of ticks activate while the market is closed, so this almost always means waiting.
3. While waiting, the app shows the holder a "queued for the open" state with the countdown and the reason.
4. At the open, the executor calls `harvest` once per plan.
5. The program reads the mint's current effective multiplier, reads `UserPlan.last_multiplier`, computes `delta`, and moves exactly `delta` raw tokens from the holder's account to the collection account under the delegate.
6. `UserPlan.last_multiplier` advances. `pending_raw` increases.

**Error path:** the holder revoked the delegate or moved their tokens → `harvest` fails cleanly for that plan, the plan is flagged, and the other plans proceed.

### F4: Payout settled to the wallet

1. `settlement-engine` aggregates `pending_raw` across all plans on the mint.
2. If the aggregate is worth less than **`MIN_SWAP_USD`** (the swap-economics floor, not the
   payout floor), it waits and accrues to the next tick. Otherwise it swaps and calls `settle`
   for every plan in the batch, including the plans whose own share is below the payout floor.
   Those accrue on-chain in `accrued_usdc` and pay out on a later `settle`.
3. Above the floor, it takes one Jupiter quote and executes one swap for the whole batch.

<!-- [CRITIQUE C-2] Step 2 previously read "if the aggregate is worth less than the payout
     floor, it waits", which collided with the payout floor already implemented on-chain in
     settle. Two floors, one in the crank and one in the program, and only one of them can be
     operative. If the crank holds, settle is never called and `accrued_usdc` is dead code; if
     the crank swaps every tick, DT-4's "raise MIN_SWAP_USD" remedy does nothing. They are now
     two DIFFERENT thresholds doing two different jobs:
       MIN_SWAP_USD ($0.50, crank)  - is this batch worth one Jupiter round trip?
       payout_floor_usdc ($1.00, program) - is this holder's share worth one USDC transfer?
     The batch clears the first; the individual plan clears the second. -->

4. It calls `settle` per plan with that plan's pro-rata share of the USDC received.
5. The program transfers USDC to the plan's destination and writes a `HarvestReceipt` with the tick, the delta, the price achieved, and the amount paid.
6. The app's receipts feed updates.

**Error path:** the swap fails or slips beyond tolerance → the increment stays in the collection account, `pending_raw` is unchanged, and the batch retries at the next open. Funds are never stranded silently; the receipts feed shows "pending settlement".

### F5: Payout routed to a bill

Identical to F4 through step 4. At settle, the destination is a recurring-payment authority rather than the holder's wallet, and the receipt records which bill was funded. If the accrued amount does not cover the bill, it accrues until it does.

### F6: Buy a dividend stock (front door)

1. Holder opens "Income stocks".
2. App lists the dividend-paying xStocks that actually have liquidity, each with its realised trailing 12-month multiplier growth computed from real tick history, its next expected tick, and its current DEX liquidity.
3. Holder picks one, enters a USDC amount, and swaps through Jupiter.
4. On success, the app offers to enroll the new position immediately (F1).

This is a front door, not a vault. No share accounting, no rebalancing, no custody.

### F7: See what was silently reinvested

1. For each xStock the holder owns, the app pulls the full multiplier history.
2. It computes what each historical tick would have paid on the holder's current position.
3. It shows a single number: what was quietly reinvested for you in the last 12 months, and a per-tick breakdown.

This is the screen that makes the problem real before the product does anything.

### F8: Cancel and revoke

1. Holder taps "Stop".
2. App builds one transaction: program `close_plan` plus a token `revoke`.
3. Any `pending_raw` already collected is settled on the next batch, and the receipt records the plan as closed.

---

## Section 4: Technical Specifications

### 4.1 `stokss-program`

**Purpose.** The trust boundary. It is the only thing standing between an enrolled holder and a keeper that could otherwise move their whole position.

**Responsibilities**
- Store enrollment plans and their destinations
- Recompute `delta` from on-chain mint state on every harvest, never trusting a caller-supplied amount
- Enforce that no more than `delta` moves, and that `delta` can only be taken once per tick
- Pay out USDC and write receipts
- Allow the holder to close a plan unilaterally

**Interface contract**

| Instruction | Signer | Effect |
|---|---|---|
| `initialize_config` | admin | Sets keeper pubkey, fee bps, payout floor, pause flag |
| `enroll` | holder | Creates `UserPlan`, records destination and mode, snapshots the current multiplier |
| `update_plan` | holder | Changes destination or mode |
| `close_plan` | holder | Marks closed, refunds rent after final settle |
| `harvest` | keeper | Verifies tick, computes delta, moves delta under the delegate |
| `settle` | keeper | Pays USDC to the destination, writes a receipt, clears pending |
| `set_paused` | admin | Emergency stop |

**Key data structures (schema level)**

```rust
// specification only, implementation lives in ARCHITECTURE.md
pub struct Config {
    pub admin: Pubkey,
    pub keeper: Pubkey,
    pub fee_bps: u16,
    pub payout_floor_usdc: u64,
    pub paused: bool,
    pub bump: u8,
}

pub struct UserPlan {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub mode: PayoutMode,           // Cash | Redirect(Pubkey) | Bill(Pubkey)
    pub last_multiplier_bits: u64,  // f64 bit pattern of the last harvested multiplier
    pub pending_raw: u64,
    pub accrued_usdc: u64,
    pub total_paid_usdc: u64,
    pub harvest_count: u32,
    pub closed: bool,
    pub bump: u8,
}

pub struct HarvestReceipt {
    pub plan: Pubkey,
    pub mint: Pubkey,
    pub m0_bits: u64,
    pub m1_bits: u64,
    pub delta_raw: u64,
    pub usdc_paid: u64,
    pub tick_activation_ts: i64,
    pub settled_ts: i64,
}
```

**Dependencies.** `anchor-lang`, `anchor-spl` with Token-2022, `spl-token-2022` extension state.

**Performance.** One harvest per plan per tick. A batch of 50 plans must fit in the compute budget when packed at 6 harvests per transaction.

### 4.2 `tick-watcher`

**Purpose.** Detect a corporate action within 30 seconds of it becoming visible on-chain, and never miss one.

**Interface.** Reads a list of enrolled mints from program accounts. Writes queue rows.
**Data structures.** `TickQueueRow { mint, m0, m1, activation_ts, reason, detected_at, state }` where state is `queued | waiting_for_open | harvesting | settling | done | failed`.
**Dependencies.** Solana RPC `getMultipleAccounts` on mints; the issuer's multiplier history endpoint for cross-check and reason.
**Performance.** Poll every 30s. `getMultipleAccounts` batches 100 mints per call, so one call covers the entire enrolled universe.

### 4.3 `harvest-executor`

**Purpose.** Turn a queued tick into on-chain harvests, at the right moment.

**Interface.** Consumes queue rows in `waiting_for_open`. Produces harvested plans.
**Dependencies.** `market-clock` for timing, `stokss-program` for the instruction, a funded keeper keypair for fees.
**Performance.** Packs up to 6 `harvest` instructions per transaction. 50 plans is 9 transactions.

### 4.4 `settlement-engine`

**Purpose.** Convert collected increments to USDC in one route and pay each plan its share.

**Interface.** Consumes harvested batches. Produces receipts.
**Data structures.** `Batch { mint, plans[], total_raw, quote, usdc_received, per_plan_share[] }`.
**Dependencies.** Jupiter quote and swap endpoints, `stokss-program`.
**Performance.** One swap per mint per tick, not one per user. This is what makes dust economical.

### 4.5 `market-clock`

**Purpose.** Answer whether the US equity market is open, correctly, including holidays.

**Interface.** `isOpen(): { open: boolean, nextOpen: Date, source: 'issuer' | 'calendar' }`.
**Dependencies.** The issuer's asset record exposes `trading.currentPeriod`, `openNow`, and `nextChangeAt`. A hardcoded 2026 US market holiday calendar is the fallback.
**Performance.** Cached 60s.

### 4.6 `web-app`

**Purpose.** Make the invisible visible, then let the holder act on it in one signature.

**Responsibilities.** Wallet connection, portfolio with scaled balances, the backfill view, enrollment, receipts, the calendar, the buy front door.
**Dependencies.** `indexer-api`, wallet adapter, Jupiter for the buy path.
**Performance.** First meaningful paint with real data inside 3 seconds on the demo machine.

### 4.7 `indexer-api`

**Purpose.** Keep RPC keys and rate limits server-side, and do the arithmetic once.

**Interface.**

| Route | Returns |
|---|---|
| `GET /api/portfolio?owner=` | holdings with raw balance, multiplier, scaled balance, USD value |
| `GET /api/backfill?owner=` | per-holding historical ticks and what each would have paid |
| `GET /api/calendar` | upcoming and recent ticks across all mints |
| `GET /api/receipts?owner=` | settled receipts from program accounts |
| `GET /api/income-stocks` | the tradeable dividend payers with trailing growth and liquidity |

**Dependencies.** `xstocks-client`, Solana RPC.
**Performance.** 60s cache on everything except receipts.

### 4.8 `xstocks-client`

**Purpose.** One typed place where every external data shape is defined, so a shape change breaks in one file.

**Interface.** `listAssets()`, `multiplierHistory(symbol)`, `priceData(symbol)`, `liquidity(mints[])`, `parseScaledUiConfig(mintAccountData)`, `effectiveMultiplier(config, nowTs)`.
**Dependencies.** none beyond fetch.
**Performance.** All calls cached, all failures typed rather than thrown.

---

## Section 5: API Contracts

### A1: Backed / xStocks public API

Base: `https://api.backed.fi/api/v2/public`. No authentication. Verified live 2026-09-12.

| Endpoint | Purpose |
|---|---|
| `GET /assets?page=&limit=` | Catalogue. 732 Solana deployments. Gives mint address per network and `trading.currentPeriod` / `openNow`. |
| `GET /assets/{symbol}/multiplier/history?network=Solana` | Scheduled and historical ticks. **`network` is required**; omitting it returns a validation error. |
| `GET /assets/{symbol}/price-data` | Quote. **Returns `{"quote": null}` when the market is closed.** |
| `GET /proof-of-reserves/{symbol}` | Collateral attestation. Not on the critical path. |

Multiplier history response shape:

```json
{ "page": { "currentPage": 0, "hasNextPage": false },
  "nodes": [ { "id": "uuid", "reason": "Dividend",
               "multiplier": 1.0032690125398187,
               "previousMultiplier": 1.0026642075893797,
               "activationDateTime": "2026-08-08T00:30:00.000Z" } ] }
```

**Rate limits:** not published. Treat as fragile; cache aggressively and never call it in a user request path.
**Error handling:** any non-200 falls back to on-chain mint reads, which are authoritative anyway.

### A2: Jupiter

Base: `https://lite-api.jup.ag/swap/v1`. No authentication.

| Endpoint | Purpose |
|---|---|
| `GET /quote?inputMint=&outputMint=&amount=&slippageBps=` | Price and route. `amount` is in RAW units. |
| `POST /swap` | Builds the signed-ready transaction. |

**Verified:** routes xStocks to USDC through Raydium CLMM at normal size, drifting to PancakeSwap and Whirlpool at very small size. Quotes succeed down to 10 raw units.
**Rate limits:** roughly 60 requests per minute on the lite endpoint. Exceeding it returns HTTP 429. The crank must back off and batch.
**Error handling:** 429 → exponential backoff. No route → hold the increment and retry next open.

### A3: Solana RPC

Mainnet-beta. Public endpoint for development; a paid endpoint for the crank.

| Method | Purpose |
|---|---|
| `getAccountInfo` (jsonParsed) | Mint extensions including `scaledUiAmountConfig` |
| `getMultipleAccounts` | Batch mint polling, 100 per call |
| `getTokenAccountsByOwner` | Holder portfolio |
| `getProgramAccounts` | Enrolled plans |
| `sendTransaction` / `getSignatureStatuses` | Harvest and settle |

**Rate limits:** the public endpoint throttles aggressively and returned 429s during research. **A paid RPC is a build-day-one requirement, not an optimisation.**

### A4: DexScreener

`GET https://api.dexscreener.com/tokens/v1/solana/{comma-separated mints}`, up to 30 mints per call, no authentication.

Returns price per RAW token and pool liquidity in USD. Used for the income-stocks list and for valuing accrued balances against the payout floor. Never used for execution pricing; Jupiter is the execution price.

---

## Section 6: Demo Script

Target: 3 minutes 30 seconds. Eight scenes, one per user flow.

### Scene 1: The problem (0:00,0:30): covers F7

**On screen:** a wallet holding KOx, MCDx and STRCx. The stokss backfill view loads and lands on one number: what was quietly reinvested over the last 12 months, with the per-tick breakdown beneath it.

**Voiceover:** "This wallet holds three tokenized stocks. Over the past year they paid dividends four times, five times, ten times. Here is every one of them. Not a cent of it arrived as cash. Backed reinvests it and moves one number on the mint. You still owe tax on it. You just cannot spend it."

### Scene 2: Where the number comes from (0:30,1:00): covers F2

**On screen:** the mint account in an explorer, `scaledUiAmountConfig` highlighted: `multiplier`, `newMultiplier`, `newMultiplierEffectiveTimestamp`. Then the stokss calendar showing upcoming ticks across the catalogue.

**Voiceover:** "The dividend is not hidden. It is a field on the mint, and Solana publishes the next one before it happens. On Ethereum the same asset just silently rebases your balance. This scheduled-change field is why stokss can exist here and nowhere else."

### Scene 3: Enroll (1:00,1:30): covers F1

**On screen:** tap "Get paid in cash" on KOx. The panel shows what the last four ticks would have paid. Pick "USDC to my wallet". One signature. The approval screen shows the capped delegate amount.

**Voiceover:** "One signature. You are approving a capped delegate, five percent of the position and no more, and the program computes the increment itself. It cannot take an amount we ask it for, because it does not accept one. Worst case, we can misroute a dividend. We cannot touch the stock. And you revoke it in one transaction."

<!-- [CRITIQUE E-4] Replaced "Your position is untouchable" plus an unqualified "can only
     ever move the dividend increment". Both are true of harvest.rs and false of settle.rs,
     which takes the payout amount from the keeper. A judge reading the program finds this
     in thirty seconds; claiming the stronger version and being caught costs more than the
     honest version costs. The honest version is also the better line: naming the exact
     worst case is what a real product's security page reads like. See ARCHITECTURE.md
     Section 17, "What the bound actually is". -->
**Also on screen:** the one-line trust statement, verbatim: *"stokss can misroute a dividend. It cannot move your shares."*

### Scene 4: The tick fires (1:30,2:10): covers F3

**On screen:** the real STRCx multiplier tick arriving on mainnet. Timestamp shown in UTC, next to a US market clock reading CLOSED. The app moves the tick to "queued for the open" with a countdown.

**Voiceover:** "Here is a real dividend, on mainnet, tonight. Look at the time. Ninety-eight percent of these land while the US market is shut, into a book with no arbitrage behind it. So stokss does not sell into it. It queues."

### Scene 5: Harvest and settle (2:10,2:45): covers F4

**On screen:** the market opens. The harvest transaction executes. Then the swap, then the settle. Cut to the explorer showing USDC arriving in the wallet. Receipt appears in the feed with the exact delta and price.

**Voiceover:** "At the open, we sell exactly the increment. Same number of shares as before the dividend. The difference lands in the wallet as cash. Here is the transaction."

### Scene 6: Route it somewhere (2:45,3:05): covers F5

**On screen:** switch KOx's destination from "my wallet" to a recurring bill. The receipt shows the bill funded.

**Voiceover:** "Or point it at a bill. Your Coca-Cola stock paying your subscription is not a gimmick. It is what a dividend was always for."

### Scene 7: Get more of them (3:05,3:20): covers F6

**On screen:** the income-stocks list, each with realised trailing growth from real tick history and its next expected tick. One-click buy through Jupiter, then the offer to enroll.

**Voiceover:** "And if you want more income stocks, buy them here. These are the ones with real liquidity, ranked by dividends we measured on-chain, not by a data vendor's yield field."

### Scene 8: Stop (3:20,3:30): covers F8

**On screen:** "Stop" on a plan. One transaction closes the plan and revokes the delegate. The allowance goes to zero in the explorer.

**Voiceover:** "And you can leave whenever you like. One transaction, the approval is gone. stokss. Your tokenized stocks, paying you again."

### Voice and copy compliance

Checked: no em dashes in voiceover; no "leverage", "synergy", "paradigm", "seamless", "revolutionary"; active voice throughout; every claim in the script maps to something visible on screen. YouTube title: "stokss: cash dividends for tokenized stocks on Solana" (52 characters, no special characters).

---

## Section 7: Risk Register

| # | Risk | Category | Severity | Likelihood | Impact | Mitigation | Decision tree |
|---|------|----------|:---:|:---:|--------|-----------|---|
| R1 | No real dividend tick lands before the deadline, so the demo is simulated | Demo | CRITICAL | MEDIUM | The strongest evidence in the submission is lost; the demo drops to a token we minted | STRCx has ticked every ~15 days (Jun 30, Jul 15, Jul 31, Aug 14, Aug 30), so Aug 30 + 15d puts the next activation on **Mon 14 Sep, ~23:00 UTC**. Be live, armed and enrolled by **Sun 13 Sep EOD, hard stop Mon 14 Sep 22:00 UTC**, the crank must be observing the mint before activation or the tick is undetectable, and the plan must be enrolled before activation or delta is zero. QQQx around 20-30 Sep is a backup inside the judging window. | DT-1 |
| R2 | Scaled-vs-raw amount confusion moves the wrong quantity of a real security | Technical | CRITICAL | LOW | Real financial loss to a real holder | Solana's integration guide confirms transfer and delegate amounts are raw. Every amount in the codebase is suffixed `_raw`. The program recomputes delta itself and never trusts a caller amount. Unit test asserts delta against the four real historical AAPLx ticks. | DT-2 |
| R3 | Backed public API unavailable | Technical | MEDIUM | MEDIUM | Loss of tick reason, schedule and backfill history | On-chain mint state is authoritative for detection and delta. The API is enrichment. Degrade to on-chain-only and show a banner. | DT-3 |
| R4 | Jupiter unavailable, rate-limited, or no route | Technical | HIGH | MEDIUM | Increments collected but not converted; payouts stall | 60 rpm limit respected by design (one swap per mint per tick, not per user). On failure the increment stays put and retries next open; receipts show "pending settlement". | DT-4 |
| R5 | Solana RPC rate limits break the crank | Technical | HIGH | HIGH | Missed ticks, failed harvests | Paid RPC on day one. `getMultipleAccounts` batching. Public endpoint only for local development. | DT-5 |
| R6 | DexScreener unavailable | Technical | LOW | MEDIUM | Income-stocks list and floor valuation degrade | Fall back to a Jupiter quote for valuation. The list degrades to unsorted. Nothing on the critical path breaks. | DT-6 |
| R7 | The real tick fires while nothing is recording | Demo | HIGH | MEDIUM | A real harvest happens with no footage | Screen recording runs unattended from Sunday night. Every harvest writes a receipt on-chain, so the explorer link survives even if the video does not. | DT-7 |
| R8 | The Monday gate slips and mainnet is not live for the tick | Time | CRITICAL | MEDIUM | Cascades into R1 | Build order is harvest-path-first. Front door, bill routing, calendar and design all come after. Cut list is written before building starts. | DT-8 |
| R9 | A judge reads it as a feature, not an app | Judging | MEDIUM | MEDIUM | Scores lower on "a real app people will use" | The buy front door makes it a destination. The rules also say "pick one wedge and make it excellent", so a single mechanic is aligned with the rubric, not against it. | DT-9 |
| R10 | A judge argues reinvestment is good and cash is worse | Judging | MEDIUM | MEDIUM | The premise looks like a preference, not a problem | Lead with the tax liability, which is not a preference. Second argument is optionality: reinvesting into the same stock is a concentration decision made for you. | DT-10 |
| R11 | One of the 14 hidden submissions ships the same mechanic | Competitive | MEDIUM | LOW | Splits judge attention | Unmeasurable, so do not defend on novelty. Defend on a real mainnet harvest with an explorer link, which is hard to match in six days. | DT-11 |
| R12 | Scope creep through the front door or bill routing | Scope | HIGH | MEDIUM | The harvest path is late, cascading into R8 and R1 | Both are explicitly cuttable, and the cut order is written into the plan. No vault, no share accounting, no rebalancing. | DT-12 |
| R13 | Keeper trust: `settle` takes the payout amount from the keeper, so the keeper can under-pay, zero out `pending_raw`, or never settle. Sub-floor `accrued_usdc` sits in the keeper's own USDC account for months, not minutes. | Technical | **HIGH** | LOW | A judge reads `settle.rs`, finds the gap after hearing an absolute custody claim, and discounts the whole submission for overclaiming | State the bound that actually holds and name the gap first, before a judge finds it: the keeper can misroute a dividend, capped at 5% of position lifetime by the delegate, and can never touch the position. Receipt now carries the real (m0, m1, activation, delta) triple so any third party can recompute the correct payout. ARCHITECTURE.md Section 17 "What the bound actually is". | DT-13 |
| R14 | A submitted link dies before judging ends on 2 October | Demo | HIGH | MEDIUM | The submission becomes unscoreable two weeks after we stop watching | Deploy to a host with no cold sleep. Weekly link check to 2 Oct on the checklist. | DT-14 |

Six categories covered: Technical (R2, R3, R4, R5, R6, R13), Demo (R1, R7, R14), Time (R8), Judging (R9, R10), Competitive (R11), Scope (R12).

---

## Section 7.5: Judge Experience

**First-visit state.** A judge opening the live URL without a wallet sees real data immediately: the live corporate-action calendar for all 732 mints, the list of tradeable dividend payers with realised trailing growth, and a worked example of a real historical tick showing exactly what stokss would have paid on a $1,000 position. No connect-wallet wall, no empty state.

**Seed script.** `scripts/seed-demo.ts` populates the demo wallet: buys small positions in KOx, MCDx and STRCx through Jupiter, enrolls each with a capped delegate, and pre-computes the backfill. It uses **real mainnet purchases**, not fabricated state.

**Demo-insurance invariant check.** The product's claim is verifiability, so fabricated state is forbidden. Every number on screen traces to on-chain state or the issuer's public API. The seed script buys real tokens and the demo harvests a real tick. If no tick lands in the window, the fallback is a devnet mint **labelled as such on screen**, shown alongside real mainnet detection of a real tick. We never present a synthetic event as real.

**10-second test.** Hero line: "Tokenized stocks stopped paying dividends. stokss pays them." Under it, the live counter of dividends reinvested across the catalogue in the last 12 months.

**30-second test.** The calendar showing the next real corporate action with a countdown, and a worked payout example.

**60-second test.** Connect a wallet, see your own backfill number. That is the moment the problem becomes personal.

---

## Section 7.6: Judge Proof Artifacts

**Proof route:** `/proof`, linked from the footer and the README.

**Required artifacts**
- Program ID, linked to the explorer
- The harvest transaction signature for the real mainnet tick, linked
- The settle transaction signature, linked
- The mint address of the asset harvested, with its `scaledUiAmountConfig` at the time of the tick
- Before and after: raw balance, multiplier, scaled balance, USDC received
- Count of mints monitored and ticks detected during the run

**Proof generation.** `scripts/capture-proof.ts` runs after the first real harvest and writes `submission/proof.md` with every signature and address resolved to explorer links.

**Explorer pattern:** `https://solscan.io/tx/{signature}` and `https://solscan.io/account/{address}`.

---

## Section 8: Day-by-Day Build Plan

Today is Friday 18 September. The deadline is Friday 25 September 20:00 UTC (extended from 18 Sep). Six build days (Saturday 19 through Thursday 24) plus submission day.

| Day | Primary objective | Secondary | Deliverable |
|-----|------------------|-----------|-------------|
| **Sat 12 Sep** | Program skeleton: `Config`, `UserPlan`, `enroll`, `harvest` with real mint-extension parsing. Unit tests against the four real AAPLx ticks. | Paid RPC provisioned, keeper keypair funded, demo wallet funded | `anchor test` green on the delta math |
| **Sun 13 Sep** | `settle`, receipts, and the crank end to end on devnet with a mint we control. Fire a multiplier update with a future timestamp and watch the whole path run. | `xstocks-client` complete | Full path working on devnet |
| **Mon 14 Sep** | **GATE: deploy to mainnet, enroll a real KOx or STRCx position, arm the crank.** Screen recording starts and runs unattended. | Minimal UI: portfolio, backfill, enroll | Mainnet harvest path live before the STRCx window |
| **Tue 15 Sep** | Capture the real tick if it lands. Receipts feed and the calendar. | `/proof` route | A real harvest on mainnet, or a documented near-miss |
| **Wed 16 Sep** | Buy front door, bill routing, income-stocks list | Deploy to production hosting | Feature-complete |
| **Thu 17 Sep** | Design pass, demo recording, README | Link-survival check | Video cut |
| **Fri 25 Sep** | Submit by 14:00 UTC, then edit until close | Final link tests from incognito | Submitted |

**Buffer:** Wednesday is the buffer. If the harvest path slips past Monday, Wednesday's features are cut in this order: bill routing, then the buy front door, then the calendar.

---

## Section 9: Dependencies & Prerequisites

| Dependency | Type | Status | Needed by |
|---|---|---|---|
| Paid Solana RPC (Helius or Triton) | Service | **Not provisioned** | Sat 12 Sep |
| Funded **deploy authority** (mainnet, ~3.5 SOL, NOT the keeper) | Account | **Not funded** | **Sat 12 Sep, start first** |
| Funded keeper keypair (mainnet, ~0.5 SOL) | Account | **Not created** | Sat 12 Sep |
| Funded demo wallet (~$60 SOL + xStocks) | Account | **Not funded**, user confirmed they will | Sat 12 Sep |
| Devnet Token-2022 mint with scaled UI config | Test fixture | Created by `scripts/create-devnet-mint.ts` | Sun 13 Sep |
| Production hosting with no cold sleep | Service | Not chosen | Wed 16 Sep |
| Anchor 0.30.1, Rust 1.86, Node 25, pnpm, bun | Toolchain | **Verified installed** | now |
| `spl-token` CLI 5.4.0 with `update-ui-amount-multiplier` | Toolchain | **Verified installed** | Sun 13 Sep |

<!-- [CRITIQUE C-3 / C-7] Three rows said "Needed by Mon 14 Sep" while the Phase 0 gate in
     PLAN.md requires all of them funded before leaving Saturday. Two documents, two dates,
     for the prerequisites of the one deadline that matters. They are Saturday items. The
     deploy authority row was missing entirely here even after E-3 added Task 0.5, and it is
     the row with the longest lead time, so it goes first in both the table and the steps. -->
**Manual setup steps**
0. **Start first:** send ~4.5 SOL to mainnet (3.5 deploy authority, 0.5 keeper, the rest demo).
   Nothing else in Phase 0 takes more than minutes; this is the only step that can take hours,
   and it gates Monday's deploy.
1. Create and fund the keeper keypair, record its pubkey in `.env`
2. Create and fund the demo wallet, buy KOx / MCDx / STRCx through Jupiter
3. Obtain a paid RPC URL
4. `anchor deploy` to mainnet and record the program ID
5. Run `initialize_config` once with the keeper pubkey and the payout floor

---

## Section 10: Concerns Compliance

| Concern | Severity | How this PRD addresses it |
|---|:---:|---|
| Real mainnet tick harvested end to end with an explorer link | [C] | Demo Scene 5 and Section 7.6. The whole build order in Section 8 exists to make the Monday gate. |
| Mainnet harvest path live, armed and enrolled by Sun 13 Sep EOD (hard stop Mon 14 Sep 22:00 UTC) | [C] | Section 8 makes Monday 14 Sep the gate day and names what gets cut to protect it. R8 and DT-8. <!-- [CRITIQUE E-2] date corrected: "Monday 15 Sep" is a Tuesday. --> |
| Program provably cannot move more than the increment | [C] | Holds for the harvest leg: Section 4.1, delta recomputed on-chain, no caller amount, capped delegate, **and since the critique pass an on-chain ceiling of `m1 <= m0 * 1.02` so a forward split or administrative correction cannot be harvested as if it were a dividend** (ARCHITECTURE.md Section 6 and Section 17 Layer 5). Before that ceiling, "only the increment" was enforced only in direction, not magnitude, and any non-dividend bump up to 5.26% would have executed in full. **Does NOT hold for settle**, which takes the payout amount from the keeper, stated openly in ARCHITECTURE.md Section 17 "What the bound actually is" and in Scene 3 rather than claimed away. The bound that does hold: the keeper can misroute a dividend, capped at 5% of position by the delegate; it can never move the position. R13, DT-13 point 2b. |
| Every link resolves on 2 October | [C] | Section 9 requires hosting with no cold sleep. R14 and DT-14. The submission checklist has a weekly link check. |
| Delta computed in RAW units | [C] | Section 4.1 and Section 5 A2 both state raw. R2 mitigation includes a unit test against four real historical ticks. |
| Accrual floor and cross-user batching | [I] | Section 4.4: one swap per mint per tick, not per user. Section 3 F4 step 2 holds below the floor. |
| Lead with the tax liability | [I] | Section 1 problem statement and Demo Scene 1 both open on tax, not yield. R10. |
| Front door and bill routing are cuttable | [I] | Section 8 buffer paragraph names the cut order explicitly. R12. |
| Design polish is secondary to a working harvest | [A] | Section 8 puts the design pass on Thursday, after the harvest is proven. |
| Do not promise the 309 illiquid payers | [A] | Section 3 F6 lists only payers with real liquidity. Section 4.8 exposes liquidity so the UI can filter. |

All five [C] concerns are addressed. Two [I] and two [A] concerns are addressed.
