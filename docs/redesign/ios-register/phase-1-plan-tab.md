# Phase 1 · Plan Tab — Engineering Brief

**Purpose.** Now that the shared chrome ships (Phase 0), rebuild the Plan tab's *body* into the new register. State pill, step strip, top header, phase tabs, and `StepCard` shell are already in place from Phase 0 — this phase fills the inside of the card.

**Prerequisite.** Phase 0 merged. `PRACTICE_STEP_LOOP_IOS_REGISTER` flag exists and is off in production. Existing tab routes wrap their content in `<StepCard>` when the flag is on.

**Source of truth.**
- `docs/redesign/ios-register/step-loop-integration-canonical.html` §1 (the Plan target frame) + §2 (the universal `+` sheet — *Phase 2 work, do not implement here*) + decisions D1–D5, D7
- `docs/redesign/ios-register/becoming-loop-canonical.html` §2 (the Plan target with capabilities + suggestions + WITH) + decisions D10a, D12a, D12b

Read both end-to-end before writing code.

**Feature flag.** Reuse `PRACTICE_STEP_LOOP_IOS_REGISTER` (do not introduce a new flag — Phase 1 is the natural extension of Phase 0).

---

## Acceptance criteria

A Phase 1 PR is mergeable when:

1. **Plan tab body**, when flag is on, renders the target layout from the canonicals:
   - AI Coach quiet helper line at the top of the body
   - Three field-cards (`WhatCard`, `HowCard`, `WhyCard`) with per-field `✦` AI spark icon
   - Capability chip set above More Options (purple chips, multi-select)
   - Suggestions row above More Options (3 rows: blueprint / follow / mentor)
   - WITH row beneath the title block (crew avatars + fleet/cohort chip — already-visible when set)
   - Bottom CTA `Next: Start Doing →` (disabled until `q1Complete`)
2. **The legacy busy elements retire** (when flag on, not when off):
   - "PLAN" eyebrow + "Start with a clear plan." headline → removed
   - Big green `Track elapsed time` toggle row → moved to More Options as a quiet row (D7 — keep the toggle, demote the placement)
   - FAB at bottom-right → hidden when flag on
   - "1 of 10" step-picker button → replaced by the read-only step counter in `<TopHeader>` (which Phase 0 already shipped)
   - Standalone weather pill in top-right cluster → removed (date-enrichment lives inside More Options via existing `DateEnrichmentCard`)
3. **Wiring preserved.** `planData.what_will_you_do`, `how_sub_steps`, `why_reasoning`, `collaborators`, `where_location`, `competency_ids`, `linked_resource_ids` all still write through to the same `metadata.plan` shape. No schema changes.
4. **Zero off-flag regression.** PlanTab.tsx with flag off renders exactly as today.
5. **One demo route updated.** `/debug/step-loop-primitives` gains a "Plan tab — empty" and "Plan tab — partial" state.

---

## Component APIs

### `<AIHelperLine>`

Quiet italic helper that sits at the top of the plan body when there's nothing in it yet, and shrinks/disappears as the plan fills.

```tsx
type AIHelperState = 'empty' | 'partial' | 'filled';

interface AIHelperLineProps {
  state: AIHelperState;
  onOpenCoach: () => void;
}
```

- `empty`: full line *"✦ Need help structuring this? Talk to AI Coach →"* (11.5px, italic, label-3)
- `partial`: shrinks to *"✦ Open AI Coach"* (small link)
- `filled`: returns `null` — moved into More Options

### `<FieldCard>` (composable for WHAT / HOW / WHY)

```tsx
interface FieldCardProps {
  eyebrow: string;            // "What will you do?"
  icon: 'bulb' | 'list' | 'help';
  placeholder: string;
  value: string;              // controlled
  onChangeText: (v: string) => void;
  onCoachPress: () => void;   // per-field ✦ spark opens AI Coach scoped to this field
  multiline?: boolean;
  readOnly?: boolean;
}
```

- White card, 0.5px gray-5 border, radius 12, padding 11/14
- Eyebrow: 10px / 700 / 0.9 ls / upper / label-2
- `✦` spark in top-right: 22×22 circle, ios-purple-tint background, ios-purple icon
- Placeholder: 13.5 / italic / label-3
- Filled text: 13.5 / label / regular

### `<CapabilityChipSet>` (D10a)

```tsx
interface CapabilityChipSetProps {
  selected: { id: string; label: string }[];
  onRemove: (id: string) => void;
  onAddPress: () => void;       // opens existing CompetencyPickerModal
  // Source-of-tagging note shown beneath the chips
  autoTagSource?: string;       // "Sam Cooke's heavy-air blueprint"
}
```

- Section header eyebrow: *"✦ Capabilities this will develop"* (sparkles purple)
- "+ tag" link on the right of the eyebrow row
- Chips: purple-tint background, purple-soft border, 11.5 / 500 / -0.05ls, x-glyph on the right
- Hint line under chips: *"Auto-tagged from {autoTagSource} · tap chip to edit"*

### `<SuggestionsRow>` (D12a)

```tsx
type SuggestionKind = 'blueprint' | 'follow' | 'mentor';
interface SuggestionRowItem {
  kind: SuggestionKind;
  title: string;
  subtitle: string;       // includes byline + relationship ("Sam Cooke · blueprint you follow")
  onPress: () => void;
}
interface SuggestionsRowProps {
  items: SuggestionRowItem[];     // 0–3
  onSeeAll: () => void;
}
```

- Section eyebrow + "See all →" link
- Each row: 22×22 icon tile (blueprint = blue tint, follow = gray, mentor = purple tint) + title + subtitle + chevron-right
- Rows divide by 0.5px hairline

### `<WithRow>` (D12b)

```tsx
interface WithRowProps {
  crew?: { id: string; initials: string; avatarColor?: string }[];   // overlap stack
  fleetLabel?: string;     // "Fleet · 14 boats" or "Cohort · 23 peers"
  fleetIcon?: 'anchor' | 'users';
  empty?: boolean;         // when no crew/fleet — show "+ add crew" affordance instead
  onCrewPress?: () => void;
  onFleetPress?: () => void;
}
```

- Sits beneath the title block (or beneath the state-head when no title block)
- 33px tall, FAFAFC background, top + bottom hairlines
- Eyebrow "With" (9.5 / 700 / 0.9ls / upper)
- Avatars: 22×22 with -8px overlap, 1.5px white border
- Fleet chip: 22px tall, gray-6 background, anchor/users icon, label

### `<BottomCTA>` (D3)

Reuse the pattern from `StepCard`'s footer slot. Pass:

```tsx
<StepCard footer={
  <BottomCTA
    label="Next: Start Doing"
    icon="arrow-right"
    disabled={!q1Complete}
    disabledHint="Add a what to enable"
    onPress={() => navigateToPhase('do')}
  />
}>
  …
</StepCard>
```

- Disabled state: gray-5 background, label-3 text, label-4 icon
- Active state: ios-blue, white, shadow
- Hint below: 10.5px / label-3 / centered

---

## How to wire the changes in `PlanTab.tsx`

The current file is large but the change pattern is uniform. Behind the flag:

1. **Strip the brain-dump block** and the conversational-capture block (those stay live only when flag is off, since their replacements live in the Universal `+` sheet shipping in Phase 2).
2. **Replace the AI Coach card** (currently a full purple card with `RECOMMENDED FIRST MOVE` eyebrow) with `<AIHelperLine state={derivedFromPlanContent} />`.
3. **Replace the inline `PlanQuestionCard` instances** for WHAT/HOW/WHY with `<FieldCard>`. Wire the same `planData` fields. The existing `q1Complete`/`q2Complete`/`q3Complete` derivations stay.
4. **Replace the existing "CAPABILITIES THIS DEVELOPS" `PlanQuestionCard`** with `<CapabilityChipSet>` positioned above More Options (not buried in it).
5. **Add `<SuggestionsRow>`** above More Options. Source items from existing `useCrossInterestSuggestions`, `useSubscribedBlueprints`, `useFollowsRecentSteps` — combine, rank by recency × relevance, cap at 3.
6. **Add `<WithRow>`** beneath the `<StepCard>`'s title block. Wire to `planData.collaborators` + step's fleet/cohort id.
7. **Hide the FAB** (`.fab` in StyleSheet, or whatever wraps the new-step affordance). Behind flag only.
8. **The big green `Track elapsed time` row** retires from the body. The plumbing (`step.is_timed`, `onToggleTimed`) keeps working — move the toggle UI into `<MoreOptions>` as a quiet row matching the WITH-row pattern.
9. **Wrap the footer in `<BottomCTA>`** with `q1Complete` as the enabled gate.

The current `WITH WHOM (optional)` and `WHERE (optional)` `PlanQuestionCard` blocks: leave them inside More Options as-is for this phase. Adding them to the visible body would crowd the field-cards. Phase 1 ends with them still in More Options.

---

## Files to touch

| File | What changes |
|---|---|
| `components/step/plan-tab/AIHelperLine.tsx` (new) | Quiet helper line component |
| `components/step/plan-tab/FieldCard.tsx` (new) | Composable WHAT/HOW/WHY card |
| `components/step/plan-tab/CapabilityChipSet.tsx` (new) | Chip set + auto-tag hint |
| `components/step/plan-tab/SuggestionsRow.tsx` (new) | 3-row network suggestions |
| `components/step/plan-tab/WithRow.tsx` (new) | Crew + fleet/cohort row |
| `components/step/plan-tab/BottomCTA.tsx` (new) | Reusable footer CTA wrapper |
| `components/step/plan-tab/index.ts` | Barrel — also export `PlanTabInterior` updates |
| `components/step/PlanTab.tsx` | Wire the new components behind the flag |
| `components/step/StepPlanQuestions.tsx` | Same wiring on the card-view path |
| `services/SuggestionsService.ts` (new) | Combines blueprint / follow / mentor sources, returns top-3 |
| `app/debug/step-loop-primitives.tsx` | Add Plan-empty + Plan-partial demo states |

No schema changes. No new database tables. The new components read from the existing `planData` shape.

---

## Visual fidelity

The exact target frame to match:

- **`step-loop-integration-canonical.html` · §1** — left frame: the empty Plan state with AI helper line + three field-cards + timed-row + More Options + bottom disabled CTA
- **`becoming-loop-canonical.html` · §2** — the same Plan view filled in: WITH-row populated, WHAT card filled, capabilities chip set, suggestions row visible, CTA enabled

When in doubt, the canonical's HTML/CSS is the spec. Numeric tolerance: ±1pt.

---

## What this PR does *not* do

Explicitly out of scope (Phase 2+):

- **Universal `+` sheet** (D6) — Phase 2. Top-header `+` continues to do whatever it does today.
- **Do tab anything** (D7 capture types, D17 timing demotion, etc.) — Phase 3.
- **Reflect tab anything** (D8 synthesis, D10b cap-confirm, D9 star retire) — Phase 4.
- **Capability spine plumbing for Do/Reflect/Profile** — Phase 5. Plan-side capability chips work today; downstream surfaces still treat them as today.
- **Hinges** — Phase 9.
- **Playbook, network browsing, share, fleet view, HKDW onboarding** — later phases.

Phase 1 ends with a refreshed Plan tab. Everything else unchanged.

---

## Suggested Claude Code prompt (paste verbatim)

```
I want you to implement Phase 1 of the iOS register migration: the Plan tab body.
Phase 0 has shipped — shared chrome (StatePill, StepStrip, TopHeader, PhaseTabs,
StepCard, tabbar rename) exists behind PRACTICE_STEP_LOOP_IOS_REGISTER.

Read these three files end-to-end first:
  1. docs/redesign/ios-register/phase-1-plan-tab.md          ← the brief
  2. docs/redesign/ios-register/step-loop-integration-canonical.html
     — §1 target frame + decisions D1-D5, D7
  3. docs/redesign/ios-register/becoming-loop-canonical.html
     — §2 target frame + decisions D10a, D12a, D12b

Then implement per the brief's acceptance criteria. Specifically:
  • Six new components in components/step/plan-tab/:
    AIHelperLine, FieldCard, CapabilityChipSet, SuggestionsRow, WithRow, BottomCTA
  • SuggestionsService that combines blueprint / follow / mentor sources
  • Rewire components/step/PlanTab.tsx and StepPlanQuestions.tsx to use the new
    components behind PRACTICE_STEP_LOOP_IOS_REGISTER
  • Cut on flag: "PLAN" eyebrow + headline, big green Track-elapsed-time row from
    body (move to More Options), FAB, step-picker button, weather pill
  • Add Plan-empty + Plan-partial states to /debug/step-loop-primitives

Out of scope (do not touch):
  • Universal + sheet (Phase 2)
  • Do tab (Phase 3)
  • Reflect tab (Phase 4)
  • Capability spine plumbing beyond Plan (Phase 5)

No schema changes. Reuse existing planData fields.

Wiring preserved: what_will_you_do, how_sub_steps, why_reasoning, collaborators,
where_location, competency_ids, linked_resource_ids all write through to the
existing metadata.plan shape.

When done: open a PR with the brief's checklist filled in. Include before/after
screenshots of Plan empty, Plan partial, Plan filled, with the flag off and on.

Ask me clarifying questions before writing code if anything in the brief is
ambiguous or conflicts with the current codebase.
```

---

## After Phase 1 ships

Verify with the flag on:

1. **Plan empty** — AI helper line visible at top; three field-cards as the dominant content; no purple AI card; no PLAN eyebrow; no green elapsed-time toggle visible (it's in More Options); CTA disabled with hint *"Add a what to enable"*; no FAB.
2. **Plan partial** — WHAT card filled; HOW/WHY placeholders; AI helper line still present at small-link size; CTA enabled.
3. **Plan filled** — All three field-cards filled; capability chip set populated (auto-tagged from blueprint or AI); suggestions row showing real network items; WITH-row populated; CTA enabled.
4. **Flag off** — identical to current production build.

When green: merge, ask in the design workspace for `phase-2-universal-plus-sheet.md`.
