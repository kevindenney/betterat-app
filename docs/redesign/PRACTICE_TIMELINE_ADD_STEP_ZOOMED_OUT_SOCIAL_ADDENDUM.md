# Practice Timeline — Add Step, Zoomed-Out View, and Social Layer Addendum

**Status:** Source of truth for the Practice tab's secondary surfaces as of 2026-05-15
**Scope:** Three surfaces not covered in the prior canonical: how new steps are created, the zoomed-out timeline view, and the social layer showing others' timelines
**Relates to:** PRACTICE_TIMELINE_CANONICAL.md (primary canonical), PRACTICE_TIMELINE_CANONICAL_PLAN_TAB_ADDENDUM.md (Plan tab interior)

The primary canonical defined the zoomed-in view (one step centered with peeks). This addendum specifies three additional surfaces that complete the Practice tab's design: step creation, full-timeline overview, and the social layer.

---

## Surface 1: Add Step

### Affordance

A **floating action button (FAB)** at the bottom-right of the Practice tab, positioned above the bottom tab bar.

- Position: 16pt from the right edge, 16pt above the tab bar
- Size: 56pt diameter circle
- Color: iOS blue (#007AFF) background, white **+** glyph
- Persistent: stays visible during horizontal swipe between steps; stays visible during phase tab switching inside a card
- Optional auto-hide during active text editing inside a step (to avoid covering keyboard or text content)

The FAB is the primary, persistent step-creation affordance. It is always one tap away from anywhere in the Practice tab.

### Why FAB and not toolbar

Adding a step is one of the most frequent actions in BetterAt. The most-frequent action belongs in the most thumb-reachable position. The top toolbar is the worst position for one-handed mobile use; the FAB pattern is now well-established in iOS (Apple Notes, Mail, Reminders) and provides thumb reachability + impossible-to-miss discoverability.

### Tap behavior

Tapping the FAB opens a small menu sheet with two options:

1. **Build with AI Coach** (primary emphasis, sparkle icon)
2. **From a Blueprint** (secondary, book icon)

Tapping option 1 opens the AI Coach interface immediately — same coach as the Plan tab's primary path. The coach asks what kind of step the user wants to add, what interest it belongs to, what they're trying to develop. As the conversation progresses, the new step takes shape.

Tapping option 2 opens a Blueprint picker — the user's subscribed blueprints, with each blueprint expandable to show its component steps. The user picks a blueprint step; that becomes the new step's starting template, with Plan tab pre-filled from the blueprint's plan content.

A small **Cancel** option dismisses the menu.

### Position in timeline

A newly created step appears at the **next chronological position after the current step** — immediately to the right of the NOW line. The timeline auto-scrolls (with a short delay for visual continuity) to bring the new step into the centered position.

The user can drag-reorder later if they want it elsewhere. The default of "right of NOW" matches the natural mental model: "the next thing I'm going to do."

### Reconciliation with the existing "magic button"

The current Practice tab toolbar shows a sparkle/magic button. Its purpose is unclear from visual inspection alone. Before shipping the + FAB, an investigation task should determine:

- What does the magic button currently do?
- If it's an AI Coach entry point: it's now redundant with the FAB's AI Coach option. Remove it.
- If it does something else (timeline summary, AI insights, weekly review): keep it but rename for clarity.

This is captured as an open question, not a blocker. The FAB ships regardless; the magic button reconciliation can happen in a separate small commit.

---

## Surface 2: Zoomed-Out Timeline View

### Entry and exit

- **Enter:** pinch-out gesture on the timeline area in zoomed-in view (iOS-native pinch-zoom interaction)
- **Exit:** pinch-in gesture returns to zoomed-in view, centered on whichever step was most visible during the zoomed-out scroll position

The pinch gesture is the only entry/exit. No buttons, no menu items — it's a spatial-zoom relationship and a spatial-zoom gesture.

### Layout

A **vertical list** with the user's current step centered visually, a horizontal NOW line below it, upcoming steps above (chronologically — soonest at the bottom of the upcoming section, furthest in the future at the top), and past steps below (most recent first, oldest at the bottom).

```
[Furthest future step]
...
[Step in 3 days]
[Step tomorrow]
━━━━━━━━━━━━━━ NOW (Fri, May 15) ━━━━━━
[Current step]                                ← visually anchored
[Earlier today]
[Yesterday]
━━ THIS WEEK ━━
[Mon's step]
[Tue's step]
━━ LAST WEEK ━━
[Week-of steps]
━━ OCTOBER 2025 ━━
[Month's steps]
━━ Q3 2025 ━━
[Compressed older]
```

**Time-period grouping headers** use sticky positioning: as the user scrolls, the current section header sticks to the top of the viewport until the next section's header pushes it up. iOS-native sticky-header pattern from Contacts, Settings, etc.

**Why vertical, not horizontal:** at scale (hundreds or thousands of steps), horizontal scrolling becomes uncomfortable on mobile. Vertical scrolling is the iOS-native pattern for "long list of things organized by time." Pairs well with search, section-jumping, and per-row detail.

### Per-step row treatment

Each step renders as a row about 80-100pt tall:

```
┌────────────────────────────────────────┐
│ Light-air starts in shifty breeze      │
│ Sail Racing · Sat Oct 12               │
│ ● Plan started  ◐ Do in progress  ○ Reflect │
└────────────────────────────────────────┘
```

- **Title** — top, primary weight
- **Interest + date** — secondary line, smaller, system gray
- **Phase status indicators** — three small circle indicators showing per-phase progress:
  - **Filled** (●) — phase complete
  - **Half-filled** (◐) — phase in progress
  - **Empty** (○) — phase not started
- **Color** — neutral; the current step row may have a subtle accent (iOS blue border or slight background tint) to distinguish it

The phase status indicators are the key information density choice: they let the user see at a glance which steps are done, in progress, or untouched without opening anything.

### Interactions

- **Tap** a step row: returns to zoomed-in view, centered on that step
- **Long-press** a step row: opens contextual menu with options:
  - Edit details
  - Move step (to a different position)
  - Duplicate step
  - Delete step
  - Set due date
  - Add to blueprint
  - Share step
  - Visibility settings
- **Drag-and-drop**: drag any step row up or down to reorder. Other rows shift to accommodate. Release to commit the new order.
- **Swipe-left on a step row**: quick actions (Delete in red, Edit in iOS blue) — iOS-standard list swipe

### Reorder semantics

When a user drags a step to a new position, the step's *scheduled date* shifts to match the destination position. For example, dragging today's step to "yesterday's" position re-dates it to yesterday. The user can accept this implicit date shift, or — for steps with externally fixed dates (race day, scheduled shift) — undo the drag.

For steps that have already been Done (Do phase entered), reordering shows a confirmation: "This step has activity logged on [date]. Moving it will not change the activity timestamps. Continue?"

### Header strip in zoomed-out view

When zoomed-out, the top header strip changes:

- Interest selector chip (Sail Racing ▼) — same as zoomed-in
- Step count and date range (e.g. "147 steps · Sep 2024 – present")
- Search icon (tap to open search across all steps' content)
- Avatar (same as zoomed-in)

### Add Step from zoomed-out view

The FAB is also visible in zoomed-out view, same position. Tapping it works identically — opens the AI Coach / Blueprint menu. The new step appears in the position chronologically (next after NOW), with the list auto-scrolling to bring it into view.

---

## Surface 3: Social Timeline Layer

### Default state

In zoomed-out view, after the user's own timeline ends (scrolling past the oldest user steps), a **Following section** appears.

```
[User's last step, oldest]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLOWING                    [ Hide ▾ ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ Following sections below ]
```

The Following section is always visible by default. Discovery is passive — new users scroll down and see "there's a whole social layer here."

A persistent **"Hide ▾" toggle** at the top of the Following section collapses the entire social layer. State persists across sessions: hidden stays hidden until re-enabled. Users who want a quieter experience tap once and forget.

### Three sub-sections within Following

#### 3a. People you follow

```
╭──────────────────────────────────────╮
│ 👤 Bill Gladstone · Sail Racing       │
│ Last active: 2 days ago               │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
│ │  │ │  │ │  │ │  │ │  │  → view all  │
│ └──┘ └──┘ └──┘ └──┘ └──┘              │
╰──────────────────────────────────────╯
```

Each followed person gets a card:
- Avatar + name + interest context
- Last-active timestamp
- Horizontal mini-timeline of their 5-10 most recent visible steps (privacy-filtered)
- "view all" link → opens their full timeline as a read-only zoomed-out view

#### 3b. Blueprints you follow

```
╭──────────────────────────────────────╮
│ 📘 Bram's Dragon Worlds Prep Blueprint│
│ 28 subscribers · You're on Step 6/14  │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
│ │  │ │  │ │  │ │  │ │  │  → view all  │
│ └──┘ └──┘ └──┘ └──┘ └──┘              │
╰──────────────────────────────────────╯
```

Each followed blueprint gets a card:
- Blueprint icon + title
- Subscriber count + your progress against the blueprint's step list
- Horizontal mini-timeline of the blueprint's component steps (with your completion state overlaid)
- "view all" link → opens the full blueprint view

#### 3c. Peers on the same blueprint as you

```
╭──────────────────────────────────────╮
│ 👥 Others on Bram's Blueprint (12)    │
│ Tomás · Jamie · Bence · +9 more       │
│   Tomás is on Step 9                  │
│   Jamie is on Step 5                  │
│   Bence is on Step 11 (ahead!)        │
│   → view all 12                       │
╰──────────────────────────────────────╯
```

For each blueprint the user is subscribed to, an aggregate card showing other subscribers:
- Avatars/initials of peers (first 3-4 visible, +N more)
- Each peer's current step in the blueprint
- "view all" link → full list of subscribers with their progress

This is the "look over their shoulder" surface — see how other people executing the same plan are progressing.

### Per-entity visual treatment

All Following entries are visually distinct from the user's own timeline:
- Smaller cards (60-70pt tall vs. user's 80-100pt)
- Slightly muted color (system gray vs. white background)
- Clearly labeled with name/title and entity-type icon (person / blueprint / peer-group)

This visual hierarchy keeps the user's own work primary; others' work is reference, supportive, secondary.

### Tap behavior on someone else's step

Tap any step in a followed entity's mini-timeline opens a **read-only step detail view**:

- Step title, status, dates
- Their Plan tab content (what they planned to do, why) — read-only, privacy-filtered
- Their Do tab content (what they actually did) — read-only, privacy-filtered
- Their Reflect tab content (their debrief) — read-only, privacy-filtered
- The blueprint this step is part of, if any — link to the blueprint
- A prominent **"Add this to my timeline"** button — creates a step in *your* timeline based on theirs, pre-filling Plan tab with their plan content (subject to copy permission)

Privacy rules:
- The step owner controls visibility per phase (Plan / Do / Reflect each have a visibility toggle)
- Visibility levels: **public** (anyone), **followers** (mutual or one-way followers), **private** (only the owner)
- Capability evidence is always visible to the owner; surfaces to others only when public or follower-visible
- A redacted phase shows: "[Plan visible to followers only]" with the user's avatar — no content leak

### Empty state

If the user follows zero people and zero blueprints, the Following section shows a discovery affordance:

```
╭──────────────────────────────────────╮
│ Find people and plans to follow       │
│                                       │
│ Discover sailors and nurses           │
│ practicing what you practice          │
│                                       │
│   → Open Discover                     │
╰──────────────────────────────────────╯
```

Tapping links to the Discover tab.

### Scrolling and performance

Each followed entity loads lazily as the user scrolls into the Following section. The mini-timelines fetch only the 5-10 most-recent visible steps on demand. Full timelines are fetched only when "view all" is tapped.

For users following many people (50+), the Following section paginates: first 10 followed people, then "Load more" affordance.

---

## Open questions deferred

1. **Magic button reconciliation.** Investigation task: what does the current toolbar sparkle button do? Decide whether to remove or rename based on current function.
2. **Drag-reorder semantics for past steps.** Confirm: should past steps be reorderable at all? Or are past steps immutable (the activity already happened)?
3. **Privacy default for new users.** When a new user creates their first step, what's the default visibility? Followers, private, or public?
4. **Follower request and approval flow.** Out of scope for this addendum: how does a user request to follow someone? Auto-approved or opt-in? Mutual or asymmetric?
5. **Notification model.** When someone you follow logs a step, do you get notified? Configurable per-entity? Out of scope here.
6. **Blueprint authorship.** When someone subscribes to your blueprint, do you see them as a "subscriber" in your Profile? Privacy implications.
7. **Step copy permissions.** When the user taps "Add this to my timeline" on someone else's step, what gets copied? Plan content always? Or only if the original author marked it copyable?
8. **Discover tab connection.** This addendum mentions Discover as the destination for follow/subscribe discovery, but Discover's design is separate and deferred.
9. **Zoomed-out view performance at scale.** What happens with 5,000+ steps? Virtualized list rendering required.
10. **Search in zoomed-out view.** Mentioned in passing; full search UX is deferred.

---

## What this addendum supersedes

- Any prior toolbar-based "+ add step" affordance design
- The implicit assumption that the Practice tab is "just the zoomed-in single-step view"
- The implicit assumption that the Practice tab is solo-user-only

The Practice tab is now: a zoomed-in single-step focus view AND a zoomed-out vertical timeline list AND a social layer showing followed people and blueprints. Three modes, one tab. The pinch gesture is the primary navigation between zoomed-in and zoomed-out.

---

## Implementation phasing

Adding to the implementation phases from the primary canonical:

**Phase B.6: Add Step FAB** (small)
- FAB component
- Two-option menu sheet
- AI Coach entry from the FAB
- Blueprint picker from the FAB
- Auto-scroll to new step position

**Phase C.5: Zoomed-Out View** (medium, after Phase C ships)
- Pinch gesture handler
- Vertical list with sticky time-period headers
- Per-step row component with phase status indicators
- Drag-and-drop reorder
- Long-press contextual menu
- Header strip variant for zoomed-out

**Phase E: Social Timeline Layer** (large, new phase)
- Following entity types (People / Blueprints / Peers-on-Blueprint)
- Privacy model and per-step visibility settings
- Read-only step detail view for others' steps
- "Add this to my timeline" copy mechanism
- Discover-tab integration for follow/subscribe flows
- Notification model (deferred sub-spec)
- Performance: lazy loading, pagination

Phase D (capability model + Profile surface) and Phase E (social layer) are both large. Sequencing is a product call — Phase D produces the *deliverable* (Profile credential); Phase E produces the *engagement* (social practice). Both matter; the order they ship in affects user behavior dynamics.

---

## Status of this addendum

This is the source-of-truth for the Practice tab's secondary surfaces. Implementation specs for Phases B.6, C.5, and E should reference this addendum.

When implementation reveals tensions, this document is updated, not silently deviated from.
