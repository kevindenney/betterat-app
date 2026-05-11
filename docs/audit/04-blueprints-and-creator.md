# Pass 4 — Blueprints and Creator

Read-only audit of the blueprint lifecycle (publish → discover → subscribe →
adopt → mentor → pay) and the Creator dashboard. Branch:
`audit/codebase-recon`. All citations are `path:line`. No code changes
proposed here — only findings.

---

## TL;DR

- **Three storage shapes, one user-facing concept.** `timeline_blueprints` is
  the publishable record; `blueprint_subscriptions` tracks "I followed this
  curriculum"; `blueprint_step_actions` tracks per-step `adopted | dismissed |
  seen`; `blueprint_purchases` tracks the Stripe receipt. The model is sound,
  but adoption is double-tracked: every "adopt" writes both
  `blueprint_step_actions` AND clones the step into the subscriber's
  `timeline_steps` via `adoptStep` (`services/BlueprintService.ts:532-534`).
- **Auto-adopt on subscribe**: subscribing auto-adopts only the *first* step
  (`services/BlueprintService.ts:524-542`), with a comment "Remaining steps
  surface in the FOR YOU section". The user only sees one card unless they
  manually press an Adopt-all CTA (`app/blueprint/[slug].tsx:418-439`).
- **Two adopt-all flows exist.** Server-side: `subscribe()` adopts step 1.
  Client-side: `handleStartFirstStep` (`app/blueprint/[slug].tsx:444-454`)
  loops every step through `adoptStepMutation`. There is no transaction —
  if any step fails mid-loop the user gets a partial timeline silently.
- **Sailing-tab leak**. The blueprint landing page redirects post-subscribe to
  `'/(tabs)/races'` (`app/blueprint/[slug].tsx:306, 412, 562`). For a
  nursing/JHSON user, post-purchase the app drops them on a tab whose route
  name is `races` regardless of vocabulary.
- **Dead earnings page.** `app/creator/earnings.tsx` (494 lines) is unreachable
  — zero `router.push("/creator/earnings")` references in the codebase. The
  comment in `app/creator/index.tsx:1-7` explicitly says "everything lives
  here." The duplicate file is residue.
- **Hardcoded 15% platform fee.** The Stripe webhook hard-codes
  `Math.round(amountPaid * 0.15)` twice (`supabase/functions/stripe-webhooks/
  index.ts:324, 520`). Creator dashboard surfaces the same constant as a
  literal `"Fees (15%)"` string at `app/creator/index.tsx:516`. There is no
  config table, no per-org override, and no Stripe `application_fee_amount`
  path — the platform records the fee as a number after the fact rather than
  collecting it through Stripe Connect.
- **Firebase bridge token poll workaround.** `app/blueprint/[slug].tsx:198-229`
  introduces a `bridgePollTick` state to re-evaluate the auto-subscribe effect
  while the `FirebaseBridgeHandler` is exchanging URL tokens. Documented
  symptom: without the poll, a stale-token bridge failure strands signed-out
  users on the blueprint URL forever (see memory:
  `feedback_blueprint_hkdw_journey`).
- **STATUS_CONFIG hardcoded English** at `app/blueprint/[slug].tsx:61-66`:
  `Pending`, `In Progress`, `Completed`, `Skipped` — never run through
  vocabulary, so nursing users see "In Progress" instead of, e.g.,
  "On clinical".

---

## 1. Data model

### 1.1 Blueprint records — `types/blueprint.ts`

The shape (`types/blueprint.ts`):

- `BlueprintRecord` (`:14-49`): `id, user_id, interest_id, slug, title,
  description, cover_image_url, is_published, organization_id, program_id,
  subscriber_count, access_level, price_cents, currency, pricing_type,
  stripe_price_id, stripe_product_id, created_at, updated_at`.
- `BlueprintAccessLevel = 'public' | 'org_members' | 'paid'` (`:7`).
- `BlueprintPricingType = 'one_time' | 'recurring'` (`:9`).
- `BlueprintPurchaseRecord` (`:113-127`): `stripe_checkout_session_id,
  stripe_payment_intent_id, amount_paid_cents, platform_fee_cents,
  status: 'pending'|'completed'|'failed'|'refunded'`.
- `BlueprintSubscriptionRecord` (`:88-104`): `subscriber_id, blueprint_id,
  subscribed_at, last_synced_at, stripe_subscription_id, current_period_end,
  subscription_status: 'active' | 'past_due' | 'canceled' | 'unpaid'`.
- `BlueprintStepActionRecord` (`:130-142`): `subscription_id, source_step_id,
  action: 'adopted'|'dismissed'|'seen', adopted_step_id, dismissed_at,
  adopted_at`.

Adoption uses **two parallel sources of truth**:

1. The `blueprint_step_actions` row marks the source step as `adopted`.
2. `adoptStep()` clones the source row into the subscriber's
   `timeline_steps` and returns the cloned ID, which then gets written back
   to `blueprint_step_actions.adopted_step_id`
   (`services/BlueprintService.ts:534`).

This makes "did the user adopt step X" a query that has to join two tables
or trust whichever side wrote last.

### 1.2 Read models on top of those tables

- `SubscriberProgress` (`types/blueprint.ts:175-184`): per-blueprint roll-up
  for the creator's "Subscribers" list — `adopted_count, completed_count,
  dismissed_count, last_active_at, steps: SubscriberStepProgress[]`.
- `PeerTimeline` (`:194-202`): for the public landing page's "others
  doing this" social proof — `subscriber_id, name, avatar_url, steps:
  PeerTimelineStep[]`.
- `BlueprintNewStep` / `BlueprintSuggestedNextStep` (`:151-172`): For You
  feed payload returned by `getNewStepsForSubscriber` and
  `getSuggestedNextSteps`.

### 1.3 Service surface — `services/BlueprintService.ts`

1468 lines, 33 exported functions (`grep ^export.*function`):

| Concern | Function |
| --- | --- |
| CRUD | `createBlueprint, updateBlueprint, deleteBlueprint, migrateBlueprint` |
| Read | `getBlueprintBySlug, getBlueprintById, getBlueprintWithAuthorById, getUserBlueprints` |
| Steps | `getBlueprintSteps, addStepToBlueprint, removeStepFromBlueprint, reorderBlueprintSteps, setBlueprintSteps, backfillAutoCurateSteps` |
| Subscribe | `subscribe, unsubscribe, getSubscription, getMySubscriptions, getSubscribedBlueprints` |
| Sync feed | `getNewStepsForSubscriber, markStepAction, updateLastSynced` |
| Discovery | `getOrganizationBlueprints, getProgramBlueprints, discoverBlueprints` |
| Access | `checkBlueprintAccess, checkBlueprintPurchase, getBlueprintAccessInfo` |
| Subscribers | `getBlueprintSubscribers, getBlueprintSubscriberProgress, getSubscriberAdoptedSteps` |
| Suggestions | `getSuggestedNextSteps, getPeerSubscriberTimelines` |
| Helpers | `generateBlueprintSlug, createBlueprintFromCurriculum` |

---

## 2. Access control

`checkBlueprintAccess(userId, blueprint)` at
`services/BlueprintService.ts:872-928` is the gate for every subscribe flow.

Decision tree:

- `access_level === 'public'` → allowed (`:876`).
- Org membership lookup at `:881-893` queries
  `organization_memberships.user_id, organization_id` with
  `.in('membership_status', ['active'])`. Note the **bug surface**: this only
  checks `membership_status`, but the codebase also tracks `status` (see
  memory `feedback_membership_status_split.md`). A user whose
  `membership_status` is null/lagging will be denied "org_members" access
  even though they're treated as active elsewhere.
- `access_level === 'org_members'` (`:895-899`): allowed if org member;
  otherwise `'You must be a member of this organization to subscribe.'`
- `access_level === 'paid'` (`:901-925`):
  - Org members of the blueprint's `organization_id` get free access (`:902-903`).
  - Otherwise look for a `blueprint_purchases` row where
    `buyer_id = userId AND status = 'completed'` (`:907-915`).
  - Missing both → `requiresPurchase: true`.

Two observations:

1. **Per-blueprint org-member free pass.** Org membership unlocks every
   paid blueprint published under that org (`:902-903`). There is no
   per-blueprint or per-program override — every paid blueprint authored by
   any user in the org's `organization_id` is free for org members. That is
   probably the intended JHSON pricing model, but the schema does not let a
   creator carve out a single premium blueprint behind a Stripe paywall *for*
   their own org.
2. **No expiry on access**. A purchase row with `status = 'completed'` grants
   access forever. `BlueprintSubscriptionRecord.subscription_status` includes
   `past_due | canceled | unpaid`, but `checkBlueprintAccess` ignores
   subscription state — once the row is `completed`, recurring cancellation
   never revokes access.

---

## 3. Subscribe flow

`subscribe(subscriberId, blueprintId)` at
`services/BlueprintService.ts:475-549`:

1. `getBlueprintById` (`:483`).
2. `checkBlueprintAccess` (`:486-489`) — throws on deny.
3. Upsert `blueprint_subscriptions` row with both `subscribed_at` and
   `last_synced_at` set to `now()` (`:492-504`).
4. **Auto-follow the author** via `user_follows` upsert (`:509-522`).
   Comment: "Auto-follow the blueprint author". This is non-blocking — failure
   is logged at `warn` only.
5. **Auto-adopt the FIRST step only** (`:524-542`). Comment: "so the
   subscriber's timeline isn't empty. Remaining steps surface in the FOR
   YOU section." Failure is silently warned and the subscription remains.

The follow-up "adopt every step" loop only fires from the client
(`app/blueprint/[slug].tsx:418-439`).

### 3.1 Auto-subscribe via URL parameter

The blueprint landing accepts `?auto_subscribe=1` and runs a 110-line effect
(`app/blueprint/[slug].tsx:192-312`):

- Waits for `authReady && !authLoading` (`:208`).
- Polls a `bridgePollTick` setState while `rf_access_token=` or
  `rf_bridge_token=` are still in the URL (`:221-229`). The 400ms timeout
  is to let `FirebaseBridgeHandler` finish exchanging tokens. Without it,
  the effect early-returns once and never retries.
- Signed-out → redirect to `/(auth)/login?returnTo=/blueprint/{slug}?auto_subscribe=1`
  (`:236`).
- Paid blueprints are skipped (`:241`) — comment: "Don't auto-subscribe to
  paid blueprints — let the user see the price."
- Calls `subscribeMutation.mutateAsync` (`:262-307`).
- On success: `addInterest(targetSlug)` then `switchInterest(targetSlug)`
  (`:282-292`) — comment notes this must happen *before* the redirect so
  `InterestProvider`'s "auto-correct active slug" doesn't revert it.
- Sets a one-shot `betterat_blueprint_welcome:{slug}` flag in AsyncStorage
  (`:297-301`).
- `router.replace('/(tabs)/races' as any)` (`:306`) — **sailing-tab leak**
  even when the blueprint's interest is nursing.

### 3.2 Pending purchase resume

If a signed-out user clicks Buy:
- `AsyncStorage.setItem('pending_blueprint_purchase', slug)` (`:356`).
- Redirect to `/(auth)/signup?interest=…&returnTo=/blueprint/{slug}`.

After signup, an effect at `:174-187` reads
`AsyncStorage.getItem('pending_blueprint_purchase')`, compares it to the
current slug, and on match calls `handlePurchaseRef.current?.()` after a
500ms delay (`:182-184`). The 500ms is a "let the page render before
redirecting to Stripe" magic number with no test.

---

## 4. Stripe Connect / Checkout

### 4.1 Service surface

- `services/BlueprintPaymentService.ts` (189 lines) — buyer-side:
  `checkPurchase, purchaseBlueprint, verifyPurchase, getBlueprintPricing`.
- `services/StripeConnectService.ts` (190+ lines read) — creator-side
  payouts and onboarding. Note that the URL params at
  `services/StripeConnectService.ts:78-81` still send **both** `coach_id` and
  `user_id` "so edge functions work during migration" — fossil of when
  Stripe Connect was coach-only.

### 4.2 Buyer flow (`BlueprintPaymentService.purchaseBlueprint`)

`services/BlueprintPaymentService.ts:58-116`:

1. Build base URL: `Platform.OS === 'web' ? window.location.origin : 'betterat://'` (`:71-73`).
2. Default `successUrl = `${baseUrl}/blueprint/purchase-success`,
   `cancelUrl = `${baseUrl}/blueprint/purchase-cancelled`` (`:75-76`). The
   blueprint landing's actual handler passes the *blueprint URL itself* in
   both fields (`app/blueprint/[slug].tsx:371, 377`) and relies on the edge
   function appending `?session_id=…&blueprint_id=…`.
3. `supabase.functions.invoke('blueprint-checkout', ...)` (`:80-87`).
4. Three outcomes:
   - `data.free === true` → auto-subscribed by the edge function (`:95-100`).
   - `data.url` → Stripe Checkout URL (`:102-109`).
   - else → `'No checkout URL returned'`.

`verifyPurchase` at `:121-156` uses a fallback: first try by
`stripe_checkout_session_id`, then fall back to "any completed purchase by
this user for this blueprint" (`:138-149`). Comment: "webhook might have
used payment intent".

### 4.3 Webhook & platform fee

`supabase/functions/stripe-webhooks/index.ts` does the platform-fee
calculation:

- `handleBlueprintPurchaseSuccess` (`:317-378`) — one-time payments:
  ```
  const platformFeeCents = Math.round(amountPaid * 0.15);
  ```
  (`:324`) — hardcoded 15%, written to
  `blueprint_purchases.platform_fee_cents` (`:336`). Then upserts a
  `blueprint_subscriptions` row (`:350-358`) and increments
  `subscriber_count` via RPC (`:361-365`).
- A second copy of the same 15% computation at `:520-532` — separate code
  path (probably the subscription/recurring branch).
- Webhook also writes to a `creator_stripe_accounts` table (`:1006-1018`)
  — the generic post-coach payout table.

The platform fee is collected by *recording* it in the row, not by passing
`application_fee_amount` to Stripe. That means Stripe transfers the full
amount to the connected account and BetterAt records (but does not auto-
collect) 15%. For JHSON-style institutional pricing this means manual
reconciliation.

### 4.4 Verify-on-return retry loop

`app/blueprint/[slug].tsx:130-168` mounts a `useEffect` that:
- Reads `session_id` and `blueprint_id` from `window.location.search`
  (`:132-135`).
- Runs `verifyWithRetry` up to 5 attempts at 2-second intervals (`:140-154`)
  — the retry is required because the Stripe webhook can lag behind the
  browser redirect.
- Falls back to a `purchased=true` URL param (`:157-167`) if the verifier
  fails — re-reads the purchase row.
- Cleans the URL with `window.history.replaceState({}, '', window.location.pathname)`
  on success (`:156, 166`).

Numbers are magic: 5 attempts × 2000ms = 10s ceiling. No telemetry on how
often the retry path is actually taken.

---

## 5. Creator dashboard

### 5.1 Layout

`app/creator/_layout.tsx` (13 lines) — plain Stack with `index`, `[id]`,
`earnings`, `subscriber/[subscriberId]` (and the deeper
`subscriber-step/[stepId]` via convention).

### 5.2 `app/creator/index.tsx` (897 lines)

Unified "Creator Dashboard":

- Comment at `:1-7`: "No separate earnings page needed — everything lives
  here."
- Segmented control at `:117` between `'blueprints'` and `'earnings'`.
- The Blueprint list cards include badges, sub-counts, and per-card actions
  (`:711-754` style definitions imply Edit / View per card).
- Earnings segment includes a balance card, payout button, and payout
  history list (`:776-895` styles). Uses `StripeConnectService` for the
  balance and the payout button.
- **Hardcoded "Fees (15%)"** at `:516` — string baked into the JSX, never
  read from config. Same constant as the webhook.
- `formatPrice` helper at `:65-72` returns `Free`, `Members only`, `Paid`,
  `$X`, or `$X/mo`. The strings are hardcoded — not run through vocabulary
  or i18n.

### 5.3 `app/creator/[id].tsx` (651 lines)

Per-blueprint detail with subscriber list and per-subscriber step progress:

- Status pill labels hardcoded at `:53-61`:
  `Dismissed | Completed | In Progress | Adopted | Seen`. Same English-
  only-ness as `STATUS_CONFIG` on the landing page.
- Access-level pill at `:177-179` renders raw enum-to-label mapping inline:
  ```
  blueprint.access_level === 'public' ? 'Free' :
  blueprint.access_level === 'org_members' ? 'Members Only' :
  blueprint.price_cents ? `$${(blueprint.price_cents / 100).toFixed(2)}` : 'Paid'
  ```
- Share URL at `:120` is hardcoded `https://betterat.com/blueprint/{slug}`
  — note memory `project_betterat_share_url`: canonical share URL is
  `better.at`, not `betterat.com`. **This is a regression of the fix in
  commit `322b67a4`** (audit start: "fix(blueprint): canonical share URL
  is better.at, not betterat.com"). The creator detail page still emits
  the old domain.
- "View Details & Mentor" CTA at `:339` links to
  `/creator/subscriber/{id}?blueprintId={id}` — the mentoring entrypoint.

### 5.4 `app/creator/earnings.tsx` — DEAD CODE

494 lines, never reached:

- No `router.push("/creator/earnings")` anywhere in the repo (grep on
  `creator/earnings` returns zero inbound nav refs).
- The page duplicates the `EarningsContent` segment that already exists
  inside `app/creator/index.tsx`.
- The route is still served by Expo Router (file-based), so a user who types
  the URL directly will hit it. The two screens have diverged independently
  since the consolidation comment was added.

### 5.5 Subscriber drill-in — `app/creator/subscriber-step/[stepId].tsx`

75 lines. Renders the subscriber's step `read-only` and stacks a
`CreatorMentoringPanel` below it (`:40-43`):

```
<StepDetailContent stepId={stepId} readOnly />
<CreatorMentoringPanel stepId={stepId} />
```

- Wires `StepDetailContent` in `readOnly` mode (an unused prop unless the
  step screen respects it — Pass 3 found the four-layer label resolver does
  not branch on `readOnly`).
- The mentoring panel is the only place outside the Review tab that the
  creator can leave feedback.

---

## 6. Hardcoded labels in blueprint UI

| Place | Label | Citation |
| --- | --- | --- |
| Landing page STATUS_CONFIG | `Pending, In Progress, Completed, Skipped` | `app/blueprint/[slug].tsx:61-66` |
| Creator dashboard | `Fees (15%)` | `app/creator/index.tsx:516` |
| Creator dashboard | `Free, Members only, Paid, $X, $X/mo` | `app/creator/index.tsx:65-72` |
| Blueprint detail | `Dismissed, Completed, In Progress, Adopted, Seen` | `app/creator/[id].tsx:53-61` |
| Blueprint detail | `Free, Members Only, Paid` access pill | `app/creator/[id].tsx:177-179` |
| Blueprint detail | `Published, Draft` | `app/creator/[id].tsx:172-174` |
| Subscriber row | "View Details & Mentor" | `app/creator/[id].tsx:339` |
| Subscribers section | "Subscribers" / "No subscribers yet" / "Share your blueprint to get your first subscriber." | `app/creator/[id].tsx:238-243` |
| Empty steps | "No steps yet" / "Add steps from your timeline, or tap 'Edit Steps' to curate your blueprint." | `app/creator/[id].tsx:215-217` |
| Step categories | `book-outline` / `fitness-outline` / `chatbubble-ellipses-outline` mapping at `:362-366` | `app/creator/[id].tsx:362-366` |

None of these are run through `vocabulary`. A nursing user editing a
blueprint sees "Subscribers" rather than (e.g.) "Mentees" or "Cohort
members".

---

## 7. Non-blocking notification pattern

Every blueprint-related notification is **best-effort**:

- `subscribe` auto-follow: warn-on-error, non-blocking
  (`services/BlueprintService.ts:519-521`).
- `subscribe` auto-adopt: warn-on-error, non-blocking
  (`services/BlueprintService.ts:535-541`).
- Landing-page subscribe → `notifyBlueprintSubscribed`:
  `.catch(() => {})` (`app/blueprint/[slug].tsx:267-275, 340-348`).
- Stripe webhook: blueprint-subscriber-count RPC failure → `console.error`
  but the buyer still completes the purchase (`stripe-webhooks/index.ts:361-365`).

Pattern is sensible (don't fail a purchase because Postmark is down), but
there is no retry queue and no error budget — if `notifyBlueprintSubscribed`
silently fails, the creator never knows they got a subscriber.

---

## 8. Sailing-tab leak (cross-reference with Pass 2 & 3)

Three nav redirects from the blueprint landing all go to `'/(tabs)/races'`:

- `:306` — auto-subscribe success
- `:412` — `navigateToTimeline` post-adopt
- `:562` — "Go back" fallback when blueprint is `null`

Reading memory: `feedback_timeline_steps_in_races_tab.md` confirms timeline
steps live in `races` for *all* interests, but the route segment is still
literally `races`. Combined with Pass 2's finding that
`useInterestEventConfig.ts:20` defaults to `'sail-racing'` and the
`isProgramWorkspace` slug allowlist explicitly excludes sailing
(`lib/navigation-config.ts:40-48`), the blueprint flow inherits a sailing
mental model even for nursing users.

---

## 9. Inventory of files audited

| File | Lines | Notes |
| --- | --- | --- |
| `types/blueprint.ts` | 207 | Data model — 16 interfaces |
| `services/BlueprintService.ts` | 1468 | 33 exports; subscribe at `:475`, access at `:872` |
| `services/BlueprintPaymentService.ts` | 189 | Buyer-side Stripe Checkout |
| `services/StripeConnectService.ts` | 190+ (read 120) | Creator payouts; `coach_id` legacy param |
| `app/blueprint/[slug].tsx` | 2492 (read 500) | Landing; auto-subscribe, retry verify, bridge poll |
| `app/creator/_layout.tsx` | 13 | Plain Stack |
| `app/creator/index.tsx` | 897 | Unified dashboard, hardcoded "Fees (15%)" |
| `app/creator/[id].tsx` | 651 | Subscriber list + per-step progress |
| `app/creator/earnings.tsx` | 494 | **DEAD CODE** — duplicates segment in index |
| `app/creator/subscriber-step/[stepId].tsx` | 75 | Read-only step + mentoring panel |
| `supabase/functions/stripe-webhooks/index.ts` | 1000+ (sampled) | 15% platform fee at `:324, 520` |

---

## 10. Findings summary (for synthesis pass)

1. **Sailing-tab redirect on blueprint subscribe** — three call sites, P0 for
   non-sailing demos.
2. **Dead `app/creator/earnings.tsx`** — 494 lines; delete or merge.
3. **Hardcoded `Fees (15%)`** in UI + 15% literal in webhook — one config
   table or constant + per-org override needed.
4. **STATUS_CONFIG and access-pill labels hardcoded English** — no
   vocabulary integration on either landing or creator surfaces.
5. **`betterat.com` share URL regression** in `app/creator/[id].tsx:120` —
   contradicts the commit at start of this audit (`322b67a4`).
6. **Auto-adopt step 1 only** vs **client-side adopt-all loop** — two
   competing affordances; no transaction; partial timelines on failure.
7. **`membership_status` only check** in `checkBlueprintAccess` —
   cross-cuts with the known split documented in
   `feedback_membership_status_split.md`.
8. **No `application_fee_amount` on Stripe Connect transfers** — fee
   recorded but not collected by Stripe; manual reconciliation required.
9. **`subscription_status` ignored in access check** — recurring
   cancellation never revokes access.
10. **Firebase bridge token poll** — symptom-level workaround for a
    deeper race between `FirebaseBridgeHandler` and `InterestProvider`'s
    URL handling.

Effort sizing deferred to Pass 8.
