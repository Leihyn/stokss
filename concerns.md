# concerns.md: stokss

[C] Demo failure: under the devnet-first decision the harvest executes on a fixture mint, so the demo MUST show real mainnet DETECTION of a real corporate action alongside it, and MUST label the devnet harvest as devnet every single time it appears. Presenting a devnet event as mainnet breaks the one invariant this product is built on. The mainnet cutover in PLAN Section 7 stays open if funding lands.
[C] Timing: the mainnet harvest path must be live, the crank running and STRCx enrolled by end of Sunday 13 Sep, hard stop Monday 14 Sep 22:00 UTC, ahead of the expected STRCx activation on Mon 14 Sep ~23:00 UTC. (Corrected by critique: the earlier "Monday 15 Sep" is not a Monday. 15 Sep 2026 is a Tuesday.) The crank must be running BEFORE activation, not after: the tick-watcher only detects a change between two observations, and enroll snapshots the current multiplier, so a tick that fires first is unharvestable forever. Missing that window costs the strongest evidence in the submission.
[C] Custody: the program must be provably unable to move more than the dividend increment. A capped delegate and a bounded delta are the only things standing between us and "why would I trust your keeper".
[C] Link survival: every submitted link must still resolve on 2 October. Judging runs two weeks past the deadline.
[C] Correctness: delta must be computed in RAW units against the on-chain multiplier pair. A scaled-vs-raw mistake silently moves the wrong amount of a real security.
[I] Dust: a 0.06% tick on a $200 position is $0.12. Without an accrual floor and cross-user batching, fees eat the payout and the product looks broken.
[I] Positioning: lead with the tax liability, not with income preference. Nobody is publicly asking for cash dividends; people are taxed on distributions they never received.
[I] Scope: the buy front door and bill routing are approved additions, not the core. They get cut before the harvest does.
[A] Design polish: the UI should look considered, but a working real harvest outranks a beautiful empty state.
[A] Long tail: only 29 of 338 dividend payers are tradeable. Do not promise the other 309.
