# Phase 1 · Refinements — Engineering Brief

**Purpose.** Three small visual corrections to Phase 1 based on real-build feedback. The Plan tab body has the right content but the chrome is louder than it needs to be. This PR retires noise — per-field AI sparkles, internal-scroll fields, oversized phase tabs — and lets the content breathe.

**Reuses Phase 1's flag.** `PRACTICE_STEP_LOOP_IOS_REGISTER` stays. No rollback flag. No new flag.

**Source of truth (revised).** This brief supersedes three specific component decisions from Phase 1. Where this brief and `phase-1-plan-tab.md` disagree, this brief wins.

---

## What changes

### D25 · Per-field ✦ icons retire

The small purple sparkle button in the top-right of every `WHAT / HOW / WHY` field card disappears.

The single quiet `<AIHelperLine>` at the top of the Plan body (already shipped in Phase 1) is the only AI affordance in the Plan body. Per-field scoping was added in Phase 1 — in practice it adds visual noise without affordance value, because the helper line already gives the user a one-tap entry to AI Coach.

**Implementation:**
- In `components/step/plan-tab/FieldCard.tsx`: remove the `<button class="help-spark">` JSX entirely. Remove the `onCoachPress` prop from the API.
- Adjust the field-card padding/header layout so the eyebrow sits alone, full width.
- No backend changes.

### D26 · Fields auto-grow, no internal scroll

Every text input in the Plan body (and on Reflect body when its time comes) replaces the *"fixed height + multiline + scroll-when-overflow"* pattern with **auto-grow up to a soft cap, then page-level scroll**.

**The principle:** *a field should never have its own scrollbar*. The Plan body itself scrolls; individual fields grow with content.

**Implementation:**
- In `components/step/plan-tab/FieldCard.tsx` (and any other text input in the new register):
  - Remove explicit `minHeight` and `maxHeight` styling that creates a fixed window
  - Remove `scrollEnabled` props that allow inner-text scroll
  - Use React Native's auto-height pattern: `multiline={true}` with `onContentSizeChange` adjusting state-tracked height, capped at ~8 lines
  - Past the cap, the field stops growing visually but the user can keep typing — the surrounding page scroll handles overflow
- For web/HTML equivalents: a `<textarea>` with `rows="2"` minimum, JS that grows `rows` as content lengthens, capped at 8. No `overflow-y: scroll` on the textarea.

**Visual reference:** look at the older horizontal-card design (the cleaner one) — the WHAT body is just text in the card with no scroll affordance, no fixed window. That's the look.

### D27 · Phase tabs quieter

`<PhaseTabs>` from Phase 0 ships at a slightly larger scale than the older design. Bring it down to match the quieter register.

**Implementation:**
- In `components/step-loop/PhaseTabs.tsx`:
  - Active tab label: `13px / 500 weight` (was 13.5 / 600) — slightly smaller, slightly lighter
  - Active underline: `1.5px` (was 2px)
  - Inactive label color: `label-3` rgba (60,60,67,0.60) — already correct, leave
  - Ring sizes: keep 14×14 but the "ready" green ring becomes a `6px filled green pip` instead of the green-circle-with-white-check pattern. Pending stays a `6px gray-3 outline pip`. Live stays `6px coral filled with subtle pulse`.
  - Padding around each tab: reduce vertical padding by 2px (compact-up the tab strip)

**Why:** the ready-state white-check-on-green-circle is too celebratory for a phase indicator. A small filled green dot is the right amount of signal — the user reads it without it competing with the active blue underline.

**Visual reference:** screenshot of the older Plan/Do/Reflect tab style — small text, simple colored dots, no large filled rings.

---

## Files to touch

| File | What changes |
|---|---|
| `components/step/plan-tab/FieldCard.tsx` | Remove help-spark JSX + prop; auto-grow textarea pattern; no internal scroll |
| `components/step/plan-tab/index.ts` | Update barrel export's FieldCard types if API surface changed |
| `components/step-loop/PhaseTabs.tsx` | Smaller text, lighter weight, thinner underline, filled-dot rings instead of check-circles |
| `components/step/PlanTab.tsx` | Drop any `onCoachPress` callers for per-field that no longer exist |
| `components/step/StepPlanQuestions.tsx` | Same |
| `app/debug/step-loop-primitives.tsx` | Update PhaseTabs demo states + remove FieldCard's help-spark demo |

No new components. No new tests beyond updating any snapshot tests that captured the old visuals.

---

## Acceptance criteria

A Phase 1 refinements PR is mergeable when:

1. Plan tab body, flag on, shows no `✦` button in any field-card
2. Every text input grows with content; no field has a visible inner scrollbar; the page scrolls instead when the body is tall
3. Phase tabs at top of step card visually match the older design's restraint: small text, small green/coral filled dot pips (not circles with checks), thin blue underline on active
4. `<AIHelperLine>` at top of Plan body still works and is the only AI affordance in the body
5. Flag off — still identical to today's production build
6. Debug route's PhaseTabs demo updated to show the new ring style

---

## Visual fidelity reference

The user has the older cleaner Plan-card design (the one with WHAT/HOW/WHY rendering as plain text cards, small phase tabs, no per-field sparkles) saved as a CleanShot from 2026-05-17. Match that aesthetic. The principle:

> The Plan body should feel like a clean note that you're allowed to edit, not a form.

---

## What this PR does *not* do

Still out of scope (Phase 2+):
- Universal `+` sheet
- Do tab refresh
- Reflect tab refresh
- Capability spine plumbing for Do/Reflect

These remain in their original phase positions.

---

## Suggested Claude Code prompt (paste verbatim)

```
Implement the Phase 1 refinements per docs/redesign/ios-register/phase-1-refinements.md.

Three tightly scoped corrections to Phase 1's Plan tab work:
  1. Remove the per-field ✦ help-spark button from <FieldCard>
  2. Replace fixed-height + scroll text inputs with auto-grow + page-scroll
     (no field has its own scrollbar; the page scrolls instead)
  3. Tweak <PhaseTabs> in components/step-loop/ — smaller text, lighter weight,
     thinner underline, filled-dot pips instead of green-check rings

Where this brief and phase-1-plan-tab.md disagree, this brief wins.

Reuses PRACTICE_STEP_LOOP_IOS_REGISTER — no new flag, no rollback flag.

Out of scope: anything past Phase 1 (Universal + sheet, Do tab, Reflect tab,
capability plumbing for downstream surfaces).

When done: PR with before/after screenshots of the Plan body — empty,
partial, and filled — with the flag on. Also include a screenshot of the
updated debug route /debug/step-loop-primitives.
```
