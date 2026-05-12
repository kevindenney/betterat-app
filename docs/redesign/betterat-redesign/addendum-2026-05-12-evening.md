# BetterAt Redesign — Addendum, May 12 2026 (evening)

This addendum extends `betterat-redesign-spec.md` and `decisions-log.md` with new design work and decisions made after the initial save.

---

## 1. Local knowledge maps (new architectural element)

### What it is
Places-as-concept-nodes. Structurally identical to playbook concepts, but the unit is a *place* rather than an *idea*. A racing venue (Victoria Harbour, Marblehead's outer racing area), a golf course (or a specific hole on a course), a clinical site (the cardiac unit at Hopkins), a market (Hatia haat), a skate spot — each becomes its own entity that accumulates:

- Synthesized understanding in user's voice (drawn from reflections that occurred there)
- Specific named observations pinned to map locations (the eastern shore eddy, the wind shadow behind Lamma)
- Conditions observed over time (wind patterns by season/time of day, current behavior, tidal correlations)
- Linked resources (a coach's video on this course, a tactical guide to this harbour)
- Open questions about the place
- Patterns AI surfaces from the user's writing here
- Other users' shared observations (in cohort or published context)
- Source reflections that contributed

### Connections to other surfaces

**On a step's Where field**: map picker. Anchors the step geographically. The step now feeds the place's knowledge along with the user's playbook concepts.

**On a step's Before tab**: "From this place" surfaces relevant accumulated knowledge. "You've raced here 14 times. The wind has built from 8 to 14 knots between 11am and 2pm in 9 of those 14 races."

**On a step's After tab**: "Add to this place's knowledge" affordance. The user can elevate a specific finding from their reflection to place-level. Visible whenever they plan a step at this location.

**In the playbook**: places appear as concept-equivalent entities. Separate sub-section or integrated with Concepts (with place/idea distinction).

**In Discover**: map view of *other people's published places* — where Stuart sails, what Hugo Wong has published about Victoria Harbour.

### Sharing models
Same four levels as concepts: private (default), cohort-shared, collaborative, published.

### Why this matters
Local knowledge is the difference between competent and expert across many domains:
- **Sailing**: visiting crews flying to Hong Kong Worlds need exactly this knowledge
- **Golf**: a regional academy accumulates course knowledge across all their students' rounds
- **Skateboarding**: spot knowledge (which loading docks, what times, what security)
- **Nursing**: place-specific clinical knowledge ("third-floor cardiac unit runs short Thursday evenings")
- **Development contexts**: market knowledge, buyer relationships, seasonal price patterns

The product holds this in a way no other product does — anchored to actual physical locations the user practices in.

### Domain examples of places-as-concepts
- Sailing: Victoria Harbour racing area, Aberdeen Channel, Marblehead outer area, specific marks and laylines
- Golf: each hole on each course; the practice green; the tee box at the 7th
- Nursing: specific units, specific patient rooms (with care — privacy-aware aggregation)
- Drawing: museums and galleries you draw at, life drawing studios, outdoor sketching spots
- Skateboarding: specific spots with names, parks, sequences of features
- Knitting: stores you source yarn from, knit groups that meet specific places
- Rural livelihoods: markets, suppliers, federation meeting places

---

## 2. Topic chips per interest — defined vocabulary

Curated 8-10 topics per interest. These drive Discover → Paths filtering and tag authored content. Editorial — the product maintains them. Authors tag paths with up to three topics.

**Sail Racing**: Heavy air · Starting · Tactics · Boat handling · Rig tuning · Crew work · Mental side · Conditions reading · Mark roundings · Equipment

**Nursing**: Assessment · Clinical reasoning · Medication · Pharmacology · Communication · Ethics · Leadership · Populations · Acute care · Mental health

**Drawing**: Gesture · Anatomy · Edges · Value · Composition · Color · Materials · Reference work · The portrait · Sustained drawing

**Golf**: Driving · Iron play · Wedge work · Putting · Course management · Mental side · Equipment · The short game · Tournament play · Practice methods

**Knitting**: Construction methods · Yarn and fiber · Color work · Lace · Cables · Garment fit · Reading patterns · Finishing · Designing your own · Repair and rescue

**Skateboarding**: Flat ground · Ramps · Street · Park · Filming · Trick progression · Spot knowledge · Crew dynamics · Physical conditioning · Gear

The "spot knowledge" topic in skateboarding, "course management" in golf, "conditions reading" in sailing all tag places — connecting topic chips to the local knowledge map architecture.

---

## 3. Institutional analytics dashboard

**Purpose**: gives institutional buyers (JHU, RHKYC, PRADAN) aggregate view of cohort development without violating individual privacy.

**Three legitimate aggregate visibility layers**:

1. **Cohort engagement health** — active counts, reflection counts, path ratings, stalled count. Aggregate only.
2. **Conceptual development at scale** — for each tracked concept in the curriculum, what fraction of the cohort has developing understanding. Surface gaps where understanding is underdeveloped relative to curricular intent. Surface where curriculum is working.
3. **Author effectiveness** — for institutional authors, do their paths produce the conceptual development they intend. Author-level metrics with author consent.

**Cross-cohort patterns surfaced**:
- Questions recurring across multiple students' reflections (signal about what curriculum may not be addressing)
- Vision language shifting across the cohort (early "help people" → later "be the kind of nurse who notices the patient who can't speak for themselves")

**What dashboard never shows**:
- Individual student reflections
- Individual playbook contents
- Individual Vision text
- Individual capability states
- Anything identifying an individual student

Faculty mentors see specific students through their own author dashboards. Institution sees only forest, not trees.

---

## 4. Path detail page

The surface a user sees before subscribing. High conversion stakes.

**Structure**:
- Path title in serif
- Author block: avatar, credentials, editorial "this path is for" line
- "What this path is" — author's editorial introduction in serif (2-3 paragraphs)
- Step listing (week-by-week)
- Building toward (capability schema)
- "What subscribers say" — reviews from completed subscribers
- "What you commit to" — clear expectations
- Pricing displayed prominently
- Subscribe and Save for Later actions

**For multi-author paths**: each author block. Per-step authorship via avatar chips on the step listing.

**For institutionally sponsored paths**: institutional sponsor block with square-avatar treatment.

**Reviews architecture**: subscribers can review after 80% completion or formal finish. 5-star + optional written review. Public on path detail. Authors can respond. Platform moderation for abuse.

---

## 5. Other design decisions resolved (without separate mockups)

### Surfaces

- **Vision composition flow**: triggered 7-10 days after user joins. Voice-first, single prompt. No editing pressure. Subsequent revisions are rare, deliberate, user-initiated from Reflect.
- **Review composition (annual / path-completion)**: same architectural pattern as step After tab. Three-section prompts. AI scaffolds with relevant content from the period.
- **Post-event integration / "trophy of becoming"**: auto-generated artifact combining Vision, path framing, key reflections, capability progressions, mentor commentary, concepts that formed. Navigable single artifact. Shareable as read-only link.
- **Faculty onboarding**: 5-7 min flow. SSO → profile confirmation → path authoring walkthrough → claim drafts or fresh start → cohort connection.
- **Student onboarding**: 3-4 min flow. SSO → profile → specialization track → subscribe to required paths → notification preferences → land on Practice tab.
- **Institutional admin ongoing dashboard**: desktop surface, tabular interfaces. Manages faculty roster, cohorts, path approval, analytics roles, billing.
- **Forum design**: top-level forum → threads → replies. Threads attachable to specific path steps. AI surfaces "this question was asked recently." Limited reactions (thanks, this helped me).
- **Search results**: cross-product, grouped by type (Paths · People · Orgs · Concepts · Forums · Your reflections). Voice query supported.
- **Concept detail page**: full view with editing affordances (rename, merge, split, sharing scope, edit synthesized understanding).
- **Resource detail in playbook**: user's notes, concepts linked, reflections that referenced it, progress through it.
- **Long-press context menu on steps**: native iOS sheet. Reschedule · Edit · Mark didn't happen · Hide · Share · Delete (with confirmation).
- **Cross-language community**: deferred to deployment. Architecture: voice notes carry language metadata. AI translation within cohorts with permission.
- **Year view of timeline**: grid view (rows = months, columns = weeks, steps as colored dots). Lives in Practice tab view-mode toggle.
- **Step versioning when authors update**: subscribers see notification in affected step. Options: read changes, re-adopt, keep existing. Default: keep existing.
- **Cross-path step composition**: "Combine steps" affordance in picker. Shows both authors' avatars on the resulting step.
- **Concept merging and splitting**: from concept detail page. Reversible for 30 days.
- **Step-level evidence linking**: evidence items linkable to specific reflection moments. Can carry forward as reference to future steps.
- **"Step happening now" affordance**: when anchor time arrives within 15 min, default tab shifts to During. Optional full-screen overlay prompting capture mode.

### Architecture

- **Voice-first across the product**, not just development contexts.
- **Path forking**: personal yes (free, one-tap, drafts), institutional no, author-published configurable.
- **Refunds**: 14-day platform-level standard. No author-custom policies.
- **Author tiers**: free path (no platform cut, author keeps contact), paid path (80/20), paid + premium 1:1 (80/20 on both). Institutional authors paid by institution.
- **Household privacy**: app hiding, payment obscurity, no-auto-play voice notes, no-preview notifications.
- **Long-running steps**: parent step with duration, child sub-step per day for daily content.
- **Premium Stripe**: one-time + subscription, independently cancellable.
- **Reviews**: after 80% completion. 5-star + written. Public on path detail. Author response possible.
- **Discover curation**: editorial featured paths weekly. Quality floor indicator below 3.5 rating from 5+ reviews. "New" badge for 30 days.
- **Capability tracking suggestion**: AI prompts in After tab when patterns warrant. One tap confirm.
- **Author step updates**: subscriber notification, three options, default keep existing. Author can mark "important — recommend accepting."

### Smaller decisions

- **Now bar**: ticks smoothly during a session.
- **Bell icon**: always visible, dot indicator (not count) when new.
- **Hinge between steps**: always during transition, expands on pause, passes through on quick swipe.
- **Check mark on completed steps**: implicit from reflection-completion.
- **Capability arc edge cases**: plateaued = flat line, no judgment. Regressed = drops, gentle surfacing. Stagnant = short flat line, AI can suggest re-engagement if user wants.
- **Vision evolution annotations**: AI-drafted default, user-editable before saving.
- **Reflect tab name**: final.
- **Push thresholds**: author commentary on you specifically, scheduled step within 30 min, premium 1:1 message. Everything else: inbox.
- **Notification grouping**: same source within 24 hours batches into one expandable inbox entry.
- **Mute / snooze**: long-press notification. Mute path or snooze N hours/days.
- **Email digest**: weekly Sunday morning. Opt-in, default off.
- **Save for later location**: playbook Drafts section.
- **Voice on date selection**: yes, NLP-parsed.
- **Photo/video evidence carry forward**: yes, linkable from future step as reference.
- **Cohort visibility of pre-race analyses**: private by default.
- **Path author visibility of pre-race analyses**: private by default.

### Strategic / Commercial

- **Pricing**: consumer per-path one-time ($40-500, 80/20); institutional per-active-user-per-month negotiated; development context $1-5 per beneficiary per month.
- **LMS-thinking positioning**: "relationship-based learning that scales mentor attention." Not "LMS replacement."
- **Institutional onboarding**: dedicated specialist for first 3 months. Workshops with faculty. Path translation assistance.
- **Course migration tooling**: 3-month build for Canvas. 1 eng + 1 designer + 1 PM. Other LMS systems in future releases.
- **Development sector**: per-beneficiary fees paid by program funders (state, central govt, bilateral, multilateral). NRLM scale is 90M+ rural women.
- **Author IP**: authors own content. Platform licensed to host while authored. Export on leave. Subscribers transfer if author migrates.
- **Author career paths**: solo → reputation → multi-path → institutional licensee. Platform supports each stage.
- **Paths and playbooks share data structures**: yes. Path = published, structured, sequenced playbook with curated access policies. Internal: one schema with role flags.

---

## 6. New mockups added (this session)

- Local knowledge map / place detail (Victoria Harbour) — `mockups/17_betterat_place_detail_victoria_harbour.html` (referenced — recreate from chat transcript)
- Institutional analytics dashboard (JHU) — `mockups/18_betterat_institutional_analytics_jhu.html` (referenced)
- Path detail page (Stuart's intensive) — `mockups/19_betterat_path_detail_stuart_intensive.html` (referenced)

Like the prior continuation-session mockups, these are described in the spec/addendum but not yet saved as standalone HTML — see the conversation transcript for full widget code.

---

## 7. What's still unresolved

Most of the big architectural questions are now answered. Remaining work is implementation, not design:

- Actual engineering of voice-first capture infrastructure
- AI prompt engineering for high-stakes surfaces (synthesized understanding, long-arc concept evolution, plan-vs-outcome comparison)
- Stripe Connect integration for author payouts
- Canvas migration tooling
- Search infrastructure
- Localization pipeline for non-Latin scripts
- Performance optimization for low-bandwidth contexts
- Authentication via institutional SSO (SAML/OIDC)

These are real engineering surfaces but not design surfaces. The design is sufficient for engineering to begin.
