# Phase 3 · Do Tab — Engineering Brief

**Purpose.** Refresh the Do tab body in the new register. Coral state pill, hovering composer above a ghost Stop CTA, threaded capture stream. **Timing retires from the chrome** — captures count is the only default stat, elapsed time is one tap away. State pill text is interest-flavored so nursing reads *"On shift · capturing"* and drawing reads *"Session · capturing"* without forking components.

**Prerequisites.** Phases 0, 1, 1-refinements, 2 merged. `<StepCard>`, `<TopHeader>`, `<StatePill>`, `<StepStrip>`, `<PhaseTabs>` all exist and are battle-tested.

**Source of truth.**
- `docs/redesign/ios-register/step-loop-integration-canonical.html` §2 (Do current vs target) + decision **D7**
- `docs/redesign/ios-register/network-timelines-and-sharing-canonical.html` §5 (Do revised) + decisions **D17a, D17b, D17c**
- Plus the existing `b7-frame-2-live-capture-canonical.html` and `b7-frame-3-post-activity-canonical.html` for the live-capture and post-activity micro-states

Read all four end-to-end before writing code.

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`. No new flag.

---

## What lands

A rebuilt Do tab body that, when flag is on, replaces today's busy stack (race title repeated, planned pill duplicated, live-eye + capturing row + step marker + empty-stream + composer + stop + FAB) with a single coherent surface:

1. **State pill** (in the `<StepCard>` header — already exists from Phase 0) — coral *"Live · capturing"* with pulse animation when active, green *"Activity complete"* with tick when stopped
2. **Stats area on the right of the state pill** — captures count only by default. A small clock-toggle icon beside it surfaces elapsed time when tapped
3. **Step strip** (from Phase 0) — flag-3 icon + em-weighted step name + sub-context (*"Race 4 · beat 2"*)
4. **`<DoStream>`** — the threaded capture stream filling the card body. Newest first, capture rows with kind tags
5. **`<StreamComposer>`** — pinned absolutely above the Stop CTA. Pencil + camera + coral mic + `+` button (opens capture-types sheet — minimal version this phase, expanded types Phase 3.1)
6. **`<StopCapturingCTA>`** — coral-bordered ghost button at the foot. Interest-flavored copy: *"Stop capturing"* (sailing) / *"End shift"* (nursing) / *"End session"* (drawing) / *"Done capturing"* (default)
7. **Post-stop transition** — when user taps Stop, state pill animates coral → green in place (300 ms), Stop CTA replaces itself with `Move to Reflect →` (ios-blue primary), the step-title-block proposes an AI-suggested title as italic placeholder text the user can keep or rename

---

## Acceptance criteria

A Phase 3 PR is mergeable when:

1. Do tab body, flag on, renders the target layout from the canonicals — coral state pill in card header, captures-count-only stats by default, clock toggle to surface elapsed time
2. State pill text reads per-interest:
   - Sailing → *"Live · capturing"* (timer ON by default for this interest)
   - Nursing → *"On shift · capturing"* (timer OFF by default)
   - Drawing → *"Session · capturing"* (timer OFF)
   - Generic / new interests → *"Practicing"* (timer OFF)
3. Stop CTA text varies per interest: *"Stop capturing"* / *"End shift"* / *"End session"* / *"Done capturing"*
4. Composer floats above the Stop CTA (not inline in the stream). 3 buttons visible (pencil / camera / coral mic) + a `+` button that opens a capture-types sheet (minimal: video / scan / measurement rows as placeholder routes for Phase 3.1)
5. Capture rows in the stream show kind tags in meta line (*weather-call · tactical · trim · measurement · wind* etc.) — the kind is editable via long-press → "Tag this capture"
6. **Tapping Stop** flips state pill `coral → green`, replaces Stop CTA with `Move to Reflect →` blue primary, surfaces an AI-suggested title in the title block
7. Today's busy elements retire (when flag on):
   - Big red `Live · in progress` eyebrow inside the card body → removed (state pill carries the signal)
   - Duplicate "Capturing" row with separate count/elapsed → removed (state pill + stats area carries this)
   - "Untitled" step-marker row (separate from the title) → removed
   - Empty-state slot with placeholder copy → replaced by a single dashed ghost capture row inside the stream
   - FAB → hidden (top-header `+` from Phase 2 is the new add-step entry)
8. Existing capture-create wiring preserved — voice, text, photo captures all still write through to the same DB shape
9. Flag off → zero regression
10. Debug route gains a "Do · live capturing" + "Do · activity complete" demo state

---

## Component APIs

### `<DoStream>`

```tsx
interface DoStreamProps {
  captures: Capture[];      // ordered newest-first
  stepId: string;
  onCapturePress: (id: string) => void;       // opens detail
  onCaptureLongPress: (id: string) => void;   // opens kind-tag / mark-as-evidence / share menu
  emptyMessage?: string;    // default per interest: "Captures will appear here as you record them"
}
```

- Renders an "↓ Newest first" eyebrow at top, plus a "Just now" pulse marker on the freshest capture
- Body fills card scroll area; bottom 24 px fades to white so composer floats cleanly
- Empty state: one dashed ghost `<CaptureRow>` with italic placeholder

### `<CaptureRow>`

```tsx
type CaptureKind = 'voice' | 'text' | 'photo' | 'video' | 'scan' | 'measurement';

interface CaptureRowProps {
  capture: {
    id: string;
    kind: CaptureKind;
    body: string;
    audioUri?: string;
    photoUri?: string;
    capturedAt: string;     // ISO timestamp
    relativeAgo: string;    // "12s", "3m", "1h"
    kindTag?: string;       // user-or-AI-tagged: "weather-call", "tactical", "wind", "trim"
    isFresh?: boolean;      // <30s old → coral border-ring highlight
  };
  onPress: () => void;
  onLongPress: () => void;
}
```

- Border-left 2.5 px colored by kind: blue (voice), gray-3 (text/typed), label-2 (photo), green (measurement), purple (scan)
- 38-px left col: timestamp + relative ago stacked
- Middle: body text (italic for voice, normal for typed/measurement)
- Optional right chip: kind-tag (small purple-tint chip)
- Voice captures render a play button + waveform + duration below the body

### `<StreamComposer>`

```tsx
interface StreamComposerProps {
  onAddPress: () => void;       // opens the capture-types sheet (Phase 3.1 expands the sheet)
  onMicPressStart: () => void;
  onMicPressEnd: () => void;
  onTextSubmit: (text: string) => void;
  onPhotoCapture: (uri: string) => void;
}
```

- Position: `absolute`, `bottom: 152px`, `left/right: 14px`
- White card, 18-px radius, shadow per canonical
- Layout: `+` icon + placeholder text "Capture…" + 32-px pencil + 32-px camera + 40-px coral mic
- Tap placeholder/pencil: keyboard rises, mic becomes a send button
- Press-and-hold mic: starts recording (waveform replaces placeholder, timer above the mic), release to stop

### `<StopCapturingCTA>` (and its post-stop replacement)

```tsx
type StopState = 'capturing' | 'stopping' | 'complete';

interface StopCapturingCTAProps {
  state: StopState;
  interest: 'sailing' | 'nursing' | 'drawing' | 'generic';
  onStop: () => void;
  onMoveToReflect: () => void;
}
```

- `capturing`: white background, 1-px coral border, coral-deep text, 11-px coral square glyph + label per interest config
- `stopping`: brief loading state (200 ms) — coral border, label text "Stopping…"
- `complete`: replaces with ios-blue primary button labeled `Move to Reflect →` (white text, arrow glyph)
- Position: `absolute`, `bottom: 96px`, `left/right: 14px`, 14-px radius, 12-px vertical padding

### State pill `stats` slot (extends `<StatePill>` from Phase 0)

`<StatePill>` already accepts an optional `stats` array. Phase 3 introduces a richer stats config:

```tsx
interface DoStatsConfig {
  capturesCount: number;     // always shown
  elapsedSeconds: number;    // shown only when timerVisible is true
  timerVisible: boolean;
  onToggleTimer: () => void;
}
```

- When `timerVisible = false`: render only `<num>{capturesCount}</num><lbl>Captures</lbl>` + a 28-px clock-toggle icon
- When `timerVisible = true`: render captures stat + a 0.5-px hairline divider + an elapsed `mm:ss` stat (no separate label, the format is its own signifier) + the clock-toggle icon (now in "on" tint — coral)
- Per-interest default: sailing starts `timerVisible = true`; nursing/drawing/generic starts `timerVisible = false`

---

## Per-interest config

Add a new config module:

```tsx
// lib/interest-config.ts (or wherever interest configs live today)
export const INTEREST_DO_TAB_CONFIG = {
  sailing: {
    statePillLabel: 'Live · capturing',
    stopCtaLabel: 'Stop capturing',
    showElapsedByDefault: true,
    captureEmptyMessage: 'Captures will appear here as you record them.',
  },
  nursing: {
    statePillLabel: 'On shift · capturing',
    stopCtaLabel: 'End shift',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Observations will appear here as you capture them.',
  },
  drawing: {
    statePillLabel: 'Session · capturing',
    stopCtaLabel: 'End session',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Sketches and notes appear here as you save them.',
  },
  generic: {
    statePillLabel: 'Practicing',
    stopCtaLabel: 'Done capturing',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Your captures appear here as you record them.',
  },
};
```

Resolve per active interest at render time.

---

## Files to touch

| File | What changes |
|---|---|
| `components/step/do-tab/DoStream.tsx` (new) | Threaded capture stream + empty state |
| `components/step/do-tab/CaptureRow.tsx` (new) | Per-capture display with kind tag |
| `components/step/do-tab/StreamComposer.tsx` (new) | Hovering composer above Stop CTA |
| `components/step/do-tab/StopCapturingCTA.tsx` (new) | Three-state Stop / Stopping / Move-to-Reflect |
| `components/step/do-tab/CaptureTypesSheet.tsx` (new, minimal) | Sheet opened by composer `+` — 3 placeholder rows (video / scan / measurement) for Phase 3.1 to flesh out |
| `components/step/do-tab/index.ts` (new) | Barrel |
| `components/step-loop/StatePill.tsx` | Extend stats config for timer-toggle behavior |
| `components/step/DoTab.tsx` | Rewire to use new components behind flag |
| `lib/interest-config.ts` | Add `INTEREST_DO_TAB_CONFIG` map |
| `app/debug/step-loop-primitives.tsx` | Add Do live + Do complete demo states |

No schema changes. Reuses existing captures + step models.

---

## Visual fidelity

Match these reference frames in order of specificity:

- `network-timelines-and-sharing-canonical.html` §5 — the most current Do target
- `step-loop-integration-canonical.html` §2 right pane — Do live · capturing
- `b7-frame-2-live-capture-canonical.html` — pixel-level anatomy of the live-capture micro-state
- `b7-frame-3-post-activity-canonical.html` — post-stop state with Move-to-Reflect

Numeric tolerance ±1pt.

---

## What this PR does *not* do

Out of scope (later phases):

- **Phase 3.1 · Expanded capture types** — video, scan, measurement, tool-used, technique-applied, attached file, advice-received. The composer's `+` opens a sheet with 3 placeholder rows; the full sheet UI is a follow-up PR
- **Phase 4 · Reflect tab** — Move-to-Reflect button routes to today's Reflect surface; the Reflect refresh ships in Phase 4
- **Mark as evidence sheet** (B.7 Frame 4) — the long-press menu on a capture stubs "Mark as evidence" — full sheet ships in Phase 5 (capability spine)
- **Fleet view of a race** — the WITH-row fleet chip stays a no-op tap in Phase 3; the Fleet view ships in Phase 8

---

## Suggested Claude Code prompt (paste verbatim)

```
Implement Phase 3 of the iOS register migration: the Do tab refresh.

Read these four files end-to-end first:
  1. docs/redesign/ios-register/phase-3-do-tab.md                ← the brief
  2. docs/redesign/ios-register/step-loop-integration-canonical.html
     — §2 target frame + decision D7
  3. docs/redesign/ios-register/network-timelines-and-sharing-canonical.html
     — §5 (most current Do target) + decisions D17a, D17b, D17c
  4. docs/redesign/ios-register/b7-frame-2-live-capture-canonical.html
     — pixel-level anatomy of the live-capture state

Then implement per the brief's acceptance criteria. Specifically:
  • Five new components in components/step/do-tab/:
    DoStream, CaptureRow, StreamComposer, StopCapturingCTA, CaptureTypesSheet
    (the last one is minimal — full expanded types is Phase 3.1)
  • INTEREST_DO_TAB_CONFIG map in lib/interest-config.ts
  • Extend <StatePill>'s stats slot to support the timer-toggle pattern
  • Rewire components/step/DoTab.tsx behind PRACTICE_STEP_LOOP_IOS_REGISTER
  • Cut on flag: the big red Live eyebrow, the separate Capturing row, the
    "Untitled" step marker row, the empty-stream slot, the FAB
  • Add Do-live + Do-complete states to /debug/step-loop-primitives

Per-interest config:
  • Sailing → state pill "Live · capturing", Stop CTA "Stop capturing",
    timer ON by default
  • Nursing → state pill "On shift · capturing", Stop CTA "End shift",
    timer OFF by default
  • Drawing → state pill "Session · capturing", Stop CTA "End session",
    timer OFF
  • Generic → state pill "Practicing", Stop CTA "Done capturing",
    timer OFF

Post-stop transition: state pill flips coral → green in place (~300ms),
Stop CTA replaces with "Move to Reflect →" blue primary, AI-suggested
title surfaces in step-title-block as italic placeholder.

Out of scope (do not touch):
  • Phase 3.1 expanded capture types (video / scan / measurement / etc.)
  • Phase 4 Reflect tab
  • Phase 5 mark-as-evidence sheet
  • Phase 8 fleet view

No schema changes. Reuse existing captures + step models.

When done: PR with before/after screenshots of Do tab — empty, mid-capture,
post-stop — for sailing and nursing interests with the flag on. Plus a
10-second screen recording of the full Plan → Do → Stop → Move-to-Reflect
flow.

Ask me clarifying questions before writing code if anything is ambiguous.
```

---

## After Phase 3 ships

Verify with flag on:

1. **Sailing Do tab** — coral "Live · capturing" pill, captures count visible + clock icon, timer surfaces when icon tapped, Stop CTA reads "Stop capturing"
2. **Nursing Do tab** — coral "On shift · capturing" pill, captures only (no timer surfaced), Stop CTA reads "End shift"
3. **Capture stream** — voice/text/photo all render with correct kind tags, long-press surfaces tag-edit menu
4. **Composer** — pencil/camera/mic visible, `+` opens minimal capture-types sheet, voice press-and-hold records and transcribes
5. **Stop pressed** — pill flips coral→green, Stop CTA → Move-to-Reflect, title-block proposes AI title
6. **Flag off** → identical to today's Do tab

When green: merge, ask in the design workspace for `phase-3-1-expanded-capture-types.md` (small follow-up) or `phase-4-reflect-tab.md` (main next).
