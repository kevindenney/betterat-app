# D2 — AsyncStorage Onboarding State Audit

**Status**: Reconnaissance complete. No code changes made.
**Audited**: 2026-05-12
**Purpose**: Unblock Onboarding Step 1 (decision D2: audit readers before moving `onboarding_interest_slug` to `user_interests` as source of truth).

---

## 1. Inventory — every onboarding-related key

### 1.1 Ad-hoc signup-context keys (raw `AsyncStorage` calls, no service wrapper)

| Key | Purpose | Class |
|---|---|---|
| `onboarding_interest_slug` | Interest the user picked at signup | **Data of record** — committed to `user_interests` later |
| `onboarding_interest_order` | Interest priority order from explore-interests | Transient — UI ordering only, never committed to DB |
| `onboarding_org_slug` | Org the user is joining at signup | Routing hint — read for org-aware screens, never committed |
| `pending_invite_token` | Invite token for accepting after signup | **Dead code** — written 3× in signup.tsx, never read anywhere |
| `post_onboarding_return_to` | Where to redirect after onboarding completes | Routing hint |
| `pending_blueprint_purchase` | Blueprint slug to resume purchase after auth | Adjacent flow (blueprint), not strictly onboarding |

### 1.2 `OnboardingStateService` keys (wrapped, defined in `services/onboarding/OnboardingStateService.ts`)

| Key | Purpose |
|---|---|
| `regattaflow_onboarding_state` | Step state JSON (currentStep, completedSteps, preferences) |
| `regattaflow_onboarding_flow` | Defined but unused — see findings |
| `regattaflow_onboarding_seen` | Returning-user flag |
| `regattaflow_cached_username` | Welcome-back screen UX |

### 1.3 `FeatureTourService` keys (`services/onboarding/FeatureTourService.ts`)

| Key | Purpose |
|---|---|
| `regattaflow_feature_tour_completed` | Tour completion flag |
| `regattaflow_feature_tour_step` | Current tour step |
| `regattaflow_feature_tour_started` | Tour started flag |
| `regattaflow_feature_tour_pricing_prompt_seen` | Pricing prompt suppression |

### 1.4 `ContextualHintStorageService` keys (`services/onboarding/ContextualHintStorageService.ts`)

| Key | Purpose |
|---|---|
| `regattaflow_contextual_hints_v1` | Per-hint dismissal state |
| `regattaflow_sailor_tour_v1` | Legacy tour key, migrated on first load |

---

## 2. Read/write call sites per key

### 2.1 `onboarding_interest_slug` (the headline key for Step 1)

**Writers:**
- `app/(auth)/signup.tsx:138` — email signup branch
- `app/(auth)/signup.tsx:195` — Google signup branch
- `app/(auth)/signup.tsx:218` — Apple signup branch

**Readers (in flow order):**
- `app/onboarding/trial-activation.tsx:69` — UI display only (feature list per interest)
- `app/onboarding/profile/name-photo.tsx:135` — **commit point**: reads slug, then `addInterest(slug)` + `switchInterest(slug)` against the DB
- `app/onboarding/privacy-quick-set.tsx:61,72` — UI + decision logic
- `app/onboarding/org-welcome.tsx:86` — display
- `app/onboarding/org-discovery.tsx:54` — display
- `app/onboarding/explore-interests.tsx:37` — pre-populates the picker
- `app/onboarding/manifesto.tsx:68` — display
- `app/onboarding/choose-start.tsx:40` — display

**Removers (post-flow cleanup):**
- `app/onboarding/manifesto.tsx:167`
- `app/onboarding/choose-start.tsx:84`

### 2.2 `onboarding_interest_order` (a key not in the original plan)

**Writers:**
- `app/onboarding/explore-interests.tsx:108` — writes the chosen primary-first ordering

**Readers:**
- `app/onboarding/choose-start.tsx:39`
- `app/onboarding/manifesto.tsx:67`

**Removers:**
- `app/onboarding/choose-start.tsx:85`
- `app/onboarding/manifesto.tsx:168`

### 2.3 `onboarding_org_slug`

**Writers:**
- `app/(auth)/signup.tsx:143, 198, 221` (three OAuth branches)

**Readers:**
- `app/onboarding/privacy-quick-set.tsx:71`
- `app/onboarding/org-welcome.tsx:85`

**Removers:**
- `app/onboarding/org-discovery.tsx:118`
- `app/onboarding/manifesto.tsx:166`
- `app/onboarding/choose-start.tsx:83`

### 2.4 `pending_invite_token`

**Writers:**
- `app/(auth)/signup.tsx:148, 201, 224`

**Readers:** **None.** Grepped the full repo — no reader exists. `app/invite/[token].tsx` does not import `AsyncStorage`.

### 2.5 `post_onboarding_return_to`

**Writers:**
- `app/(auth)/signup.tsx:171, 204, 227`

**Readers (with paired remove):**
- `app/(auth)/callback.tsx:213, 435` (OAuth callback post-auth nav)
- `app/onboarding/first-activity/add-race.tsx:94, 108`
- `app/onboarding/manifesto.tsx:164`
- `app/onboarding/choose-start.tsx:81`

### 2.6 `regattaflow_onboarding_seen` (via `OnboardingStateService.hasSeenOnboarding`)

**Writers (`markOnboardingSeen`):**
- `providers/AuthProvider.tsx:1537`
- `app/onboarding/first-activity/add-race.tsx:91, 105`
- `app/onboarding/choose-start.tsx:80`
- `app/onboarding/manifesto.tsx:163`
- `app/onboarding/auth-choice-new.tsx:118`

**Readers:**
- `providers/FeatureTourProvider.tsx:154` — gates whether the feature tour can auto-start

### 2.7 `regattaflow_onboarding_state` (full state blob)

**Writers (via `OnboardingStateService.*` mutators):**
- `app/(auth)/signup.tsx:160-161` (setUserInfo, completeStep)
- `app/onboarding/profile/name-photo.tsx:79, 84`
- `app/onboarding/first-activity/race-calendar.tsx:123-124, 134-135`

**Readers (via `OnboardingStateService.loadState` internally):**
- `app/onboarding/index.tsx:17` — `getStartingRoute()` only

### 2.8 `regattaflow_onboarding_flow`

Defined as `FLOW_KEY` in `OnboardingStateService.ts:22`. **Never used.** No `getItem`/`setItem` references. Dead constant.

### 2.9 `regattaflow_cached_username`

**Writer:** `OnboardingStateService.cacheUsername` — called from `providers/AuthProvider.tsx` on sign-out path (per the service comment).
**Reader:** `app/onboarding/welcome-back.tsx:100`

---

## 3. Findings

### 3.1 Surprises

1. **`pending_invite_token` is dead code.** Written 3 times in signup.tsx, never read. The actual invite flow goes through `router.replace('/invite/${inviteToken}')` directly. This is a documentation/spec hazard — it looks like state-of-record but produces no behavior. **The onboarding plan listed it as a key worth preserving — it is not.**

2. **`onboarding_interest_order` was missing from the migration plan.** Listed under D2 keys was only `onboarding_interest_slug`/`onboarding_org_slug`/`pending_invite_token`/`post_onboarding_return_to`. The `_order` key adds a sixth piece of state, lives entirely transient, never touches the DB, and is cleared by two different terminal screens.

3. **`name-photo.tsx:135-143` is the only commit point.** This is the single line where AsyncStorage → DB happens (`addInterest` + `switchInterest`). Every other reader is display-only. This means **moving `onboarding_interest_slug` writes from AsyncStorage to `user_interests` collapses cleanly**: the source-of-truth change can happen at signup.tsx, name-photo.tsx becomes a no-op for the commit, and downstream display readers can either keep reading AsyncStorage (dual-write era) or switch to a hook over `user_interests`.

4. **`regattaflow_onboarding_flow` constant is defined but never read or written.** Pure dead code in `OnboardingStateService.ts:22`.

5. **`regattaflow_onboarding_state` is written by multiple flows but only read by `index.tsx`'s `getStartingRoute()`, which always returns `/onboarding/profile/name-photo`.** The "next step / previous step / progress" machinery in `OnboardingStateService` exists but no caller currently consumes those getters in production code paths reachable from this audit. It's an over-engineered state machine for a single-step flow (`POST_SIGNUP_STEPS = ['name-photo']`).

6. **Three signup branches duplicate the four AsyncStorage writes** (email, Google, Apple). 12 writes for 4 keys. This is exactly the kind of duplication Onboarding Step 1 should clean up — extract to a single post-auth helper.

7. **`regattaflow_onboarding_seen` has 5 different writers across 5 screens.** Not necessarily wrong — anywhere onboarding can "complete" needs to set it — but it's hard to know which paths actually fire it. `add-race.tsx` writes it twice, in two adjacent handlers.

### 3.2 Inconsistencies

- **OAuth callback path doesn't go through signup.tsx.** OAuth flows return to `app/(auth)/callback.tsx`, which only reads `post_onboarding_return_to`. It doesn't read interest/org. This means the AsyncStorage writes in signup.tsx's Google/Apple branches (lines 195-227) only fire if the OAuth flow stays in the signup screen long enough — fragile during cold-start auth redirects on web. **Onboarding Step 3 (blueprint subscription on auth) flags this same risk; D2 makes it concrete.**

- **`onboarding_interest_slug` is removed in `manifesto.tsx` and `choose-start.tsx` but NOT after `name-photo.tsx` commits it.** So the key lives across the entire post-signup flow until one of those terminal screens, even though it's already been written to the DB at name-photo. Two readers (privacy-quick-set, org-welcome, etc.) consult AsyncStorage even though `user_interests` would now be authoritative. Not a bug today, but an order-of-truth ambiguity.

- **Terminal cleanup is duplicated.** `manifesto.tsx` and `choose-start.tsx` both remove the same four keys. These are alternative terminal screens — only one fires per flow — but the duplication suggests one was added before the other was finished, and the code is now load-bearing in both.

### 3.3 Dead code / cleanup candidates

- `pending_invite_token` writes (signup.tsx) — orphaned, never read.
- `FLOW_KEY` constant (`OnboardingStateService.ts:22`) — never read or written.
- `OnboardingStateService.setFlowType` / `isNewFlowEnabled` (lines 132-141) — unused public API on the service.
- Step-machinery (`getNextStep`, `getPreviousStep`, `getProgress`, `getStepNumber`) — uncalled in app code reachable from current routes.

---

## 4. Recommendations for Onboarding Step 1

### 4.1 Keep (no change needed)

- **`post_onboarding_return_to`** — clean nav-hint pattern. Survives across OAuth round-trip via `callback.tsx`. Keep.
- **`regattaflow_onboarding_seen`** — used by `FeatureTourProvider` to gate the feature tour. Behavioral contract is real; don't touch.
- **`regattaflow_cached_username`** — welcome-back UX, isolated, no D2 collision.
- **`pending_blueprint_purchase`** — adjacent to onboarding (Step 3 blueprint flow), not in scope.

### 4.2 Refactor in Step 1

- **`onboarding_interest_slug` → `user_interests` table** (the D2 headline change). At signup success, call `addInterest(slug)` directly (move the logic from name-photo.tsx:138-139 to AuthProvider's signup completion hook). **Dual-write to AsyncStorage for one release** so display readers (trial-activation, privacy-quick-set, org-welcome, org-discovery, explore-interests, manifesto, choose-start) don't break. Migrate readers one at a time over the next two releases to a `useUserInterests()` query.
- **Hoist signup.tsx duplication.** The 12-call dance (4 keys × 3 OAuth branches) should be one helper called from a single post-auth callback. This is the same refactor that Onboarding Step 3 (path-subscriber entry) will also need — do it once here.

### 4.3 Delete in Step 1

- **`pending_invite_token` writes in signup.tsx (lines 148, 201, 224).** Orphaned. The invite flow goes through `router.replace('/invite/[token]')` directly. No reader. Removing it is a no-op.
- **`FLOW_KEY` constant in `OnboardingStateService.ts:22`.** Dead.
- **`OnboardingStateService.setFlowType` / `isNewFlowEnabled` / `getNextStep` / `getPreviousStep` / `getProgress` / `getStepNumber`.** Unused public API. Verify with one more pass over `components/onboarding/**` before deletion.

### 4.4 Out-of-scope but worth noting

- `regattaflow_onboarding_state` could be simplified — it's an overspec'd state machine for a one-step flow. Not a Step 1 task; flag as cleanup once the post-signup flow's true shape stabilizes (Step 2/3/5).
- Terminal cleanup duplication between `manifesto.tsx` and `choose-start.tsx`: consider a `clearOnboardingHints()` helper. Optional polish.

---

## 5. Impact on the onboarding plan

### 5.1 Plan changes needed

**Onboarding Step 1 description should be updated** to include:
- `onboarding_interest_order` — a sixth key not previously listed; transient, no DB commit, can keep as-is during dual-write.
- `pending_invite_token` is **dead code**, not a "nav hint to preserve" — delete it during Step 1.
- The 3-branch OAuth duplication in signup.tsx is the actual refactor target; the AsyncStorage write itself isn't the smell, the *repetition across branches* is.
- The single commit point is name-photo.tsx:135-143 (`addInterest` + `switchInterest`). The Step 1 migration is "lift the commit earlier" + "extract to one helper" — *not* "remove AsyncStorage from signup."

### 5.2 Risks confirmed

- The risk noted in the plan ("screens will look empty if not done atomically") is real: 7 downstream readers exist for `onboarding_interest_slug`. Dual-write is the right mitigation — already in our locked decision (D2 option b).

### 5.3 New risk surfaced

- **OAuth callback bypasses signup.tsx.** This means signup.tsx's AsyncStorage writes in the Google/Apple branches may not actually fire in production — the callback page is what runs after OAuth. Worth verifying with a quick check on web specifically. If they don't fire, then OAuth signups currently lose interest/org context. Treat as a separate bug to investigate; **does not block** Step 1 per se but is adjacent and worth a fix-in-passing.

### 5.4 Blockers

**None for Step 1.** The audit confirms the change is safe with dual-write. No surprise dependency, no hidden coupling that would require a different approach.

---

## 6. Status summary

- ✅ D2 audit complete.
- ✅ All readers/writers catalogued.
- ✅ Plan adjustments identified (minor — add `onboarding_interest_order`, mark `pending_invite_token` as deletion not preservation).
- ✅ No new blockers surfaced for Onboarding Step 1.
- ⚠️ One adjacent issue worth tracking: OAuth callback may bypass signup.tsx's AsyncStorage writes on web. Not blocking but warrants verification.

**Ready to proceed with #5 (Step Arch A)** — nothing here changes the parallel-path plan. Onboarding Step 1 can begin whenever the team has bandwidth; this audit unblocks it.
