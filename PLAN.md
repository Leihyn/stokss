# stokss: Implementation Plan

**Version:** 1.0
**Date:** 2026-09-12
**Architecture:** `ARCHITECTURE.md`, copy code from it exactly, do not rewrite from memory
**PRD:** `PRD.md`, product context and the risk register the decision trees below come from

---

> **CLOCK AMENDMENT, 18 Sep 2026.** The deadline moved from 18 Sep to **25 Sep 2026,
> 20:00 UTC** (4:00pm ET), verified against the live hackathon page. The Section 1 metadata
> below is current. Every *other* date further down this document was keyed to the 18 Sep
> deadline and is **SUPERSEDED**, including the "Mon 14 Sep 22:00 UTC" binding gate and the
> whole Phase 5 schedule. Do not follow them.
>
> Superseding facts, verified 18 Sep:
> - The Mon 14 Sep gate was **missed**. STRCx ticked 15 Sep 00:30 UTC (+0.5055%) with the
>   crank unarmed. KOx (+0.4152%, 15 Sep) and TSMx (+0.2114%, 16 Sep) also fired.
> - `enroll` snapshots `m0`; `harvest` recomputes against live `m1`. So **enrollment before a
>   tick is the only hard deadline. The harvest itself can run days later** with identical
>   math. Re-plan around enrollment timing, not harvest timing.
> - No **scheduled** future multiplier events exist on-chain right now for any watched mint:
>   every `newMultiplierEffectiveTimestamp` is in the past. The issuer sets the pending slot
>   only shortly before activation, so continuous detection is required to catch it.
> - In-window tick candidates (predicted): **AVGOx ~21 Sep**, plus **QQQx** and **SPYx**, both
>   overdue with an 18 Sep ex-date. Run `tsx crank/src/scan-windows.ts` to refresh.
> - STRCx next ~30 Sep, inside judging, capturable as post-submission README evidence.

## Section 1: Plan Metadata

| Field | Value |
|---|---|
| Deadline | 2026-09-25 20:00 UTC (EXTENDED from 18 Sep; verified 18 Sep) |
| Build days | 6 (Sat 19 through Thu 24). Friday 25 is submission day. |
| Total estimated | 5.75 days |
| Binding internal gate | **Devnet harvest path running AND the crank watching real mainnet mints: HARD STOP Mon 14 Sep 22:00 UTC.** (Checkpoint 3: devnet first, so the gate is the devnet harvest plus free mainnet reads, not a mainnet harvest.) Sun 13 Sep 20:00 UTC is the CHECKPOINT that triggers the cut list, not a second gate. <!-- [CRITIQUE E-2] was "end of Monday 15 Sep": 15 Sep 2026 is a TUESDAY. Monday is the 14th, and Aug 30 + 15d puts the expected STRCx tick on Mon 14 Sep, activating ~23:00-00:30 UTC. The old gate landed AFTER the event it exists to catch. --> <!-- [CRITIQUE C-3] The E-2 fix wrote "Sun 13 Sep end of day" here and in concerns.md but left Section 2 and the Phase 5 header reading "Mon 14 Sep, done by 22:00 UTC". Two gates one day apart in one document, and a builder working top to bottom follows the phase schedule. One gate now: Monday 22:00 UTC. Sunday is a checkpoint with teeth (see C-4 cut list below), which is what the Sunday date was actually for. --> |
| Why that gate | STRCx has ticked every ~15 days (Jun 30, Jul 15, Jul 31, Aug 14, Aug 30). Next expected 14-15 Sep, with $335k liquidity. Capturing that real tick is the primary demo objective. |


> **[CHECKPOINT 3 DECISION, 2026-09-12] DEVNET FIRST.** The build deploys to devnet, not
> mainnet. Deploy authority, keeper and demo funding all become faucet SOL, so the ~4 SOL
> prerequisite is gone and Phase 0 no longer has an exchange-withdrawal dependency at
> position zero.
>
> **Mainnet reads stay, and they are free.** No SOL is required to read a mint account or
> call the issuer's public API. The crank still watches all 732 real mainnet mints and still
> detects real corporate actions; the calendar, income-stocks and backfill screens still run
> on real production data. Only `harvest` and `settle` execute against a fixture mint.
>
> **The cost, stated plainly:** we give up the strongest single piece of evidence in the
> submission, a real mainnet dividend harvested end to end with an explorer link a judge can
> open. The demo must therefore label the devnet harvest as devnet, every time it appears,
> and put the real mainnet detection next to it. Never present one as the other.
>
> **The upgrade path stays open.** Section 7 holds a mainnet cutover that can run any time
> before Friday if funding lands. It is ~40 minutes of work, not a rebuild.

### How to use this plan

Work top to bottom. Every task names the files it creates and the `ARCHITECTURE.md` section to copy from. Run the exact command given and compare against the expected output. Do not proceed past a phase gate with an unchecked box.

When something fails, find the decision tree for it rather than improvising. The trees exist because these are the failures that were predicted.

### Cut order, decided now rather than at 2am on Thursday

1. Bill routing (Phase 8)
2. Buy front door (Phase 8)
3. Calendar and income-stocks routes (Phase 7)
4. Design pass (Phase 9)

**Never cut:** Phases 1 through 5. That is the mechanic and the mainnet gate.

<!-- [CRITIQUE C-4] Added. Phases 0 through 5 total 3.0 estimated days against roughly 1.5
     calendar days to Sunday, and the repository currently contains no code at all: no
     Anchor.toml, no programs/, no crank/, no web/, and all five Phase 0 tasks undone. The
     cut list above only starts biting at Phase 7, which is Tuesday. That is too late to
     protect a Monday gate. These four cuts are taken NOW, not held in reserve. -->
### Cuts taken now to protect the Monday gate, not held in reserve

These are not contingencies. Apply them from the first commit.

1. **No web work before the mainnet crank logs a tick-watcher line.** Phase 6 depends only on
   Phase 2, so it is startable on Sunday and it is the single most likely thing to eat the
   gate. DT-8 already says "stop all web work immediately", but only as a remedy after the
   gate is already at risk. It is the default instead.
2. **Build five instructions, not six.** `close_plan` ships Tuesday. DT-8 already authorises
   this as a remedy; the Phase 2 gate contradicted it by requiring all six in the IDL. Fixed
   there too.
3. **Task 5.3 buys STRCx only.** KOx and MCDx are demo-wallet dressing, not gate items. Buy
   them Tuesday. Three Jupiter round trips at the worst hour of the week is three chances to
   fail for no gate benefit.
4. **Phase 4 (devnet rehearsal) is the designated sacrifice.** If it is not green by Sun 13
   Sep 20:00 UTC, skip it. Under devnet-first the rehearsal and the gate run on the same network, so the rehearsal is cheaper to keep than it was. Phase 5 already says
   this; ARCHITECTURE.md Section 24 contradicted it by declaring devnet "must be green before
   row 5". Fixed there too.

**What is NOT compressible by working faster:** sourcing ~4.5 SOL to mainnet (Task 0.5) and
provisioning a paid RPC (Task 0.3). Both are wall-clock. Start them before writing any code.

---

## Section 2: Phase Overview

| Phase | Purpose | Est. | Depends on | Day |
|:---:|---|:---:|---|---|
| 0 | Environment and accounts | 0.25d | none | Sat |
| 1 | Delta math and program state | 0.75d | 0 | Sat |
| 2 | Program instructions complete | 0.5d | 1 | Sun |
| 3 | Crank | 0.75d | 2 | Sun |
| 4 | Devnet rehearsal, full path | 0.25d | 3 | Sun |
| 5 | **DEVNET GATE plus mainnet watch** | 0.5d | 4 | **Mon 14 Sep, done by 22:00 UTC** |
| 6 | Web app: the problem screen | 1.0d | 2 | Mon-Tue |
| 7 | Capture the real tick, proof route | 0.25d | 5 | Tue |
| 8 | Buy front door and bill routing | 0.5d | 6 | Wed |
| 9 | Design pass and demo recording | 0.75d | 7, 8 | Thu |
| 10 | Submit | 0.25d | 9 | Fri |

---

## Phase 0: Environment and accounts (0.25d)

<!-- [CRITIQUE C-7] E-3 added Task 0.5 but left it at position five. Every other Phase 0 task
     is minutes of local work; that one can consume a day and it is the one gating Monday's
     deploy. Its own text names exchange KYC latency as the failure mode. Ordering matters
     more than the task existing. -->
> **Do Task 0.5 first, before `anchor init`.** It is the only item in this project with a lead
> time measured in hours rather than minutes: ~4.5 SOL has to actually arrive on mainnet, and
> nothing about writing code makes that go faster. Start the transfer, then come back to
> Task 0.1 while it settles. Tasks 0.1 through 0.4 all run fine with the transfer in flight.

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
solana balance -k keeper.json --url devnet
```

Expected: an address printed. Then `solana airdrop 2 -k keeper.json --url devnet` and confirm the balance. Free.

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

Expected: an address. `solana airdrop 2 -k demo.json --url devnet`. No real xStocks are purchased: on devnet the holding is the fixture mint from Task 4.1. Real xStocks exist only on mainnet.

Commit: `chore: demo wallet generated`

<!-- [CRITIQUE E-3] Added. ARCHITECTURE.md Section 24 row 5 requires "a wallet with about
     3 SOL" to deploy, and Task 5.1 asserts "at least 3 SOL before deploying". Phase 0
     previously funded only the keeper (0.5 SOL) and the demo wallet (~$60), and the gate
     checked neither the deploy authority nor its balance. The shortfall would surface for
     the first time on Monday at the mainnet gate, needing an out-of-band on-ramp at the
     worst possible moment. -->
### Task 0.5: Fund the DEPLOY authority (this is a separate wallet from the keeper)

Copy from: ARCHITECTURE.md Section 24 row 5 (mainnet deploy) and Section 21 Credentials Needed.

`anchor deploy` pays rent for the program account out of the wallet named in `Anchor.toml`
/ `solana config get`, which is neither `keeper.json` nor `demo.json`. A program of this
size needs roughly 3 SOL, and the rent is not recoverable while the program stays deployed.

```bash
solana config get                      # note "Keypair Path", this is the deploy authority
solana address
solana balance --url mainnet-beta
```

Expected on devnet: `solana airdrop 5 --url devnet` succeeds. **Free.** The ~3.5 SOL mainnet rent requirement does not apply while we deploy to devnet, and this task drops off the critical path entirely.

**Total SOL required before Monday: zero.** Devnet faucet covers the deploy authority, the keeper and the demo wallet. Retained here because the mainnet cutover in Section 7 needs these numbers if funding lands later in the week.

Commit: `chore: deploy authority funded`

### Phase 0 gate

- [ ] `anchor --version` prints `anchor-cli 0.30.1`
- [ ] `solana balance -k keeper.json --url devnet` shows at least 0.4 SOL
- [ ] `solana balance --url mainnet-beta` (the DEPLOY authority from `solana config get`) shows at least 3.5 SOL
- [ ] The `getHealth` curl against the paid RPC returns `"ok"`
- [ ] The demo wallet holds devnet SOL and the fixture-mint balance
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
running 6 tests
test scaled_ui::tests::aaplx_tick_delta_is_exactly_602_834 ... ok
test scaled_ui::tests::delta_preserves_scaled_exposure ... ok
test scaled_ui::tests::forward_split_is_rejected ... ok
test scaled_ui::tests::no_tick_means_no_delta ... ok
test scaled_ui::tests::reverse_split_is_rejected ... ok
test scaled_ui::tests::zero_balance_is_zero_delta ... ok
```

<!-- [CRITIQUE C-1 / C-8c] Two tests added, both cheap and both closing a real hole.
     `forward_split_is_rejected`: the suite tested only the reverse split, which made the
     split case LOOK handled. A forward split raises the multiplier and would have sold real
     shares up to the delegate cap. `aaplx_tick_delta_is_exactly_602_834`: E-1 was a
     hand-computed constant that no test ever asserted. It does now. -->


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

Expected: 7 tests pass.

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
3. Re-run. If still failing, print `delta`, `before` and `after` for the AAPLx case and compare against the worked example in ARCHITECTURE.md Section 3 (`602_834` for `R = 1_000_000_000` raw, i.e. a 10.0-unscaled-token position).

<!-- [CRITIQUE E-1] The expected value in this step used to read 602_956. That number was
     wrong by 122 raw units and produced `after < before`, the exact symptom this decision
     tree tells you to chase. If you see 602_956 anywhere (an old checkout, a stale comment),
     it is the bug, not the target. -->
**If the test expects `602_956`:** the *test* is wrong, not the code. `602_956` is a stale
hand-computed constant; the correct floor is `602_834`. Fix the assertion, do not touch
`compute_delta_raw`, and do NOT proceed to the fixed-point rewrite below, you would be
rewriting correct code to reproduce an arithmetic typo.

**If `reverse_split_is_rejected` fails:**
1. The `require!(m1 >= m0, MultiplierDecreased)` guard is missing or inverted.
2. Re-run.

**If nothing works:**
1. Delete the f64 path and compute in fixed point: scale both multipliers by `1e12`, do the arithmetic in `u128`, then divide.
2. Verify the same five real AAPLx ticks give the same answers to within one raw unit.
3. Continue from Task 1.3 with the fixed-point version.

### Phase 1 gate

- [ ] `cargo test -p stokss --lib scaled_ui` passes 7 of 7
- [ ] The parser returns the exact multipliers from ARCHITECTURE.md Section 3 for the real AAPLx fixture
- [ ] `cargo build -p stokss` is clean
- [ ] [C] concern "delta computed in RAW units" is verified by a passing test, not by inspection
- [ ] A forward split is rejected on-chain, not only by the crank's reason label (C-1)

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


### Decision Point DT-16: `anchor build` cannot generate the IDL (toolchain, hit on 2026-09-12)

Run: `anchor build`
Expected: `Finished release profile` and a `target/idl/stokss.json`.

**If it works:** delete the hand-generated IDL and use the compiler's. Preferred.

**If you get `feature edition2024 is required` while parsing some crate's manifest:**
The Solana BPF toolchain bundles cargo 1.84 (platform-tools v1.51) while the host is newer,
and transitive deps of solana-program 1.18.26 have since moved to edition2024. Already fixed
in this repo by `.cargo/config.toml` setting `[resolver] incompatible-rust-versions = "fallback"`
plus `rust-version = "1.84"` in the program manifest. If it returns after a `cargo update`:
1. `rm Cargo.lock && cargo generate-lockfile`
2. `cargo update -p blake3 --precise 1.5.5` (its digest 0.11 line pulls crypto-common 0.2.2)
3. Re-run.

**If you get `no method named source_file found for proc_macro2::Span`:**
anchor-syn 0.30.1 builds the IDL under `--cfg procmacro2_semver_exempt`, which needs
`proc_macro::Span::source_file`. That compiler API is gone, so proc-macro2 new enough to
compile no longer exposes it.
1. Do NOT pin proc-macro2 below 1.0.95 to get `source_file` back. It compiles, then
   `ark-bn254`'s `MontFp!` macro panics with "could not parse". There is no version that
   satisfies both; this was tried and it does not exist.
2. `anchor idl build` is the same code path and fails identically.
3. Use `anchor build --no-idl` for the deployable `.so`, then `python3 scripts/gen-idl.py`.

**The fallback is not a guess.** `scripts/gen-idl.py` derives every discriminator the way
Anchor does, `sha256("global:" + name)[0..8]` for instructions and `sha256("account:" + Name)`
for accounts, so a client built from it emits byte-identical instruction data. `anchor idl type`
parses the output and generates the TypeScript type from it, which is the tooling validating
the file. The one real cost is drift: **if you change a `#[derive(Accounts)]` struct, update
`scripts/gen-idl.py` in the same commit.**

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
- [ ] `target/idl/stokss.json` lists at least the five gate instructions: `initializeConfig`, `enroll`, `harvest`, `settle`, `setPaused`. <!-- [CRITIQUE C-3] was "all six instructions", which contradicted DT-8's instruction to skip `close_plan` to make the gate. `close_plan` ships Tuesday. -->
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


### Decision Point DT-3: the issuer API is unavailable (PRD risk R3, MEDIUM)

Run: `curl -s "https://api.backed.fi/api/v2/public/assets/KOx/multiplier/history?network=Solana" | jq '.nodes | length'`
Expected: a number greater than 0.

**If it works:** continue to Task 3.4.

**If you get a validation error mentioning `network`:**
1. The `network` query parameter is required. Add `?network=Solana`.
2. Re-run.

**If you get a 5xx or a timeout:**
1. Nothing on the critical path breaks. On-chain mint state is authoritative for both detection and delta; the API only supplies the event REASON and the backfill history.
2. Confirm the degrade path works: with the API unreachable, `pollTicks` must still detect the change and record `reason = "Unknown"`.
3. Decide what an Unknown reason does. Default is to SKIP, because harvesting a split would sell real exposure for nothing. Leave it skipping and alert instead.

**If nothing works:**
1. Hardcode the reason for the demo asset only, from its known cadence: STRCx pays semi-monthly and every one of its recorded events is a Dividend.
2. Show a banner in the app saying event reasons are degraded.
3. Continue from Task 3.4.

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

## Phase 5: DEVNET GATE plus mainnet watch (0.5d, Monday 14 Sep, complete by 22:00 UTC)

Everything before this was preparation. This is the deadline that matters.

**Under the devnet-first decision this phase has two halves.** The gate is the devnet harvest path running end to end. The second half costs nothing and is what keeps the submission honest and interesting: point the tick-watcher at the real mainnet mints so it detects real corporate actions while the harvest executes on the fixture. Reads are free; no mainnet SOL is involved.

<!-- [CRITIQUE E-2] Monday is 14 September 2026, not the 15th, and the expected STRCx
     activation is Mon 14 Sep ~23:00 UTC. This phase must be COMPLETE with one hour to
     spare, not "by end of Monday". -->
> **Why 22:00 UTC and not end of day.** Aug 30 + 15 days = Mon 14 Sep, and 98.3% of ticks
> activate 23:00-00:30 UTC. Two mechanisms make a late arrival unrecoverable rather than
> merely late:
> 1. `tick-watcher` fires only on a *change between two observations* (`if (!prev) continue`).
>    A crank started after activation records the post-tick state as "first sight" and will
>    never harvest it.
> 2. `enroll` snapshots the effective multiplier as `m0`. Enrolling after activation sets
>    `m0 = M1`, so `delta` is 0 for that tick, permanently and by design.
>
> There is no catch-up path. If the crank is not running and STRCx not enrolled before
> activation, the STRCx window is gone and the fallback is QQQx (20-30 Sep, after the
> deadline, inside judging) or the devnet rig.
>
> **If Phase 4 is not green by Sun 13 Sep 20:00 UTC:** skip the devnet rehearsal, deploy to
> mainnet, and rehearse on mainnet with a $5 position. A devnet rehearsal that costs the
> mainnet window is a bad trade.

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

Check at **14:00 UTC Monday 14 Sep** (was 18:00; moved earlier because the tick lands ~23:00 UTC the same day and every remediation below costs hours): is `[tick-watcher] STRCx` appearing in the log?

**If yes:** the gate is met. Continue to Phase 6.

**If the program is not deployed yet:**
1. Stop all web work immediately. Phase 6 is not on the critical path.
2. Deploy with the minimum: `initialize_config`, `enroll`, `harvest`, `settle`. Skip `close_plan`; it can ship Tuesday.
3. Enroll by direct script rather than through the UI.

**If the program is deployed but enrollment is failing:**
1. Enroll from a script using the IDL directly, bypassing the wallet adapter entirely.
2. The demo can show enrollment from the UI later; the tick cannot wait.

**If nothing works by 21:00 UTC Monday 14 Sep** (two hours before expected activation, not
after it):
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


### Decision Point DT-6: DexScreener is unavailable (PRD risk R6, LOW)

Run: `curl -s "https://api.dexscreener.com/tokens/v1/solana/XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" | jq 'length'`
Expected: a number greater than 0.

**If it works:** continue to Task 6.3.

**If it returns an empty array or a 5xx:**
1. Prices become null. The portfolio route already handles this: `valueUsd` is null and the UI shows an em-less placeholder rather than a wrong number.
2. Swap in a Jupiter quote for valuation: quote 1 raw unit of the mint against USDC and read `swapUsdValue`. Slower, rate-limited, but authoritative.

**If nothing works:**
1. Drop USD valuation from the demo entirely and show share counts and multipliers only.
2. The backfill number then shows the delta in shares rather than dollars, which is less punchy but still true.
3. Continue from Task 6.3.

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

## Section 4: Objection Handling

These four are referenced by the PRD risk register as decision trees, but they are not build
failures. They fire in front of a judge, so the branch is what you say, not what you run.
Rehearse them in Phase 9 alongside the demo.

### Decision Point DT-9: "this is a feature, not an app" (PRD risk R9, MEDIUM)

Trigger: a judge says stokss is one mechanic rather than a product.

**Do not argue that it is bigger than it looks.** It is one mechanic, deliberately.

<!-- [CRITIQUE C-6] The old step 1 quoted the rules back and concluded "the objection is
     aimed at the brief, not at us". That is a rationalization, not an answer: judges wrote
     the rubric and know what "pick one wedge" meant, and it did not mean "one instruction is
     a product". It also breaks this tree's own opening instruction. Worse, the only
     substantive answer left was the front door, which is item 2 on the cut list and lives in
     a phase titled FIRST TO CUT. If Phase 8 is cut as planned, the tree had a rationalization
     and a generic appeal and nothing else. The new step 1 survives every cut. -->
1. **Lead with the clock.** A feature runs when you click it. stokss runs when nobody is
   watching: the crank sat on mainnet through the weekend, saw a corporate action nobody
   triggered, waited for the US open because selling into a shut book is worse for the
   holder, sold exactly the increment and wrote a receipt. Recurring autonomous per-user
   execution with on-chain receipts is a service with a clock, not a button. This answer is
   checkable in the explorer and it does not depend on anything that can be cut.
2. Then show the front door, **if it shipped.** Income stocks ranked by dividends measured
   on-chain, buy in one click, enroll on success. That makes it a place you keep your income
   stocks, not a utility bolted to a wallet. If it was cut, do not mention it; step 1 already
   carried the argument.
3. If they still push: the honest answer is that a product which does one thing correctly with
   real money on mainnet beats four things that only work in a recording.

### Decision Point DT-10: "isn't reinvestment good, why would I want cash" (PRD risk R10, MEDIUM)

Trigger: a judge argues DRIP is a feature and cash is worse.

**Do not defend income as a preference.** You will lose that argument, and it is the weaker case.

1. Lead with tax. The multiplier tick is a distribution you are taxed on and never receive. You
   owe cash on money you cannot spend. That is a liability, not a taste.
2. Second, optionality. Reinvesting into the same stock is a concentration decision an issuer
   made for you. stokss gives the choice back: cash, another asset, or a bill.
<!-- [CRITIQUE C-5] The old step 3 read: "you can still reinvest. Point the destination at the
     same stock and stokss does nothing, which is exactly today's behaviour." False twice
     over, and falsifiable by opening one file. `settle`'s destination is an
     InterfaceAccount<TokenAccount> at `plan.destination` and the only transfer it makes is
     `transfer_checked` on `usdc_mint`; PayoutMode is Cash | Redirect | Bill and none of them
     route back into the stock. And even if one did, stokss would not "do nothing": it would
     harvest, swap to USDC paying Jupiter spread, then swap back. Two spreads and a forced
     disposal is strictly worse than leaving it alone. Do not offer a judge a parity claim
     they can break in thirty seconds, especially in the tree whose whole case is credibility
     about tax. -->
3. Third: **opt out per position.** Do not enroll that holding, or close the plan and revoke
   in one transaction, and you are back to exactly today's behaviour. That is a switch we
   added, not one we removed, and unlike a reinvest destination it is actually implemented.
4. **When they raise double taxation, and they will:** yes, selling the increment is itself a
   disposal. It is a disposal at a near-zero basis delta, because you sell the increment on
   the day you receive it, so the capital gain rounds to nothing. What it produces is the cash
   to pay the income tax you already owed on a distribution you never received. One event you
   cannot fund becomes two events, one of which funds the other. Have this ready; it is the
   first thing anyone who actually does tax will say, and the tree leads with tax.
5. Never quote a yield percentage as the pitch. It is about 1% blended and it is not the point.
   Quoting it is a drift tripwire in the thesis.

### Decision Point DT-11: another submission shipped the same mechanic (PRD risk R11, LOW)

Trigger: the gallery opens and something similar is there.

1. Do not claim novelty. The field was never observable, so novelty was never the defence.
2. Compete on evidence instead: a real mainnet corporate action, harvested and settled, with an
   explorer link a judge can open. That is hard to match in six days and it is checkable.
3. If theirs also ran on mainnet: compete on correctness. Show the delta test against five real
   historical ticks, the idempotence test, and the reverse-split rejection.

### Decision Point DT-13: "why would I trust your keeper" (PRD risk R13, MEDIUM)

Trigger: a judge or user notices the increment passes through a keeper-held account.

1. Answer with the bound, not with reassurance. The program computes delta itself from mint
   state and the holder's balance. `harvest` takes no amount argument; check the IDL.
2. Then the second bound: the delegate is capped at roughly 5% of the position, enforced by the
   token program, not by us. Show it on screen with `spl-token display`.
   <!-- [CRITIQUE C-1] Point 2b added. Without the ceiling, the delegate cap was the ONLY
        enforced bound on how much a single harvest could move, and "we only take the
        dividend" was an off-chain promise kept by the crank's reason label. A judge who
        asks "what if it's a split, not a dividend" had no code answer. -->
2b. Then the bound that makes the first two mean "dividend" rather than just "less than 5%":
   `compute_delta_raw` requires `m0 < m1 <= m0 * 1.02`. A forward split or an administrative
   correction falls outside that band and reverts on-chain, not in our crank. Every real tick
   we measured is under 0.55%, so the ceiling clears them by about 4x. Say which layer holds
   which bound: the token program caps the total, this program caps the shape.
3. Then the honest limitation: between harvest and settle, the increment sits in a keeper
   account for minutes. That is a real trust assumption and we say so in `disclosures.md`.
4. State the fix we did not build: an atomic route that swaps inside the same transaction, which
   needs a Jupiter CPI. We chose not to put that on the critical path six days out. Say that
   plainly rather than pretending the design is finished.


---

## Section 7: Mainnet cutover (run only if funding lands before Friday)

Roughly 40 minutes. Nothing in the codebase changes; this is configuration and money.

| # | Step | Command | Expected |
|:---:|---|---|---|
| 1 | Fund the deploy authority | send ~3.5 SOL to `solana address` | `solana balance` >= 3.5 |
| 2 | Fund the keeper | send 0.5 SOL to the keeper pubkey | balance >= 0.5 |
| 3 | Fund the demo wallet | send ~$60 of SOL | balance visible |
| 4 | Deploy | `anchor deploy --provider.cluster mainnet` | program shows deployed |
| 5 | Init config | `anchor run init-config --provider.cluster mainnet` | config account exists |
| 6 | Buy real positions | `npx tsx scripts/seed-demo.ts` | three Solscan links |
| 7 | Enroll and arm | enroll STRCx, restart the crank against mainnet | `[tick-watcher] STRCx` in the log |

**The timing constraint does not disappear, it just moves.** The crank must be watching and
the position enrolled BEFORE a tick activates. `tick-watcher` only fires on a change between
two observations and `enroll` snapshots the current multiplier, so a tick that lands first is
unharvestable forever. If the cutover happens after Monday, the next candidate is QQQx around
20 to 30 September, which falls inside the judging window but after the submission deadline.
A harvest captured then can still be added to the repository as evidence.


---

## Section 5: Decision Tree Index

| Tree | Covers | PRD risk | Severity | Where |
|---|---|---|:---:|:---:|
| DT-1 | No real tick before the deadline | R1 | CRITICAL | Phase 5 |
| DT-2 | Delta math wrong | R2 | CRITICAL | Phase 1 |
| DT-3 | Issuer API unavailable | R3 | MEDIUM | Phase 3 |
| DT-4 | Jupiter unavailable or no route | R4 | HIGH | Phase 3 |
| DT-5 | RPC rate limits | R5 | HIGH | Phase 3 |
| DT-6 | DexScreener unavailable | R6 | LOW | Phase 6 |
| DT-7 | Tick fired unrecorded | R7 | HIGH | Phase 7 |
| DT-8 | Monday gate slipping | R8 | CRITICAL | Phase 5 |
| DT-9 | "A feature, not an app" | R9 | MEDIUM | Section 4 |
| DT-10 | "Isn't reinvestment good" | R10 | MEDIUM | Section 4 |
| DT-11 | A duplicate submission | R11 | LOW | Section 4 |
| DT-12 | Scope creep | R12 | HIGH | Phase 8 |
| DT-13 | Keeper trust | R13 | MEDIUM | Section 4 |
| DT-14 | Deployment does not survive to 2 Oct | R14 | HIGH | Phase 9 |
| DT-15 | Anchor build fails on Token-2022 | build risk | HIGH | Phase 2 |
| DT-16 | anchor build cannot generate the IDL (toolchain) | build risk | HIGH | Phase 2 |

Sixteen trees against fourteen PRD risks plus two build risks. Every `DT-` reference in PRD.md Section 7 resolves to a definition here.

Found by the critique pass: six of these (DT-3, 6, 9, 10, 11, 13) were referenced by the PRD and had no definition. The plan's own metric only counted trees against CRITICAL and HIGH risks, so it did not catch the dangling references.

---

## Section 6: Concerns Verification Map

Every [C] concern from `concerns.md` has a phase gate that verifies it.

| Concern | Verified at |
|---|---|
| Real mainnet tick harvested end to end | Phase 7 gate: `submission/proof.md` exists with real signatures that resolve |
| Devnet harvest path live, crank watching mainnet, by Mon 14 Sep 22:00 UTC | Phase 5 gate: a devnet harvest confirmed, and tick-watcher lines for real mainnet mints in the log |
| Program cannot move more than the increment | Phase 2 gate: `harvest` takes no amount argument in the IDL. Phase 6 gate: capped delegate visible in `spl-token display` |
| Links resolve on 2 October | Phase 9 gate and Phase 10 Task 10.2, plus the weekly check in `SUBMISSION-CHECKLIST.md` |
| Delta computed in RAW units | Phase 1 gate: five passing tests against real AAPLx ticks |
