# Phase 11 — Library tab follow-ups roadmap

**Date written:** 2026-05-21
**Branch:** main (Phase 11 redesign work merged through `d7b8d536`)

This doc captures everything that's still owed after the Phase 11 Library tab
redesign shipped. Use it to pick up where the overnight handoff left off.

## What's already done

The Phase 11 Library work that's already on `main`:

- **Library zone redesign** (commit `888399db` and predecessors) — full-width
  hero band, four-tab segmented control (All / Plans / Concepts / Resources),
  iOS-register palette, outer-View padding pattern for card chrome on Android.
- **CaptureSheet "Add to your Library"** — Link / Upload / Photo / Paste tabs,
  drag-drop zone, detected-tags chips, Source/Year fields, ATTACH TO (Standalone
  / Concept / Step), COLLECTION picker. Fully implemented in
  `components/library/resources/CaptureSheet.tsx`.
- **Resource detail screen** — `components/library/resources/ResourceItemDetail.tsx`
  at route `/library/items/[id]`. Topbar, format chip, preview spine, Read /
  Listen / Annotate, back-refs section, marked excerpts, cite-as-origin row.
- **Demo fallback for resource detail** (commit `4a553304`) —
  `components/library/resources/demoItems.ts` short-circuits the eight Wave 2e
  card ids (aacn-sepsis, jhh-code-blue, bates-cardio, …) before hitting
  Supabase. AACN sepsis is rich (3 back-refs, 2 excerpts), others are lighter.
- **Resource detail interactivity** (commit `d7b8d536`) — every tappable
  element triggers either navigation (back) or a "coming soon" alert; scroll
  content clears the floating tab bar via `FLOATING_TAB_BAR_HEIGHT + insets.bottom`.
- **BeforeTheShiftCard wiring across all step interiors** — `PlanTab`,
  `StepPlanQuestions`, both `PlanTabInterior` and `PlanTabIOSRegisterInterior`
  all already pass `libraryBefore` from `useLibraryBeforeBinding`. **No code
  change needed.** Card renders the moment a step has `step_library_before`
  rows. Currently every user has zero rows, hence the card has never appeared
  in production.
- **"Add from library" footer stub** (uncommitted in this session) —
  `useLibraryBeforeBinding` now returns an `onAddFromLibrary` that fires a
  coming-soon alert, so the footer feels alive while we build the picker.

## What's still owed

### 1. Step library-before data path (HIGH PRIORITY)

The whole reason `BeforeTheShiftCard` doesn't appear on real steps:
`step_library_before` is empty for every user. Three ways to populate it,
listed by ascending build cost:

**1a. Seed during onboarding / demo creation.** When the demo flow creates a
step, attach 2-3 relevant library items pulled from the user's library. This
is a SQL/server-side change in the demo seeding scripts.

**1b. "Add from library" picker on the step.** Wire the
`BeforeTheShiftCard`'s `+ Add from library` footer (currently stubbed to
coming-soon) to open a sheet that lists the user's `library_items` and lets
them pick one to attach. The mutation is an insert into `step_library_before`
with `(step_id, library_item_id, position)`. Existing sheet to copy from:
`AddToStepPlanSheet` in StepPlanQuestions.

**1c. Auto-attach when step is created from a concept.** If the user creates
a step from a concept (origin), automatically attach the library items cited
by that concept's `concept_origins` and `concept_citations`. Best UX but
needs the cited-items pipeline to be solid first.

Recommend doing 1b first — gives users agency, doesn't depend on demo data,
unblocks the card showing up for the JHU demo.

### 2. Resource detail action wiring (MEDIUM PRIORITY)

The detail screen has six stubs that pop "coming soon" alerts. Real work owed:

- **Read** — open a PDF/article reader. Web: open in new tab. Native: in-app
  reader (could lean on `expo-web-browser` or a real PDF renderer).
- **Listen** — audio playback. If the item is `format: 'audio'`, play the
  file. If it's a PDF/article, route through a TTS service (Eleven Labs?
  Google TTS?) and stream.
- **Annotate** — inline highlighting on the document. Needs a `library_marks`
  table (referenced in `ResourceItemFull.marks` already — currently always
  `[]` from the live hook; demo data has 2 marks).
- **Share** — system share sheet. RN has `Share.share()`.
- **Ellipsis (More)** — bottom sheet with archive / move-to-collection /
  delete / edit metadata actions.
- **Cite as origin of a new concept** — opens the concept-creation wizard
  pre-populated with a marked phrase from this item as the origin. The
  concept wizard already exists in `components/playbook/`; need to wire the
  marked-phrase → origin handoff.

### 3. Back-ref row navigation (MEDIUM PRIORITY)

`BackRefRowView` rows (Origin / Cited / In step) currently fire the same
coming-soon alert. They should navigate:

- `origin` / `cited` roles → `/library/concept/[slug]` (or the
  `/concept-ios/[slug]` ios variant). Demo back-refs use semantic ids like
  `origin-lactate-perfusion`, so will need the same demo-fallback pattern in
  `useConceptDetail` (mirroring `demoItems.ts`).
- `in_step` role → step route (`/step/[id]` or
  `/practice/step/[id]/index.tsx`). Same demo-id concern.

### 4. Live data for "In play this week" / "Recently added" (MEDIUM PRIORITY)

`ResourcesZone.tsx` currently ships hardcoded MSN Capstone demo cards
(`IN_PLAY`, `RECENT`, `COLLECTIONS`). These should be replaced with live
queries against `library_items` and `library_collections`. The `demoItems.ts`
short-circuit can stay as a fallback for users with empty libraries, but the
primary path should be real data.

- `IN_PLAY` query: items added in the last 7 days OR attached to a step
  currently in `do` phase.
- `RECENT` query: items ordered by `captured_at desc` limit 5-10.
- `COLLECTIONS` query: `library_collections` grouped by tag.

### 5. Full v2 StepShell promotion (LOW PRIORITY — deferred)

The v2 step shell (`components/step/v2/StepShell.tsx` + tab bodies) is
debug-only at `/debug/step-v2`. Production still uses `StepDetailContent` →
`PlanTab` and `RaceSummaryCard` → `StepPlanQuestions`. Because the v1 paths
already render `BeforeTheShiftCard` via `PlanTabInterior` /
`PlanTabIOSRegisterInterior`, there's no urgency. Defer this until:
  - v2 has feature parity with v1 (Do tab, Reflect tab, Discuss tab, all the
    state hooks v1 has)
  - We have a clear UX reason to swap (the v2 shell is leaner / cleaner)

### 6. Hardcoded "PRACTICE ALERT" stamp on preview spine (TINY)

`ResourceItemDetail.tsx` hardcodes the text `PRACTICE ALERT` and `P 1 / 8`
on the preview pane. Should come from `item.formatLabel` and item page count.
Trivial fix:
```tsx
<Text style={styles.previewStamp}>{item.formatLabel.toUpperCase()}</Text>
<Text style={styles.previewPage}>{item.meta || ''}</Text>
```
…or render dynamic page navigation when a reader exists.

### 7. Library Plans → Library tab "Library" rename (DEFERRED)

Saved in memory as `playbook_to_library_rename` — UI-only rename (tab name +
copy), keep `playbook_*` code/DB identifiers. Picked up later.

### 8. Sailing-namespace consolidation (DEFERRED)

Saved in memory as `sailing_namespace_consolidation` — move sail-only
hooks/components/services into explicit `sailing/` subdirs. ~50 files,
~150 imports. Picked up later.

## Risks to track

- **`social_notifications` RLS gap** — flagged in memory
  (`social_notifications_rls_finding`). Authenticated insert policy has
  `WITH CHECK (true)` — any user can inbox-spam any other. Independent of
  library work but tracking here so it doesn't get forgotten.
- **lint-staged blocks bulk codemods** — repo-wide `eslint --fix` campaigns
  need the warning-campaign done first. Affects any large refactor (e.g. v2
  shell swap).
- **Pre-launch landing page placeholder** — intentional; redesign planned
  using India+JHU demo insights.

## Suggested next session order

1. Wire `+ Add from library` picker (Section 1b) — unblocks demo of
   BeforeTheShiftCard on real steps.
2. Back-ref row navigation (Section 3) — gets users out of "every tap is an
   alert" dead-end on resource detail.
3. Live data for Library zones (Section 4) — replaces demo cards with the
   user's actual content.
4. Read / Listen / Annotate / Share / cite (Section 2) — bigger lifts, do in
   any order once 1-3 land.
