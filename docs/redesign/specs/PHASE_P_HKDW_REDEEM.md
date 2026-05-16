# Spec: HKDW deep-link receipt — gap-fill (corrected)

**Phase ID:** P
**Status:** Ready for implementation
**Target ship:** Tuesday May 19 (in production web build for May 20 HKDW launch)
**Depends on:** Phase N shipped ✅ (commits da40ea86 through bbe056c9)
**Platform:** Web first. Mobile parity is a fast-follow, not in this spec.

**Supersedes:** Original Phase P spec (which assumed greenfield). This version is informed by `docs/redesign/HKDW_INFRASTRUCTURE_AUDIT_2026-05-16.md` (commit 947dc636).

---

## Context

On May 20, the Hong Kong Dragon Worlds 2027 (HKDW) app launches. It has an "About BetterAt" tab. Four HKDW user types — sailor, spectator, media, race admin — see that tab. Each user type has a different URL pointing into BetterAt.

**Scope X (confirmed):** Only sailors get an active BetterAt experience. The other three see placeholders. The DW2027 blueprint is for sailors only.

**What already exists** (per audit):
- `supabase/functions/firebase-auth-bridge` v36 (deployed 2026-05-12) auto-joins HKDW users to the `2027-hk-dragon-worlds` community and auto-subscribes them to the `dragon-worlds-2027-peak-performance` blueprint, server-to-server
- `HKDWWelcomeCard.tsx` on `/community/2027-hk-dragon-worlds`
- `BlueprintWelcomeCard.tsx` on `/(tabs)/races`
- `app/dragon-worlds-privacy.tsx` route (purpose: needs verification in implementation)

**What doesn't exist:**
- A named landing URL (this spec uses `/redeem`)
- Placeholder pages for non-sailor user types
- A unified welcome banner on `/practice` (the spec's preferred canonical, replacing or supplementing the existing two cards)
- Analytics on the HKDW signup funnel
- Auto-follow Kevin (deliberately not in scope — see Q4 below)

---

## Confirmed decisions (Kevin)

1. **Canonical welcome card:** New banner on `/practice`. Claude Design produced canonical. The existing `HKDWWelcomeCard` and `BlueprintWelcomeCard` are NOT replaced in this spec — they live on their own surfaces. The new banner is additive on `/practice` specifically.
2. **33 pre-bridge users:** Leave them. No backfill script. They'll have degraded state but not broken.
3. **URL naming:** `/redeem` (not `/dragon-worlds`). Generic pattern that supports future regattas / host apps.
4. **Auto-follow Kevin:** DROPPED. Replaced with auto-subscribe to the blueprint, which is already happening server-side via the bridge. Following individuals is a separate, opt-in concept and not in this spec. Privacy model: blueprint subscribers can see other subscribers unless their profile is set to private (Phase N just shipped private-by-default for new signups).
5. **Source attribution:** Use existing flow's attribution. Build analytics on existing data. No new column.
6. **Non-sailor user types:** Placeholders (Scope X stands). Same email capture pattern.

---

## URL design

HKDW maintains four links:
- Sailor: `https://better.at/redeem` (or `https://better.at/redeem/sailor`)
- Spectator: `https://better.at/redeem/spectator`
- Media: `https://better.at/redeem/media`
- Race admin: `https://better.at/redeem/race-admin`

**Open implementation question:** Bare `/redeem` for sailors, or explicit `/redeem/sailor`? Bare is shorter and most-traveled. Explicit is consistent with siblings. Recommend bare — sailors are the canonical path.

---

## Routes

### `/redeem` (sailor entry) — three auth states

Per Claude Design's canonical (3 mobile webview frames + desktop frame). Same hero structure across states; content varies.

**State A: Unauthenticated**
- Hero: "Prepare for Dragon Worlds 2027"
- Subtitle: "Follow Kevin Denney's preparation blueprint. Plan, do, reflect — together with the fleet."
- Primary CTA: "Get started" → existing signup flow
- Secondary: "Already have an account? Sign in" → existing signin flow
- "What is BetterAt" footer per canonical

**State B: Authenticated, NOT yet subscribed to DW2027 blueprint**
- Hero: "Welcome back, [first name]"
- Subtitle: "Follow Kevin's Dragon Worlds 2027 prep blueprint?"
- Primary CTA: "Follow the blueprint" → calls existing blueprint subscription API for `dragon-worlds-2027-peak-performance`, routes to `/practice`
- Secondary: "Not now, take me to BetterAt" → `/practice`
- "What happens when you tap follow" footer per canonical

**State C: Authenticated, ALREADY subscribed**
- Server-side 302 to `/practice`. No page rendered. Per canonical (documentation-only frame).

### `/redeem/spectator`, `/redeem/media`, `/redeem/race-admin`

Per Claude Design's canonical (3 mobile webview frames). Same shared layout, role copy varies.

Each shows:
- Hero: "BetterAt for [Spectators | Media | Race Admins]"
- Subtitle: "Coming soon. We're starting with Dragon Worlds 2027 sailors and will expand from there."
- Email capture form → `redeem_waitlist` table (renamed from `dragon_worlds_waitlist` — generic for future regattas)
- "Learn about BetterAt" link → `/`

---

## Signup flow

**This spec does NOT introduce a new signup route.** The existing signup flow handles new accounts. The auth bridge handles auto-subscribe server-side once a user signs up via HKDW.

What's added:
- After signup, if the user has an HKDW source attribution AND is NOT yet subscribed to DW2027 blueprint, redirect them to `/redeem` (State B) on first auth. Otherwise, normal post-signup flow.
- "Get started" CTA on `/redeem` (State A) routes through normal signup with an additional query param `?redeem=dragon-worlds-2027` so the post-signup redirect knows to land them back on `/redeem`.

---

## Welcome banner on `/practice`

Per Claude Design's canonical (banner present + banner dismissed + blown-up detail frames).

- Renders on `/practice` for users where:
  - User is subscribed to `dragon-worlds-2027-peak-performance` blueprint, AND
  - `dragon_worlds_welcomed_at` is NULL on their profile (or equivalent server-side dismissal flag)
- "Got it" sets `dragon_worlds_welcomed_at = now()` on profile, dismisses, doesn't return
- Optional close X in top-right as secondary dismiss
- Copy per canonical

**Coexistence with existing cards:**
- `HKDWWelcomeCard.tsx` on `/community/2027-hk-dragon-worlds` — not touched
- `BlueprintWelcomeCard.tsx` on `/(tabs)/races` — not touched
- New banner on `/practice` is additive

Three cards on three surfaces is acceptable for May 20. Consolidation is post-demo work.

---

## New data model addition

Only one addition this time (down from four in the original spec):

```sql
ALTER TABLE profiles ADD COLUMN dragon_worlds_welcomed_at TIMESTAMPTZ;
```

For the welcome banner dismissal flag.

**Out of new data model:**
- ~~`signup_source` column~~ — existing flow already attributes; analytics on existing data
- ~~Blueprint `slug` column~~ — blueprint already has `dragon-worlds-2027-peak-performance` slug per audit
- `redeem_waitlist` table — yes, still needed for the three placeholder pages (rename of `dragon_worlds_waitlist` for genericity):

```sql
CREATE TABLE redeem_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('spectator', 'media', 'race_admin')),
  source TEXT,  -- e.g., 'hkdw_dragon_worlds_2027' for analytics
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redeem_waitlist_role ON redeem_waitlist(role);
CREATE INDEX idx_redeem_waitlist_source ON redeem_waitlist(source);
CREATE UNIQUE INDEX idx_redeem_waitlist_email_role ON redeem_waitlist(email, role);

ALTER TABLE redeem_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON redeem_waitlist FOR INSERT TO anon WITH CHECK (true);
```

---

## Analytics events

Build on existing source attribution (no new attribution column). Events on the existing analytics layer:

- `redeem_landing_viewed` — on `/redeem` view, with `auth_state` and `referrer`
- `redeem_cta_clicked` — on either State A or State B primary CTA
- `redeem_blueprint_followed` — on subscription creation from State B CTA (separate from bridge's auto-subscribe so we can split funnel by entry path)
- `redeem_practice_welcomed` — on welcome banner first view on `/practice`
- `redeem_practice_dismissed` — on banner dismiss
- `redeem_waitlist_signup` — for placeholder pages, with `role` and `source`

---

## Implementation order

Each step a separate commit. All behind flag `EXPO_PUBLIC_FF_REDEEM` defaulting off.

1. **Migration** (small): `dragon_worlds_welcomed_at` on profiles + `redeem_waitlist` table. Apply via `db push --dry-run` then `db push` (same direct-push pattern Phase N used).
2. **Placeholder routes** `/redeem/spectator`, `/redeem/media`, `/redeem/race-admin` with shared layout
3. **`/redeem` landing — State A** (unauthenticated)
4. **`/redeem` landing — State C** (server-side 302 redirect for already-subscribed)
5. **`/redeem` landing — State B** (auth-not-yet-subscribed CTA flow)
6. **Post-signup redirect logic** for `?redeem=dragon-worlds-2027` parameter
7. **Welcome banner on `/practice`** wired to `dragon_worlds_welcomed_at`
8. **Analytics events** for the 6 listed events

After each commit: typecheck + lint pass, flag-off path preserved.

---

## Cutover flag

`EXPO_PUBLIC_FF_REDEEM`. Behind OFF: all `/redeem*` routes 404 or redirect to `/`. Welcome banner on `/practice` doesn't render. Behind ON: routes render, banner renders for matching users. Flip via EAS env var + new build (same pattern as Phase I).

---

## Out of scope

- Consolidating the three welcome cards (post-demo)
- Backfilling 33 pre-bridge users (Kevin's call: leave them)
- Auto-follow Kevin (replaced with auto-subscribe via bridge, which already exists)
- Mobile app parity (fast-follow)
- "See others on the blueprint" community surface beyond what already exists in `/community/2027-hk-dragon-worlds`
- HKDW-side "About BetterAt" tab content
- The DW2027 blueprint content (already authored)
- New signup or signin forms (use existing)
- Phase O existing-user privacy migration (post-demo)

---

## Success criteria

A Dragon Worlds sailor on May 20:
1. Opens HKDW app, taps "About BetterAt" tab
2. Lands at `https://better.at/redeem`
3. Sees State A page, taps "Get started"
4. Completes existing signup, returns to `/redeem` (or auth bridge has already auto-subscribed during HKDW-side auth)
5. Lands on `/practice` with welcome banner
6. Banner confirms they're following Kevin's blueprint
7. Can tap a step and begin Plan/Do/Reflect loop

End-to-end time from HKDW tap to first step opened: under 90 seconds.

Non-sailor (spectator/media/race-admin):
1. Lands at `/redeem/<role>`
2. Sees placeholder with email capture
3. Submits email → `redeem_waitlist` row
4. Sees polite "we'll be in touch" confirmation

---

## Open questions remaining

1. **Bare `/redeem` vs `/redeem/sailor`?** Recommend bare. Confirm with Kevin.
2. **Verify `app/dragon-worlds-privacy.tsx`** — what does this existing route do, and does the new `/redeem` work supersede or coexist?
3. **Auth bridge interaction** — Kevin to confirm that the existing bridge auto-subscribe runs for ALL four HKDW user types or just sailors. If all four, the `/redeem/spectator` etc. placeholders should NOT auto-subscribe (since blueprint is sailor-only per Scope X) — bridge may need an adjustment to gate by role.

These three should be answered before Claude Code starts implementation.
