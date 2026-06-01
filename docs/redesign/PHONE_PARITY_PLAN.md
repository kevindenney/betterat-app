# Admin / Studio Phone Parity Plan

**Date:** 2026-06-01
**Goal:** Make every org-admin and Creator-Studio surface fully usable on iPhone and Android. Remove all desktop/iPad gating entirely — no replacement gate. The earlier decision ("these are writing-class surfaces, open on desktop") is **reversed**: these ARE phone surfaces now.
**Status:** Plan for review. No surface code until approved. Build behind a feature flag.

> **Token path correction.** The brief referenced `src/design-system/tokens.ts` — that file does not exist. The canonical register lives in **`lib/design-tokens-ios.ts`** (`IOS_REGISTER`, `IOS_COLORS`, `IOS_TYPOGRAPHY`, `IOS_REGISTER_TEXT`, `IOS_SPACING`, `IOS_RADIUS`, `IOS_SHADOWS`, `IOS_TOUCH`). Compliant phone models confirmed: `app/settings/edit-profile.tsx`, `components/account/AccountModalContent.tsx`, `app/mentor/cohorts.tsx`.

---

## The root cause (one diagnosis explains every broken screen)

Almost every admin/studio surface renders inside **`components/studio/StudioShell.tsx`**, whose layout is:

```
shell:   { flex: 1, flexDirection: 'row' }   // sidebar | main, side by side
sidebar: { width: 248 }                       // FIXED width
main:    { flex: 1, paddingHorizontal: 32 }   // gets whatever's left
```

On a 402pt iPhone the 248pt sidebar consumes ~62% of the width and the main pane is squeezed to ~120pt and clipped — exactly the Billing screenshot (sidebar fully drawn, "Billing & invoices" shoved off the right edge, header overlapping). `AdminShell` wraps `StudioShell` and adds a cream root + navy seats card; **18 admin routes** go through `AdminShell`, and **2** (`people/index`, `sites/index`) hand-roll `StudioShell` inline. All Creator-Studio routes use it directly.

**So the single highest-leverage fix is making `StudioShell` responsive.** Collapse the sidebar on phone and the main pane gets full width — that alone unblocks ~12 of the simpler surfaces. The remaining work is per-page: stacking multi-column page *bodies* and reflowing dense tables.

The desktop **gates** were a band-aid over this same problem. We remove them and fix the layout underneath.

---

## (a) Gate removal — exact surface

There are **two** gate mechanisms plus a feature flag. All come out.

### Component + flag to delete
- **`components/ui/DesktopOnlyGate.tsx`** — delete the whole file. Importers (the *only* three): `app/studio/index.tsx`, `app/admin/[orgId]/people/index.tsx`, `app/mentor/cohorts.tsx`. Confirmed via repo-wide grep — nothing else references it.
- **`lib/featureFlags.ts`** — remove `DESKTOP_GATE_ON_REGISTER` (line ~687) and its doc comment. (We introduce a new parity flag — see "Feature flag" below.)
- `DESKTOP_GATE_MIN_WIDTH` constant — removed with the component.

### Per-file gate removals
| File | What to remove |
|---|---|
| `app/studio/index.tsx` | Outer-wrapper gate (L53/L56-62) + `DesktopOnlyGate` import (L50). Collapse `StudioHomePage` outer/inner split back to one component (no longer needed). |
| `app/admin/[orgId]/people/index.tsx` | Outer-wrapper gate (L55-56) + import (L46). Collapse `AdminPeoplePage`/`AdminPeopleInner` split. |
| `app/mentor/cohorts.tsx` | Outer-wrapper gate (L42-44) + import (L26). Collapse `MentorCohortsIndex`/`Inner` split. |
| `app/studio/earnings.tsx` | Inline `if (width < 920)` gate (L59-66) + the local gate `View`. Bare width check, not even flagged. |
| `app/studio/payouts.tsx` | Inline `if (width < 920)` gate (L50-52) + local `NarrowScreenGate` fn (L569-581) + its `gate*` styles. |
| `app/studio/blueprints/[id].tsx` | Inline `if (width < 920)` gate (L102-104) + local `NarrowScreenGate` fn (L765-776) + its `gate*` styles. |
| `app/admin/[orgId]/sites/index.tsx` | Inline `if (width < 920)` gate (L69-70) + local `NarrowScreenGate` fn (L365…) + its `gate*` styles. |
| `app/studio/_layout.tsx` | No gate, but the L4-6 comment ("phone gate handled in index.tsx") is stale — update/remove it. |

`app/mentor/cohort/[cohortId].tsx` has **no** gate already (clean).

### Post-removal: verify the profile-dropdown links resolve to real surfaces
After the gates come out, confirm the profile dropdown's **People**, **Creator Studio**, and **Cohorts** entries route to the live surfaces and aren't still pointing at gate-era routes/redirects. Check the dropdown source (`components/account/AccountModalContent.tsx` + whatever builds its rows) against the real targets — `app/admin/[orgId]/people/index.tsx`, `app/studio/index.tsx`, `app/mentor/cohorts.tsx` — and tap each from the dropdown on phone width to confirm it lands on the reflowed surface, not a stale path. Per `PROFILE_DROPDOWN_AUDIT.md`.

> Removing a gate exposes the underlying loader (`if (!user || menu.loading) return <StudioLoading/>`) to phone widths. `StudioLoading` is a bare spinner — addressed in (d).

---

## (b) Per-surface responsive approach

### The shared primitive: responsive `StudioShell` (build first)

Add a width breakpoint inside `StudioShell` (and mirror in the two inline-shell pages, or better — migrate `people/index` + `sites/index` onto `AdminShell` so there's one shell to fix). Breakpoint (per review):

- **`compact` (< 600pt)** — phone-only. Sidebar leaves the row. Replace it with a **top app bar**: org mono + name on the left, a hamburger/“menu” button on the right that opens the existing nav (`navSections` + context switcher + user card) in a slide-over **Modal drawer**. `main` becomes full-width single column. Active section title shows in the bar so the user has orientation without the persistent rail. `main`'s `paddingHorizontal: 32` drops to ~16 on compact.
- **`regular` (≥ 600pt)** — current 248px sidebar + main, unchanged. **This deliberately keeps iPad portrait (744–834pt) on the two-pane layout** — the density principle wants the rail where there's room for it (≥496pt of main beside the 248px sidebar).

**Why 600 and not 920:** a 920 threshold forces every iPad in *portrait* (mini 744 / 9.7" 768 / 11" 834) into compact, discarding two-pane density they have room for. The device gap is clean — largest phone portrait is 440pt, smallest iPad portrait is 744pt — so 600 cleanly splits phone (compact) from iPad+ (two-pane). **Tradeoff:** a bare width rule is device-class-blind, so a phone in *landscape* (~844–956pt) renders two-pane; that's acceptable since the sidebar+main both fit at that width, and it avoids brittle `Platform`/model detection.

This keeps admin/studio **denser** than practitioner surfaces (tighter type scale, the StudioHeader/StudioTabs system, multi-section nav) while being phone-usable — density principle preserved, desktop-only layout dropped.

**The drawer follows the iOS register — not a one-off.** The slide-over is net-new UI, so it uses `lib/design-tokens-ios.ts` throughout: `IOS_REGISTER.groundBg` (#F2F2F7 gray6) for the scrim/backdrop, a `IOS_REGISTER.cardBg` (#FFF) drawer panel with `IOS_RADIUS` corners + `IOS_SHADOWS.card`, SF Pro via `IOS_TYPOGRAPHY`, `IOS_REGISTER.accentUserAction` (#007AFF) for the active nav row, `IOS_REGISTER.label`/`labelSecondary` for text, and ≥`IOS_TOUCH.minHeight` (44pt) rows. No editorial-register colors in the drawer chrome itself (the cream/navy AdminShell root is a separate cutover — see Out of scope).

### Page-body reflow, by family (from the inventory)

**Family 1 — single-column list + search (+ StudioTabs). Phone-ready once shell is fixed; near-zero body work:**
`mentor/cohorts`, `mentor/cohort/[cohortId]`, `admin/.../programs/index`, `programs/[programId]`, `cohorts/index`, `cohorts/[cohortId]`, `sites/index`. Approach: nothing structural — verify search/tab rows wrap, lists already stack.

**Family 2 — "N-up stat/card row" that must stack or wrap below the breakpoint:**
`admin/.../overview` (4-up stats + 2-up spotlights), `blueprints` (4-up strip), `person/[userId]` (3-up summary), `studio/index` (4-card KPI strip), and the stat strips inside `AdminPayoutsSurface` / `sites/[poiId]`. Approach: one small `<StatRow>`/responsive-grid helper that switches `flexDirection: row → column` (or `flexWrap` with `minWidth`/`flexBasis: '100%'`) under the phone breakpoint. Fixes all of them with one primitive.

**Family 3 — row-of-panels splits (`flexDirection:'row'` + `flex` siblings) that must stack to one column:**
`AdminBillingSurface` (`planCard` 1.4/1, `twoColRow` 1.4/1), `AdminSecuritySurface` (`twoCol` 1/1), `sites/[poiId]` (hero+map, two-col cards), `studio/payouts` (`twoCol` + 360px panel), `studio/index` (`twoCol` flex + 360px threads panel), `audit` (feed + 380px detail — see Family 4 note). Approach: same stacking primitive as Family 2 applied to the panel rows; `StudioPanel width={360}` becomes full-width on phone. `payouts` SVG chart already uses a `viewBox` + `width="100%"`, so it scales; just needs its hero/stat row stacked.

**Family 4 — dense fixed-width data tables that need a table→stacked-card rethink (the expensive bucket):**
`people/index` (7-col roster), `people/bulk-csv` (column-mapping preview), `AdminPayoutsSurface` (author table), `AdminBillingSurface` (invoice table), `insights` (competency×site heatmap matrix), `studio/earnings` (per-blueprint table), `accreditation` (print-doc heatmap). Approach: a reusable "table on desktop / stacked label-value cards on phone" pattern — each row becomes a card with field labels inline. The heatmap matrices (`insights`, `accreditation`) keep horizontal scroll but need phone-sized headers/controls. These should NOT block the rest — see (e).

### Out of scope for this effort (flag separately)
The editorial-register colors (cream `#EFEAD8` AdminShell root, navy `#28406B`, purple `#6B5BBF`) flagged in `PROFILE_DROPDOWN_AUDIT.md` are a **separate register cutover**, not a layout/usability problem. This plan touches `StudioShell`/`AdminShell` structurally, so it's a natural co-location *if* desired, but I'd keep the color cutover out to avoid scope creep — call it explicitly at review time.

---

## (c) Build order (simplest first, to prove the pattern)

1. **Responsive `StudioShell`** (compact sidebar → top bar + drawer; full-width main). Build the breakpoint hook here. **Prove it on a Family-1 page** (`admin/.../cohorts/index` or `programs/index`) — these need no body changes, so a correct shell = a correct screen. This is the go/no-go checkpoint for the whole approach — **STOP here for review before step 2** (per the build directive: shell first, prove one Family-1 page, then pause before consolidating the inline shells).
2. **Consolidate the two inline shells** — migrate `people/index` + `sites/index` to `AdminShell`, removing their duplicated sidebar + local gates. (`sites/index` body is already Family 1, so it lands here cheaply.)
3. **Family 1** — verify the remaining list surfaces; mostly free.
4. **Family 2** — build the `<StatRow>`/responsive-grid helper; apply to overview, blueprints, person, studio/index KPI.
5. **Family 3** — apply the stacking primitive to the panel-split bodies (billing, security, payouts, studio/index two-col, sites/[poiId]).
6. **Family 4** — build the table→stacked-card pattern; apply to the dense tables. (Candidate to split into its own PR.)

Surfaces that share a layout get fixed in one pass per family.

---

## (d) Cohorts infinite spinner — specific fix

Two distinct "cohorts" surfaces exist; the dropdown one (the spinner report) is **`app/mentor/cohorts.tsx`** (iOS-register, single-column list — NOT `StudioShell`). The body already works on phone; the problems are loading + the removed gate.

1. **Remove the desktop gate** (already in (a)) — the screen is a clean iOS-register list that renders fine on phone. This alone fixes the "dead-end" half.
2. **Replace the bare spinner with plain-language narration.** Today: `if (orgLoading || loading) return <ActivityIndicator/>` (L133). Swap to `components/ios-register/LoadingNarration.tsx` (canonical pattern: `microLabel` + `lines: string[]` + `activeIndex`, no spinner — the present-continuous status line IS the progress signal; no "Loading…", no percentages). Drive `activeIndex` across the two real fetch stages: cohorts query → member-count query → render. Same swap applies to `StudioLoading` (also a bare spinner) once it's reused on phone.
3. **Guarantee resolution + a back affordance.** The fetch *does* call `setLoading(false)` on all branches (incl. the no-orgId early return at L65), so the true infinite-spinner risk is the transient-null-`user` / `menu.loading` artifact documented in `feedback_settings_screen_infinite_spinner` + `feedback_ios_sim_reload_vs_relaunch`. Gate on auth **`ready`** (not bare `!user`), and ensure a back control is always visible during the loading state (the audit noted a large-title screen with no header back = a trap). The fetch resolves into the existing single-column list — no new layout needed.

---

## (e) HIGH-complexity surfaces — flag for a separate phase

These should not block phone parity for the ~15 simpler surfaces. Recommend phasing them out of the first PR:

| Surface | Why HIGH | Suggested handling |
|---|---|---|
| `app/studio/blueprints/[id].tsx` | Two independently-scrolling editor columns, deeply nested card rows (cover preview+actions, 2-up about, 3-up pricing), many `TextInput`s (keyboard handling), 7-tab strip, editor-shaped sidebar, **+6 delegated tab bodies in `BlueprintEditorTabBodies.tsx` not yet audited**. | Phase 2 of its own. Needs a real mobile editor design, not reflow. |
| `app/admin/.../insights.tsx` | Fixed-cell competency×site heatmap matrix + dense header actions. | Phase with Family 4; keep horizontal scroll, phone-size the controls. |
| `app/admin/.../accreditation.tsx` | A fixed-width **880px print document** (5-col heatmap, signature block) — reflowing a document, not stacking app cards. | Strong "view/export on desktop" candidate; lowest phone priority. |
| `app/admin/.../audit.tsx` | True side-by-side master/detail (`feed flex:1` + `detail width:380` JSON payload). | Becomes list → tap → detail sheet/screen on phone (a known pattern, but real work). |
| `people/index` + `people/bulk-csv` | Dense fixed-width tables. | Family 4 table→card pattern. |
| `AdminBillingSurface` / `AdminSecuritySurface` / `AdminPayoutsSurface` | Panel splits + wide tables; each powers 2 routes (billing/invoices, sso/domain, payouts). | Family 3 (splits) + Family 4 (their tables). High value since each fixes two routes. |

---

## Feature flag

Introduce **`EXPO_PUBLIC_FF_ADMIN_PHONE_PARITY`** (replacing `DESKTOP_GATE_ON_REGISTER`):
- **On** → responsive shell + stacked bodies active; gates already deleted from code.
- **Off** → falls through to the current desktop layouts (cramped on phone, as today).

Note: because the gate *components* are deleted outright (per the brief), turning the flag off does not restore a gate — it just shows the un-reflowed desktop layout. Keep the flag **on in dev** while building; flip it on globally when Family 1–3 land. Tables/HIGH surfaces can ship behind the same flag incrementally.

---

## Verification (per surface, when built)
Per `feedback_ios_sim_reload_vs_relaunch`: terminate + relaunch (not Cmd-R) to clear RQ cache; force the correct Metro (`com.betterat.app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082`) to avoid the DragonWorlds cross-wire. For each surface: deep-link on phone width → confirm no clipping, no sidebar overlap, working nav drawer, all content reachable by scroll, ≥44pt touch targets, no infinite spinner. Screenshot each. Also sanity-check ≥920pt (desktop) is unchanged.
