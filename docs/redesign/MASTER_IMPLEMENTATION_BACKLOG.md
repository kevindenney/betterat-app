# Master Implementation Backlog

Status: source-of-truth implementation queue for the May 15 redesign session.

This document is the backlog index, not an executable spec. Claude Code should execute from the per-phase spec documents listed here. When a phase ships, update this file with status, commit references, and any flag/default changes.

## Resolved Implementation Conventions

### Practice Tab Route Convention

Decision: the canonical **Practice** tab can continue to be implemented by the existing `app/(tabs)/races.tsx` screen short-term, but the canonical user-facing route should become `/practice`.

Reason: the repo has no `app/(tabs)/practice.tsx`, and `/(tabs)/races` is referenced across onboarding, auth redirects, Playbook concept links, Discover actions, notifications, account routing, tests, and Race Log empty actions. That blast radius argues against an immediate file-route rename. However, `/races` is product-visible on web/deep links and is wrong for Nursing, Design, and other non-sailing interests. Route stability is an implementation concern; URL semantics are a product concern.

Implication for future specs: write “Practice tab implemented by the existing `app/(tabs)/races.tsx` screen, exposed publicly as `/practice`.” Phase A.8 owns the URL alias/redirect work. Phase B, B.5, B.6, C, and C.5 should not do broad route churn themselves.

### Feature Flag Convention

Decision: default-OFF feature flags are required for behavioral, visual-layout, data-wiring, navigation-surface, route, or data-model changes. Pure mechanical copy/label changes may ship unflagged only when they are fully reversible by one commit and do not alter data, routes, control flow, persistence, or component mounting.

Implication: Phase A and Phase B are valid unflagged exceptions. Every future spec must explicitly state whether it is using the mechanical-only exception or adding a default-OFF flag.

### Tab Bar Label Convention (Phase A.10 outcome)

Phase A.10 — Practice tab bar label. Closed without code change. Investigation revealed `lib/navigation-config.ts` already implements per-interest tab labels (sailing: Race, nursing: Practice, with vocabulary overrides via `getEventTabTitle`). This is correct community-language design, not legacy drift. The Practice Timeline Canonical was updated in this commit to reflect that the first tab's label is interest-specific, defaulting to the verb each community uses. The tab's identity remains "the Practice engine" — only the surface label adapts.

Implication for future specs: do not assert a universal "Practice" label for the bottom-bar first tab. Refer to it as "the Practice engine" when discussing identity, and as the interest-resolved label (Race/Practice/Shift/etc.) when describing the visible UI.

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

Decision: there are **12** valid HTML canonicals in the May 15 design set. `discover-detail-trio-canonical.html` is part of the Discover implementation input, not a legacy or duplicate artifact.

## Section 1: Phase Inventory

| Phase | Description | Source docs | Visual canonical | Status | Est. commits | Dependencies | Flag default |
|---|---|---|---|---|---:|---|---|
| A | Rename bottom Reflect tab to Profile and keep route stable. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_A_RENAME_REFLECT_TO_PROFILE.md` | `practice-timeline-canonical.html` | shipped: `87b7c115`, heading extension `48fc9eb4`; canonical addendum `0c82b80b` | 2 | none | none; shipped as mechanical label change |
| A.7 | Fix Apple sign-in branding from RegattaFlow to BetterAt for org adoption readiness. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md`, `specs/PHASE_A7_APPLE_SIGNIN_BRANDING.md` | none | spec-written | 1-3 | Apple Developer console access | no app flag; external config change |
| A.8 | Add `/practice` as the canonical user-facing route while preserving `/races` as a backwards-compatible alias/redirect. | `PRACTICE_TIMELINE_CANONICAL.md`, this backlog decision | none | shipped: `e81bb80f`, `2d3f365b`, `8b01d14a` | 3 | complete; broad legacy `/races` cleanup remains deferred | unflagged mechanical alias; `/races` preserved |
| A.9 | Clear `app/(tabs)/races.tsx` lint warnings so lint-staged no longer blocks Practice commits touching the file. | Phase B report `2e4f25a7`, `specs/PHASE_A9_RACES_TSX_WARNING_CLEANUP_SPEC.md` | none | shipped: `0c5676b9`, `513e1659`, `c634b7f7` | 3 | complete; unblocks B.5/B.6/C/C.5 execution | none; internal lint cleanup |
| A.10 | Bottom tab bar label "Race" vs "Practice" alignment investigation. | Phase B report `2e4f25a7`, `PRACTICE_TIMELINE_CANONICAL.md` (updated) | none | closed-no-action (this commit) | 0 (docs only) | none | n/a; no code change |
| B | Rename in-card phase tabs to Plan / Do / Reflect. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_B_RENAME_PHASE_TABS.md` | `practice-timeline-canonical.html` | spec-written, execution queued: `4a394087` | 1 | Phase A verified | none; qualifies for mechanical-only exception |
| B.5 | Rebuild Plan tab interior: AI Coach primary, What/How/Why fields, optional context, three visual states. | `PRACTICE_TIMELINE_CANONICAL_PLAN_TAB_ADDENDUM.md`, `specs/PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md` | `plan-tab-three-states-canonical.html` | shipped-verified: `b8a9dc22`, `a0192d4f`, `72ffc4c3`, `1c382637`, fixes `5bf037d5`, `7b7b3df9`. Verified in simulator 2026-05-16 with flag on; Frame 4 screenshot at `docs/redesign/screenshots/phase-b5-frame-4-filled.png`. | 6 | complete; Phase D not required for v1 | `PRACTICE_PLAN_TAB_IOS_REGISTER=false` |
| B.6 | Add Step FAB and two-option create sheet: AI Coach or Blueprint picker; auto-scroll to new step. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md`, `specs/PHASE_B6_ADD_STEP_FAB_SPEC.md` | `add-step-flow-canonical.html` | shipped-verified: `76088743`, `454e9fb3`, `b55e1af4`. Verified in simulator 2026-05-16 with flag on. Flag remains default-OFF in production per Option A decision — ON in dev environment, OFF in production until B.5 lands and full Add Step flow is functional end-to-end. | 3 | complete; production flip waits for B.5 | `PRACTICE_ADD_STEP_FAB=false` (prod); `=true` (dev) |
| B.7 | Interest switcher action sheet for multi-interest users. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, `specs/PHASE_B7_INTEREST_SWITCHER_SPEC.md` | `four-small-surfaces-canonical.html` | spec-written | 3 | existing InterestProvider; before social/zoomed-out polish; A.10 label model | `PRACTICE_INTEREST_SWITCHER_IOS=false` |
| B.8 | Profile/settings dropdown from top-right avatar. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, `specs/PHASE_B8_PROFILE_SETTINGS_DROPDOWN_SPEC.md` | `four-small-surfaces-canonical.html` | spec-written | 3 | Phase A naming distinction; Profile tab remains separate | `ACCOUNT_MENU_IOS_REGISTER=false` |
| B.9 | Share dialog / share sheet wrapper for steps and blueprints first; profiles/evidence later. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, `specs/PHASE_B9_SHARE_DIALOG_SPEC.md` | `four-small-surfaces-canonical.html` | spec-written | 4 | visibility model decision for final behavior; v1 stubs unsupported BetterAt actions | `SHARE_DIALOG_IOS_REGISTER=false` |
| B.10 | Reflect tab interior: AI-drafted summary, prompt-driven refinement, capability evidence drilldown, and Carry forward. B.8 collision required assigning Reflect to the lowest free B-series ID. | `specs/PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md`, `PRACTICE_TIMELINE_CANONICAL.md` | `reflect-tab-interior-canonical.html` | spec-written | 6 | B.5 complete; Do-tab interior status must be confirmed before full end-to-end AI-summary verification; Phase D not required for v1 | `PRACTICE_REFLECT_TAB_IOS_REGISTER=false` |
| B.11 | Do tab interior: pre-activity capture affordances, live capture stream, explicit End activity, post-activity summary, Move-to-Reflect handoff, capture flags, and capability labels. Frame 4 evidence marking is deferred to v2. | `specs/PHASE_B11_DO_TAB_INTERIOR_SPEC.md`, `PRACTICE_TIMELINE_CANONICAL.md` | `do-tab-interior-canonical.html` | spec-written | 5 | B.5 complete; blocks full B.10 Reflect end-to-end verification; improves B.12 evidence inputs | `PRACTICE_DO_TAB_IOS_REGISTER=false` |
| B.12 | Profile screen: credential landing, capability evidence drilldown, public preview, and settings sheet over existing profile/privacy/competency infrastructure. | `specs/PHASE_B12_PROFILE_SCREEN_SPEC.md`, `PRACTICE_TIMELINE_CANONICAL.md` | `profile-screen-canonical.html` | spec-written | 7 | Phase A Profile rename; B.11 improves Do-capture evidence; B.10 improves Reflect evidence; Phase D not required for v1 | `PROFILE_SCREEN_IOS_REGISTER=false` |
| C | Timeline-with-peek shell: centered current card, adjacent peeks, swipe paging, tap peek, sticky phase memory. | `PRACTICE_TIMELINE_CANONICAL.md`, `specs/PHASE_C_TIMELINE_WITH_PEEK.md` | `practice-timeline-canonical.html` | spec-written, execution queued: `c3dee8dd` | 5 | A.9; Phase B preferred; current data flow in `app/(tabs)/races.tsx` | `PRACTICE_TIMELINE_PEEK=false` |
| C.5 | Zoomed-out vertical timeline view with sticky periods, phase indicators, reorder, long-press menu. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md`, `specs/PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md` | `zoomed-out-view-canonical.html` | spec-written | 5 | A.9; Phase C shell; reorder decision | `PRACTICE_ZOOMED_OUT_TIMELINE=false` |
| I | Series feature integration: canonical Series/Season strip, switch-Series sheet, step-card Series context, and `Jump to` picker redesign over the existing Season infrastructure. | `specs/PHASE_I_SERIES_FEATURE_INTEGRATION_SPEC.md`, Phase A.10 vocabulary model | `series-feature-canonical.html` | spec-written | 5-6 | Existing Season infrastructure; C.5 for zoomed-out strip placement; A.10 vocabulary convention | `PRACTICE_SERIES_IOS_REGISTER=false` |
| D | Capability data model successor work for durable evidence, endorsement, verification, and rollup optimization beyond the B.12 v1 Profile screen. | `PRACTICE_TIMELINE_CANONICAL.md`, Plan addendum, B.10/B.11/B.12 specs | `profile-screen-canonical.html` | spec-pending; data-model design incomplete | 8-12+ | capability taxonomy decisions; Plan/Do/Reflect/Profile tagging model | `PROFILE_CAPABILITY_MAP=false` |
| E | Social timeline layer: following people, blueprints, peers, read-only others' steps, copy-to-my-timeline. | `PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md` | `social-timeline-layer-canonical.html` | spec-pending | 6-10 | C.5, privacy/follow model, copy permissions | `PRACTICE_SOCIAL_TIMELINE=false` |
| F.1 | JHU admin dashboard onboarding card on Dashboard tab. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md`, `specs/PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md` | `jhu-admin-dashboard-canonical.html` | shipped flag-off: `182a59c1` (flag + component + test), `f50940ca` (dismissal hook + test), `8dd46208` (wire into cohort dashboard). Static verification clean (typecheck, lint, 11/11 jest tests). Visual flag-on verification deferred — requires Metro restart with `EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS=true` plus admin login. Flag remains default-OFF in production. Follow-up: real Org Admin guided tour (v1 routes "Take the tour" to `/organization/members`). | 3 | tenant scoping | `JHU_ADMIN_DASHBOARD_IOS=false` |
| F.2 | Member invitation modal redesign. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-admin-dashboard-canonical.html` | spec-pending | 1-2 | invitation role decision | `JHU_INVITE_MODAL_IOS=false` |
| F.3 | Full JHU admin dashboard tabs: dashboard, members, requests, cohorts, competencies, blueprints, billing, settings. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-admin-dashboard-canonical.html` | spec-pending | 6-10 | F.1/F.2, tenant roles, SSO decision | `JHU_ADMIN_IOS_REGISTER=false` |
| G.1 | Blueprint Creator Dashboard main view: Blueprints + Subscribers enough to demo creator workflow. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-written | 3-5 | blueprint data exists; versioning can be deferred | `BLUEPRINT_CREATOR_DASHBOARD_IOS=false` |
| G.2 | Full Blueprint Editor: step list, metadata, publish controls, template variables. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-pending | 5-8 | versioning and variable decisions | `BLUEPRINT_EDITOR_IOS=false` |
| G.3 | Creator dashboard Subscribers / Insights / Earnings tabs. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `blueprint-creator-dashboard-canonical.html` | spec-pending | 4-7 | monetization and insights data decisions | `BLUEPRINT_CREATOR_INSIGHTS_IOS=false` |
| H | JHU.edu public organization catalog. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `jhu-public-org-catalog-canonical.html` | spec-pending | 4-6 | URL, SEO, newsroom, tenant config | `PUBLIC_ORG_CATALOG_IOS=false` |
| M | Nursing interest catalog. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `nursing-interest-catalog-canonical.html` | spec-pending | 4-6 | specialty taxonomy, people ranking, blueprint curation | `NURSING_INTEREST_CATALOG_IOS=false` |
| N | PRIORITY-HIGH production privacy fix: make `profiles.profile_public` and `sailor_profiles.is_profile_public` default false for new users, update service/onboarding defaults, and guard public profile route fallback behavior. Existing users stay unchanged. | `specs/PHASE_N_PROFILE_PUBLIC_DEFAULT_FIX_SPEC.md`, B.12 investigation `64f3f6ec` | none | spec-written | 5 | execute before May 20; public-route privacy guard | none; privacy fix |
| O | Existing User Privacy Migration: migrate existing users from `profile_public=true` / `is_profile_public=true` to private after communication and snapshot. | Phase N deferred section | none | spec-pending; post-May-20 | 2-4 | Phase N shipped; admin count query; user communication | none; privacy migration |
| J | Blueprint Creator mentoring screens: subscriber detail, reflect feed, messages, notes, bulk mentoring. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `mentoring-screens-canonical.html` | spec-pending | 6-10 | mentoring tier, comment threading, verification authority | `CREATOR_MENTORING_IOS=false` |
| K | SAML/Shibboleth SSO for JHU. | `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | none | spec-pending; non-visual infrastructure | 4-8 | JHU adoption decision, auth provider setup | no UI flag; environment-gated |
| L | Suggest bar below zoomed-out timeline. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | `four-small-surfaces-canonical.html` | spec-pending | 4-6 | C.5, suggestion data model, privacy/source rules | `PRACTICE_SUGGEST_BAR=false` |
| L.5 | Suggestion authoring from Mentoring screens. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, `FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md` | `mentoring-screens-canonical.html` | spec-pending | 3-5 | J, L | `SUGGESTION_AUTHORING_IOS=false` |
| L.6 | Suggestion notifications. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | none | spec-pending | 2-4 | L, notification model | `SUGGESTION_NOTIFICATIONS=false` |
| L.7 | Algorithmic suggestions. | `FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | none | spec-pending; product decision required | 5-8 | L, AI-suggestion strategy | `AI_SUGGESTIONS=false` |
| Discover | Discover tab iOS register: seven surfaces + graph adapter. | `DISCOVER_CUTOVER_ARCHITECTURE.md`, `DISCOVER_GRAPH_ADAPTER_WORK.md` | `discover-detail-trio-canonical.html`; older six build specs exist | specs-written for adapter/build specs; not executed | 10-14 | graph adapter, atomic flag, visual verification | `DISCOVER_IOS_REGISTER=false` for new cutover recommendation; existing doc says true |

## Section 2: Recommended Sequencing

### Immediate same-day batch

1. **Phase B.6 verification** — flip `EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB=true` locally, verify the FAB/sheet path, then decide whether to enable.
2. **Phase B.5** — shipped and verified. Keep the flag default-OFF until production rollout timing is chosen.
3. **Phase B.7 / B.8** — small specs for Interest Switcher and Profile/settings dropdown remain narrow, high-visibility, and do not depend on the timeline shell.

### First critical path

5. **Phase C** — execute the written five-commit timeline-with-peek shell spec behind `PRACTICE_TIMELINE_PEEK=false`. This is the structural center of the redesign and unlocks C.5, E, and L.
6. **Phase B.5** — complete. Use it as the verified Plan-tab baseline for Phase C/C.5 execution.
7. **Phase C.5** — zoomed-out view after Phase C proves the shell. It introduces pinch/zoom mode and list-scale behaviors.
8. **Phase I** — Series feature integration. The step-card and `Jump to` picker portions can execute once A.9 is clear; the zoomed-out Series strip should wait for C.5 placement unless the executor deliberately ships a temporary placement behind `PRACTICE_SERIES_IOS_REGISTER=false`.

### Second critical path

9. **Phase L** — Suggest bar after C.5. The addendum says it lives below the zoomed-out timeline, so implementing it before C.5 would create temporary placement debt.
10. **Phase E** — social timeline layer. This is large and privacy-heavy; start after C.5 establishes the mode structure.
11. **Phase D** — capability data model and Profile-as-credential. This is foundational but multi-week. It can start in parallel as a data-model/design process, but the first executable specs should wait for taxonomy decisions.

### Institutional / creator track

12. **Phase F.1/F.2** — JHU admin quick wins can ship before full SSO if scoped as admin-visible prototypes with feature flags.
13. **Phase G.1** — Blueprint Creator Dashboard main view. Useful for demoing creator workflow; does not require the full editor.
14. **Phase H/M** — public org catalog and nursing catalog. These are important for acquisition but depend on URL/taxonomy/curation decisions. Phase H remains public org catalog; Phase M is nursing interest catalog after the Series feature integration moved to Phase I.
15. **Phase G.2/G.3/J/K** — full creator/admin/mentoring/SSO suite. Multi-day to multi-week; schedule after the May 20 critical path is chosen.

## Section 3: Specs To Write

Specs already written:

- `PHASE_A_RENAME_REFLECT_TO_PROFILE.md`
- `PHASE_B_RENAME_PHASE_TABS.md`
- `PHASE_C_TIMELINE_WITH_PEEK.md`
- Existing Discover build/adapter specs in `docs/redesign/specs/`

Specs still needed:

| Spec doc | Covers | Write timing |
|---|---|---|
| `PHASE_A7_APPLE_SIGNIN_BRANDING.md` | Apple ID / auth provider branding fix from RegattaFlow to BetterAt. | written |
| `PHASE_A8_PRACTICE_ROUTE_ALIAS_SPEC.md` | `/practice` canonical route, `/races` compatibility alias/redirect, route tests, link migration rules. | now, before public links and share surfaces |
| `PHASE_A9_RACES_TSX_WARNING_CLEANUP_SPEC.md` | Clear `app/(tabs)/races.tsx` lint warnings that block downstream Practice commits. | written |
| `PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md` | Plan tab UI, AI Coach primary path, What/How/Why fields, locked state. | written |
| `PHASE_B6_ADD_STEP_FAB_SPEC.md` | FAB, create sheet, AI Coach entry, Blueprint picker, auto-scroll. | written |
| `PHASE_B7_INTEREST_SWITCHER_SPEC.md` | Interest action sheet, activity summaries, manage interests links. | written |
| `PHASE_B8_PROFILE_SETTINGS_DROPDOWN_SPEC.md` | Avatar menu, account/settings actions, Profile-tab distinction. | written |
| `PHASE_B9_SHARE_DIALOG_SPEC.md` | iOS share sheet wrapper, BetterAt actions, visibility selector. | written with v1 stubs |
| `PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md` | Reflect tab interior, AI-drafted summary, prompt groups, capability evidence, Carry forward. | written |
| `PHASE_B11_DO_TAB_INTERIOR_SPEC.md` | Do tab interior, live capture stream, explicit End activity, post-activity summary, Move-to-Reflect handoff, capture flags, and capability labels. | written |
| `PHASE_B12_PROFILE_SCREEN_SPEC.md` | Profile credential surface, capability map/drilldown, public preview, privacy settings, and v1/v2 data boundaries. | written |
| `PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md` | Pinch transition, vertical timeline list, headers, reorder, long-press menu. | written; execute after Phase C |
| `PHASE_I_SERIES_FEATURE_INTEGRATION_SPEC.md` | Series/Season strip, switch-Series sheet, step-card Series context, and canonical `Jump to` picker over existing Season infrastructure. | written; execute after A.9, with zoomed-out strip placement after C.5 |
| `PHASE_D_CAPABILITY_DATA_MODEL_SPEC.md` | Capability tables, evidence tagging, verification authority, Profile capability map. | after taxonomy decisions |
| `PHASE_E_SOCIAL_TIMELINE_SPEC.md` | Following layer, read-only external steps, copy-to-my-timeline. | after C.5 and privacy decisions |
| `PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md` | Admin dashboard onboarding card. | written |
| `PHASE_F2_JHU_INVITE_MODAL_SPEC.md` | Invitation modal redesign and role defaults. | after invitation role decision |
| `PHASE_F3_JHU_ADMIN_DASHBOARD_SPEC.md` | Full admin dashboard tabs. | after F.1/F.2 |
| `PHASE_G1_BLUEPRINT_CREATOR_DASHBOARD_MAIN_SPEC.md` | Creator dashboard main view. | written |
| `PHASE_G2_BLUEPRINT_EDITOR_SPEC.md` | Full editor, variables, publish/update semantics. | after versioning/variables decisions |
| `PHASE_G3_CREATOR_INSIGHTS_EARNINGS_SPEC.md` | Subscribers, insights, earnings tabs. | after monetization decision |
| `PHASE_H_PUBLIC_ORG_CATALOG_SPEC.md` | Public JHU/org catalog, URL/SEO/newsroom. | after URL/content decisions |
| `PHASE_M_NURSING_INTEREST_CATALOG_SPEC.md` | Nursing catalog, specialty taxonomy, featured people/blueprints. | after taxonomy/ranking decisions |
| `PHASE_N_PROFILE_PUBLIC_DEFAULT_FIX_SPEC.md` | Production privacy fix for new users: `profiles.profile_public` and `sailor_profiles.is_profile_public` default false, app/onboarding defaults false, route guard. Existing users unchanged. | written; execute before May 20 |
| `PHASE_O_EXISTING_USER_PRIVACY_MIGRATION_SPEC.md` | Existing-user privacy migration after communication: set current public profiles private, including legacy sailor profiles. | post-May-20; write after Phase N ships |
| `PHASE_J_CREATOR_MENTORING_SPEC.md` | Mentoring screens and subscriber detail. | after mentoring monetization/permissions decisions |
| `PHASE_K_JHU_SSO_SPEC.md` | SAML/Shibboleth auth integration. | after JHU SSO requirement confirmed |
| `PHASE_L_SUGGEST_BAR_SPEC.md` | Suggest bar below zoomed-out view, accept/dismiss/save. | after C.5 |
| `PHASE_L5_SUGGESTION_AUTHORING_SPEC.md` | Mentor/creator authoring flow for suggestions. | after J and L |
| `PHASE_L6_SUGGESTION_NOTIFICATIONS_SPEC.md` | Notification trigger, routing, settings. | after L |
| `PHASE_L7_ALGORITHMIC_SUGGESTIONS_SPEC.md` | AI/algorithmic suggestion source and labeling. | after AI-suggestion product decision |

Total specs to write: 24.

## Section 4: Open Product Questions

### P0 — Decide Before May 20

**P0-01: Tab 1 canonical name across all interests**

**Background:** Tab 1, the primary action tab for the deliberate-practice engine, currently uses per-interest community vocabulary via `getEventTabTitle` in `lib/navigation-config.ts`. Today's visible labels are:

- Sailing -> `Race`
- Nursing -> `Clinical`, from the vocabulary override for `Learning Event` = `Clinical Shift`
- Drawing -> `Session`
- Other interests -> `Practice` by default

The A.10 resolution (`ec957e55`, 2026-05-15) explicitly preserved this per-interest model. The tab's identity is universal, but its visible label adapts to community vocabulary.

**Question:** Is per-interest labeling actually the right long-term choice, or should BetterAt converge on a single canonical name across all interests?

**Trade-off:** Per-interest labeling respects each community's actual language. A sailor sees `Race`; a nurse sees `Clinical`; a drawing user sees `Session`. This fits the user's mental model, but a multi-interest user sees the tab change names as they switch, and BetterAt becomes harder to explain externally as "the tab that is called Race, Clinical, Session, or Practice depending on context."

Single canonical naming gives visual consistency, is easier to learn, and is easier to market. The cost is semantic mismatch: the chosen word will feel slightly off for at least one community.

**Candidates considered:** `Practice` ties to deliberate-practice positioning but is slightly off for sailing. `Train` is action-oriented but sounds novice-coded for nursing. `Work` has broad craft/athletic fit but is generic. `Focus` captures intent but can feel business-like. `Steps` is literal but loses intent. `Today` is time-based and may imply too narrow a scope.

**Before deciding:** user-test candidates with at least two real users from different interests, for example a Dragon sailor and an MSN nursing student, by asking what they would expect a tab labeled each candidate to do. Run a quick competitive scan: Whoop uses `Coaching`, Strava uses `Feed`, Duolingo uses `Learn`, Headspace uses `Today`. Decide whether BetterAt's identity is best framed as deliberate practice, deliberate work, or another product language.

**Phases blocked:** none directly. The per-interest labels work today and can continue while execution proceeds. This decision affects marketing copy, onboarding, cross-product references in addendums/specs, and future Discover/Playbook copy that describes "your practice" versus "your work."

**Recommended owner:** Kevin. This cannot be specced or auto-decided; it needs user input and product judgment.

**Target decision date:** before May 20, ideally by May 18 so there are two days to update dependent user-facing copy.

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
11. Data model generalization from `seasons` to `series` is deferred. Phase I implements Series vocabulary as a presentation layer over the existing `seasons` / `season_regattas` model; see `specs/PHASE_I_SERIES_FEATURE_INTEGRATION_SPEC.md`. Revisit when a non-sailing interest demands interest-specific Series semantics.

### Social, privacy, and suggestions

12. Privacy default for new steps: private, followers, or public?
13. Follower approval: auto-approved, opt-in, mutual, or asymmetric?
14. Notification model: when followed people/blueprints log steps, what notifications fire?
15. Blueprint subscriber visibility: do creators see subscribers on their Profile?
16. Copy permissions: when copying someone else’s step, what content is copied?
17. Social discovery routing: how does Discover connect to follow/subscribe flows?
18. Suggest authoring: where does a mentor/peer create a suggestion?
19. Algorithmic suggestions: are AI suggestions allowed, and how are they distinguished?
20. Suggestion-to-blueprint pipeline: can repeated suggestions become blueprint candidates?
21. Cross-interest suggestions: can a source suggest steps outside the user’s active interest?
22. Save-for-later surface: where do saved suggestions live?

### Institutional, catalog, and tenant model

23. Org URL structure: `/jhu`, `/org/jhu-nursing`, or both?
24. Public catalog SEO/indexing requirements.
25. Newsroom content model: faculty posts, press, student spotlights, or something else?
26. Featured blueprint curation: algorithmic, editorial, or hybrid?
27. Nursing specialty taxonomy source: AACN, NCLEX, ANCC, or hybrid?
28. People-to-follow ranking method.
29. Default JHU invitation role: Preceptor or Member?
30. Cohort assignment timing: invite, first sign-in, or admin-assigned later?
31. JHU SAML/Shibboleth requirement and timeline.

### Blueprint creator and mentoring

32. Blueprint versioning: do existing subscribers auto-upgrade when creators edit?
33. Blueprint co-authoring: primary author plus contributors?
34. Step template variable notation and metadata schema.
35. Mentoring monetization: free, creator-tier paid, or subscriber-paid?
36. Reflection comment threading: can subscribers reply to creator comments?
37. Capability verification authority: peer/creator/institutional distinctions.
38. Mentor response-time commitments if mentoring is paid.

### Search and AI

39. AI Coach conversational flow is referenced but not fully designed.
40. Search is cited in multiple specs but no global search UX is designed.
41. Do and Reflect tab interiors are not yet designed to the same depth as Plan.

## Section 5: Cross-Cutting Concerns

### Per-Interest Configuration

Sailing and nursing already diverge in copy, timeline data, and capability semantics. Phase B intentionally normalizes phase-tab labels, but Plan/Do/Reflect interiors still need per-interest AI Coach prompts, capability taxonomies, and empty states. The implementation should avoid hardcoding sailing assumptions into the Practice shell.

### Per-Tenant Configuration

JHU surfaces imply tenant-scoped catalogs, admin dashboards, SSO, roles, cohorts, and visibility rules. Phase F/H/I/K specs need a shared tenant-config strategy instead of one-off `jhu` checks scattered through components.

### Feature Flags

The structural rule after the Race Prep regression is default OFF for substantive visual/interaction cutovers. Mechanical label changes may ship unflagged only when they are fully reversible by one commit and do not alter data, routes, control flow, persistence, or component mounting. Every future spec must explicitly state “default-OFF flag” or “mechanical-only exception.”

### Auth and Visibility

Privacy spans Plan/Do/Reflect, public Profile links, followers, peer suggestions, org catalogs, and mentoring. Do not let each feature invent visibility rules. A shared visibility model should precede Phase E/L/J production rollout.

### AI Coach

AI Coach is the primary path in Plan and likely appears in Add Step, suggestions, and future capability tagging. It has not been specced as a product surface. Phase B.5 can ship a constrained Plan-tab AI Coach entry, but a full AI Coach spec is needed before broad reuse.

### Capability Data Model

Phase D is foundational for Profile, tagging, verification, and institutional evidence. Concept detail’s data-layer pattern is the template: migration, read path, routing/derivation function, then visual cutover.

### No Preview Components in Production

All production render switches must import kit components or domain components, never preview-route components from `app/`. This rule came from the Reflect preview-data leak and applies to every future spec.

## Contradictions and Inconsistencies

1. **HTML canonical count resolved:** repo has 12 valid May 15 HTML canonicals. `discover-detail-trio-canonical.html` is included as part of the Discover implementation input.
2. **Flag policy resolved:** default-OFF flags are required for behavioral, layout, data, navigation, route, or data-model changes. Pure mechanical copy/label changes can ship unflagged only when reversible by one commit and no data/routes/control-flow/persistence/mounting changes are involved.
3. **Practice route naming resolved:** canonical product language and user-facing URL should be `/practice`; the existing `app/(tabs)/races.tsx` implementation may remain short-term behind a `/practice` alias/redirect. `/races` stays as backwards-compatible legacy, not canonical product URL.
4. **Discover source gap:** Discover visual canonical exists and older Discover architecture/spec docs exist, but the prompt’s “source spec documents” list does not include a new May 15 Discover addendum.
5. **Profile content gap narrowed:** Phase A made the bottom tab and heading say Profile. Phase B.12 now owns the v1 Profile credential surface behind a flag; Phase D remains the deeper data-model successor for durable evidence, endorsement, verification, and rollup optimization.
