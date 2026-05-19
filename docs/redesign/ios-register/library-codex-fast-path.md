# Fast path · 3 waves to a usable build

Companion to `library-codex-brief.md`. Skip map / picker / discuss for now — those land in a second session. Use this if you want **a working subscribe→adopt loop today**.

**Estimated time:** 6.5–8 focused hours. Three waves, smoke test between each.

---

## Setup (one time, 2 minutes)

In your terminal in the repo:

```bash
git checkout main
git pull
# Make sure these two files are in the repo:
ls docs/redesign/ios-register/library-tab-canonical.html
ls docs/redesign/ios-register/library-codex-brief.md
```

Open Claude Code in the repo root.

---

## Wave 1 · Foundation (~45 min)

Schema + rename. After this, the Library tab opens but is mostly empty.

**Paste into Claude Code:**

> Read `docs/redesign/ios-register/library-tab-canonical.html`, `docs/redesign/ios-register/Library - Emily nursing - iOS register.html`, and `docs/redesign/ios-register/library-codex-brief.md` end-to-end. Then execute brief steps 1–2 only: schema migrations + rename Playbook → Library.
>
> Specifically:
> 1. Write every migration in the Schema section of the brief as a single batched migration. Run it.
> 2. Rename `app/(tabs)/playbook/` → `app/(tabs)/library/`. Update the tab bar label to "Library" and icon to `ti-books`. Add empty zone scaffolds for Plans, People, Resources alongside the existing Concepts zone (Concepts code keeps working unchanged).
> 3. Add a segmented header (All / Plans / People / Concepts / Resources) to the Library landing — wire to a `zone` URL param, no filtering logic yet.
> 4. Commit each piece separately. Stop here.
>
> Do not build any other surfaces yet. Move fast — straight to main, no PRs.

**Smoke test before Wave 2:**
- App boots
- Bottom tab says "Library" not "Playbook"
- Tap Library → segmented header renders with 4 segments
- Concepts zone still shows existing concept cards (data preserved)
- Migration ran (check your DB has the new tables)

**If broken:** paste back the specific error to Claude Code with *"fix this and recommit"*. Don't move on with red builds.

---

## Wave 2 · Browse & adopt (~5.5 hr)

The biggest wave. Builds the end-to-end loop: subscribe → see plan → see subscriber → adopt step.

### Wave 2a · Horizontal timeline (~1 hr)

> Execute brief step 3 only: build `components/timeline/HorizontalTimeline.tsx` + `StepCardH.tsx` + `NowDivider.tsx`. Match the visual spec in canonical §3A · §4 · §7. NOW divider auto-centers via `offsetLeft` math on mount. `editable` prop enables long-press-to-reorder (defer drag — long-press menu with Move-left/Move-right is fine for v1). Render a debug route `/debug/timeline-h` with three demo instances: your own (editable=true), Phyl's subscriber timeline, James's followee timeline. Commit. Stop.

**Smoke:** open `/debug/timeline-h` → see 3 horizontal strips, NOW dividers visible, can swipe horizontally, long-press a card on the editable one to see Move options.

### Wave 2b · Plan detail (~45 min)

> Execute brief step 4: build `/library/plans/[id]` with three tabs (Steps / Subscribers / Resources). Steps tab uses the HorizontalTimeline from Wave 2a in non-editable mode. Subscribers tab is a vertical list of subscriber rows with progress mini-bars (canonical §3B). Resources tab is a vertical list (canonical §3C). Wire `plan_subscriptions` + `plan_resources` reads. Seed your dev DB with Kevin's HKDW plan + 6 subscriber profiles. Commit. Stop.

**Smoke:** open the seeded plan → see Steps (horizontal), tap Subscribers → see 6 rows with progress bars, tap Resources → see bundled materials.

### Wave 2c · Step interior with 4 tabs + Plan body (~1.5 hr)

> Execute brief step 5: build `/step/[id]` with `StepShell` and 4 phase tabs (Plan / Do / Reflect / Discuss — Discuss conditional per D35). Implement the **Plan tab body fully** per canonical §9A: WhatCard / WhyCard / HowCard (with sub-step list) / WithCard / WhereCard / CapabilityChipSet / NetworkSuggestionsList / MoreOptions + Next-Start-Doing CTA. Build the three sub-step types: plain, resource-linked, concept-linked. Checking a concept-linked sub-step also writes a new `concept_trail_quotes` row marking the concept Tested. Do/Reflect tabs can stay as their current bodies for now — only Plan is rebuilt. Commit incrementally. Stop.

**Smoke:** tap a step from anywhere → step opens with 4 tabs → Plan tab renders 5 fundamental cards + sub-step list. Add a concept-linked sub-step manually in the DB, check it off in the UI → confirm the concept advances to Testing in Library.

### Wave 2d · AdoptStepFooter (~20 min)

> Execute brief step 6: build `components/step/AdoptStepFooter.tsx` with two buttons (*Add this step to my timeline* primary, *Save idea as concept seed* secondary). Wire it into every read-only step view: subscriber timeline step, followee timeline step, any step a user views that they don't own. Use the existing `step_deck` table for save-to-deck; create a regular `steps` row with `source_type` + `source_id` for adopt. Preserve provenance. Commit. Stop.

**Smoke:** open Phyl's Step 4 from the Subscribers tab → see AdoptStepFooter → tap *Add to my timeline* → confirm a new step appears in your own Practice timeline with the HKDW plan stripe.

### Wave 2e · Resources zone + item detail + step library hooks (~1.5 hr)

> Execute brief step 5b. Use `Library - Emily nursing - iOS register.html` as the visual spec for these surfaces — it's deeper than the main canonical here.
>
> Three pieces:
> 1. **Resources zone landing** (Emily Phone 1) under Library — `components/library/resources/ResourcesZone.tsx` with segmented sub-scope (All / Concepts / Sources), *Drop something in* capture entry, *In play this week* strip, *Recently added* list, *Collections* row. Item rows show a format-typed spine (PDF / video / book / audio / link).
> 2. **Resource item detail** (Emily Phone 2) at `/library/items/[id]` — title block + actions (Read / Listen / Annotate) + the *Where this appears in your practice* block with three back-ref types: **Origin** (concepts seeded from this), **Cited** (concepts citing this), **In step** (steps that include this). Wire reads against `concept_origins`, `concept_citations`, `step_library_before` + `step_beat_pins`. (D36)
> 3. **Step library hooks** (Emily Phone 3) — add `components/step/plan/BeforeTheShiftCard.tsx` (read-check list backed by `step_library_before`) to the Plan tab body; add `components/step/do/BeatLibraryPin.tsx` for inline pinned references inside Do beats backed by `step_beat_pins`. Tap a checkbox → mark `step_library_before.read_at`. (D37)
>
> Commit each piece. Stop.

**Smoke:** open Library → Resources zone → see catalog with *In play this week* / *Recently added* / *Collections*. Tap an item → see backref block. Open a step seeded with a `step_library_before` row → see *Before the shift* card on Plan tab → check the read box → confirm the row updates → reopen the item → confirm the step now shows under "In step".

### Wave 2f · Capture sheet — Drop a resource (~30 min)

> Execute brief step 5c. Build the Emily Phone 4 capture sheet — `components/library/resources/CaptureSheet.tsx` — reachable from the universal `+` sheet's new *Drop a resource* row (D40). Four input modes: Link / Upload / Photo / Paste. After capture, run auto-detected topic tags (purple chips) — for v1, derive tags from title/URL with a simple keyword match; ship the AI-suggested path later. Optional attach-to picker shows step + concept candidates. Save → inserts into `library_items` + `library_item_topics` (+ optionally `step_library_before` or `concept_citations` if attach-to selected). Commit. Stop.

**Smoke:** tap `+` → *Drop a resource* → paste a URL → see tags appear → save → confirm row appears in *Recently added*. Try the attach-to path → confirm the resource shows up in the linked step's *Before the shift* card.

---

## Wave 3 · Practice Inbox (~1 hr)

The suggestion-bar wave. After this you have the full v1 loop.

> Execute brief step 7: build the Practice Inbox surface. Three pieces:
> 1. `InboxIcon` in Practice top-header — red-dot badge with count.
> 2. `InboxStrip` rendering above the timeline when count > 0 (canonical §8B).
> 3. `/practice/inbox` screen with segmented filter (All / From people / From plans / On deck) and `SuggestRow` cards (canonical §8A).
>
> Also wire the suggestion send-path: step menu (⋮) → *Suggest to…* → avatar grid → on send, creates `step_suggestions` row → recipient's inbox count increments.
>
> Each SuggestRow has 3 actions: *Add to timeline* (primary, uses AdoptStepFooter logic), *Save to deck*, *Dismiss*. Commit. Stop.

**Smoke:** from your own dev account → open someone else's step → ⋮ → Suggest to a test user → log in as that user → open Practice → see red-dot badge → see purple strip → tap → see the suggestion → tap *Add to timeline* → it lands in their Practice.

---

## You're done with v1.

You now have:
- Library tab with 4 zones
- Subscribed plans with subscribers + resources
- Horizontal step-card timelines everywhere
- 4-phase step shell with full Plan tab
- Library threads into Plan via sub-step Resource & Concept links
- Resources zone (catalog + item detail with back-references) per Emily flow
- *Before-the-shift* card on Plan + inline beat pins on Do
- Drop-a-resource capture from the universal `+` sheet
- Adopt-from-anywhere via shared footer
- Practice Inbox for suggestions

**What's intentionally missing (next session):**
- Map surfaces (§10) — *Where* picker + Full peer map
- Add-People picker for *With* (§11) — workaround: a plain text input until then
- Discuss tab live (§9B) — the tab renders but body is a "Coming soon" placeholder until you build it
- Cross-interest mentor suggestions (brief step 11) — placeholder empty state

For session 2, paste:

> Execute brief steps 8–11: map surfaces, add-people picker, discuss tab, mentor suggestions. Read the canonical sections §10, §11, §9B for visual spec. Same move-fast mode.

---

## Universal recovery prompts

If anything goes off-rails, drop these in:

**Build error:**
> Build is failing with `<paste error>`. Find the smallest fix, apply it, commit. Don't refactor anything else.

**Wrong direction:**
> Stop. The canonical §X shows `<thing>`. Compare your implementation to the canonical, list the deltas, then ask before fixing.

**Stuck on a decision:**
> Re-read decision D## in the brief. Apply it literally — don't reinterpret.

**Going too slow:**
> Cut scope. Ship the minimum that matches the canonical's visible behaviour. Defer anything not visible in the mockup.
