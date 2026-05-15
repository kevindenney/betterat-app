# iOS Register Data-Layer Dependencies

## Discrepancies

- Prior audit state said Profile iOS was pending. Current repo state has Profile staged in `505de4e3` and wired to real production data in `fed19b1a` + `50b9e9fc`.
- Trophy handoff language says "4 variants", but current code exposes five `TrophyVariant` values: `first`, `canonical`, `mid-career`, `named-absence`, and `empty`.
- Trophy of Becoming is documented as a cutover, but repo investigation found no production render path and no trophy data layer. It is a first-ship surface blocked on data, not a register migration.

## Summary

| Surface | Render-blocking dependencies | Variant-blocking dependencies | Follow-up dependencies | Ship-readiness verdict |
|---|---:|---:|---:|---|
| Reflect production data wiring | 0 | 0 | 5: filter persistence, season picker, Profile preference writeback, billing source, richer non-sailing profile stat labels | ready |
| Race Log iOS | 0 | 0 | 2: filter persistence, search/index refinements | ready |
| Profile iOS | 0 | 0 | 5: preferences writeback, plan billing source, privacy/private-mode source, account action wiring, non-sailing stat labels | ready |
| Get Inspired running state | 0 | 0 | 1: real progress events | ready |
| Discover tab iOS | 0 | 1: shared Discover graph adapter | 3: richer activity signals, direct org-topic model, editorial topics model | blocked-on-adapter-work |
| Trophy of Becoming iOS | 3: trophy record, synthesis service/API, production entry point | 4: sequence index, named-absence classifier, series context, empty-state rule | 2: synthesis quality metrics, share/view instrumentation | blocked |
| Concept detail iOS | 0 | 1: `playbook_concept_user_state` + derived linked-reflection metrics | 2: breakthrough detector, Work-mode state/actions | blocked-on-data-work |

Verdict counts: 4 ready, 0 partial, 3 blocked or blocked-on-data/adapter-work.

## Reflect Production Data Wiring

### Data dependencies (rendering)

- Race/Shift Log: production `app/(tabs)/reflect.tsx` now mounts `RaceLogScreen` with `useReflectLog()`. Sailing uses race-domain tables; nursing and other non-sailing interests use `timeline_steps` scoped by `currentInterest.id`.
- Profile: production `app/(tabs)/reflect.tsx` now mounts `ProfileScreen` with `useReflectProfileScreenData()`, which maps `useReflectProfile()` plus `InterestProvider.userInterests`.

Rendering blocker: no. The original preview-wrapper production leak is resolved in `a6031f1e`, `fed19b1a`, and `50b9e9fc`. No schema migration was needed.

### Data dependencies (variant routing)

- Race/Shift Log has interest-aware mapping into `RaceLogSeason[]`, `RaceLogFilterChip[]`, and empty-state copy.
- Profile has no variants.

Variant blocker: no. The Race/Shift mapping is implemented in the production adapter.

### Current data-layer state

- Work plan: `docs/redesign/REFLECT_DATA_WIRING_WORK.md`.
- Log adapter: `a6031f1e`.
- Profile adapter: `fed19b1a`.
- Reflect production wiring: `50b9e9fc`.

### Blocking status

Resolved. Race Log/Profile can be treated as shipped from a data-wiring standpoint; remaining items are follow-ups, not blockers.

## Race Log iOS

### Data dependencies (rendering)

- Race list data: existing `hooks/useReflectData.ts` fetches `regattas` for the current user and maps them to `RaceLogEntry[]`.
- Result data: existing `race_participants` query returns finish position/status.
- Time data: existing `race_timer_sessions` query returns on-water time for Reflect progress metrics.

Rendering blocker: no. Reflect cutover `3d8b45dc` originally mounted `RaceLogIosPreview`, but production wiring now uses `RaceLogScreen` with `useReflectLog()`.

### Data dependencies (variant routing)

- `RaceLogScreen` wants iOS-register statuses: `debriefed`, `in_progress`, `current`, `planned`.
- Existing `useReflectData` returns `finished` or `upcoming` status, plus participant finish data.
- Season grouping is not returned by the hook. Current data is flat and can be grouped client-side by `start_date`.

Variant blocker: no for v1. The production adapter groups client-side and maps available race/timeline statuses into the iOS-register row states. Finer `current` / `in_progress` semantics remain a follow-up if they need stronger source data.

### Data dependencies (instrumentation / follow-up)

- Filter persistence for "This year", class scope, and season picker.
- Search/index refinements beyond local filtering.

### Current data-layer state

- Schema/API exists through `regattas`, `race_participants`, and `race_timer_sessions`.
- Hook exists: `useReflectData`.
- Existing UI consumes it in `app/(tabs)/reflect.tsx` through `RaceLogView`.

### Blocking status

No schema-level render-blocking data dependency. Race Log production data wiring is complete; follow-ups are filter persistence, season picker interactivity, and search/index refinements.

## Profile iOS

### Data dependencies (rendering)

- Identity: `profiles` and auth user metadata exist; `useReflectProfile` queries `profiles(id, full_name, email, created_at)`.
- Sailor profile extension: `sailor_profiles` exists; `useReflectProfile` queries avatar/bio/location/home club fields.
- Interests: `user_interests` and `interests` exist; current Profile preview uses sample chips, but data sources exist elsewhere in the app.
- Account/payment: subscription services and `subscriptions` queries exist, but the preview currently uses sample plan copy.

Rendering blocker: no. The Reflect iOS-register branch now uses `ProfileScreen` with `useReflectProfileScreenData()` instead of `ProfileIosPreview`.

### Data dependencies (variant routing)

Profile has no state variants in the staged design.

Variant blocker: no.

### Data dependencies (instrumentation / follow-up)

- Preferences writeback for wind unit, distance unit, notifications, appearance, language, capture style, weekly digest, resurface-old-captures, and private mode.
- Billing plan source and manage-plan action.
- Account export/privacy/help/sign-out/delete-account actions.
- Private-mode semantics and persistence.

### Current data-layer state

- Profile staging landed in `505de4e3`: `app/profile-ios.tsx`, `components/ios-register/ProfileScreen.tsx`, `PROFILE_IOS_REGISTER`, and exports.
- Existing Reflect profile data hook: `hooks/useReflectProfile.ts`.
- Production adapter: `hooks/useReflectProfileScreenData.ts` and `lib/reflect/mapReflectProfile.ts` landed in `fed19b1a`.
- Production Reflect wiring landed in `50b9e9fc`.
- Supporting schema references exist for `profiles`, `sailor_profiles`, `user_preferences`, `user_interests`, `interests`, and subscriptions/payment services.

### Blocking status

No schema-level render-blocking data dependency found. Profile production data wiring is complete; preference writeback, billing source, account actions, private-mode persistence, and richer non-sailing stat labels remain follow-ups.

## Get Inspired iOS Running State

### Data dependencies (rendering)

- User input: `InspirationCaptureStep` owns the submitted URL/text/description in local state.
- Existing interests: `InspirationWizard` passes `userInterestSlugs` into `InspirationCaptureStep`.
- Long-running extraction call: `InspirationCaptureStep.handleAnalyze` calls `extractInspiration(...)`, which invokes the `inspiration-extract` Supabase edge function.

Rendering blocker: no. The running state can render from local input plus local loading state.

### Data dependencies (variant routing)

- The staged running surface expects a multi-step narration sequence.
- Current pipeline does not emit progress events. Existing UI fakes progress with a 3-second timer cycling `Reading content...`, `Extracting skills...`, `Building your plan...`.
- The edge function returns only the final extraction or an error.

Variant blocker: no. Decision resolved in `docs/redesign/GET_INSPIRED_CUTOVER_PLAN.md`: ship timer-based narration for this cutover and treat real progress events as a follow-up.

### Data dependencies (instrumentation / follow-up)

- Real progress events from the edge function, if the pipeline later exposes stage-level callbacks.
- No background job/result persistence is required. Stop semantics are resolved as request cancellation; the result remains in-memory and only advances to review-interest when the user keeps the modal open through completion.

### Current data-layer state

- Edge function exists: `supabase/functions/inspiration-extract/index.ts`.
- Client service exists: `services/InspirationService.ts`.
- Existing result path exists: extraction success advances to `InspirationInterestStep`; activation success advances to `InspirationSuccessStep`.
- No streaming/progress API exists.

### Blocking status

No render-blocking or variant-blocking data dependency. The cutover is ready from a data-layer standpoint; remaining work is source-level routing, abort plumbing, and canonical error-state rendering.

## Trophy of Becoming iOS

### Data dependencies (rendering)

- Trophy record for a completed path/user.
- Path-completion synthesis service/API that produces a quote, attribution, capability label, and context spans.
- Production entry point to open the trophy artifact.

Rendering blocker: yes. None of these exist in current repo state.

### Data dependencies (variant routing)

- First trophy detection: sequence index or trophy count.
- Canonical trophy data: filled trophy record with quote/capability/context.
- Mid-career carousel: total count, current index, previous availability.
- Named absence: classifier or field distinguishing stopped-doing trophies.
- Empty: explicit absence rule when no trophy exists.

Variant blocker: yes. The preview route has sample fixtures only.

### Data dependencies (instrumentation / follow-up)

- Synthesis quality metrics.
- Share/view/download instrumentation for the generated artifact.

### Current data-layer state

- No `trophy_of_becoming` table found.
- No Trophy service, hook, API route, or Supabase function found.
- No production route imports `TrophyScreen`.
- Existing `/trophy-ios` route is preview-only with sample fixtures.

### Blocking status

Blocked. Trophy cannot ship until the path-completion trophy data layer and production entry point exist.

## Discover Tab iOS

### Data dependencies (rendering)

- Organizations: existing `organizations` rows with `id`, `name`, `slug`, `join_mode`, `interest_slug`, and `is_active`.
- People: existing `profiles` rows plus privacy fields (`profile_public`, `allow_follower_sharing`).
- Topics UI: existing `communities` rows; v1 intentionally maps UI `Topic` to schema `communities`.
- Relationship state: existing `organization_memberships`, `user_follows`, `community_memberships`, and `venue_discussions`.

Rendering blocker: no new table. The raw data exists, but the Discover cutover is blocked until the shared graph adapter lands so six surfaces do not duplicate raw join queries.

### Data dependencies (variant routing)

- No visual variant state like Concept detail.
- Cross-reference routing depends on the shared graph adapter: org ↔ people, org ↔ topics, person ↔ orgs, person ↔ topics, topic ↔ people, topic ↔ orgs.

Variant/cross-reference blocker: yes. Required work plan: `docs/redesign/DISCOVER_GRAPH_ADAPTER_WORK.md`.

### Data dependencies (instrumentation / follow-up)

- Richer activity copy beyond existing counts.
- Direct org-topic relationship model if product needs real org/topic affinity instead of shared-interest derivation.
- Separate editorial `discover_topics` model if product later distinguishes Topic from Forum/Community.

### Current data-layer state

- Existing tab route: `app/(tabs)/discover.tsx`.
- Existing org service: `services/OrganizationDiscoveryService.ts`.
- Existing community hooks/service: `hooks/useCommunities.ts`, `services/community/CommunityService.ts`.
- Existing people discovery hook: `hooks/useSailorSuggestions.ts`.
- Existing base tables: `organizations`, `organization_memberships`, `profiles`, `user_follows`, `communities`, `community_memberships`, `venue_discussions`, `timeline_steps`.

### Blocking status

Blocked on adapter work, not schema. Execute the three pre-cutover specs in `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_*.md` before the Discover visual render switch.

## Concept Detail iOS

### Data dependencies (rendering)

- Concept record: `playbook_concepts` exists with `title`, `body_md`, `summary`, `origin`, timestamps, and related concept IDs.
- Concept query: `usePlaybookConceptBySlug` exists and powers `app/concept-ios/[slug].tsx`.
- Reflection trail: current route uses `useMyTimeline` and heuristics to build a trail.

Rendering blocker: no. The current route already renders real concept data.

### Data dependencies (variant routing)

- Per-user concept state: resolved work plan creates `playbook_concept_user_state` keyed by `(user_id, playbook_id, concept_id)` with `progression_state`, `breakthrough_detected_at`, `breakthrough_dismissed_at`, `breakthrough_evidence`, and `last_state_computed_at`.
- Dormancy data: resolved formula uses derived linked-reflection metrics from `step_playbook_links(item_type='concept')` joined to completed `timeline_steps`: `total_linked_reflections`, `first_reflection_at`, `last_reflection_at`, and `median_inter_reflection_interval_days`.
- Mature non-dormant fallback: resolved as standard practicing chrome, not `new` and not `breakthrough`.

Variant blocker: yes until the data-layer work in `docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md` lands. The cutover should not ship with fixture or heuristic variant routing now that the data-layer work is specified.

### Data dependencies (instrumentation / follow-up)

- Breakthrough detector/clustering job that writes `breakthrough_detected_at` and `breakthrough_evidence`.
- Work-mode state/actions after Read-mode cutover.

### Current data-layer state

- Schema exists for base concept rendering: `playbook_concepts`.
- Hook exists: `usePlaybookConceptBySlug`.
- Existing iOS-register route exists: `app/concept-ios/[slug].tsx`.
- Variant preview exists in current working tree: `app/concept-detail-ios.tsx`.

### Blocking status

Blocked on data-layer work for variant routing, not on base rendering. Required work plan: `docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md`.
