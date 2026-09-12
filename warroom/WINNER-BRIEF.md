# WINNER-BRIEF — stokss

## Thesis
Tokenized stocks on Solana pay no cash dividends. When a company pays, Backed reinvests the cash and raises a multiplier on the Token-2022 mint, so the holder's economic exposure grows and nothing spendable ever arrives. $891M of dividend-paying xStocks is outstanding on Solana and $8.72M of dividends were paid into it over the last 12 months across 110 ticks, none of it as cash. stokss is the one rule that fixes it: **when a tokenized stock's on-chain multiplier ticks up, sell exactly that increment at the next market open and route the cash where the holder chose, their wallet or a bill.** If raw balance is R and the multiplier moves M0 to M1, stokss sells `delta = R * (1 - M0/M1)`. The holder ends with the identical share count and the dividend in USDC.

## Track
Single main track, $100,000. Wedge: "Credit and yield: borrowing against stocks, dividends, structured products", with a second foot in "Infrastructure: corporate actions". The organizers list dividends and corporate actions by name, and no product serves either.

## Scope Addition (Checkpoint 2, user-approved)
**Buy front door.** The app includes a one-click Jupiter buy for the ~29 dividend-paying xStocks that have liquidity, so stokss is a destination you hold your income stocks in rather than a background utility attached to a wallet. Budget roughly 3 hours. It also completes the demo loop: buy, hold, get paid. It is NOT a vault or an index basket; no share accounting, no rebalancing, no custody. Cut this before cutting the harvest.

## Verified Dependencies
All checked live 12 Sep 2026. Full detail in `~/.claude/skills/hackathon-briefs/stocklana.md` section 8.
- Multiplier, next multiplier and activation timestamp readable free from the mint (`scaledUiAmountConfig` on AAPLx verified on mainnet).
- Full tick history and forward schedule from an unauthenticated public API.
- Jupiter routes xStocks to USDC with real depth.
- 29 dividend payers with tradeable liquidity; 98.3% of ticks activate while the US market is closed.
- Blocked and excluded: xChange RFQ (needs onboarded issuer account), Pyth Hermes REST (401 without a key). Neither is on the critical path.

## Gates
- **Sun 13 Sep:** verify `spl-token update-ui-amount-multiplier` accepts a future timestamp on devnet; verify Solana Subscriptions and Allowances; re-verify that dividends are reinvestment-only.
- **Mon 15 Sep, end of day:** mainnet harvest path live. This is the binding internal gate, set by the expected STRCx tick.
- **~14-15 Sep:** expected real STRCx multiplier tick, ~0.51%, $335k liquidity. Capture it on video. Primary objective of the week.
- **Fri 18 Sep, 20:00 UTC:** submissions close. Submit early, edit until close.
- **2 Oct:** judging ends. Every submitted link must still resolve on this date.

## Demo Path
1. Wallet holds real mainnet KOx, MCDx and STRCx, roughly $60 bought on Jupiter.
2. Dividend tab shows every past tick per holding and the total quietly reinvested over 12 months.
3. Holder picks a payout rule: cash to wallet, or a bill.
4. Capped delegate approved. On screen: the program can move the increment and nothing else.
5. A real STRCx tick is detected on mainnet. Timestamp lands at 00:30 UTC with the US market shut, so the order queues instead of selling into a thin book.
6. At the open, the harvest executes and USDC arrives. Explorer link shown.
7. Close on the calendar of upcoming ticks read from 732 mainnet mints.
Fallback if no real tick lands: same flow triggered on a devnet mint under our control, labelled as such, with the mainnet detection of a real tick shown alongside.

## Disqualification Checklist
- [ ] Registered, and account username set.
- [ ] Submitted before Fri 18 Sep 20:00 UTC with at least one working link.
- [ ] Deployment survives to 2 Oct. No sleeping free tier.
- [ ] One submission. Open-source components disclosed.
- [ ] No fabricated instruments; every token touched is a real issued xStock.
- [ ] Not marketed into Backed's non-serviceable jurisdictions.

## Collision Search
- **SolanaRWA (solanarwa.app):** snapshots the same multipliers and creates dividend income events for tax reporting in AU, US, UK, CA. Detects and reports; does not execute, sell, or pay. Category served at the reporting layer, execution layer open. State this in the submission rather than letting a judge find it.
- Searched and found nothing that converts a multiplier tick into cash, on Solana or elsewhere.
- **Backed will not build it themselves**, by their own docs: they reinvest rather than distribute cash because cash "would create tax and operational complexity".
- Adjacent and avoided: Symmetry and basketsolana.xyz (index baskets), Jupiter Recurring (DCA), Kamino (borrow against stocks, plus its own automated deleverage).
- Killed during ideation: LP dividend recapture (arb loss is second order, cents on a $2M pool), corporate-action guard SDK (same reason), pooled primary-market block orders (RFQ gate), dividend advance (economics), emerging-market savings framing (Backed does not service Nigeria), Pendle-style dividend strip (two weeks of build, not six days).
