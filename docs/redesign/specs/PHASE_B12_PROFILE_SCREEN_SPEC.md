# Phase B.12 — Profile Screen Implementation Spec

## Goal

Replace the current fourth-tab Profile content with the iOS-register credential surface from `profile-screen-canonical.html`: hero zone, interest switcher, capability map, capability evidence drilldown, public profile preview entry point, and profile settings sheet. This is a refactor of the existing Profile/Reflect infrastructure, not a greenfield profile system. The bottom tab already reads `Profile`; the route remains `app/(tabs)/reflect.tsx` for deep-link stability, and this phase swaps the Profile segment content behind `EXPO_PUBLIC_FF_PROFILE_SCREEN_IOS_REGISTER`.

The v1 goal is to make Profile feel like the user's evidence-backed credential without building the entire endorsement, verification, or capability-data v2 system. Capability state is read from existing competency/progress tables and step metadata where available; missing credential infrastructure renders as safe stubs.

## Source Canonicals

- Visual canonical: `docs/redesign/ios-register/profile-screen-canonical.html`
- Companion visual references: `docs/redesign/ios-register/reflect-tab-interior-canonical.html` Frame 3, `docs/redesign/ios-register/practice-timeline-canonical.html` Frame 4.
- Companion implementation specs: `PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md`, `PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md`, `PHASE_B11_DO_TAB_INTERIOR_SPEC.md`.
- Naming prerequisite: Phase A.7 / Phase A renamed the bottom `Reflect` tab to `Profile`; the implementation route remains `reflect`.

## Pre-Execution Reality Check

Before changing code, Claude Code must verify these paths and symbols against HEAD:

```bash
rg -n "PROFILE_IOS_REGISTER|ProfileScreen|useReflectProfileScreenData|ProfileView" app components hooks lib
rg -n "betterat_competencies|betterat_competency_progress|getUserCompetencyProgress|capability_progress|competency_assessment" services hooks components types
rg -n "profile_public|default_step_visibility|allow_peer_visibility|allow_follower_sharing|interest_visibility_defaults" services app/settings supabase/migrations
rg -n "username|handle|/person/|\\[userId\\]|/u/" app services supabase/migrations
rg -n "endorsement|endorse|organization_memberships|verified|membership" app components services hooks supabase/migrations
```

Verified current state from spec-writing pass:

- Current fourth-tab surface is `app/(tabs)/reflect.tsx`. The Profile segment mounts `components/ios-register/ProfileScreen.tsx` through `useReflectProfileScreenData()` when `FEATURE_FLAGS.PROFILE_IOS_REGISTER` is on, and falls back to legacy `ProfileView` when off. See `app/(tabs)/reflect.tsx:979`.
- Existing `components/ios-register/ProfileScreen.tsx` is identity/settings-oriented, not the new credential map. It exports profile hero, interests, identity, preferences, reflect settings, and plan types. Treat it as the prior kit component to preserve or replace behind the flag, not as the canonical B.12 implementation.
- Current Profile data adapter lives in `hooks/useReflectProfileScreenData.ts` and maps `useReflectProfile()` through `lib/reflect/mapReflectProfile.ts`. It derives handles from display name, not from a persistent username.
- User handles exist at the database layer via `users.username` (`supabase/migrations/20260326003812_add_username_to_users.sql`) with a unique lower-case index and format constraint. Execution must prefer `users.username` for public handles, then fall back to a non-public display-only derived handle.
- Public profile routing exists at `app/person/[userId].tsx`, keyed by UUID or sample slug. It is not the canonical `better.at/u/<handle>` route. Adding `/u/[handle]` is in scope only as a small wrapper/alias if it can resolve `users.username -> user.id` without schema changes.
- Privacy infrastructure exists in `services/PrivacySettingsService.ts`: `profile_public`, `default_step_visibility`, `allow_peer_visibility`, `allow_follower_sharing`, and `user_preferences.interest_visibility_defaults`.
- Interest switching exists through `useInterest()` / `userInterests` in `providers/InterestProvider.tsx`; Profile should use this for the pill row and active-interest capability map.
- Capability infrastructure is partial but real. `services/competencyService.ts` exposes `getUserCompetencyProgress(userId, interestId)` over `betterat_competencies` and `betterat_competency_progress`. Step-level metadata also includes `review.capability_progress` and `review.competency_assessment` in `types/step-detail.ts`.
- Endorsement persistence for Profile capabilities was not found. Treat endorsements as presentational disabled/coming-soon stubs in v1.
- Verified organization badges are partially represented by organization membership tables and hooks, but no user-facing verified context badge flow exists for `RHKYC · Member since 2024`. Treat verified context as display from existing memberships when available, otherwise stub.

If execution finds the above claims stale, stop and surface before editing.

## Commit Boundaries

### Commit 1: Flag, Types, and Read Adapter

Message:

```text
feat(profile): scaffold credential Profile adapter behind flag
```

Files:

- `lib/featureFlags.ts`
- `types/profile-credential.ts` or `lib/profile/profileCredentialTypes.ts`
- `hooks/useProfileCredentialData.ts`
- `lib/profile/mapProfileCredential.ts`
- Tests for pure mappers.

Add `EXPO_PUBLIC_FF_PROFILE_SCREEN_IOS_REGISTER`, default OFF.

Define the v1 render shape:

```ts
export interface ProfileCredentialHero {
  name: string;
  avatarUrl?: string | null;
  initials: string;
  username?: string | null;
  displayHandle: string;
  bio?: string | null;
  publicUrl?: string | null;
  verifiedContexts: ProfileVerifiedContext[];
}

export interface ProfileCredentialInterest {
  id: string;
  slug: string;
  label: string;
  active: boolean;
  evidenceCount: number;
}

export interface ProfileCapabilityCard {
  id: string;
  title: string;
  category: string;
  levelLabel: string;
  levelOrdinal: number;
  evidenceCount: number;
  latestEvidenceAt?: string | null;
  endorsedBy: ProfileEndorsementStub[];
  visibility: 'private' | 'followers' | 'public';
}

export interface ProfileEvidenceItem {
  id: string;
  phase: 'plan' | 'do' | 'reflect';
  title: string;
  quote: string;
  stepTitle: string;
  capturedAt?: string | null;
  source: 'plan' | 'do_capture' | 'reflect' | 'competency_progress';
}

export interface ProfileCredentialData {
  hero: ProfileCredentialHero;
  interests: ProfileCredentialInterest[];
  activeInterestId: string;
  capabilities: ProfileCapabilityCard[];
  evidenceByCapabilityId: Record<string, ProfileEvidenceItem[]>;
  privacy: ProfileCredentialPrivacy;
  loading: boolean;
  error?: Error | null;
}
```

Adapter inputs:

- `useAuth()` for `user` and `userProfile`.
- `useInterest()` for `userInterests`, `currentInterest`, and switching.
- `getUserCompetencyProgress(user.id, currentInterest.id)` for capability definitions and progress.
- User timeline data from existing timeline hooks or a new read-only query against `timeline_steps` for step evidence. Do not create new tables.
- `getPrivacySettings(user.id)` for privacy sheet defaults.

Mapping rules:

- Prefer `users.username` for `displayHandle` and `publicUrl`; if unavailable, render `@${slugifiedName}` as display-only and hide/caution the public URL action.
- Map `CompetencyStatus` to canonical labels:
  - `not_started` -> `Emerging`
  - `learning` -> `Emerging`
  - `practicing` -> `Developing`
  - `checkoff_ready` -> `Competent`
  - `validated` -> `Fluent`
  - `competent` -> `Expert`
- Count evidence from `timeline_steps.metadata.review.capability_progress`, `metadata.review.competency_assessment`, and B.11 flagged captures with `capability_label` when present.

### Commit 2: In-App Profile Landing

Message:

```text
feat(profile): add credential Profile landing
```

Files:

- `components/profile/ProfileCredentialScreen.tsx`
- `components/profile/ProfileHeroCard.tsx`
- `components/profile/ProfileInterestSwitcher.tsx`
- `components/profile/ProfileCapabilityMap.tsx`
- Component tests.

Render Frame 1:

- Hero with avatar/initials, name, bio, public URL display, and verified context row.
- Interest pill row backed by `userInterests`; tapping a pill switches the active interest using the existing interest provider or local Profile-only active state. Do not hardcode `Sail Racing`.
- Capability map for active interest. Use five visible cards when data exists; if fewer competencies exist, render what exists plus an empty-state card that says evidence accumulates from Plan / Do / Reflect.
- Activity/evidence strip can be derived from latest evidence items. If missing, show a canonical empty state rather than fixtures.

This commit must not replace public web routes or settings yet.

### Commit 3: Capability Evidence Drilldown

Message:

```text
feat(profile): add capability evidence drilldown
```

Files:

- `components/profile/ProfileCapabilityDrilldown.tsx`
- `components/profile/ProfileEvidenceCard.tsx`
- `lib/profile/profileEvidenceModel.ts`
- Tests for evidence grouping and phase-chip mapping.

Render Frame 2:

- Full-screen drilldown when a capability card is tapped.
- Evidence cards quote the user's own Plan / Do / Reflect material.
- Phase chips use the established Plan blue, Do coral, Reflect green semantics from B.5/B.10/B.11.
- If evidence comes from `betterat_competency_progress` with no quote, show a restrained metadata card and label the source as competency progress.

Do not implement endorsements here. Endorsement chips in the canonical render as disabled stubs with `Coming soon` accessibility hints.

### Commit 4: Public Profile Preview Route

Message:

```text
feat(profile): add public profile preview route
```

Files:

- `app/u/[handle].tsx` if the handle resolution is available.
- Or `app/person/[userId].tsx` only if `/u/[handle]` cannot be added safely.
- `components/profile/PublicProfilePreview.tsx`
- `services/ProfilePublicService.ts`
- Route/mapper tests.

Frame 3 is a web page, not an app tab. It should not render the bottom tab bar.

V1 routing:

- Preferred: add `/u/[handle]` and resolve `users.username` to `users.id`.
- Fallback: keep `/person/[userId]` as the only public route and render the `better.at/u/<handle>` UI disabled until username routing ships.

Privacy:

- Public preview must respect `profiles.profile_public`.
- Evidence detail must be collapsed by default.
- If `profile_public` is false or missing, public route renders a private-profile state.
- Do not expose private step quotes. Public evidence should only use steps whose visibility rules already allow sharing (`followers`, `organization`, or `public` depending on existing RLS and service behavior). If this cannot be guaranteed, ship Frame 3 as owner-only preview until a privacy read path is verified.

### Commit 5: Profile Settings Sheet

Message:

```text
feat(profile): add credential Profile settings sheet
```

Files:

- `components/profile/ProfileSettingsSheet.tsx`
- `hooks/useProfileCredentialData.ts`
- `services/PrivacySettingsService.ts` only if existing read/update helpers need small additions.
- Tests for privacy setting updates.

Render Frame 4:

- Public profile toggle.
- Evidence visibility selector.
- Endorsement preferences as disabled/presentational rows if no backend exists.
- Verified contexts section from organization memberships when available; otherwise present as `Not verified yet`.
- Per-interest visibility rows using `interest_visibility_defaults`.
- Open-to row as local/presentational unless a user-profile field already exists.

Defaults must be safe. The canonical says privacy defaults are safe: profile is opt-in and evidence detail hidden from public by default. The current `PrivacySettingsService` default is `profile_public: true`; execution must not rely on that default for new public credential UI. For B.12 UI, treat missing settings as public OFF until the user explicitly enables public profile.

### Commit 6: Wire Into Fourth Tab Behind Flag

Message:

```text
feat(profile): wire credential Profile screen behind flag
```

Files:

- `app/(tabs)/reflect.tsx`
- `hooks/useProfileCredentialData.ts`
- `components/profile/*`

Wiring rules:

- Keep route name `reflect`.
- Keep toolbar title `Profile`.
- Replace only the active Profile segment's flag-on body. Flag off must preserve the current `FEATURE_FLAGS.PROFILE_IOS_REGISTER ? <ProfileScreen ...> : <ProfileView ...>` behavior, or nest the new credential screen behind the new flag while preserving the current iOS Profile screen as fallback.
- Do not import from `app/profile-ios.tsx` or other preview routes. Production code imports only kit/domain components.

Recommended nesting:

```tsx
if (FEATURE_FLAGS.PROFILE_SCREEN_IOS_REGISTER) {
  return <ProfileCredentialScreen ... />;
}
if (FEATURE_FLAGS.PROFILE_IOS_REGISTER) {
  return <ProfileScreen ... />;
}
return <ProfileView ... />;
```

### Commit 7: Polish, Empty States, and Endorsement Stubs

Message:

```text
feat(profile): polish credential Profile states
```

Files:

- `components/profile/*`
- Tests/snapshots for empty states.

Finish:

- Empty capability map copy for users with no competencies.
- Disabled endorsement CTA behavior: either inline `Coming soon` toast/modal or hidden if product decides. Default recommendation: visible but disabled with explanatory text in the public preview, hidden in owner view.
- Loading and error states using `IOSRegisterErrorState`.
- Accessibility labels for capability cards, privacy toggles, and public URL copy.

## Files to Change

- `lib/featureFlags.ts`
- `app/(tabs)/reflect.tsx`
- New `components/profile/*` domain components.
- New `hooks/useProfileCredentialData.ts`.
- New `lib/profile/*` mapper/model files.
- Optional `services/ProfilePublicService.ts`.
- Optional `app/u/[handle].tsx` only if handle resolution can be safely implemented.
- Existing `services/PrivacySettingsService.ts` only for small API additions; no schema migration.
- Tests adjacent to the new hook/model/components.

## Files to NOT Change

- Do not modify `components/ios-register/ProfileScreen.tsx` unless execution deliberately wraps it as legacy fallback. Prefer new `components/profile/ProfileCredentialScreen.tsx`.
- Do not add endorsement tables.
- Do not add verified-organization schema.
- Do not add capability aggregation tables.
- Do not change Phase B.5, B.10, or B.11 specs.
- Do not rename `app/(tabs)/reflect.tsx`.
- Do not hardcode `Practice` / `Race` bottom-tab labels; A.10 per-interest vocabulary remains in force.
- Do not mount preview-route components from `app/` in production.

## Cutover Flag

Add `EXPO_PUBLIC_FF_PROFILE_SCREEN_IOS_REGISTER`, default OFF.

This phase changes a major production surface, public routing, privacy behavior, and component mounting, so the refined flag rule requires a default-OFF flag. Production enablement requires simulator verification of Frames 1, 2, and 4 plus browser verification of Frame 3.

## Test Approach

Unit/model tests:

- `mapCompetencyStatusToProfileLevel()` maps all `CompetencyStatus` values.
- `buildProfileCapabilityCards()` handles competencies with and without progress.
- Evidence extraction groups Plan, Do, Reflect, and `competency_progress` items by capability.
- Missing `users.username` hides or disables public URL actions.
- Privacy defaults for B.12 UI treat missing settings as public OFF.

Component tests:

- Profile landing renders hero, interest switcher, and capability cards from data.
- Capability drilldown renders phase chips and quotes.
- Settings sheet toggles call the correct privacy update callbacks.
- Public preview collapses evidence by default.

Simulator verification with flag ON:

1. Open fourth bottom tab (`Profile`).
2. Verify Frame 1: hero, interest pills, capability map, safe empty states if no evidence.
3. Switch interest; capability map changes without changing bottom-tab label assumptions.
4. Tap a capability; verify Frame 2 drilldown.
5. Open settings; verify Frame 4 sheet and privacy toggles.
6. Toggle public profile OFF and confirm public URL display is disabled or private.

Browser verification:

1. Open `/u/<username>` if implemented, or `/person/<userId>` fallback.
2. Verify no app tab chrome.
3. Verify private profile state when `profile_public` is false.
4. Verify evidence detail is collapsed by default.

Flag-off regression:

- With `EXPO_PUBLIC_FF_PROFILE_SCREEN_IOS_REGISTER=false`, the fourth tab must render exactly the current Profile segment path: existing `PROFILE_IOS_REGISTER` behavior if enabled, legacy `ProfileView` if not.

## Rollback

Flip `EXPO_PUBLIC_FF_PROFILE_SCREEN_IOS_REGISTER=false`. Because B.12 adds a new screen behind a flag and does not migrate schema, rollback is a flag flip plus optional revert of the B.12 commits. Public `/u/[handle]` route, if added, can remain hidden/unused while the flag is off.

## Risks

- Capability rollup performance: v1 read-time aggregation from `betterat_competency_progress` plus step metadata may be slow for users with large timelines. Batch queries and memoized pure mappers are mandatory; do not issue one query per capability card.
- Public profile privacy: `PrivacySettingsService` currently defaults `profile_public` to true. B.12 must override UI behavior to safe opt-in for the credential surface until product confirms global defaults.
- Public handle routing: `users.username` exists, but many users may not have a username. Public URL actions must degrade safely.
- Endorsements are stubs. A visible public `Endorse` CTA can create expectations; if product has not ratified stub behavior, hide it in owner view and label it coming soon in public preview.
- Verified context badges are stubs unless backed by existing organization memberships. Do not imply RHKYC/JHU verification unless the row exists.
- Evidence quality depends on B.11 and B.10. Without flagged Do captures or Reflect sections, Profile may show sparse capability evidence even if competency progress exists.

## Data Model Scope (Out of Scope for This Phase)

In v1:

- Hero data comes from existing `profiles` / `users` fields.
- Public handle uses existing `users.username` when present.
- Interest switcher uses existing `user_interests`.
- Capability map is derived from `betterat_competencies`, `betterat_competency_progress`, and step-level metadata.
- Evidence drilldown quotes existing Plan / Do / Reflect metadata where available.
- Privacy settings use existing `profiles` and `user_preferences` settings, with B.12 UI treating missing public-profile state as opt-in false.
- Endorsements and verified contexts are presentational stubs unless existing memberships/progress rows support them.

Deferred to v2:

- Durable capability evidence table with source IDs and visibility per evidence item.
- Capability rollup caching / aggregation table.
- Endorsement giving, receiving, persistence, moderation, and notifications.
- Verified organization claim and approval flow.
- Profile photo upload redesign.
- Structured `Open to` field.
- Public profile analytics.
- Handle reservation / onboarding flow for users missing `users.username`.

## Dependencies

- A.7 / Phase A Profile rename has shipped; bottom tab and heading already read Profile.
- B.11 Do Tab Interior should ship before B.12 if Profile is expected to count flagged Do captures as evidence. If B.12 executes first, it can still show competency/progress-derived cards, but Do-capture evidence will be sparse.
- B.10 Reflect Tab Interior improves Profile evidence quality but is not a hard dependency. Profile can read existing `metadata.review.sections`, `capability_progress`, and `competency_assessment`.
- Phase D capability data model is not required for B.12 v1. B.12 must document all stubs and avoid pretending v2 endorsement/verification semantics exist.

## Open Product Questions

- User handle source: require users to choose `users.username`, derive from email, or generate a suggested handle? Recommendation: require user confirmation before enabling public URL.
- Capability rollup definition: should level be table status, evidence count, recency-weighted evidence, or explicit user/faculty validation? Recommendation for v1: status first, evidence count second.
- Public profile default: opt-in or opt-out? Recommendation: opt-in for the credential surface, even if legacy privacy defaults are public.
- Endorsement stub behavior: visible coming-soon CTA, modal explainer, or hidden entirely in v1?
- `Open to` field: free text, structured tags, or hidden in v1?
- Verified context: self-attestation, admin verification, SSO/organization-membership proof, or hidden unless existing membership rows verify it?
- Public evidence visibility: can followers/org-only steps contribute aggregate counts without exposing quotes publicly?
