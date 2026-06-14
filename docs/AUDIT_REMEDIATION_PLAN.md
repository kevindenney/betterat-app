# BetterAt — Codebase Audit & Remediation Plan

> Generated 2026-06-13. Findings come from a multi-agent audit of data-fetching, services,
> component render perf, the app shell, and build/repo hygiene. Security and hygiene claims
> were independently verified against `git ls-files`; **several original agent claims were
> false and have been removed** (see "Claims that did NOT hold up" at the bottom).
>
> **How to use this doc (for the executing agent):** Work top-down. Each item has a stable
> `file:line` anchor, the problem, the fix, and a **Verify** step. Line numbers drift — always
> re-read the file and confirm the described pattern is still present before editing. Items
> marked `[VERIFIED]` were confirmed by the auditor; items marked `[REPORTED]` are agent
> findings you must confirm by reading the cited lines first. Run `npm run typecheck` and
> `npm run lint` after each tier. Stage files by explicit path; never `git add .` (`.pen` files
> are user WIP).

---

## Cross-check against a second independent audit (Codex)

A second audit was run independently. **Where both audits agree, confidence is high — do those first.**
Items unique to the Codex pass were verified by the auditor and folded in below with `[VERIFIED]`.

**Both audits independently flagged (high confidence):**
- AtlasScreen / races / RaceSummaryCard / ComprehensiveRaceEntry are architectural hotspots → **P1.1, P2.2**
- AuthProvider does too much; over-centralized `_layout.tsx` startup → **P1.2, P1.3, P4.3**
- Over-fetching via `select('*')` → **P2.4**, escalated to a systemic guardrail in **P4.1**

**Found only by THIS audit (Codex missed):** P0.1 credentials password; P1.4 logout cache leak; P1.5 RQ
defaults; the specific N+1 loops in P1.6; P1.7 silent-error masquerade; P2.5 CheckInService subquery bug +
invalidation-key mismatch; P2.3 profile-dedup; P1.3 `ready`-flag bug; and the debunked false hygiene claims.

**Found only by Codex (verified true & added below):** realtime centralization (**P1.8**); tab-shell
re-render surface (**P1.9**); the *scale* of systemic debt — `select('*')` = **684** occurrences,
`@ts-nocheck` = **60** files (incl. `hooks/useData.ts:1`), `@ts-ignore` = **32** — plus CI guardrails
(**P4.1, P4.2**); console patching (**P4.3**); and the 12GB build-heap as a bundle-graph symptom (**P4.4**).

---

## P0 — Security (do first, in isolation)

### P0.1 — iOS distribution-certificate password committed to git `[VERIFIED]`
- **File:** `credentials.json` (tracked, NOT gitignored)
- **Problem:** Contains `ios.distributionCertificate.password` (`apOzM5+LLUoaB+qM/TqclA==`) in plaintext. The `.p12` itself is not tracked, but the password is.
- **Fix:**
  1. Treat the password as compromised — **rotate the iOS distribution certificate** via EAS / Apple Developer (this is a user action; flag it, don't attempt it).
  2. `git rm --cached credentials.json`, add `credentials.json` to `.gitignore`.
  3. Move the password to an EAS secret / local untracked env; reference via `eas.json` credential config.
  4. Purge from history with `git filter-repo` (coordinate with the user — history rewrite is destructive).
- **Verify:** `git ls-files | grep credentials.json` returns nothing; `git check-ignore credentials.json` echoes the path.

---

## P1 — High-impact architecture & performance

### P1.1 — Decompose `AtlasScreen.tsx` (12,217 lines; `FrameF1` ≈ 3,171 lines) `[REPORTED]`
- **File:** `components/ios-register/atlas/AtlasScreen.tsx` (FrameF1 ~1919–5089)
- **Problem:** A single component owns map lifecycle + 20+ feature states (commit/reposition/retrace/reshape modes, racing-area editing, step selection, series modal, search sheet, saved jumps, overlays). Any state change (zoom, pan, modal toggle, **60Hz polygon-drag events** at ~2086–2270) re-renders the whole frame including the MapLibre canvas and every sheet.
- **Fix (extract in this order; each is independently shippable):**
  1. `<MapSurface>` — dumb canvas + pin-press handler only.
  2. `<RacingAreaEditor>` — owns `reshapeTarget`/`repositionTarget` **local** state; lift only the final shape on confirm/blur (kills the 60Hz cascade).
  3. `<SearchSheetContainer>` — isolates search modal state; gate nearby query with `enabled: !searchOpen && !selectedPin` (~1919–2000) so it stops fetching while search is open.
  4. `<FloatingChrome>` — filter chips + profile + search button.
  5. Leave `FrameF1` as a thin (~300-line) orchestrator.
- **Verify:** Re-read the file; confirm FrameF1 line span and the drag-state location before splitting. After each extraction, exercise the Atlas tab in the iOS sim (relaunch, not Cmd+R — RQ cache is stale on reload) and confirm pins, polygon edit, and search still work.

### P1.2 — Split oversized context `value` objects to stop app-wide re-renders `[REPORTED]`
- **Files:** `providers/AuthProvider.tsx` (~1716–1746, 17-field value), `providers/OrganizationProvider.tsx` (~796–820, 20-field value), `providers/InterestProvider.tsx` (~768–801, 12-field value); tree assembled in `app/_layout.tsx` (~732–760).
- **Problem:** Each provider exposes one large `value`. A change to any field (e.g. `loading`, `memberships`) re-renders every consumer, even those reading one unrelated field.
- **Fix:** Split each into `*State` + `*Actions` contexts (actions are stable, memoized once). Consumers subscribe only to what they read.
- **Verify:** Confirm the `value={{...}}` shapes by reading each provider. Profile with React DevTools / `why-did-you-render` if available; otherwise sanity-check by toggling interest and confirming unrelated tabs don't re-render.

### P1.3 — Gate auth/routing on a `ready` flag, not a transient-null `user` `[REPORTED]`
- **Files:** `app/_layout.tsx` AuthGate (~445–446, 490–542), InterestSelectionGate (~430–459); `providers/AuthProvider.tsx` (`ready`/`signedIn` ~1703–1714).
- **Problem:** Gates check `!user`/`!signedIn` without first confirming `ready === true`. During startup `user` is transiently `null`, producing infinite spinners, false "session dropped" toasts, and flashing interest-selection modals. This matches the documented recurring bug (`feedback_settings_screen_infinite_spinner`).
- **Fix:** Standardize on `if (!ready) return <Splash/>` first, then branch on `signedIn`/`user`. Apply to both gates and any settings-screen loaders that early-return on `!user`.
- **Verify:** Read AuthProvider to confirm `ready` semantics. Test: fresh launch on native sim, OAuth callback, and sign-out → sign-in cycle; no spinner-lock, no modal flash.

### P1.4 — Clear React Query cache on sign-out `[VERIFIED gap]`
- **Files:** `providers/AuthProvider.tsx` (signOut path), `app/_layout.tsx` (~127–144, queryClient created at module load, `gcTime` 30min).
- **Problem:** `grep` confirms **no** `queryClient.clear()` / `removeQueries()` on logout. Previous user's cached data (name, interests, posts) lingers up to 30min and can flash for the next user on a shared device — a privacy leak.
- **Fix:** Call `queryClient.clear()` inside `signOut`/`clearInvalidSession`.
- **Verify:** Sign out → sign in as a different sim account; confirm no stale data appears.

### P1.5 — Set global React Query defaults (staleTime / refetchOnWindowFocus) `[REPORTED]`
- **File:** root `QueryClient` in `app/_layout.tsx` (~127–144).
- **Problem:** Most hooks have no `staleTime`; only `useMyTimeline` (`hooks/useTimelineSteps.ts:67`) sets `refetchOnWindowFocus:false`. On mobile, every app-switch/focus triggers refetch storms.
- **Fix:** Set defaults `{ queries: { staleTime: 30_000, gcTime: 5*60_000, refetchOnWindowFocus: false } }`; override per-hook only where immediate freshness is required (e.g. live race). Apply `refetchOnWindowFocus:false` consistently to the other timeline hooks (`useTimelineSteps.ts:94`, `:110`).
- **Verify:** Confirm current defaults by reading the QueryClient ctor. After change, alt-tab on web and confirm queries don't refire.

### P1.6 — Collapse data waterfalls into batched queries / RPCs `[REPORTED]`
Confirm each cited loop/sequence by reading the lines, then fix:
- `services/CoachingService.ts:2858–2870` — `searchCoachesMarketplace` calls `getNextAvailableSlot()` **per coach** (N+1). Fetch all `coach_availability` for the coach IDs in one `.in('coach_id', ids)` query, build a map, then map. **(highest-impact N+1)**
- `services/CoachingService.ts:748–891` — `getClientDetails` runs independent queries sequentially. After `sailorProfile`, `Promise.all` the race/regatta/strategy lookups.
- `services/BlueprintFleetService.ts:74–119` — 4 sequential round-trips (blueprint_steps → subscribers → peer progress → viewer progress). Replace with one RPC `get_blueprint_fleet_view(blueprint_id, viewer_id)`.
- `hooks/useMySubscriptions.ts:38–103` — 3 sequential queries (subscriptions → blueprints → orgs+users). Replace with one RPC joining blueprints + organizations.
- `hooks/useData.ts:717–839` (`useDashboardData`) — 6 hooks fire sequentially; consider a single dashboard RPC, or at minimum parallelize.
- **Verify:** For each, count Supabase round-trips before/after (network panel or `read_network_requests`). RPCs must wrap `auth.uid()` as `(SELECT auth.uid())` in RLS (`feedback_rls_auth_uid_must_be_wrapped`).

### P1.7 — Stop silent error-swallowing that masks failures as empty state `[REPORTED]`
- **Files:** `services/CoachingService.ts:719, 724, 893, 4284` (and `.catch(()=>{})` at 1464, 1676, 1722, 4065).
- **Problem:** Queries return `[]`/`null` on error (`.error ? [] : data`), so RPC/schema failures render as "no data" instead of an error — the documented "RPC error masquerades as undeployed" trap (`feedback_portfolio_rpc_error_masquerades_as_undeployed`).
- **Fix:** Throw (or surface via logger + error state) on `result.error`; reserve empty returns for genuinely empty data. Replace `.catch(()=>{})` with `.catch(err => logger.error(...))`.
- **Verify:** Force an error (bad column) and confirm the UI shows an error path, not an empty state.

### P1.8 — Centralize Supabase realtime; re-enable connection monitoring `[VERIFIED]`
- **Files:** `services/RealtimeService.ts` (constructor ~line 65 has `// TEMPORARILY DISABLED for diagnostics - investigating memory crash`, `initializeConnectionMonitoring()` commented out); **22** other files under `hooks/`, `components/`, `providers/`, `app/` call `.channel(...).subscribe()` directly.
- **Problem:** Ownership is split. Monitoring is off, and 22 call sites create channels ad-hoc — duplicate subscriptions and leaks are untraceable. This is likely related to the memory-crash that forced the 12GB heap (see P4.4) and the disabling itself.
- **Fix:**
  1. Re-enable + harden `RealtimeService` (idempotent subscribe, ref-counted channels keyed by topic, guaranteed teardown).
  2. Migrate the 22 direct `.channel()` sites to go through the service.
  3. Add a mount→unmount test asserting `supabase.getChannels().length` returns to its baseline.
- **Verify:** `grep -rln --include='*.ts' --include='*.tsx' "\.channel(" hooks components providers services app | grep -v RealtimeService` should approach zero. Open/close a realtime screen 10× in the sim and confirm channel count is stable (no growth).

### P1.9 — Decompose the tab shell so unrelated counts don't re-render navigation `[VERIFIED]`
- **File:** `app/(tabs)/_layout.tsx` — pulls auth, interests, orgs, vocabulary, `useUnreadMessageCount(user?.id)` (line 99), `useInboxCount()` (line 100), tours, dimensions, drawer state into the shell; `badgeCounts={...}` at ~439 means any of those changing re-renders the whole `Tabs` navigator.
- **Fix:** Extract `components/navigation/TabNavigator.tsx`, `tabScreens.tsx`, `tabScreenOptions.ts`, `useTabBadgeCounts.ts`, `TabTourOverlayHost.tsx`. Move messaging/inbox/org count subscriptions into a focused `useTabBadgeCounts` hook so a badge update re-renders only the badge, not the navigator.
- **Verify:** Read the file to confirm the hook calls at 99–100 and badge block at ~439. After refactor, a new message should update only the tab badge (DevTools), not the whole shell.

---

## P2 — Medium-impact (render hygiene, dedupe, correctness)

### P2.1 — Memoize hot-path callbacks/styles in Atlas & races `[REPORTED]`
- `components/ios-register/atlas/AtlasScreen.tsx` — 30+ inline `onPress={() => setX(...)}` (filter chips ~843–849, top chrome ~631–689) break memo on child `Pressable`s; inline derivations `.filter().map()` at 759/803/1425/1517 run every render. Wrap callbacks in `useCallback`, derivations in `useMemo`, add `key` to the layer `.map()` at ~1517.
- `app/(tabs)/races.tsx` — ~52 inline `style={{...}}` defeat `StyleSheet.create`; lookups at 1288/1298/1324 (byId map, dedupe, sort) recompute every render → `useMemo`. Move `getDemoEvent()` (called per-render ~74) to module scope.
- **Verify:** Re-read the cited lines (they shift). Visual check in sim — chips/cards shouldn't jank on interaction.

### P2.2 — Decompose flat-state mega-forms into memoized sections `[REPORTED]`
- `components/races/ComprehensiveRaceEntry.tsx:200–444` — 60+ `useState` fields; one keystroke re-renders the whole form (incl. course preview, maps, rig card). Group state by concern and extract `<BasicInfoSection>`, `<TimingSection>`, `<CourseSection>` as memoized children with local handlers.
- `components/cards/content/RaceSummaryCard.tsx` (5,057 lines) — top-level memo is shallow; extract `<RaceSummaryPhaseContent>`, `<CrewAndCollaborationSection>`, `<RaceUrgencyBadge>` with stable `useCallback` props.
- **Verify:** Typecheck; sim-test that typing in one field doesn't re-render siblings (DevTools highlight).

### P2.2b — Virtualize data-heavy scroll surfaces; remove nested ScrollViews `[VERIFIED]`
- `app/(tabs)/races.tsx:4779` — the main surface is a `<ScrollView>` rendering large card lists; replace with `FlatList`/`SectionList`/`FlashList` and lazy-mount detail panes.
- `components/cards/content/RaceSummaryCard.tsx:2430` — a `<ScrollView>` nested inside the card's `Pressable`. Per `project_virtualization_candidates_audit`, a vertical scroll container inside an ancestor scroll container negates virtualization and fights parent scrolling. Card content should be bounded by parent list virtualization, not its own ScrollView.
- **Verify:** Confirm the two lines still hold the ScrollViews. After change, scroll the races tab with 100+ items and check for jank / no nested-scroll warning.

### P2.3 — Extract a shared profile-aggregation helper (kill 3× duplication) `[REPORTED]`
- **Files:** `services/ActivityCommentService.ts` (67–110, 215–230, 312–340), `services/CrewFinderService.ts` (297–314, 555–577, + ~9 `new Map(profiles.map(...))` sites), `services/CoachingService.ts:636–650`.
- **Problem:** The same "fetch `profiles` + `sailor_profiles`, build Maps, merge, fall back to `users`" logic is copy-pasted 3+ times with divergent shapes. Note the documented split: `users.full_name` is the email for demo sailors; never `Promise.all` the sub-fetches blindly (`feedback_seed_sailors_users_vs_profiles`).
- **Fix:** Add `ProfileAggregationService.getUserProfiles(userIds)` returning merged `{ profile, sailorProfile }`; replace call sites.
- **Verify:** Author names still render correctly on comments, crew lists, and coach clients in the sim.

### P2.4 — Replace `.select('*')` with explicit columns on wide/hot tables `[REPORTED]`
- `hooks/useData.ts:119–170` (regattas join), `services/PracticeTemplateService.ts:58/77/96/116` (also add `.limit()`), `services/CoachingService.ts:306/666/673/680`, `services/CrewFinderService.ts:100/105`.
- **Fix:** Define shared column constants (e.g. `REGATTA_COLS`) and select only needed fields; add `.limit()` to unbounded list fetches.
- **Verify:** Confirm UI still has every field it reads (grep consumers before trimming columns).

### P2.5 — Fix subquery / invalidation correctness bugs `[REPORTED]`
- `services/CheckInService.ts:684–691` — `.not('entry_id','in', supabase.from(...).select(...))` passes a builder object, not values → filter is wrong. Fetch the IDs first, then `.not('entry_id','in', '(${ids})')` or do it in an RPC.
- `hooks/useTimelineSteps.ts:159–166` — invalidates `['timeline-steps', variables.user_id]` (never matches list keys keyed on `'mine'`) alongside ad-hoc keys that may not exist. Use `{ queryKey: ['timeline-steps'], exact: false }` and document downstream keys.
- `hooks/useMySubscriptions.ts:42` — `supabase.auth.getUser()` inside `queryFn` re-fetches auth on every miss. Read user upstream; pass `user.id` into the queryKey.
- **Verify:** For CheckInService, assert the reminder query returns only not-yet-notified entries. For invalidation, mutate a step and confirm lists refresh.

### P2.6 — Remove `useAuth()` no-op subscription in `StackWithSplash` `[REPORTED]`
- **File:** `app/_layout.tsx:556` — calls `useAuth()` but uses nothing; subscribes the Stack to every auth change. Delete the line (guards live in AuthGate/InterestSelectionGate).
- **Verify:** Routing still works on launch and after auth transitions.

### P2.7 — Guard `useEffect` init handlers with `[]` `[REPORTED]`
- **File:** `app/_layout.tsx:596–600` — `initialize*MutationHandlers()` run with no deps array → every render. Add `[]` and make idempotent to avoid duplicate global handlers / leaks.
- **Verify:** Read the effect; confirm no deps array today. Add one; confirm handlers still register once.

---

## P3 — Hygiene & build (low risk, do anytime)

### P3.1 — Remove tracked build/debug artifacts `[VERIFIED]`
- `depth-layer-test.png` (~982KB) and `dist-test/{bathymetry-sw.js,favicon.svg,widgets/embed.js}` are tracked. `git rm --cached` them and add patterns (`*.png` at root, `dist-test/`) to `.gitignore`.
- **Note:** The build-hygiene agent also claimed `*.jks`, `google-play-service-account.json`, `bugreport-*`, `TasteHK_*.pdf`, and `ios/build/` (317MB) were committed — **all FALSE per `git ls-files`.** They exist on disk but are untracked. Do not act on those.

### P3.2 — Relocate 36 root-level one-off scripts `[VERIFIED count]`
- 36 tracked `*.mjs` at repo root (`fix-dragon-races.mjs`, `test-skill-upload-*.mjs`, etc.) plus many root `*.sql`. Move active ones into `scripts/`, archive/delete dead ones. Clarifies the tree; reduces risk of CI running stragglers.
- **Verify:** `git ls-files '*.mjs' | grep -vE '^(scripts|node_modules)/'` shrinks toward zero; nothing in `package.json` scripts references a moved path without updating it.

### P3.3 — Confirm/remove unused webpack path `[REPORTED]`
- `webpack.config.js` is referenced only in `package.json` (not `eas.json`/`app.config.js`); Expo web uses Metro by default. Confirm no `build:web`/script invokes webpack, then delete `webpack.config.js` and fold its MapLibre string-replace into `metro.config.js` if still needed.
- **Verify:** `grep -rn webpack package.json scripts/` and a clean `npm run build:web` after removal.

### P3.4 — Consolidate icon libraries `[REPORTED]`
- Both `@expo/vector-icons` (~810 uses) and `lucide-react-native` (~160 uses) ship. Migrate Lucide → Expo icons, drop `lucide-react-native` (~250KB gzip on web).
- **Verify:** No remaining `lucide-react-native` imports; icons render on web + native.

### P3.5 — Tighten Metro/Babel/TS config `[REPORTED — confirm each]`
- `metro.config.js:63` `maxWorkers: 2` likely throttles rebuilds → `os.cpus().length - 1`.
- `babel.config.js` lacks `inlineRequires` for production (Metro has it) — add if it doesn't regress.
- `tsconfig.json:44–69` excludes ~22 `coach*` dirs from `strict` checking — schedule gradual re-inclusion.
- **Note:** Per CLAUDE.md, `api/` files cannot use `@/` aliases (Vercel `@vercel/node`); audit `api/` imports for `@/` and convert to relative. Confirm before changing — Vercel is currently paused so this is non-urgent.
- **Verify:** `npm start` rebuild time; `npm run typecheck` clean.

---

## P4 — Systemic quality gates (debt at scale + guardrails)

> These are not single-file fixes — they install rules so the debt stops growing while you pay it down.

### P4.1 — `select('*')` guardrail (684 occurrences) `[VERIFIED count]`
- **Problem:** 684 `select('*')` calls across `app/components/hooks/providers/services` over-fetch wide rows (incl. `providers/AuthProvider.tsx:335` full `users`, `hooks/useData.ts:118` wide race queries).
- **Fix:** Add `services/db/selects.ts` exporting shared explicit column strings (`USERS_COLS`, `REGATTA_COLS`, …). Convert the hottest call sites first (AuthProvider, useData, CoachingService, CrewFinderService — see P2.4). Add an npm/CI check that fails when `select('*')` appears outside a small allowlist.
- **Verify:** `grep -rn --include='*.ts' --include='*.tsx' "select('\*')" app components hooks providers services | wc -l` trends down from 684; CI blocks new occurrences.

### P4.2 — Retire `@ts-nocheck` / `@ts-ignore` (60 files / 32 sites) `[VERIFIED count]`
- **Problem:** 60 files start with `@ts-nocheck` (incl. the shared `hooks/useData.ts:1`) and 32 `@ts-ignore` sites — type safety is nominal in core data paths.
- **Fix:** Remove `@ts-nocheck` from `hooks/useData.ts` first (convert to typed React Query hooks, ties into P1.6/P2.4), then scoring/weather/race-registration services. Add a CI check blocking *new* `@ts-nocheck`/`@ts-ignore`.
- **Verify:** `grep -rln --include='*.ts' --include='*.tsx' "@ts-nocheck" app components hooks providers services lib | wc -l` trends down from 60; typecheck stays green.

### P4.3 — Decentralize `_layout.tsx` startup + replace global console patching `[VERIFIED]`
- **File:** `app/_layout.tsx` — owns diagnostics, **console patching** (`console.error` reassigned at lines 82 & 182, `console.warn` at 164), auth routing, interest gating, mutation init, favicon/service-worker/web-CSS, Firebase bridge, and the full provider tree. (Codex's broader framing of P1.2/P2.6/P2.7.)
- **Fix:** Extract `components/app/AuthGate.tsx`, `components/app/InterestSelectionGate.tsx`, `components/app/FirebaseBridgeHandler.tsx`, `providers/AppProviders.tsx`, `lib/app/bootstrapDiagnostics.ts`, `lib/app/webRuntimeGuards.ts`. Leave `_layout.tsx` responsible only for fonts, provider shell, and stack routing. Replace blanket `console.*` reassignment with `lib/logger.ts` (namespaced dev logs, prod errors → Sentry, no blanket suppression).
- **Verify:** Confirm the three `console.* =` lines. After refactor, real warnings/errors surface in dev; `_layout.tsx` LOC drops substantially; public-route detection has a unit test.

### P4.4 — Bundle audit; treat the 12GB build heap as a symptom `[VERIFIED]`
- **File:** `package.json:6,7,16` — `NODE_OPTIONS='--max-old-space-size=12288'` on `start`/`start:reset`/`build:web`.
- **Problem:** CLAUDE.md accepts this as "needed for our build," but a 12GB heap requirement points to an oversized module graph (map/deck/three/pdf/native-only modules pulled eagerly). Likely linked to the realtime memory-crash in P1.8.
- **Fix:** Run a web bundle analysis; dynamic-import heavy/native-only modules by route (maps, AI SDKs, PDF, charts). Target: shrink the graph enough to drop the 12GB flag.
- **Verify:** Bundle report before/after; `npm run build:web` succeeds with a lower `--max-old-space-size` (step it down). This is a measurement task — don't lower the flag blind.

---

## Suggested execution order
1. **P0.1** (security) — isolate, coordinate history rewrite + cert rotation with the user.
2. **P1.4 + P1.5** (cache clear + RQ defaults) — small, high-leverage, low-risk.
3. **P1.3** (`ready`-flag gating) — fixes a recurring user-visible bug.
4. **P1.8** (realtime centralize/re-enable) — likely root of the memory pressure behind P4.4; high value.
5. **P1.6 + P1.7** (waterfalls + error surfacing) — per-service, ship incrementally.
6. **P4.1 + P4.2 guardrails** — land the CI checks early so new `select('*')`/`@ts-nocheck` stop accruing while you do the rest.
7. **P1.1 + P1.2 + P1.9 + P4.3** (Atlas + context + tab-shell + startup splits) — largest effort; do behind careful sim testing.
8. **P2.*** render/dedupe/correctness.
9. **P3.* + P4.4** hygiene + bundle audit whenever convenient.

## Claims that did NOT hold up (verified false — ignore)
- `.jks` keystore, `google-play-service-account.json`, `bugreport-*.txt/.zip`, `TasteHK_*.pdf`, `ios/build/` xcarchive (317MB) committed → **untracked**, not in git.
- `.gitignore` "duplicated 6×" → it's 78 lines, no duplicate lines.
- `.env` committed → untracked.
