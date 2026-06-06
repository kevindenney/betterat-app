# BetterAt Redesign — Decisions Log

A focused log of architectural decisions made during the redesign session of May 11–12, 2026, and the unresolved questions that remain. Read alongside `betterat-redesign-spec.md`.

---

## Resolved decisions

### Philosophy and tone

**D1. Timeline-as-narrative is the product's philosophy.** BetterAt is a journaling-like product about becoming, not a task manager. The timeline of steps is the primary structure.

**D2. Tone: quiet, serious, with reverent undertones.** No celebration animations, no gamification, no streak shaming, no engagement nags. Visual language is serif (Lyon Display) for first-person voice, sans (Söhne) for system chrome.

**D3. No emoji as decoration.** Tabler-style line icons carry meaning sparingly.

**D4. Voice as primary input modality.** Big microphone buttons throughout. Voice for composition, queries, answers. Text as secondary.

**D5. No advertising, no engagement metrics surfaced to users.**

### Step architecture

**D6. Three temporal step states: Before / During / After.** Defaults adapt to step's temporal position (Future opens to Before, Present to During, Past to After).

**D7. Step completion is inferred, not declared.** No "Mark as Done" button. State derives from temporal passage + reflection presence.

**D8. Horizontal swipe between adjacent steps; vertical swipe between tabs within a step.** Two-axis navigation. Forward in time = swipe left.

**D9. Pull down from a step expands to timeline overview.** The timeline overview is the zoomed-out destination.

**D10. The Now bar marks temporal landmark on the timeline.** Horizontal line with current timestamp. Non-interactive. Anchors default view.

**D11. Shared steps are one entity with multiple participants.** Each participant has private Before/During/After tabs within the shared frame. Step-level content (conditions, fleet results, findings, author commentary) is visible to all participants.

**D12. Shared step deletion: cannot delete for others.** User can leave participation or hide from their timeline.

**D13. Step deletion is three different actions:** Remove from timeline (future only), Mark didn't happen (preserve planning record), Archive (past, recoverable). True deletion of past step with reflections is buried in settings.

**D14. Pre-event analysis is a structured AI surface, not a chat thread.** Four named sections for sailing (Start, Upwind, Downwind, Rig tune). Source chips show inputs. Voice query affordance.

**D15. Post-event debrief compares plan to outcome in freeform prose.** Not bullet checklists. Reads like a coach's debrief.

**D16. Pattern tracking spans steps and questions.** AI surfaces "third time this question has come up" with frequency annotations.

### Capabilities and concepts

**D17. Capabilities and concepts are distinct units.** Capabilities are abilities you can demonstrate (states: learning/practicing/breakthrough). Concepts are ideas you understand (have depth, resources, questions, patterns).

**D18. Capabilities accumulate at the user level with path attribution.** One "heavy-air technique" capability across all paths that touch it. Single progression history.

**D19. Concepts feed planning; planning generates reflections; reflections feed concepts.** The loop closes.

### Paths

**D20. Three-layer hierarchy: Interests → Paths → Steps.**

**D21. Paths can declare a parent path (specialization).** Local cohort path specializes worldwide path.

**D22. Paths can have multiple authors.** Co-authored, with per-step authorship visible via avatar chips on step listings.

**D23. Institutional sponsors get square-avatar visual distinction** from round-avatar humans.

**D24. Path step templates vs. user instances.** Templates live on the path; instances live on the user. Templates can update with propagation to instances.

**D25. Path steps can be scheduled (author-fixed date) or flexible (user-picked).**

**D26. Step adoption separates author's framing from user's why.** Author's framing is a quoted block; user's why is an optional layer on top.

**D27. Personal path forking allowed; institutional path forking not allowed.**

### Playbook

**D28. The playbook is the user's conceptual home base.** Not a resource library. Active, evolving, AI-assisted.

**D29. Vision is the deepest playbook element.** Private even when other content is shared. Read by AI to shape all suggestions. Versions preserved with provenance.

**D30. AI-synthesized "your evolving understanding"** for each concept, written in user's voice from multiple reflections. Highest-stakes AI work in the product.

**D31. Four levels of playbook sharing:** private, read-only mentor access, collaborative, published concepts. Per-element granular control.

**D32. Path authors get read-only access to subscribers' playbooks by default.** Disclosed at subscription time.

**D33. Reflections feed playbook concepts via AI ingestion surface.** User approves additions to existing concepts and new concept proposals.

**D34. Q&A is a first-class playbook element.** Questions hang open, tracked across time.

**D35. Raw Inbox is always private** regardless of other sharing scopes.

**D36. Cross-interest playbooks: separate per interest.** Interest picker switches between them.

### Navigation

**D37. Five-pillar nav was wrong; four-pillar nav is right.** Practice / Playbook / Discover / Reflect.

**D38. Learn tab eliminated.** LMS thinking parallel to the path/playbook system. Course-equivalent content becomes paths; lecture-equivalent content becomes resources.

**D39. Coaches sub-tab eliminated from Discover.** Coaches are People with role context.

**D40. Discover has four sub-tabs: Paths, People, Orgs, Forums.** Paths is primary destination. Interest filter pinned at top.

**D41. Topic chips in Discover → Paths are curated per interest** (6-10 per interest), not user-generated tags.

### AI integration

**D42. AI never speaks as itself.** No AI coach character, no chat surface, no AI-generated reflections or mentor responses.

**D43. AI does invisible infrastructure work** — transcription, synthesis, pattern detection, semantic search, question identification, conditions extraction, pre-event analysis grounded in user history.

**D44. AI assertions show provenance.** "See the trail →" lets user verify source reflections.

**D45. AI proposals (new concepts, captured questions, capability suggestions) require user approval.**

### Mentorship and cohort

**D46. Three modes of mentorship:** pattern-level authorial commentary (one-to-many), direct response to individual reflection (one-to-one selective), premium 1:1 tier (paid extra, direct messaging + monthly calls).

**D47. Cohort visibility defaults are conservative.** Most reflections are private until explicitly shared.

**D48. Path authors see shared pre-event analyses and debriefs.** Authors choose when to leave commentary based on AI-surfaced patterns.

### Orgs

**D49. Orgs are typed:** schools, hospitals, clubs, non-profits, professional bodies, state programs, businesses. Type determines relationship affordances.

**D50. Org page architecture is consistent across types** but content sections vary (clubs show events and racing; non-profits show volunteer opportunities; schools show curriculum).

**D51. Multi-layer institutional context (for development scenarios)** surfaces the full layered support structure as an empowering legibility move.

### Reflect tab

**D52. Reflect uses a quieter visual register than the rest of the product.** More serif, more whitespace, less interactive chrome. Statistics in narrative sentences, not tiles.

**D53. Capability arcs visualized as line drawings.** Not data dashboards. Thin lines, horizontal state-threshold guides, time on x-axis.

**D54. Vision evolution shown as vertical timeline with editorial annotations.** AI-drafted, user-editable.

**D55. "Where your thinking has shifted" is AI-synthesized long-arc concept evolution.** Highest-value AI work alongside concept understanding synthesis.

**D56. "Moments you've returned to" — AI curation of significant reflections.** User can pin or hide, but AI drives primary selection.

### Notifications

**D57. Conservative defaults.** Author commentary, scheduled steps, significant playbook moments. Most activity stays in the inbox quietly.

**D58. No badge counts on individual notification items.** Inbox is "for your attention," not a feed demanding action.

**D59. Push notifications are a small subset of inbox.** Most notifications live in inbox until user looks.

### Commercial

**D60. Three pricing tracks:** consumer paid (80/20 split author/platform), institutional licensing (per-beneficiary per-month), development sector licensing (donor/state-funded).

**D61. Premium 1:1 mentor tier: $10-30/month subscription on top of base path fee.**

**D62. Refunds: platform-level standard policy** (14-day window, no refunds after). Authors don't set custom policies.

### Localization

**D63. Localization is full visual register adaptation, not translation overlay.** Hindi gets proper Devanagari serif typography. Right-to-left languages handled with proper directional layout.

**D64. The architecture is universalizable across consumer, institutional, and development contexts.** Same units (interests, paths, playbooks, capabilities, concepts, steps, orgs, cohorts). Content, language, pricing, connectivity, and visual register adapt per context.

### Authorship

**D65. Authorship is accessible from the playbook** ("you've accumulated material on this — author a path?") and from settings.

**D66. Author dashboard shows "where your attention helps most"** — AI-surfaced patterns with action affordances.

**D67. Author reputation accumulates across paths** (subscriber count, ratings, completion signal).

---

## Unresolved questions

Organized by category. Each item is a deferred design decision or unfinished surface.

### Design surfaces still needed

- **Institutional analytics dashboard** (for JHU, RHKYC, PRADAN equivalents). What aggregate data is meaningful without violating individual privacy. Concept coverage, question frequency, vision evolution patterns, capability progression across cohorts.
- **Path author dashboard for institutional authors** (Patricia at JHU). Same architecture as Emily's author dashboard but with institutional context.
- **Vision composition flow.** How users actually write their Vision. Deepest single act of self-articulation. Probably a prompted reflection at the right moment (a week in, not at signup).
- **Review composition surface.** Long-form retrospective writing space, triggered from Reflect. Annual or path-completion scale.
- **Post-event integration / "trophy of becoming."** After Worlds, MSN graduation, path completion. Navigable, shareable.
- **Faculty onboarding flow (institutional Phase 3).**
- **Student onboarding flow.**
- **Institutional admin ongoing dashboard.** Beyond initial setup.
- **Forum design.** Conversation surfaces under orgs.
- **Search results surface.** Cross-product search. Grouped by type.
- **Path detail page.** Before subscription decision.
- **Concept detail page in playbook.** Full view of single concept.
- **Resource detail in playbook.** Single resource with user's notes.
- **Long-press context menu on steps.** Delete, archive, reschedule, share affordances.
- **First-time Vision creation flow.** When and how new users write their first Vision.
- **Cross-language community design** (for global / development deployment). Voice notes across languages, AI translation within cohorts.
- **Year view of timeline.** Felix zooming out. Different from Reflect (which is contemplative) — this is navigating.
- **Step versioning when path authors update.** Propagation rules, notifications.
- **Cross-path step composition.** Combining content from two path templates.
- **Concept merging and splitting tools.**
- **Step-level evidence linking and reviewing.** Photos, videos, GPS, scorecards. How they connect to specific reflection moments.
- **"Step happening now" affordance.** Clean transition into During-tab mode when anchor time arrives.

### Architectural decisions still to lock

- **Voice vs. text primacy for the main user base.** Voice was made primary for Sunita (rural development context). Should it be equally primary for Tom (sailing) and Emily (nursing)? Probably yes but worth confirming.
- **Path forking specifics.** Personal vs. institutional, with what UI surfaces.
- **Refund and cancellation policies** in detail.
- **Author tiers and economics** — free, paid, paid + premium. Institutional authors paid by institution, not subscribers.
- **Household-level privacy** for sensitive contexts (app hiding, payment obscurity, voice notes that don't auto-play).
- **Long-running steps.** A four-day regatta. A two-week clinical rotation. How they appear on the timeline.
- **Premium subscriber Stripe mechanics.** One-time path fee plus monthly subscription on top.
- **Reputation and reviews for authors.** How subscribers leave reviews. Public or platform-only.
- **Quality and curation in Discover.** Featured paths, editorial curation, anti-quality-floor mechanisms.
- **Step suggested as capability flow.** When AI notices a capability worth tracking, the surface for user to confirm.
- **Author can update steps after publication.** Propagation, existing subscribers see updates, option to re-adopt.

### Smaller open design questions

- Now bar visual ticking during a session
- Bell icon visibility rules (always vs. only when new)
- Hinge between steps: always-on during transition vs. on-pause only
- Check mark on completed steps: explicit affordance vs. always implicit
- Capability arc visualization for plateaued or regressed capabilities
- Vision evolution annotations: AI-written, user-written, or both
- The "Reflect" tab name — final or could be better
- Push vs. inbox-only notification thresholds
- Notification grouping when multiple things come from same source
- Mute and snooze affordances for paths and notifications
- Email digest scope (weekly or daily, what they contain)
- "Save for later" — where saved drafts live in the playbook
- Voice input on date selection in composition sheet
- Photo and video evidence carrying forward to future steps
- Cohort visibility of pre-race analyses by default
- Path author visibility of pre-race analyses by default

### Larger strategic / commercial questions

- Pricing model for institutional vs. consumer use in detail
- How to position the product to LMS-thinking institutional buyers
- Onboarding for institutional staff coming from LMS expectations
- Course migration tooling — engineering investment estimate
- Mission-driven business model for development context — per-beneficiary pricing, donor funding mechanics
- Author's relationship to platform when path content is also personal IP — terms of service, content licensing, exit
- Author career paths — building reputation, attracting subscribers, eventually institutional licensing
- Path-as-published-playbook architecture — whether paths and playbooks share underlying data structures

### Tone and texture work

- Serif typography commitment across non-Latin languages (Devanagari, Arabic, CJK)
- AI synthesis voice quality — making "your evolving understanding" feel like user's voice without fabrication
- Vision element tone variations per context (literary first-person vs. development-context practical)
- "What's not a notification" decisions — keeping inbox quiet enough

---

## Race model & org admin calendar (added 2026-06-06)

**D30. A race is a Step with `is_race = true`, not a separate step type.** We rejected a `step_kind` taxonomy (Phase M.5). A step is a step; race vs. non-race is the only first-class subtype, carried by the boolean `timeline_steps.is_race`. See `specs/ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md`.

**D31. `is_race` is the branch point for the race machinery.** When true, a step earns race-only affordances (⛵ Atlas marker, course/marks/conditions cockpit, scoring/results). When false it stays a generic scheduled step. One surface, one boolean — no per-vertical forks. An org-admin race calendar is just scheduled shared steps with the flag set.

**D32. Race detail lives in a JOIN, not in `timeline_steps` columns.** `timeline_steps` stays the universal spine; when `is_race = true` it joins (nullable `regatta_race_id` FK) to the existing `regattas`/`regatta_races`/`race_results` scoring backend. Don't bloat the universal table with sailing-only columns, and don't rebuild scoring on day one.

**D33. Scoring rows are minted lazily, not on the `is_race` toggle.** Flipping `is_race = true` creates only the `timeline_steps` row — `regatta_race_id` stays null until someone actually scores the race. Most club races never get formally scored; eager creation would litter `regatta_races` with empty rows. The race cockpit mints the scoring row on first use.

**D34. A "season" is a series of many race steps under one series container, not one fat step.** A recurring program (e.g. a Saturday series, Oct–Mar) generates **one `is_race` step per occurrence**, all linked to a single series row (`race_series` / `regattas`). This is distinct from a single multi-race regatta weekend (still open question #3), which stays one schedulable step fanning out to child `regatta_races`. Series = many steps; regatta-weekend = one step.

**D35. Rolling a calendar forward re-anchors by recurrence rule, not a naive date offset.** Cloning last season into this season shifts each step **by its recurrence (snap races back to their weekday/ordinal: "first Saturday of October"), not by +364 days**, which would drift the weekday. The clone copies `is_race`, course, and series linkage; resets `status` to pending; and drops results + `regatta_race_id` (fresh scoring rows per D33). Admin bulk-clone is legitimate here — the "Plan is a menu, never bulk-adopt a season" rule governs a *member's personal timeline*, not the org's canonical calendar.

---

## Implementation order (recommended)

From the design spec, recommended rough order for engineering:

1. Voice-first capture for step During tab (~1 week build)
2. State of Mind iOS Health integration (~1 week)
3. Capability sparkline visualization (~1 week)
4. Step Before/During/After architecture per spec
5. Playbook with concept ingestion from reflections
6. Path subscription and adoption flow
7. Author dashboards and mentorship surfaces
8. Reflect tab
9. Discover redesign
10. Institutional onboarding

---

## End

This log was created May 12, 2026. The redesign session that produced it spanned May 11-12. Future updates to decisions should be appended with date.
