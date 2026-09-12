# SUBMISSION-CHECKLIST: Stocklana

Platform: hackathons.solana.com (not Devpost/DoraHacks/Devfolio). Simple form, few required fields, so the risk is not the form. The risk is link rot during a two-week judging window.

## Hard facts
- Submissions close **Fri 18 Sep 2026, 4:00pm ET / 20:00 UTC**.
- Judging runs **through 2 Oct 2026**. Every link must still resolve on that date.
- Edits are allowed until submissions close. Submit early, keep editing.
- One submission per team. Original work. Open-source components fine if disclosed.

## Required
- [ ] Registered on the site (done) and **account username set** (the site prompts for it; teammate invites depend on it)
- [ ] At least ONE link: GitHub, live demo, or video. We are shipping all three (demoFormat=both).
- [ ] Teammates invited from the submit form (solo entry: n/a)

## Our links
- [ ] GitHub repo public, README explains the mechanic in the first paragraph
- [ ] Live app deployed on a host that does not sleep (judged 2 Oct)
- [ ] Demo video uploaded and playable without login

## Disclosure
- [ ] Open-source components named (Anchor, Jupiter API, xStocks public API, Token-2022)
- [ ] Keeper trust model stated: the program can only ever move the dividend increment
- [ ] SolanaRWA named as the adjacent product (detects the same ticks for tax, does not execute)
- [ ] No fabricated instruments; every token touched is a real issued xStock

## T-6 hours (Fri 14:00 UTC)
1. Submission form complete, status SUBMITTED not draft
2. Test every URL from an incognito window
3. Confirm the video plays
4. Screenshot the submitted state

## T-2 hours (Fri 18:00 UTC)
1. Re-run the demo end to end
2. Update the video if the UI changed materially

## T-30 minutes (Fri 19:30 UTC)
1. Code freeze. Stop adding features.
2. Verify status is SUBMITTED
3. Screenshot

## At deadline
No last-minute changes. Ship what works.

## Post-deadline, before 2 Oct
- [ ] Weekly check that the deployed link and video still resolve
- [ ] If a real STRCx or QQQx tick fires during judging, capture it and add it to the README as evidence (edits to the repo are allowed; the submission itself is frozen)
