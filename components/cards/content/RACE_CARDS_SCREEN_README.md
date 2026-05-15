# RaceCardsScreen

## Purpose
`RaceCardsScreen` is the iOS-register summary surface for Race Prep in Race tab cards mode. It is the flag-gated replacement for the legacy Race Prep card path when `RACE_PREP_IOS_REGISTER` is ON. Its job is to render the horizontal timeline-grid summary cards, preserve tap-through into the iOS-register detail route at [`app/race/ios/[stepId].tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/[stepId].tsx:1), and keep the summary surface in the same register family as the Race Prep detail surface.

## Design source
The visual source is Claude Design's Race Prep cards iOS handoff. The canonical design currently lives in Claude Design; export to `docs/redesign/ios-register/` is still pending. Until that export exists, treat the Claude Design artifact as source-of-truth for spacing, card hierarchy, and state styling.

## State grammar
This surface has four visual states. Keep the styling and the status-derivation logic coupled and explicit.

### Planned
Use the planned-state card treatment for future steps that have not started yet.

Expected data conditions:
- no active/live state
- no completed race/debrief outcome
- scheduled/upcoming step context is present

### In progress
Use the in-progress treatment for steps that are underway but not yet completed or debriefed.

Expected data conditions:
- current/live race context
- capture activity may exist
- no completed/debriefed end state yet

### Debriefed
Use the debriefed treatment when the race is complete and reflection content exists.

Expected data conditions:
- `completed_at` present
- review content present
- practical heuristic from the plan: debriefed means `completed_at` exists and review sections are populated

### Current
Use the current-state treatment for the card representing the user's active point on the timeline-grid. This is the navigational "you are here" state, not just a time-based status.

Expected data conditions:
- this card is the active/selected card in the current Race tab cards context
- may overlap with planned or in-progress semantics, but wins visually as the selection state

## Earned register exception
The current card gets the earned exception: iOS blue ring plus stronger semibold treatment. This follows the migration-plan rule that visual weight-up is allowed only when the action is consequential and the surface's primary purpose is that decision. On this screen, the current card is the user's active navigation commitment inside the horizontal timeline-grid, so the stronger treatment is intentional. Do not spread this treatment to non-current cards.

## Architectural relationships
`RaceCardsScreen` is the summary surface. [`app/race/ios/[stepId].tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/[stepId].tsx:1) is the paired detail surface. That pairing comes directly from architecture decision #4 in [`docs/redesign/IOS_MIGRATION_PLAN.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:330): summary and detail are different jobs and get different designs.

Tap target relationship:
- `RaceCardsScreen` → `/race/ios/[stepId]`

Open architecture question:
- `/race/ios/[stepId]` vs `/step/[id]` is still unresolved
- see [`docs/redesign/snippets/step-id-vs-race-ios-followup.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/snippets/step-id-vs-race-ios-followup.md:1)
- today `/step/[id]` remains the deeper legacy step-management surface with comments, sharing, collaborators, and AI extraction

## What v1 does not do
V1 is intentionally narrow.

- No inline edit, delete, or upload actions on the card surface
- No attempt to solve the `/step/[id]` deep-edit parity question here
- No reimplementation of per-interest beat naming; that belongs in [`lib/per-interest-beats.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:1)
- Status derivation has known edge cases, especially mid-race states with partial review content

Parked follow-up:
- inline edit/delete/upload remains out of scope for the first cutover and should be handled as a later architecture follow-up, not smuggled into the summary-surface rollout

## Maintenance notes
When adding new interests to [`lib/per-interest-beats.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:1), this surface should need no code changes. Beat naming and per-interest terminology are delegated.

When adding new race states such as `abandoned` or `rescheduled`, update:
- the status derivation logic in `RaceCardsScreen`
- the visual treatment matrix for cards
- the verification matrix in [`docs/redesign/RACE_PREP_CUTOVER_CHECKLIST.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/RACE_PREP_CUTOVER_CHECKLIST.md:1)

Rollback path:
- the kill switch is the `RACE_PREP_IOS_REGISTER` env override
- disabling it should revert Race tab cards mode to the legacy CardGrid path without touching the detail route code
