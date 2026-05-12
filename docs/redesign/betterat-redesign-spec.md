# BetterAt — Redesign Specification

A design document covering the architecture, surfaces, and decisions produced during the redesign session of May 11–12, 2026. Reference-altitude. Read alongside the mockups directory and the decisions log.

## Status

This document captures the *intended product* as designed. It is not a description of what's built. The current codebase is on the `audit/codebase-recon` branch with demo blocker fixes shipped on `fix/demo-blockers-day1`. The work described here is the redesign target.

---

## 1. The product, in one paragraph

BetterAt is a journaling-like product about *becoming*. Users practice something they care about (sail racing, nursing, drawing, knitting, livelihood improvement) and the product holds their practice across time. The user captures moments of practice as *steps*. Each step has structured Before / During / After. Reflections feed a *playbook* of evolving conceptual understanding. Users follow *paths* authored by experts. Path authors mentor at scale via AI-surfaced patterns plus direct commentary. The product is for individuals, but its commercial model is institutional sponsorship (clubs, schools, hospitals, NGOs, state programs).

The product's tone is quiet, serious, with reverent undertones. The visual language is serif (Lyon Display or similar) for first-person voice and sans (Söhne) for system chrome. Generous whitespace. No red treatments, no "Overdue" affordances, no celebration animations, no gamification.

---

## 2. Core architecture — five layers

### 2.1 Interests
The user's identity layer in a domain. Sail Racing. Nursing. Drawing. Knitting. Each interest defines:
- Vocabulary engine (Race vs. Clinical vs. Studio vs. Session)
- Default capability schema for the domain
- Visual register specific to the domain
- What "a step" means
- The community pool

A user has one or more interests. Interests are durable and often lifelong.

### 2.2 Paths
Curated journeys authored by named people or institutions. Live inside interests. A path:
- Has one or more authors (multi-author and institutional sponsorship supported)
- Defines a sequence of step templates
- Can declare a parent path (specialization — e.g., the RHKYC local path specializes Kevin's worldwide path)
- Has visibility scopes (public, cohort-only, invitation-only)
- Tracks a cohort of subscribers
- Has pricing access (free, free-for-group, paid, institutional)

Users subscribe to zero or more paths. Subscribing establishes a *relationship*, not just content access — the author can read your reflections by default.

### 2.3 Steps
The user's commitment to a moment of practice — past, present, or future. Steps are vessels of becoming. They are anchored in time. They have three tabs:

- **Before**: planning, intention-setting, pre-race/pre-session analysis
- **During**: live capture (voice-first), evidence, notes
- **After**: reflection, plan-vs-outcome comparison, capability updates, questions, carry-forward

Steps can be solo or shared. Shared steps are one entity with multiple participants. Each participant has their own private content within the shared step (their own reflection, their own evidence) and accesses the shared content (conditions, fleet results, findings, author commentary).

Steps are never marked "done" with a button. Completion is inferred from temporal passage plus the presence of a reflection.

### 2.4 Capabilities
Abilities the user is building. State-based with progressions:
- learning → practicing → breakthrough

Capabilities are tracked at the user level, with attribution to which paths invoked them. A user has one "heavy-air technique" capability accumulating across all paths that touch it, with one count of total sessions and one progression history.

Capabilities are inherited from path step templates but the states are personal.

### 2.5 Concepts
Ideas the user is understanding. Distinct from capabilities. Concepts live in the playbook and have:
- Synthesized current understanding (in the user's voice, AI-assisted)
- Linked resources (books, videos, articles)
- Open questions
- Patterns across reflections
- Source reflections that contributed
- Connections to other concepts
- A history of how the understanding evolved
- Sharing scope (private / mentor-readable / collaborative / published)

The architectural insight: **capabilities are what you can do; concepts are what you understand**. Both matter. Steps feed both.

---

## 3. The three units in relation

Each step touches three things:
- It is a step (a moment in time, with planning and reflection)
- It builds toward capabilities (which progress because of it)
- It feeds concepts (which deepen because of it)

This is the architecture of becoming. The user practices, builds abilities, deepens understanding. The product makes all three legible and weaves them together.

---

## 4. Navigation — four tabs

The bottom navigation has exactly four tabs. The Learn tab was eliminated because it represented LMS thinking parallel to (and weaker than) the path/playbook system.

### 4.1 Practice (Clinical / Race / Studio — adapts to interest)
The timeline of steps. The zoomed-in swipe-native interface where execution happens. Horizontal swipe between adjacent steps; vertical swipe between Before/During/After within a step. Pull down to zoom out to the timeline overview.

### 4.2 Playbook
The user's conceptual home base. Vision at top. Concepts, Resources, Patterns, Reviews, Q&A as sub-sections. Recent sessions feeding the playbook. AI Suggestions queue. Raw Inbox. Shared with. Inherited from. This is where the user works on their evolving understanding.

### 4.3 Discover
Finding new paths, people, orgs, conversations. Four sub-tabs:
- **Paths** (primary destination, with topic chips, curated suggestions, cohort signal, authoring nudge)
- **People** (authors, peers, mentors)
- **Orgs** (institutions, clubs, schools, non-profits)
- **Forums** (ongoing conversations)

Interest filter pinned at top, filtering all sub-tabs. Topics within an interest are curated (6-10 per interest) and surface as horizontal pills.

### 4.4 Reflect
Long-arc retrospection. Vision evolution. Capability arcs over time. Moments returned to. AI-synthesized accounts of how thinking has shifted. The Review composition surface for major retrospectives (annual, path completion). Different visual register from the rest of the product — more serif, more whitespace, more contemplative.

---

## 5. The step in depth

### 5.1 Before tab
Planning surface. Composition-style with named fields:
- **What** — title in serif (often AI-drafted from a forward-looking sentence in a past reflection, editable)
- **When** — date pills (suggested dates with reason, "pick date" escape)
- **Why** — personal intention, often pulled forward from the user's own past reflection
- **Building toward** — capability chips (inherited from path step, user can add)
- **How** — prep steps (path-author-suggested, user-editable)
- **Who** — crew/participants
- **Where** — location
- **From the path** — author's framing block (for adopted path steps)
- **Pre-event analysis** — for races/major events, AI-generated multi-section analysis grounded in user's history (Start, Upwind, Downwind, Rig tune for sailing). Source chips show inputs. Voice query affordance ("Hold to ask Tempest's record").

### 5.2 During tab
Live capture. Voice-first. Single big "Hold to speak" button. Running log of session. Evidence capture (photos, videos, GPS, voice notes). Minimal chrome — the user is in the moment, not configuring.

### 5.3 After tab
Reflection. The main reflection in serif. Evidence ("On the boat" / "In the studio" / "At the bedside"). For pre-planned steps, AI-generated "Plan vs. what happened" comparison in freeform prose. Pattern tracking across reflections ("Third time this question has come up"). Socratic questions to sit with. Voice answer affordance. Carry-forward section showing AI-extracted forward intentions, with cards for each. Share affordances with path author / cohort. Capability shifts visualized as sparklines.

### 5.4 Step adoption from a path
When a user adopts a path step, the composition sheet pre-populates with path-author content but separates the author's voice from the user's:
- "Author's framing for this step" — quoted block with attribution
- "Your why (optional)" — user's personal intention layered on top
- Suggested how-steps from the author (checkboxes, user can edit)
- "Who's joining" — fleet adoption signal
- Path step can be scheduled (fixed date, author-determined) or flexible (user picks)

### 5.5 Shared steps
One step entity, multiple participants. Each participant has:
- Their own Before / During / After tabs (private by default)
- Their own reflection and evidence
- Access to step-level shared content (conditions, fleet results, author commentary)
- Optional: "What we found" collaborative findings section (for speed-tunes, group simulations)
- Optional: "Share with cohort" or "Share with fleet" to elevate private findings

For fleet-scale shared steps (15-boat races, full nursing cohort sims):
- Race results as step-level data
- AI pattern detection across reflections ("8 of 15 boats wrote about overstanding")
- One authorial response lands on all participants' surfaces

### 5.6 Step ordering and timeline mechanics
- Steps order chronologically by anchor time
- Future steps with flexible dates live as drafts in the playbook until scheduled
- Long-running steps (regattas, rotations) occupy a span on the timeline
- Steps that occurred at a different time than scheduled update their anchor time; original schedule preserved as metadata
- Multiple steps in close proximity appear in actual order with shorter inter-step "hinges"

### 5.7 Step transitions (timeline navigation)
- Horizontal swipe between adjacent steps: swipe left to move forward in time, swipe right to move backward
- A hinge appears between steps during transition showing temporal distance ("3 days") and what happened between (author notes, playbook events, forecast updates)
- For short gaps the hinge is minimal; for long gaps it becomes richer
- Pull down on a step expands to timeline overview

### 5.8 Step completion
No "Mark as Done" button. State is inferred from:
1. Anchor time has passed
2. A reflection exists (even a brief voice note)
3. AI processing has fed playbook

Visual signals: check mark, "reflected" status pill, muted opacity on timeline.

### 5.9 Step deletion
Three different actions:
- **Remove from timeline** — future steps only, deletes the step entirely
- **Mark didn't happen** — preserves planning record, removes from reflection prompts
- **Archive** — past steps, hidden from default view but recoverable
- True deletion of past step with reflections is buried in settings, intentionally high-friction

For shared steps: cannot delete for others. Can *leave* the shared step (remove your participation) or *hide from my timeline*.

### 5.10 Now bar
A horizontal line on the timeline overview labeled with current timestamp. Anchors the default view. Indicates the live step if one is happening. Marks state transitions as it crosses step anchor times. Non-interactive — temporal landmark only.

---

## 6. The playbook in depth

### 6.1 Vision
Top of the playbook. The user's deepest "why am I practicing this." Read by the AI to shape suggestions across the product. Written once, revised rarely (Felix revised three times in 14 months). Private by default — even when other content is mentor-readable, Vision stays personal.

Versions preserved with provenance. Reflect tab shows the evolution.

### 6.2 Concepts
The user's evolving understandings. Each concept has:
- Name (often AI-proposed, user can rename)
- Synthesized understanding paragraph (in user's voice, AI-assisted from multiple reflections)
- Linked resources (with the user's notes on each)
- Open questions
- Patterns across reflections that touch the concept
- Source reflections (chronological list)
- Connections to other concepts
- Sharing scope

Concepts can be merged, split, renamed by the user. New concepts are AI-proposed when patterns emerge across multiple reflections; user approves or declines.

### 6.3 Resources
Books, videos, articles, podcasts the user has saved. Linked to concepts. Have user notes attached. Surfaced in step Before tabs when relevant.

### 6.4 Patterns
AI-surfaced correlations across the user's writing. ("Your breakthroughs cluster at 14+ knots." "Mark roundings show up in nine of your last twenty reflections.")

### 6.5 Reviews
Weekly, monthly, annual retrospectives. Weekly reviews are playbook-resident. Annual and path-completion reviews are composed in Reflect.

### 6.6 Q&A
First-class open questions. Questions hang open until answered by a future reflection, a resource, a mentor response, or a deliberate "answer" entry. The product tracks how long questions have been open and surfaces patterns ("Third time this question has come up").

### 6.7 Raw Inbox
Dump zone for unprocessed material. Voice notes, links, photos, text snippets. Always private. The user processes the inbox into concepts/resources at their pace. The AI can suggest processing but doesn't auto-route.

### 6.8 Recent sessions
Feed of reflections from steps. Shows what's been feeding the playbook recently.

### 6.9 Suggestions queue
AI-generated suggestions: weekly review prompts, focus suggestions, new concept proposals, question identification. User-approved before they enter playbook structure.

### 6.10 Ask your Playbook
AI-powered semantic search across the user's entire playbook content. Voice or text. Answers in the user's own voice (synthesized from their writing) with citations to source reflections and resources.

### 6.11 Playbook ingestion after a reflection
After the user finishes a step's After tab, the AI processes the reflection and proposes:
- Additions to existing concept(s) — with extension context noting what's resolved/unresolved
- New concept suggestions — with source reflections shown for transparency
- Question identification — added to Q&A if user approves
- Resource notes prompts — if a resource was linked to the step but no notes captured

User approves all at once or decides individually.

### 6.12 Playbook sharing — four levels
- **Private** (default) — Vision, Raw Inbox, unpublished concepts, reviews
- **Read-only mentor access** — path authors get this by default at subscription
- **Collaborative** — co-edit specific concepts with another user
- **Published concepts** — specific concepts made findable to a wider audience; others can read and link from their playbooks

Sharing is per-element, not per-playbook. Granular control.

### 6.13 Cross-interest playbooks
Separate playbooks per interest. A user with Sail Racing and Drawing has two playbooks. The interest picker at the top of the playbook switches between them.

---

## 7. The path system

### 7.1 Authorship
Paths are authored by named entities. Can be:
- Solo human author (Emily authoring her knitting path; Stuart Childerley authoring heavy-air helm work)
- Co-authored by multiple humans (Patricia and Linda's MSN Capstone path)
- Institutionally sponsored (JHU as the institutional author; specific faculty as named contributors)

Co-authored paths show per-step authorship via avatar chips on the step listing — students know whose voice they'll hear in which step.

### 7.2 Author profile
Each author has:
- Avatar, name, credentials
- Editorial line about who they're authoring for
- Subscriber count
- Reputation (rating, reviews, completion signal)

### 7.3 Path detail page
Before subscribing, users see:
- Path title in serif
- Author block(s) with credentials and editorial contribution
- Institutional sponsor block (if any) — square avatar visual treatment
- "What this path is" — editorial introduction
- Building toward (capability schema)
- The N weeks (step listing with per-step authorship)
- A note from the author(s) — joint statement
- Subscribe action with disclosure of what subscription includes

### 7.4 Path hierarchy
A path can declare a parent path (specialization). Sam's "Hong Kong Dragon fleet — Worlds preparation" specializes Kevin's "Worldwide Dragon improvement." Felix on the local path inherits worldwide content plus local additions. The hierarchy is visible on path cards ("specializes" badge, "parent of your local path" status line).

### 7.5 Path step templates and adoption
Path steps are templates. When a user adopts a path step, an instance is created on their timeline. The template lives on the path; the instance lives on the user. Template updates can propagate to instances (with notification).

Path steps can be:
- **Scheduled** — author-determined date, fleet-coordinated
- **Flexible** — user picks date

### 7.6 Path authoring flow
Accessible from the playbook ("you've accumulated material on this — author a path?") or from settings. Composition surface includes:
- Title, "what this path is" (in author's voice)
- Step structure (incrementally drafted; can publish incomplete)
- Building toward (capability schema)
- Pricing (free, paid one-time, paid subscription, institutional)
- Disclosures of what publishing entails (read-only subscriber access, commentary expectations, update propagation)

### 7.7 Path pricing models
- Free (community paths, institutional paths)
- One-time fee (Emily's $40 knitting path)
- Subscription (rare; for ongoing high-touch paths)
- Institutional license (the institution pays per-beneficiary fee; users don't pay)
- Free with optional premium 1:1 tier ($15/month for direct messaging and monthly calls)

Platform takes 20% on paid paths; author keeps 80%.

### 7.8 Path forking
Personal forking (a subscriber adapts a path for their own use) is allowed. Institutional path forking (modifying JHU's published path) is not.

### 7.9 Path completion and the trophy of becoming
After a path completes (Felix finishes Stuart's 6-week intensive; Emily graduates MSN), the Reflect tab generates a "what you took from this path" surface — pulling key reflections, capability progressions, mentor commentary, breakthrough moments. Navigable, sharable. Distinct from but related to annual review.

---

## 8. Cohort and mentorship

### 8.1 Cohorts
Users on the same path form a cohort. Cohort dynamics:
- See each other's pre-event analyses (if shared)
- See each other's published reflections
- See each other's published concepts
- Forum discussion
- Shared steps (fleet races, group sims) create dense cross-participant interaction

Cohort visibility defaults are conservative — most reflections are private until explicitly shared.

### 8.2 Three modes of mentorship
- **Authorial commentary at pattern level** — author reads AI-surfaced cohort patterns, writes one response landing on all relevant participants
- **Direct response to individual reflection** — author leaves note on a specific subscriber's step
- **Premium 1:1 tier** — direct messaging plus monthly video calls; paid extra

### 8.3 Author dashboard
For path authors. Shows:
- Cohort overview (subscribed count, active this week, completion stats, rating)
- Earnings (current month, trend)
- "Where your attention helps most" — AI-surfaced patterns with action affordances (write cohort note, update specific step)
- Unanswered questions across cohort
- Per-subscriber state (active, finished, stalled with days inactive, new reflection awaiting attention)
- Premium subscribers separately tracked (call due dates, last contact)

### 8.4 Institutional mentor relationships
Path authors get read-only access to subscribers' playbooks by default. Subscribers are informed at subscription time. The relationship is the value of the path — subscribers pay for the attention, not just content.

For institutional paths (JHU, RHKYC, PRADAN), the institution sets policy. JHU faculty have read-only access to JHU students' playbooks within the institutional cohort.

---

## 9. Orgs

### 9.1 Org types
- Schools / educational institutions (JHU, Hopkins School of Nursing)
- Hospitals (Hopkins Hospital, HCH)
- Clubs (RHKYC, Aberdeen Boat Club, NYYC)
- Non-profits (Health Care for the Homeless, PRADAN)
- Professional bodies (AACN)
- State/national programs (NRLM, JSLPS — for development contexts)
- Businesses (rare; mostly for B2B paths)

Each type has appropriate relationship affordances (join, follow, apply, request, member-only access tiers).

### 9.2 Org pages
Each org has a detail page with:
- Identity block (logo, name, type, location, key facts)
- "Your relationship" block (your status, primary action affordances)
- Paths published by the org (with access tiers visible: free, member-only, paid, sponsored)
- Events and racing (for clubs)
- Volunteer/student opportunities (for non-profits)
- Members you might know (social proof)
- Forums (with appropriate access tiers)
- Resources published by the org

### 9.3 Multi-layer institutional context (development scenarios)
For users in scenarios like rural Indian women's livelihoods, the org page surfaces the full layered support structure:
- Self-help group (SHG) at the village level
- Village Organization (cluster of SHGs)
- Implementing NGO (PRADAN)
- State mission (JSLPS)
- Central program (NRLM)

This layered visibility is *empowerment through legibility* — users navigate the multi-layer system more effectively when they can see it.

### 9.4 Institutional sponsorship visual language
Institutions use square-cornered avatar treatment, distinct from round avatars for humans. Institutional sponsor blocks appear on paths they sponsor.

---

## 10. AI integration principles

### 10.1 What AI does (invisible infrastructure)
- Voice transcription with light cleanup
- Semantic search across user's archive ("Ask your Playbook")
- Synthesizes "your evolving understanding" of concepts in user's own voice from multiple reflections
- Pattern detection across cohort/fleet ("8 of 15 wrote about overstanding")
- Conditions extraction from voice notes
- Pre-event analysis grounded in user's history
- Post-event plan-vs-outcome comparison
- Concept extraction and proposal of new concepts (user approves)
- Question identification from reflections
- "Where your thinking has shifted" — long-arc conceptual evolution synthesized as prose
- Author dashboard pattern surfacing
- Curation of "moments you've returned to"
- Pre-population of step composition from forward intentions in past reflections

### 10.2 What AI never does
- Speaks as itself ("I think you should...")
- Writes reflections for the user
- Writes mentor responses
- Has a chat surface
- Generates "AI coach" character or persona
- Asserts facts without source provenance

### 10.3 The principle
AI does work that makes the user's own thinking more navigable. Never substitutes for the user's voice or the mentor's voice. The user's words are the user's words. The mentor's words are the mentor's words. AI is the librarian and the assembler.

---

## 11. Tone, typography, and visual language

### 11.1 Tone register
Quiet, serious, with reverent undertones. The product treats the user's becoming with weight. No celebration animations, no streaks, no gamification, no engagement tricks.

### 11.2 Typography
- Serif (Lyon Display or equivalent) for first-person voice (user reflections, Vision, mentor commentary, concept understanding)
- Sans (Söhne or equivalent) for system chrome, labels, metadata
- Generous leading
- Larger sizes than typical product UI (17px+ for body serif, 28-36px for headings)

### 11.3 Localization commitments
- Hindi (and other languages) get the same typographic seriousness — Devanagari serif treatment with proper designed typefaces
- Right-to-left languages handled with proper directional layout
- Localization is not a translation overlay; it's a full visual register adaptation

### 11.4 Voice as primary input modality
Voice is treated as a first-class primary input across the product, not a fallback. Big microphone buttons. Voice for composition, voice for queries, voice for answering AI questions. The Hindi context made this explicit but the principle holds globally.

### 11.5 Whitespace
Generous. The product breathes. Sections are separated by ~28-32px padding. Within sections, items are separated by ~14-22px.

### 11.6 Color
Neutral palette. The product uses light backgrounds with subtle grays. No bright accent colors as a default. Status pills use muted backgrounds. No red treatments for errors or warnings — language carries weight, color does not.

### 11.7 No emoji, sparingly
The product does not use emoji as decoration. Icons (Tabler-style line icons) carry meaning sparingly.

---

## 12. Cross-domain adaptation

The architecture has been stress-tested across:

### 12.1 Sail racing (primary design context)
- Tom Aldred in Marblehead, Kevin Denney's worldwide path
- Felix on Pegasus in Hong Kong, Sam North's local path with Kevin's parent
- Conditions (wind, water, tide, sky) as first-class step content
- Boats as named entities with multi-year history
- Fleet results as step data
- Two-boat speed-tunes and 15-boat fleet races as shared steps

### 12.2 Nursing (institutional context)
- Emily as MSN student at JHU
- Patricia and Linda's co-authored MSN Capstone path
- JHU as institutional sponsor with square-avatar visual treatment
- Rooms and cast as domain-context blocks (replacing wind/water/fleet)
- Academic resources, clinical guidelines, AACN frameworks as resources
- Group sims as shared steps with shared findings + individual reflections

### 12.3 Drawing (solo practitioner context)
- Maya as solo artist
- Self-certified capabilities (not mentor-certified)
- Aesthetic concepts (gesture, negative space, edge quality)
- Visual evidence as primary content
- Mentor as voluntary peer follow, not structural authority
- Mostly private playbook with selective concept publishing

### 12.4 Golf (data-rich context)
- David as serious club golfer
- Coach as path-author equivalent
- Courses as concept nodes with accumulated local knowledge
- Data-rich step content (scorecards, GPS, video)
- Tournament rounds as race-equivalent events

### 12.5 Knitting (consumer authorship context)
- Emily Watson authoring "Your first child's cardigan, top-down" — 6 weeks, $40
- Path-author tooling for individuals (not institutions)
- Author dashboard for 14 subscribers
- Premium 1:1 tier at $15/month
- Authorship emerging from accumulated playbook

### 12.6 Rural Indian livelihoods (development context)
- Sunita near Ranchi, Jharkhand, lac bangle home business
- Hindi as primary language with proper Devanagari typography
- Voice as primary input
- Offline-first with sync-when-possible
- SHG → VO → PRADAN → JSLPS → NRLM as layered institutional support
- Free at user, institutionally sponsored (state government pays)
- CRP (Community Resource Person) as one-to-many mentor; SHG anchor woman as peer mentor
- Practical concepts (production techniques, market pricing, credit cycles)
- Mudra loans, PM Vishwakarma, e-Shram surfaced as actionable benefits

The architecture remains identical across all. Content, language, pricing, connectivity, mentor structure, and visual register adapt per context.

---

## 13. Commercial model

### 13.1 Consumer paid paths
$40-500 per path, one-time. Authors keep 80%, platform takes 20%. Optional premium 1:1 tier ($10-30/month subscription on top of base path fee).

### 13.2 Institutional licensing
Schools, clubs, hospitals license the platform for their cohorts. Per-beneficiary monthly fee (e.g., $X per active student per month). Institution gets:
- Branded org page with their paths
- Institutional sponsorship attribution on faculty paths
- Cohort-level analytics
- Author tooling for faculty
- Admin tooling for cohort management
- Forum hosting

### 13.3 Development sector licensing
State and national rural development programs (NRLM-equivalent in other countries), NGOs (PRADAN-equivalent), bilateral donors (USAID, FCDO, GIZ), multilateral institutions (World Bank, UN agencies). Per-beneficiary fees, often paid by the state or donor, not by users.

### 13.4 Author economy
Individual authors build reputation across their paths. Subscriber counts, ratings, completion rates accumulate as author reputation. Successful authors can license to institutions.

### 13.5 No advertising
No ads in the product. No promoted content. No engagement metrics surfaced to users.

---

## 14. Inbox and notifications

### 14.1 Notification principle
Notifications should be significant moments worth interrupting for. Not "Mei replied to your reflection" — that can wait. "Kevin wrote a fleet response that mentions your overstand pattern" — that's worth surfacing.

### 14.2 What warrants a notification
- Authorial commentary on you or your cohort
- A shared step coming up (day-before reminder)
- A reflection overdue but unwritten (once per step, gentle)
- Direct connection request (peer follow, mentor message)
- Significant playbook insights (batched into daily/weekly digest, not push)

### 14.3 What does not
- Every reflection from every cohort member
- Daily activity summaries
- Streak shaming or engagement nags
- Marketing messages

### 14.4 Inbox surface
"For your attention" framing. Sub-sections:
- From your path authors
- From your cohort
- From your playbook
Quiet design. No badge counts on individual items. Notification settings card explains defaults transparently.

### 14.5 Push vs. inbox
Push notifications are a small subset (author commentary on you specifically, scheduled step starting now). Most notifications live quietly in the inbox until the user looks.

### 14.6 Email digests
Weekly summaries for users who don't open daily. Optional, opt-in.

---

## 15. Reflect tab in depth

### 15.1 Purpose
The user looking at themselves over time. Different temporal mode from the rest of the product. Where the timeline runs forward, Reflect runs backward. Where the playbook works on the present, Reflect contemplates the journey.

### 15.2 Visual register
Even quieter than the rest of the product. More serif. More whitespace. Less interactive chrome. Statistics deployed in narrative sentences, not as tiles or charts.

### 15.3 Surfaces
- Reflect tab home (overview, with year-so-far framing)
- Vision evolution (timeline of Vision versions with editorial annotations)
- Capability arc detail (single capability over time)
- Concept evolution trail
- Moments returned to (AI-curated significant reflections)
- "Where your thinking has shifted" (long-arc conceptual evolution synthesized as prose)
- Annual / path-completion review composition surface
- Coming up (forward-looking acknowledgment of major events)

### 15.4 Capability arc visualization
Line drawings — not data dashboards. Thin lines, horizontal guides for state thresholds (learning / practicing / breakthrough), time on x-axis. Two endpoint dots. Empty space to the left for capabilities started partway through (with a faint baseline extension showing pre-tracking time).

### 15.5 Vision evolution
Vertical timeline with one node per Vision version. Each version shown with date, editorial framing of context, the Vision text in serif, and annotations:
- "What was on your mind" (early version)
- "What had shifted" (middle versions)
- "What you've added" (current version)
- "What stayed the same" (cross-cutting continuity)

Annotations are AI-drafted, user-editable.

### 15.6 Long-arc concept evolution
The highest-value AI work in the product. Reads across the user's writing on a topic and produces a paragraph describing how their understanding has shifted. ("In March you wrote about heavy air as a thing to survive. By August, as a thing to use. Now you write about it as the conditions where your particular technique lives.")

Provenance: "see the trail →" lets user verify by reading source reflections.

---

## 16. Discover in depth

### 16.1 Structure
Four sub-tabs: Paths (primary), People, Orgs, Forums. Interest filter pinned at top.

### 16.2 Discover → Paths
- Search bar (text + voice)
- Topic chips (6-10 per interest, curated)
- Authors you might follow (horizontal scroll)
- Curated for you this month (AI-selected based on user's capabilities, path progress, cohort signals)
- From the cohort you're in (peer activity)
- "Want to teach?" authorship nudge (playbook-readiness-based)

### 16.3 Discover → People
Author profiles, peer profiles, mentor profiles. Each with credentials, paths authored, expertise, sample published concepts, follow affordance.

### 16.4 Discover → Orgs
Institution browsing. Filterable by type (school, club, hospital, non-profit, professional body, state program). Search.

### 16.5 Discover → Forums
Ongoing conversations. Org-owned forums (JHU MSN Cohort '26), topic-specific forums (Evidence-Based Practice), open community forums.

### 16.6 Topic chips
Curated vocabulary per interest. Sailing: heavy air, starting, tactics, boat handling, rig tuning, crew work, mental side. Nursing: assessment, medication, clinical reasoning, pharmacology, communication, ethics, leadership, populations, settings. Drawing: gesture, anatomy, edges, value, composition, color.

Topics are editorial, not user-generated tags. The product maintains them per interest.

---

## 17. Institutional onboarding

### 17.1 Three phases
- Phase 1: Discovery and decision (sales-led, not product-led)
- Phase 2: Institutional admin onboarding (configuration, branding, faculty invitations)
- Phase 3: Faculty and student onboarding (individual user setup)

### 17.2 Curriculum approach options
Institution chooses one:
- **Migrate from existing LMS** (Canvas, Blackboard) — automated mapping with faculty review
- **Start fresh, one path at a time** (recommended) — faculty author paths in their own voice
- **Hold for now** — set up institutional presence, faculty explore without committing

### 17.3 What this is not (expectation management)
Explicit at signup:
- Not a replacement for LMS of record; grades, transcripts, accreditation continue in their existing system
- Not a one-to-one course copy; paths are smaller, more relational, more practice-embedded

### 17.4 Migration mapping
Course modules → path steps with weekly cadence
Lectures and readings → resources linked to step concepts
Discussion boards → forums under the org
Quizzes/assessments → reflection prompts at each step

### 17.5 Faculty onboarding (Phase 3)
Five-to-seven minute flow:
- SSO authentication
- Profile confirmation (credentials, photo)
- Path authoring tools walkthrough (a demonstration path)
- Claim migrated drafts or begin authoring fresh
- Set office hours / commentary commitment level
- Connect with cohort

### 17.6 Student onboarding
Three-to-four minute flow:
- SSO authentication
- Profile and photo
- Specialization track selection (drives recommended paths)
- Subscribe to required paths
- Notification preferences
- Land on Practice tab with first scheduled step visible

---

## 18. Resolved decisions log (key architectural commitments)

The following decisions are locked in and documented separately in the decisions log. Brief restatement here:

1. Timeline-as-narrative is the product's philosophy
2. Tone: quiet, serious, with reverent undertones
3. Three temporal step states: Before / During / After
4. Capabilities and concepts are distinct units
5. AI never speaks as itself
6. Three-layer hierarchy: Interests → Paths → Steps
7. Paths can have parent paths (specialization)
8. Paths can have multiple authors
9. Five-pillar nav was wrong; four-pillar nav (Practice / Playbook / Discover / Reflect) is right
10. Learn tab eliminated — LMS thinking parallel to the path system
11. Playbook is the user's conceptual home, not a resource library
12. Four levels of playbook sharing (private / mentor-readable / collaborative / published)
13. Path authors get read-only access to subscribers' playbooks by default
14. Voice is primary input across the product
15. Shared steps: one entity, multiple participants, individual private content within shared frame
16. Step completion is inferred from temporal passage + reflection presence, not declared
17. Horizontal swipe between steps (left = forward in time); vertical swipe between tabs
18. Pre-event analysis is a structured AI surface, not a chat thread
19. Post-event debrief compares plan to outcome in freeform prose
20. Pattern tracking spans steps and questions ("third time this question has come up")
21. Reflections feed playbook concepts; playbook concepts feed planning
22. Vision is the deepest playbook element, private even when others share
23. AI-synthesized "your evolving understanding" written in user's voice from multiple reflections
24. Institutional sponsors get square-avatar visual distinction
25. Co-authored paths show per-step authorship via avatar chips
26. Step adoption separates author's framing from user's why
27. Path step templates vs. user instances (templates can update with propagation)
28. The Now bar marks temporal landmark on timeline
29. Notifications are conservative by default; user can adjust
30. The Reflect tab uses a quieter visual register than the rest of the product
31. The architecture is universalizable across consumer, institutional, and development contexts
32. Pricing model: consumer paid (80/20 split), institutional licensing, development sector licensing
33. Coaches sub-tab eliminated from Discover; coaches are People with role context

---

## 19. Open design questions

See `decisions-log.md` for the full list of unresolved items. Summary categories:

- **Design surfaces still needed**: institutional analytics dashboard, path author dashboard for institutional context, Vision composition flow, Review composition surface, post-event integration / trophy of becoming, faculty and student onboarding flows, forum design, search results surface, path detail page, concept detail page, resource detail in playbook, long-press context menus, cross-language community design, year view of timeline.
- **Architectural decisions still to lock**: voice vs. text primacy across the main user base, path forking specifics, refund and cancellation policies, author tiers and economics, household-level privacy, long-running steps, premium subscriber Stripe mechanics, reputation and reviews for authors, quality and curation in Discover.
- **Smaller open questions**: Now bar visual ticking, bell icon visibility rules, hinge always-on vs. on-pause, capability arc edge cases, Vision annotation authorship, push vs. inbox thresholds, notification grouping, mute/snooze affordances, email digest scope.

---

## 20. Implementation status

What exists in the current codebase (as of the conversation):
- React Native / Expo app on `betterat-app` repo
- Supabase backend
- Beat #8 ForYouSection wiring (uncommitted)
- Day 1 demo blocker fixes on `fix/demo-blockers-day1`
- Audit branch `audit/codebase-recon` as long-lived reference

What exists in design but not yet implemented:
- Essentially everything described in this document. The redesign is a substantial undertaking.

Recommended implementation order (rough):
1. Voice-first capture for step During tab (biggest friction reducer; ~one week build)
2. State of Mind iOS Health integration for factual context (~one week)
3. Capability sparkline visualization (~one week; immediately differentiating)
4. Step Before/During/After architecture per this spec
5. Playbook with concept ingestion from reflections
6. Path subscription and adoption flow
7. Author dashboards and mentorship surfaces
8. Reflect tab
9. Discover redesign
10. Institutional onboarding

---

## End

The transcript of the conversation that produced this spec is preserved in the Claude chat. The mockup HTML files are in `mockups/`. Decisions log is in `decisions-log.md`. Open questions for future design work are listed in `decisions-log.md` under "Unresolved".
