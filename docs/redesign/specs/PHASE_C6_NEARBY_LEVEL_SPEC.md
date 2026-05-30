# Phase C.6 Spec: Nearby Level

## Goal

Lock the L2 zoom surface to the canonical `Nearby` behavior shown in the design file: a short-horizon planning view centered on `NOW`, showing a few adjacent steps as an editable sequence rather than a calendar. This spec supersedes any remaining `week` / `few` interpretations that make L2 read like a dated schedule.

## Design Sources

- User-provided canonical: zoom-level design file, Screen 08, verb `PLANNING`
- Existing code surface: [components/ios-register/timeline-zoom/L2WeekView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L2WeekView.tsx)
- Related shared types: [components/ios-register/timeline-zoom/types.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/types.ts)
- Canonical umbrella: [docs/redesign/PRACTICE_TIMELINE_CANONICAL.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/PRACTICE_TIMELINE_CANONICAL.md)

## Naming

- `Few` in older design language is now `Near` / `Nearby`.
- In product copy, prefer `Nearby`.
- In implementation names, `L2WeekView` is legacy naming only; the surface semantics are `Nearby`, not `Week`.

## Core Idea

`Nearby` is not a calendar and not a reflection chart.

It is the user’s immediate planning field:

- a few steps wide
- centered on `NOW`
- aware of the season’s recent pattern
- editable in sequence
- informed by library memory

The user should feel: “I can see what just happened, what is in play, and what I should place next.”

## Canonical Principles

### 1. `NOW` is the spine

The vertical `NOW` bar is the primary organizing device. It divides:

- completed or past-nearby work on the left
- the in-play step at center
- planned next moves on the right

The nearby level should read left-to-right as `just happened -> now -> next`, not as `Monday -> Sunday`.

### 2. Sequence beats schedule

L2 is about order, not date precision. Steps to get better are rarely planned by day-of-month, so the UI must not imply that the primary job is calendar scheduling.

Allowed:

- relative time cues
- lightweight pre-titles like `NEXT`, `IN PLAY`, `DONE`
- optional day-of-week or session labels when genuinely useful

Not allowed as the dominant grammar:

- day-of-month numbers
- a full week strip that implies each step belongs to a calendar slot
- empty date cells that suggest “missing scheduled days”

### 3. The nearby level is tactics-heavy

The nearby level inherits tactical context from the surrounding season. The top strip should summarize the recent shape in one sentence, for example:

- `Spring '26 has been tactics-heavy.`
- `Recent sessions have skewed toward rig work.`

This strip exists to influence the next few placements, not to deliver a deep reflection.

### 4. Planning should be visibly editable

The user should feel they can shape the run of steps directly. L2 therefore needs:

- drag to reorder
- a visible add-step affordance between adjacent steps
- insertion that feels local to the sequence, not routed through a distant global composer

### 5. Progress balance must be legible at a glance

The nearby summary should show the distribution across short-horizon states:

- `3 done`
- `1 in`
- `3 planned`

These counts are not decoration. They tell the user whether nearby work is over-indexed on completion, overloaded in flight, or underplanned.

### 6. The library should intervene gently

The bottom lilac card is not generic coaching copy. It is a pattern-aware suggestion from accumulated memory:

- something missing lately
- a repeated peer suggestion
- an underdeveloped capability
- a useful next move implied by recent work

The nearby librarian prompt is planning-oriented, not reflective in tone.

## Layout

### Top band

Contains:

- the season-shape context sentence
- the short-horizon counts: `done / in / planned`

This band should feel like framing metadata for the sequence below.

### Main field

Contains:

- 5-7 visible step columns, centered on `NOW`
- the current step aligned to the `NOW` bar
- compressed completed steps to the left
- planned steps to the right
- insertion affordances between columns

The current step should be the most visually present card. Completed and planned cards may be narrower or quieter, but they must still remain identifiable.

### Bottom band

Contains:

- one planning-oriented librarian/library prompt
- one primary CTA
- optional secondary dismiss CTA

This band should sit below the sequence as a planning nudge, not float ambiguously as a general alert.

## Step Card Requirements

Each nearby card should carry only enough information to identify and place the step:

- state
- title
- optional capability hue
- optional lightweight provenance or peer signal

The nearby level is not the full step-detail card. It should stay skimmable.

### State treatment

- `done`: visually quieter, clearly complete
- `in play`: visually lifted and aligned with `NOW`
- `planned`: present but provisional

The central in-play card should feel active without becoming a full L1 detail surface.

## Counts Model

The summary row should be derived from the visible nearby sequence, not from the entire season.

Required buckets:

- `done`
- `in`
- `planned`

Rules:

- exactly one step can be `in` within the nearby sequence
- steps left of `NOW` are typically `done`
- steps right of `NOW` are typically `planned`
- if a past step remains unfinished, show that in its card state, but do not collapse the `NOW` grammar

## Add-Step Affordance

The inline add-step affordance is required.

Behavior:

- appears between adjacent steps
- inserts into that exact position
- preserves the user’s sense of local authorship over the sequence

The affordance should not require the user to infer where a globally-created step will land.

## Librarian Prompt

### Purpose

Help the user plan better because the system remembers patterns they may not notice locally.

### Good nearby prompts

- `Heavy-air helm work hasn't appeared since Winter.`
- `You have repeated tactics work three sessions in a row.`
- `Mihkel's rig note still has not been turned into a step.`

### CTA intents

Allowed primary intents:

- accept suggestion
- add step
- open suggestion inbox

Discouraged for L2:

- long-form reflection
- season retrospective

Those belong more naturally to L3 or L4.

## Interaction Model

### Tap

- tap any nearby card to zoom into L1 focused on that step

### Pinch

- pinch in to L1
- pinch out to L3

### Drag

- long-press and drag a step horizontally to reorder

### Insert

- tap the inline plus between two steps to insert there

### Dismiss librarian prompt

- secondary CTA should quietly dismiss without disrupting sequence editing

## Data / Type Expectations

The current `TimelineWeek` shape is close, but L2 should not depend on calendar semantics for its primary UI.

Keep:

- `contextStrip`
- `planningHint`
- ordered `steps`

Do not require for canonical L2 presentation:

- day-of-month labels
- full seven-day occupancy

If relative timing is useful, add lightweight nearby-specific metadata such as:

- `relativePosition`: `done | current | planned`
- `sequenceCountSummary`
- `insertableBoundaries`

## Implementation Delta From Current L2

Current drift in [components/ios-register/timeline-zoom/L2WeekView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L2WeekView.tsx):

1. It still renders a full day strip with day letters and day-of-month numbers.
2. It makes the view read as a `week` carousel rather than a present-centered nearby sequence.
3. It places suggested next steps in a separate recommendation block, but the canonical nearby design wants inline insertion plus a bottom planning hint.
4. It does not yet expose the `done / in / planned` balance row as the top-line summary.
5. It has reorder, but not the explicit between-step insert affordance shown in the design.

## Required Changes For Canonical Alignment

### Priority 1

- Remove day-of-month numbers from L2
- Replace week-strip prominence with a strong `NOW` divider
- Add nearby summary counts: `done / in / planned`
- Keep the season-shape context strip above the sequence

### Priority 2

- Add inline between-step insertion affordances
- Ensure the in-play card is visually centered and lifted
- Make planned vs done cards visibly different at a glance

### Priority 3

- Refine the bottom librarian prompt to use planning-specific copy and CTA intents
- Reduce any residual calendar framing in labels and comments

## Non-Goals

- Do not turn L2 into a full calendar or planner.
- Do not make L2 a miniature L3 reflection surface.
- Do not expand step cards until they compete with L1 detail.
- Do not require exact dates for every nearby step.

## Success Criteria

The nearby level is correct when a user can answer, at a glance:

1. What have I just completed?
2. What is in play right now?
3. What are the next few steps?
4. What pattern should influence my next placement?
5. Where can I insert or rearrange the sequence?

If the surface instead answers “what day is this on?”, it is still too calendar-shaped.
