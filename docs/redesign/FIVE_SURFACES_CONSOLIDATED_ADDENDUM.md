# Five Surfaces — Consolidated Design Addendum

**Status:** Source of truth for five surfaces, written under time pressure for ship-ASAP context as of 2026-05-15
**Scope:** JHU.edu public organization catalog, nursing interest catalog, blueprint creator dashboard, JHU.edu admin dashboard, blueprint creator mentoring screens
**Relates to:** PRACTICE_TIMELINE_CANONICAL.md and its two prior addenda

This doc is shipped fast. Each surface gets a focused design spec, decisions made where context supports them, and clearly flagged `[NEEDS DECISION]` items where Kevin needs to weigh in. Implementation specs come after.

The prior May 11 BetterAt redesign conversation already covered much of the JHU admin dashboard at screen-by-screen detail; this doc consolidates and updates that work rather than redoing it.

---

## Surface 1: JHU.edu Public Organization Catalog

### What this is

The public-facing page for Johns Hopkins School of Nursing on BetterAt. Audience: prospective students, faculty, current students considering programs, accreditation visitors, donors, anyone who arrives at `betterat.app/jhu` or `betterat.app/org/jhu-nursing` from a link.

This is the *institutional storefront*. It establishes credibility, communicates what BetterAt-powered learning looks like at JHU, and converts visitors into followers / applicants / supporters.

### Anatomy

```
┌─────────────────────────────────────────────┐
│  [JHU shield]  Johns Hopkins                │  ← institutional header
│                School of Nursing            │
│                                              │
│  ⭐ Verified institution · est. 1889        │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  THE PROGRAM IN PRACTICE                    │  ← hero section
│                                              │
│  [Large image: students in clinical setting]│
│                                              │
│  427 students currently practicing          │
│  85,000+ capability evidences logged        │
│  94% NCLEX first-attempt pass rate          │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  WHAT JHU NURSES LEARN                       │  ← capability framework
│                                              │
│  [AACN Essentials competency map preview]   │
│  Tap to explore the full framework          │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  BLUEPRINTS BY JHU FACULTY                   │  ← creator-facing content
│                                              │
│  ╭───────╮ ╭───────╮ ╭───────╮              │
│  │ MSN   │ │ DNP   │ │ Acute │              │
│  │ Core  │ │ Prep  │ │ Care  │              │
│  ╰───────╯ ╰───────╯ ╰───────╯              │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  PUBLIC PROFILES                             │  ← real students/grads
│                                              │
│  Recent graduates' capability records       │
│  [4-6 anonymized or opted-in profiles]      │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  APPLY · LEARN MORE · NEWSROOM              │  ← CTAs and links
│                                              │
└─────────────────────────────────────────────┘
```

### Key design decisions made

- **Web-first, mobile-responsive.** This is a public web surface. Not an iOS-app-only screen. Renders on every device but designed for desktop reading first (institutional credibility comes from generous typographic space).
- **Stats are real and live.** "427 students practicing" and "85,000 capability evidences" are pulled from the live database, not marketing copy. Numbers updating in real-time signal authenticity.
- **The AACN Essentials competency map is a draw card.** JHU's nursing program is structured around AACN Essentials. Showing the competency framework prominently positions BetterAt as the system that makes the framework navigable, not just a tool that runs alongside it.
- **Blueprints by JHU faculty** establishes that real faculty author content here. This is what differentiates a "JHU on BetterAt" page from a generic nursing platform.
- **Public Profiles section** is what makes this catalog *real*. Visitors can see actual recent graduates' capability records (opt-in, anonymizable). This is the most powerful thing on the page — proof that the system produces real, defensible credentials.

### Privacy and consent

Public profiles are opt-in by the graduate. Default is not-shown. Graduates can choose:
- Full profile public (name, photo, full capability record)
- Anonymized profile public (no name/photo, capability record visible)
- Not shown publicly

Faculty blueprint visibility is opt-in by the creator. Default is shown publicly with attribution.

### `[NEEDS DECISION]` items for this surface

- **URL structure:** `betterat.app/jhu` (short, branded) or `betterat.app/org/jhu-nursing` (scalable to other orgs)? Recommendation: both — short alias redirects to canonical org URL.
- **SEO and indexing:** public catalog should be search-engine-indexable. Implies meta-tag work, OpenGraph cards, structured data. Out of scope for the design itself but the design implies it.
- **News/announcements section:** the wireframe shows "NEWSROOM" but the content model isn't defined. Faculty posts? Press releases? Student spotlights? Decision deferred.

---

## Surface 2: Nursing Interest Catalog

### What this is

When a user picks "Nursing" as an interest (or arrives at `betterat.app/discover/nursing`), they land here. This is the *category page* for everything nursing-related on BetterAt: blueprints to follow, people to follow, organizations like JHU, sub-specialties, foundational learning paths.

Audience: new nursing learners, current students looking for resources, working nurses exploring continuing education, anyone interested in nursing as a domain.

### Anatomy

```
┌─────────────────────────────────────────────┐
│  ← Discover                                 │
│                                              │
│  Nursing                                     │
│  The deliberate practice of clinical care   │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  GET STARTED                                 │
│                                              │
│  [Path 1: NCLEX Prep]                       │
│  [Path 2: First Clinical Rotation]          │
│  [Path 3: Specialty Exploration]            │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  BY SPECIALTY                                │
│                                              │
│  Acute Care · Pediatrics · Mental Health    │
│  Family Practice · Critical Care · OR       │
│  Hospice · Public Health · Informatics      │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  INSTITUTIONS                                │
│                                              │
│  ╭─────────╮ ╭─────────╮ ╭─────────╮       │
│  │   JHU   │ │   UCSF  │ │   Penn  │       │
│  │ Nursing │ │ Nursing │ │ Nursing │       │
│  ╰─────────╯ ╰─────────╯ ╰─────────╯       │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  FEATURED BLUEPRINTS                         │
│                                              │
│  [Card] [Card] [Card] — scrollable strip   │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  PEOPLE TO FOLLOW                            │
│                                              │
│  Faculty · Practicing nurses · Mentors      │
│  [Avatar strip]                              │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  CAPABILITY FRAMEWORKS                       │
│                                              │
│  AACN Essentials                            │
│  NCLEX Test Plan Categories                 │
│  ANCC Certification Tracks                  │
│                                              │
└─────────────────────────────────────────────┘
```

### Key design decisions made

- **"Get Started" paths are curated, not algorithmic.** First-time nursing users see three opinionated paths. This is the equivalent of App Store "Today" tab editorial curation. Picks the user's starting point for them when they don't know what to pick.
- **By Specialty is a navigation taxonomy.** Tapping a specialty filters all the catalog content (blueprints, people, capabilities) to that specialty. Persistent filter state.
- **Institutions section surfaces orgs.** JHU appears here alongside UCSF, Penn, etc. Same card treatment as the JHU public page. Each links to that institution's public org page.
- **Capability Frameworks at the bottom is intentional.** Power users (educators, accreditation people) seek the framework directly. Casual users don't need it forced on them. Position at the bottom serves both.

### `[NEEDS DECISION]` items

- **Featured blueprint curation:** algorithmically picked by recency/popularity? Editorially curated by BetterAt staff? Hybrid? Recommendation: algorithmic with editorial override capability.
- **"Specialties" taxonomy source:** AACN's specialty list? NCLEX categories? ANCC certifications? Different taxonomies for different audiences. Recommendation: AACN-aligned for academic users, with synonyms for working nurses.
- **People to Follow ranking:** how are featured people selected? Verified faculty? Most-followed? Most-contributing-blueprints? Combination?

---

## Surface 3: Blueprint Creator Dashboard

### What this is

The surface where a creator (sailing coach, nursing professor, fitness trainer, anyone authoring practice content) builds, edits, publishes, and manages their blueprints. Audience: content authors — usually professionals with domain expertise who want to teach at scale.

### The creator's job

A creator wants to:
1. Design a sequence of practice steps that lead to capability development
2. Publish the sequence as a blueprint others can subscribe to
3. See who's subscribed and how they're progressing
4. Update the blueprint over time as they learn what works
5. Mentor subscribers directly if they choose (Surface 5 below)

### Anatomy

```
┌─────────────────────────────────────────────┐
│  Creator Dashboard                  [+New]  │
├─────────────────────────────────────────────┤
│  Tabs: Blueprints · Subscribers · Insights · Earnings · Settings  │
├─────────────────────────────────────────────┤
│                                              │
│  YOUR BLUEPRINTS (Blueprints tab)            │
│                                              │
│  ╭──────────────────────────────────────╮   │
│  │ Dragon Worlds Prep                    │   │
│  │ 14 steps · Published · 28 subscribers │   │
│  │ Last edit: 3 days ago                 │   │
│  │ [ Edit ] [ Preview ] [ ⋯ ]            │   │
│  ╰──────────────────────────────────────╯   │
│                                              │
│  ╭──────────────────────────────────────╮   │
│  │ Light-Air Tactics                     │   │
│  │ 9 steps · Draft                       │   │
│  │ Last edit: yesterday                  │   │
│  │ [ Edit ] [ Preview ] [ ⋯ ]            │   │
│  ╰──────────────────────────────────────╯   │
│                                              │
└─────────────────────────────────────────────┘
```

### The Blueprint Editor (when creator taps Edit)

```
┌─────────────────────────────────────────────┐
│  ← Dragon Worlds Prep      [Preview] [Save] │
├─────────────────────────────────────────────┤
│                                              │
│  TITLE: Dragon Worlds Prep                  │
│  COVER IMAGE: [upload]                       │
│  DESCRIPTION: [textarea]                     │
│  INTEREST: Sail Racing                       │
│  DIFFICULTY: Intermediate                    │
│  ESTIMATED DURATION: 12 weeks                │
│  CAPABILITIES THIS DEVELOPS: [chips +]      │
│                                              │
│  ──────────────────────────────────────────  │
│                                              │
│  STEPS (14)                          [+ Add] │
│                                              │
│  [Drag handle] 1. Boat preparation          │
│  [Drag handle] 2. Light-air starts          │
│  [Drag handle] 3. Heavy-air starts          │
│  [Drag handle] 4. Upwind speed in chop      │
│  ...                                         │
│                                              │
│  ──────────────────────────────────────────  │
│                                              │
│  PUBLISHING                                  │
│  [○] Draft (only visible to you)            │
│  [●] Published (subscribers can find it)    │
│  Price: Free / $9.99 one-time / $4.99/mo    │
│                                              │
└─────────────────────────────────────────────┘
```

Tap a step to edit it (same Plan tab structure as user's own steps, but with template fields for variables subscribers will fill in).

### Subscribers tab

```
┌─────────────────────────────────────────────┐
│  Subscribers · Dragon Worlds Prep (28)      │
├─────────────────────────────────────────────┤
│                                              │
│  Filter: All · Active · Stalled · Completed │
│                                              │
│  Tomás Renart           Step 9/14    Active │
│   Last activity: 2 hours ago                │
│   [ View progress ] [ Message ]             │
│                                              │
│  Jamie McWilliam        Step 5/14    Active │
│   Last activity: yesterday                  │
│   [ View progress ] [ Message ]             │
│                                              │
│  Bence Toronyi          Step 11/14   Active │
│   Last activity: 3 hours ago · AHEAD        │
│   [ View progress ] [ Message ]             │
│                                              │
│  (+25 more)                                  │
│                                              │
└─────────────────────────────────────────────┘
```

### Insights tab

```
┌─────────────────────────────────────────────┐
│  Insights · Dragon Worlds Prep              │
├─────────────────────────────────────────────┤
│                                              │
│  STEP COMPLETION HEATMAP                     │
│  [Visualization: % of subscribers who       │
│   completed each step]                       │
│                                              │
│  STEPS WHERE SUBSCRIBERS STALL              │
│  - Step 6: 32% of subscribers stuck here    │
│  - Step 11: 18% stuck                       │
│                                              │
│  CAPABILITY DEVELOPMENT BY COHORT           │
│  [Visualization]                             │
│                                              │
│  AVERAGE TIME PER STEP                       │
│  [Bar chart]                                 │
│                                              │
└─────────────────────────────────────────────┘
```

This is the analytical surface — the creator sees where subscribers get stuck, how long things take, where the blueprint needs work.

### Earnings tab (only if paid blueprints exist)

Standard creator monetization surface — subscriptions revenue, payout history, tax info. Out of scope to detail here; uses Stripe Connect per existing BetterAt architecture (per Kevin's memories about creator-agnostic monetization).

### `[NEEDS DECISION]` items

- **Versioning model:** when a creator edits a published blueprint, do existing subscribers get the new version automatically, or do they stay on the version they subscribed to? Recommendation: subscribers stay on their version; creator can "push update" with their consent.
- **Co-authoring:** can a blueprint have multiple authors? Recommendation: yes, with primary author and contributors.
- **Step templates with variables:** how do creators define variables that subscribers fill in (e.g. "[your boat name]" "[your local venue]")? Recommendation: bracket-notation in step content, with a variable schema in the blueprint metadata.

---

## Surface 4: JHU.edu Admin Dashboard

This surface already has substantial design captured in the May 11 conversation. The structure shipped there is:

**Sidebar nav:** Org Admin → expands to dashboard sections
**Top tabs:** Dashboard · Members · Requests · Cohorts · Competencies · Blueprints · Billing · Settings

Per the existing design (May 11), each tab works as follows:

### Dashboard tab
Overview of program health. NCLEX readiness, cohort comparison, capability completion rates, clinical site health. (Full content already detailed in May 11 conversation — see "Tier 3: Program Administration Flows" content.)

### Members tab
Filterable list of all org members. Role chips: Member · Preceptor · Clinical Instructor · Instructor · Evaluator · Org Admin. Filter by Active/Pending/Rejected/All. Invite link button at top.

### Requests tab
New member requests pending approval. Approve / Reject / Request more info actions.

### Cohorts tab
Class groupings (Spring 2025 MSN, Fall 2024 DNP, etc.). Each cohort shows its members, progression status, capability completion.

### Competencies tab
The AACN Essentials framework as it's configured for JHU. Org admins can map their internal competency structure to AACN, surface it to all org members' Plan/Reflect tabs, customize the wording.

### Blueprints tab
Blueprints authored by JHU faculty (visible org-wide). Admin can promote, demote, or feature blueprints.

### Billing tab
Institutional billing — seat licenses, usage metrics, payment history.

### Settings tab
Org-level settings: branding (JHU shield, colors), member invite policies, default visibility settings, integration with Canvas/LMS, integration with clinical-site systems (Trajecsys).

### Known gaps to address

From the May 11 conversation, two issues were flagged:

1. **Apple ID sign-in shows "RegattaFlow Web" not "BetterAt"** — Apple Developer console fix, not a design change. Add to Phase A.7 ship-blocker list.
2. **Org admin discovery is broken** — new admins won't know the Org Admin sidebar entry exists. Needs onboarding/invitation flow design.

### New design additions in this consolidated doc

**Onboarding for new org admins:**

When a JHU admin is invited and signs in for the first time, they should land on a welcome screen explaining the dashboard, walking through the tabs, and showing them what they can do. Not a forced tutorial — a dismissible welcome card at the top of the Dashboard tab with "Take the tour" affordance.

**Invitation flow:**

```
Members tab → [Invite] button → modal:

  Send invitations to:
  [text area for email addresses, one per line]

  Role:
  ○ Member
  ● Preceptor (default)
  ○ Clinical Instructor
  ○ Instructor
  ○ Evaluator
  ○ Org Admin (requires confirmation)

  Cohort (optional):
  [dropdown]

  Personal message (optional):
  [text area]

  [Cancel] [Send invitations]
```

Sent invitations show in Members tab under "Pending" filter. Admin can resend, revoke, or view invite link.

### `[NEEDS DECISION]` items

- **Default role for invitations:** Preceptor or Member? Different orgs have different conventions.
- **Cohort assignment timing:** at invitation, at first sign-in, or admin-assigned later?
- **Single sign-on:** JHU uses Shibboleth. Does BetterAt support SAML/Shibboleth SSO for org members? Likely required for JHU adoption. Design implication: an SSO-only sign-in path for org-affiliated users.

---

## Surface 5: Blueprint Creator Mentoring Screens

### What this is

The set of surfaces where a creator who has subscribers can directly mentor those subscribers — answer questions, give feedback on their work, review their Reflect entries, send guidance. Audience: creators who treat their blueprint as a teaching relationship, not just a content product.

This builds on the Subscribers tab of the Creator Dashboard.

### Entry points

From the Subscribers tab, tapping a subscriber's "View progress" or "Message" affordance opens the mentoring surface.

### Anatomy — Subscriber detail view

```
┌─────────────────────────────────────────────┐
│  ← Subscribers       Tomás Renart           │
├─────────────────────────────────────────────┤
│                                              │
│  [Avatar]                                    │
│  Tomás Renart                                │
│  @tomas · Hong Kong · Sail Racing            │
│  Subscribed Mar 14, 2026                     │
│                                              │
│  Tabs: Progress · Reflect Feed · Messages · Notes │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  PROGRESS (Progress tab)                     │
│                                              │
│  Step 9 of 14 — Heavy-air upwind speed      │
│  Active · 3 hours ago                        │
│                                              │
│  Mini-timeline of their steps in this BP    │
│  [Visualization showing past/current/future] │
│                                              │
│  Steps where they stalled or struggled:      │
│  - Step 6: took 12 days (avg 3 days)         │
│  - Step 8: replanned twice                   │
│                                              │
│  Capability development:                     │
│  [Bar chart of their capability progress    │
│   from this blueprint's steps]               │
│                                              │
└─────────────────────────────────────────────┘
```

### Reflect Feed tab

Shows the subscriber's Reflect-phase content from each step they've completed. The creator reads their reflections in chronological order. For each reflection:

- The step it's from
- Their rating, what worked, what to improve, next session focus
- A **Comment** affordance to leave feedback inline
- A **Mark capability evidence** affordance to verify a capability claim
- A **Request more detail** affordance to nudge them to deepen the reflection

This is the heart of mentoring — the creator reads the subscriber's reflections and responds.

### Messages tab

Direct one-to-one messaging. Threaded, with the blueprint and step context attached to each message ("about Step 7 of Dragon Worlds Prep").

### Notes tab

Private notes the creator keeps about this subscriber. Not visible to the subscriber. "Tomás is strong tactically but struggles with rules questions. Send him my rules quiz blueprint."

### Bulk mentoring affordances

From the main Subscribers tab, the creator can:

- **Send to all** — broadcast a message to all subscribers (e.g. "New step added based on what you've all been struggling with")
- **Filter by stuck-step** — see all subscribers stuck at Step 6, message them as a group
- **Schedule a group session** — Zoom link integration to set up a cohort call

### Mentoring tier (paid feature flagged)

`[NEEDS DECISION]` — should mentoring be:
- Free for all creators with subscribers
- Paid creator-tier feature (creators pay BetterAt for mentoring tools, gives them right to charge mentees more)
- Subscriber-paid (subscribers upgrade their subscription to access mentoring)

Recommendation: free for all creators initially (drives engagement); add paid mentoring tier once usage establishes patterns.

### Privacy

Subscribers can disable mentoring by their blueprint creators if they want a purely-content relationship. Default is mentoring-enabled (the social-learning value is the point).

### `[NEEDS DECISION]` items

- **Comment threading on reflections:** can subscribers reply to creator comments? Recommendation: yes, threaded.
- **Capability verification authority:** when a creator marks a capability as "verified," does that hold the same weight as AACN-aligned institutional verification? Probably not. Need a distinction in the data model between *peer-verified*, *creator-verified*, and *institution-verified* evidence.
- **Time-on-platform commitments:** if a creator charges for mentoring, are they obligated to respond within X hours? Service-level expectation needs definition.

---

## Implementation phasing

Across all five surfaces, suggested phasing for time-crunch context:

**Immediate (this week):**
- Phase A.7: Apple ID sign-in branding fix (RegattaFlow → BetterAt)
- Phase F.1: JHU admin onboarding card on Dashboard tab (1-2 days work)
- Phase F.2: Member invitation modal redesign (1 day)
- Phase G.1: Blueprint Creator Dashboard main view (Blueprints tab + Subscribers tab) — enough to demonstrate the creator workflow (2-3 days)

**Next sprint:**
- Phase H: JHU.edu public org catalog (1 week)
- Phase M: Nursing interest catalog (1 week)
- Phase G.2: Full Blueprint Editor (1-2 weeks)

**Following sprint:**
- Phase G.3: Subscribers / Insights / Earnings tabs full
- Phase J: Mentoring screens (Reflect Feed, Messages, Notes)
- Phase K: SSO/Shibboleth for JHU

**Deferred until product validation:**
- Paid mentoring tier
- Public profile sharing
- Capability framework editor

---

## Open product questions across all five surfaces

Consolidated `[NEEDS DECISION]` items for batch review:

1. URL structure for org pages (`/jhu` vs `/org/jhu-nursing`)
2. Newsroom/announcements content model
3. Featured blueprint curation method (algorithmic / editorial / hybrid)
4. Specialty taxonomy source (AACN / NCLEX / ANCC)
5. People-to-follow ranking method
6. Blueprint versioning when published edits happen
7. Co-authoring support
8. Step template variable notation
9. Default invitation role at JHU (Preceptor / Member)
10. Cohort assignment timing
11. SAML/Shibboleth SSO requirement
12. Mentoring monetization tier
13. Comment threading on reflections
14. Capability verification authority distinctions
15. Mentor response-time commitments

Decide these in a batch over coffee tomorrow. None of them block design rendering or initial implementation; they're refinements that surface during build.

---

## Status of this doc

This is a fast-ship consolidated design doc covering five surfaces written in time-crunch context. Each surface has enough specification to begin implementation work. The 15 `[NEEDS DECISION]` items above need product-level answers but don't block initial build.

Where this doc conflicts with prior canonicals (Practice Timeline, Plan tab addendum, Add Step / Zoomed-Out / Social addendum), the prior canonicals win. This doc adds new surfaces; it doesn't replace existing ones.

When implementation reveals tensions, this document is updated, not silently deviated from.
