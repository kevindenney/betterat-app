# Phase B.7 Spec: Interest Switcher Action Sheet

## Goal

Upgrade the existing interest switcher into the canonical iOS action sheet for multi-interest users. The surface lets users switch the active Practice-engine interest, shows lightweight per-interest activity context, and exposes Add / Manage interest actions. This phase does not change the Practice tab route, bottom-tab identity, or timeline data model.

Phase A.10 applies here: the first bottom tab’s identity is the universal Practice engine, but its visible label adapts to community vocabulary. The interest switcher should say “Switch interest” and update the active interest; it should not force the bottom tab label to “Practice” for every community.

## Source Canonicals

- Design addendum: `docs/redesign/FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, Surface A: Interest Switcher.
- Visual canonical: `docs/redesign/ios-register/four-small-surfaces-canonical.html`, Frame 1: Interest switcher.
- Route/label decision: `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md`, Phase A.10 outcome.
- Existing implementation: `components/InterestSwitcher.tsx`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

```bash
sed -n '1,360p' components/InterestSwitcher.tsx
sed -n '1,120p' providers/InterestProvider.tsx
sed -n '4300,4460p' app/'(tabs)'/races.tsx
sed -n '1,140p' components/navigation/NavigationHeader.tsx
rg -n "openInterestSwitcher|<InterestSwitcher|switchInterest|userInterests|toggleDomainView|viewMode" app components providers hooks lib -g '*.{ts,tsx}'
rg -n "PRACTICE_INTEREST_SWITCHER_IOS|FF_PRACTICE_INTEREST_SWITCHER" lib .env* app components
```

Verified at spec-write time:

- `components/InterestSwitcher.tsx` already provides the trigger pill, modal bottom sheet, active checkmark, add-interest route to Discover, and `openInterestSwitcher()` imperative opener.
- `providers/InterestProvider.tsx` exposes `currentInterest`, `userInterests`, `groupedInterests`, `switchInterest`, `removeInterest`, `viewMode`, `effectiveInterestIds`, and `toggleDomainView`.
- `app/(tabs)/races.tsx` imports `openInterestSwitcher` and uses it for the guest “Wrong interest?” escape hatch.
- `components/navigation/NavigationHeader.tsx` mounts `<InterestSwitcher />` in the web/Tufte header.

Stop and surface if:

- `InterestSwitcher` has been moved or split.
- `switchInterest(slug)` no longer persists active interest.
- A `PRACTICE_INTEREST_SWITCHER_IOS` flag already exists under a different name.

## Commit Boundaries

### Commit 1: Flag and Activity Summary Helpers

Message:

```text
feat(redesign): add flagged interest switcher helpers
```

Files:

- `lib/featureFlags.ts`
- New `components/interest-switcher/interestSwitcherActivity.ts`
- New `components/interest-switcher/__tests__/interestSwitcherActivity.test.ts` or matching test convention.

Add flag:

- `PRACTICE_INTEREST_SWITCHER_IOS`
- Env override: `EXPO_PUBLIC_FF_PRACTICE_INTEREST_SWITCHER_IOS`
- Default: `false`

Helper API:

```ts
import type { Interest } from '@/providers/InterestProvider';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export type InterestActivitySummary =
  | { kind: 'active'; label: string }
  | { kind: 'idle'; label: string }
  | { kind: 'empty'; label: string };

export function summarizeInterestActivity(input: {
  interest: Interest;
  steps: TimelineStepRecord[];
  now?: Date;
}): InterestActivitySummary;
```

Rules:

- If no steps for the interest: `{ kind: 'empty', label: 'No steps yet' }`.
- If there is at least one non-completed step: label `Step X of Y · Active`, where X is the 1-based index of the first non-completed step by existing sort order.
- If all steps are completed and the most recent step was updated/completed within 7 days: label `${count} steps this week`.
- Otherwise label `Idle N days`, using most recent `updated_at`, `completed_at`, or `created_at`.

The helper is intentionally generic; it does not know whether the bottom tab label is Race, Practice, Shift, or Session.

### Commit 2: Canonical Sheet Layout

Message:

```text
feat(redesign): render iOS interest switcher sheet
```

Files:

- `components/InterestSwitcher.tsx`
- Optional new `components/interest-switcher/InterestSwitcherSheet.tsx`

Keep `openInterestSwitcher()` and the existing trigger pill public API. Behind `FEATURE_FLAGS.PRACTICE_INTEREST_SWITCHER_IOS`, render the canonical sheet:

- Title: `Switch interest`
- Each row: icon/glyph or color dot, interest name, activity subtitle, active checkmark.
- Action group: `Add a new interest`, `Manage interests`.
- Cancel row.

Legacy flag-off behavior remains the current sheet.

Icon source:

- Use `interest.icon_name` when it maps cleanly to an Ionicon.
- Otherwise use the existing accent-color dot. Do not invent emoji mappings in this phase.

Action behavior:

- Selecting an interest calls `switchInterest(interest.slug)`, dismisses the sheet, and leaves the current bottom tab mounted.
- `Add a new interest` routes to the existing Discover interests surface: `router.push({ pathname: '/(tabs)/discover', params: { segment: 'interests' } })`.
- `Manage interests` routes to an existing settings/manage-interest route only if one exists. If no route exists, show the row disabled with helper text “Manage interests is coming next.” Do not create a new management screen in this phase.
- Cancel dismisses without changing state.

### Commit 3: Wire Activity Data Without N+1 Fetches

Message:

```text
feat(redesign): add interest activity summaries to switcher
```

Files:

- `components/InterestSwitcher.tsx`
- Optional `hooks/useInterestActivitySummaries.ts`

Use existing timeline data if it is already available in context or query cache. If a hook is needed, query `timeline_steps` once for all `userInterests` using `.in('interest_id', ids)`, then group client-side. Do not issue one query per interest row.

If current app code does not have a simple all-interest hook, implement the data access in a new hook:

```ts
export function useInterestActivitySummaries(interests: Interest[]): {
  summariesByInterestId: Record<string, InterestActivitySummary>;
  isLoading: boolean;
  error: Error | null;
}
```

The sheet must remain usable while summaries load; show `Loading activity...` or omit subtitles until data arrives.

## Files to Change

- `lib/featureFlags.ts`
- `components/InterestSwitcher.tsx`
- Optional files under `components/interest-switcher/`
- Optional `hooks/useInterestActivitySummaries.ts`
- Tests for summary helper logic.

## Files to NOT Change

- Do not change `lib/navigation-config.ts`; A.10 resolved the tab-label model as correct.
- Do not change `app/(tabs)/races.tsx` except if execution discovers the trigger cannot open the new sheet without a small prop/API adjustment. If that happens, stop and rescope because A.9 must clear `races.tsx` warnings first.
- Do not create the Manage interests screen.
- Do not implement “All interests” unified view; the addendum explicitly defers it to v2.
- Do not change `providers/InterestProvider.tsx` persistence semantics unless the existing API is broken.

## Cutover Flag

Required. This is a substantive UI replacement with new data reads and action rows.

- Flag: `PRACTICE_INTEREST_SWITCHER_IOS`
- Env override: `EXPO_PUBLIC_FF_PRACTICE_INTEREST_SWITCHER_IOS`
- Default: `false`

## Test Approach

Unit tests:

- `summarizeInterestActivity` returns `No steps yet` for empty interest.
- It returns `Step X of Y · Active` for the first non-completed step.
- It returns recent completion copy when all steps are complete and updated within 7 days.
- It returns `Idle N days` for stale activity.

Manual simulator checks:

- Open the active first tab via `/practice` or the existing bottom tab.
- Tap the interest chip.
- Verify title, active checkmark, activity subtitles, Add row, Manage row, and Cancel.
- Switch from Sail Racing to Nursing; content updates and bottom-tab label remains vocabulary-driven per A.10.
- Use guest “Wrong interest?” link in `app/(tabs)/races.tsx`; it still opens the same sheet.

Run:

```bash
npm run typecheck
npx eslint components/InterestSwitcher.tsx --ext .tsx --max-warnings 0
```

If execution touches `app/(tabs)/races.tsx`, A.9 must already be complete and `npx eslint app/'(tabs)'/races.tsx --ext .tsx --max-warnings 0` must pass.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_INTEREST_SWITCHER_IOS=false` to return to the current switcher. Revert commits in reverse order if the helper query introduces issues.

## Risks and Open Questions

- Activity subtitles can become expensive if implemented as one query per interest. The spec requires one grouped query or cache reuse.
- Manage interests is designed but not implemented. This phase should expose the row only as disabled or route to an existing screen if one is verified.
- A.10 means the switcher changes active interest, not global tab vocabulary. Do not hardcode “Practice” as the visible bottom-tab label.
