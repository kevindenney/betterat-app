# Library tab + step interior + map + add-people — Claude Code brief

**Mode.** Solo developer, move-fast, no feature flag, commit straight to `main`, no PR. Skip review ceremony. Land a working build by end of session.

**Source of truth.**
- `docs/redesign/ios-register/library-tab-canonical.html` (~3900 lines, 17 phones, decisions D21–D35) — overall architecture: 4 Library zones, plan detail, horizontal timelines, step interior with 4 tabs, Inbox, map, add-people.
- `Library - Emily nursing - iOS register.html` (4 phones) — the **Resources zone** in depth: catalog with segmented tabs, item detail with back-references ("Where this appears in your practice"), step's *Before-the-shift* checklist + inline pinned beat references, quick-capture sheet, Collections. **Use this as the spec for everything inside the Resources zone and resource→step integration** — it's deeper than what `library-tab-canonical` shows for that zone.

Read both end-to-end before writing code. The mockups are the spec; the surrounding rail prose explains the *why*. The brief below is a checklist — disagreements get resolved by the canonicals, not by this file.

**Supersedes.** `phase-6-playbook-tab.md`, `phase-7-network-browsing.md`, `phase-8-share-and-fleet-view.md`. The renamed "Library" tab folds those three together. Read the old briefs for schema/component hints but **the new canonical wins** any conflict.

---

## What changes (the 35-second pitch)

1. **Rename Playbook → Library.** Same tab slot. New icon `ti-books`.
2. **Library has 4 zones:** Plans · People · Concepts · Resources.
3. **Plan detail** has 3 tabs: Steps · Subscribers · Resources. Subscribers replaces the old "co-practitioners" surface.
4. **Every timeline in the product is horizontal**: step cards with a NOW divider, done left, planned right. User's own cards are long-press-to-reorder.
5. **Every step has 4 phase tabs:** Plan · Do · Reflect · **Discuss**. Discuss is conditional on shared access (subscribed plan, suggestion, or collaborator in *With*).
6. **Plan tab** answers 5 fundamentals: What · Why · How (sub-steps) · With · Where + Capabilities. Sub-steps can be plain todos, **Resource-links**, or **Concept-applications** — Library threads into the step plan.
7. **Practice gets an Inbox** in the top-header (red-dot count + purple strip above timeline). Inbox unifies: followee suggestions, new plan-pushes, your own deck.
8. **Practice zoomed-out** shows only *your* steps, with plan provenance (coloured stripe + chip).
9. **Map surface** anchors *Where* — Pick on map for the picker, Full peer map for browsing everyone's steps at locations with adopt/suggest actions.
10. **Add People picker** for the *With* field — grouped (Recent crew / Followees / Fleet) with inline role assignment.

---

## All 15 decisions, terse

| # | Decision |
|---|---|
| D21 | Rename Playbook → Library |
| D22 | 4 Library zones: Plans · People · Concepts · Resources |
| D23 | Subscribers live inside the plan (Plan detail tab) |
| D24 | Subscriber → timeline → step → adopt-or-save |
| D25 | Practice owns *your* steps; plans show as provenance stripe + chip |
| D26 | People = 4th Library zone (followed individuals, no plan needed) |
| D27 | Suggest bar lives in Practice (Inbox icon, top-header) |
| D28 | Every step is adoptable — single shared `<AdoptStepFooter>` |
| D29 | Two timeline scopings: a followee's "whole timeline" vs "this plan only"; segmented control flips |
| D30 | Suggesting is a step menu action (⋮ → Suggest to…) |
| D31 | Timelines are horizontal step cards (no vertical lists) with a NOW divider; own cards long-press-to-reorder |
| D32 | Four phase tabs per step: Plan · Do · Reflect · Discuss |
| D33 | Plan = What · Why · How · With · Where + Capabilities |
| D34 | Library threads into How sub-steps (Resource-link & Concept-application chips) |
| D35 | Discuss conditional on shared access (subscribed plan, suggestion, or collaborator in With) |
| **D36** | **Resource item detail shows back-references — Origin (concept seeded from this), Cited (concept that cites it), In step (steps that include it). The back-ref block is what earns the surface.** |
| **D37** | **A step has two library hooks: *Before* (a checklist of resources to bring into the step; checks tick off as read/watched) + *During* (inline pinned references inside Do/beat content). Both compose into D34's How sub-steps. *Before-the-shift* is its own card; inline beat references render inside Do.** |
| **D38** | **Collections — named topical bundles (Sepsis & rapid response · Cardiac & telemetry · …) shown as cards at the bottom of the Resources zone. Tag-driven (an item is in one catalog but surfaces in multiple collections). AI-suggested on capture; user-editable. Authored paths can ship with a recommended starting collection.** |
| **D39** | **A concept can be born from a resource quote — Phone 2's "Origin" backref. Concept seeds come from (a) voice/text capture (existing `playbook_insights`), or (b) a highlighted quote pulled from a library item. Both routes land in the same concept lifecycle.** |
| **D40** | **Universal "+" sheet adds a *Drop a resource* row alongside *Drop a concept* — opens the Emily Phone 4 capture sheet (Link / Upload / Photo / Paste, auto-detected topic tags, optional attach-to step or concept).** |

---

## Schema additions

```sql
-- Library plans (subscribed blueprints — supersedes old "blueprints" table)
plan_subscriptions       (id, user_id, plan_id, subscribed_at, status, source_type)

-- People you follow (no plan in common required)
follows                  -- already exists; ensure visibility column
person_recent_activity   -- materialized view: last 1 settled step per followee

-- Plan resources (bundled by coach + auto-surfaced to subscriber's Library/Resources)
plan_resources           (id, plan_id, kind, title, url, linked_step_id, duration_min)

-- Personal library items (Emily's catalog — supersedes any old "saved articles" table)
library_items            (id, user_id, kind, title, source_label, url_or_blob_id, year, page_count, duration_min, captured_at, read_at, last_used_at)
library_collections      (id, user_id, name, description, ai_suggested, created_at)
library_item_collections (id, item_id, collection_id)        -- many-to-many tags
library_item_topics      (id, item_id, topic_tag)             -- auto-detected from capture
concept_origins          (id, concept_id, library_item_id, quote_text, quote_page)  -- D36/D39
concept_citations        (id, concept_id, library_item_id, context)                 -- D36 "cited"
step_library_before      (id, step_id, library_item_id, position, read_at)          -- D37 before-shift checklist
step_beat_pins           (id, step_id, beat_id, library_item_id, pin_label)         -- D37 during-shift inline pins

-- Step-level
step_concept_links       (id, step_id, concept_id, linked_at)   -- D34
step_resource_links      (id, step_id, resource_id, linked_at)  -- D34
step_collaborators       (id, step_id, user_id, role)           -- D33 With
step_location            (id, step_id, lat, lng, name, address) -- D33 Where + §10
step_discussions         (id, step_id, author_id, body, created_at, in_reply_to)  -- D35

-- Suggestions (D30 + Practice Inbox D27)
step_suggestions         (id, source_user_id, target_user_id, source_step_id, message, created_at, status)

-- Inbox unified view
inbox_items              -- materialized: suggestions + plan-pushes + deck items

-- Step deck (already in phase-7 brief)
step_deck                (id, user_id, source_type, source_id, ..., status='on_deck')

-- Cross-interest mentor suggestions (Plan tab "Suggestions from your network" §9A)
mentor_suggestions       (id, target_user_id, mentor_user_id, suggested_step_template, source_interest_id)
```

No drops. Old `playbook_concepts` / `playbook_insights` tables keep their data — concepts is now a zone, not a tab.

---

## Files to touch — by surface

| Surface | Where it lives |
|---|---|
| **Library landing** (4 zones) | `app/(tabs)/library/index.tsx` (rename from `playbook/`), `components/library/LibraryLanding.tsx`, `PlanCard.tsx`, `PersonCard.tsx`, recycled `ConceptCard.tsx`, `ResourceCard.tsx` |
| **Resources zone** (Emily Phones 1, 4) | `components/library/resources/ResourcesZone.tsx`, `LibraryItemRow.tsx`, `InPlayThisWeekStrip.tsx`, `RecentlyAddedList.tsx`, `DropSomethingInCard.tsx`, `CollectionsRow.tsx`, `CaptureSheet.tsx` (Link / Upload / Photo / Paste) |
| **Resource item detail** (Emily Phone 2) | `app/library/items/[id].tsx`, `components/library/ResourceItemDetail.tsx`, `WhereThisAppearsBlock.tsx` (Origin / Cited / In step backref rows) |
| **Step library hooks** (Emily Phone 3) | `components/step/plan/BeforeTheShiftCard.tsx` (read-check list, D37), `components/step/do/BeatLibraryPin.tsx` (inline pinned reference inside Do beats) |
| **Plan detail** | `app/library/plans/[id]/index.tsx` with `StepsTab.tsx`, `SubscribersTab.tsx`, `ResourcesTab.tsx` |
| **Horizontal step timeline** | `components/timeline/HorizontalTimeline.tsx`, `StepCardH.tsx`, `NowDivider.tsx` (shared by user, subscriber, followee, plan views) |
| **Step interior** (4 tabs) | `components/step/StepShell.tsx`, `PlanTab.tsx`, `DoTab.tsx`, `ReflectTab.tsx`, `DiscussTab.tsx` |
| **Plan tab body** (5 fundamentals) | `components/step/plan/WhatCard.tsx`, `WhyCard.tsx`, `HowCard.tsx` (w/ sub-step list), `WithCard.tsx`, `WhereCard.tsx`, `CapabilityChipSet.tsx`, `NetworkSuggestionsList.tsx`, `MoreOptions.tsx` |
| **Sub-steps with Library links** | `components/step/plan/SubStep.tsx`, `SubStepAdder.tsx` (3 modes: plain / from-Resources / from-Concepts) |
| **Discuss tab** | `components/step/discuss/DiscussThread.tsx`, `DiscussContext.tsx`, `DiscussMessage.tsx`, `DiscussComposer.tsx` |
| **Adopt step footer** (shared) | `components/step/AdoptStepFooter.tsx` — used in every read-only step view |
| **Practice Inbox** | `components/practice/InboxIcon.tsx` (top-header), `InboxStrip.tsx` (above timeline), `InboxScreen.tsx`, `SuggestRow.tsx` |
| **Map surfaces** | `components/map/MapShell.tsx`, `PickOnMap.tsx` (Where picker), `FullPeerMap.tsx`, `MapPin.tsx`, `MapSheet.tsx`, `MapFilters.tsx` |
| **Add People picker** | `components/picker/AddPeopleSheet.tsx`, `PkRow.tsx`, `RolePicker.tsx`, `InviteByLinkRow.tsx` |
| **Routes** | `/library`, `/library/plans/[id]`, `/library/plans/[id]/subscribers`, `/library/people/[handle]`, `/practice/inbox`, `/map/peer`, `/step/[id]` (gains tabs) |

---

## Acceptance — what "done" looks like

A working build that hits all of these in order. Test each as you go; don't batch.

1. Library tab renamed and reachable. 4 zones populated with real data. Segmented header filters work.
2. Tap any plan card → plan detail with 3 tabs. Subscribers tab lists peers with progress mini-bars. Resources tab lists plan-bundled materials.
3. Horizontal step timeline lands in 3 places: plan-Steps tab, subscriber-timeline, followee-timeline. NOW divider auto-centers in view. Long-press reorders on your own (Practice) timeline only.
4. Tap any step from any list → step detail with 4 phase tabs. Plan tab shows 5 fundamental cards + sub-step list with Library-link chips + capabilities + cross-interest mentor suggestions + Next CTA.
5. Sub-step types work: plain, Resource-linked (tap → opens resource), Concept-linked (tap → opens concept; check → marks concept Tested).
6. Discuss tab visible IFF shared access. Context strip names who's in the thread. Compose + post + react.
7. AdoptStepFooter renders on every read-only step (subscriber, followee, suggestion, map-sheet, inbox row) with *Add to my timeline* primary + *Save idea as concept seed* secondary.
8. Practice Inbox: icon + red-dot badge in top-header; strip above timeline when count > 0; tap → inbox screen with 3 sources. Suggestions land here on receipt.
9. Practice zoomed-out: only your steps, plan-stripe + chip on plan-derived rows; tap chip → plan detail.
10. *Where* field has Pick-on-map. Map picker shows nearby-peer count for the selected pin.
11. Full peer map at `/map/peer` with filter chips, all peer pins, tap-pin → bottom sheet with Adopt + Suggest + Open.
12. *With* field has Add-People picker — search, 3 grouped sources, role-assignment inline, invite-by-link row, returns role-chips to the With section.
13. **Resources zone** (Emily Phone 1) — segmented sub-scope (All / Concepts / Sources), *Drop something in* capture entry, *In play this week* + *Recently added* + *Collections* zones, item rows with format-typed spine (PDF / video / book / audio / link).
14. **Resource item detail** (Emily Phone 2) at `/library/items/[id]` — title block + actions (Read / Listen / Annotate) + the *Where this appears in your practice* block with three back-ref types (Origin / Cited / In step).
15. **Step library hooks** (Emily Phone 3) — Plan tab gains a *Before the shift* card with read-check list; Do tab beats can carry inline pinned library references. Tap a checkbox → marks `step_library_before.read_at`.
16. **Capture sheet** (Emily Phone 4) — universal `+` sheet's *Drop a resource* row opens it. Link / Upload / Photo / Paste. Auto-detected topic tags (purple chips). Attach-to picker shows step + concept candidates. Save → lands in catalog.
17. **Concept origin from resource** (D39) — opening a library item, selecting a quote, *Make this the seed of a concept* → creates a `playbook_concepts` row in Forming state with `concept_origins` linking back to the item + quote.

Smoke test (architecture): a sailor subscribes to Kevin's HKDW plan → sees it in Library/Plans → opens Plan detail → adds Step 4 to their timeline → opens Step 4 → Plan tab shows 5 fundamentals → adds a sub-step that links a Library Concept → Library shows that concept marked Tested → opens Discuss → sees Kevin's comment → replies. End to end works.

Smoke test (resources, Emily flow): a nursing student opens Library → Resources zone → *Drop something in* → uploads an AACN PDF → it lands in the catalog with auto-detected tags → opens the item → highlights a quote → *Make this the seed of a concept* → concept appears in Concepts zone in Forming state with the item as Origin → opens a Pre-Clinical step → *Before the shift* card shows the AACN PDF → checks the read box → opens the item again → *Where this appears in your practice* block now lists the concept (Origin) + the step (In step).

---

## Build order — fast lane

Do these in roughly this order; each layer unblocks the next.

1. **Schema migrations** (15 min, write all of them, run together).
2. **Rename Playbook routes/components → Library**; add People + Resources zone scaffolds. Existing concept code stays as-is, just lives in Concepts zone. (30 min — mostly mechanical.)
3. **Horizontal step timeline component**. Build it once, reuse 4× (your Practice, Plan-Steps, Subscriber, Followee). (1 hr.)
4. **Plan detail** (3 tabs). Steps tab uses #3. Subscribers tab is a list. Resources tab is a list. (45 min.)
5. **StepShell with 4 phase tabs**. Plan body with 5 fundamentals + sub-step component + Library-link chips. (1.5 hr — this is the heaviest piece.)
5b. **Resources zone + Resource item detail + Before/During-shift step hooks** — Emily Phones 1–3. Build the catalog landing inside Library/Resources, item detail with back-references, and wire `step_library_before` + `step_beat_pins` so steps can hold a *Before the shift* checklist and inline beat pins. (1.5 hr — the second-heaviest piece. Schema already in place from step 1.)
5c. **Capture sheet** — Emily Phone 4. Reachable from universal `+` sheet's *Drop a resource* row. (30 min.)
6. **AdoptStepFooter** + wire it into every read-only step view. (20 min.)
7. **Practice Inbox** (icon, strip, screen, suggest_to action sheet). (1 hr.)
8. **Map surfaces** — start with Pick-on-map (simple picker), then Full peer map. Use Mapbox or similar. (1.5 hr if you have Mapbox set up; 3 hr if not.)
9. **Add People picker.** (30 min.)
10. **Discuss tab + thread.** Defer real-time websockets — long-poll or refresh is fine for v1. (1 hr.)
11. **Mentor cross-interest suggestions** in Plan tab. (30 min — query is the trick; UI is simple.)

Total: 8–10 focused hours. Cut the map down to MVP (pick-on-map only, defer full peer map to a follow-up) if pressed.

---

## What to defer (deliberately)

- **Real-time discuss** — long-poll or page-refresh ships fine for v1.
- **Map clustering at zoom-out** — show all pins, ship with low-density data.
- **Suggestion notifications** — show in Inbox only, push later.
- **Reorder via drag on horizontal timeline** — long-press menu (Move left/right) is fine for v1; full drag is polish.
- **Plan-push auto-routing setting** (per-plan: auto-add vs land-in-inbox) — default to land-in-inbox; setting comes later.
- **Mentor formal designation** — for now, "Mentor" badge is just visual; backend role can wait.
- **Search across all surfaces** — search bars render in mockups but can wire to a single global search later.

---

## Codex prompt — paste verbatim

```
Task: implement Library tab + horizontal timelines + 4-phase step + Practice Inbox + map + add-people in the betterat-app repo. Solo developer, move-fast mode — commit straight to main, no PRs, no feature flag.

INPUT:
  Canonical: docs/redesign/ios-register/library-tab-canonical.html
  Brief: docs/redesign/ios-register/library-codex-brief.md (this file)

If either is missing, copy from the latest project zip and commit.

PROCEDURE:

1. Read the canonical end-to-end. Read this brief. Note the 15 decisions (D21–D35). Canonical wins disagreements.

2. Schema first — write all migrations at once and run them together:
   • plan_subscriptions, plan_resources
   • step_concept_links, step_resource_links, step_collaborators, step_location, step_discussions
   • step_suggestions, step_deck, mentor_suggestions, person_recent_activity (mv)

3. Rename `app/(tabs)/playbook/` → `app/(tabs)/library/`. Update tab bar label and icon to `ti-books`. Add People + Resources zone scaffolds alongside existing Concepts. Existing concept code keeps working.

4. Build the horizontal step timeline component once (`components/timeline/HorizontalTimeline.tsx`) and reuse 4× — Practice zoomed-in/out, Plan-Steps tab, Subscriber timeline, Followee timeline. NOW divider auto-centers via offsetLeft math. Long-press-to-reorder enabled only on `editable={true}` (your own timeline).

5. Plan detail at /library/plans/[id] with 3 tabs (Steps / Subscribers / Resources).

6. Step interior at /step/[id] with 4 phase tabs (Plan / Do / Reflect / Discuss). Plan body has 5 fundamental cards. How card holds a sub-step list with 3 sub-step types: plain, resource-linked, concept-linked. Checking a concept-linked sub-step also marks the concept Tested.

7. AdoptStepFooter shared component. Render on every read-only step view (subscriber, followee, suggestion row, map sheet, inbox row).

8. Practice Inbox: top-header icon with badge, purple strip above timeline when count > 0, /practice/inbox screen with 3-source segmented filter, SuggestRow with Add/Save-to-deck/Dismiss.

9. Suggesting: step menu (⋮) → Suggest to… → avatar grid of recent followees → on send, creates step_suggestions row → recipient's inbox lights up.

10. Map at /map/peer with filter chips, Mapbox or equivalent, peer pins coloured by relationship, tap-pin → bottom sheet with AdoptStepFooter actions. Pick-on-map variant at /map/pick reachable from Plan's Where field.

11. Add-people picker — sheet over the step. Grouped (Recent crew / Followees / Fleet). Inline role-picker per selected row. Invite-by-link row at bottom.

12. Discuss tab — render only when step has shared access (subscribed plan OR step_suggestions row OR step_collaborators > 0). Context strip, thread, composer. Long-poll for v1.

13. Cross-interest mentor suggestions in Plan tab — query mentor_suggestions filtered to similar-step templates.

14. Smoke-test the end-to-end loop: subscribe → Library → plan detail → add Step 4 → step Plan tab → add concept-linked sub-step → check it → concept Tested → discuss → reply.

15. Defer (do NOT build now): real-time discuss, map clustering, push notifications, drag-reorder, plan-push auto-routing setting, formal mentor role, global search.

16. Commit-as-you-go — small commits with clear messages. Don't batch into one mega-commit. No PRs needed; merge to main directly.

CONSTRAINTS:
  • No feature flag — old playbook code paths can disappear.
  • Existing playbook_concepts / playbook_insights data preserved verbatim.
  • If a screen the canonical shows can't be built today, scaffold the route with a placeholder and note it.
  • If anything in the canonical is unclear, ask once before guessing.
```

---

## After it ships

Sanity-check this list with real data:
1. Library landing renders 4 zones with > 0 items each (seed your dev DB).
2. Tap a plan → 3 tabs work, Subscribers shows progress bars, Resources shows links.
3. Add a step from Subscribers timeline → verify provenance preserved + plan stripe shows in Practice.
4. Add a Concept-linked sub-step → check it → confirm the concept advances to Testing.
5. Send a suggestion from a step's ⋮ → confirm it lands in the other user's Inbox.
6. Use Pick on map → confirm the location persists on the step + appears as a pin on the full map.
7. Add 2 people via Add-People picker → confirm With chips appear and Discuss tab now shows.
