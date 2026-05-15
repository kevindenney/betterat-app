# Plan Tab Specification — Addendum to PRACTICE_TIMELINE_CANONICAL

**Status:** Source of truth for the Plan phase tab as of 2026-05-15
**Scope:** What the Plan tab inside each step card contains and how it behaves
**Relates to:** PRACTICE_TIMELINE_CANONICAL.md, which defined the three-phase tab structure (Plan / Do / Reflect) but left the Plan tab's interior unspecified.

This addendum locks the Plan tab's content model so it can be standardized across all interests (sailing, nursing, anything else). The model is derived from the existing nursing Pre-Clinical surface, generalized to be interest-agnostic.

---

## What the Plan tab is for

Before doing a step, the user commits to what the step is. The Plan tab is the surface where that commitment happens. It produces:

- A clear statement of what will be done
- A path for how it will be done (sub-steps the user can follow)
- A reason for why this step is next (connects to capability development)
- Capability tagging (so evidence from this step flows to the right places in Profile)
- Optional metadata (with whom, where, cross-interest suggestions)

The Plan is the input. The Do tab records what actually happens. The Reflect tab extracts learning. The Plan is *upstream* — it makes Do and Reflect possible.

---

## Anatomy

```
┌──────────────────────────────────────────────┐
│  Step Title                                  │
├──────────────────────────────────────────────┤
│  [ Plan ]  Do   Reflect                      │  ← phase tabs, Plan active
├──────────────────────────────────────────────┤
│                                              │
│  ╭──────────────────────────────────────╮   │
│  │ ✨  Build with AI Coach            →  │   │  ← primary path (AI Coach)
│  ╰──────────────────────────────────────╯   │
│                                              │
│  ── or fill in manually ──                   │  ← secondary toggle reveal
│                                              │
│  WHAT WILL YOU DO?                           │
│  ┌──────────────────────────────────────┐   │
│  │ (one-sentence summary)               │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  HOW WILL YOU DO IT?                         │
│  ○ Sub-step 1                                │
│  ○ Sub-step 2                                │
│  ○ Sub-step 3                                │
│  [ + add sub-step ]  [ ✨ Generate ]         │
│                                              │
│  WHY IS THIS NEXT?                           │
│  ┌──────────────────────────────────────┐   │
│  │ (the reason, connects to progress)   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  CAPABILITIES THIS DEVELOPS                  │
│  [ Starts ]  [ Weather reading ]  [ + ]     │  ← chips, system-suggested
│                                              │
│  ▾ More options                              │  ← expandable add-ons
│                                              │
└──────────────────────────────────────────────┘
```

When **More options** is expanded:

```
│  WITH WHOM (optional)                        │
│  [ + add collaborator ]                      │
│                                              │
│  WHERE (optional)                            │
│  [ + add location ]                          │
│                                              │
│  ALSO RELEVANT FOR                           │
│  Nursing → "Communication under pressure"    │
│   [ Suggest in Nursing → ]                   │
```

---

## The two paths

### Primary: AI Coach

A single tappable card at the top of an empty Plan tab. Tapping it opens a conversational interface where the user describes the step in natural language and the coach builds the plan with them:

- The coach asks clarifying questions about what, why, how
- The coach drafts sub-steps based on the activity
- The coach suggests capability tags from the interest's taxonomy
- The user reviews, edits, accepts
- On commit, the three core fields populate; the user can still edit any field directly

The AI Coach is the default-recommended path for new users and new steps. It does the heaviest lifting on "how" — which is where users get stuck.

### Secondary: Fill in manually

Below the AI Coach card, a quieter "or fill in manually" toggle. Tapping reveals the three core fields directly. Power users, users who already know what they want to plan, or users who prefer typing can skip the coach entirely.

Both paths produce the same data model. The coach is a guided producer; manual is direct production. Either way the Plan tab ends with the same content.

---

## The three core fields

### 1. What will you do?

- One sentence, typically 5-15 words
- Examples: "Practice IV insertion on the simulation arm" / "Sail a 30-minute upwind drill with focus on shifts" / "Read chapter 4 of the racing rules"
- Required for the step to be considered planned

### 2. How will you do it?

- An ordered list of sub-steps
- Each sub-step is one to two short lines of free text
- The list can be 1 item long or 15+; no enforced size
- Three ways to populate:
  - Type each sub-step manually
  - Tap **Generate** to have AI produce sub-steps from the What
  - AI Coach generates sub-steps as part of the conversational flow
- Sub-steps can be reordered (drag-handle), edited, deleted
- Each sub-step gets a checkbox so it can be marked done during the Do phase

Granularity varies by activity:
- "Get a syringe" — one sub-step, atomic
- "Measure the forestay length" — one or two sub-steps
- "Draw 50 circles" — could be one sub-step, or broken into 5×10 with rest

The AI's job is to produce *reasonable granularity for the domain*. The user adjusts if needed.

### 3. Why is this next?

- One to three sentences
- Connects to progression: "Building on last week's start drill" / "Identified as the weakest area in the last debrief" / "Required for the upcoming JHU clinical assessment"
- Required for the step to be considered planned (a step without a why is just a task; a step with a why is deliberate practice)

The Why is often where the AI Coach earns its keep — many users skip the Why on their own because it requires reflection. The Coach asks it explicitly.

---

## Capability tagging (hybrid model)

Capabilities are tagged on every step. The tagging happens automatically; the user can edit.

**How it works:**

1. As the user fills What and How (via Coach or manual), the system infers candidate capabilities from the interest's taxonomy
2. Inferred capabilities appear as chips below the three core fields, with confidence indicators (high confidence = filled chip, lower confidence = outlined chip)
3. The user can:
   - Accept the inferred set as-is (no action needed)
   - Add a capability the system missed (tap the **+** chip, search the taxonomy)
   - Remove a capability the system over-suggested (tap the chip, confirm remove)
4. The capability set is locked when the Do phase begins, but can be unlocked and edited up to the point of marking the step complete

**Why hybrid (not optional, not required):**

- Tagging always happens because evidence-without-tags can't flow to the Profile capability map (and Profile is *the deliverable* of BetterAt)
- System auto-tagging means users don't have to learn the taxonomy to use BetterAt
- User edit override means the user is always in control of how their work is categorized
- Confidence indicators let the user trust high-confidence tags and double-check low-confidence ones

If the system can't infer any capabilities (rare, but possible for ambiguous steps), the chip area shows "No capabilities inferred — tap + to tag" and the step can still proceed; capability tagging can be added in Reflect if needed.

---

## Optional add-ons (More options)

A collapsed-by-default section below the core fields and capability chips. Expanded only when relevant.

### With whom

- Collaborators on this step: training partners, crew, coaches, classmates, preceptors
- Pulls from the user's contacts within BetterAt (if they have BetterAt contacts) or accepts free-text names
- A step with collaborators shows a collaborator avatar on the timeline card

### Where

- Location of the step: a sailing venue, a clinical site, a gym, a home study desk
- Free-text or place picker (Google Places integration)
- Useful for filtering Profile evidence ("show me only my races at RHKYC")

### Also relevant for (cross-interest suggestions)

- System-generated when the step's capability tags match capabilities in another of the user's interests
- Example: a sailor with sailing + nursing interests plans a "race tactics under pressure" step; the system notices "Communication under pressure" exists in nursing's taxonomy; it surfaces this suggestion
- The user can tap **Suggest in [other interest]** to create a linked step suggestion in the other interest's Discover feed
- This is one-step-one-interest — the original step stays owned by its interest; the suggestion is a *link*, not a co-claim
- No data is duplicated; capability evidence flows only to the owning interest's Profile

---

## States

### Empty state (no plan yet)

- AI Coach card prominent
- "or fill in manually" toggle visible
- Three core field labels visible but inputs empty
- No capabilities chips
- More options collapsed

### Partially planned (some fields filled)

- The filled fields show their content
- Unfilled fields show placeholder text (e.g. "What's the why?")
- AI Coach card shrinks to a small "Continue with AI Coach →" link at the top
- Capability chips appear as inferred from filled fields

### Fully planned

- All three core fields filled
- Capability chips locked-in look (slight visual emphasis)
- More options may be expanded if user filled add-ons
- A subtle "Plan ready" indicator (e.g. green check next to the Plan tab label)
- The user can edit any field; editing surfaces a "Save changes" affordance

### Locked (Do phase started)

- Plan tab content is read-only by default
- A small **Edit plan** affordance is present (tapping unlocks editing with a confirmation)
- Editing the plan after Do has started is allowed but tracked (audit trail for the Reflect phase)

---

## Behavior

- Tab is always accessible regardless of plan completeness — user can land on Plan during Do, edit, leave
- Plan content is autosaved (no save button needed)
- The AI Coach state is preserved across sessions — if the user pauses mid-conversation with the coach, returning to the Plan tab resumes the conversation
- Capability chip edits don't require confirmation; instant tag/untag
- More options stays in the state the user left it (open or collapsed)

---

## Per-interest customization

The Plan tab's structure is universal across all interests. What varies per interest:

- **Capability taxonomy** — the chips that get inferred come from the interest's taxonomy
- **AI Coach prompts** — the coach's domain knowledge and conversation style are interest-specific (sailing coach asks about wind/current; nursing coach asks about patient acuity/protocols)
- **Cross-interest suggestions** — driven by the user's other interests and their taxonomies
- **Empty state copy** — slight per-interest tone variations are allowed if they help users feel the interest's identity, but the three fields are always What/How/Why

What does NOT vary per interest:

- The three field names (What / How / Why)
- The two-path structure (AI Coach primary, manual secondary)
- The capability-tagging hybrid model
- The optional add-ons set (With / Where / Cross-interest)

This is the standardization commitment. Sailing's existing custom plan model is superseded by this universal model.

---

## What this supersedes

- Sail Racing's prior step-detail design (whatever it currently does)
- Nursing's Pre-Clinical surface (becomes Plan, conformant to this spec)
- Any other interest-specific plan designs

Existing plan content does NOT need migration in Phase B (rename only). Phase D (capability data model) will handle data migration for capability tagging.

---

## Out of scope for this specification

- The AI Coach's specific conversational flow (separate spec; depends on chosen LLM and prompt templates)
- The capability taxonomy contents for each interest (separate work per interest)
- The blueprint/template system (a blueprint is a pre-built Plan — uses this same model but lives in Playbook)
- Coach attribution and authorship (whose coach is this; user's own AI vs. assigned mentor coach)

---

## Open questions deferred

1. **Multi-step plans (sub-plans).** Some activities have sub-steps that themselves need planning (e.g. a race day with multiple races). Does the model support nesting? Or is each race a separate step?
2. **Plan templates within an interest.** Should a user be able to save "this Plan structure" as a template for future similar steps? (Probably yes; lives in Playbook.)
3. **Plan sharing during planning (not after).** Can a user invite a collaborator into a Plan in real-time, like Google Docs? Or is collaboration only at the Plan-then-share level?
4. **Voice input for AI Coach.** Especially relevant in the field (sailing dock, hospital floor). Likely yes; separate spec.
5. **Plan history / versioning.** If the user edits Plan after Do starts, do we keep the old plan visible for comparison? (Suggested: yes; surfaced in Reflect for "did the plan match reality?")

---

## Status of this addendum

This is the source-of-truth for the Plan tab. Implementation specs (Phase B, Phase C, and later Phase D capability work) should reference this addendum.

When implementation reveals tensions, this document is updated, not silently deviated from.
