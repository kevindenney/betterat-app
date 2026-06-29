# Context Switcher — Build Spec (for Codex)

> **Goal:** Replace the scattered nav (top-left interest chip + a buried workspace switcher in the
> profile menu + no clear door to Studio/Admin) with **one context chip** built on **two dials**:
> **Workspace × Surface**. Mobile-first. Ship behind a feature flag.
>
> Visual targets (open these in the browser, they are the source of truth for layout & copy):
> - `public/studio-nav-workspace-mock.html` ← **primary** (two-dial model, context sheet, Admin & org-Studio surfaces)
> - `public/studio-nav-chip-mock.html` (chip mechanic, profile sheet, inbox, profile preview/edit)
> - `public/studio-nav-mobile-mock.html` (earlier Do·Create variant — superseded, for reference only)

---

## 1. The model (read before touching code)

Two **independent** dials, plus one **nested sub-control**:

- **Dial 1 — Workspace** (whose hat): `Personal` · an org (`Johns Hopkins`) · a group (`Aberdeen Fleet`).
- **Dial 2 — Surface** (what you're doing): `Practice` · `Studio` · `Admin`. **Which surfaces exist is gated
  by your role in the active workspace.**
- **Interest** (Nursing/Sailing/Golf) is **NOT** a peer of Studio/Admin. It is a sub-control that lives
  **only under the Practice surface**.

Rules:
- **Practice is always Personal/you** (your getting-better across interests).
- **Studio & Admin are workspace-scoped and role-gated.** Switch workspace → available surfaces change.
- **Blueprint provenance follows workspace:** personal-sell blueprints → Personal·Studio; org curricula →
  Org·Studio; group sets → Group·"Group steps". Never one mixed pile.
- **Progressive disclosure:** a plain practitioner sees only `Personal · Practice`. Studio appears after a
  first authored blueprint; an org/group block appears when you hold a role there; `Admin` only when that
  role is a manager role.

Naming decision (already made with the user): the outward mode is **"Studio"** (not "Create"). Do not
introduce the word "Create" in UI.

---

## 2. What already exists (reuse — do NOT rebuild)

| Concern | File | Hook / API to reuse |
| --- | --- | --- |
| Active interest | `providers/InterestProvider.tsx` | `useInterest()` → `currentInterest {slug,name,accent_color}`, `groupedInterests`, `switchInterest(slug)` |
| Active workspace/org | `providers/OrganizationProvider.tsx` | `useOrganization()` → `activeOrganizationId` (`null`/`'__personal__'` = Personal), `activeMembership`, `activeOrganization`, `memberships[]`, `canManageActiveOrganization`, `setActiveOrganizationId(orgId\|null)`, `refreshMemberships()` |
| Role + counts for menu | `hooks/useProfileMenuData.ts` | `useProfileMenuData()` → `memberships`, `isAdmin`, `isAuthor`, `isFaculty`, `counts.authoredBlueprints`, `counts.cohortsMentored`, `counts.subscriberThreads` |
| Inbox badge | `hooks/useInboxCount.ts` (via ProfileDropdown) | `useInboxCount()` → unread count |
| The chip today | `components/InterestSwitcher.tsx` | rendered by `components/navigation/NavigationHeader.tsx` (web + native) |
| Profile menu | `components/ui/ProfileDropdown.tsx` | sections: `IdentityRow`, `PublicFaceStrip`, `RolesSection`, `RoleShortcuts`, link items |
| Studio | `app/studio/` + `components/studio/StudioShell.tsx` | desktop-only gate via `STUDIO_COMPACT_BREAKPOINT`. Sub-routes: `/studio`, `/studio/blueprints/[id]`, `/studio/payouts`, `/studio/earnings` |
| Admin | `app/admin/[orgId]/blueprints.tsx` + `components/admin/AdminShell.tsx` | `useAdminOrgBlueprints(orgId)` |
| Public face | `app/profile/[userId]/index.tsx` → `PublicFaceScreen` (`previewAsPublic` prop; `?preview=1`) | |
| Profile edit | `app/settings/edit-profile.tsx` (+ `/settings/public-face`) | |
| Inbox | `app/(tabs)/inbox.tsx` | `useInboxItems()`, `useInboxDoneItems()`, `useFleetInvites()` |
| Web shell | `components/navigation/WebSidebarNav.tsx` (flag `USE_WEB_SIDEBAR_LAYOUT`, width ≥1024) | |
| Native bottom bar | `FloatingTabBar` (in `app/(tabs)/_layout.tsx`) | |

**Surface is derivable from the route** — you do NOT need a new global "surface" state machine:
`/(tabs)/*` ⇒ Practice · `/studio*` ⇒ Studio · `/admin/*` ⇒ Admin. Use `usePathname()` / `useSegments()`.

**Absent today (this is the work):** there is no unified context chip, no two-level Workspace→Surface
sheet, and Studio/Admin have no mobile shell (desktop width-gated).

---

## 3. Feature flag

Add to `lib/featureFlags.ts`:

```ts
CONTEXT_SWITCHER_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_CONTEXT_SWITCHER_V1, false),
```

Everything below is gated on this flag. When `false`, the current InterestSwitcher + full ProfileDropdown
render exactly as today (no regression). Default `false` until verified; flip to `true` at the end.

---

## 4. Build plan (phased — ship Phase A as one PR)

### Phase A — the switcher + chrome cleanup + minimal mobile Studio/Admin

This is the high-value slice and what makes the model real on a phone.

#### A1. `components/navigation/ContextSwitcher.tsx` (new) — the chip
- Replaces `InterestSwitcher` in `NavigationHeader.tsx` **when the flag is on** (keep `InterestSwitcher`
  importable for flag-off).
- Derive `surface` from `usePathname()`: `practice | studio | admin`.
- **Chip display:**
  - `practice`: left = colored dot using `currentInterest.accent_color`; label = `currentInterest.name`.
  - `studio`: left = purple dot (or org monogram if `activeOrganization` not Personal); label = `Studio`.
  - `admin`: left = org monogram square (org initials, org color); label = `Admin`; accent slate `#475569`.
- Reuse the existing pill styling from `InterestSwitcher` (lines ~162–181). **Gotcha:** css-interop drops
  function-form `style={({pressed}) => …}` on `Pressable` (see `project_css_interop_drops_function_style_on_pressable`)
  — use a **direct style object/array**, not the function form.
- Tap → opens `ContextSheet` (below). On web ≥1024 render as a popover anchored to the chip; on
  native/mobile-web render as a bottom/`Modal` sheet (match `InterestSwitcher`'s existing modal pattern).

#### A2. `components/navigation/ContextSheet.tsx` (new) — the two-level sheet
Layout per `studio-nav-workspace-mock.html` (the "context sheet" phone). Build from live data:

1. **Header group "Personal"** (monogram = user initials):
   - **Practice** row → on tap: `setActiveOrganizationId(null)` then `router.replace('/(tabs)/practice')`.
     Active-state highlight when `surface==='practice'` and workspace is Personal.
     - Nested **Interest** sub-list (only rendered under Practice): map `groupedInterests`; current shows ✓;
       tap → `switchInterest(slug)` and close sheet (stay in Practice). Plus `+ Add interest` row → existing
       add-interest flow used by `InterestSwitcher`.
   - **Studio** row — render only if `isAuthor || counts.authoredBlueprints > 0`. Tap:
     `setActiveOrganizationId(null)` then `router.push('/studio')`.
2. **For each membership in `memberships`** (from `useProfileMenuData`/`useOrganization`), grouped:
   - Institutions/clubs under an **"Organizations"** label; fleets/groups under a single expandable
     **"Groups"** label (DECISION below). Header shows org name + a **role badge** (`Admin`/`Leader`/`Member`).
   - **Studio** row if the role is author/faculty/manager → `setActiveOrganizationId(org.id)` +
     `switchInterest(org.interest_slug)` (mirror existing `handleSwitchToOrg` in ProfileDropdown ~line 180) +
     `router.push('/studio')`.
   - **Admin** row if `MANAGER_ROLES.has(role)` (owner/admin/manager/faculty/instructor — already defined in
     `OrganizationProvider`) → set org + `router.push('/admin/' + org.id)`.
   - For group/fleet types, a **"Group steps"** row → route to the group surface (use the existing group
     route; if none fits, push `/group/[id]`).
3. `+ Join another organization` row at the bottom → existing join flow (whatever `RolesSection` links to).

Switching workspace MUST keep interest aligned exactly as `handleSwitchToOrg` does today (set org +
`switchInterest(org.interest_slug)`); reuse that logic, don't reinvent.

#### A3. Slim `components/ui/ProfileDropdown.tsx`
When flag on, remove from `LoggedInMenu`:
- `RolesSection` (workspace switch — now in the chip)
- `RoleShortcuts` ("Creator Studio" / "Cohorts I mentor")
- the `My Practice` link item
- the `Inbox` link item (now a header bell, A4)

Keep: `IdentityRow`, `PublicFaceStrip` (relabel to **"View & edit profile"**, route unchanged →
`/profile/[userId]?preview=1`), `Account & settings`, `Help & feedback`, `Sign out`. Net menu = identity +
profile + account + help + sign-out.

#### A4. Promote Inbox to a header bell
- Add a bell icon to `NavigationHeader.tsx` (top-right, beside the avatar) on **all** platforms, with
  `useInboxCount()` badge. Tap → `router.push('/(tabs)/inbox')`.
- Remove the `Inbox` row from ProfileDropdown (done in A3).
- DECISION: the badge stays a **global** unread count (not scoped to active workspace) for v1.
- Avoid double-surfacing: leave the `INBOX_TAB_V3` tab as-is for now (don't expand scope), but the bell is
  the canonical entry. Note the redundancy for a later cleanup; do not remove the tab in this PR.

#### A5. Minimal mobile shells for Studio & Admin (so the chip lands somewhere usable on a phone)
Today both are desktop-gated. For the mobile goal:
- **Studio:** add a mobile branch to `app/studio/index.tsx` / `StudioShell` that, below
  `STUDIO_COMPACT_BREAKPOINT`, renders a single-column layout with a **bottom tab set**
  `Home · Blueprints · Subscribers · Threads · Payouts` (mirror the rail items already defined ~lines 80–139).
  Wire Home/Blueprints/Payouts/Earnings to existing routes; Subscribers/Threads can be read-only placeholders
  matching `useStudioHomeData` stubs (do not invent backend). Chip reads "Studio".
- **Admin:** ensure `/admin/[orgId]` renders acceptably on mobile (single column). Bottom tabs
  `Overview · Cohorts · Members · Blueprints · Settings`; only `Blueprints` (`/admin/[orgId]/blueprints`,
  already built) needs to be live — others can route to "coming soon" stubs. Chip reads "[ORG] Admin", slate accent.

> Keep A5 deliberately thin: the point is the **navigation model**, not rebuilding Studio/Admin. Read-only
> placeholders are acceptable where backing queries are stubbed; do NOT fabricate data or new tables.

### Phase B (follow-up PR, not now)
Full mobile Studio surfaces (real Subscribers/Threads data), Admin Cohorts/Members.

### Phase C (follow-up PR, not now)
Merge public-face + edit into one **Preview ⇄ Edit** screen (segmented control on `PublicFaceScreen` for
self-view; Edit reuses `app/settings/edit-profile.tsx` fields + the shipped section-visibility toggles). Per
`studio-nav-chip-mock.html` row 3. Out of scope for Phase A.

---

## 5. Decisions on open questions (so you're not blocked)
- **Groups placement:** orgs (institution/club) listed individually under "Organizations"; groups/fleets
  bucketed under one expandable **"Groups"** header. Personal always first.
- **Inbox bell count:** global across workspaces for v1.
- **Mobile Studio/Admin destinations that are stubbed:** render read-only placeholders, never fake data.

---

## 5b. Post-review corrections (applied 2026-06-29 — keep these, don't regress)

First Codex pass shipped but review caught four issues. Fixes are in `main`; treat these as binding for any future pass.

- **No dead member-org rows.** The switcher lists a workspace only if you can *work* in it.
  In `ContextSheet.tsx`, `orgMemberships` filters to `orgSurfaces(m).canStudio || canAdmin`.
  Plain membership = consumption (its blueprints flow into Personal Practice by interest); those orgs
  belong in Library/Interests, NOT the context switcher. A member-only org with no Studio/Admin surface
  must never render — it produced a header with zero tappable rows.
- **Workspace name taps through to its primary surface.** The org/Personal header row is now a
  `TouchableOpacity`, not a label. Personal → Practice; org → Admin if `canAdmin` else Studio; group →
  Group steps. Sub-rows remain shortcuts. (A row that looks tappable but isn't is the smell we removed.)
- **Phone Studio/Admin = ONE nav, no hamburger.** `StudioShellCompact` no longer renders a slide-over
  drawer (it duplicated the bottom tabs). Bottom tabs are the single nav spine; the context chip switches
  workspace. Do not reintroduce the drawer.
- **Phone Studio header reuses the Practice shell.** `StudioShellCompact` renders the shared `AppChromeRow`
  (context chip left · avatar right) — the same component Practice uses — instead of a bespoke mono + title +
  sign-out-avatar bar plus a separate full-width context row. The two-row chrome read as a different app; one
  `AppChromeRow` makes Studio and Practice feel like one surface. The action cluster, however, is
  surface-specific — see §5c (the `+`/inbox bell are off in Studio/Admin). The page composes its own
  `StudioHeader` (crumbs + greeting) inside `children`, so the chrome row carries only identity + account —
  no redundant workspace/title row. Account/sign-out now lives in the avatar's
  `ProfileDropdown` (full parity with Practice), not a direct sign-out confirm. (The personal Inbox is
  still reachable from the avatar's dropdown — it folds onto the avatar — so dropping the standalone bell
  loses nothing.)
- **Phone Studio Home scrolls as one page.** Panels were `flex:1` each wrapping an inner `ScrollView`,
  nested inside the non-scrolling compact main → both collapsed to ~190pt. On compact the whole page is one
  `ScrollView` and panels size to content (`flex={0}`, no inner ScrollView). iPad/desktop keeps the
  fixed-height two-column layout with internal panel scroll.

---

## 5c. Mobile-friendliness pass (applied 2026-06-29 — Studio/Admin phone reflow)

Review caught that the shared chrome and desktop-shaped page bodies still read as a squeezed iPad app on
phone. Principle locked in: **shared shell, surface-specific actions.** Identity (context chip) + account
(avatar) are universal; the create-action, notifications, and bottom tabs follow the surface.

- **Studio/Admin chrome drops Practice's action cluster.** `StudioShellCompact` renders
  `<AppChromeRow showPlus={false} showInboxBell={false} />`. The universal `+` opens a personal-practice
  "new step" composer and the bell is a personal capture inbox — both meaningless while authoring. The
  surface's create-action lives in the page header (New blueprint / Publish); the author's "needs you"
  signal is the **Threads** tab's coral badge. Bottom tabs are already surface-specific (Studio =
  Home/Blueprints/Subscribers/Threads/Payouts; Admin = Overview/Cohorts/Members/Blueprints/…) — keep them
  that way; do not re-add a global `+`/bell to writing-class surfaces.
- **`StudioHeader compact` prop.** On phone it drops the breadcrumb (the chip + active tab already say
  where you are), shrinks the serif title (28→22), and stacks the actions below the title block (left-
  aligned) so Preview/Publish don't fight the title for width. The header sits fixed above the body's own
  `ScrollView`, so Publish stays reachable without a sticky bar.
- **`StatRow compactScroll` prop.** Studio Home's 4-up KPI grid (mostly `—` pre-launch) ate the fold as a
  2×2; on phone it's now a single horizontal-scroll strip of 150pt chips, reclaiming vertical space so the
  blueprint list sits in the fold.
- **`StudioTabs scrollable` prop.** The blueprint editor's 7 section tabs (Overview…Activity) overflowed
  and hard-clipped at "Pricing &". On phone the bar is a horizontal `ScrollView` (bottom rule rides the
  scroll view, full-width); all sections scroll into reach. Verified in the iOS sim 2026-06-29.

---

## 5d. "Switch workspace" sheet redesign (applied 2026-06-29 — interest-as-destination)

The shipped sheet conflated three axes and treated interests inconsistently: the Personal *header* and a
standalone "Practice" `SheetRow` both navigated to Practice (redundant), and tapping an interest only
re-ticked a checkmark via `switchInterestOnly` without ever routing — so tapping Golf in Studio stranded you
in Studio. Mock: `public/context-switcher-redesign.html`. Principle locked in: **every row in the sheet is a
destination; an interest IS the Practice destination.**

- **`switchInterestOnly` → `switchToInterestPractice`.** Now clears org context (`setActiveOrganizationId(null)`),
  switches the interest, then `router.replace('/(tabs)/practice')` — identical contract to
  `switchToPersonalPractice`. Tapping an interest navigates, just like tapping Studio/Admin.
- **Dropped the redundant "Practice" `SheetRow`.** The interest list *is* Practice. A `practiceLabel`
  ("Practice — pick an interest") sits above the interests instead. The Personal workspace *header* still
  navigates to Practice-in-current-interest (preserves "click Personal → go to Personal").
- **Checkmark is Practice-scoped.** An interest is ticked only when `!activeOrgId && surface === 'practice'`.
  In Studio/Admin no interest is checked — interest is meaningless on those surfaces. Verified in the iOS sim:
  opened the sheet from Studio (no interest ticked, Studio row checked), tapped Golf → landed in Practice·Golf
  with the chip flipped to "Golf".
- **Stripped the chrome down to the hierarchy.** Review of the first cut found too many competing labels
  (`PERSONAL` section label + a "Personal" card header + "Your practice across interests" subtitle + a
  "Practice — pick an interest" label + HEALTHCARE/SPORTS/OTHER domain groups). All removed. A workspace is
  now just its **section label** (`PERSONAL`, `ORGANIZATIONS`) heading a card of its surfaces — interests +
  Studio are sibling rows in the Personal card, separated by a hairline. No per-interest chevrons (the active
  surface's check is the only trailing mark). No avatar/subtitle/grouping. The interest list is flat
  (`userInterests.map`), so `groupByDomain`/`groupedInterests`/`useAuth`/`displayName` are all gone.
- **"Add interest" and "Join another organization" are peers.** Both are modest left-aligned blue text links
  with a `+` glyph (same weight) — Add interest under `PERSONAL`, Join under `ORGANIZATIONS` (the label shows
  even with zero orgs so the two actions sit at matching hierarchy). The old filled `EFF6FF` Join button was
  dropped — it over-weighted "join an org" against "add an interest".

---

## 6. Cross-cutting gotchas (will fail review if missed)
- **Web compat:** never `Alert.alert()` — use `showAlert` / `showConfirm` from
  `@/lib/utils/crossPlatformAlert`.
- **css-interop:** no function-form `style` on `Pressable` (renders unstyled). Direct style only.
- **Query cache:** if you add any new query hook, register its key in the relevant mutation
  `invalidateQueries` lists (see `feedback_query_cache_key_invalidation_audit`).
- **Realtime:** the org membership realtime sub in `OrganizationProvider` already updates `memberships`;
  the sheet must read from that live list so role/membership changes reflect without reload.
- **Web vs native:** the chip must work both inside `NavigationHeader` (native + non-sidebar web) and not
  break the `WebSidebarNav` desktop shell. If desktop sidebar already exposes surfaces, the chip can defer
  to it on ≥1024; verify both.
- **Git hygiene:** stage by explicit path; never `git add .`/`-u` (`.pen` files are user WIP).

---

## 7. Verify in the interface BEFORE sign-off

Run the app (`npm start`, web at `http://localhost:8081`). Test at a **mobile viewport (~390px wide)** first,
then desktop ≥1024. Use an account that has (a) ≥1 personal authored blueprint, (b) an org where the role is
**admin**, and (c) a group membership. **First confirm the signed-in account actually has this state**
(read the profile menu / `memberships`); if it doesn't, note which leg is missing and seed via existing demo
seeds rather than inventing data — do not claim a path works that you couldn't reach.

Set `EXPO_PUBLIC_FF_CONTEXT_SWITCHER_V1=true` for the run.

**Checklist (each must pass):**
1. Header shows: context chip (left) · Inbox bell with badge · avatar. **No** Do·Create toggle row anywhere.
2. **Practice:** chip shows interest name + its accent dot. Tap chip → sheet opens with `Personal` group,
   Practice active, interests nested beneath it.
3. Change interest in the sheet → chip label updates, Practice timeline switches interest, sheet closes.
4. **Personal → Studio** (if author) → routes to mobile Studio; chip reads "Studio" (purple); bottom tabs
   Home/Blueprints/Subscribers/Threads/Payouts.
5. **Org header** shows role badge. **Org → Admin** → `/admin/[orgId]`; chip reads "[ORG] Admin" (slate);
   admin bottom tabs; Blueprints tab loads real org blueprints.
6. **Org → Studio** → org-scoped blueprints (different set from Personal·Studio). Confirm provenance: personal
   blueprints are NOT shown under the org and vice-versa.
7. **Avatar menu** contains ONLY: identity, "View & edit profile", Account & settings, Help & feedback,
   Sign out. Confirm Studio / Cohorts / Subscriber threads / My Practice / Inbox / workspace rows are GONE.
8. **Inbox bell** badge equals the prior menu count; tap → inbox opens.
9. **Progressive disclosure:** with a bare practitioner account (no blueprints/orgs) the sheet shows only
   `Personal · Practice` (+ interests). No Studio/Admin/org blocks.
10. **Web desktop ≥1024:** chip + sheet behave; `WebSidebarNav` shell not broken.
11. **No console errors**; specifically no react-native-web nested-button warnings introduced by the chip,
    and the chip renders **styled** (css-interop check).
12. **Flag off** (`=false`): old InterestSwitcher + full ProfileDropdown render exactly as before (no regression).
13. `npm run typecheck` → clean. `npm run lint` → clean (lint-staged runs `--max-warnings 0`).

Only after 1–13 pass, flip the default flag to `true` (or leave env-gated per the user's call) and report:
what you changed (file list), what you verified (with screenshots of mobile Practice / sheet / Studio /
Admin / slimmed menu), and anything you stubbed or couldn't reach.

---

## 8. Out of scope for this PR
- Real Subscribers/Threads/Insights data on mobile Studio (Phase B).
- Admin Cohorts/Members/Settings beyond Blueprints (Phase B).
- Public-face Preview⇄Edit merge (Phase C).
- Any DB schema/migration work — this is UI assembly over existing providers.
