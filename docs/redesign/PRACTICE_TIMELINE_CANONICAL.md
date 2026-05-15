# Practice Timeline Canonical Design

**Status:** Source of truth as of 2026-05-15
**Scope:** The Practice tab (bottom tab #1) and how the three phases of each step compose. Also names the surrounding bottom tab bar and confirms Profile's role.
**Supersedes:** Race Prep iOS register Pass A, On the Water iOS register Pass B, prior Race tab implementations including post-flag-flip inline-tabs pattern.

---

## What this design is for

BetterAt is a deliberate-practice product. The user moves through a sequence of steps — each step is one practice cycle: plan it, do it, reflect on it. Over time, the cycles accumulate evidence of what the user has become capable of.

This document specifies:

1. The **Practice tab** — the timeline of steps and how a single step renders
2. The **bottom tab bar** — what the four top-level surfaces are and what each is for
3. The **Profile tab** — the capability-credential surface that the practice loop produces
4. The **capability data model** — how steps tag evidence to capabilities

The Practice tab is the most important screen in the product. The Profile tab is why the Practice tab matters.

---

## Bottom tab bar

Four tabs, persistent across the app:

| Tab | Role | What it shows |
|---|---|---|
| **Practice** (label varies by interest) | The engine | Timeline of steps; current step centered; horizontal swipe through past, present, and upcoming |
| **Playbook** | The library | Plans/blueprints the user has saved, can follow, or can publish |
| **Discover** | The intake | Find new content, generate plans from inspiration, explore others' blueprints |
| **Profile** | The credential | Capability map per interest; evidence-backed; shareable |

The first tab — the Practice engine — renders a label appropriate to each interest's community vocabulary: "Race" for sailing, "Practice" for nursing and most other interests, with per-interest vocabulary overrides supported via `lib/navigation-config.ts` (`getEventTabTitle`). Sailors see "Race" because that's the term sailors use; nurses see "Practice" or "Shift" depending on their interest's vocabulary configuration. The tab's identity is constant — it is the Practice engine — but its visible label adapts to the user's community language. The other three tabs (Playbook, Discover, Profile) are universal labels and do not vary by interest.

The avatar in the top-right corner of relevant screens opens **account**, **settings**, **theme**, **sign out**, **help**. It does *not* contain Profile. Profile is its own destination.

---

## Practice tab — the timeline

### Anatomy

```
┌─────────────────────────────────────┐
│  ← Sail Racing · Step 6 of 11    ⚙  │  ← header: interest, position, avatar
│                                      │
│  ╱│                              │╲  │
│ ╱ │                              │ ╲ │  ← peek left, current card, peek right
│   │   ┌──────────────────────┐   │   │
│   │   │ Step Title           │   │   │  ← centered card, ~75-80% width
│   │   ├──────────────────────┤   │   │
│   │   │ [Plan] [Do] [Reflect]│   │   │  ← phase tabs
│   │   ├──────────────────────┤   │   │
│   │   │                      │   │   │
│   │   │  active phase        │   │   │
│   │   │  content fills the   │   │   │
│   │   │  card                │   │   │
│   │   │                      │   │   │
│   │   └──────────────────────┘   │   │
│ ╲ │                              │ ╱ │
│  ╲│                              │╱  │
│                                      │
├─────────────────────────────────────┤
│   ⚐         📖         🧭      👤    │  ← Practice engine / Playbook / Discover / Profile
│   Race    Playbook  Discover  Profile│  ← sailor sees "Race"; nursing sees "Practice"
└─────────────────────────────────────┘
```

### Layout

- **Header strip** (top, ~44pt height): interest name on the left ("Sail Racing"), step counter in the middle or trailing ("Step 6 of 11"), avatar/menu trigger on the right
- **Timeline area** (fills the rest of the screen above the tab bar):
  - **Current step card**: centered horizontally, takes ~75-80% of the screen width
  - **Left peek**: thin sliver of the previous step's card (~8-12% width), enough to signal existence
  - **Right peek**: thin sliver of the next step's card (~8-12% width), same
  - **Peeks are visual only** — they show the edge of an adjacent card but do not show its content. Just enough silhouette to imply "more there."
- **Bottom tab bar**: persistent four tabs

### Behavior

- **Default state on tab open**: timeline opens centered on the **current step**. There is always a current step — either the one the user is actively working on, or the next one ahead if everything prior is complete.
- **Horizontal swipe** inside the timeline area: pages between adjacent steps. The peek expands to become the new center; the old center becomes a peek on the other side.
- **Tap a peek**: same as swipe — jumps to that step, makes it the new center.
- **No vertical scroll** at the timeline level. Vertical scroll, if needed, is *inside* the active phase's content.
- **Inside the card**: tap a phase tab to switch phase. No swipe-inside-card; gesture is reserved for inter-step navigation.

### Why this shape

- The centered-card-with-peeks pattern is iOS-native (App Store Today cards, Photos memories, Wallet passes). It reads as "spatial sequence; one focal item; more available."
- Two distinct gestures map to two distinct scopes: **swipe = next step**, **tap = switch phase**. No gesture conflict.
- The card-on-timeline framing keeps each step legible as one unit of practice. The peek is the connective tissue showing it's part of a longer arc.

---

## Phase tabs (inside each step card)

Three tabs, in order: **Plan**, **Do**, **Reflect**.

### Phase semantics

| Phase | What happens here | Output |
|---|---|---|
| **Plan** | The user builds the plan for this step before doing the activity. What's the goal, what's the approach, what capabilities is this step developing. | The plan content: goals, tactics, materials, intent. |
| **Do** | The user follows the plan and records what actually happened. Notes captured during or immediately after the activity. Could be race observations, shift events, study notes, gym logs, build progress. | The record: what the user did, made, or observed. |
| **Reflect** | The user reflects on how the step went. What worked, what didn't, what to do differently, what was learned, what capability evidence was produced. | The debrief: learning extracted, evidence tagged to capabilities. |

### Critical: this is a workflow, not three independent views

The three phases happen in order over time, but the tabs are **always all three present and tappable**, even if a phase has no content yet. The user can:

- Be mid-plan and tap forward to Reflect to read prompts (without filling them)
- Be mid-Do and tap back to Plan to re-read the plan
- Skip ahead and write a debrief before doing anything (low-fidelity case, but allowed)

No gating, no progressive disclosure. All three are always available; the *content* of each reflects what the user has produced so far.

### Default active tab

**Sticky per-step**. When a user lands on a step, the active tab is whichever phase they were last on for *that specific step*. First visit to a step defaults to **Plan**.

This handles the natural use case: a user mid-Do leaves the app, comes back, lands on Do for the right step. A user who finished a race and started a debrief lands on Reflect when they reopen that step.

### Empty states

Each phase has a meaningful empty state:

- **Plan empty**: "What's the plan for this step?" with a primary action to start planning
- **Do empty**: "Ready to start? Capture what you do or observe." Primary action to begin logging
- **Reflect empty**: "How did it go? Notes appear here after you've done some of the work." Soft state; can still be opened and filled

Empty states never block tab switching. The user can always see all three tabs.

### Why three tabs and not stacked sections or progressive disclosure

- **Stacked sections** force two scroll axes (page-scroll and inside-card-scroll); already complex on a horizontally-swiping timeline.
- **Progressive disclosure** creates state ambiguity ("when does Phase 2 unlock?"). Tabs are stateless.
- **Tabs match iOS conventions** for "same object, different facet" (Notes folder tabs, Music tab navigation).

---

## Naming rationale

### Phase tabs: Plan / Do / Reflect

- **Plan / Do / Reflect** is the canonical deliberate-practice loop, recognizable from PDSA (Plan-Do-Study-Act) in nursing, Deming cycle in operations, OODA in tactics, and countless coaching methodologies.
- **"Do"** generalizes across performance activities (race, shift, procedure), production activities (write, build, create), and study activities (read, drill, rehearse).
- No collision with bottom tab bar after Profile rename.

### Bottom tab: Profile (not Reflect)

- The bottom Reflect tab was originally named for inward reflection. But its actual job is **outward credential** — a capability map shareable with evaluators (JHU hiring committees, sailing program directors) or kept as personal record.
- **Profile** signals "outward-facing artifact," consistent with how shared identity surfaces work in iOS and on the web.
- "Profile" reads naturally as a destination ("tap Profile to see my record") and as a shareable artifact ("here's my profile").

### Bottom tab: Practice engine (label varies by interest)

- The bottom first tab is the *engine* — where the user actually does the work. Its identity is "the Practice engine", but its visible label adapts to each interest's community vocabulary: sailors see "Race", nurses see "Practice" or "Shift", etc. See `lib/navigation-config.ts` (`getEventTabTitle`) for the resolution logic.
- The collision with the phase tab name was solved by renaming the phase ("Do" instead of "Practice"). Phase verbs, tab nouns.
- Interest-specific labels are deliberate, not legacy drift. Each community's verb (race, practice, shift, session) is what its members already use; the tab reads in their language.

---

## Capability data model

The Profile tab requires a capability taxonomy. This section sketches the data model without specifying implementation.

### Concepts

- **Interest**: a domain the user is practicing in (Sail Racing, Nursing, Coffee, etc.)
- **Capability**: a discrete skill or competency within an interest (e.g. for Sail Racing: starts, upwind speed, downwind tactics, crew work, rules knowledge, weather reading)
- **Step**: one practice cycle on the timeline; produces evidence
- **Evidence**: a piece of content from the step (Plan/Do/Reflect content) that demonstrates progress on one or more capabilities
- **Profile**: the aggregated view of capabilities for an interest, populated by evidence

### The flow

1. Each interest has a **capability taxonomy** — a defined list of capabilities relevant to that interest. (For sailing, this might come from coaching frameworks; for nursing, from clinical competency standards like AACN or JHU's own evaluation criteria.)
2. During the **Plan** phase, the user (or the system, or a coach) tags the step with one or more capabilities it intends to develop.
3. During the **Do** phase, the captured record (notes, photos, logs) accumulates against those capabilities.
4. During the **Reflect** phase, the user explicitly identifies evidence — "this race showed I can read shifty wind" or "this shift demonstrated independent code response."
5. The **Profile** tab aggregates evidence across all steps, organized by capability. Each capability shows: progress indicator, top evidence (linked back to source steps), peer ratings if applicable, certifications if applicable.

### Profile surface (sketch only)

```
┌─────────────────────────────────────┐
│  Kevin Denney                    ⚙  │
│  Sail Racing · Nursing · 2 more     │
├─────────────────────────────────────┤
│  SAIL RACING                         │
│                                      │
│  Starts                       ●●●○○ │
│   Evidence from 8 races              │
│                                      │
│  Upwind speed                 ●●●●○ │
│   Evidence from 14 races             │
│                                      │
│  Downwind tactics             ●●○○○ │
│   Evidence from 5 races              │
│                                      │
│  Rules knowledge              ●●●●● │
│   Certified RHKYC · 12 references    │
│                                      │
│  [ + show 6 more capabilities ]      │
│                                      │
├─────────────────────────────────────┤
│  Share profile · Edit visibility     │
└─────────────────────────────────────┘
```

Capabilities can be tapped to drill into the source evidence (which steps, which Plan/Do/Reflect content). Some are progress-bar-shaped (developing skills), some are credential-shaped (certifications, ratings).

### Shareability

- A user can generate a **public link** to their Profile or to a specific interest's Profile within it.
- The public view is read-only and excludes private notes; it shows capabilities, evidence summaries, certifications.
- A nurse applying to JHU can share `betterat.app/u/jane/nursing`. The recruiter sees capability evidence directly.

### What's out of scope for this design pass

- Specific capability taxonomies for each interest (separate work; sailing and nursing each need their own)
- Peer rating mechanism (separate work)
- Public link versioning and privacy controls (separate work)
- How evidence tagging surfaces in the Plan and Reflect UI (separate work; affects this canonical only at the level of "tagging is possible")

---

## What this design replaces

- **Race Prep iOS register Pass A** (canonical superseded): the full-screen Race Prep design with internal three-phase tabs but no timeline-with-peek. Was shipped at commit `01c6af34` with flag default on; flipped off via `EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=false` on 2026-05-15.
- **On the Water iOS register Pass B** (canonical superseded): the full-screen race detail with iOS register treatment, no timeline-with-peek, "On the Water" naming that didn't generalize.
- **Pre-cutover inline-tabs pattern** (current state after flag flip): inline three-tabs-per-card without the timeline-with-peek shell. Better than the cutover but still missing the timeline context.

The canonical above is what the Practice tab *should* be. Building it requires:

1. The horizontal timeline shell with peek (not currently built)
2. The card-on-timeline component (partially exists)
3. The three-phase tab pattern inside the card (exists post flag-flip)
4. Renaming "Reflect" bottom tab → "Profile" (small change, naming + asset)
5. The Profile screen and capability data model (significant new work)

---

## Implementation phasing (suggested, not prescriptive)

This is a large redesign. Suggested phasing for cutover work:

**Phase A: Naming and tab bar rename** (small, mechanical)
- Rename bottom Reflect tab to Profile
- Update tab bar icon and label
- Profile screen can be a stub for now (renders existing Reflect content)

**Phase B: Phase tab rename inside cards** (small)
- Rename "On the Water" phase tab to "Do" (or whatever phase tab is currently called per interest)
- Confirm Plan / Do / Reflect labels consistently across interests
- No data model changes yet

**Phase C: Timeline-with-peek shell** (large)
- Build the horizontal-timeline-with-peek container
- Place existing card content inside it
- Implement swipe-between-steps and tap-on-peek
- Implement sticky-per-step active tab memory

**Phase D: Capability data model** (very large; product + engineering work)
- Define capability taxonomies for sailing and nursing
- Add capability tagging to Plan and Reflect surfaces
- Build the Profile capability-map view
- Add shareability (public link)

Phases A and B could ship within days. Phase C is a significant build. Phase D is a multi-week product initiative.

---

## Open questions deferred from this design

1. **Should the "current step" indicator change based on whether the user is in-the-middle-of-Do?** (E.g. visual treatment differs between "this is the next step I haven't started" vs. "I'm currently practicing this.")
2. **What does the timeline show when the user has 50+ completed steps?** Peeks of all past steps would be many. Compaction strategy needed.
3. **How does a user move a step's position in the timeline?** Edit ordering, re-plan, skip.
4. **Multi-interest concurrency**: if a user practices both sailing and nursing, does the Practice tab show both interleaved or one-at-a-time with a switcher?
5. **What happens to in-progress phases when the user moves to a new step?** Saved as draft? Required to complete?

These are real questions that need answers before full Phase C/D implementation. They don't need answers to ship Phase A or B.

---

## Status of this document

This is the source-of-truth canonical for the Practice tab and supporting tab structure. It supersedes prior design passes. Implementation should reference this document and flag deltas as they arise.

When implementation reveals tensions in this canonical, this document is updated, not silently deviated from.
