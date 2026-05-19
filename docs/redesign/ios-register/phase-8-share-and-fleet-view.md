# Phase 8 · Share-a-Step + Fleet View — Engineering Brief

**Purpose.** Two related surfaces: a per-step share sheet (3 modes — direct / group / link) and a per-capture share sheet (3 visibility rings — private / crew / fleet). Plus the Fleet view that reads from the resulting shared captures: one race, all 14 boats' shared observations threaded by timestamp.

**Prerequisites.** Phases 0–7 merged.

**Source of truth.**
- `docs/redesign/ios-register/network-timelines-and-sharing-canonical.html` §3 (Share-a-step sheet) + §4 (Fleet view) + decisions **D15, D16**
- `docs/redesign/ios-register/becoming-loop-canonical.html` §5 (Capture-level share sheet — three rings of visibility) + decision **D12c**

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`.

---

## What lands

1. **Share-a-step sheet** — from any step menu (⋮) → *Share this step*. 3 modes: Direct to a person · To fleet/cohort · Copy link. Recent-recipients tile row.
2. **Share-a-capture sheet** — long-press a capture (Do tab) → *Share this capture*. 3 rings of visibility: Private (default) · Crew · Fleet/Cohort. Nursing variant gets PII-redaction note.
3. **Fleet view of a race** — tap WITH-row fleet/cohort chip on a step (Phase 1/4 already renders the chip) → opens Fleet view: coral state pill, stats strip, threaded stream of all participating boats' shared captures (your own coral-bordered, others' blue-bordered), filter by boat / time range.
4. **Shared-with-you inbox** — receiver's surface when someone shares a step with them. Lives under Discover or as a top-header notification badge.

---

## Acceptance criteria

1. Step menu (⋮) → *Share this step* opens the share sheet on any step card; preview card shows step title + body
2. Direct mode opens recent-recipients picker → tap a person → creates `shared_steps` row with `recipient_user_id` → notification fires
3. Group mode broadcasts to active fleet/cohort → creates `shared_steps` row with `group_id`
4. Link mode generates a `share_tokens` row with 30-day expiry → `Copy` button copies the URL `better.at/s/[token]`
5. Receiver: shared step appears in Shared-with-you inbox; receiver can View, Fork (with provenance), or Comment
6. Long-press a capture row in Do tab opens the per-capture share sheet with 3 rings
7. Default selection is Private; user must explicitly choose Crew or Fleet
8. Selecting Crew/Fleet writes `captures.visibility = 'crew'` or `'fleet'`
9. Nursing-interest captures: before any non-private write, run PII scrubber (server-side); show *"Patient identifiers hidden by default"* note in the sheet
10. WITH-row fleet/cohort chip taps to Fleet view at `/practice/step/[id]/fleet`
11. Fleet view renders coral state pill, stats strip (boats/captures/yours/your-finish), filter strip, threaded captures stream
12. Threaded captures: own = coral-bordered + coral background tint; others = blue-bordered. Time markers between race phases (beat 1 / beat 2 / finish for sailing; per-interest config for others)
13. Fleet view is read-only — no edit affordances on others' captures
14. Flag off → today's surfaces unchanged
15. Debug route gains: Share-a-step sheet · Share-a-capture sheet · Fleet view · Shared-with-you inbox

---

## Component APIs

### `<ShareStepSheet>`

```tsx
type StepShareMode = 'direct' | 'group' | 'link';

interface ShareStepSheetProps {
  visible: boolean;
  step: { id: string; title: string; body: string };
  recentRecipients: { id: string; initials: string; avatarColor: string; name: string }[];
  defaultGroup?: { id: string; name: string; memberCount: number };  // user's primary fleet/cohort
  onShareDirect: (recipientId: string) => Promise<void>;
  onShareToGroup: (groupId: string) => Promise<void>;
  onCopyLink: () => Promise<string>;
  onDismiss: () => void;
}
```

### `<ShareCaptureSheet>`

```tsx
type CaptureVisibility = 'private' | 'crew' | 'fleet';

interface ShareCaptureSheetProps {
  visible: boolean;
  capture: {
    id: string;
    kind: 'voice' | 'text' | 'photo' | 'video' | 'scan' | 'measurement';
    body: string;
    audioUri?: string;
    timestamp: string;
  };
  currentVisibility: CaptureVisibility;
  isNursing: boolean;        // surfaces the PII redaction note
  onChangeVisibility: (v: CaptureVisibility) => Promise<void>;
  onDismiss: () => void;
}
```

### `<FleetView>`

```tsx
interface FleetCapture {
  id: string;
  capturedAt: string;
  authorInitials: string;
  authorName: string;
  authorIsMe: boolean;
  boatName?: string;           // sailing-specific
  kind: 'voice' | 'text' | 'photo' | 'video' | 'scan' | 'measurement';
  body: string;
  kindTag?: string;
}

interface FleetViewProps {
  step: { id: string; title: string; settledLabel: string; eventLabel: string };
  stats: { boats: number; captures: number; yours: number; yourFinish?: string };
  filterChips: { id: string; label: string; count?: number }[];
  activeFilterIds: string[];
  onFilterToggle: (id: string) => void;
  captures: FleetCapture[];          // pre-filtered, time-ordered
  timeMarkers: { atTime: string; label: string }[];   // race phases
}
```

### `<SharedWithYouInbox>`

```tsx
interface SharedItem {
  id: string;
  kind: 'step' | 'capture';
  senderName: string;
  senderInitials: string;
  title: string;
  body: string;
  sharedAt: string;
}

interface SharedWithYouInboxProps {
  items: SharedItem[];
  onView: (id: string) => void;
  onFork: (id: string) => void;
  onComment: (id: string) => void;
}
```

---

## Schema

```sql
-- shared_steps (DM-style + group broadcasts)
id, sender_user_id, step_id, recipient_user_id (nullable), group_id (nullable),
  shared_at, read_at, forked_to_step_id (nullable, set when receiver forks)

-- share_tokens (link mode)
id, token, step_id, created_by_user_id, expires_at, used_count

-- captures.visibility column added (Phase 7 already added it for steps)
-- values: 'private' (default) | 'crew' | 'fleet'

-- fleet_capture_feed view — aggregates shared captures per fleet event
CREATE VIEW fleet_capture_feed AS
  SELECT c.*, s.event_id, s.fleet_id, u.display_name, u.boat_name
  FROM captures c
  JOIN steps s ON c.step_id = s.id
  JOIN users u ON c.author_user_id = u.id
  WHERE c.visibility IN ('crew','fleet');

-- comments table for the receiver's Comment action
id, shared_step_id, commenter_user_id, body, created_at
```

---

## Files to touch

| Area | Files |
|---|---|
| Share step | `components/share/ShareStepSheet.tsx`, `services/SharedStepsService.ts` |
| Share capture | `components/share/ShareCaptureSheet.tsx`, `services/CaptureVisibilityService.ts` |
| Fleet view | `app/(tabs)/practice/step/[id]/fleet.tsx`, `components/practice/FleetView.tsx`, `FleetCaptureCard.tsx`, `services/FleetCaptureFeedService.ts` |
| Inbox | `app/(tabs)/discover/shared-with-you.tsx`, `components/discover/SharedWithYouInbox.tsx` |
| PII redaction | `services/PIIRedactionService.ts` (server-side) — nursing-only |
| Step menu | wire `Share this step` action to open ShareStepSheet |
| Capture long-press | wire `Share` to open ShareCaptureSheet |
| WITH row | fleet/cohort chip → opens FleetView route |
| Debug | demo states |

---

## Out of scope

- Phase 9 (Hinges)
- Phase 10 (HKDW onboarding)
- Comment threads (just stub — Phase 8.1 if needed)
- Cross-interest sharing (e.g., share a sailing step with a nursing friend) — Phase 8.1

---

## Codex prompt (paste verbatim)

```
Task: implement Phase 8 — Share-a-Step + Share-a-Capture + Fleet View — in betterat-app.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-8-share-and-fleet-view.md
  • Canonicals:
    - docs/redesign/ios-register/network-timelines-and-sharing-canonical.html (§3 + §4)
    - docs/redesign/ios-register/becoming-loop-canonical.html (§5)

PROCEDURE:

1. Verify inputs in repo. Copy from latest ~/Downloads project zip if missing. Commit brief on docs/ branch, merge.

2. Audit worktree. If uncommitted work in components/share/, app/(tabs)/practice/step/[id]/fleet.tsx, components/practice/Fleet*, components/discover/SharedWithYou*, services/Share*, services/PIIRedaction*, stop and report.

3. Read brief + the 3 canonical sections (network §3, network §4, becoming §5) end-to-end.

4. Schema:
   • shared_steps (id, sender_user_id, step_id, recipient_user_id NULL, group_id NULL, shared_at, read_at, forked_to_step_id NULL)
   • share_tokens (id, token, step_id, created_by_user_id, expires_at, used_count)
   • captures.visibility column ('private' default | 'crew' | 'fleet')
   • fleet_capture_feed view
   • comments table

5. Implement components per brief. Behind PRACTICE_STEP_LOOP_IOS_REGISTER.

6. PII redaction (nursing only): server-side service that scrubs identifiers before any non-private capture write. Block writes that fail scrubbing with user-facing error.

7. Wire step menu ⋮ → Share this step → ShareStepSheet.
   Wire capture long-press → Share → ShareCaptureSheet.
   Wire WITH-row fleet/cohort chip → /practice/step/[id]/fleet (FleetView).

8. Verify all 15 acceptance criteria. Specifically:
   • Share-step direct/group/link all create correct rows
   • Share-capture changes captures.visibility
   • Nursing PII redaction triggers
   • Fleet view threads coral=mine + blue=others, filters work, time markers correct
   • Read-only enforcement (no edits on others' captures)

9. Flag off → today's surfaces unchanged.

10. Commit coherent units (one per major component group). PR with screenshots of all 4 surfaces (share step sheet, share capture sheet, fleet view, shared-with-you inbox). Plus screen recording of: share a step → receiver gets notification → opens → forks.

OUT OF SCOPE:
  • Phase 9 (Hinges)
  • Phase 10 (HKDW onboarding)
  • Comment threads (stub OK)
  • Cross-interest sharing (8.1)

CONSTRAINTS:
  • Reuse PRACTICE_STEP_LOOP_IOS_REGISTER
  • Fleet view is read-only — no edit affordances on others' content
  • Nursing PII: never allow patient identifiers into non-private writes
  • If brief conflicts with current codebase, ask.
```
