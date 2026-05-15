# Race tab card layout regression

## Summary

User reports that the Race tab currently shows a single-card-per-screen summary view with horizontal swipe and an "Open prep →" CTA that pushes to a separate detail screen. They want the previous pattern where each card showed phase-tab content **inline on the card itself**, with no tap-to-detail step.

This is a side effect of the Race Prep cards iOS register cutover. Both render paths remain in the code; revertable via a single env-flag flip with zero file changes.

## Current behavior

- Entry: Race tab cards-grid render path (`app/(tabs)/races.tsx:4591`).
- Conditional: `FEATURE_FLAGS.RACE_PREP_IOS_REGISTER ? <RaceCardsScreen … /> : <CardGrid … />` — flag default ON in `lib/featureFlags.ts:233`.
- Render shape: `<RaceCardsScreen />` (`components/ios-register/RaceCardsScreen.tsx`) renders the Apple-Books-library treatment — a horizontal-scroll deck of 268pt `<StepCard />` covers. Each card shows: race-of, race number, race name, status pill, conditions chips, captures, concepts. The "current" card carries an "Open prep →" CTA.
- Tap behavior: tap-through routes to `/race/ios/[stepId]` (`app/race/ios/[stepId].tsx` — the iOS-register Race Prep detail surface). Phase content (Practice / Playbook / Reflect or the equivalent per-interest tabs) lives on that detail screen, not on the card.
- Net: one screen for browsing the season arc (cards), a second screen for working on a step (detail).

## Previous behavior

- Entry: same — `app/(tabs)/races.tsx`, before the cutover this was `<CardGrid />` (legacy) unconditionally.
- Render shape: `<CardGrid />` (`components/cards/CardGrid.native.tsx`, `CardGrid.web.tsx`) renders one card at a time but each card is a `<RaceSummaryCard />` (`components/cards/content/RaceSummaryCard.tsx`).
- Each `<RaceSummaryCard />` renders **inline phase tabs** via `IOSSegmentedControl` (line 1646) with phase content rendered directly below the tabs on the same card. Phase labels come from `useInterestEventConfig().phaseLabels` (`days_before` / `on_water` / `after_race` plus interest-specific variations).
- No tap-to-detail. The card is the workspace; phase switching happens in-place on the card.
- The user's framing — "three tabs structure inline on each card" — describes this RaceSummaryCard + IOSSegmentedControl pattern.

## Commit that introduced the change

- **`01c6af34 feat(redesign): cut Race Prep cards over to iOS register (flag default ON)`**, 2026-05-15
  - Added `<RaceCardsScreen />` import (line 43)
  - Added `raceCardsScreenItems` adapter that shapes `filteredCardGridRaces` into the `RaceCardItem` grammar (lines 3905-3970)
  - Added the conditional render-switch at line 4591
  - Flag added in `lib/featureFlags.ts:233` defaulted to `true`
- Same-day docs commit `6a86f4e8 docs(redesign): mark Race Prep cutover shipped + add /step/[id] follow-up` recorded the cutover in `IOS_MIGRATION_PLAN.md` and surfaced the architectural follow-up #11 ("step-id vs race-ios detail-surface split") — which is *exactly* the question the user is now raising.

## Cause assessment

**Intentional iOS register migration side effect.** The Race Prep cards cutover was a planned commit in the iOS register migration plan, executed with explicit design rationale (Apple Books library treatment, summary-vs-detail split as resolved register decision #4). The previous inline-tabs pattern was kept as the flag-off fallback by design.

The cutover landed without simulator verification of the resulting UX flow at the time — the visual was verified in the preview route, but the broader question of "does mandatory tap-to-detail match how people actually use this tab?" wasn't part of the cutover's verification matrix. Follow-up #11 in the migration plan explicitly flagged this as an open architectural question post-cutover, which the user is now answering: tap-to-detail is too many taps for the Race tab's primary use.

## Revertability

**Trivial — single env flag flip, zero file changes required.**

- `EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=false` in `.env` (or wherever feature-flag overrides live) restores the legacy `<CardGrid />` render path immediately.
- Both render paths remain intact in `app/(tabs)/races.tsx`. The legacy `<CardGrid />`, `<RaceSummaryCard />`, and `IOSSegmentedControl` machinery were never deleted — they're the flag-off fallback by design (per `01c6af34`'s "scope is intentionally narrower" framing).
- Once the flag is flipped, the next app reload renders the previous inline-tabs-per-card pattern. No build step, no migration, no data change.
- Optional cleanup: if the decision is permanent, the new code path (`<RaceCardsScreen />`, `raceCardsScreenItems`, `<StepCard />`, the conditional branch in `races.tsx:4591`) can be deleted in a follow-up cleanup commit. The components remain useful for other contexts (Reflect → Race Log iOS uses similar StepCard primitives via different wiring), so the kit itself shouldn't be removed.

## Recommendation

**Flag the old behavior on immediately, then decide whether to remove the new code path or keep it dormant.** Specifically:

1. **Immediate (today):** set `EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=false` to restore the inline-tabs pattern the user wants. The visual reverts on app reload with no risk to data or other surfaces.
2. **Short-term decision (this week):** decide whether the iOS-register-summary-with-detail pattern is the wrong shape for the Race tab specifically, or whether it might come back later under a different surface architecture. Capture the decision in `docs/redesign/IOS_MIGRATION_PLAN.md` as a register-decision update (paired with follow-up #11's resolution).
3. **Longer-term cleanup (when convenient):** if the decision is "never use the iOS-register summary cards for the Race tab," delete the conditional branch and the `raceCardsScreenItems` adapter in `races.tsx`, leaving the kit components intact for other consumers. If the decision is "maybe later under different framing," leave the flag-off path as-is — the dormant code is cheap.

The cutover's stated revert path (`"Revert is a single flag flip if production regressions surface"` from the commit body) is exactly what this situation calls for. No design re-litigation needed before the flip; the flip is reversible and unblocks the user immediately.

## Related architectural follow-up

This finding closes out **open architecture follow-up #11** (`/step/[id]` vs `/race/ios/[stepId]` detail-surface split) from `IOS_MIGRATION_PLAN.md`. The user's preference for inline-tabs-on-card answers the open question: the second detail surface isn't wanted at all — the card IS the workspace. When the migration plan is updated post-decision, follow-up #11 should be marked resolved with the inline-tabs preference as the answer.
