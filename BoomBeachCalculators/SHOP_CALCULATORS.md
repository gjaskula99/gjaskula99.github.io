# Shop Calculator Feasibility

Research checked on 26 July 2026 against the Boom Beach Wiki, official Supercell support, update notes, and recent player reports where the Wiki image was stale.

## Implemented: Keycard Planner

The most reliable calculator is a Keycard acquisition and recruitment planner. Stable inputs and rules are:

- One recruitment costs one Keycard; a ten-pull costs ten.
- One Keycard costs 200 Card Pieces. The game can perform this conversion automatically during Recruitment.
- Daily Tasks award 100 Card Pieces after completing six tasks, equivalent to one Keycard every two completed days.
- Field Recruitment offers one free pull every 22 hours.
- Elite Recruitment guarantees a Lieutenant or Elite Lieutenant by 80 pulls; if that result is not the Elite Lieutenant, the Elite is guaranteed within the next 80 pulls.
- Cycle of Evil provides one-time Keycards: one for each event at Threat 1 and then one for completing Stage 7 at Threats 2–30, up to 36 per event.

The Keycard Planner is implemented as a separate application tab. It accepts current Keycards, Card Pieces, desired pulls, free-pull usage, Cycle of Evil progress, pity counters, manual income, and a target date. It reports remaining Card Pieces, projected pull availability, timing milestones, and outcome probabilities.

The probability engine embeds Supercell's full attempt-by-attempt tables for Rare Gadgets, Sergeants, Epic Gadgets, and Lieutenants. It applies the published guarantee priority and uses deterministic state propagation instead of random simulation. Elite featured odds default to an editable 50% and support the guaranteed-next state.

## Values suitable for an optional editable shop planner

- Card Piece Shop: 200 Card Pieces for one Keycard; 2,000 for ten. This is unlimited and stable.
- Circuit Block Shop: the March Wiki image lists one Keycard for 100 Circuit Blocks, limited to five monthly, and ten Keycards for 2,000 Circuit Blocks. The ten-pack is twice the per-card price and should be flagged as poor value.
- Recruitment returns Circuit Blocks based on the result: Sergeant 50 (250 after all Talents), Lieutenant 100 (1,000 after all Talents), Common Gadget 2, Rare Gadget 10, and Epic Gadget 70.

These values support a comparison tool, but expected Circuit Block return per pull cannot be calculated accurately without authoritative banner probabilities.

## Volatile data requiring caution

The Shop of Evil changed again on 22–25 June 2026. The Wiki's March offer image still shows one weekly Keycard for 3,000 Evil Coins and one monthly Keycard for 6,000, while the June update added more and cheaper Keycards. Contemporary reports indicate two weekly and two monthly purchases, with 1,000- and 3,000-Evil-Coin offers appearing during the rollout. Because the Wiki table has not caught up and the rollout briefly reverted, these should not be hard-coded as authoritative yet.

The Event Shop and Sonar Shop are temporary and their inventories can rotate. They are better represented by user-editable offers than embedded constants.

## Architecture

Store shop offers as data objects separate from rendering, with fields for shop, input currency, input amount, output item, output amount, quota, reset cadence, verified date, and source. Show the verification date in the UI and allow users to override volatile prices. This avoids another obsolete calculator when Supercell changes a shop without updating its public documentation.

The implemented planner therefore treats volatile offers as manual one-time or weekly Keycard income instead of embedding their prices. A future general shop comparison tool should continue using the data-object design above.
