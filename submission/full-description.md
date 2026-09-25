**Live: https://closing-bell-solana.vercel.app** · **Code: https://github.com/Leihyn/stokss**

## The problem

Coca-Cola cannot move on a Saturday. The New York Stock Exchange is shut, no trade prints, no price exists.

KOx, the tokenized Coca-Cola share on Solana, moves **1.071% per hour** on a Saturday. That is more than it moves during the hours Coca-Cola is actually trading, when it averages 0.821%.

Somebody is on the other side of every one of those trades. Right now that is **2,777 liquidity positions across 76 xStocks pools holding $16.2M**, quoting continuously into a market where the underlying asset has no price and cannot be hedged.

## What I measured against mainnet

Every number here is re-runnable from scripts in the repo.

- **70.9%** of xStocks DEX volume arrives outside US regular session. 36.3% arrives while it is fully closed.
- **Weekend volatility exceeds trading-hours volatility**: 0.689% against 0.570% mean hourly absolute return. The asset moves more when the thing it tracks cannot move at all.
- The US equity market prices these assets **32.5 hours a week**. Solana trades them **168**.
- Pyth proves the gap: an equity feed's `publish_time` stops when quoting stops — and **not at the closing bell**. Polled at 21:26 UTC, 86 minutes after the 20:00 bell, `Equity.US.SPY/USD` was still seconds fresh, because the extended session was quoting.
- The issuer publishes a create/redeem limit per session period: $100M market and extended, $20M overnight, **$0 closed**. 5,385 polls over five days show `closed` covers the weekend and nothing else — a window observed continuously for **42.1 hours** in which no arbitrage anchors the token to the share.

That last measurement corrected my own thesis mid-build. I had assumed the anchor switched off every night. It does not — it throttles. Only the weekend is genuinely unanchored, and the page now says so.

## What it does

Closing Bell reads three clocks that disagree and tells a liquidity provider which one they are exposed to.

1. **Pyth `Equity.US.SPY/USD`** — the real equity price and, critically, its `publish_time`. When the feed stops the page says so because the age is measured, not inferred from a calendar.
2. **The xStock implied share price** — the DEX price of the raw token divided by the Token-2022 Scaled UI Amount multiplier read on-chain. This is the comparison surface: what the token says a share is worth, against what the equity feed says.
3. **The issuer's own create/redeem limit** — whether the arbitrage mechanism is running at all.

It then hands the holder a **one-click exit they sign themselves**. Raydium's `decreaseLiquidity` returns a transaction rather than executing one, so there is no keeper, no delegate, and no program of mine in the path. The exit carries a real slippage floor derived from the position's own tick range, verified two ways: by decoding the built instruction (`amount0Min` and `amount1Min` non-zero on the wire) and by simulating it against live mainnet state.

## Why Solana

The asset only exists here. Token-2022 Scaled UI Amount is what lets a tokenized share track corporate actions, and it is what makes the implied-price comparison possible at all — a raw token is worth `multiplier` shares, so the quote must be divided before it can be compared to an equity feed. The 168-hour trading week is a property of this chain meeting an asset whose reference market runs 32.5.

## Try it

The page is a live instrument and changes with the clock. During the US session it shows the anchor holding and counts down to the weekend window. Append **`?dark=1`** to see the unanchored state at any time — it moves the clock and nothing else, and says so on screen.

`/positions` loads a real mainnet liquidity provider with no wallet required, so the exit path is inspectable without connecting anything.
