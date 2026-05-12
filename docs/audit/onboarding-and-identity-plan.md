# Onboarding & Identity Migration Plan

**Status**: Audit + migration plan, no code yet.
**Audited**: 2026-05-12 against `docs/redesign/betterat-redesign-spec.md`, `addendum-2026-05-12-late.md`, and the decisions log.
**Scope**: Auth providers, user/profile schema, post-signup flow, interest/path/cohort access, trial gating, and six user segments.

---

## 1. Current state

### 1.1 Auth & identity

`providers/AuthProvider.tsx`:
- Email + password via Supabase Auth.
- OAuth: Google + Apple (native + web flows). Native Apple uses bundle id audience per `feedback_supabase_apple_audience_rebrand.md`.
- Username-based fallback: faux email `${normalized}@users.regattaflow.io` if user signs up with a username only.
- Three personas captured at signup: `sailor` / `coach` / `club`, stored as `users.user_type`.
- 14-day Pro trial set inline at signup for sailors: `subscription_tier: 'individual'`, `subscription_status: 'trialing'`, `trial_started_at`, `trial_ends_at`.
- Additive `user_capabilities` table for capabilities like `'coaching'`.
- Guest mode (`enterGuestMode`) backed by `GuestStorageService` — local-only state.
- Firebase auth bridge (`lib/auth/firebaseBridge.ts`, `supabase/functions/firebase-auth-bridge`) — exchanges a Firebase ID token from Dragon Worlds for a Supabase session, with optional `communitySlug` for auto-join. Bridge tokens carried through URL params for WebView embedding.
- **No phone+OTP** — `Grep` for `signInWithOtp` / `verifyOtp` returns zero hits in `providers/`.

### 1.2 Signup form (`app/(auth)/signup.tsx`)

- Two-step flow inside the screen: `interest` picker → `persona` + form.
- Reads URL params: `persona`, `interest`, `inviteToken`, `plan`, `org`, `orgName`, `returnTo`.
- Stashes context into AsyncStorage: `onboarding_interest_slug`, `onboarding_org_slug`, `pending_invite_token`, `post_onboarding_return_to`.
- Post-signup routing:
  - `sailor` → `/onboarding/trial-activation`
  - `club` → `/(auth)/club-onboarding-chat` (with interest if known)
  - invite token → `/invite/[token]`
- Sets profile via `OnboardingStateService.setUserInfo` + `completeStep('profile-setup')`.

### 1.3 Post-signup state

`services/onboarding/OnboardingStateService.ts`:
- AsyncStorage-backed, per-user keys.
- `POST_SIGNUP_STEPS = ['name-photo']` — minimal post-signup flow, deferring boat/club into in-app prompts.
- Tracks `hasSeenOnboarding`, `markOnboardingSeen`, `cacheUsername`.

Onboarding routes (`Glob`):
- `app/(auth)/{sailor-onboarding-comprehensive, club-onboarding-*, coach-onboarding-*, org-welcome, login, signup, callback}`
- `app/onboarding/{index, value/*, profile/name-photo, first-activity/race-calendar, org-welcome, org-discovery, pricing, explore-interests, welcome-back, trial-activation}`

This is **substantial** existing onboarding code — not "doesn't exist meaningfully". It is *fragmented* across personas and route trees, and not yet aligned to the spec's interest-first / path-first subscription model.

### 1.4 Interests, paths, cohorts

- **Interests**: `user_interests` table (`20260331140000_create_user_interests.sql`) — users explicitly add interests. RLS lets faculty/admin read their org members' interests for dashboards.
- **User-proposed interests**: `20260413140000_user_proposed_interests.sql` lets users propose new interests; query key needs userId per `feedback_interest_query_key_needs_userid.md`.
- **Paths (blueprints)**: `timeline_blueprints` + `blueprint_subscriptions` + `blueprint_step_actions` (`20260322140000_create_blueprint_subscriptions.sql`). Blueprint owner publishes; subscribers get notified on new public steps via trigger; subscribers can `adopt`/`dismiss`/`seen`. `auto_adopt` flag exists. Unique key is `(user_id, interest_id)` per blueprint — one blueprint per (author, interest) pair.
- **Cohorts (org programs)**: `program_interests_and_enrollment`, `program_capability_blueprints`, `organization_subscriptions` migrations exist. Faculty read paths exist (`faculty_read_member_steps`, `faculty_cohort_competency_read`).
- **Organization memberships**: `organization_memberships.status` vs `membership_status` split is a known pitfall (`feedback_membership_status_split.md`). Invites infrastructure exists: `create_organization_invites`, `invite_tokens_and_role_presets`, `org_invite_invitee_status_updates`, `org_invite_completion_flow`, `harden_org_invite_rls`, `enforce_org_invite_role_issuance`, `invite_token_lookup_by_id_rpc`, `org_invite_notifications`.
- **Dragon Worlds cross-promo**: `firebase-auth-bridge` edge fn + `lib/auth/firebaseBridge.ts` already exchange tokens and auto-join a `communitySlug`. `DRAGON_WORLDS_COMMUNITY_SLUG = '2027-hk-dragon-worlds'`. Seed scripts: `scripts/seed-dragon-worlds-2027.mjs`. `HKDWWelcomeCard` component. `app/dragon-worlds-privacy.tsx` exists.

### 1.5 Trial gating

- Trial set at signup, no gate enforcement found in this audit beyond the row state — feature gates live downstream in components that read `subscription_status` / `trial_ends_at`. Spec frames trial as time-bounded but doesn't currently restrict capability.

---

## 2. Redesign target — concise

Per spec + late addendum:

- **Identity-first onboarding**: interest selection happens *during* signup, but interest is a *promise* (not a hard-bound commitment). Users can switch active interest in profile/settings.
- **Four-tier verbs**: add interests, **join** orgs, **subscribe** to paths/programs, **follow** people (per `feedback_interest_terminology.md`).
- **Org-join onboarding**: after accepting an org invite, surface a catalog of programs/people to follow (per memory `project_org_join_onboarding.md`).
- **Real + sample timelines** on org catalog (per memory `project_real_timelines_alongside_sample.md`).
- **Post-signup experience v2**: richer welcome — org context, peer discovery, interface tour, privacy, interest cleanup (per memory `project_post_signup_experience_v2.md`).
- **Trial** stays in shape; spec doesn't materially redesign it.

---

## 3. Delta analysis

| Concern | Current | Target | Gap |
|---|---|---|---|
| Auth methods | Email/PW, Google, Apple, faux-email username, Firebase bridge | Same + **phone+OTP** for dev-context (Hindi/voice-first/CRP-assisted) | **Missing**: phone+OTP path |
| Personas | sailor / coach / club | Generic learner; coach/club capabilities additive | Already mostly there via `user_capabilities`; signup UI still asks |
| Interest at signup | Picker → AsyncStorage stash → trial-activation | Same flow, but write through `user_interests` deterministically, not via AsyncStorage roundtrip | Race risk: AsyncStorage as primary source of truth between signup and onboarding |
| Org invite acceptance | `pending_invite_token` AsyncStorage → `/invite/[token]` | Plus catalog of programs/people post-acceptance | Catalog screen exists (`app/onboarding/org-welcome`, `org-discovery`) — needs to plug into accept flow |
| Path subscription via author | `blueprint_subscriptions` works; subscribers auto-notified | Bring user in via subscription link; gate visibility on author publish state | Plumbing exists; entry flow not unified with signup `?blueprint=` param |
| Group-invited non-user (read-only) | No anonymous step view; invite implies account creation | Read-only token-scoped step view for non-account viewers | **Missing**: no read-only RLS path for non-auth users |
| Dragon Worlds cross-promo | Firebase bridge + auto-community-join | Auto-enroll in Worlds prep cohort, not just community | Partial — bridge auto-joins community, not yet program |
| Trial enforcement | Row flags only | Spec keeps row flags | Aligned |

### 3.1 Six user segments

| Segment | Buildable today? | What exists | Gap |
|---|---|---|---|
| **Individual consumer** | ✅ Yes | Email/Google/Apple signup, interest picker, sailor persona, 14-day trial | None blocking; align onboarding routes to spec v2 |
| **Institutional cohort (SSO/invited)** | ⚠️ Mostly | Invite token infra, org_memberships, faculty RLS, club-onboarding routes | No SSO (SAML/OIDC) — only OAuth; if institutions require SAML this is a real gap. Org-welcome catalog exists but doesn't surface programs/people consistently |
| **Path subscriber via author** | ⚠️ Mostly | `timeline_blueprints` + `blueprint_subscriptions` + notification trigger; signup has `returnTo` param to redirect to blueprint page | No first-class `?blueprint=` signup entry; subscription happens post-trial-activation rather than during signup commitment |
| **Group-invited non-user (read-only)** | ❌ No | Invite token system requires account creation; `visibility` enum is `private/followers/coaches/organization` — no `public_token` option | Need: token-scoped read-only views, share-link RLS, signed URL flow |
| **Dev-context user (phone+OTP, CRP-assisted, voice-first)** | ❌ Phone+OTP missing; ⚠️ CRP-assisted partially | Voice ingest exists (Telegram/WhatsApp), AsyncStorage state | Need: `supabase.auth.signInWithOtp({ phone })` flow, CRP-as-proxy user model (CRP creates account *for* a learner?), Hindi i18n on onboarding strings (`lib/i18n` exists, coverage unknown) |
| **Dragon Worlds cross-promo (auto-enroll in Worlds prep)** | ⚠️ Mostly | Firebase bridge auto-joins community; HKDWWelcomeCard | Need: extend bridge to auto-enroll into the Worlds-prep *program* (not just community), surface prep-cohort welcome distinct from generic welcome |

---

## 4. Migration sequence (6 incremental steps)

### Step 1 — Stabilize current paths before redesigning (1–2 days)

Per the D2 readers audit (`docs/audit/d2-asyncstorage-onboarding-audit.md`), the ad-hoc onboarding keys are:

| Key | Status after Step 1 |
|---|---|
| `onboarding_interest_slug` | Refactor — dual-write to `user_interests`, then cut over |
| `onboarding_interest_order` | **Preserve as-is** (transient UI ordering hint, used by `manifesto.tsx` + `choose-start.tsx`) |
| `onboarding_org_slug` | Preserve (nav hint) |
| `post_onboarding_return_to` | Preserve (nav hint) |
| `pending_invite_token` | **Delete** — confirmed dead code (written 3× in `signup.tsx`, never read anywhere; `app/invite/[token].tsx` does no AsyncStorage) |
| `FLOW_KEY` constant in `OnboardingStateService` | **Delete** — defined, never used |

Before adding flows, fix the AsyncStorage-as-truth pattern in `signup.tsx`:
- Move `onboarding_interest_slug` → write directly to `user_interests` at sign-up success (already protected by RLS), dual-writing AsyncStorage for one release per D2 decision.
- Keep `onboarding_interest_order`, `onboarding_org_slug`, and `post_onboarding_return_to` in AsyncStorage (navigation/UI hints, not data of record).
- Delete `pending_invite_token` writes and the `FLOW_KEY` constant.
- Add idempotency guards so repeated sign-up clicks don't double-insert.

**Resolves OAuth callback bypass**: D2 surfaced that `signup.tsx`'s Google/Apple branches write 4 AsyncStorage keys, but OAuth redirects through `app/(auth)/callback.tsx`, which only reads `post_onboarding_return_to` — so the interest-slug writes on social paths may never fire. Moving `onboarding_interest_slug` to a server-side `user_interests` insert at auth-success time eliminates this bypass: the commit point becomes the auth event itself, not a pre-redirect AsyncStorage write. Step 1's dual-write **is** the fix for the OAuth callback bypass.

**Exit**: Interest exists in `user_interests` after signup before any further screen renders, for both email and OAuth paths. AsyncStorage holds nav/UI hints only. Dead keys removed.

### Step 2 — Unify org-invite landing into spec'd post-accept catalog (3–5 days)

- Wire `/invite/[token]` accept flow to land on `app/onboarding/org-welcome` with `org-discovery` (programs + people) catalog instead of bouncing straight to home.
- Implement "real timelines alongside sample" per memory `project_real_timelines_alongside_sample.md`.
- Make the catalog reachable from existing `/onboarding/org-welcome` route — no new routes needed.

**Exit**: Institutional-cohort segment lands on a catalog post-acceptance with both real and sample timelines.

### Step 3 — Path-subscriber entry flow (2–3 days)

- Accept `?blueprint=<slug-or-id>` on `/(auth)/signup` and on `/login`.
- After auth success, create the `blueprint_subscriptions` row before navigating to trial-activation.
- Bring blueprint context badge into the signup screen (it currently only shows `orgName`).

**Exit**: A user clicking a published-blueprint share link signs up and is auto-subscribed.

### Step 4 — Read-only share link for non-user viewers (5–7 days)

This is the biggest new piece — addresses **group-invited non-user**.
- Add a `share_tokens` table keyed on `(target_type, target_id, token, scope, expires_at)`. Scope examples: `step:read`, `blueprint:read`.
- Build a public render path (route under `app/share/[token]`) gated on `share_tokens` validity, no auth required.
- RLS: SECURITY DEFINER RPC that returns the redacted target row when token valid (avoid policy recursion per `feedback_rls_cross_table_recursion.md`).
- Add "Convert to account" CTA on the share view linking back to `/signup?returnTo=<share-url>`.

**Exit**: A coach/parent can be linked into a specific step or blueprint without an account, and convert if interested.

### Step 5 — Phone+OTP path for dev-context (3–4 days)

- Add `supabase.auth.signInWithOtp({ phone })` + verify flow into `AuthProvider`.
- New onboarding entry: phone number → OTP → name → interest, persona defaults to `sailor`.
- Hindi i18n pass on the relevant strings (audit `lib/i18n` coverage first).
- CRP-assisted variant: a flag/role on the *helping* user account that lets them complete onboarding *for* a learner with their consent — leave this out of v1; phone+OTP unblocks the core dev-context segment without it.

**Exit**: A user in a dev-context with only a phone and partial literacy can sign up via phone, pick an interest, and reach the timeline. Hindi-localized.

### Step 6 — Dragon Worlds auto-enroll into prep program (1–2 days)

- Extend `firebase-auth-bridge` edge fn to accept an optional `programSlug` alongside `communitySlug`, or hardcode the Worlds-prep program slug when `communitySlug === '2027-hk-dragon-worlds'`.
- On bridge success, insert into the program-enrollment table for the prep cohort.
- Replace `HKDWWelcomeCard` content / route to land on a prep-cohort-specific welcome (which is already half-built via `org-welcome` flow from Step 2).

**Exit**: A Dragon Worlds user crossing into RegattaFlow lands inside the Worlds prep program, not just the community.

---

## 5. Resolved decisions

All resolved 2026-05-12. See `docs/audit/decisions-to-make.md` for full rationale.

| # | Decision | Locked answer | Affects |
|---|---|---|---|
| D12 | SAML/SSO | Google Workspace OAuth only; confirm with JHU IT first | Step 2 sufficiency |
| D11 | CRP-assisted onboarding | v1: learner owns account. Long-term: dual-keyed CRP role (separate build) | Step 5 / dev-context pilot |
| D8 | Persona pill at signup | Remove pill; default learner; org-setup via separate entry | Step 1 polish |
| D10 | Read-only share scope | Steps + blueprints only, revocable, optional expiry, unguessable tokens, rate-limited | Step 4 schema |
| D9 | `user_type` column | Retain; do not migrate now | Step 1 cleanup |
| D2 | AsyncStorage migration safety | Audit readers, then dual-write for one release before cutover | Step 1 safety |
| D13 | Trial gating | Soft gate at day 14 (nudges/banners); confirm pricing intent | Cross-cutting / out of current scope |

---

## 6. Risks

- **AsyncStorage source-of-truth fragility** (Step 1): some downstream onboarding screens read `onboarding_interest_slug` instead of querying `user_interests`. Step 1 must change both sides atomically, or screens will look empty after the move. Mitigation: keep dual-write for one release.
- **Invite token race** (Step 2): user signs up → sets `pending_invite_token` → app reloads before navigation completes → token lost. Mitigation: persist accept attempt server-side once the account exists.
- **Blueprint subscription before account confirmation** (Step 3): OAuth flow returns to the app at a different surface than email signup; subscription insertion must happen at a single post-auth callback, not in signup.tsx.
- **Public share-token abuse** (Step 4): unsigned tokens are vulnerable to enumeration. Mitigation: 32-byte tokens, rate-limit the share resolver, log resolution attempts.
- **Phone+OTP spam** (Step 5): SMS costs and abuse vectors. Mitigation: Supabase has built-in rate limits but country-level allowlist may be needed for cost; rolling out to India first means whitelisting +91.
- **Firebase bridge auto-enroll** (Step 6): if the program insert fails, the user is still authed but missing program membership — they land somewhere broken. Mitigation: idempotent retry on next app open, with a banner if program enrollment is missing.
- **Membership status split** (cross-cutting): `feedback_membership_status_split.md` — every new query against `organization_memberships` must check both `status` and `membership_status`. Easy to miss.
- **Cross-table RLS recursion** (cross-cutting): `feedback_rls_cross_table_recursion.md` — Step 2 and Step 4 will likely need SECURITY DEFINER helpers to avoid recursion errors.

---
