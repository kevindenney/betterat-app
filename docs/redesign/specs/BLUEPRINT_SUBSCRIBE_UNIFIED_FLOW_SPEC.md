# Unified Blueprint Subscribe Flow — Spec

> Status: **Draft for alignment** (not built). Author: walkthrough w/ Kevin, 2026-06-30.
> Supersedes the institutional "adopt whole plan → auto-materialize" behavior
> shipped in the student-delivery bridge (`CohortBlueprintService`).

## 1. Principle

**The timeline belongs to the learner, not the org or mentor.** A blueprint is
something a learner *follows*; it is not allowed to write the learner's timeline
on its own. No blueprint — institutional, marketplace, or peer "follow-a-plan" —
silently materializes its whole step list into someone's timeline.

Subscribing is a **relationship** ("this plan is now in my Library, with
progress"). Steps enter the timeline only on the learner's terms. The subscribe
moment offers a small amount of momentum — *how do you want to begin* — but never
takes the timeline out of the learner's hands.

## 2. Current state (what we're unifying)

Three blueprint sources adopt three different ways today:

| Source | Tables | Subscribe creates… | Steps reach timeline by… |
| --- | --- | --- | --- |
| **System A** (peer "follow a plan") | `timeline_blueprints`, `blueprint_steps`, `blueprint_subscriptions` | a `blueprint_subscriptions` row + auto-follow author (`useSubscribe`) | learner **pulls one step at a time** (`useAdoptBlueprintStep` → `adoptStep`) |
| **Marketplace** (Stripe-priced) | + `marketplace_subscriptions` | a paid subscription row | same individual-pull model |
| **Institutional** (admin Studio) | `blueprints`, `blueprint_step_templates`, `blueprint_cohorts` | *nothing* — no subscription row | **all steps dumped at once** (`materializeAssignedBlueprint`) |

So System A already separates *subscribe* (relationship) from *adopt* (step into
timeline) — that half is correct and matches the principle. The institutional
path is the outlier that violates it. The fix is to bring institutional into the
same shape **and** give every path a single, explicit "how do you want to begin"
choice at subscribe time, instead of A's "pull forever, one at a time" vs B's
"all at once."

## 3. The unified subscribe flow

When a learner taps **Subscribe / Add to plan** on any blueprint, present one
sheet (`BlueprintSubscribeSheet`) with two decisions:

### Decision 1 — Which interest?
- Default: the blueprint's authored `interest_id` (the author's framing).
- Options: any of the learner's existing interests, **or "Add as a new interest"**
  (mints a new interest, seeded from the blueprint's interest vocab).
- The author default is pre-selected; override is allowed but deliberate (one tap
  to change), so the common case is frictionless and re-homing is a conscious act.
- **Guardrail (institutional):** when steps carry org-competency capability tags,
  re-homing into an unrelated interest risks orphaning the evidence loop (see §6).
  For institutional blueprints, keep the author interest as the strong default and
  show a one-line note if the learner overrides ("This plan's progress reports to
  {org}; keeping it under {author interest} keeps that link").

### Decision 2 — How do you want to begin?
Radio choice, three options:
- **Just the first step** — materialize only step 1 (lowest `sort_order`). Gentle
  start; the rest stay pullable.
- **The whole plan** — materialize all steps now. For the learner who trusts the
  plan and wants it laid out.
- *(optional, phase 2)* **Just subscribe** — relationship only, zero steps; pull
  whenever. Useful for "save for later."

Confirm → create the subscription record (relationship) **and** materialize the
chosen starting set into the target interest's timeline.

### After subscribe — pull is always available
The "first vs whole" choice sets the **starting** state, not a permanent one. A
subscribed blueprint always exposes **"Add next step"** / **"Add remaining N"**
from:
- the Library **Plans** card / the assigned-blueprint preview, and
- the blueprint's own surface (System-A feed today; institutional preview at
  `/blueprint/assigned/[id]`).

This keeps the timeline a living, learner-pulled thing.

## 4. Data model

- **Relationship record.** Every subscribe writes one row in a **source-agnostic
  `blueprint_subscriptions`** (decision §7.1) so Library Plans, counts, and
  progress have a single read path. New/changed columns:
  - `blueprint_system` — 'timeline' | 'institutional' | 'marketplace'.
  - `target_interest_id` — the learner's chosen interest (may differ from the
    blueprint's authored interest).
  - `entry_granularity` — 'first' | 'all' | 'none' (the *starting* choice).
  - `blueprint_id` keeps its value but its hard FK to `timeline_blueprints` is
    relaxed (id now points at `timeline_blueprints` or `blueprints` per system);
    integrity via the discriminator + a validation trigger.
- **Materialization** stays as-is per source:
  - System A → `adoptStep` (existing).
  - Institutional → `materializeAssignedBlueprint`, but parameterized to take a
    **step subset** (`'first' | 'all' | stepIds[]`) and the **chosen interest**,
    instead of always all + author interest. It is already idempotent
    (`source_type='marketplace_copy'`, `source_id=template.id`), so "Add remaining"
    re-runs safely.
- **Provenance** is unchanged and already shipped: materialized steps carry
  `metadata.source='institutional_blueprint'` + `metadata.blueprint_id`, surfaced
  as the "From {blueprint}" banner.

## 5. How the surfaces fit

- **Library → Plans:** lists every subscribed blueprint (all three sources) with
  `doneCount / stepCount` progress. A subscribed-but-no-steps blueprint shows
  "0 added · Add first step." (Already reads assigned + System-A; extend to honor
  the new relationship rows.)
- **Library → Blueprints / "ASSIGNED TO YOU":** the discover surface. "Add to
  plan" opens `BlueprintSubscribeSheet` (not an instant dump).
- **Assigned-blueprint preview (`/blueprint/assigned/[id]`):** keep the step list;
  the bottom CTA becomes "Add to plan" → opens the subscribe sheet; per-step
  "Added" markers stay; add per-step "Add this step" once subscribed (optional).
- **New-step composer ("FROM YOUR BLUEPRINTS"):** this is the per-step pull
  surface. Today it only lists System-A blueprint steps. Under the unified model
  it should also list **next pullable steps from any subscribed blueprint**
  (institutional included) — so the composer is where "add the next step" lives,
  consistent across sources. (This resolves the earlier "foley not in the picker"
  report: it wasn't a bug under the old model, but under the unified model the
  picker *should* surface subscribed-blueprint next steps.)

## 6. Edge cases & guardrails

- **Org-competency mapping vs re-homing.** Institutional steps' capability tags
  feed the Dean's rollup via `step_capability_evidence.org_competency_id`. That
  linking is keyed off the step + org, not the interest, so re-homing the interest
  does **not** by itself break the rollup — but the learner's *Atlas coverage* for
  that interest is what visualizes progress, so a mismatched interest makes the
  learner's own view incoherent. Hence: strong author-interest default + soft note.
- **Idempotency / re-subscribe.** Materialization already skips templates already
  in the timeline. "Add remaining" and re-subscribe are safe.
- **Unsubscribe.** Removes the relationship row; **does not delete** already-pulled
  timeline steps (they're the learner's now). This matches the principle — the org
  can stop publishing, but can't reach into the learner's timeline and delete.
- **"New interest" path.** Minting an interest at subscribe time reuses the
  existing add-interest flow; seed vocab from the blueprint's interest.

## 7. Decisions (locked 2026-06-30)

1. **One source-agnostic subscription table.** Evolve `blueprint_subscriptions`
   into the single relationship table for *every* source instead of adding a
   sibling. Add `blueprint_system` ('timeline' | 'institutional' | 'marketplace')
   discriminator, `target_interest_id` (the learner's chosen interest, may differ
   from the blueprint's authored interest), and `entry_granularity`
   ('first' | 'all' | 'none'). The hard cross-table FK on `blueprint_id` (today →
   `timeline_blueprints`) is relaxed — replaced by the discriminator + a
   validation trigger (or app-level integrity), since the id now points at
   `timeline_blueprints` *or* `blueprints` depending on system. **Rationale:**
   every consumer (Library Plans, counts, "my subscriptions") gets one read path
   forever instead of UNION-ing two or three sources; this is the long-term
   maintainability win. `marketplace_subscriptions` folds in later as a
   *payment* record alongside the relationship row, not a parallel relationship.
2. **Decision 2 ships all three in v1:** "Just the first step" / "The whole plan" /
   "Just subscribe (no steps)". Once subscribe and materialize are decoupled,
   "none" is just "materialize zero" — nearly free — and it's the purest
   expression of the principle. Teach the full sheet once rather than reshape it.
3. **New-step composer is unified** to surface next pullable steps from *all*
   subscribed blueprints (institutional included). This is the committed target,
   not optional — the composer is THE per-step pull surface and must not branch by
   source. Sequenced as a later phase for delivery, but it *is* the end-state.
4. **Marketplace (paid) uses the same sheet.** Payment buys access, not a forced
   dump; after payment the learner still chooses interest + entry granularity.

## 8. Suggested phasing

- **P1:** `BlueprintSubscribeSheet` (interest target + first/whole/none) wired for
  **institutional** (replaces the auto-dump); source-agnostic subscription row;
  Library Plans honors it; "Add remaining" from the preview.
- **P2:** Route **System-A / marketplace** subscribe through the same sheet
  (unify); marketplace payment writes the relationship row + payment record.
- **P3:** New-step composer surfaces next pullable steps from all subscribed
  blueprints; per-step pull on the preview.
