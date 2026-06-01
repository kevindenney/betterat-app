# iOS Layout Sweep

Report-only audit of spacing/alignment deviations across the app, tab by tab,
on iPhone 17 Pro (iOS 26, UDID 14A34085…). Measured against the design-token
spec, not eyeballed. **No fixes applied** — this is a findings ledger to decide
what is shared-cause vs per-screen before any patch.

## Spec used (and a token discrepancy)

The brief referenced `src/design-system/tokens.ts` with `cardPadding` / `cardGap`
tokens. **That file and those token names do not exist.** The authoritative iOS
spec in this repo is `lib/design-tokens-ios.ts`:

- **Screen-edge margin: 16pt** — `IOS_LIST_INSETS.grouped.marginHorizontal = 16`.
- **8pt spacing grid** — `IOS_SPACING = {xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, …}`.
- **Radius** — `IOS_RADIUS = {sm:8, md:12, lg:16, …}`.
- **Card shadow** — `IOS_SHADOWS.card` (offset h2, opacity 0.06, radius 10).
- **Touch target min: 44pt** — `IOS_TOUCH.minHeight`.

(There is a *second*, conflicting scale in `lib/design-tokens.ts` — `md:16, lg:24`
— used by older non-register surfaces. The Practice tab is built on the
`-ios` register tokens, so this report measures against those.)

Practice-tab components mostly hardcode their own numbers rather than importing
`IOS_SPACING`, so the grid is honored only by coincidence. Many values are
**off the 8pt grid**: 14, 10, 6, 9, 12, 18, 22 recur throughout. This is
pervasive and not individually flagged below unless it produces a visible
misalignment — but it's the single biggest reason "measure, don't eyeball"
matters here: there is no enforced grid.

---

## Practice tab

Route: `app/(tabs)/races.tsx` → `TimelineZoomPracticeScreen`
(`components/ios-register/timeline-zoom/`). One zoomable canvas with four levels
(L1 STEP / L2 NEAR / L3 ARC / L4 ALL), a shared top chrome row, and a floating
vertical zoom rail on the right edge. Step detail is embedded at L1.

### Screens visited
- L2 NEAR (default landing for this account — <5 steps) — `/tmp/pr_l3.png`
- L4 ALL — `/tmp/pr_arc.png`
- L3 ARC — `/tmp/pr_arc2.png`
- L1 STEP / embedded step detail — `/tmp/pr_l1b.png`, `/tmp/pr_do.png`
- `practice/inbox` — **redirect only** (`<Redirect href="/(tabs)/inbox" />`),
  not a distinct Practice surface; not audited here.

### Findings

**P-1 — Floating zoom rail overlaps content and obstructs controls. (SHARED, high) — ✅ FIXED 2026-06-01**
Fix: reserve the rail's lane app-wide. `TimelineZoomCanvas` `styles.canvas` now
carries `paddingRight: ZOOM_RAIL_RESERVED_WIDTH`, so every level's content is
inset out of the gutter (chosen over rail-avoids-zones — more robust, no
per-level bookkeeping). Knock-on edits: `L3SeasonView`/`L4YearsView`
`onAnalysisLayout` stopped double-subtracting the width (the container reserves
it now); `L2WeekView` centers on `usableWidth = viewportWidth − reserved` so the
NOW carousel and NOW bar stay centered and clear the rail. Follow-on regression:
the narrowed L1 surface truncated the 4th `PhaseTabs` label ("Discuss"→"D");
`PhaseTabs` row is now a horizontal `ScrollView` so labels degrade gracefully
(identical when they fit). Verified L2/L3/L4 in sim; PhaseTabs verified via
typecheck + structure (L1 drill-in not reachable on the sparse RHKYC dataset).


The `ZoomLevelPicker` is `position:absolute`, `right:10`, vertically centered,
~66pt wide (`ZOOM_RAIL_RESERVED_WIDTH`). Only the *charts* inside L3
(`onAnalysisLayout` subtracts `ZOOM_RAIL_RESERVED_WIDTH`) reserve its lane.
Everything else renders full-width underneath it:
- **L1 step detail**: the rail covers the right edge of the "HOW WILL YOU DO IT?"
  sub-step rows — the round **× remove buttons** on rows ~2–4 sit under the rail.
  This is the most serious instance: it's not cosmetic, it blocks taps on a
  functional control. (`/tmp/pr_l1b.png`)
- **L3 ARC**: the "BROWSE WEEKS" toolbar's third button (**Select**) is clipped
  behind the rail. (`/tmp/pr_arc2.png`)
- **L4 ALL**: the "BROWSE ARCS" header buttons (**+ New arc**, **Select**) are
  clipped behind the rail. (`/tmp/pr_arc.png`)
- Root cause: `L3SeasonView` `styles.toolbar`/`styles.browseEyebrow`,
  `L4YearsView` header row, and the embedded `StepDetailContent` body all use a
  flat 16pt horizontal inset and do not account for the rail's reserved lane.
  Candidates for the fix: apply `paddingRight: ZOOM_RAIL_RESERVED_WIDTH` to
  interactive rows, or make the rail collapse/auto-hide on scroll, or move it
  out of the content's right gutter.

**P-2 — Top chrome edge (14pt) ≠ content edge (16pt). (SHARED, low) — ✅ FIXED 2026-06-01**
Fix: `AppChromeRow` `styles.row.paddingHorizontal` 14 → 16. Shared component, so
this pre-aligns every tab's top row to the 16pt content margin. Verified in sim.


`AppChromeRow` (`components/ui/AppChromeRow.tsx`) uses `paddingHorizontal: 14`.
All canvas content (L2/L3/L4 lists, eyebrows, cards) uses 16pt. So the
"Sail Racing ▾" interest pill and the +/bell/avatar cluster sit 2pt outboard of
everything below them. Visible as a slight left-edge step between the header and
the first section. One shared component, one value — cheap to align to 16.

**P-3 — Lone step in a week renders at half-width. (per-screen, medium)**
L3 `cardPair` lays steps two-up (`flexDirection:'row'`, gap 10). When a week has
a single step, `week.steps.length === 1 ? <View style={{flex:1}} />` pads the
row with an empty half — so the only card ("Tune the rig before Saturday's race")
occupies the **left half** with a large empty right gutter. Reads as an orphaned
/ misaligned card rather than a deliberate single-item row. (`/tmp/pr_arc2.png`)
Same pattern would affect any week with an odd final card. Decision needed:
full-width for solo cards, or center, or leave two-up.

**P-4 — L2 "NOW" status bar hugs the left edge tighter than 16pt. (per-screen, low)**
The done/in-play/queued count pills row (`L2WeekView`) and its white rounded
container start ~8pt from the screen edge, inboard of the 16pt content margin
used by the cards below it. Minor, but it breaks the left-edge line with the
card column. (`/tmp/pr_l3.png`)

**P-5 — "NOW" corner tag bleeds over the step-detail card's rounded corner. (per-screen, low)**
At L1 the red "NOW" tag is pinned to the top-left and overlaps the card's
top-left radius rather than sitting inside the padding box. Cosmetic.
(`/tmp/pr_l1b.png`)

**P-6 — Off-grid spacing is pervasive. (SHARED, informational) — FILED as standalone work item**
The timeline components hardcode 10.5 / 13.5 / 11 / 9 / 7 / 6 px font sizes and
6 / 7 / 9 / 10 / 14 / 18 / 22 px paddings rather than pulling from `IOS_SPACING`.
Not mid-sweep work. Filed together with the two-conflicting-spec-files problem
(`lib/design-tokens-ios.ts` md:12 vs the older `lib/design-tokens.ts` md:16) as a
standalone spacing-layer consolidation: pick `-ios` canonical, migrate/delete the
old scale, normalize off-grid values to the 8pt grid. (memory:
`project_spacing_token_consolidation.md`)

### Suspected shared-cause list (running)
- **Floating `ZoomLevelPicker` over un-inset content** → P-1 (L1 X-buttons,
  L3 + L4 toolbars). The one fix with the highest leverage on this tab.
- **`AppChromeRow` 14pt vs content 16pt** → P-2 (and likely every other tab that
  uses `AppChromeRow`, since the same component is the shared top row app-wide —
  verify when those tabs are swept).
- **No shared spacing primitive** (components hardcode values instead of
  `IOS_SPACING`) → P-4, P-6, and the general off-grid drift.

---

> **STOP — Practice reviewed. Shared fixes applied; per-screen deferred.**
>
> Settled before moving on:
> - **P-1, P-2 (SHARED)** — fixed + verified. The two shared root causes (rail
>   over un-inset content; AppChromeRow 14≠16) are resolved app-wide, so every
>   later tab inherits the chrome-edge fix.
> - **P-3, P-4, P-5 (per-screen)** — deferred to a later per-screen polish pass.
>   Each is a single-surface cosmetic call (solo-card width, L2 NOW-bar inset, L1
>   NOW-tag corner bleed); none is shared, none blocks a control.
> - **P-6 + conflicting spec files (SHARED, structural)** — filed as its own
>   spacing-token consolidation work item; not mid-sweep work.
>
> Next tab not started.
