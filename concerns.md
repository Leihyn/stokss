# concerns.md: stokss

[C] Demo failure: a real mainnet multiplier tick must be detected, harvested and settled end to end, with an explorer link. A devnet-only demo is a discounted fallback, not the plan.
[C] Timing: the mainnet harvest path must be live by end of Monday 15 Sep, ahead of the expected STRCx tick around 14-15 Sep. Missing that window costs the strongest evidence in the submission.
[C] Custody: the program must be provably unable to move more than the dividend increment. A capped delegate and a bounded delta are the only things standing between us and "why would I trust your keeper".
[C] Link survival: every submitted link must still resolve on 2 October. Judging runs two weeks past the deadline.
[C] Correctness: delta must be computed in RAW units against the on-chain multiplier pair. A scaled-vs-raw mistake silently moves the wrong amount of a real security.
[I] Dust: a 0.06% tick on a $200 position is $0.12. Without an accrual floor and cross-user batching, fees eat the payout and the product looks broken.
[I] Positioning: lead with the tax liability, not with income preference. Nobody is publicly asking for cash dividends; people are taxed on distributions they never received.
[I] Scope: the buy front door and bill routing are approved additions, not the core. They get cut before the harvest does.
[A] Design polish: the UI should look considered, but a working real harvest outranks a beautiful empty state.
[A] Long tail: only 29 of 338 dividend payers are tradeable. Do not promise the other 309.
