# Phase B Spec: Rename Phase Tabs to Plan / Do / Reflect

## Goal

Rename the three phase tabs inside step/event cards to the canonical language from `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md`: `Plan`, `Do`, `Reflect`. This phase is copy-only and route-neutral. It does not change the internal phase keys (`days_before`, `on_water`, `after_race`), data shape, card layout, or timeline behavior.

The verified current state is mixed. Timeline steps in `components/cards/content/RaceSummaryCard.tsx` override the config and render `Before / During / After`. Non-timeline events read `eventConfig.phaseLabels[phase].short`, and every interest config currently uses domain-specific labels such as sailing `Before / Racing / Review`, nursing `Prep / Clinical / Debrief`, design `Research / Create / Critique`, and self-mastery `Intent / Practice / Reflect`.

`types/interestEventConfig.ts` confirms `phaseLabels` is part of `InterestEventConfig` and remains a `Record<RacePhase, PhaseLabels>`, where `PhaseLabels` is `{ full: string; short: string }`. The implementation should therefore change values only, not the config contract.

## Files to Change

- `/Users/kdenney/Developer/BetterAt/betterat-app/components/cards/content/RaceSummaryCard.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/lib/step-category-config.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/sailing.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/nursing.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/generic.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/global-health.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/regenerative-agriculture.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/painting-printing.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/drawing.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/fitness.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/fiber-arts.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/lifelong-learning.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/self-mastery.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/design.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/configs/knitting.ts`

## Files to Not Change

- Do not rename phase keys. `RacePhase` remains `days_before | on_water | after_race`.
- Do not rename content components such as `ReflectPhaseContent`, `AfterRaceContent`, or data helpers that use “review” as a domain concept.
- Do not change landing-page marketing copy in `components/landing/*`; that vocabulary is outside the in-app Practice timeline.
- Do not change Discover read-only journey components in `components/discover/*`; those are separate surfaces.

## Step-by-Step Changes

1. In `RaceSummaryCard.tsx`, replace `TIMELINE_STEP_PHASE_LABELS`:

```ts
const TIMELINE_STEP_PHASE_LABELS: Record<RacePhase, string> = {
  days_before: 'Plan',
  on_water: 'Do',
  after_race: 'Reflect',
};
```

Update the adjacent comment to say canonical labels are universal per `PRACTICE_TIMELINE_CANONICAL.md`. Remove the old claim that the mockup uses `Before/During/After`.

2. In the same `phaseIntro` block, update `timelineStepDescriptions` to canonical empty-state-adjacent language:

```ts
const timelineStepDescriptions: Record<RacePhase, string> = {
  days_before: "What's the plan for this step?",
  on_water: 'Ready to start? Capture what you do or observe.',
  after_race: 'How did it go? Notes appear here after you have done some of the work.',
};
```

3. In every listed `configs/*.ts` file, set the `phaseLabels` object to:

```ts
phaseLabels: {
  days_before: { full: 'Plan', short: 'Plan' },
  on_water: { full: 'Do', short: 'Do' },
  after_race: { full: 'Reflect', short: 'Reflect' },
},
```

This intentionally removes per-interest tab vocabulary from the tab control. Interest-specific vocabulary can still appear inside phase content modules, card descriptions, checklists, and copy.

Verified current values to replace:

- `configs/sailing.ts`: `Days Before / On Water / After Race`, short `Before / Racing / Review`.
- `configs/nursing.ts`: `Pre-Clinical / On Shift / Debrief`, short `Prep / Clinical / Debrief`.
- `configs/generic.ts`: `Preparation / In Progress / Review`, short `Prep / Active / Review`.
- `configs/global-health.ts`: `Planning / On Mission / Post-Mission`, short `Plan / Mission / Debrief`.
- `configs/regenerative-agriculture.ts`: `Planning / In Field / Harvest Review`, short `Plan / Field / Review`.
- `configs/painting-printing.ts`: `Planning / In Studio / After Session`, short `Plan / Create / Critique`.
- `configs/drawing.ts`: `Planning / In Session / After Session`, short `Plan / Draw / Critique`.
- `configs/fitness.ts`: `Pre-Workout / Working Out / Post-Workout`, short `Prep / Train / Review`.
- `configs/fiber-arts.ts`: `Planning / In Studio / After Session`, short `Plan / Create / Review`.
- `configs/lifelong-learning.ts`: `Preparation / In Session / Integration`, short `Prep / Session / Integrate`.
- `configs/self-mastery.ts`: `Intention / Practice / Reflection`, short `Intent / Practice / Reflect`.
- `configs/design.ts`: `Research / Creating / Critique`, short `Research / Create / Critique`.
- `configs/knitting.ts`: `Planning / In Session / After Session`, short `Plan / Knit / Review`.

4. In `lib/step-category-config.ts`, replace every `tabs` value with:

```ts
tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
```

This covers `DEFAULT_LABELS`, `NUTRITION_LABELS`, `STRENGTH_LABELS`, `CARDIO_LABELS`, `HIIT_LABELS`, `SPORT_LABELS`, `RACE_DAY_CHECK_LABELS`, and `READING_LABELS`. Keep category-specific `actHeader`, `planHeader`, placeholders, and guidance unchanged.

Do not rename `review` in `tabs.review`; that key is part of `StepCategoryLabels` and is not user-facing. Only the string value changes.

5. In `app/(tabs)/races.tsx`, update the comment at line 4743 from `Plan/Do/Review` to `Plan/Do/Reflect`. This is comment-only but prevents future agents from restoring `Review`.

## Test Impact Assessment

Repo grep found no test assertions that directly expect `Before`, `During`, `After`, `Days Before`, `On Water`, `After Race`, or `Plan/Do/Review` as phase-tab labels. Existing tests mentioning “After” are unrelated comments or review-section tests. After implementation, run:

```bash
npm run typecheck
rg -n "Before|During|After|Prep|Clinical|Debrief|Racing|Critique|Plan/Do/Review" components/cards/content/RaceSummaryCard.tsx app/'(tabs)'/races.tsx lib/step-category-config.ts configs --glob '*.{ts,tsx}'
```

The second command should return no phase-tab label remnants in the changed files except unrelated content copy and comments outside `phaseLabels`.

If snapshots or simulator-driven checks exist outside the grep scope, update them only when they assert visible copy. Do not update tests that assert internal keys like `days_before`, `on_water`, `after_race`, or `review`; those keys intentionally remain stable.

## Analytics Impact Assessment

No analytics events were found that encode phase-tab display names. Do not rename event keys or metadata fields in this phase. If analytics payloads include internal phase keys, keep them unchanged because they are data identifiers, not user-facing labels.

## Rollback Path

Revert the commit. No migration, route, or feature flag cleanup is required.

## Cutover Flag

No cutover flag is recommended. This is a mechanical label normalization with no behavior change. A flag would create avoidable copy divergence across interest configs and would not reduce functional risk.
