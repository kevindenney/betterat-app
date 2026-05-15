# Race tab card-in-timeline-with-peek pattern is missing

## Summary

The Race Prep flag flip (`EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=false`, now default in `lib/featureFlags.ts:234`) restored the inline-phase-tabs-per-card pattern the user wanted (good). It did not restore the canonical "card sitting inside a horizontal timeline, with peek of adjacent cards on left and right" shell the user described. Investigation finds the **card-in-timeline-with-peek shell was never built** in the form the user describes; the legacy `CardGrid` is the closest existing implementation, with a subtle ~7.5% peek that may not match the user's mental model from the design canonicals.

## Canonical intent

The user references the "Race Prep iOS register Pass A" canonical and "On the Water Pass B" canonical. Neither HTML artifact is banked in `docs/redesign/ios-register/` — only `discover-detail-trio-canonical.html` lives there. The Race Prep iOS canonical was fetched from Claude Design earlier in the migration (commit `b0a6e23b` "add Race Prep cutover prep artifacts") and informed the implementation of `components/ios-register/RaceCardsScreen.tsx`, but the HTML itself was never banked in the repo.

What the user describes as the canonical:

- Horizontal timeline as the spatial container
- Peek of previous step's card visible on left edge
- Peek of next step's card visible on right edge
- Current step's card shows three-phase composition internally
- Direct adjacent-peek-tap navigation between steps; no back-out-and-swipe

What was actually banked from the design pass (per `components/ios-register/RaceCardsScreen.tsx` doc comment): "Apple Books library treatment — a horizontal-scroll deck of 268pt `<StepCard />` covers" with "Open prep →" CTA routing to a separate detail at `/race/ios/[stepId]`. That's a **different** canonical from the timeline-with-peek shell — it's a summary-deck-then-detail pattern, not a timeline-with-content-on-card pattern.

## Current implementation (flag off)

- File: `app/(tabs)/races.tsx:4613` renders `<CardGrid />` when `RACE_PREP_IOS_REGISTER` is false (now the default).
- `CardGrid.native.tsx` (`components/cards/CardGrid.native.tsx`) renders one `<RaceSummaryCard />` per race, with horizontal-swipe navigation between cards.
- Dimensions in `components/cards/constants.ts:351-381` and `constants/navigationAnimations.ts:133-139`:
  - `CARD_WIDTH_RATIO = 0.86` (card is 86% of screen width)
  - `PEEK_WIDTH_RATIO = 0.075` (7.5% peek of adjacent cards visible on each side)
- `<RaceSummaryCard />` (`components/cards/content/RaceSummaryCard.tsx:1646`) renders inline `IOSSegmentedControl` phase tabs (Before / On Water / After or per-interest labels). Phase content renders below the tabs on the same card.

So the legacy CardGrid **does** have peek built in, just subtle: on a 393pt iPhone, that's roughly ~30pt of adjacent card visible on each edge. The user's "Renders each step as a full-screen page, no peek" framing is at odds with this — either the peek is too subtle to read as a timeline shell, or there's a separate rendering path the user is hitting that I haven't traced.

## The delta

What's present after the flag flip:

- ✅ Three-phase composition inside each step (via `IOSSegmentedControl` + `RaceSummaryCard` phase content)
- ✅ Horizontal-swipe navigation between cards (in CardGrid native)
- ✅ Subtle ~7.5% peek of adjacent cards

What the user describes as missing:

- ❌ Prominent enough peek to read as a "timeline shell" rather than a near-full-width card
- ❌ Visual treatment of the timeline as a continuous spatial container (current implementation is more "carousel with hint of next" than "timeline with cards in it")
- ❌ Direct adjacent-peek-tap interaction (current pattern requires either swipe gesture or relying on the subtle peek edge to be tappable, which it currently is not — only the centered card is the gesture target)

## Root cause hypothesis

**Captured in the design pass but the implementation diverged.** The Race Prep cards iOS handoff produced `RaceCardsScreen` (Apple Books library, separate detail) which is structurally different from what the user describes. The pre-cutover legacy CardGrid has timeline + peek + inline tabs but with subtle peek dimensions that don't read as a continuous timeline. The "timeline with prominent adjacent-card peek and inline phase tabs" was either never the canonical produced by Claude Design, or was lost in translation when the cutover spec landed on the Apple-Books-library pattern.

I can't definitively verify without re-fetching the Race Prep iOS canonical from Claude Design and side-by-siding it with `RaceCardsScreen` + the legacy CardGrid. The original HTML isn't in the repo.

## Revertability

**Neither full revert nor flag flip recovers what the user describes.** Three paths exist:

1. **Tune the existing CardGrid peek dimensions.** Increase `PEEK_WIDTH_RATIO` from 0.075 to something larger (e.g. 0.15-0.20) and decrease `CARD_WIDTH_RATIO` accordingly. Makes the peek more prominent without changing any structure. Smallest change; visual-only.
2. **Build a new timeline-with-peek shell as a kit component.** Combine `<RaceCardsScreen />`'s horizontal-scroller chrome with `<RaceSummaryCard />`'s inline-phase-tabs content. New component; touches the cutover branching to wire it. Medium scope.
3. **Re-fetch the Race Prep iOS canonical from Claude Design and verify against current implementations.** If the canonical does match the user's description, option 2 is implementing it; if the canonical actually matches `RaceCardsScreen`, the user's mental model is a third alternative the design hasn't produced yet.

## Recommendation

**Option 3 first** — fetch the Race Prep iOS canonical and bank it at `docs/redesign/ios-register/race-prep-cards-canonical.html` (matching the discover trio precedent). Compare it side-by-side with the current legacy CardGrid render and `RaceCardsScreen`. Decide which canonical the user is actually referencing before designing or building anything. Without that artifact in the repo, "what does the canonical actually say" is open to interpretation, and we just paid the cost of one cutover landing on the wrong canonical.

**Not a Get Inspired Commit 4 blocker.** This is a Race Prep layout decision that affects only the Race tab cards-grid path.
