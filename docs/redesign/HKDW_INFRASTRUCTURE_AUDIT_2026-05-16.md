# HKDW Infrastructure Audit — 2026-05-16

**Purpose:** Input to a corrected Phase P spec. The original Phase P spec assumed a green field; this audit documents the substantial HKDW work already shipped so the corrected spec can be a delta rather than a rewrite.

**Scope:** Read-only. No code changes, no migrations, no commits except this doc.

**Source of truth for DB facts:** live SELECTs against project `qavekrwdbsobecwrfxwu` (BetterAt prod) at 2026-05-16.

---

## TL;DR — headline numbers

| Spec goal | Status |
|---|---|
| `/dragon-worlds` sailor landing page | **MISSING** (the existing `/dragon-worlds-privacy` is unrelated App Store copy) |
| `/dragon-worlds/signup` with auto-follow + auto-subscribe | **CONFLICT** — auto-subscribe already happens via Firebase bridge, NOT via a `/signup` route. Auto-follow does NOT happen. |
| `/dragon-worlds/signin` with redirect logic | **MISSING** as a named route. The existing redirect is `/redeem` → `/blueprint/...?auto_subscribe=1`. |
| `/dragon-worlds/spectator`, `/media`, `/race-admin` placeholders | **MISSING** |
| Auto-follow Kevin on signup | **MISSING** (only 3 follows of Kevin's account in remote; nothing in code auto-creates them) |
| Auto-subscribe to DW2027 blueprint on signup | **PARTIAL** — auto-subscribes via Firebase bridge for new HKDW arrivals; legacy users fall through to `?auto_subscribe=1` URL param handler. 37 HKDW users / 4 subscribers (10.8%) suggests most legacy arrivals never converted. |
| Welcome banner on `/practice` | **CONFLICT** — TWO welcome cards exist with different lifecycles, neither matches the spec's expected DB-flag pattern |
| Source attribution | **PARTIAL** — `users.auth_source = 'dragon_worlds'` already exists; spec wanted `signup_source = 'hkdw_dragon_worlds_2027'` (more specific value) |
| Waitlist table for non-sailor roles | **MISSING** |
| Analytics events (5 specified) | **MISSING** — no HKDW-specific analytics calls in the code |

**Count:** 2 PARTIAL, 2 CONFLICT, 6 MISSING, 0 DONE.

**Bottom line for May 20:** The sailor deep-link path *works end-to-end* via the Firebase bridge (37 users in prod). What's missing is everything around it — non-sailor entry points, a named landing URL, server-side dismissal tracking, and analytics. The corrected Phase P spec should reflect that the *core* is done and the *shell* is the gap, NOT the other way around.

---

## 1. Entry routes (`/dragon-worlds`, `/dragon-worlds/*`)

### What exists

| Route | Source | Purpose | Auth | Flag |
|---|---|---|---|---|
| `/dragon-worlds-privacy` | `app/dragon-worlds-privacy.tsx` | Privacy policy for the DragonWorldsHK2027 **iOS app** (App Store legal copy). Web-only render; 304 lines of inline HTML. | Public | None |
| `/redeem` | `vercel.json:47-52` redirect | Redirects to `/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1&from=hkdw` | Public (handled by blueprint page's auth gate) | None |
| `/blueprint/[slug]` | `app/blueprint/[slug].tsx` | Blueprint detail page with `?auto_subscribe=1` URL param handler | Public detail, gated auto-subscribe | None |
| `/community/[slug]` | `app/community/[slug].tsx` | When slug=`2027-hk-dragon-worlds`, renders `HKDWWelcomeCard` for signed-in users | Public read; signed-in only for welcome card | None |
| `/(tabs)/races` | `app/(tabs)/races.tsx` | When `isSailingInterest`, renders `BlueprintWelcomeCard` if the AsyncStorage flag is set | Authenticated | None |

### What's missing

- `/dragon-worlds` (the top-level sailor landing the spec wants). The current top-level route is **`/dragon-worlds-privacy`**, NOT `/dragon-worlds`. The two are unrelated — the privacy page is App Store boilerplate.
- `/dragon-worlds/signup`, `/dragon-worlds/signin`, `/dragon-worlds/spectator`, `/dragon-worlds/media`, `/dragon-worlds/race-admin` — none of these exist.

### Notes

- The current sailor entry point is **NOT a route** — it's an edge function. The HKDW iOS app calls `supabase/functions/firebase-auth-bridge` directly with a Firebase ID token, gets a Supabase session back, and the app's WebView lands somewhere with bridge tokens in the URL. See §2.
- `vercel.json`'s `/redeem` redirect is the closest thing to a named "deep-link receipt" route.

---

## 2. Auto-subscribe flow

### End-to-end trace

1. **Sailor in the HKDW iOS app** taps an in-app CTA ("Open my Worlds 2027 prep plan" or similar).
2. The HKDW app calls `supabase/functions/firebase-auth-bridge` (Edge Function, version 36, status ACTIVE, deployed at `qavekrwdbsobecwrfxwu`). Verified live via `list_edge_functions`.
3. The bridge:
   - Verifies the Firebase ID token against either of two Firebase projects: the legacy `regattaflow-app` and the hardcoded `dragonworldshk2027` (API key inline in `index.ts:24`). See §6 for security note.
   - Creates a Supabase auth user if needed (sets `auth_source='dragon_worlds'`, `firebase_uid`, `user_type='sailor'`, `onboarding_completed=true`).
   - Joins community `body.communitySlug ?? '2027-hk-dragon-worlds'` via `community_memberships`.
   - Auto-subscribes to blueprint `body.blueprintSlug ?? 'dragon-worlds-2027-peak-performance'` via `blueprint_subscriptions` (when `communitySlug` resolves to the DW community). Insert is upsert; duplicate-key errors are swallowed.
   - Generates a magic-link, verifies it, returns the Supabase session tokens in both snake_case (Supabase standard) and camelCase (DW-app standard) shapes.
4. The HKDW app loads BetterAt in a WebView with bridge tokens in the URL.
5. `app/_layout.tsx:255+` `FirebaseBridgeHandler` extracts the tokens, sets the Supabase session, optionally honors a `next=` redirect target, then cleans the URL.
6. If `next=/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1` was supplied, the user lands there.
7. `app/blueprint/[slug].tsx:196+` reacts to `?auto_subscribe=1`:
   - Waits for bridge to finish (polls `bridgePollTick` because `history.replaceState` doesn't notify expo-router).
   - If signed-out, routes through `/(auth)/login` with `returnTo` preserving the param.
   - If signed-in + free blueprint + not already subscribed, calls `subscribeMutation.mutateAsync(blueprint.id)` (from `useBlueprint.ts:389` `useSubscribe()`).
   - On success: adds + switches active interest to the blueprint's interest, sets `AsyncStorage[betterat_blueprint_welcome:<slug>]`, redirects to `getEventTabRoute()` (= `/(tabs)/practice` for non-sailors, `/(tabs)/races` for sailors).
8. On the timeline tab, `BlueprintWelcomeCard` (`components/races/BlueprintWelcomeCard.tsx`) reads the AsyncStorage flag and renders.

### What triggers auto-subscribe

- **Server-side (preferred path):** any call to the bridge with `communitySlug='2027-hk-dragon-worlds'` (or explicit `blueprintSlug`). Set since version 36 of the bridge function (deployed 2026-05-12 per `updated_at`).
- **Client-side (legacy fallback):** any visit to `/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1`, regardless of how the user got there. This is what `HKDWWelcomeCard`'s first row links to: `/blueprint/${PREP_PLAN_SLUG}?auto_subscribe=1`.

### Scope: only HKDW-attributed?

- **The bridge** is HKDW-only by design (it's reached only from the HKDW Firebase project via the bridge endpoint).
- **The URL handler** (`?auto_subscribe=1` on any blueprint page) is generic — it works for any free blueprint, not just DW2027. So in principle a non-HKDW user clicking a `/blueprint/...?auto_subscribe=1` link would also be auto-subscribed. The `from=hkdw` param in the `/redeem` redirect is observed but **NOT consulted in code** — it's purely informational in the URL.

### Live numbers (read-only SELECT, 2026-05-16)

```
users with auth_source='dragon_worlds':          37
users with firebase_uid IS NOT NULL:             37    (matches)
blueprint_subscriptions for DW2027 blueprint:     4
community_memberships for 2027-hk-dragon-worlds: 39
user_follows where following_id = Kevin:          3
```

**Surprise:** Only 4 of 37 HKDW arrivals are subscribed to the DW2027 blueprint — a 10.8% conversion. The most likely explanation, per the comment in `firebase-auth-bridge/index.ts:380-383`: the auto-subscribe block was added in a *later version* of the bridge function (v36, 2026-05-12). The earlier ~33 users arrived BEFORE the auto-subscribe step existed, so they got `auth_source='dragon_worlds'` + community membership but no blueprint subscription. The comment explicitly says the `HKDWWelcomeCard`'s `?auto_subscribe=1` row is the fallback for these legacy users.

**Needs verification from Kevin:** Is this analysis correct, or is there a real failure path keeping new bridge users from subscribing?

---

## 3. Welcome card / banner

### Two welcome cards exist with different lifecycles

#### `HKDWWelcomeCard` (`components/community/HKDWWelcomeCard.tsx`)

- **Where rendered:** `app/community/[slug].tsx:289` — pinned at top of the `/community/2027-hk-dragon-worlds` page, only when `signedIn`.
- **What it shows:** Three navigation links (Open Worlds 2027 prep plan / Track your races / Set up your profile).
- **Dismissal:** Per-device `localStorage['hkdw_welcome_dismissed']=1`. **Not persisted server-side; not per-user.** A different browser/device shows it again to the same user.
- **First-link target:** `/blueprint/${PREP_PLAN_SLUG}?auto_subscribe=1` — feeds into the URL-handler auto-subscribe path.

#### `BlueprintWelcomeCard` (`components/races/BlueprintWelcomeCard.tsx`)

- **Where rendered:** `app/(tabs)/races.tsx:5111` — absolutely positioned below the floating header, only when `isSailingInterest`.
- **What it shows:** Single concrete CTA — "Add your boat" (links to `/(tabs)/boat/add`).
- **Trigger:** `AsyncStorage[betterat_blueprint_welcome:dragon-worlds-2027-peak-performance]` exists.
- **Dismissal:** Tapping CTA or X removes the AsyncStorage key. Per-device, per-user (within the user's `AsyncStorage`).
- **One-shot:** Once dismissed, never reappears on that device for that user.

### Compared to the Phase P spec's "welcome banner on /practice"

- **CONFLICT.** The spec wanted a banner on `/practice` triggered by sailors with `dragon_worlds_welcomed_at = NULL` who follow the DW blueprint, dismissed by "Got it" which sets the timestamp server-side. Neither existing card matches that contract:
  - `HKDWWelcomeCard` is on `/community/2027-hk-dragon-worlds`, not `/practice`.
  - `BlueprintWelcomeCard` is on `/(tabs)/races` (which IS the canonical Practice route after Phase A.8) but its trigger is an AsyncStorage flag set during auto-subscribe, NOT the user's DB state. It's also sailor-only (`isSailingInterest`), so non-sailing interests never see it.
  - Neither uses a DB column for "have you seen this." This is a substantive design difference: client-side flags reset on app reinstall, device switch, or AsyncStorage flush.

### Flag gating

- None. Both cards are unflagged.

---

## 4. Dragon Worlds 2027 blueprint

### Live remote state (SELECT, 2026-05-16)

```
id:               f419fa18-de41-3976-4d36-22d294a03d92
user_id (author): d67f765e-7fe6-4f79-b514-f1b7f9a1ba3f   (= Kevin / denneyke@gmail.com)
slug:             dragon-worlds-2027-peak-performance
title:            Achieving Peak Performance at the Dragon Worlds
is_published:     true
access_level:     public
organization_id:  null
interest_id:      5e6b64c3-ea92-42a1-baf5-9342c53eb7d9
subscriber_count: 4
created_at:       2026-05-05 11:34:02 UTC
```

### Companion community

```
id:                 f6adfe17-f7f2-407f-a149-70264741c900
slug:               2027-hk-dragon-worlds
name:               2027 HK Dragon Worlds
community_type:     race
is_official:        true
is_verified:        true
member_count:       39
```

### What seeds them

- The **community** is seeded by SQL: `supabase/migrations/20260206002000_seed_dragon_worlds_community.sql` (with flairs).
- The **blueprint** is NOT seeded by the SQL migration or by `scripts/seed-dragon-worlds-2027.mjs` (that script seeds the regatta, fleets, sailors, clubs, etc. — *not* a blueprint). The blueprint was authored by Kevin via the app UI on 2026-05-05.

### Implications

- Phase P spec assumed the blueprint slug/author would be looked up at runtime via env vars (`EXPO_PUBLIC_HKDW_BLUEPRINT_AUTHOR_USER_ID`, `EXPO_PUBLIC_HKDW_BLUEPRINT_SLUG`). The bridge function instead hardcodes the slug (`HKDW_PREP_BLUEPRINT_SLUG = 'dragon-worlds-2027-peak-performance'`). Two options for the corrected spec: (a) follow the existing pattern (hardcoded), or (b) add the env vars now as a refactor.

---

## 5. Follow / subscription system

### Follow user → user (`user_follows` table)

- **Migration:** `supabase/migrations/20260123140000_create_user_follows.sql`.
- **Schema:** `(id, follower_id, following_id, is_favorite, notifications_enabled, is_muted, created_at)`. Unique `(follower_id, following_id)`. Self-follow check constraint blocks.
- **RLS:** Users can SELECT their own follows + their followers; INSERT their own follows; DELETE their own unfollows. No INSERT-on-behalf-of-other-user; auto-follow on signup must run server-side (Edge Function) or via SECURITY DEFINER.
- **API surface:** `services/SocialService.ts` provides `getFollowOptions`, `updateFollowOptions`, batch follow. Direct table writes in hooks (`useClassExperts.ts`, `useReflectProfile.ts`, `social-notifications.tsx`).
- **No shipped hook named `useFollowUser` or `useFollowMutation`.** Direct SocialService calls or inline `supabase.from('user_follows').insert(...)` are the pattern.

### Subscribe user → blueprint (`blueprint_subscriptions` table)

- **Schema:** `(id, blueprint_id, subscriber_id, subscribed_at, last_synced_at, auto_adopt, stripe_subscription_id, subscription_status)`.
- **API surface:** `hooks/useBlueprint.ts` exposes `useSubscribe()` (mutation), `useUnsubscribe()`, `useBlueprintSubscription(id)`, `useMySubscriptions()`, `useSubscribedBlueprints(interestId)`. The `useSubscribe` mutation invalidates 7 query keys on success — comprehensive cache invalidation.
- **Server-side writes:** `firebase-auth-bridge/index.ts:405-413` writes directly via Supabase REST (service-role key) with `upsert: true`.

### Are follow and subscribe joined or separate?

**Separate concepts, separate tables.** A user can follow another user without subscribing to their blueprints, and vice versa. The Phase P "auto-follow Kevin AND auto-subscribe to his blueprint" is two distinct writes against two distinct tables.

---

## 6. Source attribution

### What's tracked today

- **`users.auth_source`** (text, default `'native'`). The Firebase bridge sets this to `'dragon_worlds'` for HKDW arrivals. Live count: 37 users with `auth_source='dragon_worlds'`.
- **`users.firebase_uid`** (text). Set during bridge processing.
- **`users.metadata`** (jsonb, default `{}`). Available for arbitrary attribution; not currently consulted.

### What's missing

- **No `signup_source` column.** Spec wanted `signup_source='hkdw_dragon_worlds_2027'`. The existing `auth_source='dragon_worlds'` is coarser — it identifies the auth path, not the campaign/source within it.
- **No `dragon_worlds_welcomed_at` column.** Spec wanted server-side dismissal tracking. Both existing welcome cards use client-side storage only.
- **The `from=hkdw` URL param** in the `/redeem` redirect destination is observed in URLs but never read in code.

### Security note (out of audit scope but worth flagging)

`supabase/functions/firebase-auth-bridge/index.ts:24` hardcodes the DragonWorldsHK2027 Firebase API key. Firebase web API keys are not secrets in the OAuth-token-signing sense — they identify the project, not authorize writes — so this is the standard pattern. Flagging it because the corrected spec may want to move it to an env var for cleanliness.

---

## 7. Placeholder pages for non-sailor user types

### What exists

**Nothing.** No `/dragon-worlds/spectator`, `/media`, `/race-admin`, or anywhere else. No waitlist table in the remote schema (`grep "CREATE TABLE.*waitlist"` returns empty against the schema dump).

### Adjacent patterns to consider for reuse

- `app/community/[slug].tsx` is a generic public/auth-aware community page that could be cloned for placeholder pages.
- `app/(auth)/signup.tsx` and `app/(auth)/club-onboarding-chat.tsx` show two different signup-with-extra-context patterns.
- No email-capture form component exists; would need to be built fresh.

---

## 8. Feature flags currently gating HKDW work

**Zero.** Grep results:

```
grep "EXPO_PUBLIC_FF.*HKDW"     → no matches
grep "EXPO_PUBLIC_FF.*DRAGON"   → no matches
grep "HKDW_DEEP"                → no matches
```

All current HKDW flow is **unflagged**. The Firebase bridge, the `/redeem` redirect, both welcome cards, the auto-subscribe URL handler, the community auto-join — none of these are behind any feature flag. The corrected Phase P spec must decide whether the NEW work is flagged AND whether to retro-add a flag to any existing surface.

---

## Gap vs the Phase P spec goals

| # | Spec goal | Status | Evidence |
|---|---|---|---|
| 1 | `/dragon-worlds` sailor landing (3 auth states) | **MISSING** | Only `/dragon-worlds-privacy` exists; unrelated. |
| 2 | `/dragon-worlds/signup` with auto-follow + auto-subscribe | **CONFLICT** | Auto-subscribe exists but lives in Firebase bridge edge fn + `/blueprint/[slug]?auto_subscribe=1` handler, NOT in a `/signup` route. Auto-follow is MISSING. |
| 3 | `/dragon-worlds/signin` with redirect logic | **MISSING** | Existing redirect is `/redeem` → `/blueprint/...?auto_subscribe=1`. |
| 4 | `/dragon-worlds/spectator`, `/media`, `/race-admin` placeholders | **MISSING** | No routes; no waitlist table. |
| 5 | Auto-follow Kevin on signup | **MISSING** | Kevin has 3 followers total; no code path auto-creates a follow. Spec requires this distinct write to `user_follows`. |
| 6 | Auto-subscribe to DW2027 blueprint on signup | **PARTIAL** | Bridge auto-subscribes new HKDW arrivals (v36+, deployed 2026-05-12). Legacy ~33 users fell through to the `HKDWWelcomeCard` `?auto_subscribe=1` fallback. **Live conversion: 4 of 37 HKDW users (10.8%) currently subscribed.** |
| 7 | Welcome banner on `/practice` with `dragon_worlds_welcomed_at` | **CONFLICT** | Two welcome cards exist: `HKDWWelcomeCard` on `/community/2027-hk-dragon-worlds` (localStorage dismiss) and `BlueprintWelcomeCard` on `/(tabs)/races` (AsyncStorage dismiss). Neither uses a DB column; neither is on `/practice` literally. |
| 8 | `signup_source='hkdw_dragon_worlds_2027'` | **PARTIAL** | `users.auth_source='dragon_worlds'` already exists (37 users). Spec wanted a more specific value in a different column. |
| 9 | Waitlist table for non-sailor roles | **MISSING** | No `dragon_worlds_waitlist` or any waitlist table in remote schema. |
| 10 | 5 analytics events | **MISSING** | `grep` for HKDW-specific analytics returns nothing. |

**Totals:** 0 DONE / 2 PARTIAL / 2 CONFLICT / 6 MISSING.

---

## Recommended next steps

For the corrected Phase P spec writer. Each recommendation includes a size estimate; dependencies are flagged inline.

### Reframe the spec from "build from scratch" to "wrap existing + fill gaps"

The original Phase P spec treats this as net-new work. It isn't. The corrected spec should:

1. **Document the bridge flow as the canonical sailor entry path.** The HKDW iOS app calls the bridge directly; the `/dragon-worlds` web route is a *secondary* entry for users who arrive via a non-iOS-app path (web link, browser bookmark, shared link). Don't build the route as if it's the primary; design it as a fallback that funnels into the same final state as the bridge.

2. **Keep `/redeem` as the canonical short URL** for HKDW campaigns and possibly rename it to `/dragon-worlds` (or keep `/redeem` as the alias). One named long URL plus one short alias is the minimum.

### Per-gap recommendations

| Gap | Recommendation | Size | Dependencies |
|---|---|---|---|
| Sailor landing page (`/dragon-worlds`) | Build new route that mirrors `/redeem`'s destination but renders three auth states (unauth, auth-not-following, auth-following) instead of redirecting blind. Auth-following → redirect to `/practice`. Auth-not-following → CTA to subscribe. Unauth → CTA to signup. | **M** | None |
| `/dragon-worlds/signup` + auto-follow + auto-subscribe | Build new signup route, OR extend `/(auth)/signup.tsx` to accept a `source` query param. On signup completion: (a) write `users.metadata.signup_source` OR add a new column, (b) write `user_follows(follower_id=new_user, following_id=Kevin)`, (c) write `blueprint_subscriptions(subscriber_id=new_user, blueprint_id=DW2027)`. Use existing `useSubscribe()` hook for (c); follow pattern for (b) needs to come from `SocialService` since there's no shipped `useFollowUser` mutation. | **M** | `useFollowUser` hook may need to be extracted from SocialService inline calls |
| `/dragon-worlds/signin` | Reuse `/(auth)/login.tsx` with `returnTo='/dragon-worlds'`. The login screen already supports `returnTo`. Mostly a routing config + a thin wrapper page. | **S** | None |
| Non-sailor placeholders + waitlist | Build `/dragon-worlds/spectator`, `/media`, `/race-admin` as a single shared component with `role` prop. Write a single migration creating `dragon_worlds_waitlist(id, role, email, created_at, source)` with RLS that allows anon INSERT but no SELECT. | **M** | New migration. **BLOCKED until Phase N migration ships on `origin/main` (per the open Phase N split).** |
| Auto-follow Kevin | Add the follow write to (a) the bridge function for new HKDW arrivals, AND (b) the `/dragon-worlds/signup` route for direct web signups. Existing 33 HKDW users without follow can be backfilled via a one-shot script OR ignored (they may not actually want to follow Kevin). **Decision needed from Kevin.** | **S** code + **S** backfill | Decision on backfill |
| Welcome banner on `/practice` with DB column | Two paths: (a) add `users.dragon_worlds_welcomed_at` timestamptz column, migrate AsyncStorage flag → DB column on next render, retire `BlueprintWelcomeCard`'s AsyncStorage trigger. (b) Keep AsyncStorage but rebuild the banner per the canonical mock and decide whether `BlueprintWelcomeCard` is retired or repurposed. Path (a) is cleaner; path (b) is safer. | **M** path (a) / **S** path (b) | Spec decision; migration depends on Phase N for (a) |
| `signup_source` attribution | Either (a) standardize on the existing `auth_source='dragon_worlds'` and add a more specific `users.signup_campaign` jsonb path, OR (b) add the full new `signup_source` column. (b) duplicates information already captured by `auth_source`. | **S** | Spec decision |
| Analytics events | Identify which 5 events the spec wants. Wire via the existing analytics surface (need to grep for it — not done in this audit since the events themselves are TBD). | **S** | Spec needs to specify event names + properties |
| Feature flag | Add `EXPO_PUBLIC_FF_HKDW_DEEPLINK` (default OFF) gating ONLY the new web routes. Do NOT gate the existing bridge/welcome cards behind it — they're working and breaking them risks the 37 existing HKDW users. | **S** | Spec decision on scope of the flag |

### Dependency order

```
Phase N migration  ──┐
                     ├─→ Waitlist migration  ──→ Placeholder routes
                     ├─→ users.dragon_worlds_welcomed_at  ──→ Welcome banner rewrite
                     └─→ (any other migration work)

(parallel, no migration needed)
  /dragon-worlds landing page
  /dragon-worlds/signin
  /dragon-worlds/signup + auto-follow code path
  Analytics wiring
  Feature flag
```

---

## Top 3 surprises encountered

1. **The auto-subscribe path lives in an Edge Function, not the web app.** The original Phase P spec wanted to build `/dragon-worlds/signup` with auto-subscribe logic. That logic already exists in `supabase/functions/firebase-auth-bridge/index.ts:380-430` — invoked server-to-server from the HKDW iOS app, not from any BetterAt web route. Building a web `/signup` route would *duplicate* this server-side logic, which means two code paths to keep in sync.

2. **Only 4 of 37 HKDW users are subscribed to the DW2027 blueprint (10.8%).** This is consistent with the bridge's auto-subscribe being added in version 36 (deployed 2026-05-12, just 4 days ago) — earlier ~33 users arrived before the step existed. **But it could also be a real bug.** Needs verification from Kevin before May 20.

3. **Two welcome cards already exist, neither matching the spec.** `HKDWWelcomeCard` (community page, three-row directory, localStorage dismiss) and `BlueprintWelcomeCard` (races tab, one-shot CTA, AsyncStorage dismiss). The Phase P spec describes a third banner on `/practice` with server-side dismissal — making this a *three-welcome-card problem*. The corrected spec should decide which of the three is canonical and what happens to the other two.

---

## Open questions for Kevin (please answer before the corrected spec is written)

1. **Bridge subscriber conversion:** Is the 4/37 ratio (10.8%) explained by the "v36 auto-subscribe is recent" theory, or is there a real bug catching new bridge users today? (Can be verified by spot-checking a user with `auth_source='dragon_worlds'` and `created_at > 2026-05-12`.)
2. **Auto-follow Kevin — backfill existing 33 HKDW users?** Or only auto-follow new signups going forward?
3. **Welcome card consolidation:** Retire `HKDWWelcomeCard`, retire `BlueprintWelcomeCard`, both, or keep them and add a third? The spec calls for a `/practice` banner — does that *replace* either existing card or add to them?
4. **`signup_source` vs `auth_source`:** Is `auth_source='dragon_worlds'` sufficient, or is a separate `signup_source='hkdw_dragon_worlds_2027'` value needed for campaign-grain attribution?
5. **`/redeem` vs `/dragon-worlds`:** Keep both? Promote `/dragon-worlds` and demote `/redeem`? Make `/redeem` an alias?
6. **Phase N split status:** The corrected Phase P migration depends on Phase N landing first. Phase N's spec was re-scoped 2026-05-16 (commit `ce331d1d`) but no implementation commits exist yet. Confirm Phase P should still wait, or whether Phase P's migration can land independently.

---

## Files inventoried

| File | LOC | Status |
|---|---:|---|
| `components/community/HKDWWelcomeCard.tsx` | 229 | Live, rendered on `/community/2027-hk-dragon-worlds` |
| `components/races/BlueprintWelcomeCard.tsx` | 154 | Live, rendered on `/(tabs)/races` |
| `app/dragon-worlds-privacy.tsx` | 304 | Unrelated — App Store privacy policy |
| `scripts/seed-dragon-worlds-2027.mjs` | 689 | Seeds the regatta/fleets/sailors, NOT the blueprint |
| `supabase/migrations/20260206002000_seed_dragon_worlds_community.sql` | 85 | Seeds the `2027-hk-dragon-worlds` community |
| `supabase/migrations/20260204005000_fix_dragon_communities.sql` | 197 | Unrelated — fixes Dragon class community data globally |
| `supabase/functions/firebase-auth-bridge/index.ts` | 569 | Live edge function (v36, deployed 2026-05-12) — core of the bridge flow |
| `lib/auth/firebaseBridge.ts` | ~40+ | Client-side bridge helper |
| `app/_layout.tsx:255+` | ~80 | URL token extraction + session establishment + redirect orchestration |
| `app/blueprint/[slug].tsx:196-319` | 124 | `?auto_subscribe=1` URL handler — sets AsyncStorage flag, switches interest |
| `app/community/[slug].tsx:289` | 1 | Renders `HKDWWelcomeCard` |
| `app/(tabs)/races.tsx:5111` | 1 | Renders `BlueprintWelcomeCard` |
| `vercel.json:47-52` | 6 | `/redeem` redirect |
| `migrations/20251202_add_public_publishing_tables.sql` | 375 | Unrelated — club microsite tables, mentions "dragon-worlds-2027" only as an example subdomain |
| `docs/audit/onboarding-and-identity-plan.md` | 199 | Prior audit (pre-bridge-v36) — identified bridge auto-joins community, flagged auto-enroll-into-program as a gap; that gap was subsequently closed by bridge v36 |
