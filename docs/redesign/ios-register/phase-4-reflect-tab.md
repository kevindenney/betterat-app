# Phase 4 · Reflect Tab — Engineering Brief

**Purpose.** Replace today's star-rating form with the synthesis-led prose surface from the canonicals. The user lands on Reflect after the Do tab's *Move to Reflect* button or by tapping the Reflect phase tab. The body is built around their own words — a synthesis prompt at the top offering to draft from captures, two italic-serif question cards, a capabilities-you-practiced confirmation section, and a coral mic as the primary compose affordance.

**Prerequisites.** Phases 0, 1, 1-refinements, 2, 3 merged.

**Source of truth.**
- `docs/redesign/ios-register/step-loop-integration-canonical.html` §3 (Reflect current vs target) + decision **D8**
- `docs/redesign/ios-register/becoming-loop-canonical.html` §3 (Reflect with capabilities-you-practiced) + decision **D10b**
- `docs/redesign/ios-register/debrief-canonical.html` — pixel-level reference for the synthesis prose + italic-serif question pattern

Read all three end-to-end before writing code.

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`. No new flag.

---

## What lands

A rebuilt Reflect tab body that, when flag is on, replaces today's stack (overall-rating stars, "What didn't?" textarea, "What did you learn?" textarea, "Anything else worth noting?" textarea, FAB) with a synthesis-led surface:

1. **State pill** (already in card header from Phase 0) — purple *"Reflect · ready"* when the user lands; flips green *"Settled"* on Save & settle
2. **Step strip** — same component
3. **Title block** — surfaces the step's final title (AI-suggested or user-named), step result line (*"Saturday · just now · finished 7th of 14"* for sailing; per-interest copy elsewhere)
4. **WITH row** (from Phase 1) — crew avatars + fleet/cohort chip carry forward
5. **Phase tabs** — Plan ✓ Do ✓ Reflect active
6. **`<SynthesisPrompt>`** — purple `✦ Draft from your captures` eyebrow + italic-serif prompt offering an AI first draft. Tap to draft, tap to dismiss
7. **Two `<ReflectField>` cards** — *What worked?* and *What would you do differently?* — italic-serif question cards the user fills in voice or text. Per-interest question pair (sailing uses these; nursing uses *What worked well today? / Where do you need more practice?*; drawing uses *What clicked? / What's still rough?*)
8. **`<CapabilitiesPracticed>`** — list of AI-pre-filled capabilities the user confirms ✓, removes, or adds to. Each row carries a strength badge (Worth noting / Material / Strong). Section header *"Capabilities you practiced"* with `+ add` link
9. **`<MicPrompt>`** — large coral mic centered at the foot of the body. Hint: *"Hold to speak · or type"*
10. **Bottom CTA `<SaveAndSettleCTA>`** — ios-blue primary `Save & settle →`. On tap: state pill flips purple → green, step closes, focus advances to the next planned step

---

## Acceptance criteria

A Phase 4 PR is mergeable when:

1. Reflect tab body, flag on, renders the target layout from the canonicals — purple state pill, synthesis prompt at top, two italic-serif question cards, capabilities-practiced section, coral mic, Save & settle CTA
2. Per-interest question pair resolves correctly:
   - Sailing → *"What worked?"* / *"What would you do differently?"*
   - Nursing → *"What worked well today?"* / *"Where do you need more practice?"*
   - Drawing → *"What clicked?"* / *"What's still rough?"*
   - Generic → *"What stuck?"* / *"What's still unclear?"*
3. Synthesis prompt's *"Tap to draft"* hits the existing transcription/summary service and returns a serif italic draft populated into the first question card; user can keep, edit, or discard
4. Capabilities-practiced list pre-fills from AI suggestion based on captures (reuse the B.7 Frame 4 mark-as-evidence logic — same multi-select, same strength rating, just rendered as a Reflect-tab section instead of a sheet). Toggle ✓ confirms, removes drops, `+ add` opens the existing competency picker
5. Coral mic press-and-hold writes voice into whichever question card has focus (defaults to the first if none expanded); on first dictation if no card expanded, spawn a third *"Anything else?"* card to hold the dictation
6. `Save & settle` button: disabled when **both question cards are empty AND no voice has been captured** (hint: *"Write a line or hold to speak"*); enabled otherwise; on tap, state pill animates purple → green over 300 ms, step `status` becomes `settled`, capability evidence rows write through to `step_capability_evidence`
7. Today's busy elements retire (flag on):
   - Star rating row → removed entirely (no replacement; reflection lives in prose)
   - "Anything else worth noting?" textarea → replaced by the dictation-spawned card pattern in #5
   - FAB → hidden
   - The bottom buttons stack (`Analyze My Progress`, `Review Complete`, `Update Review`, `Create Next Step`, `Share with Coach`) → consolidated. `Save & settle` is the only primary; `Analyze My Progress` moves into the step menu (⋮) as a secondary action; `Share with Coach` becomes part of the share sheet shipping in Phase 8
8. Existing reflection writes-through preserved — `reflect.what_worked`, `reflect.what_didnt`, `reflect.what_learned`, `reflect.feedback_visibility` all keep writing to the same DB shape. Star rating field nulls out on schema migration; no UI to set it going forward
9. Flag off → zero regression
10. Debug route gains a "Reflect · ready" + "Reflect · settling" demo state

---

## Component APIs

### `<SynthesisPrompt>`

```tsx
interface SynthesisPromptProps {
  capturesCount: number;       // shown in copy: "Want a first draft from your 9 captures?"
  onDraft: () => Promise<string>;     // hits the synthesis service, returns draft text
  onDismiss: () => void;
}
```

- Layout: 14-px purple sparkles glyph + *"Draft from your captures"* caps eyebrow (10/700/0.8 ls / upper / purple-deep) above an italic-serif prose prompt
- Default copy: *"Want a first draft from your {n} captures? **Tap to draft**, or write the first line yourself."*
- Tap "Tap to draft": fires `onDraft`, returns a draft string, populates the first `<ReflectField>` with it, marks that field as `kind: 'ai-drafted'` (user can edit any text)

### `<ReflectField>`

```tsx
interface ReflectFieldProps {
  qEye: string;            // "What worked?" / "What worked well today?" / "What clicked?"
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;    // default: "Tap to write"
  isDrafted?: boolean;     // when populated from synthesis, render text in italic until user touches
}
```

- Same anatomy as `<FieldCard>` from Phase 1: white card, 0.5-px gray-5 border, radius 12, 10 / 12 padding
- But: question eyebrow + italic-serif body (`<FieldCard>` uses italic placeholder, plain typed text; `<ReflectField>` uses italic serif throughout because reflection is prose, not form-filling)
- Auto-grow per D26 — no internal scrollbars
- Reuse the auto-grow pattern from Phase 1 refinements

### `<CapabilitiesPracticed>`

```tsx
type EvidenceStrength = 'worth-noting' | 'material' | 'strong';

interface CapabilityEvidenceRow {
  capabilityId: string;
  capabilityName: string;
  confirmed: boolean;
  strength: EvidenceStrength;
  pipLevel: number;        // 0-5 for the multi-dot indicator
  evidenceCount: number;   // "3 captures evidence this"
}

interface CapabilitiesPracticedProps {
  rows: CapabilityEvidenceRow[];
  onToggleConfirm: (id: string) => void;
  onChangeStrength: (id: string, s: EvidenceStrength) => void;
  onAddCapability: () => void;   // opens existing competency picker
}
```

- Section eyebrow with sparkles glyph: *"Capabilities you practiced"* + `+ add` link on the right
- Each row: confirm-check (filled green when on, gray-3 outline when off) · capability name + pip indicator · strength badge + evidence-count meta
- Strength badges: Worth-noting (gray), Material (blue-tint), Strong (green-tint)
- Hint line at the bottom: *"AI tagged these from your {n} captures · tap to confirm or remove"*

### `<MicPrompt>`

```tsx
interface MicPromptProps {
  activeFieldId?: string;        // when a question card is focused, recording writes there
  onTranscript: (fieldId: string, text: string) => void;
  onSpawnAnythingElseField: () => void;
}
```

- 56-px coral mic button centered in the body
- Coral shadow + subtle pulse when idle, intense pulse during recording
- If no `activeFieldId` and user starts recording: call `onSpawnAnythingElseField` to create a third *"Anything else?"* card, then route the transcript there

### `<SaveAndSettleCTA>`

```tsx
interface SaveAndSettleCTAProps {
  enabled: boolean;
  disabledHint: string;     // "Write a line or hold to speak"
  onSettle: () => Promise<void>;     // writes evidence, flips state, navigates
}
```

- ios-blue primary when enabled; gray-5 disabled when not
- Same anatomy as `<BottomCTA>` from Phase 1
- On tap: 300 ms state-pill animation purple → green, then route to the next planned step's Plan view (or the timeline if no next step exists)

---

## Per-interest config (extend Phase 3's INTEREST_DO_TAB_CONFIG)

Add a sibling map:

```tsx
// lib/interest-config.ts
export const INTEREST_REFLECT_TAB_CONFIG = {
  sailing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What worked?', 'What would you do differently?'],
    synthesisDraftCopy: (n: number) =>
      `Want a first draft from your ${n} captures? **Tap to draft**, or write the first line yourself.`,
  },
  nursing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What worked well today?', 'Where do you need more practice?'],
    synthesisDraftCopy: (n: number) =>
      `Want a first draft from your ${n} observations? **Tap to draft**, or write the first line yourself.`,
  },
  drawing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What clicked?', "What's still rough?"],
    synthesisDraftCopy: (n: number) =>
      `Want a first draft from your ${n} notes? **Tap to draft**, or write the first line yourself.`,
  },
  generic: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What stuck?', "What's still unclear?"],
    synthesisDraftCopy: (n: number) =>
      `Want a first draft from your ${n} captures? **Tap to draft**, or write the first line yourself.`,
  },
};
```

---

## Files to touch

| File | What changes |
|---|---|
| `components/step/reflect-tab/SynthesisPrompt.tsx` (new) | Purple AI draft prompt |
| `components/step/reflect-tab/ReflectField.tsx` (new) | Italic-serif question card with auto-grow |
| `components/step/reflect-tab/CapabilitiesPracticed.tsx` (new) | Multi-select capability rows with strength |
| `components/step/reflect-tab/MicPrompt.tsx` (new) | Coral mic + spawn-anything-else logic |
| `components/step/reflect-tab/SaveAndSettleCTA.tsx` (new) | Footer CTA with disabled-hint behavior |
| `components/step/reflect-tab/index.ts` (new) | Barrel |
| `components/step/ReflectTab.tsx` | Rewire to use new components behind flag |
| `lib/interest-config.ts` | Add `INTEREST_REFLECT_TAB_CONFIG` map |
| `services/SynthesisService.ts` (new or extend existing) | The draft endpoint hitting the AI summarizer |
| `services/CapabilityEvidenceService.ts` (new or extend) | The AI capability-tagging proposal + write to `step_capability_evidence` |
| `app/debug/step-loop-primitives.tsx` | Add Reflect-ready + Reflect-settling states |

Schema:
- Add `step_capability_evidence` if not already in place: `id, step_id, capability_id, confirmed, strength, evidence_capture_ids[], created_at`
- Migrate existing `reflect.overall_rating` to NULL; remove its write path

---

## Visual fidelity

Match these reference frames:

- `becoming-loop-canonical.html` §3 — full Reflect target with the capabilities-practiced section
- `step-loop-integration-canonical.html` §3 right pane — Reflect target without the capability section (earlier version, still valid for the synthesis prompt + question cards + mic anatomy)
- `debrief-canonical.html` — for italic-serif question card detail at larger scale

Numeric tolerance ±1pt.

---

## What this PR does *not* do

Out of scope (later phases):

- **Phase 5 · Capability spine plumbing for Profile** — Reflect writes `step_capability_evidence`; the Profile capability map's update logic and the Becoming hero ship in Phase 5
- **Phase 6 · Playbook tab** — concept refinement happens on Playbook, not Reflect
- **Phase 8 · Share with Coach** — the bottom of today's Reflect screen has a `Share with Coach` button; that consolidates into the universal step-share sheet shipping in Phase 8. For Phase 4, hide it on flag
- **Faculty Competency Assessment surface** — Patricia's nursing grading view is its own surface for a different user role (faculty); separate phase
- **Hinge** — Phase 9. After Save & settle, route to the next planned step's Plan view; the hinge surface between steps lands later

---

## Suggested Claude Code prompt (single comprehensive instruction)

Paste this verbatim. It covers download → copy → audit → read → implement → verify → commit, end-to-end.

```
Implement Phase 4 of the iOS register migration: the Reflect tab refresh.

STEP-BY-STEP — do all of these, in order. Do not skip any. Ask clarifying
questions only between steps, not before starting.

STEP 1 · Get the brief and reference canonicals into the repo.

  The latest project zip from claude.ai (e.g. "BetterAt Redesign (5).zip"
  in ~/Downloads) contains the Phase 4 brief. If your existing zip does
  not include docs/redesign/ios-register/phase-4-reflect-tab.md, ask me
  to download a fresh project zip — do not proceed until the file is
  present.

  Once you have the zip:
    mkdir -p docs/redesign/ios-register
    cp "<zip-extract-path>/docs/redesign/ios-register/phase-4-reflect-tab.md" \
       docs/redesign/ios-register/
    # Reference canonicals — copy any that aren't already in-repo:
    cp "<zip-extract-path>/docs/redesign/ios-register/becoming-loop-canonical.html" \
       docs/redesign/ios-register/ 2>/dev/null || true
    cp "<zip-extract-path>/docs/redesign/ios-register/step-loop-integration-canonical.html" \
       docs/redesign/ios-register/ 2>/dev/null || true
    cp "<zip-extract-path>/docs/redesign/ios-register/debrief-canonical.html" \
       docs/redesign/ios-register/ 2>/dev/null || true

  Verify: `head -20 docs/redesign/ios-register/phase-4-reflect-tab.md`
  should show "# Phase 4 · Reflect Tab — Engineering Brief".

STEP 2 · Commit the brief on its own branch.

  git checkout -b docs/phase-4-reflect-tab-brief
  git add docs/redesign/ios-register/
  git commit -m "docs: add iOS register Phase 4 Reflect tab brief"
  git push origin docs/phase-4-reflect-tab-brief

  Open a PR for the brief, merge it to main before continuing.

STEP 3 · Audit the worktree.

  Check `git status` for uncommitted work. If anything dirty conflicts
  with Phase 4's target files (ReflectTab.tsx, anything in components/step/
  matching reflect-* or capability-* paths), stop and ask before proceeding.
  Otherwise continue.

STEP 4 · Read the brief and canonicals end-to-end FIRST, before writing code.

  Required reading, in this order:
    1. docs/redesign/ios-register/phase-4-reflect-tab.md
    2. docs/redesign/ios-register/becoming-loop-canonical.html — §3
    3. docs/redesign/ios-register/step-loop-integration-canonical.html — §3
    4. docs/redesign/ios-register/debrief-canonical.html

  The brief is the source of truth. Where it disagrees with a canonical,
  the brief wins. Where the brief is silent and a canonical has a value
  (padding, color, animation duration), use the canonical's value.

STEP 5 · Implement per the brief.

  Specifically:
    • Five new components in components/step/reflect-tab/:
      SynthesisPrompt, ReflectField, CapabilitiesPracticed, MicPrompt,
      SaveAndSettleCTA
    • INTEREST_REFLECT_TAB_CONFIG map in lib/interest-config.ts
      (sibling to Phase 3's INTEREST_DO_TAB_CONFIG)
    • New SynthesisService (or extension of existing) for the AI draft
      endpoint
    • New CapabilityEvidenceService (or extension) for the proposal +
      write-through to step_capability_evidence
    • Rewire components/step/ReflectTab.tsx behind PRACTICE_STEP_LOOP_IOS_REGISTER
    • Cut on flag: star rating row, "Anything else worth noting?" textarea,
      FAB, the bottom action stack (consolidate into Save & settle + ⋮ menu)
    • Schema: add step_capability_evidence if not present;
      migrate reflect.overall_rating to NULL (no UI to set going forward)
    • Add Reflect-ready + Reflect-settling demo states to
      /debug/step-loop-primitives

  Per-interest question pair must resolve correctly for sailing, nursing,
  drawing, and generic. Test all four.

STEP 6 · Verify all 10 acceptance criteria in the brief.

  In the simulator with the flag on, walk through:
    • Reflect landing — purple pill, synthesis prompt, two italic-serif
      question cards, capabilities list, coral mic
    • Per-interest copy switches correctly (sailing / nursing / drawing /
      generic)
    • Synthesis "Tap to draft" hits the service and populates question 1
    • Coral mic press-and-hold writes voice to focused field or spawns
      "Anything else?"
    • Save & settle: disabled when both fields empty + no voice;
      enabled otherwise; on tap, pill flips purple → green, step closes,
      focus advances to next planned step
    • Star rating, "Anything else" textarea, FAB are all gone on flag
    • Flag off → identical to today's Reflect

STEP 7 · Commit coherent units and open the implementation PR.

  Suggested commit structure:
    1. feat(reflect): add step_capability_evidence schema + migration
    2. feat(reflect): SynthesisPrompt + SynthesisService
    3. feat(reflect): ReflectField + auto-grow text inputs
    4. feat(reflect): CapabilitiesPracticed + CapabilityEvidenceService
    5. feat(reflect): MicPrompt with dictation routing
    6. feat(reflect): SaveAndSettleCTA + state-pill flip animation
    7. feat(reflect): rewire ReflectTab.tsx behind feature flag
    8. feat(reflect): INTEREST_REFLECT_TAB_CONFIG per-interest map
    9. feat(debug): Reflect demo states

  PR description should include screenshots of the new Reflect surface
  for sailing AND nursing interests, both pre-Save and post-Save (Settled)
  states. Plus a 10-second screen recording of the Save & settle flow
  showing the pill animation and the navigation to the next step.

OUT OF SCOPE — do not touch:
  • Profile capability map updates (Phase 5)
  • Playbook tab (Phase 6)
  • Share with Coach button consolidation (Phase 8)
  • Faculty Competency Assessment surface (separate phase, faculty role)
  • Hinge surface between steps (Phase 9)

If your worktree audit (step 3) finds conflicts, stop and ask.
If the brief is ambiguous or conflicts with the current codebase, ask
before guessing.
```

---

## After Phase 4 ships

Verify with flag on:

1. **Sailing Reflect** — purple pill, *"What worked?" / "What would you do differently?"* questions, capabilities-practiced shows real captures' inferred capabilities
2. **Nursing Reflect** — same surface, *"What worked well today? / Where do you need more practice?"* per-interest copy
3. **Synthesis draft path** — `✦ Tap to draft` populates the first question card with a serif italic AI draft; user can keep/edit/discard
4. **Voice mic** — press-and-hold writes transcript to focused field, or spawns "Anything else?" card if none focused
5. **Save & settle** — flips state to green, navigates to next planned step
6. **Star rating, FAB, "Anything else"** all gone on flag
7. **Flag off** — identical to today

When green: merge, ask in the design workspace for `phase-5-capability-spine-and-becoming.md`.
