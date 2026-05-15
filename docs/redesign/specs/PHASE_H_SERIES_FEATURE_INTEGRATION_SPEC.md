# Phase H Spec: Series Feature Integration

## Goal

Redesign the existing Series/Season surface around the iOS register canonical without rebuilding the underlying data model. The production app already has Season infrastructure: `seasons`, `season_regattas`, `race_events.season_id`, `SeasonService`, `useCurrentSeason`, `useUserSeasons`, `useSeasonRegattas`, a Season picker modal, and a `Jump to` picker inside `app/(tabs)/races.tsx`. Phase H turns that working infrastructure into the canonical surface: a Series strip in zoomed-out view, an iOS action sheet for switching Series, Series context on step-card headers, and a canonical `Jump to` sheet opened from the `6 of 14` counter.

This phase uses "Series" as the universal product concept, but the visible label is vocabulary-aware per the Phase A.10 model: sailing sees `Season`, nursing sees `Term`/`Rotation` depending on vocabulary, drawing sees `Workshop`/`Series`, fitness sees `Block`/`Training Block`, and interests without overrides fall back to `Series`.

## Source Canonicals

- Visual canonical: `docs/redesign/ios-register/series-feature-canonical.html`.
- Vocabulary precedent: Phase A.10 / `lib/navigation-config.ts` preserves universal tab identity with community-language labels.
- Existing implementation: `app/(tabs)/races.tsx`, `components/seasons/SeasonPickerModal.tsx`, `components/seasons/SeasonSettingsModal.tsx`, `hooks/useSeason.ts`, `services/SeasonService.ts`, `types/season.ts`, and `components/races/RacesFloatingHeader.tsx`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify the current implementation still matches this spec:

```bash
test -f docs/redesign/ios-register/series-feature-canonical.html
test -f app/(tabs)/races.tsx
test -f components/seasons/SeasonPickerModal.tsx
test -f components/seasons/SeasonSettingsModal.tsx
test -f components/races/RacesFloatingHeader.tsx
test -f hooks/useSeason.ts
test -f services/SeasonService.ts
test -f types/season.ts
rg -n "useCurrentSeason|useUserSeasons|useSeasonRegattas|filterSeasonId|activeFilterSeasonId|showSeasonPicker|showStepPicker|Jump to|SeasonPickerModal|SeasonSettingsModal" app/\(tabs\)/races.tsx
rg -n "seasonLabel|onSeasonPress|onStepPickerPress|currentRaceIndex|totalRaces" components/races/RacesFloatingHeader.tsx
rg -n "season_id|seasonWeek|raceNumber|totalRaces|useRaceSeriesPosition" components/cards/content/RaceSummaryCard.tsx
rg -n "'Period'|vocab\\('Period'|getEventTabTitle|Learning Event" lib/navigation-config.ts lib/vocabulary.ts app/\(tabs\)/races.tsx components/seasons components/races
```

Expected current state:

- `app/(tabs)/races.tsx` owns Season state with `filterSeasonId`, derives `activeFilterSeasonId`, reads `useCurrentSeason`, `useUserSeasons`, and `useSeasonRegattas`, and renders `SeasonPickerModal`, `SeasonSettingsModal`, and an inline `Modal` titled `Jump to`.
- `RacesFloatingHeader` already displays `seasonLabel` and a separately tappable `currentRaceIndex of totalRaces` counter through `onStepPickerPress`.
- `SeasonPickerModal` already accepts `periodTerm` and `eventNounPlural`, but its visual treatment is a generic picker, not the canonical Frame 2 action sheet.
- `RaceSummaryCard` already accepts `seasonWeek`, `raceNumber`, and `totalRaces`, but the current Series context is not rendered as the canonical chip + tappable counter treatment.
- `lib/vocabulary.ts` exposes the existing `Period` vocabulary term, which is the right v1 source for visible Series labels. If execution needs a helper, add one rather than hardcoding `Season`.

If the step picker has moved out of `app/(tabs)/races.tsx`, or if `SeasonPickerModal`/`SeasonSettingsModal` no longer exist, stop and surface. If the app has introduced a non-Season Series model for non-sailing interests, stop and reconcile before editing.

## Reality-Check Findings From Spec Write

- The existing "step picker" is already titled `Jump to` in `app/(tabs)/races.tsx`; Phase H is not a string-only rename. It must extract/restyle the current inline modal into the canonical near-full-height `Jump to` sheet and keep the title.
- The current Season feature is sailing-shaped at the data layer. Generic vocabulary is already present through `vocab('Period')`, but the persisted model is still named `seasons`. This phase should not rename tables or create a new generalized Series schema.
- `MASTER_IMPLEMENTATION_BACKLOG.md` already uses Phase H for the public org catalog. Until the human renumbers backlog phases, this spec keeps the requested filename and title but indexes the backlog entry as `H.0` to avoid overwriting the existing public-org Phase H.

## Commit Boundaries

### Commit 1: Flag and Series Vocabulary Helper

Files:

- `lib/featureFlags.ts`
- `lib/navigation-config.ts` or new `lib/series-vocabulary.ts`
- `lib/__tests__/series-vocabulary.test.ts` or nearest existing test location

Add:

```ts
PRACTICE_SERIES_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER', false),
```

Add a helper for canonical Series copy. Prefer a small new module if adding this to `navigation-config.ts` would mix bottom-nav concerns with timeline copy:

```ts
export type SeriesVocabulary = {
  singular: string;
  plural: string;
  switchAction: string;
  allLabel: string;
};

export function getSeriesVocabulary(input: {
  vocabulary?: Record<string, string> | null;
  interestSlug?: string | null;
  activeDomain?: string | null;
}): SeriesVocabulary {
  const slug = String(input.interestSlug || input.activeDomain || '').toLowerCase().trim();
  const rawPeriod = input.vocabulary?.Period?.trim();
  const singular =
    rawPeriod ||
    (slug === 'sail-racing' || slug === 'sailing' ? 'Season' :
      slug === 'nursing' ? 'Term' :
      slug === 'drawing' ? 'Workshop' :
      slug === 'fitness' || slug === 'health-and-fitness' ? 'Block' :
      'Series');

  const plural = singular.endsWith('s') ? singular : `${singular}s`;
  return {
    singular,
    plural,
    switchAction: `Switch ${singular.toLowerCase()}`,
    allLabel: `All ${plural}`,
  };
}
```

Implementation note: if `vocab('Period')` returns `Rotation` for nursing, use that value. The hardcoded nursing `Term` fallback only applies when no vocabulary row/fallback is available.

Commit message:

```text
feat(practice): add flagged Series vocabulary helper
```

### Commit 2: Canonical Series Strip for Zoomed-Out View

Files:

- `components/practice/series/SeriesStrip.tsx`
- `components/practice/series/index.ts`
- `components/practice/series/__tests__/SeriesStrip.test.tsx`
- `app/(tabs)/races.tsx`

Create a presentational `SeriesStrip` for canonical Frame 1:

```ts
export interface SeriesStripProps {
  label: string;              // Season / Rotation / Series
  name: string;               // Winter 2025-2026
  currentIndex: number;       // 6
  totalSteps: number;         // 14
  progress: number;           // 0..1
  dateRange?: string;
  onPress: () => void;
}
```

Render it only when `FEATURE_FLAGS.PRACTICE_SERIES_IOS_REGISTER && isGridView`. It belongs between the top interest header/toolbar and the zoomed-out timeline content, matching the canonical "white card slotted between the interest header and the timeline." Reuse the existing `displaySeason`, `headerCurrentRaceIndex`, `headerTotalRaces`, and `setShowSeasonPicker(true)` data/handlers. Do not add new queries.

Fallback behavior:

- If no active/display season exists, render nothing in v1. Do not invent a `No Series` strip; the existing Season settings flow already handles creation.
- If `headerCurrentRaceIndex` is missing, use `0` for progress but still show `0 of N` only if `N > 0`.

Commit message:

```text
feat(practice): add canonical Series strip to zoomed-out timeline
```

### Commit 3: Restyle Switch-Series Action Sheet

Files:

- `components/seasons/SeasonPickerModal.tsx`
- Optional: `components/practice/series/SeriesPickerSheet.tsx` if extracting is cleaner
- Tests for any extracted component

Behind `PRACTICE_SERIES_IOS_REGISTER`, restyle the existing `SeasonPickerModal` to match canonical Frame 2:

- Title uses vocabulary: `Switch season`, `Switch rotation`, `Switch series`, etc.
- Active Series row shows date range and progress, e.g. `Nov 1, 2025 - May 31, 2026 · 6 of 14 · Active`.
- Past/completed Series are readable choices.
- Keep `All {eventNounPlural}` only if the existing `All Races` behavior is still needed for legacy navigation; the canonical says Series is the frame, not a filter, so the new flagged UI should de-emphasize all-time mode. If removing the all-time option changes behavior too much, keep it at the bottom as `All history` and document in the commit body.
- `Manage {Series}` remains available but secondary.

Do not change the data semantics of `onSelectSeason`. Existing `null` still means all-time, `undefined` still means current/default, and string still means a specific season. This commit changes presentation and copy only.

Commit message:

```text
feat(practice): restyle Series switcher action sheet
```

### Commit 4: Step Card Series Context and Tappable Counter

Files:

- `components/races/RacesFloatingHeader.tsx`
- `components/cards/content/RaceSummaryCard.tsx`
- `components/cards/types.ts` if a small prop addition is needed
- `app/(tabs)/races.tsx`
- Tests for the extracted header/chip if practical

Implement canonical Frame 3:

- Show a small Series chip in the step card header using the active Series name (`Winter 2025-2026`) and a subtle mark/icon.
- Turn `6 of 14` into an explicit pill with blue tint, chevron, and accessibility label: `Jump to another step in this {seriesLabel}`.
- Tapping the pill opens the existing `showStepPicker` flow.

Preferred implementation: pass the existing `onStepPickerPress` or a new `onJumpToPress` callback from `app/(tabs)/races.tsx` to the active card only, rather than introducing a global event bus. If `RaceSummaryCard` cannot receive that callback without broad type churn, keep the header-level counter as the tappable affordance in v1 and record "card-level counter tap" as follow-up. Do not break card paging gestures.

This commit must preserve flag-off behavior. When `PRACTICE_SERIES_IOS_REGISTER=false`, existing `RacesFloatingHeader` and `RaceSummaryCard` output should be visually unchanged.

Commit message:

```text
feat(practice): add Series context to step card headers
```

### Commit 5: Extract and Canonicalize Jump-To Picker

Files:

- `components/practice/series/JumpToPickerSheet.tsx`
- `components/practice/series/__tests__/JumpToPickerSheet.test.tsx`
- `app/(tabs)/races.tsx`

Extract the inline `showStepPicker` modal from `app/(tabs)/races.tsx` into a presentational `JumpToPickerSheet` and restyle it to canonical Frame 4:

```ts
export interface JumpToPickerItem {
  id: string;
  index: number;
  title: string;
  statusLabel: 'Plan' | 'Do' | 'Reflect' | 'Done' | 'Viewing' | 'Up Next' | 'Planned';
  dateLabel?: string;
  isCurrent?: boolean;
  isCompleted?: boolean;
}

export interface JumpToPickerSheetProps {
  visible: boolean;
  seriesLabel: string;
  seriesName: string;
  currentIndex: number;
  totalSteps: number;
  items: JumpToPickerItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}
```

Use existing `orderedBaseCardGridRaces` mapping logic for v1. The sheet should be near-full-height, dim the current card behind it, include a header with `Back`, `Jump to`, and close affordance, show `{Series name} · {N} steps`, show a progress bar, and highlight the current step in iOS blue. Keep the underlying handler behavior: select item, call `handleGoToStep(item.id)`, leave grid view if needed, close sheet.

Commit message:

```text
feat(practice): extract canonical Jump-to picker sheet
```

### Commit 6: Polish, Accessibility, and Visual Verification

Files:

- Existing files touched in commits 2-5 only
- `docs/redesign/MASTER_IMPLEMENTATION_BACKLOG.md`
- `docs/redesign/screenshots/phase-h-series-frame-1-strip.png`
- `docs/redesign/screenshots/phase-h-series-frame-2-switcher.png`
- `docs/redesign/screenshots/phase-h-series-frame-3-card-context.png`
- `docs/redesign/screenshots/phase-h-series-frame-4-jump-to.png`

Polish:

- Ensure labels use vocabulary consistently: `Season`, `Rotation`, `Series`, etc.
- Add accessibility labels and hints to the Series strip, switcher rows, card counter pill, and Jump-to rows.
- Verify no production code imports from `app/`.
- Update backlog status only after simulator verification.

Commit message:

```text
docs(redesign): mark Phase H Series integration verified
```

## Files to Change

- `lib/featureFlags.ts`
- `lib/series-vocabulary.ts` or `lib/navigation-config.ts`
- `app/(tabs)/races.tsx`
- `components/races/RacesFloatingHeader.tsx`
- `components/cards/content/RaceSummaryCard.tsx`
- `components/cards/types.ts` only if needed for a narrow prop pass-through
- `components/seasons/SeasonPickerModal.tsx`
- New files under `components/practice/series/`
- Tests under `components/practice/series/__tests__/`
- `docs/redesign/MASTER_IMPLEMENTATION_BACKLOG.md` only in the final verification/status commit

## Files to Not Change

- Do not change database schema, migrations, `types/season.ts`, or `services/SeasonService.ts` unless reality check shows the UI cannot be driven from existing data.
- Do not rename the `seasons` table or `season_regattas`; generic Series naming is UI vocabulary only in this phase.
- Do not touch Phase B.5 Plan tab internals, B.6 Add Step flow, Do tab, Reflect tab, or Profile tab.
- Do not change route structure (`/practice` vs `/races`); Phase A.8 owns route semantics.
- Do not import preview-route components from `app/`.
- Do not alter the old public-org Phase H backlog entry except through a separate renumbering decision.

## Cutover Flag

Required, default OFF:

```text
EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=false
```

This is a substantive visual and control-flow change: it alters zoomed-out timeline chrome, the Series switcher, card header affordances, and the step navigation sheet. It does not qualify for the mechanical-only exception.

Rollback path while staged: set `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=false`. The existing Season picker and inline `Jump to` modal remain the fallback.

## Test Approach

Automated checks:

```bash
npm run typecheck
npm run lint
npx jest components/practice/series --runInBand
rg -n "PRACTICE_SERIES_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER" lib app components --glob '*.{ts,tsx}'
rg -n "from ['\\\"]app/" app components lib hooks --glob '*.{ts,tsx}'
```

Component test coverage:

- `getSeriesVocabulary` returns vocabulary override first, then interest fallback, then `Series`.
- `SeriesStrip` renders label, name, `current of total`, progress width, and press handler.
- `JumpToPickerSheet` highlights the current item, calls `onSelect`, calls `onClose`, and renders the Series subhead.

Simulator verification with flag ON:

```bash
EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=true npx expo start
```

Verify against `series-feature-canonical.html`:

- Frame 1: zoomed-out timeline shows the Series strip with vocabulary label, active Series name, progress, count, and chevron.
- Frame 2: tapping the strip opens the switch-Series sheet; active, past, and optional all-history rows behave correctly.
- Frame 3: step card header shows Series context and a tappable `N of M` pill.
- Frame 4: tapping the counter opens the canonical `Jump to` sheet; selecting a row navigates to that step and closes the sheet.
- Vocabulary smoke test: sailing reads `Season`; nursing uses `vocab('Period')` such as `Rotation`; fallback interest reads `Series`.

Flag-off regression:

- Launch without the flag.
- Existing Season picker and inline `Jump to` behavior remain unchanged.
- Existing card paging, filter state, current step restoration, and Season settings still work.

## Rollback Path

Immediate rollback is one environment edit: `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=false`. Because Phase H does not change schema or stored data, no migration rollback is required. If code removal is needed, revert implementation commits in reverse order, starting with the polish/status commit and ending with the flag/helper commit.

## Risks and Open Questions

- **Phase ID collision:** `MASTER_IMPLEMENTATION_BACKLOG.md` currently uses Phase H for the public org catalog. This spec is named per the user request but should be indexed as `H.0` or renumbered by the human before long-term backlog cleanup.
- **Series is still a Season-shaped data model:** `seasons` and `season_regattas` are sailing-origin names. UI vocabulary can say `Rotation` or `Series`, but non-sailing semantics may eventually require a generalized period/series table. That is out of scope for this UI integration.
- **All-history mode vs canonical Series frame:** current code supports `All Races` via `filterSeasonId=null`; the canonical says Series is the frame, not a filter. V1 should preserve all-history behavior but visually subordinate it unless product explicitly removes it.
- **Card-level tap scope:** the canonical puts the `6 of 14` pill on the card. If threading `onJumpToPress` into card content is broad, keep the header counter as the v1 tap target rather than destabilizing card types.
- **Gesture conflict:** the card-level counter must not steal horizontal card swipes. Use small, explicit `Pressable` hit targets and verify on simulator.
