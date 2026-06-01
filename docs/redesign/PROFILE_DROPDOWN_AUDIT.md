# Profile Dropdown Audit — iOS Register Compliance & UX

**Date:** 2026-06-01
**Surface:** `components/ui/ProfileDropdown.tsx` (avatar → account/org-switcher menu) and every screen reachable from it.
**Method:** Walked the live dropdown in the iOS Simulator (iPhone 17 Pro, `com.betterat.app`) and deep-linked every destination. Cross-checked against the canonical iOS register in `lib/design-tokens-ios.ts` (`IOS_COLORS`, `IOS_REGISTER`, `IOS_TYPOGRAPHY`, `IOS_SPACING`, `IOS_RADIUS`, `IOS_SHADOWS`, `IOS_TOUCH`).
**Test account:** `appleidlogin` (zszxmzxdc6@privaterelay.appleid.com) — Faculty@Johns Hopkins, Admin@Royal Hong Kong Yacht Club, plus Personal. This account exercises the **admin** and **faculty/author** dropdown variants simultaneously, so all role-gated rows were visible.

> **Register baseline (what "compliant" means here):**
> iOS blue `#007AFF` = user actions / active state · coral `#FF6B6B` = AI prompts / marked content ONLY · gray6 `#F2F2F7` base ground · white `#FFFFFF` cards · text primary `#000` · text secondary `rgba(60,60,67,0.6)`. Cards: 16pt radius / 20pt padding / 16pt gap / soft shadow (y4, blur12, 8%). Touch targets ≥ 44pt. Loading = plain-language narration, not spinners. Errors = plain language + next action, no codes. SF Pro Display headings / SF Pro Text body. Italic = voice transcription only.
> **Editorial holdovers to flag:** navy `#28406B`, lavender/indigo `#6B5BBF`, warm cream `#EFEAD8`, off-token coral `#C84747`, Source Serif / Iowan, non-transcription italic.

---

## The dropdown itself

**Screenshot:** `/tmp/dd_open.png`
**Intended function:** Identity header + org/context switcher + role-scoped navigation + sign-out.

**Structure observed (admin+faculty variant):**
- **Header** — blue avatar "A", `appleidlogin`, email, pencil edit affordance (→ `/settings/edit-profile`).
- **SIGNED IN AT** — three context cards:
  - Johns Hopkins School… · "Faculty · author · mentor" · **lavender "Faculty" pill**
  - Royal Hong Kong Y… · "Administrator" · **navy "Admin" pill** + blue checkmark (active)
  - Personal · "For your own practice" · gray "You" pill
- **+ Join another organization** (blue link → `/(tabs)/library?zone=orgs`)
- Role rows: **Royal Hong admin** › · **People** › (count 3) · **Billing & seats** › · **SSO & security** ›
- **Profile & settings** › (→ `/account`)
- **Help & feedback** › (→ `/help`)
- **Sign out of Royal Hong** (red)

**What works:** Org switcher renders all memberships with active checkmark; role-appropriate rows show; identity header is clear; the menu is rendered in a Modal to escape the stacking context (correct).

**What's broken / flagged:**
1. **Sign-out has no confirmation.** `handleSignOut` (line ~370) calls `signOut()` directly — unlike `AccountModalContent` which wraps it in `showConfirm`. One mis-tap signs the user out (this actually happened during testing). Destructive, irreversible-feeling action with zero guard.
2. **"Sign out of Royal Hong" is a truncation bug, not a label.** `signOutLabel` (line 371) does `org_name.split(' ').slice(0, 2).join(' ')` → "Royal Hong Kong Yacht Club" becomes "Royal Hong". Reads as a broken string. Same truncation drives the admin row label (line 672 → "Royal Hong admin").
3. **Sign-out wording implies org-scope but does a full sign-out.** "Sign out of Royal Hong" suggests *leaving that org context* (which would be plausible given the switcher above it), but it actually ends the whole session. Ambiguous and risky.
4. **Register-violating pill colors:**
   - Faculty pill: `rgba(107,91,191,0.14)` bg / `#6B5BBF` text (lines 826, 833) — **lavender holdover**.
   - Admin pill: `rgba(40,64,107,0.12)` bg / `#28406B` text (lines 825, 832) — **navy holdover**.
   - `roleTone` returns `#6B5BBF` (studio, line 773) / `#28406B` (admin, line 775) — **off-token**.
   - `orgPip` bg `#28406B` (886) and `roleMono` bg `#28406B` (1032) — **navy holdover**.
   - `countPillTextCoral` `#C84747` (1085) — **off-token coral**; also coral is reserved for AI/marked content, so a *count* pill should not be coral at all.
5. **Touch target under 44pt:** `menuItemRow` `paddingVertical: 11` (line 1070) → ~40pt row height. Below the 44pt minimum.

---

## Reachable surfaces

### 1. Edit Profile — `/settings/edit-profile`
**Screenshot:** `/tmp/s_editprofile.png` · **Function:** edit name/photo/bio.
**Compliant.** gray6 ground, white card, blue Save pill, blue avatar, SF Pro, functional back arrow. Model surface. No issues.

### 2. Profile & settings (Account modal) — `/account`
**Screenshot:** `/tmp/s_account.png` · **Function:** account hub (boats, subscription, units, notifications, telegram, privacy).
**Compliant.** gray6 ground, white IOSListSection cards, blue "Done", green "active" pills, red notification icon, SF Pro. Sign-out here *does* use `showConfirm` (the correct pattern the dropdown is missing). No issues.

### 3. Royal Hong admin — `/admin/[orgId]`
**Screenshot:** `/tmp/s_admin2.png` · **Function:** org admin dashboard.
**Broken on phone + register violation.** Renders a **cream `#EFEAD8` phone-gate**: "Org admin is a writing-class surface — Managing seats, roles, and SSO is not a phone-screen job. Open on iPad or desktop." The dropdown surfaces this row on a phone, then dead-ends it. The gate background is a warm-cream editorial holdover. `AdminShell.tsx` root is cream (`#EFEAD8`, line 278) with navy `#28406B` (283/300/304) and `accent='navy'` default.

### 4. People — `/admin/[orgId]/people`
**Screenshot:** `/tmp/s_admin_people.png` · **Function:** member roster.
**Broken on phone + register violation.** Same **cream phone-gate** as admin dashboard. `people/index.tsx` carries cream (`#EFEAD8`, 494), navy (`#28406B`, 386/508), lavender (383/384), and non-transcription italic (643/661).

### 5. Billing & seats — `/admin/[orgId]/billing`
**Screenshot:** `/tmp/s_admin_billing.png` · **Function:** seats/invoicing.
**Inconsistent + register violation.** Unlike admin/People, this one **renders the full AdminShell on the phone** (navy sidebar nav, "Billing & seats" selected in navy, cream content area) — i.e. the phone-gate is applied inconsistently across admin sub-routes. Whichever is intended, the navy-sidebar + cream-content shell is a wholesale editorial-register surface. `AdminBillingSurface.tsx` is saturated with `#28406B`.

### 6. SSO & security — `/admin/[orgId]/security`
**Screenshot:** `/tmp/s_admin_security.png` · **Function:** SSO/SAML config.
**DEAD LINK.** Navigates to "Unmatched Route — Page could not be found." No `app/admin/[orgId]/security.tsx` exists; the real file is `sso.tsx`. The dropdown points at `/security` (line 696) but should point at `/sso` (AdminShell's own nav already uses `/sso`).

### 7. Creator Studio — `/studio` (also `/studio?empty=true`)
**Screenshot:** `/tmp/s_studio.png` · **Function:** author hub.
**Broken on phone + register violation.** Renders a **cream phone-gate**: "Creator Studio is a writing surface — Authoring blueprints, mentoring cohorts, and managing pricing are not phone-screen jobs. Open Creator Studio on iPad or desktop." `studio/index.tsx` cream (541/778), navy (553), italic (661); `StudioShell.tsx` purple `#6B5BBF` + navy `#28406B` (74/75/80/590/591/595/596).

### 8. Cohorts — `/mentor/cohorts`
**Screenshots:** `/tmp/s_cohorts.png`, `/tmp/s_cohorts2.png` · **Function:** mentor cohort list.
**Renders on phone (gray6) but two issues:** (a) showed an **indefinite raw spinner** for the whole test window — likely the known transient-null-auth artifact (`feedback_settings_screen_infinite_spinner`), but regardless the **bare spinner violates the register's plain-language-loading principle**; (b) no visible back affordance while loading (large-title screen, no header back) — a potential trap. `mentor/cohorts.tsx` itself uses `IOS_REGISTER` tokens correctly when it does render.

### 9. Subscriber threads — `/studio/threads`
**No screenshot (route doesn't exist).** **DEAD LINK.** No `app/studio/threads.tsx`. "threads" is an in-Studio tab *key* (studio/index, earnings, payouts), not a standalone route. Dropdown points at `/studio/threads` (line 727) → no match.

### 10. Help & feedback — `/help`
**Screenshot:** `/tmp/s_help.png` · **Function:** support.
**DEAD LINK + confusing fallback + register violation.** No `app/help` route. `/help` falls into a root dynamic `[interest]`-style catch-all → "**Interest not found** — 'help' doesn't match any interest." with a **purple/indigo "Go back" button** (editorial holdover, not iOS blue). So Help & feedback isn't even a clean 404 — it lands the user on a nonsensical "interest" error. The only working help affordance is the `info@better.at` alert inside `AccountModalContent`.

### 11. Join another organization — `/(tabs)/library?zone=orgs`
Routes to the Library tab orgs zone (exists). Not deep-captured; route resolves. No issue flagged.

### 12. Other account-modal links (one hop past the dropdown)
`/account/connected-services` (exists), `/library`, `/subscription`, `/settings/units|notifications|telegram|privacy` — covered under the Account modal, which is register-compliant. Note: `notifications.tsx` + `telegram.tsx` back-button trap was fixed separately (commit db9cdf3c) earlier this session.

---

## Severity-ranked summary

| # | Surface / element | Issue | Severity |
|---|---|---|---|
| 1 | Dropdown → SSO & security | `/admin/[orgId]/security` is a **dead link** (Unmatched Route); should be `/sso` | **Broken function** |
| 2 | Dropdown → Subscriber threads | `/studio/threads` is a **dead link** (no route file) | **Broken function** |
| 3 | Dropdown → Help & feedback | `/help` dead-ends on **"Interest not found"** with a purple button | **Broken function** |
| 4 | Dropdown sign-out | **No confirmation** before full sign-out (mis-tap = logged out) | **Broken function (data-loss-feel)** |
| 5 | Royal Hong admin / People / Creator Studio | Phone rows **dead-end on a cream "open on desktop" gate** | **Broken function (phone)** |
| 6 | Billing & seats | Phone-gate applied **inconsistently** vs sibling admin routes | **Broken function (consistency)** |
| 7 | Cohorts | **Indefinite raw spinner** + no back affordance while loading | Broken function / register |
| 8 | Dropdown sign-out / admin labels | `org_name.split.slice(0,2)` **truncates** "Royal Hong Kong Yacht Club" → "Royal Hong" | Layout / UX |
| 9 | Dropdown sign-out wording | "Sign out of {org}" implies org-scope but ends the whole session | UX (ambiguous) |
| 10 | Dropdown pills + pips | navy `#28406B`, lavender `#6B5BBF`, coral `#C84747` | Register violation |
| 11 | Admin/Studio shells | cream `#EFEAD8` + navy/purple chrome throughout | Register violation (systemic) |
| 12 | Dropdown `menuItemRow` | ~40pt rows (`paddingVertical: 11`) below 44pt | Layout / touch target |
| 13 | People / Studio surfaces | non-transcription `fontStyle: 'italic'` | Polish (register) |

---

## Prioritized recommendations

**Fix-now (broken functions, all in `ProfileDropdown.tsx`):**
1. Repoint SSO & security: `/admin/${orgId}/security` → `/admin/${orgId}/sso` (line 696).
2. Repoint or remove Subscriber threads: `/studio/threads` has no route — either add the route or point at the in-Studio threads tab (and gate it the same as Studio on phone).
3. Repoint Help & feedback: `/help` has no route — point at the working `info@better.at` support affordance (reuse `AccountModalContent`'s handler) or build `app/help`.
4. Wrap sign-out in `showConfirm` (match `AccountModalContent`).
5. Fix the sign-out/admin label truncation — show the full org name (or a deliberate short name field), not `slice(0,2)`. Reconsider wording so "Sign out" doesn't read as org-scoped.

**Register cleanup (dropdown):**
6. Replace pill/pip colors with tokens: Faculty/Admin/Studio role tones → `IOS_COLORS.systemBlue` (active) / `systemGray` families; drop `#28406B`, `#6B5BBF`, `#C84747`. The count pill should not be coral (coral = AI/marked content only) — use secondary gray.
7. Bump `menuItemRow` to ≥ 44pt.

**Register cleanup (admin/studio shells — systemic, larger effort):**
8. The cream/navy/purple admin & studio shells are wholesale editorial surfaces. Either (a) keep the deliberate "desktop-class" gate but reskin the gate screen to register tokens (gray6 ground, system fonts, blue button) instead of cream, and (b) decide the gate consistently (Billing currently slips through). `mentor/cohorts.tsx` and `/account` are the model for token usage.
9. Replace the raw spinner in Cohorts with plain-language narration; ensure a back affordance is always present.

**See also:** editorial-holdover list below for the full color/font inventory feeding these surfaces.

---

## Editorial-register holdovers (separate inventory)

These are the specific off-register tokens found in the dropdown and its destinations. They are the editorial register (navy/cream/lavender/Iowan) bleeding into surfaces that should use the canonical iOS register.

**`ProfileDropdown.tsx`**
- `#6B5BBF` (lavender/indigo) — `roleTone` studio (773), faculty pill text (833)
- `rgba(107,91,191,0.14)` — faculty pill bg (826)
- `#28406B` (navy) — `roleTone` admin (775), admin pill text (832), `orgPip` bg (886), `roleMono` bg (1032)
- `rgba(40,64,107,0.12)` — admin pill bg (825)
- `#C84747` (off-token coral) — `countPillTextCoral` (1085)

**`AdminShell.tsx`** — cream `#EFEAD8` root (278); navy `#28406B` (283, 300, 304); `accent='navy'` default.
**`app/admin/[orgId]/people/index.tsx`** — cream `#EFEAD8` (494); navy `#28406B` (386, 508); lavender (383, 384); non-transcription italic (643, 661).
**`app/admin/[orgId]/sso.tsx`** — `accent="navy"` (26).
**`AdminSecuritySurface.tsx` / `AdminBillingSurface.tsx`** — saturated with `#28406B`.
**`app/studio/index.tsx`** — cream (541, 778); navy `#28406B` (553); italic (661).
**`StudioShell.tsx`** — purple `#6B5BBF` + navy `#28406B` (74, 75, 80, 590, 591, 595, 596).
**`/help` fallback ("Interest not found")** — purple/indigo "Go back" button (not iOS blue).

**Not found (already cleaned):** no Source Serif / Iowan serif fonts in any reachable `.tsx` — code already dropped serif (the editorial register HTML mockups still specify it, but components don't apply it).

**Compliant references (use as models):** `app/settings/edit-profile.tsx`, `components/account/AccountModalContent.tsx`, `app/mentor/cohorts.tsx` — all use gray6 ground + white cards + `IOS_COLORS.systemBlue` + SF Pro.
