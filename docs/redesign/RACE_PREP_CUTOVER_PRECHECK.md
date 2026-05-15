# Race Prep Cutover Precheck

Audit date: 2026-05-15

## Gate 1 — `per-interest-beats.ts` shipped
**Status:** GO

**Evidence**
- File exists: [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:1)
- Exported function signature:
  - `export function getBeatsForInterest(interestSlug?: string | null): BeatDef[]`
  - Source: [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:69)
- Interest mappings found:
  - `sail-racing` → `SAILING_BEATS`
  - `nursing` → `CLINICAL_BEATS`
  - generic fallback → `GENERIC_BEATS` with `Beat 1 / Beat 2 / Beat 3`
  - Source: [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:29), [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:35), [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:41), [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:52)
- Note on drawing:
  - Drawing is intentionally unmapped and falls through the generic fallback.
  - Source: [lib/per-interest-beats.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/per-interest-beats.ts:17)

## Gate 2 — `per-interest-beats.ts` verified across interests
**Status:** GO

**Evidence**
- Most recent commit touching the file:
  - `eb992cda feat(redesign): per-interest beat name mapping (data-layer follow-up #7)`
- Git evidence:
  - `git log --follow -- lib/per-interest-beats.ts` returns that commit as the current file-introduction/update point.
- Interpretation:
  - The commit message explicitly references the per-interest beat mapping follow-up and matches the intended cutover dependency.

## Gate 3 — Architecture decision #4 documented
**Status:** GO

**Evidence**
- Relevant section exists in [docs/redesign/IOS_MIGRATION_PLAN.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:330)
- Key passage:

> "**Rule:** level-of-detail surfaces get separate designs, not scaled-down versions of each other. Summary surfaces do navigation; detail surfaces do action."

> "Race Prep cutover is parked until the cards-view iOS design lands. When it does, both surfaces cut over together: `StepDetailContent` → iOS register full-surface; `RaceSummaryCard` → new card-summary iOS variant."

- Source lines: [IOS_MIGRATION_PLAN.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:332), [IOS_MIGRATION_PLAN.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:341)

## Gate 4 — Feature flag pattern from Playbook home cutover is reusable
**Status:** GO

**Evidence**
- Flag config file:
  - [lib/featureFlags.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:213)
- Existing flag name pattern:
  - `PLAYBOOK_IOS_REGISTER`
  - env override: `EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER=false`
  - Source: [lib/featureFlags.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:217), [lib/featureFlags.ts](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:221)
- Canonical render switch pattern:
  - [app/(tabs)/playbook/index.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/playbook/index.tsx:23)
  - `if (FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER) return <PlaybookIosPreview embedded />;`
  - fallback: `return <PlaybookHome />;`
- Related cutover commits:
  - `ae0334fd feat(redesign): cut Playbook home over to iOS register (flag default ON)`
  - `da8c4270 fix(redesign): hide "Preview:" banner on canonical Playbook tab`

## Gate 5 — Existing Race Prep iOS preview route works
**Status:** GO

**Evidence**
- Route file exists:
  - [app/race/ios/[stepId].tsx](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/[stepId].tsx:1)
- Related route definitions also present:
  - [app/race/ios/water/[stepId].tsx](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/water/[stepId].tsx:1)
  - [app/race/ios/debrief/[stepId].tsx](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/debrief/[stepId].tsx:1)
- Approximate size of primary Race Prep route:
  - `app/race/ios/[stepId].tsx` ≈ `23,983` bytes

## Gate 6 — `RaceSummaryCard.tsx` and `StepDetailContent.tsx` exist as modification targets
**Status:** GO

**Evidence**
- `RaceSummaryCard.tsx` exists at:
  - [components/cards/content/RaceSummaryCard.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/cards/content/RaceSummaryCard.tsx:1)
  - Approximate size: `156,845` bytes
- `StepDetailContent.tsx` exists at:
  - [components/step/StepDetailContent.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/step/StepDetailContent.tsx:1)
  - Approximate size: `40,239` bytes
- Note:
  - `RaceSummaryCard.tsx` is not under `components/races/`; the actual path is `components/cards/content/RaceSummaryCard.tsx`

## Summary
- Gate 1: GO
- Gate 2: GO
- Gate 3: GO
- Gate 4: GO
- Gate 5: GO
- Gate 6: GO

No source changes made. This report is based on direct file and git-history checks in the current repo state.
