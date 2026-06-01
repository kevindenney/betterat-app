# Register Cutover Plan — Admin/Studio surfaces + Profile dropdown

**Status:** PLAN ONLY — no code changed. Step 1 of the directive, with the three
parallel inventories **reconciled** into one consistent plan (not stapled). The
headline is **§0 — the color-role reconciliation table**; review that first,
**especially the ⚠️ cross-agent conflicts and the role-ambiguous decisions in
§0/§3–§4** before any code.
**Scope:** Org Admin (`app/admin/**`, `components/admin/**`), Creator Studio
(`app/studio/**`, `components/studio/**`), and the profile dropdown
(`components/ui/ProfileDropdown.tsx`). This is the deliberate per-surface visual
pass; off-grid normalization (the former "W2") is folded in.

**Canonical references:** `lib/design-tokens-ios.ts` (spacing 16pt edge / 8pt
grid, color, radius, shadow). Compliant models: `/account`,
`app/settings/edit-profile.tsx`, `app/mentor/cohorts.tsx`.
**Do NOT touch:** `lib/design-tokens-editorial.ts` (serif/editorial recipes are a
permanent, deliberately-kept first-person reflection voice — see
`project_serif_register_kept`). No serif→SF-Pro migration anywhere in this pass.

**Explicitly OUT of scope (named so they aren't pulled in):**
- Library `AllZone` and `components/ios-register/timeline-zoom/**` + the parked L1
  `PhaseTabs` check — those are the *Practice/Library* cutover passes, not
  admin/studio. They fold into their own surface passes later.
- Type scale / font sizes (`10.5`/`11`/`11.5`/`12.5`/`13.5`) — a separate future
  item, per the consolidation plan. This pass touches **spacing/color/radius/tap
  targets only**, never `fontSize`.

> Line numbers below are from the inventory pass (3 read-only agents +
> direct read of `StudioShell`/`mentor/cohorts`). They are accurate enough to
> plan from but will be **re-confirmed at execution time** per surface, not
> trusted blind.

---

## Standing principle — data-visualization color is OUT OF SCOPE

**Data-visualization color encodes *data*, not interaction, and is exempt from
the register cutover wholesale.** Heatmap endpoints, coverage gradients/ramps,
chart bars and series, and intensity scales are reading the underlying values —
they are not chrome and not controls, so the "two accents, two jobs" doctrine
(iosBlue = action, iosCoral = AI/marked) does not apply to them. They stay as
authored. This is stated once here so it is **not re-litigated per surface.**

Consequences (so they're not re-argued): `insights.tsx` + `InsightsMapView.tsx`
navy intensity ramp (`rgba(40,64,107,0.08→0.7)`, `#28406B` = full coverage),
`payouts.tsx` earnings-chart browns (`#B8855A`/`#8E5F36`/`#5C3F22`), `audit`
verb tones, `sites` kind-badges, `programs` STATUS_TONE, `bulk-csv` validation
tones, and `BlueprintEditorTabBodies` CAT_TONES are **KEEP** — see §5 for the
enumerated list. (Status/role *badges* that happen to reuse an accent hue are a
separate question — those are chrome encoding a state, handled by §0's role
rows, not by this exemption.)

---

## §0 — COLOR-ROLE RECONCILIATION (the headline deliverable)

Three agents each inventoried a slice (ProfileDropdown / Studio / Admin) **in
isolation**, so each one categorized colors only by what it saw locally. The
failure mode that creates is real and it showed up: **the same hex serves
different roles in different slices, and each agent mapped it by its local role.**
Reconciliation = collapsing that into ONE decision *per (color × role)*, not per
color. The conflicts below are the actual design judgment to make.

**The load-bearing realization: you cannot map a color — you map a color *in a
role*.** `#28406B` and `#B8855A` each do three different jobs; a "navy → iosBlue"
or "brown → keep" codemod would be wrong in two-thirds of cases.

| Hex | Role (the axis that decides) | Where it appears (all 3 slices) | Decision | Cross-agent conflict |
| --- | --- | --- | --- | --- |
| **`#28406B` navy** | **Domain identity** (institutional / Org-Admin surface family) | **SYSTEMATIC, load-bearing (verified ~30 files):** every `app/admin/[orgId]/**` + `components/admin/**` surface, `app/marketplace/**`, `org-invite`, `redeem`, `account/subscriptions`, onboarding previews. Same `{bg:'rgba(40,64,107,0.NN)', fg:'#28406B'}` badge recipe + tint ladder repeated deliberately. **NOT per-org-instance** (JHU/RHKYC all get the same navy) and **not incidental leftover.** | **D1-gated** — A: keep as named `REGISTER_DOMAIN_ACCENT` (institutional); B: → iosBlue | ⚠️ **YES** — Studio/Admin agents saw navy *on buttons* and implied →iosBlue; that's the **action** role, not this one. **And navy is BOTH within admin** (chrome identity *and* primary-button/checkbox fill) — so split-by-role (A) would put navy chrome + iosBlue buttons on the same screen. That's the sharp D1 call. |
| **`#28406B` navy** | **User-action control** (primary CTA bg, checkbox fill, selected method tab, avatar tint) | `ProfileDropdown` `methodBtnOn`; `blueprints/[id]` primary btn; `BlueprintEditorTabBodies` primary btn; `AddPersonSheet` buttons/checkbox/avatar ×10+ | **→ `accentUserAction` (#007AFF)** — regardless of D1 | resolves the conflict above: action-navy → blue *even if* identity-navy is kept |
| **`#28406B` navy** | **Data-viz encoding** (heatmap full-intensity endpoint) | `insights.tsx` coverage ramp (`#28406B` = 1.0) | **KEEP** (§5) | Admin agent correctly isolated this; do not let a "navy→blue" sweep touch it |
| **`#6B5BBF` purple** | **Section identity** (Creator Studio) | `StudioShell.ACCENT_COLORS.purple`; `StudioLoading` spinner; `ProfileDropdown` faculty role badge; `studio/index` & `blueprints/[id]` `accent="purple"` | **D1-gated** — same as navy-identity | ⚠️ **YES** — see "New blueprint" + co-author rows below |
| **`#6B5BBF` purple** | **User-action control** ("New blueprint" button, primary CTAs on purple-accented studio screens) | `studio/index` New-blueprint; `studio/blueprints/[id]` actions | **→ iosBlue** (it's a *create action*, not identity) — **Q2 confirm** | the directive named this one; it's the canonical "is lavender an action or an accent" call |
| **`#6B5BBF` purple** | **People / person-role marker** (Author · Co-author · Faculty) | **RESOLVED → real role.** Same `rgba(107,91,191,0.14)` bg + `#6B5BBF` fg recipe in `admin/[orgId]/people/index.tsx` (ROLE_TONES author/co-author), `PersonDetailDrawer` (author/co-author), `ProfileDropdown` faculty pill, `StudioShell` `pillPurple`, `ManageCompetenciesSheet`, `studio/blueprints/[id]` co-author chip | **KEEP as a people-marker** (own token, e.g. `REGISTER_ROLE_AUTHOR`), distinct from Studio section-identity purple | ~~conflict~~ **resolved:** the co-author chip is NOT section identity — purple consistently tags *authoring person-roles* across 6 surfaces. It's its own role; map as a unit. |
| **`#B8855A` drawing/brown** | **Section identity** (independent / solo author) | `StudioShell.ACCENT_COLORS.drawing`; `payouts`/`earnings` `accent="drawing"` | **D1-gated** — same as navy/purple identity | ⚠️ **YES — the sharpest collision** ↓ |
| **`#B8855A` drawing/brown** | **Data-viz encoding** (lightest earnings-chart bar; series `#B8855A`/`#8E5F36`/`#5C3F22`) | `studio/payouts.tsx` earnings chart | **KEEP** (§5) | ⚠️ **the identical hex `#B8855A` is BOTH the solo-author accent AND a chart bar — in the same file.** A "brown→X" codemod flattens the chart or misses the identity. Must split by role inside `payouts.tsx`. |
| **`#C84747` old-coral** | Vestigial marked-content (count pill text) | `ProfileDropdown` `countPillTextCoral` (~line 1106) | **→ `accentMarkedContent` (#FF6B6B)** | none — single surface, single role, unambiguous |
| **`rgba(201,150,50,…)` amber** | **Status tint** (draft state) | `studio/index` draft-blueprint tints | **needs-eyes** — likely a status encoding (→ keep) rather than chrome; confirm it's not just decorative warmth | only Studio agent saw it; no conflict, but role (status vs decorative) unconfirmed |
| **Cream** `#EFEAD8`/`#F5F4EE`/`#F6EBDD`/`#FAF8F0`/`#EDEBE2` | Chrome ground | `StudioShell`/`AdminShell`/`Admin*Surface`/`StudioLoading`/most studio+admin leaf pages | **→ `groundBg` (#F2F2F7)** (D2) | none — all 3 agents agreed cream = chrome. Lone nuance: payouts/earnings cream + `accent="drawing"` = warm solo voice (see D2) |
| **Legacy `C`** `#F7FAFC`/`#172033`/`#0B63CE`/`#0F766E`/`#B42318` + Tailwind `bg-blue-600`… | Bespoke pre-register status palette | `yacht-club-claims`, `org-verifications`, `admin-users-verification` | **DEFER → own re-skin batch** (D4) | none — different lineage entirely; only the legacy-slice agent saw these. Not the tri-accent. |
| **CAT_TONES** / verb tones / kind-badges / STATUS_TONE / validation tones | Semantic data-viz encodings | `BlueprintEditorTabBodies`, `audit`, `sites`, `programs`, `bulk-csv` | **KEEP** (§5) | consistent across agents; CAT_TONES flagged "likely keep" — Q4 confirms |

**What reconciliation changed vs. the raw agent outputs:**
1. **Navy is not one decision, it's three** (identity / action / data-viz). The
   Studio and Admin agents both implied "navy is the primary accent → iosBlue,"
   which is right *only for the action role*. Identity-navy is D1-gated;
   data-viz-navy is a keep. **One hex, three rows above.**
2. **Brown collides with itself inside `payouts.tsx`** — identity accent and the
   lightest chart bar are the *same* `#B8855A`. This is the one case a careless
   sweep would visibly break; the §8 batch order isolates payouts for eyes-on.
3. **Purple is SETTLED (2026-06-01):** two distinct tokens, **never collapsed.**
   (a) **People/author marker** `REGISTER_ROLE_AUTHOR` `#6B5BBF` — tags Author /
   Co-author / Faculty person-roles across the 6 surfaces in row 75; KEEP. (b)
   **Studio section-identity** purple `#6B5BBF` (shell accent / spinner / `accent="purple"`)
   maps **separately** under D1. Same hex, two roles, two tokens — do not merge
   them into one. The co-author chip is (a), not section identity.
4. **Everything else is consistent across the three agents** — coral, cream,
   legacy `C`, and the data-viz tone families were categorized the same way
   wherever they were seen. No reconciliation conflict there; the work is just
   dedup (done in §2/§5/§7).

**The decisions that gate everything:** D1 (identity hue — §3) and the three ⚠️
purple/brown role splits above. Once those are set, every remaining navy/purple/
brown hit resolves by asking "*which role is this?*" against this table.

---

## §1 — Token mapping (the dictionary every batch uses)

| Off-token (current) | Register token | Notes |
| --- | --- | --- |
| `#28406B` navy | *decision D1* — `IOS_REGISTER.accentUserAction` (#007AFF) **or** kept as section identity | see §3 — depends on identity-vs-action role |
| `#6B5BBF` purple/lavender | *decision D1* — same | Creator Studio identity |
| `#B8855A` drawing/brown | *decision D1* — same | independent/solo-author identity |
| `#C84747` old-coral | `IOS_REGISTER.accentMarkedContent` (#FF6B6B) | **unambiguous fix** — vestigial coral |
| `#EFEAD8`, `#F5F4EE`, `#F6EBDD`, `#FAF8F0`, `#EDEBE2`, `#F7FAFC` cream | `IOS_REGISTER.groundBg` (#F2F2F7) | decision D2 (directive says cream→ground) |
| card bg ad-hoc `rgba(255,255,255,0.6)` / `rgba(0,0,0,0.04)` | `IOS_REGISTER.cardBg` (#FFFFFF) + `separator` hairline | StudioShell regular path |
| label `#1C1C1E` / `rgba(60,60,67,0.6/0.85)` | `IOS_REGISTER.label` / `labelSecondary` (0.62) / `labelTertiary` (0.32) | tighten to register opacities |

**Compliant target (from `mentor/cohorts.tsx`):** `groundBg` surface; `cardBg`
cards with hairline `separator` + `borderRadius: 12`; `label`/`labelSecondary`/
`labelTertiary` text; `accentUserAction` for spinners/active. **Row density in
the compliant model is `paddingHorizontal/Vertical: 14`** — so `14` on rows is
the *intended* register density, not drift (see §6).

---

## §2 — Surface inventory, grouped by change-kind

**Legend:** shell-only = no local styles, inherits from a shared shell/surface
component, so fixing the shell fixes it. ⚠ = data-viz KEEP present (see §5).

### Shell-only (fixed transitively by the shared components)
`app/admin/_layout.tsx`, `app/admin/[orgId]/index.tsx` (redirect),
`.../payouts.tsx`, `.../domain.tsx`, `.../sso.tsx`, `.../billing.tsx`,
`.../invoices.tsx`, `.../cohorts/[cohortId].tsx`, `.../sites/[poiId].tsx`(*),
`.../programs/[programId].tsx`(*), `.../people/index.tsx`(*),
`app/studio/_layout.tsx`, `components/studio/{StatRow,Gradient}.tsx`.
(*) flagged "likely shell-only" by the inventory — confirm at execution.

### Shared shells/surfaces (HIGH leverage — cascade to the shell-only routes)
| File | Change-kind | Key evidence |
| --- | --- | --- |
| `components/studio/StudioShell.tsx` | MIXED | `ACCENT_COLORS` tri-accent (§3); regular path uses ad-hoc rgba (sidebar `rgba(255,255,255,0.6)`, cards `rgba(0,0,0,0.04)`) while compact path already uses `IOS_REGISTER`; panel `borderRadius:14`, btn `radius:9`, gaps `10/6/2` |
| `components/admin/AdminShell.tsx` | CREAM + color | body `#EFEAD8`; navy seats label/bar `#28406B` |
| `components/admin/AdminBillingSurface.tsx` | CREAM + color | body `#F5F4EE`; navy `#28406B` ×6 |
| `components/admin/AdminPayoutsSurface.tsx` | CREAM + color | body `#F5F4EE`; navy ×20+; gap `22` |
| `components/admin/AdminSecuritySurface.tsx` | CREAM + color | body `#F5F4EE`; navy ×15+ |

### Pure-color (single-axis, low risk)
| File | Evidence |
| --- | --- |
| `components/studio/StudioLoading.tsx` | purple spinner `#6B5BBF` + cream root `#EFEAD8` |
| `components/admin/AdminComingNext.tsx` | navy `#28406B` accent/eyebrow |
| `components/admin/CohortEditSheet.tsx` | navy ×10+; gap `18` |
| `components/admin/PersonDetailDrawer.tsx` | navy ×5+; gap `22` |
| `components/admin/ManageCompetenciesSheet.tsx` | navy |
| `components/admin/ActivityTemplateEditor.tsx` | inline `COLORS` object (not register-aware); gap `20`, `minHeight:80` |

### Off-grid only (clear-snap, lowest risk)
| File | Evidence |
| --- | --- |
| `app/admin/[orgId]/cohorts/index.tsx` | searchInput `paddingVertical: 7` |
| `app/admin/[orgId]/sites/index.tsx` ⚠ | searchInput `paddingVertical: 7`; kind-badge colors KEEP |
| `app/admin/[orgId]/programs/index.tsx` ⚠ | searchInput `paddingVertical: 7`; STATUS_TONE KEEP |

### MIXED (eyes-on — color + cream + off-grid + sometimes data-viz)
| File | Evidence |
| --- | --- |
| `components/ui/ProfileDropdown.tsx` | **headline.** old-coral `#C84747`→fix (line ~1106); navy/purple role badges (§3); menu rows `paddingVertical:11` → sub-44 (§7); off-grid gap `10`, pad `6`/`9` |
| `app/studio/index.tsx` | cream `#EFEAD8`; navy `#28406B`; amber draft tints `rgba(201,150,50,…)`; off-grid `14`/`18`; `accent="purple"` |
| `app/studio/payouts.tsx` ⚠ | cream `#EFEAD8`/`#F6EBDD`; navy tints; **earnings chart browns `#B8855A`/`#8E5F36`/`#5C3F22` = data-viz KEEP**; `accent="drawing"`; off-grid `11`/`14` |
| `app/studio/earnings.tsx` | cream `#F5F4EE`; navy `#28406B`; `accent="drawing"`; off-grid `24/40/60`(bodyInner), `14` |
| `app/studio/blueprints/[id].tsx` | navy `#28406B`; purple `#6B5BBF` (co-author); chip `#EFEFF4`; off-grid `9`/`14`; `accent="purple"` |
| `components/studio/BlueprintEditorTabBodies.tsx` | **HIGH complexity** (parked item). CAT_TONES palette (asmt/rsn/proc/comm) ⚠ likely KEEP; navy primary btn; cream `#F5F4EE`; switch grays; off-grid `3/6/7/9/10/14`, `borderRadius:6` |
| `components/admin/AddPersonSheet.tsx` | navy ×10+ (buttons/checkbox/avatar); off-grid `7/14/18/22` |
| `app/admin/[orgId]/overview.tsx` | cream `#F5F4EE`; navy accents; off-grid `14/10/2/3` |
| `app/admin/[orgId]/blueprints.tsx` | cream `#F5F4EE`; navy cohort chip; `accent="navy"`; off-grid `2/3/14` |
| `app/admin/[orgId]/audit.tsx` ⚠ | **HIGH complexity** (parked: master-detail). cream `#F5F4EE`; **verb tones (add/edit/remove/role) = data-viz KEEP**; off-grid `14`, `height:32` |
| `app/admin/[orgId]/insights.tsx` ⚠ | cream `#F5F4EE`; **navy heatmap ramp `#28406B` = 1.0 intensity = data-viz KEEP**; off-grid `2/3` |
| `app/admin/[orgId]/accreditation.tsx` ⚠ | **HIGH complexity** (parked: print-doc body). cream stage `#FAF8F0`, toolbar `#EDEBE2`; navy; off-grid `6/10`, `height:32` |
| `app/admin/[orgId]/person/[userId].tsx` | cream `#F5F4EE`; navy ×4; off-grid `6/4/2/3/1` |
| `app/admin/[orgId]/people/bulk-csv.tsx` ⚠ | cream `#F5F4EE`; navy; **validation tones (ok/err/warn) = data-viz KEEP**; off-grid `10/12/14` |

### Legacy bespoke-palette (NOT the tri-accent — pre-register; biggest color job)
| File | Evidence |
| --- | --- |
| `app/admin/yacht-club-claims.tsx` | bespoke `C` object: `#F7FAFC` ground, `#172033` ink, `#0B63CE` blue, `#0F766E` green, `#B42318` red; off-grid `9/10/5` |
| `app/admin/org-verifications.tsx` | same `C` palette; off-grid `9/10` |
| `app/admin-users-verification.tsx` | Tailwind classes (`bg-blue-600`, `bg-green-100`, …) not register tokens; off-grid Tailwind paddings |

---

## §3 — HEADLINE DECISION (D1): the tri-accent identity system

**Finding (verified in `StudioShell.tsx:86–96`):**
```
ACCENT_COLORS = { purple:'#6B5BBF', navy:'#28406B', drawing:'#B8855A' }
MONO_BG       = { navy:'#28406B', drawing:'#B8855A', solo:'#8E8E93' }
```
Navy / purple / drawing are **not random drift** — they are a structured
"which workspace am I in" identity system: **purple = Creator Studio, navy = Org
Admin, drawing/brown = independent/solo author.** It's threaded through the shell
(active nav item, section pills, mono avatars, the user-card avatar) and mirrored
in `ProfileDropdown` role badges (admin=navy, faculty=purple). The directive's
"navy + lavender → iosBlue" assumed these were one-off drift; the code shows a
deliberate system. **Flagging rather than auto-applying, per your instruction.**

**The tension:** blanket-mapping all three → a single `iosBlue` collapses three
workspace identities into one — the same kind of flattening we explicitly chose
*not* to do with the serif voice.

**Recommended resolution — split by ROLE, not by hue (the register's own
doctrine):** the iOS register says *iosBlue = user actions, iosCoral = AI/marked*.
Section identity is a **different axis**. So:
- **User-action controls** currently tinted with a section accent → **iosBlue**.
  This is "navy+lavender → iosBlue" applied where it's correct: primary CTA
  buttons (`StudioButton variant="primary"`: "Save changes", "Send next batch",
  Stripe-onboard), the **"New blueprint" button** (← the one you named: it's a
  user *action* → iosBlue), checkboxes, selected method tabs, link chips.
- **Section identity surfaces** → **keep** navy/purple/drawing, but promote them
  out of scattered hex into one named token (e.g. `REGISTER_SECTION_ACCENT` in
  `design-tokens-ios.ts`) so the decision lives in one place and can be flipped
  later: sidebar active-nav fill, section pill, mono/role avatars, the
  ProfileDropdown role badges (admin/faculty), section underline in `StudioTabs`.

This gives a clean rule for every navy/purple/drawing hit ("is this an action or
an identity marker?") and resolves the New-blueprint button as a side effect.

**The decision is yours.** Three options:
- **(A) Identity-vs-action split** *(recommended)* — as above.
- **(B) Flatten to iosBlue** — literal directive; loses Studio/Admin/Author
  visual distinction. Simplest, most "register-pure."
- **(C) Keep all section accents as-is, only fix the genuinely off-token bits**
  (coral, cream, off-grid, tap targets) — most conservative, defers the accent
  question.

> Whatever you pick, batch 1 is structured to **not** depend on D1 (see §8), so
> you can decide D1 while batch 1 proves the uncontroversial mapping.

---

## §4 — Other role-ambiguous calls to confirm

- **D2 — Cream chrome.** Directive says cream→`groundBg`. I agree and will apply
  it, with one note: on `studio/payouts` + `studio/earnings` the cream pairs with
  `accent="drawing"` as a coherent *warm solo-author* identity. If D1 keeps the
  drawing accent, the warmth is carried by the accent and cream→ground is safe;
  if D1 flattens, the solo-author identity disappears entirely. **Cream goes
  regardless** — just flagging that the warm voice fully collapses only if D1=B.

  **Consolidated cream surfaces (deduped across all 3 slices → `groundBg`):**
  `StudioShell` (regular path), `AdminShell` (`#EFEAD8`), `AdminBillingSurface`
  / `AdminPayoutsSurface` / `AdminSecuritySurface` (`#F5F4EE`), `StudioLoading`
  (`#EFEAD8`), `studio/index` (`#EFEAD8`), `studio/payouts` (`#EFEAD8`/`#F6EBDD`),
  `studio/earnings` (`#F5F4EE`), `BlueprintEditorTabBodies` (`#F5F4EE`),
  `admin/overview` / `blueprints` / `audit` / `insights` / `person` /
  `bulk-csv` (`#F5F4EE`), `admin/accreditation` (stage `#FAF8F0`, toolbar
  `#EDEBE2`). **Excluded** (different lineage, D4): `#F7FAFC` in
  `yacht-club-claims` / `org-verifications` — that cream belongs to the legacy
  `C` palette, re-skinned separately, not mapped here.
- **D4 — Legacy bespoke-palette views** (`yacht-club-claims`,
  `org-verifications`, `admin-users-verification`). These pre-date the register
  and use their own palette / Tailwind, not the tri-accent. They're a **full
  re-skin**, not a token-repoint — recommend a **separate later batch (or its own
  item)**, not lumped into this pass. Confirm you want them deferred.

---

## §5 — Data-viz KEEPS (do-NOT-touch list)

These read as "off-token color" to a grep but are **semantic data encodings**,
not chrome. Leave them; map to register equivalents only if you explicitly want
to, and only with eyes:
- `insights.tsx` — navy **heatmap intensity ramp** (`#28406B` = full-coverage end).
- `audit.tsx` — **verb tones** (add/edit/remove/role = green/navy/red/amber).
- `sites/index.tsx` & `sites/[poiId].tsx` — **kind-badge** colors (`#B85A66`
  hospital, `#7A6A8E` sim, `#5E7B8E` club/racing).
- `programs/index.tsx` — **STATUS_TONE** (active/planned/…).
- `people/bulk-csv.tsx` — **validation tones** (ok/err/warn).
- `studio/payouts.tsx` — **earnings chart** browns (`#B8855A`/`#8E5F36`/`#5C3F22`).
- `BlueprintEditorTabBodies.tsx` — **CAT_TONES** (assessment/reasoning/procedural/
  communication) — likely a deliberate competency-category encoding; confirm.

---

## §6 — Off-grid: clear snaps vs mid-grid needs-eyes

Grid: `IOS_SPACING {4,8,12,16,20,24,32,40}`, `IOS_RADIUS {4,8,12,16,20,24}`.

**Cross-slice confirmation (directive point 2):** all three inventories were
re-checked — **`6`, `10`, and `14` are in the needs-eyes bucket in every slice;
none of the agents auto-snapped them**, and none are pre-resolved anywhere in
this plan. They stay per-surface before/after screenshot calls, never a codemod.
(`14`-on-rows leans KEEP per the compliant model — see below — but that's still
an eyes-on confirmation per surface, not a blind snap.)

**Clear snaps (safe inline with the surface pass):**
`5→4`, `7→8`, `9→8`, `11→12`, `17→16`, `18→16 or 20`(eyes if borderline),
`22→20 or 24`(eyes), `borderRadius:6→8`(or 4), `borderRadius:9→8`.

**Mid-grid — NEED before/after screenshots, NOT a codemod:**
- **`14`** — pervasive as **row padding** (studio index/blueprint rows, admin
  overview/audit rows, AddPersonSheet, person, bulk-csv). The compliant model
  (`mentor/cohorts`) uses `14` row padding → **likely a KEEP**, not a snap. Treat
  `14`-on-rows as intended density unless a specific row looks wrong; do not
  blanket-snap to 12/16.
- **`10`** — gaps/padding (ProfileDropdown `gap:10`, payouts, editor input
  affixes). No clean snap (8 vs 12) — per-surface density call.
- **`6`** — gaps, `paddingVertical:6`, `borderRadius:6` (editor segmented,
  accreditation pill, ProfileDropdown sign-up). Mid-grid.
- **`2`/`3`** — chip/badge micro-padding (`paddingTop:2,paddingBottom:3`),
  hairline accents — **likely KEEP** (sub-grid micro), don't force to 4.

`borderRadius:999` pills are intentional — keep.

---

## §7 — Tap targets (sub-44pt → 44pt minimum)

**Consolidated, deduped across all 3 slices.** These are the only confirmed
sub-44 tappables the inventory surfaced; treat as a floor-check list, not
exhaustive — every tappable row gets re-measured during its surface's pass.

- **`ProfileDropdown` menu rows** — `paddingVertical: 11` yields ~40–42pt rows
  ("Profile & settings", "Help", etc.). Raise to a 44pt floor
  (`minHeight: IOS_TOUCH.minHeight`) — **the clearest single tap-target fix**.
- `studio/payouts.tsx` blueprint-earnings row — `paddingVertical: 11`, verify
  total ≥44.
- General: any tappable row found <44 during its surface's pass gets the floor;
  re-measure per surface (don't assume from padding alone).

---

## §8 — Proposed batch order (lowest blast radius first)

Each batch = its own commit, typecheck+lint, before/after sim screenshots for any
spacing/color change (observed-over-reasoned). Stage by explicit path.

1. **Batch 1 — ProfileDropdown (the proving surface; D1-independent parts).**
   It's self-contained, the highest-traffic surface you see, and exercises every
   change-kind. Do the **unambiguous** parts to prove the mapping: old-coral
   `#C84747`→`#FF6B6B`; menu-row tap targets→44; clear off-grid snaps
   (`9→8`); flag `gap:10`/`pad:6` as mid-grid for the same screenshot pass. The
   role badges (navy/purple) are touched **only after D1** — if D1=A they're
   re-pointed to the named `REGISTER_SECTION_ACCENT` (no visual change); if D1=B
   they go iosBlue. → report, get the mapping blessed, then continue.
2. **Batch 2 — the shared shells** (`StudioShell` regular path, `AdminShell`,
   `AdminBillingSurface`/`PayoutsSurface`/`SecuritySurface`). Highest leverage:
   cream→ground + apply the D1 rule once at the source → every shell-only route
   inherits it. Big visual delta → screenshots, one commit per shell.
3. **Batch 3 — off-grid-only + pure-color leaves** (cohorts/sites/programs index
   `7→8`; StudioLoading, AdminComingNext, CohortEditSheet, PersonDetailDrawer,
   ManageCompetenciesSheet, ActivityTemplateEditor). Single-axis, low risk.
4. **Batch 4 — studio leaf pages** (index, payouts, earnings, blueprints/[id]) —
   MIXED, drawing persona, charts (data-viz KEEPS). Eyes-on, one commit each.
5. **Batch 5 — admin leaf pages** (overview, blueprints, insights, person,
   bulk-csv) — MIXED + data-viz KEEPS. Eyes-on, one commit each.
6. **Batch 6 — the three HIGH-complexity parked surfaces**, each its own
   careful pass: `BlueprintEditorTabBodies` (editor), `audit.tsx` (master-detail),
   `accreditation.tsx` (print-doc body). Most mid-grid-heavy; sub-batch as needed.
7. **Batch 7 (or separate item) — legacy bespoke-palette views** (D4:
   yacht-club-claims, org-verifications, admin-users-verification). Full re-skin.

---

## Open questions for review (Step 2)
**Read §0 first — the color-role table is the thing to sit with.** These
questions are just its unresolved cells:
1. **D1 (headline):** identity-vs-action split (A, recommended) / flatten to
   iosBlue (B) / keep accents, fix only off-token (C)? This sets the
   "identity" row for navy/purple/brown in §0.
2. **New-blueprint button (purple, action role):** under (A) it's a user action
   → iosBlue. Confirm, or is it a deliberate distinct "create" accent to keep?
3. ~~**Co-author purple:**~~ **SETTLED 2026-06-01** — it's a *people/author marker*
   (`REGISTER_ROLE_AUTHOR`), KEPT, distinct from Studio section-identity purple;
   the two are not collapsed. See §0 note 3.
4. **D4:** defer the legacy bespoke-palette views to their own batch? (recommended)
5. **CAT_TONES** in the blueprint editor — deliberate competency-category
   encoding to KEEP, or normalize?
6. **Amber draft tint** (`studio/index`) — status encoding to keep, or decorative
   warmth to drop?
7. Proceed with **Batch 1 (ProfileDropdown, D1-independent parts) only**, then
   report before Batch 2?
