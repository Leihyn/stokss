# Closing Bell

**Live: https://closing-bell-solana.vercel.app** — reading mainnet right now. The page changes
with the clock: during the US session it shows the anchor holding, and counts down to the
weekend window where the issuer sets create/redeem to zero. To see that state at any time,
append `?dark=1` — it moves the clock and nothing else, and says so on screen.

Coca-Cola cannot move on a Saturday. The New York Stock Exchange is shut, no trade prints,
no price exists.

KOx, the tokenized Coca-Cola share on Solana, moves **1.071% per hour** on a Saturday. That
is more than it moves during the hours Coca-Cola is actually trading, when it averages
0.821%.

Somebody is on the other side of every one of those trades. Right now that is **2,777
liquidity positions** across 76 xStocks pools, quoting continuously into a market where the
underlying asset has no price and cannot be hedged.

**Closing Bell warns those liquidity providers when their position is about to sit through
hours nobody can price, and hands them a one-click exit they sign themselves.**

---

## The problem, measured

Everything below was measured against mainnet. The scripts that produced it are in this
repo and re-runnable.

**70.9% of xStocks trading volume arrives outside US regular session.** 36.3% arrives while
the market is fully closed. The US equity market prices these assets 32.5 hours a week.
Solana trades them 168.

**Weekend volatility exceeds trading-hours volatility**, 0.689% against 0.570% mean hourly
absolute return. The asset moves more when the thing it tracks cannot move at all.

**The issuer switches off the safety net at exactly the wrong moment.** Backed publishes
`limitsPerPeriod` on every asset, and during `closed` it reads
`maxOrderFiatValue: 0`. Creation and redemption are the mechanism that arbitrages a wrapper
back to the real share price. That mechanism is disabled for the entire window.

**Pyth proves it.** An equity price feed's `publish_time` stops at the closing bell. Read
`Equity.US.SPY/USD` on-chain on a Saturday and it is 18.8 hours stale, because Pyth cannot
publish a price the market is not quoting. The age of that last print *is* the exposure
window.

## Why this belongs on Solana

Not "fast and cheap". Three specific reasons.

The asset only exists here in this form. xStocks are Token-2022 mints using the Scaled UI
Amount extension, so the raw balance never changes and a multiplier on the mint carries
corporate actions. Most tools read `amount` and get the share count wrong.

The exposure is measurable on-chain. Every affected position is a Raydium CLMM
`PersonalPositionState` account. You can count all 2,777 of them without asking anyone's
permission, which is what `crank/src/exposure-scan.ts` does.

The exit is non-custodial by construction. Raydium's `decreaseLiquidity` returns a
transaction rather than executing one, so Closing Bell builds the exit and your wallet
signs it. There is no keeper, no delegate, and no program of ours in the path.

## What it does

A live clock reading the issuer's own session state, counting the hours until anyone can
price the asset again. The market-wide exposure, every CLMM position in every xStocks pool.
The last real price from Pyth with the age of that print. And if you connect a wallet, your
own positions with a withdrawal button.

## Reproducing the measurements

```bash
cd crank
npx tsx src/exposure-scan.ts     # 2,777 positions across 76 pools -> web/data/exposure.json
npx tsx src/scan-windows.ts      # which assets tick inside a given window
npx tsx src/delegate-probe.ts    # issuer authority usage, full history, 100% coverage
```

```bash
cd web
npm install && npm run dev       # http://localhost:3000
npm test                         # 13 tests
```

## What is verified, and what is not

Being explicit, because the distinction matters.

**Verified against mainnet or a running server.** The measured volume and volatility split.
The 2,777 position count, with the `pool_id` offset of 41 confirmed empirically because
offsets 9, 40 and 42 return zero accounts. The issuer session state and the
`maxOrderFiatValue: 0` behaviour. The Pyth read, decoded on-chain and cross-checked against
an independent quote source. The Raydium position read path, end to end through the RPC
proxy. The landing page, which passes a five-run reliability test with zero server errors.

**Not verified.** The withdrawal transaction builds and typechecks but **has never
executed**, because that requires a funded mainnet CLMM position. `amountMinA` and
`amountMinB` are zero, so it accepts any output amount. That is acceptable for a full exit
a user inspects before signing and wrong for anything automated.

`web/data/exposure.json` is a dated snapshot, not a live feed. Only the clock and the Pyth
price update on their own.

## A note on the issuer

While measuring, we scanned both xStocks control authorities across their complete on-chain
history. **17,688 transactions decoded at 100% coverage, zero unresolved.**

The permanent delegate can move any holder's tokens at will. The pause authority can halt
every transfer. Neither has ever been used against a holder. The delegate is a mint factory
and has created 1,474 mints; the pause authority has issued 159 `setAuthority` calls and
nothing else.

Both are plain keypairs rather than SPL multisigs, so any exercise would have to appear in
their own signature history. That is what makes "never used" provable here rather than
sampled.

Ondo issues the same underlying shares on Solana, also Token-2022 with Scaled UI Amount,
and takes no permanent delegate at all. The power is a choice, not a requirement. We could
not find anyone publishing either half of this.

## Repository layout

```
web/          the application. Next.js, the only thing that ships.
crank/        measurement scripts. Every number in this README is reproducible from here.
programs/     an Anchor program from an earlier direction (see below).
```

**On `programs/`:** this project began as a dividend harvester for Scaled UI Amount tokens
and pivoted when the measurements showed the dividend opportunity reaches only ~2,689
positions while the session-exposure problem reaches 2,777 liquidity providers plus every
holder. The Anchor program is left in place with its 20 passing tests because the Scaled UI
Amount TLV parser in it is genuinely useful reference. **It is not used by Closing Bell.**

## Troubleshooting

**"no feed for SYMBOL" from `/api/pyth`**
Only SPY, QQQ and AAPL equity feeds are wired in `lib/pyth.ts`. Add the feed id to
`EQUITY_FEEDS`; find it via `https://hermes.pyth.network/v2/price_feeds?query=SYMBOL`.

**Pyth price looks days old rather than hours**
Expected for `Crypto.<SYM>X/USD` wrapper feeds, which measured ~7 days stale on Solana.
That is why only the equity leg is read on-chain and the live wrapper price comes from the
DEX.

**Positions load returns 0 for an address that has liquidity**
Closing Bell reads Raydium CLMM positions only. Liquidity in a Raydium AMM v4 pool does not
create a `PersonalPositionState` account and will not appear.

**`bigint: Failed to load bindings`**
Harmless. A native module falls back to pure JS.

## License

MIT.
