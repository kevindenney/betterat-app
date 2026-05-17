# Phase 2 · Universal `+` Sheet — Engineering Brief

**Purpose.** Replace today's many-buttoned capture entry points (FAB, top-header `+`, in-tab `+`) with a single universal sheet. Voice-led quick-capture at the top handles the 90% case (idea-out-fast). Four secondary rows route to blueprint-import, follow-import, concept-drop, and share. One surface, ranked by frequency.

**Prerequisite.** Phase 0 (shared chrome with `<TopHeader>`'s `+` button) and Phase 1 + refinements merged.

**Source of truth.**
- `docs/redesign/ios-register/step-loop-integration-canonical.html` — §1 right pane shows the sheet rendered over a dimmed background, with full anatomy (drag handle, quick-capture composer, 4 grouped menu rows, cancel row)
- Decision **D6** in the same canonical's header

Read both end-to-end before writing code.

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`. No new flag.

---

## What lands

A modal sheet that rises from the bottom of the screen when the user taps the `+` in the top-header. Same sheet across all four tabs (Practice / Playbook / Discover / Profile). Contents are universal; the secondary rows' destinations differ slightly per tab if needed (e.g. tapping *Drop a concept* from Playbook lands the user back on Playbook's Recent Insights zone after capture).

### Sheet anatomy (top to bottom)

1. **Drag handle** (36×5 px, gray-4, centered)
2. **Title** — *"What would you like to add?"* (15 / 600, label, -0.2 ls, centered)
3. **Quick-capture composer** — the big voice-led field that handles the most common path
4. **Capture hint line** — *"Hold to speak · or tap to type. We'll name it for you."* (10.5 italic, label-3, centered)
5. **Group 1 · Add a step from…** (eyebrow + 2 rows)
   - 📋 Blueprint you follow → opens that blueprint's detail (Phase 6's Playbook scope — until then, navigate to a placeholder route)
   - 👥 Someone you follow → opens followed-person timeline (Phase 7 — placeholder route until then)
6. **Group 2 · Drop to Playbook** (eyebrow + 1 row)
   - 💡 A concept to come back to → the captured text/voice routes to the Playbook *Recent Insights* zone (Phase 6 — until then, save to a `playbook_insights` table and surface a confirmation toast)
7. **Group 3 · Share** (eyebrow + 1 row)
   - ↗ An idea, publicly or with crew → opens share composer (Phase 8 — placeholder until then)
8. **Cancel row** — text-only iOS-blue *Cancel* (14.5 / 500), top hairline

### The quick-capture composer (primary affordance)

```
╭───────────────────────────────────╮
│ ✏  Capture a step idea…    🎤    │
╰───────────────────────────────────╯
```

- 3-column grid: 28-px pencil glyph (blue-tint background) · placeholder text · 40-px coral mic button (white sparkles glyph, shadow)
- Tap the composer's body: keyboard rises, mic becomes a send button
- Press-and-hold the mic: starts voice recording (waveform replaces the placeholder text), release to stop
- On send: creates a new draft step with the captured text/voice as the title, routes to the **On-deck zone** (per D14, shipping in Phase 7 — until Phase 7 ships, create the draft step but route it to a temporary "drafts" list at the bottom of the Practice tab)

---

## Acceptance criteria

A Phase 2 PR is mergeable when:

1. Top-header `+` button (from Phase 0) opens the universal sheet from the bottom of the screen when flag is on. Same behavior on all four tabs.
2. Quick-capture composer creates a draft step when the user submits text or voice:
   - Text path: `<TextInput>` becomes the title, step status `draft`, routes to drafts list / On-deck
   - Voice path: records, transcribes via existing transcription service, transcribed text becomes the title (user can edit before commit)
3. The four secondary rows render with correct copy + icons + tint colors per the canonical, and tap-routes are wired (placeholders allowed for unfinished destinations):
   - Blueprint row → `/playbook/blueprints` (route may stub-render *"coming soon"* in Phase 2; that's fine)
   - Follow row → `/discover/following`
   - Concept row → `POST /playbook/insights` with a confirmation toast, then closes the sheet
   - Share row → `/share/idea` (stub)
4. Cancel row dismisses the sheet without side effects
5. Flag off — `+` button continues to do whatever it does today (likely opens an old new-step screen). Zero regression off-flag.
6. Debug route `/debug/step-loop-primitives` gains a "Universal + sheet" demo state showing the sheet open over a dimmed Plan background.

---

## Component APIs

### `<UniversalPlusSheet>`

```tsx
interface UniversalPlusSheetProps {
  visible: boolean;
  onDismiss: () => void;
  // When voice/text capture is committed, this fires with the captured payload
  onQuickCapture: (payload: { kind: 'text' | 'voice'; content: string; audioUri?: string }) => void;
  // Each secondary action fires its own callback; the host decides routing
  onAddFromBlueprint: () => void;
  onAddFromFollow: () => void;
  onDropConcept: (payload: { kind: 'text' | 'voice'; content: string; audioUri?: string }) => void;
  onShareIdea: () => void;
}
```

- Renders via React Native's `Modal` (`presentationStyle="pageSheet"` on iOS, or a custom bottom-sheet component if the app already uses one — check existing patterns in `betterat-app/components`)
- Background scrim: 40% black behind the sheet
- Sheet height: ~75% of viewport, content-sized
- Drag-to-dismiss enabled

### `<QuickCaptureComposer>` (used inside the sheet)

```tsx
interface QuickCaptureComposerProps {
  placeholder?: string;     // default: "Capture a step idea…"
  onSubmit: (payload: { kind: 'text' | 'voice'; content: string; audioUri?: string }) => void;
}
```

- Two modes: text (keyboard, send button on right when text present) and voice (press-and-hold mic)
- Voice recording UI: waveform animation replaces the placeholder, timer above the mic, release to stop
- Transcription happens automatically post-recording via existing `services/transcription/*` — re-use whatever pattern Do tab already uses

### `<MenuRow>` (used for the 4 secondary rows)

```tsx
interface MenuRowProps {
  icon: 'template' | 'users' | 'bulb' | 'share-3';
  tint: 'blue' | 'gray' | 'purple' | 'green';
  title: string;
  subtitle: string;
  onPress: () => void;
}
```

- Grid: 32-px icon tile · title + subtitle stack · chevron-right
- Hairline divider between rows within a group; no divider between groups (group eyebrow does the separation)

---

## Wiring the top-header `+` button

The `+` button in `<TopHeader>` (shipped in Phase 0) currently is a placeholder or wired to an older modal. Update it to open `<UniversalPlusSheet>` when flag is on.

```tsx
// in TopHeader.tsx or wherever the + is rendered
const [plusSheetOpen, setPlusSheetOpen] = useState(false);

<TopHeader
  rightCluster={
    <>
      {/* ... other icons */}
      <PressableIcon name="plus" onPress={() => setPlusSheetOpen(true)} />
    </>
  }
/>

<UniversalPlusSheet
  visible={plusSheetOpen}
  onDismiss={() => setPlusSheetOpen(false)}
  onQuickCapture={(payload) => { /* create draft step */ }}
  onAddFromBlueprint={() => { /* navigate */ }}
  onAddFromFollow={() => { /* navigate */ }}
  onDropConcept={(payload) => { /* POST /playbook/insights */ }}
  onShareIdea={() => { /* navigate */ }}
/>
```

---

## Files to touch

| File | What changes |
|---|---|
| `components/capture/UniversalPlusSheet.tsx` (new) | The sheet itself |
| `components/capture/QuickCaptureComposer.tsx` (new) | Voice + text composer |
| `components/capture/MenuRow.tsx` (new) | Reusable secondary-row primitive |
| `components/capture/index.ts` (new) | Barrel export |
| `services/QuickCaptureService.ts` (new) | Handles draft-step creation + concept-insight POST + transcription routing |
| `components/step-loop/TopHeader.tsx` | Wire `+` button to open the sheet behind the flag |
| `app/_layout.tsx` or equivalent host | Mount `<UniversalPlusSheet>` at app root so it overlays any tab |
| `app/debug/step-loop-primitives.tsx` | Add "Universal + sheet" demo state |

Database / schema additions (minimal):
- `playbook_insights` table — `id`, `user_id`, `interest_id`, `kind ('text' | 'voice')`, `content`, `audio_uri`, `created_at`, `refined_to_concept_id` (nullable, filled when user refines into a concept in Phase 6)
- Or reuse existing `notes` / `captures` table with a `kind = 'playbook_insight'` flag — choose whichever matches existing patterns better

---

## Visual fidelity

Match the right pane of `step-loop-integration-canonical.html` §1:

- Sheet bottom-rounded corners 18px
- Internal padding 6px top (handle), 18px sides, 28px bottom
- Group eyebrow: 9.5 / 700 / 0.9 ls / upper / label-3
- Menu row title: 14 / 600 / label
- Menu row subtitle: 11.5 / label-3
- Cancel row: 14.5 / 500 / ios-blue with 0.5px gray-5 top hairline + 14px padding above

Numeric tolerance ±1pt.

---

## What this PR does *not* do

Out of scope (later phases):
- **Phase 6 · Playbook tab** — the concept-drop endpoint writes data; the Playbook UI to refine that data ships later
- **Phase 7 · Network browsing** — blueprint and follow rows can navigate to stub routes
- **Phase 8 · Share** — share row can navigate to a stub route
- **D20 long-press menus** (mark-as-concept-seed from a capture / reflection / others' step) — Phase 6 work; the `+` sheet is the only entry point that ships here
- **Do/Reflect tab refreshes** — Phase 3 and 4

---

## Suggested Claude Code prompt (paste verbatim)

```
Implement Phase 2 of the iOS register migration: the universal + sheet.

Read these two files end-to-end first:
  1. docs/redesign/ios-register/phase-2-universal-plus-sheet.md   ← the brief
  2. docs/redesign/ios-register/step-loop-integration-canonical.html
     — §1 right pane (sheet rendered) + decision D6

Then implement per the brief's acceptance criteria. Specifically:
  • Three new components in components/capture/:
    UniversalPlusSheet, QuickCaptureComposer, MenuRow
  • QuickCaptureService that handles draft-step creation, concept-insight
    POST, and voice-transcription routing
  • Wire the existing + button in components/step-loop/TopHeader.tsx to
    open the sheet, behind PRACTICE_STEP_LOOP_IOS_REGISTER
  • Mount the sheet at app root so it overlays any tab
  • Add a "Universal + sheet" state to /debug/step-loop-primitives

Stub routes are acceptable for secondary destinations:
  • Blueprint row → /playbook/blueprints (stub OK)
  • Follow row → /discover/following (stub OK)
  • Share row → /share/idea (stub OK)
  • Concept row → POST /playbook/insights with toast confirmation
    (the Playbook UI to view these lands in Phase 6)

Schema: add a playbook_insights table (or reuse captures with a flag,
your call — pick whichever matches existing patterns). Document your
choice in the PR description.

Out of scope: Playbook tab UI, network browsing, share UI, Do/Reflect
tab refreshes, long-press menus. Those are Phase 3-8.

When done: PR with screenshots of the sheet open on Practice / Playbook
/ Discover / Profile tabs (it should look identical across all four).
Plus a 5-second screen recording of the voice quick-capture path.

Ask me clarifying questions before writing code if anything is ambiguous.
```

---

## After Phase 2 ships

Verify with flag on:

1. Tap `+` from Practice tab → sheet rises with the right anatomy
2. Type text into the composer → tap send → sheet dismisses, a confirmation toast appears, the new draft step exists in the DB
3. Press-and-hold mic → recording UI shows → release → transcription completes → text appears in composer for review → user taps send
4. Tap each secondary row → correct route or stub fires
5. Tap `+` from each other tab (Playbook, Discover, Profile) → same sheet
6. Tap `Cancel` → sheet dismisses, no side effects
7. Flag off → `+` does whatever it did before Phase 2

Once green: merge, ask in the design workspace for `phase-3-do-tab.md`.
