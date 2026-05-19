# Phase 7 · Network Browsing & Add-to-Timeline — Engineering Brief

**Purpose.** Build the three browsing views from the network canonical (subscribed blueprint, co-practitioners, followed-person timeline) and the add-to-timeline flow with placement chooser + On-deck holding zone. Phase 2's universal `+` sheet's secondary rows (blueprint / follow) gain real destinations.

**Prerequisites.** Phases 0–6 merged.

**Source of truth.**
- `docs/redesign/ios-register/network-timelines-and-sharing-canonical.html` §1 (three browsing views) + §2 (add sheet + on-deck) + decisions **D13a, D13b, D13c, D14a, D14b**

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`.

---

## What lands

1. **Subscribed blueprint timeline** — Playbook surface showing all ordered steps of a blueprint, each pill colored by *your* progress (settled/current/planned). `+ Add` on every step
2. **Co-practitioners list** — within a blueprint detail: who else is on this path, their current step, filter by your fleet
3. **Followed-person timeline** — from Discover/Profile, the last 5 of someone's settled steps, with `+ Fork` to pull a copy into your own timeline (provenance preserved)
4. **Add-to-timeline sheet** — preview card → placement chooser (Next up / End of timeline / Specific date) → primary `Add to my timeline`; secondary `Save to deck for later`
5. **On-deck zone** — amber strip above the Practice timeline showing held items with provenance; Place→ or × per row; reached via the top-header grid icon (badge shows count)

---

## Acceptance criteria

1. Playbook surface gains blueprint detail view at `/playbook/blueprints/[id]`; renders subscribed blueprint timeline with all steps
2. Each blueprint step's state pill reflects user's `step_user_progress` row
3. `+ Add` opens the add-to-timeline sheet (see #5)
4. Co-practitioners view at `/playbook/blueprints/[id]/co-practitioners` lists subscribers (privacy-respecting); filters by fleet membership
5. Add-to-timeline sheet renders preview card (provenance + title + body + caps) + 3 placement options + primary CTA + secondary save-to-deck
6. On placement choice: creates `steps` row with `source_type` (blueprint/user_fork/suggestion), `source_id`, `order_index` per choice
7. On Save-to-deck: creates `step_deck` row with `status = 'on_deck'`; doesn't appear in main timeline; appears in deck zone
8. Top-header grid icon (Phase 0 already shipped) gains a badge with deck count
9. On-deck zone strip renders above Practice tab content when items exist; each row has Place→ + × buttons
10. Followed-person timeline at `/discover/u/[handle]` shows their public settled steps; `+ Fork` button opens add sheet with `source_user_id` set
11. Flag off → today's surfaces unchanged
12. Debug route gains: Blueprint timeline · Co-practitioners list · Followed person timeline · Add sheet · On-deck zone

---

## Component APIs

### `<TimelineStepCard>` — reused across all three browsing views

```tsx
interface TimelineStepCardProps {
  pillState: 'settled' | 'current' | 'planned';
  title: string;
  metaLabel: string;
  metaWhen: string;
  capabilityChips?: string[];
  addState: 'add' | 'added' | 'fork' | 'forked' | 'saw-it';
  onAddPress: () => void;
}
```

### `<CoPractitionerRow>`

```tsx
interface CoPractitionerRowProps {
  avatarInitials: string;
  avatarColor: 'a' | 'g' | 'p' | 'h';
  name: string;
  affiliation: string;       // "RHKYC"
  currentStep: string;       // "Step 4 · Pre-start lane choice"
  currentWhen: string;       // "this week"
  onView: () => void;
}
```

### `<AddToTimelineSheet>`

```tsx
type Placement = 'next-up' | 'end' | 'specific-date';

interface AddToTimelineSheetProps {
  visible: boolean;
  preview: {
    sourceLabel: string;
    title: string;
    body: string;
    capabilities: string[];
  };
  defaultPlacement?: Placement;
  onAdd: (placement: Placement, date?: string) => void;
  onSaveToDeck: () => void;
  onDismiss: () => void;
}
```

### `<OnDeckZone>`

```tsx
interface OnDeckZoneProps {
  items: { id: string; title: string; provenance: string; addedAt: string }[];
  onPlace: (id: string) => void;
  onDiscard: (id: string) => void;
}
```

---

## Schema

```sql
-- step_deck (held items)
id, user_id, interest_id, source_type, source_id, title, body, status='on_deck',
  added_at, placed_at (nullable, set when promoted to timeline)

-- step_user_progress (for blueprint-vs-user state)
id, user_id, blueprint_step_id, status, started_at, settled_at

-- follows already exists; ensure visibility column on steps respected:
--   steps.visibility ∈ ('private', 'crew', 'fleet', 'public')
--   followed-person timeline filters to visibility = 'public'
```

---

## Files to touch

| Area | Files |
|---|---|
| Blueprint timeline | `app/(tabs)/playbook/blueprints/[id]/index.tsx`, `components/playbook/BlueprintTimeline.tsx` |
| Co-practitioners | `app/(tabs)/playbook/blueprints/[id]/co-practitioners.tsx`, `components/playbook/CoPractitionerList.tsx` |
| Followed-person | `app/(tabs)/discover/u/[handle].tsx`, `components/discover/FollowedPersonTimeline.tsx` |
| Shared | `components/timelines/TimelineStepCard.tsx`, `FilterStrip.tsx` |
| Add flow | `components/timelines/AddToTimelineSheet.tsx`, `services/AddToTimelineService.ts` |
| Deck | `components/timelines/OnDeckZone.tsx`, `services/StepDeckService.ts` |
| Top header | `components/step-loop/TopHeader.tsx` — grid icon badge with deck count |
| Universal + | `components/capture/UniversalPlusSheet.tsx` — wire the blueprint + follow rows to real destinations |
| Debug | demo states |

---

## Out of scope

- Phase 8 (Share / fleet view)
- Phase 9 (Hinges)
- Phase 10 (HKDW onboarding)

---

## Codex prompt (paste verbatim)

```
Task: implement Phase 7 — Network Browsing & Add-to-Timeline — in betterat-app.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-7-network-browsing.md
  • Canonical: docs/redesign/ios-register/network-timelines-and-sharing-canonical.html (§1 + §2)

PROCEDURE:

1. Verify inputs. Copy from latest ~/Downloads project zip if missing. Commit brief on docs/ branch and merge.

2. Audit worktree. If uncommitted work in app/(tabs)/playbook/, app/(tabs)/discover/, components/playbook/, components/discover/, components/timelines/, stop and report.

3. Read brief + canonical §1 + canonical §2 end-to-end.

4. Schema:
   • step_deck (id, user_id, interest_id, source_type, source_id, title, body, status='on_deck', added_at, placed_at)
   • step_user_progress (id, user_id, blueprint_step_id, status, started_at, settled_at)
   • Ensure steps.visibility column exists with enum ('private','crew','fleet','public')

5. Implement (see Files-to-touch). All three browsing views (blueprint timeline / co-practitioners / followed-person), add-to-timeline sheet, on-deck zone. Behind PRACTICE_STEP_LOOP_IOS_REGISTER.

6. Wire Phase 2's Universal + sheet — the blueprint row navigates to /playbook/blueprints (list view), the follow row navigates to /discover/following (list of follows). These were stubs in Phase 2.

7. Add deck-count badge to top-header grid icon.

8. Verify all 12 acceptance criteria. Test placement choices (next-up writes correct order_index; specific-date writes correct timestamp). Test Save-to-deck → On-deck strip appears with new row → Place→ moves to timeline.

9. Flag off → today's surfaces unchanged.

10. Commit coherent units (one per major component group). PR with screenshots of all 5 surfaces (blueprint timeline, co-practitioners, followed-person, add sheet, on-deck) + screen recording of full add-from-blueprint flow.

OUT OF SCOPE:
  • Phase 8 (Share / fleet view)
  • Phase 9 (Hinges)
  • Phase 10 (HKDW onboarding)

CONSTRAINTS:
  • Reuse PRACTICE_STEP_LOOP_IOS_REGISTER
  • Privacy: followed-person timeline must filter to visibility = 'public'
  • If brief conflicts with current codebase, ask.
```
