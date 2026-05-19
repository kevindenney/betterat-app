# Phase 9 · Hinges — Engineering Brief

**Purpose.** Build the hinge surface — the named time between two adjacent steps. Reached in Phase 1 by tapping the top-header timeline icon; in a future phase by swipe-between-steps when peeks ship. The hinge filmstrip names what filled the gap: flagged moments, reflections, captured notes, kept thoughts. Lower visual weight than a step card — the hinge is a state, not a destination.

**Prerequisites.** Phases 0–8 merged.

**Source of truth.**
- `docs/redesign/ios-register/becoming-loop-canonical.html` §4 (Hinge in new register) + decision **D11**
- Legacy file: `Step transition hinge - iOS register.html` (Felix sailing) — the foundational hinge design with the filmstrip pattern, three named kinds, bookends, phrasing-varies-with-gap principle

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`.

---

## What lands

1. **Hinge surface** at `/practice/hinges/[id]` — reached by:
   - Tapping the top-header timeline grid icon, which lists upcoming and past hinges
   - After Save & settle on Reflect (Phase 4), instead of routing directly to the next planned step's Plan view, the user lands on the hinge surface that names the gap
2. **State pill** — amber *"Between · settling"* (new variant, distinct from the five step states)
3. **Title block** — eyebrow names the interval (*"Between Race 3 and Race 4"*), title is the gap-phrased name (*"Three days at the edge"*), dates beneath
4. **Filmstrip** — horizontal-scroll cards, one per day in the gap. Three named kinds: flagged moment · reflection · captured note. Empty days show ghost cards with *"No entry"*
5. **Bookends below the filmstrip** — two grouped-list rows: the step on either side (the settled one before, the planned one after)
6. **Auto-build logic** — the filmstrip auto-fills from: flagged-moment events in interval, reflection entries written in interval (e.g., on Reflect home — Phase 11 / future), captured notes from universal `+` with no step_id, kept thoughts from the on-deck zone

---

## Acceptance criteria

1. Hinge surface renders at `/practice/hinges/[id]` with state pill, title block, filmstrip, bookends
2. State pill component (`<StatePill>` from Phase 0) gains the `between` variant (amber tint + amber dot)
3. Phrasing varies with gap length:
   - Same day → *"The day"* (rare)
   - 1 night → *"The night between"*
   - 2-3 days → *"{N} days between"* or *"Three days at the edge"* (preferred poetic variant when N=3)
   - 4-7 days → *"A week between"*
   - 8-30 days → *"{N} days"* or *"A month between"* (when ≥28)
   - >30 days → *"Two months between"* / *"Half a year"* etc.
4. Filmstrip auto-builds — pulls from `step_flag_events`, `reflection_entries WHERE step_id IS NULL`, `playbook_insights WHERE step_id IS NULL` (concepts dropped during the gap), and `step_deck` items added in the interval
5. Each day-tile in filmstrip has correct kind icon + kind label + serif italic body + provenance line at bottom
6. Empty days show ghost day-tile with dashed border + *"No entry"* italic body
7. Bookend rows tap to navigate to the step on either side
8. After Save & settle on Reflect, route to the hinge surface (not directly to the next step's Plan) — this is the new default Reflect-completes flow
9. The hinge has its own back-navigation (back to Practice timeline)
10. Flag off → after Save & settle still routes to next step's Plan (today's behavior)
11. Debug route gains hinge demo states (1-night gap, 3-day gap, week gap, 2-month gap)

---

## Component APIs

### `<HingeSurface>`

```tsx
interface HingeSurfaceProps {
  hinge: {
    id: string;
    previousStepId: string;
    previousStepTitle: string;
    nextStepId: string;
    nextStepTitle: string;
    gapStart: string;       // ISO timestamp
    gapEnd: string;         // ISO timestamp
    gapDays: number;
    eyebrowLabel: string;   // "Between Race 3 and Race 4"
    titlePhrase: string;    // "Three days at the edge"
    datesLabel: string;     // "March 18-20"
  };
  days: HingeDay[];
  onBack: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
}

interface HingeDay {
  date: string;
  dayLabel: string;          // "Wednesday"
  dateLabel: string;         // "March 18"
  entries: HingeDayEntry[];  // can be empty
}

interface HingeDayEntry {
  kind: 'flagged' | 'reflection' | 'note';
  body: string;
  provenance: string;        // "From Playbook · Sam Cooke"
  onPress: () => void;
}
```

### `<DayTile>`

```tsx
interface DayTileProps {
  day: string;               // "Wednesday"
  date: string;              // "March 18"
  entry: HingeDayEntry | null;   // null → ghost empty
  onPress?: () => void;
}
```

- Width 168 px, white background, hairline border, radius 12, padding 12
- Empty: dashed gray-4 border, italic *"No entry"*
- Filled: kind eyebrow at top (blue for flagged / purple-deep for reflection / green-deep for note), italic serif body, provenance line at foot

### `<HingeBookend>`

```tsx
interface HingeBookendProps {
  kind: 'before' | 'after';
  label: string;             // "Settled · before this hinge" / "Opens · after this hinge"
  stepTitle: string;
  onPress: () => void;
}
```

- Grouped iOS list pattern with icon (green check for before, blue arrow-right for after), title, chevron-right

---

## Service

### `HingeBuildService`

```tsx
interface BuiltHinge {
  hinge: { id: string; previousStepId: string; nextStepId: string; gapStart: string; gapEnd: string; gapDays: number };
  days: HingeDay[];
}

async function buildHinge(userId: string, previousStepId: string, nextStepId: string): Promise<BuiltHinge>;
```

- Computes gap from `previousStep.settled_at` → `nextStep.scheduled_at` (or now if no next step scheduled)
- Generates one HingeDay per calendar day in the gap
- For each day, pulls entries from:
  - `step_flag_events` where `flagged_at` in day
  - `reflection_entries` (or whatever reflections-outside-step table is) where `created_at` in day AND `step_id IS NULL`
  - `playbook_insights` where `created_at` in day AND `refined_to_concept_id IS NULL`
  - `step_deck` where `added_at` in day AND `placed_at IS NULL`
- Chooses titlePhrase by gap length (see acceptance #3)

---

## Schema

```sql
-- step_flag_events (the user marked a moment as worth returning to)
-- May already exist; ensure it has: id, step_id, user_id, flagged_at, body

-- hinges table (optional — could be computed on demand)
-- If persisted: id, user_id, previous_step_id, next_step_id, gap_start, gap_end, computed_at
-- Recommendation: compute on demand for simplicity. Cache by (previous_step_id, next_step_id).
```

---

## Files to touch

| Area | Files |
|---|---|
| Surface | `app/(tabs)/practice/hinges/[id].tsx`, `components/practice/HingeSurface.tsx`, `DayTile.tsx`, `HingeBookend.tsx` |
| Service | `services/HingeBuildService.ts` |
| State pill | `components/step-loop/StatePill.tsx` — add `between` variant (amber) |
| Reflect routing | `components/step/ReflectTab.tsx` — Save & settle routes to hinge instead of next step (behind flag) |
| Top-header timeline icon | List view of upcoming/past hinges; tap to enter hinge surface |
| Debug | hinge demo states (1-night, 3-day, week, 2-month gaps) |

---

## Out of scope

- Phase 10 (HKDW onboarding)
- Peeks + swipe-between-steps (deferred; Phase 1 already includes the architecture decision D1 to defer)
- Hinge for the gap *before* the user's first step (no previous step to bookend from)

---

## Codex prompt (paste verbatim)

```
Task: implement Phase 9 — Hinges — in betterat-app.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-9-hinges.md
  • Canonical: docs/redesign/ios-register/becoming-loop-canonical.html (§4)
  • Legacy reference: "Step transition hinge - iOS register.html" (in the project zip — contains the foundational filmstrip + bookends design)

PROCEDURE:

1. Verify inputs. Copy from latest ~/Downloads project zip if missing. Commit brief on docs/ branch, merge.

2. Audit worktree. If uncommitted work in app/(tabs)/practice/hinges/, components/practice/Hinge*, services/HingeBuildService.ts, or in components/step-loop/StatePill.tsx (the amber variant addition), stop and report.

3. Read brief + becoming-loop §4 + legacy hinge file end-to-end.

4. Extend <StatePill> from Phase 0 with the `between` variant — amber tint background (#F8F4E8 or per token), amber dot, amber-deep label color. Match the existing variant pattern.

5. Implement HingeBuildService — computes hinges on demand from step events / reflections-outside-step / insights / deck-adds in the gap. Cache results.

6. Implement HingeSurface + DayTile + HingeBookend components. Behind PRACTICE_STEP_LOOP_IOS_REGISTER.

7. Update Reflect's Save & settle path — instead of routing directly to next planned step's Plan view, route to /practice/hinges/[builtHingeId]. The hinge then has explicit navigation forward to the next step.

8. Update top-header timeline grid icon (Phase 0) — when tapped, show a list of upcoming + past hinges in addition to the timeline scrubber.

9. Verify all 11 acceptance criteria. Test gap-length phrasing variants (1 night / 3 days / week / month / 2 months).

10. Flag off → Save & settle still routes to next step's Plan (today's behavior preserved).

11. Commit coherent units. PR with screenshots of hinge surfaces at 4 gap lengths + a 10-second screen recording of: settle a step → land on hinge → tap "Opens after this hinge" → arrive at next step's Plan.

OUT OF SCOPE:
  • Phase 10 (HKDW onboarding)
  • Peeks + swipe gestures (deferred per D1)
  • Hinge for gap before first step

CONSTRAINTS:
  • Reuse PRACTICE_STEP_LOOP_IOS_REGISTER
  • State pill addition extends existing component — do not fork
  • The hinge is lower visual weight than a step card — no shadow on day tiles, regular-weight title, serif italic body
  • Phrasing matters: the gap-name strings are user-facing copy and should match the brief's table exactly
  • If brief conflicts with codebase, ask.
```
