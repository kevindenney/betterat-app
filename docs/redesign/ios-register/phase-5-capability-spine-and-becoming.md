# Phase 5 · Capability Spine + Profile of Becoming — Engineering Brief

**Purpose.** Wire the capability spine end-to-end. Phase 4 writes `step_capability_evidence` rows on Save & settle. Phase 5 closes the loop: those rows update the Profile capability map, and a new **Profile of Becoming hero** lands at the top of Profile Frame 1 — a lifetime sketchbook arc drawn from every confirmed evidence point across every step.

**Prerequisites.** Phases 0, 1, 1-refinements, 2, 3, 4 merged.

**Source of truth.**
- `docs/redesign/ios-register/becoming-loop-canonical.html` §1 (spine diagram) + §6 (Profile of Becoming hero with SVG arc) + decision **D10c**
- `docs/redesign/ios-register/profile-screen-canonical.html` — existing Profile Frame 1

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`.

---

## Acceptance criteria

1. After Save & settle on Reflect, navigating to Profile shows the affected capability rows with updated evidence counts and pip levels within ~500 ms (no manual refresh).
2. `<BecomingHero>` renders at top of Profile Frame 1, between hero block and capability map.
3. Hero renders with real data: baseline + climbing Bézier arc, purple evidence dots, green settled-wash band, blue NOW marker, year tick labels, legend below.
4. Empty state — zero confirmed evidence shows faint dashed baseline + lede *"Your line starts the first time you settle a step."*
5. Drilldown (Profile Frame 2) shows new evidence entries from Reflect at the top of its trail.
6. Flag off → Profile Frame 1 identical to today.
7. Debug route adds a "Becoming hero · 47 evidence · 1 settled" demo state.

---

## Component APIs

### `<BecomingHero>`

```tsx
interface EvidencePoint {
  capturedAt: string;
  capabilityId: string;
  capabilityName: string;
  strength: 'worth-noting' | 'material' | 'strong';
  levelAtTime: 0 | 1 | 2 | 3 | 4;
}

interface SettledRange {
  startAt: string;
  endAt: string;
  pathName: string;
}

interface BecomingHeroProps {
  interestName: string;
  startedAt: string;
  evidencePoints: EvidencePoint[];
  settledRanges: SettledRange[];
  nowAt: string;
  capabilityCount: number;
  evidenceCount: number;
  pathsSettledCount: number;
  onPress?: () => void;
}
```

- Top: purple sparkles eyebrow *"Profile of Becoming"* + serif italic title *"Three years in {interest}"* + serif body lede
- SVG canvas viewBox `0 0 320 120`
- Bézier curve climbing left→right; y = `100 - (avgLevel * 18)`; x = `(months_since_start / total_months) * 316 + 4`
- Year ticks at bottom, y `100-106`
- Evidence dots: 2.4-px purple; "strong" 2.6 px; settled-milestone dots 2.8 px green-filled
- Settled wash: filled polygon under the arc, opacity 10%, ios-green
- NOW marker: 3.2-px blue dot + 6-px blue-tint outer ring
- Legend: 3 dot-and-label items (evidence · paths settled · active)

### `<CapabilityRow>` (extend existing)

Add `JUST EARNED` chip — 8 / 700 / 0.4 ls / upper / green-deep on green-tint background. Renders when row has confirmed evidence in last 24 hours. All other anatomy preserved.

---

## Services

### `CapabilityAggregationService`

```tsx
interface CapabilityMapEntry {
  id: string;
  name: string;
  level: 'emerging' | 'developing' | 'competent' | 'fluent' | 'expert';
  levelIndex: 0 | 1 | 2 | 3 | 4;
  pipsOn: number;
  pipsTotal: 5;
  evidenceCount: number;
  evidenceStepCount: number;
  isFresh: boolean;
  isJustEarned: boolean;
}

async function getCapabilityMap(userId: string, interestId: string): Promise<CapabilityMapEntry[]>;
```

- Pulls from `step_capability_evidence WHERE user_id = X AND interest_id = Y AND confirmed = true`
- Level thresholds: emerging ≤ 2 evidence rows, developing 3-6, competent 7-12, fluent 13-24, expert 25+ (adjust to existing model if different)
- Sort by recency of latest evidence

### `BecomingArcService`

```tsx
interface BecomingArcData {
  startedAt: string;
  evidencePoints: EvidencePoint[];
  settledRanges: SettledRange[];
  nowAt: string;
  bezierPath: string;
  yearTicks: { x: number; label: string }[];
}

async function getArcData(userId: string, interestId: string): Promise<BecomingArcData>;
```

- Queries `step_capability_evidence` ordered ASC
- For each row, computes avg capability level at that time
- Generates smoothed Bézier through (x, y) points
- Bins settled ranges from `paths` table where `status = 'settled'`

---

## Files to touch

| File | What changes |
|---|---|
| `components/profile/BecomingHero.tsx` (new) | Hero card with SVG arc |
| `components/profile/CapabilityRow.tsx` | Add JUST EARNED chip |
| `components/profile/index.ts` | Export hero |
| `services/CapabilityAggregationService.ts` (new/extend) | Aggregation logic |
| `services/BecomingArcService.ts` (new) | Arc data generation |
| `app/(tabs)/profile/index.tsx` | Mount hero at top, behind flag |
| `app/debug/step-loop-primitives.tsx` | Becoming hero demo |

No schema changes. Uses `step_capability_evidence` from Phase 4 + existing `paths`.

---

## Out of scope

- Phase 6 · Playbook tab (concept spine, not capability)
- Phase 7 · Network browsing
- Phase 8 · Share / fleet view
- Public web profile (already exists)
- Faculty competency assessment (separate role/phase)
- Trophy of Becoming refresh

---

## Codex prompt (single comprehensive instruction — paste verbatim)

```
Task: implement Phase 5 of the iOS register migration — capability spine plumbing + Profile of Becoming hero — for the betterat-app repo.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-5-capability-spine-and-becoming.md
  • Canonical (visual): docs/redesign/ios-register/becoming-loop-canonical.html — read §1 and §6
  • Canonical (existing surface): docs/redesign/ios-register/profile-screen-canonical.html — Frame 1

If any are missing, abort. The latest project zip is at ~/Downloads (most recent BetterAt Redesign zip). Extract and copy into docs/redesign/ios-register/.

PROCEDURE:

1. Verify all three input files exist. If missing, copy from the latest zip in ~/Downloads. Commit the brief on a docs/ branch and merge before implementation.

2. Audit worktree. If uncommitted work in components/profile/, services/CapabilityAggregationService.ts, services/BecomingArcService.ts, or app/(tabs)/profile/, stop and report. Do not touch uncommitted work — ask before discarding or merging.

3. Read the brief end-to-end. Read becoming-loop-canonical.html §1 + §6 end-to-end. Read profile-screen-canonical.html Frame 1. Brief wins where it disagrees with a canonical.

4. Implement:
   a. services/BecomingArcService.ts with getArcData(userId, interestId)
   b. services/CapabilityAggregationService.ts with getCapabilityMap(userId, interestId)
   c. components/profile/BecomingHero.tsx — SVG arc, evidence dots, settled wash, NOW marker, legend. Empty state per acceptance #4.
   d. components/profile/CapabilityRow.tsx — JUST EARNED chip
   e. app/(tabs)/profile/index.tsx — mount <BecomingHero> behind PRACTICE_STEP_LOOP_IOS_REGISTER, above existing capability map
   f. /debug/step-loop-primitives — add Becoming hero demo state

5. Verify the spine end-to-end. With flag on:
   - Complete a Reflect step (Phase 4) and confirm 1-2 capabilities at Strong.
   - Navigate to Profile. Capability rows show new evidence count + JUST EARNED chip. Becoming hero arc has a new dot. NOW marker advances.
   - Flag off — hero disappears, Profile identical to today.

6. Walk all 7 acceptance criteria from the brief.

7. Commit coherent units:
   - feat(profile): BecomingArcService + CapabilityAggregationService
   - feat(profile): BecomingHero component
   - feat(profile): CapabilityRow JUST EARNED chip
   - feat(profile): mount Becoming hero behind feature flag
   - feat(debug): Becoming hero demo state

8. PR with:
   - Screenshots: Profile Frame 1 flag on (hero) + flag off (no hero). Sailing and nursing interests.
   - 10-second screen recording: complete Reflect → navigate to Profile → arc updates + JUST EARNED chip appears.

OUT OF SCOPE — do not touch:
  • Playbook tab (Phase 6)
  • Network browsing (Phase 7)
  • Share / fleet view (Phase 8)
  • Public web profile (exists, no changes)
  • Faculty competency assessment (separate phase)
  • Trophy of Becoming refresh

CONSTRAINTS:
  • No new feature flag — reuse PRACTICE_STEP_LOOP_IOS_REGISTER
  • No schema changes — step_capability_evidence from Phase 4 is sufficient
  • If brief conflicts with current codebase, ask before guessing.
```
