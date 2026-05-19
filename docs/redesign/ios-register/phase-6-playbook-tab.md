# Phase 6 · Playbook Tab — Engineering Brief

**Purpose.** Build the Playbook tab — the second long-arc surface in the product. Where Practice accumulates capability evidence, Playbook accumulates **concepts** — the user's developing understanding of their field. Three zones on landing (Recent insights · Concepts in development · Settled foundations). Concept detail in the new register. Four entry points feeding the Recent Insights zone.

**Prerequisites.** Phases 0–5 merged.

**Source of truth.**
- `docs/redesign/ios-register/playbook-tab-canonical.html` (full reference — landing, lifecycle, concept detail, threading diagram)
- `docs/redesign/ios-register/becoming-loop-canonical.html` §1 (the spine — Playbook node)
- Decisions **D18, D19, D20**

**Feature flag.** Reuses `PRACTICE_STEP_LOOP_IOS_REGISTER`. No new flag.

---

## What lands

1. **Playbook landing surface** — hero with stats (47 insights · 8 testing · 12 settled), three zones top-to-bottom:
   - Zone 1: Recent insights (raw captures, dashed-border draft cards, *Refine into concept* / *Discard* actions)
   - Zone 2: Concepts in development (Forming + Testing concepts as cards with italic-serif titles, state pills, evidence counts)
   - Zone 3: Settled foundations (grouped list of closed concepts with `FOUNDATIONS` badge)
2. **Concept lifecycle** — Seed (gray) → Forming (amber) → Testing (purple) → Settled (green). Stages defined by:
   - Seed: just captured, no name
   - Forming: returned to 2+ times
   - Testing: linked to 1+ active step (the moment understanding meets practice)
   - Settled: user-promoted or 4+ evidence-step threshold crossed
3. **Concept detail surface** — italic-serif title, surface eyebrow + selection provenance + why-line, synthesis prose, trail of moments (quoted captures across steps), tested-in step mini-strip, capability chips, footer CTA varies by lifecycle state
4. **Four entry points feeding Zone 1**:
   - Universal `+` sheet's *Drop a concept* (Phase 2 already wired; Phase 6 makes the landing real)
   - Long-press a capture on Do → *Mark as concept seed*
   - Long-press a reflection paragraph on Reflect → *Mark as concept seed*
   - Long-press someone else's step on their timeline → *Save the idea behind this*
5. **Concept↔step threading** — concept proposes itself onto Plan's `WORKING WITH` row, gets evidenced via capture long-press *Mark as evidence of concept*, gets confirmed in Reflect's question *"Did this step deepen your understanding of {concept}?"* → new trail quote on the concept

---

## Acceptance criteria

1. Playbook tab, flag on, renders all three zones with real data from `playbook_insights` (Phase 2's table) and a new `playbook_concepts` table
2. Each insight in Zone 1 has Refine + Discard actions; Refine opens a new concept-creation flow (Phase 6.1 if too big — minimal version for Phase 6: just promotes the insight to a Forming concept with the captured text as initial body)
3. Each concept card in Zone 2 shows correct state pill, evidence count meta, linked-step count, captured-quotes count
4. Concept detail surface — italic-serif title, synthesis prose, trail of moments, tested-in step strip, capability chips, footer CTA per lifecycle state
5. CTA logic:
   - Forming → `Link to a step` (opens step picker)
   - Testing → `Promote to settled` (disabled until 3+ evidence steps; hint *"X more to promote"*)
   - Settled → no footer CTA (destination, not doorway)
6. Long-press menus surface *Mark as concept seed* on capture rows (Do tab) and reflection paragraph spans (Reflect tab). Tap → creates `playbook_insights` row → routes back to Playbook with confirmation toast
7. Long-press on someone else's step (Phase 7's surface) surfaces *Save the idea behind this as a concept* — for Phase 6, scaffold this as a no-op stub if Phase 7 isn't yet wired; for Phase 7 it activates
8. Plan tab `WORKING WITH` row renders concept chips when the step links to active concepts (read from `step_concept_links` table)
9. Reflect tab adds a final question per linked concept: *"Did this step deepen your understanding of '{concept title}'?"* — yes/no → on yes, writes a new trail quote to the concept
10. Flag off → Playbook tab renders today's surface unchanged
11. Debug route gains Playbook landing demo (3 zones populated) + Concept detail demo (Testing state)

---

## Component APIs

### `<PlaybookLanding>`

Hosts the three zones.

### `<InsightCard>` (Zone 1)

```tsx
interface InsightCardProps {
  insight: {
    id: string;
    sourceLabel: string;     // "From Race 3 Debrief · 2 days ago"
    sourceIcon: 'microphone' | 'bulb' | 'bookmark';
    body: string;
  };
  onRefine: () => void;
  onDiscard: () => void;
}
```

- Dashed gray-4 border, white 70% background, italic-serif body
- Action row: Refine into concept (blue) + Discard (label-3)

### `<ConceptCard>` (Zone 2)

```tsx
type ConceptState = 'seed' | 'forming' | 'testing' | 'settled';

interface ConceptCardProps {
  state: ConceptState;
  title: string;        // user's quoted phrase, rendered in italic serif
  whenLabel: string;    // "5 days · linked to 3 steps"
  meta: { icon: string; label: string }[];   // step links, quote count, capabilities
  onPress: () => void;
}
```

- Left border 2.5 px colored by state
- State pill mini in head row + when-label on the right
- Italic serif title, then meta row of icon+label chips

### `<SettledFoundationRow>` (Zone 3)

```tsx
interface SettledFoundationRowProps {
  name: string;        // italic-serif name in user's voice
  settledAt: string;   // "Settled March 14"
  evidenceStepCount: number;
  onPress: () => void;
}
```

- Grouped iOS list pattern, hairline separators, FOUNDATIONS green-tint badge on right, chevron-right

### `<ConceptDetail>`

Top-level surface for a concept. Composes:

- `<TopHeader>` with back button to Playbook
- `<StatePill>` purple for Testing, gray for Seed, amber for Forming, green for Settled
- `<StepStrip>` with surface eyebrow naming this is the Playbook concept
- Title block — surface-eye + italic-serif title + selection-provenance + why-line
- `<ConceptSynthesis>` — prose body with provenance line *"Synthesized from your quotes · drafted {when}"*
- `<TrailOfMoments>` — list of italic-serif quoted captures with provenance
- `<TestedInStrip>` — horizontal scroll of step mini-cards
- `<CapabilityChips>` — purple chips of capabilities this concept develops
- Footer CTA per lifecycle (see acceptance #5)

---

## Schema

New tables:

```sql
-- playbook_concepts
id, user_id, interest_id, title, body, state, created_at, settled_at,
  settled_by_promotion_at, ai_synthesis_text, ai_synthesis_drafted_at

-- step_concept_links — joins steps to concepts when Plan tab tags one
id, step_id, concept_id, linked_at

-- concept_trail_quotes — quoted captures across steps that evidence the concept
id, concept_id, capture_id, quote_text, source_label, created_at

-- playbook_insights (already exists from Phase 2)
  add: refined_to_concept_id (nullable, fills when user Refines)
```

---

## Files to touch

| Area | Files |
|---|---|
| Playbook landing | `components/playbook/PlaybookLanding.tsx`, `InsightCard.tsx`, `ConceptCard.tsx`, `SettledFoundationRow.tsx` |
| Concept detail | `components/playbook/ConceptDetail.tsx`, `ConceptSynthesis.tsx`, `TrailOfMoments.tsx`, `TestedInStrip.tsx`, `CapabilityChips.tsx` |
| Services | `services/PlaybookService.ts` (CRUD for insights, concepts, trail quotes), `services/ConceptSynthesisService.ts` (AI draft endpoint) |
| Long-press wiring | `components/step/do-tab/CaptureRow.tsx` (add mark-as-concept-seed), Reflect's question card (add same) |
| Plan tab | `components/step/plan-tab/WorkingWithConcepts.tsx` (new — the chip row) |
| Reflect tab | `components/step/reflect-tab/CapabilityPracticed.tsx` (add per-concept question) |
| Routes | `app/(tabs)/playbook/index.tsx`, `app/(tabs)/playbook/concept/[id].tsx` |
| Debug | Playbook landing + concept detail demo states |

---

## Out of scope

- Phase 7 · Network browsing
- Phase 8 · Share / fleet view
- Phase 9 · Hinges
- Phase 10 · HKDW onboarding
- Concept search / filter on landing (Phase 6.1)
- Concept versioning / fork-from-others (Phase 6.1)

---

## Codex prompt (paste verbatim)

```
Task: implement Phase 6 — Playbook tab — in the betterat-app repo.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-6-playbook-tab.md
  • Canonical: docs/redesign/ios-register/playbook-tab-canonical.html (full)
  • Spine reference: docs/redesign/ios-register/becoming-loop-canonical.html §1

If any are missing, copy from the latest project zip in ~/Downloads. Commit the brief on a docs/ branch and merge before implementing.

PROCEDURE:

1. Verify inputs exist. Copy from zip if missing.

2. Audit worktree. If uncommitted work touches components/playbook/, services/PlaybookService.ts, services/ConceptSynthesisService.ts, app/(tabs)/playbook/, stop and report.

3. Read brief end-to-end. Read playbook-tab-canonical.html in full. Read becoming-loop-canonical.html §1. Brief wins disagreements.

4. Schema first — add tables to migrations:
   • playbook_concepts (id, user_id, interest_id, title, body, state, created_at, settled_at, settled_by_promotion_at, ai_synthesis_text, ai_synthesis_drafted_at)
   • step_concept_links (id, step_id, concept_id, linked_at)
   • concept_trail_quotes (id, concept_id, capture_id, quote_text, source_label, created_at)
   • playbook_insights gains refined_to_concept_id (nullable)

5. Implement components (see brief's Files-to-touch table). Behind PRACTICE_STEP_LOOP_IOS_REGISTER.

6. Wire long-press menus on capture rows (Do) and reflection paragraphs (Reflect) — Mark as concept seed → creates playbook_insights row → toast.

7. Wire Plan tab's WorkingWithConcepts chip row — reads from step_concept_links.

8. Wire Reflect's per-concept question — on yes, writes new concept_trail_quotes row.

9. Verify all 11 acceptance criteria. Test all 4 lifecycle states (Seed, Forming, Testing, Settled). Test 4 entry points (universal +, capture long-press, reflection long-press, others-step long-press).

10. Flag off → today's Playbook unchanged. Verify.

11. Commit coherent units:
    • feat(playbook): schema (concepts, links, trail quotes)
    • feat(playbook): PlaybookService + ConceptSynthesisService
    • feat(playbook): InsightCard + ConceptCard + SettledFoundationRow
    • feat(playbook): PlaybookLanding three zones
    • feat(playbook): ConceptDetail surface
    • feat(playbook): long-press mark-as-concept-seed on Do and Reflect
    • feat(playbook): Plan WorkingWithConcepts row
    • feat(playbook): Reflect per-concept confirmation question
    • feat(debug): Playbook demo states

12. PR with screenshots: Playbook landing (full 3 zones populated), Concept detail Testing state, Concept detail Settled state, Plan with concept chips, Reflect with concept confirmation question. Plus a 15-second screen recording of the full empirical loop: capture → mark-as-concept-seed → refine in Playbook → link to a step → reflect → trail quote appears.

OUT OF SCOPE:
  • Phase 7 (Network browsing)
  • Phase 8 (Share / fleet view)
  • Phase 9 (Hinges)
  • Phase 10 (HKDW onboarding)
  • Concept search/filter (Phase 6.1)
  • Concept versioning (Phase 6.1)

CONSTRAINTS:
  • No new feature flag — reuse PRACTICE_STEP_LOOP_IOS_REGISTER
  • Schema additions required; existing tables unchanged
  • If brief conflicts with current codebase, ask before guessing.
```
