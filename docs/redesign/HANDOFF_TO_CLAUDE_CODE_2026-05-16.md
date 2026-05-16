# BetterAt redesign — handoff to Claude Code

**Date:** 2026-05-16 (Saturday afternoon HK)
**From:** Claude (chat) routing session
**To:** Claude Code, taking over implementation + orchestration

Kevin is moving the routing role from Claude (chat) to Claude Code. Codex remains available for autonomous read-only work (audits, classifications) and execution tasks Claude Code or Kevin assigns. Claude Design produces visual HTML canonicals.

---

## The May 20 deadline

The Hong Kong Dragon Worlds 2027 (HKDW) iOS app launches to ~700 Dragon-class sailors on **Wednesday May 20, 2026**.

The HKDW iOS app has an "About BetterAt" tab. Sailors arriving from that tab are auto-subscribed (server-side via existing auth bridge in `supabase/functions/firebase-auth-bridge`) to Kevin's authored Dragon Worlds 2027 prep blueprint and can use BetterAt's Plan/Do/Reflect loop to prepare for the World Championship.

**Scope X (locked):** sailors get the active blueprint experience on May 20. Spectators, media, officials see existing marketing-tier pages at `/`, `/sports-photography`, `/officiating` respectively. We add waitlist email capture where missing on those pages, don't build new placeholder routes.

The demo runs on a TestFlight + production web build that doesn't exist yet. Critical path from now: Phase P implementation → web deploy → TestFlight build → sailor end-to-end smoke test.

---

## What shipped today (origin/main as of Saturday afternoon)

### Phase N — new-user privacy defaults (SHIPPED ✅)

Commits:
- `da40ea86` feat(db): Phase N — new-user privacy defaults to false
- `081e794c` chore(db): snapshot existing-user profile state post-Phase-N
- `9732ae16` fix(privacy): default profile_public false in service layer
- `c72ca846` fix(privacy): default onboarding public profile toggle off
- `75e35bbf` fix(privacy): guard public profile route for private profiles
- `bbe056c9` fix(privacy): default sailor profiles private for new users

Snapshot: `docs/redesign/PHASE_N_EXISTING_USER_SNAPSHOT_2026-05-16.txt`

Remote schema: `profiles.profile_public` and `sailor_profiles.is_profile_public` default `false` for new rows. Existing 214 + 83 rows preserved at `true` per snapshot.

### Phase I — Series feature (shipped flag-off, awaiting EAS env flip)

4 frames implemented, screenshots verified, flag `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER` defaults false. Flip happens at production build time via EAS env var update + rebuild.

Screenshots: `docs/redesign/screenshots/phase-i-frame-{2,3,4}-*.png`

### Migration drift reconciliation (DONE)

- 31 remote-only Studio migrations marked `--status reverted`
- 11 local-only audited migrations marked `--status applied`
- `db pull` was abandoned — shadow-replay hits a missing `regattas` table that one of the now-reverted Studio migrations originally created. Going forward: write standalone migrations and use `db push --dry-run` + `db push`. Don't attempt `db pull`.

Docs:
- `docs/redesign/SUPABASE_MIGRATION_DRIFT_2026-05-16.md`
- `docs/redesign/REMOTE_SCHEMA_DUMP_2026-05-16.sql` (authoritative remote schema snapshot at 09:30 today)
- `docs/redesign/LOCAL_MIGRATION_CLASSIFICATION_2026-05-16.md`

### Phase O — existing-user privacy migration (audit only, deferred post-demo)

217 affected users found (107 probable real, 107 probable test, 3 unclassified, 4 distinct orgs). Original assumption was a handful — the real number is order of magnitude larger. Deliverables 2-5 (migration SQL, code-path audit, comms plan, runbook) not started. Schedule post-demo.

Audit: `docs/redesign/PHASE_O_AUDIT_2026-05-16.md`

### Phase P — HKDW `/redeem` (IN FLIGHT — primary remaining May 20 work)

Corrected spec: `docs/redesign/specs/PHASE_P_HKDW_REDEEM.md` (commit `8310d216`)
HKDW infrastructure audit: `docs/redesign/HKDW_INFRASTRUCTURE_AUDIT_2026-05-16.md` (commit `947dc636`)

You (Claude Code) completed Step 0 of the Phase P prompt earlier today. Step 0 findings, treat as authoritative going forward:

1. **`app/dragon-worlds-privacy.tsx`** is App Store legal text only for the HKDW iOS app's privacy policy. Unrelated to `/redeem` work. Leave alone.
2. **Auth bridge** (`supabase/functions/firebase-auth-bridge/index.ts`) auto-subscribes whoever it sees to `dragon-worlds-2027-peak-performance` blueprint with **no role gate**. Sets `user_type: 'sailor'` unconditionally. Not changing this in Phase P.
3. **Non-sailor HKDW links** go to `/officiating`, `/sports-photography`, `/` as plain web URLs (no bridge invocation). Confirmed from HKDW codebase. This is the safe state and we're keeping it.
4. **Post-signup redirect** uses existing `returnTo` query param pattern (plumbed through `app/(auth)/signup.tsx:57`, `commitSignupContext`, and onboarding completion screens). No new query param needed.

**Phase P scope after Step 0 adjustments:**
- Build `/redeem` (sailor landing, three auth states A/B/C per Claude Design canonical)
- Build welcome banner on `/practice` (additive — coexists with existing `HKDWWelcomeCard` and `BlueprintWelcomeCard`)
- Migration: add `dragon_worlds_welcomed_at` TIMESTAMPTZ column to `profiles` + create `redeem_waitlist` table with role enum `('official', 'media', 'spectator')` matching HKDW's vocabulary
- Audit `/officiating` and `/sports-photography` for waitlist email capture; add if missing
- SKIP `/` — general marketing page, don't surface spectator-specific waitlist there
- Wire analytics events (`redeem_landing_viewed`, `redeem_cta_clicked`, `redeem_blueprint_followed`, `redeem_practice_welcomed`, `redeem_practice_dismissed`, `redeem_waitlist_signup`) — pass `referrer=hkdw_dragon_worlds_2027` as event property
- All behind feature flag `EXPO_PUBLIC_FF_REDEEM` defaulting false

**Phase P canonicals status:**
- Claude Design produced 3 canonicals: redeem landing (3 auth states), welcome banner, placeholders
- The placeholders canonical is now obsolete (Scope X adjustment — don't build new placeholder routes)
- Claude Design was last seen editing canonical URL strings from `/dragon-worlds` → `/redeem` in the landing and welcome banner canonicals
- Verify files exist at `docs/redesign/ios-register/phase-p-*.html` on origin/main. If not, ask Kevin to commit them or have Claude Design save them.

**Phase P implementation status (your in-flight work):**
- You received Step 1 go-ahead. As of last update, you were working on the migration step.
- Steps to complete per the corrected spec:
  1. Migration: `dragon_worlds_welcomed_at` column + `redeem_waitlist` table. Use `SENTRY_DSN= supabase db push --dry-run` first, then `db push` if clean.
  2. Audit `/officiating` and `/sports-photography` for waitlist capture; add where missing.
  3. `/redeem` State A (unauthenticated landing).
  4. `/redeem` State C (server-side 302 redirect for already-subscribed).
  5. `/redeem` State B (auth, not-subscribed CTA flow).
  6. Post-signup redirect wiring via `returnTo`.
  7. Welcome banner on `/practice` with `dragon_worlds_welcomed_at` dismissal.
  8. Analytics events.

---

## Critical operational gotchas

- **Supabase CLI workaround.** Always prefix Supabase commands with `SENTRY_DSN=` to bypass the placeholder DSN in `.env`. Example: `SENTRY_DSN= supabase db push --dry-run`. Kevin will fix `.env` later — don't touch it now.
- **No `db pull`.** Shadow-replay hits the missing `regattas` table. Use standalone migrations and `db push` only.
- **Two simulators installed.** BetterAt simulator has `com.betterat.app` AND `com.denneyke.dragonworldshk2027`. Launch the wrong one → cryptic native module errors. Confirm `com.betterat.app` when launching.
- **EAS env management.** Production env is empty as of today. Flag flips for production require `eas env:create --environment production --name <FLAG> --value true`, then a new build. `updates.enabled: false` in `app.config.js` blocks OTA — every flip requires a rebuild.
- **Phase N migration shape works.** Standalone migration file + `db push --dry-run` then `db push` is the proven pattern. Use the same pattern for Phase P's migration.

---

## Working principles Kevin uses

- **Cutover flags default OFF.** Substantive UI changes ship behind a feature flag set false. Pure renames may go unflagged if strictly reversible.
- **Visual verification mandatory for UI.** Static checks (typecheck, lint, tests) are not sufficient. Kevin verifies in simulator or browser after each milestone. Don't flip flags in EAS env without Kevin's go-ahead.
- **Stop-and-surface discipline.** If any spec contradicts repo reality, STOP rather than papering over. Surface what's actually different. This caught major spec drift today multiple times — keep doing it.
- **Per-commit hygiene.** After each commit: typecheck + lint pass. Touched-file precommit lint must pass. Working tree should be clean (except `.claude/scheduled_tasks.lock`) at every reporting point.
- **Spec-before-code, audit-before-spec.** Before drafting any spec, audit what exists. Today proved that assuming greenfield costs hours. The Phase P spec was redrafted after audit revealed substantial existing infrastructure.
- **Phase letters.** B-series = iOS register surfaces. Non-register work uses N+ letters (N privacy, O existing-user privacy, P HKDW redeem). Next available letter is Q.
- **Don't multi-option-poll Kevin.** Recommend one path. Push back on technical and product risk; not on process or pace.

---

## Outstanding decisions Kevin still has to make

1. **Phase I EAS env flip timing.** Phase I is shipped flag-off in code. The flip-to-production happens via EAS env update + new build. Recommended timing: Monday morning, before the May 19 production build cycle. Kevin to confirm.
2. **TestFlight build readiness.** Production EAS profile has no env vars set. Certs, provisioning, app store metadata haven't been audited for May 20 build readiness. Kevin to schedule this — recommended Sunday or Monday morning.
3. **Phase O scheduling.** 217 affected users → real comms plan needed before flip. Post-demo only. Recommend writing Deliverables 2-5 the week after May 20.
4. **`.env` cleanup.** `SENTRY_DSN=your_sentry_dsn` placeholder caused multiple Codex failures today. Kevin to delete or set to real value when convenient.

---

## What to do on first contact

1. Read this document in full. Acknowledge to Kevin.
2. Check `git log origin/main` for any work that's landed since this doc was written. Catch up.
3. Check working tree state. Is there any uncommitted Phase P work in progress that needs to be resumed?
4. Check Phase P canonicals at `docs/redesign/ios-register/phase-p-*.html`. If not present, ask Kevin to retrieve from Claude Design.
5. Report to Kevin: current state, immediate next action you propose, any blockers.

After that: you orchestrate. Kevin will direct from a higher level. Use Codex for autonomous read-only tasks (audits, classifications) when useful. Use Claude Design when new visual canonicals are needed. Otherwise execute directly.

---

## One last thing

The conversation that produced this handoff went 4+ hours and made multiple corrections to assumptions. Today's lessons distilled:

- Audit existing infrastructure before drafting specs
- Use existing patterns (`returnTo`, the auth bridge, existing role pages) rather than inventing parallel ones
- "Make it work, then make it right" is preferable to "make it perfect first" when the deadline is real
- Stop-and-surface saves time even when it feels like it's costing time
- The deadline is May 20, the audience is real (700 Dragon sailors), and the shipping target is a TestFlight build + web. Optimize for "works end-to-end for one sailor on May 20" over "complete feature parity"

Good luck.
