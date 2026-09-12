# stokss: Implementation Plan

**Version:** 1.0
**Date:** 2026-09-12
**Architecture:** `ARCHITECTURE.md`, copy code from it exactly, do not rewrite from memory
**PRD:** `PRD.md`, product context and the risk register the decision trees below come from

---

## Section 1: Plan Metadata

| Field | Value |
|---|---|
| Deadline | 2026-09-18 20:00 UTC |
| Build days | 6 (Sat 12 through Thu 17). Friday is submission day. |
| Total estimated | 5.75 days |
| Binding internal gate | **Mainnet harvest path live by end of Monday 15 Sep** |
| Why that gate | STRCx has ticked every ~15 days (Jun 30, Jul 15, Jul 31, Aug 14, Aug 30). Next expected 14-15 Sep, with $335k liquidity. Capturing that real tick is the primary demo objective. |

### How to use this plan

Work top to bottom. Every task names the files it creates and the `ARCHITECTURE.md` section to copy from. Run the exact command given and compare against the expected output. Do not proceed past a phase gate with an unchecked box.

When something fails, find the decision tree for it rather than improvising. The trees exist because these are the failures that were predicted.

### Cut order, decided now rather than at 2am on Thursday

1. Bill routing (Phase 8)
2. Buy front door (Phase 8)
3. Calendar and income-stocks routes (Phase 7)
4. Design pass (Phase 9)

**Never cut:** Phases 1 through 5. That is the mechanic and the mainnet gate.

---

## Section 2: Phase Overview

| Phase | Purpose | Est. | Depends on | Day |
|:---:|---|:---:|---|---|
| 0 | Environment and accounts | 0.25d | none | Sat |
| 1 | Delta math and program state | 0.75d | 0 | Sat |
| 2 | Program instructions complete | 0.5d | 1 | Sun |
| 3 | Crank | 0.75d | 2 | Sun |
| 4 | Devnet rehearsal, full path | 0.25d | 3 | Sun |
| 5 | **MAINNET GATE** | 0.5d | 4 | Mon |
| 6 | Web app: the problem screen | 1.0d | 2 | Mon-Tue |
| 7 | Capture the real tick, proof route | 0.25d | 5 | Tue |
| 8 | Buy front door and bill routing | 0.5d | 6 | Wed |
| 9 | Design pass and demo recording | 0.75d | 7, 8 | Thu |
| 10 | Submit | 0.25d | 9 | Fri |

---

## Phase 0: Environment and accounts (0.25d)

### Task 0.1: Create the repository skeleton

Files: `Anchor.toml`, `Cargo.toml`, `programs/stokss/Cargo.toml`
Copy from: ARCHITECTURE.md Section 4.

```bash
cd /Users/machine/Desktop/dev/stokss
anchor init --no-git --template single stokss-program-tmp && rm -rf stokss-program-tmp
mkdir -p programs/stokss/src/instructions tests crank/src web/app/api web/components web/lib scripts
```

Then write the three files verbatim from Section 4.

Expected: `ls programs/stokss/src` prints an empty directory, and `cat Anchor.toml` shows the `[toolchain] anchor_version = "0.30.1"` block.

Commit: `chore: repository skeleton and Anchor workspace`

### Task 0.2: Generate and fund the keeper

Copy from: ARCHITECTURE.md Section 21, Credentials Needed row `KEEPER_KEYPAIR_PATH`.


```bash
solana-keygen new --no-bip39-passphrase -o keeper.json
solana address -k keeper.json
solana balance -k keeper.json --url mainnet-beta
```

Expected: an address printed, balance `0 SOL`. Send 0.5 SOL to that address, then re-run the balance command and confirm `0.5 SOL`.

Commit: `chore: keeper keypair generated (public key recorded in .env.example)`

### Task 0.3: Provision a paid RPC and write the local variable file

Files: `.env.example` (already written), plus a local copy.
Copy from: ARCHITECTURE.md Section 21.

```bash
cp .env.example .env
# then edit .env: paste the Helius or Triton URL into SOLANA_RPC_URL
curl -s -X POST "$(grep '^SOLANA_RPC_URL=' .env | cut -d= -f2-)" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Expected: `{"jsonrpc":"2.0","result":"ok","id":1}`

**Do not skip this for the public endpoint.** See DT-5.

Commit: `chore: credentials manifest`

### Task 0.4: Fund the demo wallet

Copy from: ARCHITECTURE.md Section 21, Credentials Needed row `DEMO_KEYPAIR_PATH`.


```bash
solana-keygen new --no-bip39-passphrase -o demo.json
solana address -k demo.json
```

Expected: an address. Send ~$60 of SOL to it. Do not buy the xStocks yet; that is Task 5.4, after the program is deployed.

Commit: `chore: demo wallet generated`

### Phase 0 gate

- [ ] `anchor --version` prints `anchor-cli 0.30.1`
- [ ] `solana balance -k keeper.json --url mainnet-beta` shows at least 0.4 SOL
- [ ] The `getHealth` curl against the paid RPC returns `"ok"`
- [ ] The demo wallet holds at least $50 of SOL
- [ ] `.env` exists and is listed in `.gitignore`

---

## Phase 1: Delta math and program state (0.75d)

This phase exists first because `scaled_ui.rs` is the highest-consequence code in the project and it is pure arithmetic. Everything else depends on it being right.

### Task 1.1: The TLV parser and the delta formula

Files: `programs/stokss/src/scaled_ui.rs`
Copy from: ARCHITECTURE.md Section 6, complete file including the `#[cfg(test)]` module.

```bash
cargo test -p stokss --lib scaled_ui
```

Expected:
```
running 4 tests
test scaled_ui::tests::delta_preserves_scaled_exposure ... ok
test scaled_ui::tests::no_tick_means_no_delta ... ok
test scaled_ui::tests::reverse_split_is_rejected ... ok
test scaled_ui::tests::zero_balance_is_zero_delta ... ok
```

If any test fails, stop. Nothing downstream is worth building on a broken delta.

Commit: `feat(program): scaled UI amount TLV parser and delta formula`

### Task 1.2: Prove the parser against a real mainnet mint

Files: none new; extends the test module in `programs/stokss/src/scaled_ui.rs`.
Copy from: ARCHITECTURE.md Section 3, the verified layout table.

```bash
solana account XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp \
  --url mainnet-beta --output json | jq -r '.account.data[0]' | base64 -d > /tmp/aaplx.bin
ls -l /tmp/aaplx.bin
```

Expected: a 678-byte file. Add a test that loads those bytes and asserts `parse_scaled_ui` returns a multiplier of `1.0026642075893797` and a new multiplier of `1.0032690125398187`, matching ARCHITECTURE.md Section 3.

```bash
cargo test -p stokss --lib scaled_ui
```

Expected: 5 tests pass.

Commit: `test(program): parser verified against the live AAPLx mint fixture`

### Task 1.3: State, errors, events

Files: `programs/stokss/src/state.rs`, `programs/stokss/src/errors.rs`, `programs/stokss/src/events.rs`
Copy from: ARCHITECTURE.md Sections 5 (state, errors, events).

```bash
cargo build -p stokss
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)` with no errors.

Commit: `feat(program): account state, error codes and events`

### Decision Point DT-2: the delta math is wrong (PRD risk R2, CRITICAL)

Run: `cargo test -p stokss --lib scaled_ui`
Expected: all tests pass.

**If it works:** continue to Task 1.3.

**If `delta_preserves_scaled_exposure` fails with `after < before`:**
1. You are rounding up somewhere. `compute_delta_raw` must use `.floor()`, never `.round()` or `.ceil()`.
2. Check the ratio direction: it is `1.0 - (m0 / m1)`, not `1.0 - (m1 / m0)`.
3. Re-run. If still failing, print `delta`, `before` and `after` for the AAPLx case and compare against the worked example in ARCHITECTURE.md Section 3 (`602_956` for a 10.0 position).

**If `reverse_split_is_rejected` fails:**
1. The `require!(m1 >= m0, MultiplierDecreased)` guard is missing or inverted.
2. Re-run.

**If nothing works:**
1. Delete the f64 path and compute in fixed point: scale both multipliers by `1e12`, do the arithmetic in `u128`, then divide.
2. Verify the same five real AAPLx ticks give the same answers to within one raw unit.
3. Continue from Task 1.3 with the fixed-point version.

### Phase 1 gate

- [ ] `cargo test -p stokss --lib scaled_ui` passes 5 of 5
- [ ] The parser returns the exact multipliers from ARCHITECTURE.md Section 3 for the real AAPLx fixture
- [ ] `cargo build -p stokss` is clean
- [ ] [C] concern "delta computed in RAW units" is verified by a passing test, not by inspection

---

## Phase 2: Program instructions (0.5d)

### Task 2.1: Entry point and module wiring

Files: `programs/stokss/src/lib.rs`, `programs/stokss/src/instructions/mod.rs`
Copy from: ARCHITECTURE.md Section 7.

```bash
anchor keys sync && anchor build
```

Expected: `anchor keys sync` prints the real program ID and rewrites `declare_id!`. Record that ID in `.env` under `STOKSS_PROGRAM_ID` and `NEXT_PUBLIC_STOKSS_PROGRAM_ID`.

Commit: `feat(program): entry point and instruction modules`

### Task 2.2: initialize_config and enroll

Files: `programs/stokss/src/instructions/initialize_config.rs`, `programs/stokss/src/instructions/enroll.rs`
Copy from: ARCHITECTURE.md Sections 8 and 9.

```bash
anchor build
```

Expected: build succeeds and `target/idl/stokss.json` contains `initializeConfig` and `enroll`.

```bash
jq -r '.instructions[].name' target/idl/stokss.json
```

Expected output includes `initializeConfig`, `enroll`.

Commit: `feat(program): initialize_config and enroll with multiplier snapshot`

### Task 2.3: harvest

Files: `programs/stokss/src/instructions/harvest.rs`
Copy from: ARCHITECTURE.md Section 10, complete file.

```bash
anchor build
jq -r '.instructions[] | select(.name=="harvest") | .accounts[].name' target/idl/stokss.json
```

Expected: `keeper`, `config`, `plan`, `mint`, `mintRaw`, `holderAta`, `collectionAta`, `harvestAuthority`, `tokenProgram`.

Commit: `feat(program): harvest computes delta on-chain and moves only the increment`

### Task 2.4: settle and close_plan

Files: `programs/stokss/src/instructions/settle.rs`, `programs/stokss/src/instructions/close_plan.rs`
Copy from: ARCHITECTURE.md Sections 11 and 12.

```bash
anchor build && jq -r '.instructions[].name' target/idl/stokss.json
```

Expected: six instructions listed.

Commit: `feat(program): settle with accrual floor, and holder-controlled close`

### Task 2.5: The TypeScript delta test

Files: `tests/delta.test.ts`
Copy from: ARCHITECTURE.md Section 13, complete file.

```bash
anchor test --skip-deploy 2>&1 | tail -20
```

Expected: 5 passing tests under "delta math against real AAPLx ticks".

Commit: `test: delta math cross-checked against five real AAPLx ticks`

### Decision Point DT-15: `anchor build` fails on the Token-2022 interface

Run: `anchor build`
Expected: clean build.

**If it works:** continue to Task 2.4.

**If you get `unresolved import anchor_spl::token_interface`:**
1. Confirm `anchor-spl` has the `token_2022` feature in `programs/stokss/Cargo.toml` (ARCHITECTURE.md Section 4).
2. `cargo clean && anchor build`.

**If you get an error mentioning `scaled_ui_amount` or a missing extension module:**
1. You are importing the typed extension API. Do not. ARCHITECTURE.md Section 6 exists precisely to avoid this: the parser reads raw bytes and depends on no `spl-token-2022` module.
2. Remove any `use spl_token_2022::extension::...` line.
3. `anchor build`.

**If nothing works:**
1. Replace `InterfaceAccount<'info, TokenAccount>` with `UncheckedAccount` and parse the amount from bytes 64..72 of the token account, which is the standard SPL layout.
2. Add explicit owner and mint checks in the handler since Anchor is no longer doing them.
3. Continue from Task 2.4.

### Phase 2 gate

- [ ] `anchor build` clean
- [ ] `target/idl/stokss.json` lists all six instructions
- [ ] `anchor test --skip-deploy` passes the delta suite
- [ ] Program ID recorded in `.env` in both variables
- [ ] `harvest` takes no amount argument anywhere in the IDL

---

## Phase 3: Crank (0.75d)

### Task 3.1: Crank package and configuration

Files: `crank/package.json`, `crank/src/config.ts`
Copy from: ARCHITECTURE.md Section 14.

```bash
cd crank && pnpm install && pnpm exec tsc --noEmit
```

Expected: install completes, `tsc` reports no errors.

Commit: `feat(crank): package manifest and configuration`

### Task 3.2: The TypeScript twin of the parser

Files: `crank/src/scaled-ui.ts`
Copy from: ARCHITECTURE.md Section 14.

Verify the twin agrees with the Rust by running it against the same live mint:

```bash
cd crank && pnpm exec tsx -e "
import {parseScaledUi} from './src/scaled-ui.js';
const r = await fetch(process.env.SOLANA_RPC_URL!, {method:'POST',headers:{'Content-Type':'application/json'},
  body: JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',
  params:['XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',{encoding:'base64'}]})});
const d = await r.json();
console.log(parseScaledUi(Buffer.from(d.result.value.data[0],'base64')));
"
```

Expected: `{ multiplier: 1.0026642075893797, effectiveTs: 1786149000, newMultiplier: 1.0032690125398187 }`, exactly matching ARCHITECTURE.md Section 3.

Commit: `feat(crank): scaled UI parser, verified identical to the Rust implementation`

### Task 3.3: Issuer API client

Files: `crank/src/xstocks-client.ts`
Copy from: ARCHITECTURE.md Section 14.

```bash
curl -s "https://api.backed.fi/api/v2/public/assets/KOx/multiplier/history?network=Solana" | jq '.nodes[0]'
```

Expected: an object with `reason: "Dividend"`, `multiplier`, `previousMultiplier`, `activationDateTime`.

Commit: `feat(crank): issuer API and DexScreener client`

### Task 3.4: Market clock and queue store

Files: `crank/src/market-clock.ts`, `crank/src/db.ts`
Copy from: ARCHITECTURE.md Section 14.

```bash
cd crank && pnpm exec tsx -e "
import {marketState} from './src/market-clock.js';
console.log(await marketState());
"
```

Expected on a weekend: `{ open: false, source: 'issuer', nextOpen: <Date> }`.

Commit: `feat(crank): market clock with issuer signal and calendar fallback`

### Task 3.5: Tick watcher

Files: `crank/src/tick-watcher.ts`
Copy from: ARCHITECTURE.md Section 14.

Commit: `feat(crank): tick watcher with on-chain detection and reason cross-check`

### Task 3.6: Harvest executor and settlement engine

Files: `crank/src/harvest-executor.ts`, `crank/src/settlement-engine.ts`, `crank/src/index.ts`
Copy from: ARCHITECTURE.md Section 14.

```bash
cd crank && pnpm exec tsc --noEmit && pnpm start -- --once
```

Expected: `[crank] keeper <pubkey> program <id>` then `[crank] no enrolled plans`.

Commit: `feat(crank): harvest executor, settlement engine and main loop`

### Decision Point DT-5: RPC rate limits break the crank (PRD risk R5, HIGH)

Run: `cd crank && pnpm start -- --once`
Expected: completes without a 429.

**If it works:** continue to Phase 4.

**If you see `429 Too Many Requests`:**
1. You are on the public endpoint. Check: `grep SOLANA_RPC_URL .env` must not contain `api.mainnet-beta.solana.com`.
2. Paste the paid URL, re-run.

**If you still see 429 on a paid endpoint:**
1. Raise `tickPollIntervalMs` from 30000 to 60000 in `crank/src/config.ts`.
2. Confirm `getMultipleAccountsInfo` is batching: one call per 100 mints, not one per mint.
3. Re-run.

**If nothing works:**
1. Drop to a single watched mint (the demo asset) by filtering the enrolled list.
2. The demo needs one mint to tick, not all of them. Continue from Phase 4.

### Decision Point DT-4: Jupiter is unavailable or has no route (PRD risk R4, HIGH)

Run:
```bash
curl -s "https://lite-api.jup.ag/swap/v1/quote?inputMint=XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=300" | jq '{outAmount, swapUsdValue}'
```
Expected: a non-null `outAmount` and a `swapUsdValue` near 3.33.

**If it works:** continue.

**If you get HTTP 429:** raise `jupiterMinIntervalMs` to 3000 and retry. The limit is roughly 60 requests a minute.

**If you get `NO_ROUTES_FOUND`:**
1. The amount is likely too small for that mint's pools. Quotes were verified working down to 10 raw units on AAPLx, but a thinner mint will fail earlier.
2. Raise `MIN_SWAP_USD` so aggregates accrue further before a swap is attempted.
3. Retry with a larger amount.

**If nothing works:**
1. Leave the increment in the collection account. `pending_raw` is on-chain, so nothing is lost.
2. Show "pending settlement" in the receipts feed.
3. Settle manually through the Jupiter web app before recording the demo, and note it as a manual step in the demo script.

### Phase 3 gate

- [ ] `pnpm exec tsc --noEmit` clean in `crank/`
- [ ] The TypeScript parser returns byte-identical multipliers to the Rust one on the same mint
- [ ] `pnpm start -- --once` runs to completion with no 429
- [ ] The market clock reports `source: "issuer"`, not the calendar fallback

---

## Phase 4: Devnet rehearsal (0.25d)

This is the last cheap place to find a bug. Everything after this involves real money.

### Task 4.1: Create the devnet fixture mint

Files: `scripts/create-devnet-mint.ts`
Copy from: ARCHITECTURE.md Section 16.

```bash
npx tsx scripts/create-devnet-mint.ts
```

Expected: a mint address, and the printed command for firing a tick.

Commit: `feat(scripts): devnet Token-2022 fixture mint with scaled UI amount`

### Task 4.2: Deploy and initialise on devnet

Copy from: ARCHITECTURE.md Section 24, rows 1 and 3.


```bash
anchor deploy --provider.cluster devnet
solana program show $(grep '^STOKSS_PROGRAM_ID=' .env | cut -d= -f2-) --url devnet
```

Expected: the program shows as deployed with a non-zero data length.

Commit: `chore: devnet deployment`

### Task 4.3: Enroll and fire a real tick

Copy from: ARCHITECTURE.md Section 24 row 2, and Section 10 for what harvest verifies.


```bash
# Enroll the devnet position through the program, then:
spl-token update-ui-amount-multiplier <FIXTURE_MINT> 1.0055 $(( $(date +%s) + 60 )) --url devnet
sleep 70
cd crank && pnpm start -- --once
```

Expected log sequence:
```
[tick-watcher] <symbol> Unknown 1 -> 1.0055 effective <ts> state=skipped
```

Note: on devnet the issuer API has no record of your fixture mint, so `reason` is `Unknown` and the tick is skipped by design. For the rehearsal only, temporarily treat `Unknown` as `Dividend` in `tick-watcher.ts`, then revert before mainnet.

Expected after that change: `state=queued`, then `[harvest] … batch of 1 -> <sig>`, then `[settle] …`.

Commit: `test: full harvest path exercised on devnet`

### Phase 4 gate

- [ ] A devnet tick was detected by the watcher
- [ ] `harvest` moved a non-zero delta and the transaction confirmed
- [ ] The holder's scaled balance after the harvest equals the scaled balance before it, to within one raw unit
- [ ] `settle` produced a receipt account
- [ ] **The `Unknown` to `Dividend` rehearsal hack is reverted** and the diff is clean

---

## Phase 5: MAINNET GATE (0.5d, Monday)

Everything before this was preparation. This is the deadline that matters.

### Task 5.1: Deploy to mainnet

Copy from: ARCHITECTURE.md Section 24, row 5.


```bash
solana balance --url mainnet-beta
anchor deploy --provider.cluster mainnet
solana program show $(grep '^STOKSS_PROGRAM_ID=' .env | cut -d= -f2-)
```

Expected: at least 3 SOL before deploying; the program shows deployed afterwards.

Commit: `chore: mainnet deployment`

### Task 5.2: Initialise config on mainnet

Copy from: ARCHITECTURE.md Section 24 row 6, and Section 8 for the config fields.


```bash
anchor run init-config --provider.cluster mainnet
```

Expected: a config account with the keeper pubkey and `payout_floor_usdc = 1000000`.

Commit: `chore: mainnet config initialised`

### Task 5.3: Buy the real demo positions

Files: `scripts/seed-demo.ts`
Copy from: ARCHITECTURE.md Section 16.

```bash
npx tsx scripts/seed-demo.ts
```

Expected: three Solscan links, one each for STRCx, KOx and MCDx.

Commit: `feat(scripts): seed real mainnet demo positions`

### Task 5.4: Enroll STRCx and arm the crank

Copy from: ARCHITECTURE.md Section 24, row 8.


```bash
# Enroll through the web app or a direct client call, then:
cd crank && pnpm start 2>&1 | tee ../crank-mainnet.log
```

Expected: `[crank] keeper … program …` followed by `[tick-watcher] STRCx …` lines every 30 seconds.

Leave this running. Start the screen recording now and leave it running unattended.

Commit: `chore: mainnet crank armed ahead of the STRCx window`

### Decision Point DT-8: the Monday gate is going to slip (PRD risk R8, CRITICAL)

Check at 18:00 UTC Monday: is `[tick-watcher] STRCx` appearing in the log?

**If yes:** the gate is met. Continue to Phase 6.

**If the program is not deployed yet:**
1. Stop all web work immediately. Phase 6 is not on the critical path.
2. Deploy with the minimum: `initialize_config`, `enroll`, `harvest`, `settle`. Skip `close_plan`; it can ship Tuesday.
3. Enroll by direct script rather than through the UI.

**If the program is deployed but enrollment is failing:**
1. Enroll from a script using the IDL directly, bypassing the wallet adapter entirely.
2. The demo can show enrollment from the UI later; the tick cannot wait.

**If nothing works by 23:00 UTC Monday:**
1. Accept that the STRCx window may be missed and switch the primary demo to the devnet rig.
2. Keep the mainnet crank running anyway. QQQx is expected around 20-30 Sep, inside the judging window, and a real harvest captured then can be added to the README as evidence even after submission.
3. Continue from Phase 6 with the devnet demo as primary.

### Decision Point DT-1: no real tick lands before the deadline (PRD risk R1, CRITICAL)

Check Wednesday morning: did any enrolled mint tick?

**If yes:** run Phase 7 immediately and make it the centre of the demo.

**If no tick yet:**
1. Check the issuer's schedule for anything landing before Friday:
   `for s in STRCx QQQx KOx MCDx XOMx UNHx; do curl -s "https://api.backed.fi/api/v2/public/assets/$s/multiplier/history?network=Solana" | jq -r --arg s "$s" '.nodes[0] | "\($s) \(.activationDateTime) \(.reason)"'; done`
2. If any of those show an activation date in the next 48 hours, enroll that asset too and buy a small position.

**If nothing is scheduled before Friday:**
1. The demo leads with the devnet harvest, clearly labelled as devnet on screen.
2. Alongside it, show mainnet detection of a real tick on any asset in the catalogue, even one we do not hold. Detection on mainnet plus execution on devnet is an honest split and still shows the whole mechanic.
3. Never present a devnet event as a mainnet one. That would break the invariant the product is built on.

### Phase 5 gate

- [ ] Program deployed to mainnet and visible in the explorer
- [ ] Config initialised with the correct keeper
- [ ] Real STRCx, KOx and MCDx positions held by the demo wallet, with Solscan links recorded
- [ ] At least one plan enrolled on mainnet with a capped delegate visible on the token account
- [ ] The crank is running and logging tick-watcher lines
- [ ] Screen recording is running unattended

---

## Phase 6: Web app, the problem screen (1.0d)

### Task 6.1: Web package and the shared library

Files: `web/package.json`, `web/lib/xstocks.ts`
Copy from: ARCHITECTURE.md Section 15.

```bash
cd web && pnpm install && pnpm exec tsc --noEmit
```

Expected: clean.

Commit: `feat(web): package manifest and shared xStocks library`

### Task 6.2: Portfolio and backfill routes

Files: `web/app/api/portfolio/route.ts`, `web/app/api/backfill/route.ts`
Copy from: ARCHITECTURE.md Section 15.

```bash
cd web && pnpm dev &
sleep 5
curl -s "http://localhost:3000/api/portfolio?owner=$(solana address -k ../demo.json)" | jq '.holdings[0]'
```

Expected: a holding with `symbol`, `rawAmount`, `multiplier`, `scaledAmount` and a non-null `valueUsd`.

```bash
curl -s "http://localhost:3000/api/backfill?symbol=KOx&rawAmount=100000000&price=89.28&decimals=8" | jq '{tickCount, totalUsd}'
```

Expected: `tickCount` of 4 and a positive `totalUsd`, matching KOx's four real dividend ticks.

Commit: `feat(web): portfolio and backfill routes`

### Task 6.3: The landing page and enrollment

Files: `web/app/page.tsx`, `web/components/EnrollPanel.tsx`
Copy from: ARCHITECTURE.md Section 15.

```bash
curl -s http://localhost:3000 | grep -c "stokss pays them"
```

Expected: `1`.

Commit: `feat(web): landing page and enrollment panel`

### Phase 6 gate

- [ ] `/api/portfolio` returns the real demo wallet holdings with correct scaled balances
- [ ] `/api/backfill` returns KOx's four real ticks
- [ ] The landing page renders real calendar data without a wallet connected
- [ ] Enrollment produces a capped delegate visible with `spl-token display`

---

## Phase 7: Capture the tick and build proof (0.25d)

### Task 7.1: Calendar, income stocks, receipts

Files: `web/app/api/calendar/route.ts`, `web/app/api/income-stocks/route.ts`, `web/app/api/receipts/route.ts`
Copy from: ARCHITECTURE.md Section 15.

```bash
curl -s http://localhost:3000/api/calendar | jq '{upcoming: (.upcoming|length), recent: (.recent|length)}'
curl -s http://localhost:3000/api/income-stocks | jq '.rows[0]'
```

Expected: a non-empty `recent` array, and an income-stocks row with `realisedGrowth12mPct` and `liquidityUsd`.

Commit: `feat(web): calendar, income stocks and receipts routes`

### Task 7.2: Capture proof from the real harvest

Files: `scripts/capture-proof.ts`
Copy from: ARCHITECTURE.md Section 16.

```bash
npx tsx scripts/capture-proof.ts <PROGRAM_ID> <MINT> <HARVEST_SIG> <SETTLE_SIG> <OWNER>
cat submission/proof.md
```

Expected: a markdown file with five explorer links and the multiplier values at the time of the tick.

Commit: `feat(scripts): proof capture for the submission`

### Decision Point DT-7: the tick fired but nothing was recording (PRD risk R7, HIGH)

**If the screen recording captured it:** use the footage.

**If it fired unrecorded:**
1. The receipt is on-chain and permanent. Run `capture-proof.ts` against the real signatures.
2. Re-stage the walkthrough on the devnet rig for the video, and cut to the real mainnet explorer links for the settlement moment. Say in the voiceover that the on-screen harvest is a replay and the linked transaction is the real one.
3. Never imply the recording is live when it is a replay.

### Phase 7 gate

- [ ] `submission/proof.md` exists with real transaction signatures
- [ ] Every link in it resolves
- [ ] The receipts route returns the plan for the demo wallet

---

## Phase 8: Buy front door and bill routing (0.5d): FIRST TO CUT

### Task 8.1: Buy front door

Files: extends `web/components/EnrollPanel.tsx` and `web/app/api/income-stocks/route.ts`
Copy from: ARCHITECTURE.md Section 15.

Add a Jupiter swap widget over the income-stocks list, then offer enrollment on success.

```bash
curl -s http://localhost:3000/api/income-stocks | jq '.rows | length'
```

Expected: between 5 and 20 rows, all with liquidity above $1000.

Commit: `feat(web): buy front door over the tradeable dividend payers`

### Task 8.2: Bill routing

Files: extends `programs/stokss/src/instructions/settle.rs` usage; no new program code, the `PayoutMode::Bill` branch already exists.
Copy from: ARCHITECTURE.md Section 11.

Point a plan's destination at a recurring-payment authority instead of the holder's own USDC account.

Commit: `feat: route a plan's payout to a bill instead of the wallet`

### Decision Point DT-12: scope creep is threatening the demo (PRD risk R12, HIGH)

Check Wednesday 18:00 UTC: is the demo recordable end to end today?

**If yes:** finish Phase 8.

**If no:** cut in this order, and stop as soon as the demo is recordable: bill routing, then the buy front door, then the calendar route. Commit the cut explicitly: `chore: cut bill routing to protect the demo path`.

### Phase 8 gate

- [ ] The demo is recordable end to end regardless of which optional features shipped
- [ ] Anything cut is recorded in a commit message, not silently dropped

---

## Phase 9: Design pass and demo (0.75d)

### Task 9.1: Design pass

Files: `web/app/page.tsx`, `web/components/EnrollPanel.tsx`
Copy from: PRD Section 7.5 for the 10, 30 and 60 second tests.

Do not restructure. Typography, spacing, one accent colour, and a real empty state.

```bash
cd web && pnpm build
```

Expected: build succeeds with no type errors.

Commit: `style(web): design pass on the landing and enrollment screens`

### Task 9.2: Deploy to production hosting

Copy from: ARCHITECTURE.md Section 24, row 9.


```bash
cd web && pnpm build && pnpm start &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/calendar
```

Expected: `200`. Then deploy to a host with no cold sleep and repeat the check against the public URL.

Commit: `chore: production deployment`

### Task 9.3: Record the demo

Copy from: PRD Section 6, all eight scenes.

Expected: a video of about 3 minutes 30 seconds, every scene mapping to a user flow.

Commit: `docs: demo script and recording notes`

### Decision Point DT-14: the deployment will not survive to 2 October (PRD risk R14, HIGH)

Run: `curl -s -o /dev/null -w "%{http_code}" <PUBLIC_URL>` after leaving the site untouched for two hours.

**If 200:** fine.

**If it takes more than 5 seconds to respond:** the host is cold-sleeping. Move to a host that does not, or add an uptime pinger every 10 minutes.

**If nothing works:** make the GitHub repo and the video the primary submission links, with the live URL as a third link. A dead third link is survivable; a dead only link is not.

### Phase 9 gate

- [ ] `pnpm build` clean
- [ ] The public URL returns 200 from an incognito window
- [ ] The video plays without login
- [ ] The video shows a real mainnet transaction, or explicitly labels devnet where it is used

---

## Phase 10: Submit (0.25d, Friday)

### Task 10.1: Submit by 14:00 UTC

Copy from: `SUBMISSION-CHECKLIST.md`.

- Set the account username on hackathons.solana.com
- Submit with all three links: GitHub, live URL, video
- Status must read SUBMITTED, not draft
- Screenshot the submitted state

Commit: `docs: submission links and disclosures`

### Task 10.2: T-2 hours and T-30 minutes checks

```bash
curl -s -o /dev/null -w "%{http_code}\n" <PUBLIC_URL>
curl -s -o /dev/null -w "%{http_code}\n" <VIDEO_URL>
curl -s -o /dev/null -w "%{http_code}\n" <REPO_URL>
```

Expected: `200` three times, from an incognito session.

At T-30 minutes: code freeze. No changes.

### Phase 10 gate

- [ ] Submitted before 20:00 UTC with status SUBMITTED
- [ ] All three links return 200 from incognito
- [ ] `submission/disclosures.md` names the keeper trust model, SolanaRWA, and the issuer's permanent delegate and pause authority
- [ ] Screenshot of the submitted state saved

---

## Section 4: Decision Tree Index

| Tree | Covers | PRD risk | Severity | Phase |
|---|---|---|:---:|:---:|
| DT-1 | No real tick before the deadline | R1 | CRITICAL | 5 |
| DT-2 | Delta math wrong | R2 | CRITICAL | 1 |
| DT-4 | Jupiter unavailable or no route | R4 | HIGH | 3 |
| DT-5 | RPC rate limits | R5 | HIGH | 3 |
| DT-7 | Tick fired unrecorded | R7 | HIGH | 7 |
| DT-8 | Monday gate slipping | R8 | CRITICAL | 5 |
| DT-12 | Scope creep | R12 | HIGH | 8 |
| DT-14 | Deployment does not survive to 2 Oct | R14 | HIGH | 9 |
| DT-15 | Anchor build fails on Token-2022 | build risk | HIGH | 2 |

Nine trees against eight CRITICAL and HIGH risks in the PRD register.

---

## Section 5: Concerns Verification Map

Every [C] concern from `concerns.md` has a phase gate that verifies it.

| Concern | Verified at |
|---|---|
| Real mainnet tick harvested end to end | Phase 7 gate: `submission/proof.md` exists with real signatures that resolve |
| Mainnet harvest path live by end of Monday | Phase 5 gate: crank logging tick-watcher lines on mainnet |
| Program cannot move more than the increment | Phase 2 gate: `harvest` takes no amount argument in the IDL. Phase 6 gate: capped delegate visible in `spl-token display` |
| Links resolve on 2 October | Phase 9 gate and Phase 10 Task 10.2, plus the weekly check in `SUBMISSION-CHECKLIST.md` |
| Delta computed in RAW units | Phase 1 gate: five passing tests against real AAPLx ticks |
