# Master Implementation Backlog

Status: source-of-truth implementation queue for the May 15 redesign session.

This document is the backlog index, not an executable spec. Claude Code should execute from the per-phase spec documents listed here. When a phase ships, update this file with status, commit references, and any flag/default changes.

## Resolved Implementation Conventions

### Practice Tab Route Convention

Decision: the canonical **Practice** tab continues to be implemented at the stable legacy route `app/(tabs)/races.tsx` / `/(tabs)/races`.

Reason: the repo has no `app/(tabs)/practice.tsx`, and `/(tabs)/races` is referenced across onboarding, auth redirects, Playbook concept links, Discover actions, notifications, account routing, tests, and Race Log empty actions. `lib/navigation-config.ts` already separates the file-route key from the display label, so the product can say “Practice” while the route remains `races`.

Implication for future specs: write “Practice tab implemented at `app/(tabs)/races.tsx`” until a separate route-alias project is explicitly approved. Do not rename the route or introduce a `practice` alias as part of Phase B, B.5, B.6, C, or C.5.

## Inputs Verified

Source design documents:

- `PRACTICE_TIMELINE_CANONICAL.md`
- `PRACTICE_TIMELINE_CANONICAL_PLAN_TAB_ADDENDUM.md`
- `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md`
- `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md`
- `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`
- Existing migration/status docs: `IOS_MIGRATION_PLAN.md`, `IOS_STATUS.md`, `IOS_SURFACE_INVENTORY.json`
- Existing Phase B/C specs: `specs/PHASE_B_RENAME_PHASE_TABS.md`, `specs/PHASE_C_TIMELINE_WITH_PEEK.md`

Visual canonicals verified in `docs/redesign/ios-register/`:

- `practice-timeline-canonical.html`
- `plan-tab-three-states-canonical.html`
- `add-step-flow-canonical.html`
- `zoomed-out-view-canonical.html`
- `social-timeline-layer-canonical.html`
- `four-small-surfaces-canonical.html`
- `jhu-admin-dashboard-canonical.html`
- `jhu-public-org-catalog-canonical.html`
- `nursing-interest-catalog-canonical.html`
- `blueprint-creator-dashboard-canonical.html`
- `mentoring-screens-canonical.html`
- `discover-detail-trio-canonical.html`

## Section 1: Phase Inventory

| Phase | Description | Source docs | Visual canonical | Status | Est. commits | Dependencies | Flag default |
|---|---|---|---|---|---:|---|---|
| A | Rename bottom Reflect tab to Profile and keep route stable. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_A_RENAME_REFLECT_TO_PROFILE.md` | `practice-timeline-canonical.html` | shipped: `87b7c115`, heading extension `48fc9eb4`; canonical addendum `0c82b80b` | 2 | none | none; shipped as mechanical label change |
| A.7 | Fix Apple sign-in branding from RegattaFlow to BetterAt for org adoption readiness. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | none | spec-pending | 1 | Apple Developer console access | no app flag; external config change |
| B | Rename in-card phase tabs to Plan / Do / Reflect. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_B_RENAME_PHASE_TABS.md` | `practice-timeline-canonical.html` | spec-written, execution queued: `4a394087` | 1 | Phase A verified | none in written spec; see contradiction #2 |
| B.5 | Rebuild Plan tab interior: AI Coach primary, What/How/Why fields, optional context, three visual states. | `PRACTICE_TIMELINE_CANONICAL_PLAN_TAB_ADDENDUM.md` | `plan-tab-three-states-canonical.html` | spec-pending | 3-5 | Phase B preferred; Phase D not required for v1 | `PRACTICE_PLAN_TAB_IOS_REGISTER=false` |
| B.6 | Add Step FAB and two-option create sheet: AI Coach or Blueprint picker; auto-scroll to new step. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md` | `add-step-flow-canonical.html` | spec-pending | 2-3 | Phase A; can precede Phase C if mounted in `app/(tabs)/races.tsx` | `PRACTICE_ADD_STEP_FAB=false` |
| B.7 | Interest switcher action sheet for multi-interest users. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | `four-small-surfaces-canonical.html` | spec-pending | 1-2 | existing InterestProvider; before social/zoomed-out polish | `PRACTICE_INTEREST_SWITCHER_IOS=false` |
| B.8 | Profile/settings dropdown from top-right avatar. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | `four-small-surfaces-canonical.html` | spec-pending | 1-2 | Phase A naming distinction | `ACCOUNT_MENU_IOS_REGISTER=false` |
| B.9 | Share dialog / share sheet wrapper for steps, blueprints, profiles, evidence. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | `four-small-surfaces-canonical.html` | spec-pending | 2-3 | visibility model decision for final behavior; can stub UI first | `SHARE_DIALOG_IOS_REGISTER=false` |
| C | Timeline-with-peek shell: centered current card, adjacent peeks, swipe paging, tap peek, sticky phase memory. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_C_TIMELINE_WITH_PEEK.md` | `practice-timeline-canonical.html` | spec-written, execution queued: `c3dee8dd` | 5 | Phase B preferred; current data flow in `app/(tabs)/races.tsx` | `PRACTICE_TIMELINE_PEEK=false` |
| C.5 | Zoomed-out vertical timeline view with sticky periods, phase indicators, reorder, long-press menu. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md` | `zoomed-out-view-canonical.html` | spec-pending | 4-6 | Phase C shell; reorder decision | `PRACTICE_ZOOMED_OUT_TIMELINE=false` |
| D | Capability data model + Profile-as-credential surface. | `PRACTICE_TIMELINE_CANONICAL.md`, Plan addendum | no full Profile canonical yet; `practice-timeline-canonical.html` has sketch only | spec-pending; design incomplete | 8-12+ | capability taxonomy decisions; Plan/Reflect tagging model | `PROFILE_CAPABILITY_MAP=false` |
| E | Social timeline layer: following people, blueprints, peers, read-only others' steps, copy-to-my-timeline. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md` | `social-timeline-layer-canonical.html` | spec-pending | 6-10 | C.5, privacy/follow model, copy permissions | `PRACTICE_SOCIAL_TIMELINE=false` |
| F.1 | JHU admin dashboard onboarding card on Dashboard tab. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-admin-dashboard-canonical.html` | spec-pending | 1-2 | tenant scoping | `JHU_ADMIN_DASHBOARD_IOS=false` |
| F.2 | Member invitation modal redesign. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-admin-dashboard-canonical.html` | spec-pending | 1-2 | invitation role decision | `JHU_INVITE_MODAL_IOS=false` |
| F.3 | Full JHU admin dashboard tabs: dashboard, members, requests, cohorts, competencies, blueprints, billing, settings. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-admin-dashboard-canonical.html` | spec-pending | 6-10 | F.1/F.2, tenant roles, SSO decision | `JHU_ADMIN_IOS_REGISTER=false` |
| G.1 | Blueprint Creator Dashboard main view: Blueprints + Subscribers enough to demo creator workflow. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-pending | 3-5 | blueprint data exists; versioning can be deferred | `BLUEPRINT_CREATOR_DASHBOARD_IOS=false` |
| G.2 | Full Blueprint Editor: step list, metadata, publish controls, template variables. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-pending | 5-8 | versioning and variable decisions | `BLUEPRINT_EDITOR_IOS=false` |
| G.3 | Creator dashboard Subscribers / Insights / Earnings tabs. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-pending | 4-7 | monetization and insights data decisions | `BLUEPRINT_CREATOR_INSIGHTS_IOS=false` |
| H | JHU.edu public organization catalog. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-public-org-catalog-canonical.html` | spec-pending | 4-6 | URL, SEO, newsroom, tenant config | `PUBLIC_ORG_CATALOG_IOS=false` |
| I | Nursing interest catalog. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `nursing-interest-catalog-canonical.html` | spec-pending | 4-6 | specialty taxonomy, people ranking, blueprint curation | `NURSING_INTEREST_CATALOG_IOS=false` |
| J | Blueprint Creator mentoring screens: subscriber detail, reflect feed, messages, notes, bulk mentoring. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `mentoring-screens-canonical.html` | spec-pending | 6-10 | mentoring tier, comment threading, verification authority | `CREATOR_MENTORING_IOS=false` |
| K | SAML/Shibboleth SSO for JHU. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | none | spec-pending; non-visual infrastructure | 4-8 | JHU adoption decision, auth provider setup | no UI flag; environment-gated |
| L | Suggest bar below zoomed-out timeline. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | `four-small-surfaces-canonical.html` | spec-pending | 4-6 | C.5, suggestion data model, privacy/source rules | `PRACTICE_SUGGEST_BAR=false` |
| L.5 | Suggestion authoring from Mentoring screens. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `mentoring-screens-canonical.html` | spec-pending | 3-5 | J, L | `SUGGESTION_AUTHORING_IOS=false` |
| L.6 | Suggestion notifications. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | none | spec-pending | 2-4 | L, notification model | `SUGGESTION_NOTIFICATIONS=false` |
| L.7 | Algorithmic suggestions. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | none | spec-pending; product decision required | 5-8 | L, AI-suggestion strategy | `AI_SUGGESTIONS=false` |
| Discover | Discover tab iOS register: seven surfaces + graph adapter. | `DISCOVER_CUTOVER_ARCHITECTURE.md`, `DISCOVER_GRAPH_ADAPTER_WORK.md` | `discover-detail-trio-canonical.html`; older six build specs exist | specs-written for adapter/build specs; not executed | 10-14 | graph adapter, atomic flag, visual verification | `DISCOVER_IOS_REGISTER=false` for new cutover recommendation; existing doc says true |

## Section 2: Recommended Sequencing

### Immediate same-day batch

1. **Phase B** — execute the written label-only spec. This is the fastest remaining user-visible alignment after Phase A.
2. **Phase B.7 / B.8** — write and execute small specs for Interest Switcher and Profile/settings dropdown. These are narrow, high-visibility, and do not depend on the timeline shell.
3. **Phase B.6** — Add Step FAB. It is small but creates the entry point for the new Practice workflow; it can mount into `app/(tabs)/races.tsx` before Phase C.

### First critical path

4. **Phase C** — execute the written five-commit timeline-with-peek shell spec behind `PRACTICE_TIMELINE_PEEK=false`. This is the structural center of the redesign and unlocks C.5, E, and L.
5. **Phase B.5** — Plan tab rebuild can run before or after C. If Claude Code bandwidth allows parallelization, spec it while Phase C implementation is underway. It is medium scope and improves the active card interior.
6. **Phase C.5** — zoomed-out view after Phase C proves the shell. It introduces pinch/zoom mode and list-scale behaviors.

### Second critical path

7. **Phase L** — Suggest bar after C.5. The addendum says it lives below the zoomed-out timeline, so implementing it before C.5 would create temporary placement debt.
8. **Phase E** — social timeline layer. This is large and privacy-heavy; start after C.5 establishes the mode structure.
9. **Phase D** — capability data model and Profile-as-credential. This is foundational but multi-week. It can start in parallel as a data-model/design process, but the first executable specs should wait for taxonomy decisions.

### Institutional / creator track

10. **Phase F.1/F.2** — JHU admin quick wins can ship before full SSO if scoped as admin-visible prototypes with feature flags.
11. **Phase G.1** — Blueprint Creator Dashboard main view. Useful for demoing creator workflow; does not require the full editor.
12. **Phase H/I** — public org catalog and nursing catalog. These are important for acquisition but depend on URL/taxonomy/curation decisions.
13. **Phase G.2/G.3/J/K** — full creator/admin/mentoring/SSO suite. Multi-day to multi-week; schedule after the May 20 critical path is chosen.

## Section 3: Specs To Write

Specs already written:

- `PHASE_A_RENAME_REFLECT_TO_PROFILE.md`
- `PHASE_B_RENAME_PHASE_TABS.md`
- `PHASE_C_TIMELINE_WITH_PEEK.md`
- Existing Discover build/adapter specs in `docs/redesign/specs/`

Specs still needed:

| Spec doc | Covers | Write timing |
|---|---|---|
| `PHASE_A7_APPLE_SIGNIN_BRANDING.md` | Apple ID / auth provider branding fix from RegattaFlow to BetterAt. | now if JHU demo depends on sign-in |
| `PHASE_B5_PLAN_TAB_REBUILD_SPEC.md` | Plan tab UI, AI Coach primary path, What/How/Why fields, locked state. | now |
| `PHASE_B6_ADD_STEP_FAB_SPEC.md` | FAB, create sheet, AI Coach entry, Blueprint picker, auto-scroll. | now |
| `PHASE_B7_INTEREST_SWITCHER_SPEC.md` | Interest action sheet, activity summaries, manage interests links. | now |
| `PHASE_B8_PROFILE_SETTINGS_DROPDOWN_SPEC.md` | Avatar menu, account/settings actions, Profile-tab distinction. | now |
| `PHASE_B9_SHARE_DIALOG_SPEC.md` | iOS share sheet wrapper, BetterAt actions, visibility selector. | after privacy defaults decision, or now with stubbed visibility |
| `PHASE_C5_ZOOMED_OUT_TIMELINE_SPEC.md` | Pinch transition, vertical timeline list, headers, reorder, long-press menu. | after Phase C executes |
| `PHASE_D_CAPABILITY_DATA_MODEL_SPEC.md` | Capability tables, evidence tagging, verification authority, Profile capability map. | after taxonomy decisions |
| `PHASE_E_SOCIAL_TIMELINE_SPEC.md` | Following layer, read-only external steps, copy-to-my-timeline. | after C.5 and privacy decisions |
| `PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md` | Admin dashboard onboarding card. | now if JHU demo is prioritized |
| `PHASE_F2_JHU_INVITE_MODAL_SPEC.md` | Invitation modal redesign and role defaults. | after invitation role decision |
| `PHASE_F3_JHU_ADMIN_DASHBOARD_SPEC.md` | Full admin dashboard tabs. | after F.1/F.2 |
| `PHASE_G1_BLUEPRINT_CREATOR_DASHBOARD_SPEC.md` | Creator dashboard main view. | now if creator demo is prioritized |
| `PHASE_G2_BLUEPRINT_EDITOR_SPEC.md` | Full editor, variables, publish/update semantics. | after versioning/variables decisions |
| `PHASE_G3_CREATOR_INSIGHTS_EARNINGS_SPEC.md` | Subscribers, insights, earnings tabs. | after monetization decision |
| `PHASE_H_PUBLIC_ORG_CATALOG_SPEC.md` | Public JHU/org catalog, URL/SEO/newsroom. | after URL/content decisions |
| `PHASE_I_NURSING_INTEREST_CATALOG_SPEC.md` | Nursing catalog, specialty taxonomy, featured people/blueprints. | after taxonomy/ranking decisions |
| `PHASE_J_CREATOR_MENTORING_SPEC.md` | Mentoring screens and subscriber detail. | after mentoring monetization/permissions decisions |
| `PHASE_K_JHU_SSO_SPEC.md` | SAML/Shibboleth auth integration. | after JHU SSO requirement confirmed |
| `PHASE_L_SUGGEST_BAR_SPEC.md` | Suggest bar below zoomed-out view, accept/dismiss/save. | after C.5 |
| `PHASE_L5_SUGGESTION_AUTHORING_SPEC.md` | Mentor/creator authoring flow for suggestions. | after J and L |
| `PHASE_L6_SUGGESTION_NOTIFICATIONS_SPEC.md` | Notification trigger, routing, settings. | after L |
| `PHASE_L7_ALGORITHMIC_SUGGESTIONS_SPEC.md` | AI/algorithmic suggestion source and labeling. | after AI-suggestion product decision |

Total specs to write: 23.

## Section 4: Open Product Questions

### Practice timeline and workflow

1. Current-step treatment: should visual styling distinguish “next step I have not started” from “currently in Do”?
2. Large-history compaction: what does the timeline show for 50+ completed steps?
3. Step ordering: how does a user move a step in the timeline?
4. Multi-interest concurrency: one interest at a time or interleaved “All interests” view?
5. In-progress transition: what happens if a user moves to a new step before finishing the prior Do/Reflect?
6. Nested plans: can a step contain sub-plans, or should each sub-plan become its own step?
7. Plan templates: can users save Plan structures for future reuse?
8. Real-time plan collaboration: can collaborators edit a Plan together before Do starts?
9. Voice input for AI Coach: does Plan support voice entry in v1?
10. Plan versioning: if Plan changes after Do starts, do we preserve the old Plan for Reflect comparison?

### Social, privacy, and suggestions

11. Privacy default for new steps: private, followers, or public?
12. Follower approval: auto-approved, opt-in, mutual, or asymmetric?
13. Notification model: when followed people/blueprints log steps, what notifications fire?
14. Blueprint subscriber visibility: do creators see subscribers on their Profile?
15. Copy permissions: when copying someone else’s step, what content is copied?
16. Social discovery routing: how does Discover connect to follow/subscribe flows?
17. Suggest authoring: where does a mentor/peer create a suggestion?
18. Algorithmic suggestions: are AI suggestions allowed, and how are they distinguished?
19. Suggestion-to-blueprint pipeline: can repeated suggestions become blueprint candidates?
20. Cross-interest suggestions: can a source suggest steps outside the user’s active interest?
21. Save-for-later surface: where do saved suggestions live?

### Institutional, catalog, and tenant model

22. Org URL structure: `/jhu`, `/org/jhu-nursing`, or both?
23. Public catalog SEO/indexing requirements.
24. Newsroom content model: faculty posts, press, student spotlights, or something else?
25. Featured blueprint curation: algorithmic, editorial, or hybrid?
26. Nursing specialty taxonomy source: AACN, NCLEX, ANCC, or hybrid?
27. People-to-follow ranking method.
28. Default JHU invitation role: Preceptor or Member?
29. Cohort assignment timing: invite, first sign-in, or admin-assigned later?
30. JHU SAML/Shibboleth requirement and timeline.

### Blueprint creator and mentoring

31. Blueprint versioning: do existing subscribers auto-upgrade when creators edit?
32. Blueprint co-authoring: primary author plus contributors?
33. Step template variable notation and metadata schema.
34. Mentoring monetization: free, creator-tier paid, or subscriber-paid?
35. Reflection comment threading: can subscribers reply to creator comments?
36. Capability verification authority: peer/creator/institutional distinctions.
37. Mentor response-time commitments if mentoring is paid.

### Search and AI

38. AI Coach conversational flow is referenced but not fully designed.
39. Search is cited in multiple specs but no global search UX is designed.
40. Do and Reflect tab interiors are not yet designed to the same depth as Plan.

## Section 5: Cross-Cutting Concerns

### Per-Interest Configuration

Sailing and nursing already diverge in copy, timeline data, and capability semantics. Phase B intentionally normalizes phase-tab labels, but Plan/Do/Reflect interiors still need per-interest AI Coach prompts, capability taxonomies, and empty states. The implementation should avoid hardcoding sailing assumptions into the Practice shell.

### Per-Tenant Configuration

JHU surfaces imply tenant-scoped catalogs, admin dashboards, SSO, roles, cohorts, and visibility rules. Phase F/H/I/K specs need a shared tenant-config strategy instead of one-off `jhu` checks scattered through components.

### Feature Flags

The structural rule after the Race Prep regression is default OFF for substantive visual/interaction cutovers. Mechanical label changes have already shipped without flags, and Phase B’s written spec explicitly recommends no flag. Treat this as a documented exception, not precedent for large phases.

### Auth and Visibility

Privacy spans Plan/Do/Reflect, public Profile links, followers, peer suggestions, org catalogs, and mentoring. Do not let each feature invent visibility rules. A shared visibility model should precede Phase E/L/J production rollout.

### AI Coach

AI Coach is the primary path in Plan and likely appears in Add Step, suggestions, and future capability tagging. It has not been specced as a product surface. Phase B.5 can ship a constrained Plan-tab AI Coach entry, but a full AI Coach spec is needed before broad reuse.

### Capability Data Model

Phase D is foundational for Profile, tagging, verification, and institutional evidence. Concept detail’s data-layer pattern is the template: migration, read path, routing/derivation function, then visual cutover.

### No Preview Components in Production

All production render switches must import kit components or domain components, never preview-route components from `app/`. This rule came from the Reflect preview-data leak and applies to every future spec.

## Contradictions and Inconsistencies

1. **HTML canonical count mismatch:** the prompt says 11 HTML canonicals, but repo has 12. Extra file: `discover-detail-trio-canonical.html`.
2. **Flag policy tension:** the prompt says every phase ships behind a default-OFF flag, but Phase A shipped unflagged and Phase B’s written spec says no flag because it is mechanical copy. This backlog preserves that exception for mechanical phases and applies default-OFF to substantive UI/behavior phases.
3. **Practice route naming resolved:** canonical product language is Practice, but the implementation route remains `app/(tabs)/races.tsx` / `/(tabs)/races`. This is intentional route stability, not an inconsistency.
4. **Discover source gap:** Discover visual canonical exists and older Discover architecture/spec docs exist, but the prompt’s “source spec documents” list does not include a new May 15 Discover addendum.
5. **Profile content gap:** Phase A made the bottom tab and heading say Profile, but full Profile-as-credential content is Phase D and not yet fully designed.
