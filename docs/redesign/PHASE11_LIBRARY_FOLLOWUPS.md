# Phase 11 — Library tab follow-ups roadmap

**Date written:** 2026-05-21
**Phase 11 closed:** 2026-05-22 — see "What's already done" below; "What's still owed" section now lists only items explicitly deferred to later phases.
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
- **"Add from library" picker** (commit `e85cecac`) — `BeforeTheShiftCard`'s
  footer now opens a real `LibraryBeforePicker` modal that lists the user's
  `library_items` (search + dedup against items already attached) and inserts
  into `step_library_before` on tap. Card also renders an empty-hint state
  when `libraryBefore` is provided but `items.length === 0`, so first-time
  attachment is possible. Wired through `useLibraryBeforeBinding` → both
  `PlanTabInterior` and `PlanTabIOSRegisterInterior`.
- **Back-ref navigation** (commit `2884a0f4`) — `BackRefRowView` on resource
  detail now parses `BackRefRow.id` (`${role}-${uuid}` format) and navigates
  to `/(tabs)/library/concept/{id}` (origin/cited) or `/step/{id}` (in_step).
  Demo slug ids (e.g. `origin-lactate-perfusion`) fall through to a clearer
  "demo back-reference" alert instead of a generic coming-soon.
- **Preview spine format label** (commit `f9995181`, roadmap §6) — replaced
  hardcoded "PRACTICE ALERT" / "P 1 / 8" with `item.formatLabel.toUpperCase()`
  and `item.meta` so non-PDF resources read correctly.
- **Dupe "Resources for this step" card removed** (commit `dbbdf710`) — the
  step Plan tab no longer shows two competing "+ Add from library" rows. The
  lower "ALSO RELEVANT FOR" card stays to preserve Focus Concepts management
  + existing `step_playbook_links` data; see project memory
  `project_phase11_phase6_table_overlap` for the long-term plan.
- **library_items.interest_id + library_item_interests M2M** (commits
  `a399e386`, `e45e3622`) — items can be tagged to any number of interests
  via the join table; picker RPC `library_items_for_picker(p_interest_id)`
  resolves "tagged for this interest OR completely untagged" in one
  round-trip. Single-interest `interest_id` stays as "captured-in" primary.
- **Tag chips on resource detail** (commit `bed710fd`) — inline "RELEVANT
  FOR" chip row on `/library/items/[id]` toggles tags optimistically.
- **CaptureSheet writes to library_items** (commit `6256bc78`) — link / paste
  modes capture real content; upload / photo wired via
  `expo-document-picker` + `expo-image-picker` to the `library-files`
  Supabase storage bucket (commit `75276c1a`).
- **CaptureSheet "Relevant for" chips** (commit `a2535880`) — capture-time
  interest tagging closes the M2M loop on the create side.
- **Resources zone live data** (commit `de02e62a`, roadmap §4) — in-play /
  recent / collections shelves read from real `library_items` +
  `library_collections` scoped via the picker RPC. Demo fallback when the
  account has zero captures so JHU screenshots still render.
- **Read action via in-app browser** (commit `d5723d5e`, roadmap §2) — opens
  via `expo-web-browser` (SFSafariViewController / Chrome Custom Tabs);
  reader mode for articles, system PDF viewer for uploads.
- **Share action** (commit `51b36adc`, roadmap §2) — RN `Share.share` with
  title + URL.
- **More menu + Delete + Rename** (this commit, roadmap §2) — ellipsis on
  resource detail opens an action sheet with Rename and Delete (destructive
  confirm). Delete cascades through the joins via `ON DELETE CASCADE`.
- **Listen for audio kinds** (this commit, roadmap §2) — `audio`-kind items
  with a URL play through the in-app browser's system audio player. Other
  kinds still show "Listen coming soon" since real TTS is its own scope.

## What's still owed (explicitly deferred to later phases)

Phase 11 closed 2026-05-22. Items below are tracked but not in scope:

### 1. Step library-before data path (HIGH PRIORITY)

**1b shipped 2026-05-21** (see "What's already done"). Remaining sub-tasks:

**1a. Seed during onboarding / demo creation.** When the demo flow creates a
step, attach 2-3 relevant library items pulled from the user's library. This
is a SQL/server-side change in the demo seeding scripts.

**1c. Auto-attach when step is created from a concept.** If the user creates
a step from a concept (origin), automatically attach the library items cited
by that concept's `concept_origins` and `concept_citations`. Best UX but
needs the cited-items pipeline to be solid first.

With 1b shipped, both 1a and 1c are nice-to-haves rather than blockers —
users can now attach manually from the step.

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

### 3. Back-ref row navigation — SHIPPED

Done 2026-05-21 (commit `2884a0f4`). Demo back-refs gracefully degrade to a
"this is a demo back-reference" alert; real UUID-targeted refs navigate. The
real-data path will activate the moment any user has `concept_origins` /
`concept_citations` / `step_library_before` rows pointing at a library item.

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

### 6. Hardcoded "PRACTICE ALERT" stamp — SHIPPED

Done 2026-05-21 (commit `f9995181`). Uses `item.formatLabel.toUpperCase()`
and `item.meta`. Dynamic page navigation can land alongside the future reader.

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

## Phase 11 closed — what's next (separate scopes)

The deferred items above are tracked under their own future scopes:

- **Reader work** (PDF text selection via `react-native-pdf`, article
  Readability extraction, in-line audio player). Unblocks Annotate /
  Cite as origin / TTS Listen as a coherent package.
- **D33 step context UI** for `step_collaborators` (the "With" picker) +
  `step_location` (the "Where" map). Schemas + RLS in place from Phase 11.
- **D34 sub-step Resource-link chip** via `step_resource_links` — currently
  no UI surfaces this table.
- **`step_beat_pins`** — inline pinned references inside Do/beat content.
  Schema present, no UI; landed alongside future Do-tab beat redesign.
- **Phase 6 → Phase 11 concept migration** — move `step_playbook_links`
  concept-link surface into a Phase 11 model so the "ALSO RELEVANT FOR"
  card can retire. See project memory `project_phase11_phase6_table_overlap`.
