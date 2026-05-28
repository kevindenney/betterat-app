# Multi-Audience Demo Plan

> Three pitches, two architectural patterns, one platform thesis.
>
> **v2** — Codex review (round 1 + round 2) folded in. Labor split is now explicit per item: **🟦 Codex** (backend / RPCs / schema / security) vs **🟨 UX** (frontend / strategy / design).

## Audiences

| Pitch | Who | When | Stakes |
| --- | --- | --- | --- |
| **HK Dragon Worlds 2027** (event held November 2026) | Competitors at the regatta, via the HK Dragon Worlds mobile app's "About BetterAt" tab | Pre-event + during the event | Sign-ups + retention into ongoing fleet |
| **Johns Hopkins School of Nursing** | Dean Dr. Sarah Szanton, plus admin / faculty / students | Single demo, then institutional rollout conversation | Institutional adoption (paid) |
| **Sam Pitroda + Indian women home-entrepreneurs** | Pitroda himself, plus the rural SHG audience he advocates for | Single demo | Strategic backing + government / NGO partnership |

Plus a fourth implicit audience: **anyone landing on the website / App Store** for whom these three personas serve as proof.

## The architectural pattern

Three of the four audiences collapse into a single "Institution → Satellite → Member" shape:

| Vertical | Institution | Satellite | Member |
| --- | --- | --- | --- |
| **JHU nursing** | School of Nursing | Clinical site (Bayview, JHH) | Student |
| **India SHG** | NGO / GoI ministry (PRADAN, JSLPS) | Village SHG (~10 women) | Woman entrepreneur |
| **Sail racing** | Yacht club (RHKYC) | Fleet (HK Dragons, Etchells) | Racer |
| **Golf** | Golf club | Weekly handicap group | Golfer |

Same schema fits all four: `organizations` → cohort/fleet primitive → membership. Vocab + native metric differ; structure is identical.

**Dragon Worlds isn't a separate pattern** — it's an event-bounded slice of sail racing. HK Dragons at RHKYC is the ongoing version; Worlds 2027 (November 2026) is the same fleet with a date range.

## The cross-interest portfolio thesis

The single most persuasive surface across every pitch is the **portfolio member view** — "here is this whole human."

- Dean Szanton sees Maya Patel and learns she's a nursing student *and* a golfer *and* learning to sketch.
- Pitroda sees Savitri Devi Munda and learns she's a lac-craft entrepreneur *and* a mother managing the household *and* growing kitchen vegetables.
- Bram sees a HK Dragons sailor and learns he's also a runner training for the marathon *and* recently took up oil painting.

The same screen sells the platform thesis to every audience. The cohort dashboards, the assessment tools, the outcome metrics — those just *prove* the thesis once the user buys in.

## Access & security model (v2 addition)

Portfolio access is the single highest-risk policy decision in the plan. The hero view shows a person's whole cross-interest life, which is privacy-sensitive by default. Split into **two RPCs**:

| RPC | Returns | Allow conditions |
| --- | --- | --- |
| `get_member_portfolio_org_scoped(target_user_id, org_id)` | Plans + activity for `target` scoped to interests inside `org_id` | Caller has `has_org_role_in(org_id, caller, ARRAY['owner','admin','manager','faculty','instructor'])` AND `target` is an active member of `org_id`. |
| `get_member_portfolio_full(target_user_id)` | Full cross-interest portfolio (every interest, every plan) | Caller = target, **OR** `target.profile_public = true` AND `target.portfolio_public_opt_in = true`. |

Demo personas have both flags set to `true`. New schema:
- `profiles.portfolio_public_opt_in boolean NOT NULL DEFAULT false`
- Helper: `has_org_role_in(p_org_id uuid, p_user_id uuid, p_roles text[]) RETURNS boolean` — used by both RPCs and the faculty assess RPC. Replaces direct use of `is_org_admin_member()`, which only recognizes owner/admin/manager.

Both RPCs are `SECURITY DEFINER`, fixed `search_path`, explicit GRANTs to `authenticated`, return typed tables (not `RECORD`), and intentionally bypass owner-only RLS on `plans`.

**Per Codex round 2:** demo isolation = same Supabase project + env flag is *only* acceptable if:
- Reseed allowlist hard-codes demo user IDs (no broad deletes, no role-based queries that could nuke real data)
- Magic-link mint function is env-gated and returns `410 Gone` without the flag
- Audit log records every mint
- Upgrade path to separate demo project is documented (not committed for v1)

## Faculty assessment — competency convergence

Faculty form converges on `org_competencies` (the path the Insights heatmap reads). Patricia's sign-off bumps Dean's heatmap immediately. `betterat_competency_*` tables stay readable for legacy data; no new writes flow there.

**Backend (Codex):**
- Migration adds to `step_capability_evidence`:
  - `confirmed_by_user_id uuid REFERENCES auth.users(id)`
  - `confirmed_at timestamptz`
  - `confirmed_notes text`
- New RPC `record_competency_evidence(p_step_id uuid, p_org_competency_id uuid, p_notes text) RETURNS uuid` SECURITY DEFINER:
  - Validates caller via `has_org_role_in(org_id_of_competency, caller, ARRAY['faculty','instructor','admin','manager','owner'])`
  - Validates `target_user_id` (step owner) belongs to a cohort the caller has access to
  - Populates NOT NULL `capability_id = p_org_competency_id::text` and `capability_name = org_competencies.short_label`
  - Sets `confirmed = true`, `confirmed_by_user_id = auth.uid()`, `confirmed_at = NOW()`, `confirmed_notes = p_notes`
  - Returns the inserted evidence row id

**Reporting gap (accepted):** `betterat_competency_attempts.preceptor_notes` carry narrative text that won't surface in the heatmap. Post-demo fix is rendering `step_capability_evidence.confirmed_notes` on person-detail / site-detail / evidence drill-down, not reviving the legacy chain.

## Date discipline (v2 addition)

Per Codex: **never parse dates from slugs.** Always set explicit dates on:
- `redeem_tokens.valid_from`, `redeem_tokens.valid_to` (default `now() + 180d` is too loose for an event-bound token)
- `plans.started_at`, `plans.ended_at`
- Cohort `start_date`, `end_date`

For HKDW: `valid_from` = sign-up open date, `valid_to` = event end date + grace window. Audit sites that touch `redeem_tokens.source = 'hkdw-2026'`, `RedeemService.SAMPLE_TOKEN`, `app/r/[token].tsx`, debug routes, and seed scripts.

## What's already built (audit summary)

### Schema + plumbing that carries across pitches
- **Plans** as a first-class entity — `plans.vision_statement`, `plans.vision_competency_ids`, `plans.source_blueprint_id`, `plans.status`, RLS-gated per-user
- **Cohort discussion** at `blueprint_step_id` scope — RLS via `is_plan_member_for_blueprint_step()`, realtime publication, notification fan-out trigger
- **Watch tab "From your cohorts" stream**, `?scope=cohort` deep-link, Inbox tap-routing
- **Org admin shell** at `/admin/[orgId]/{overview,insights,cohorts,people}` with real heatmap RPC
- **Faculty review** at `/faculty-dashboard` with sign-off chain → `betterat_competency_reviews` (legacy chain; new flow writes evidence directly)
- **Cohort/section** primitive — `betterat_org_cohorts` + `betterat_org_cohort_members`
- **Programs** schema — `programs`, `program_sessions`, `program_participants`, `program_templates` (no UI yet)
- **Org invite token** flow + landing screen — bulk CSV is demo-mocked
- **Phone OTP auth** at `app/(auth)/phone.tsx` — full working flow
- **`session_accounts`** anonymous-but-claimable pattern, used by `/r/[token]` redeem flow
- **Featured blueprints** — `is_featured` + `featured_rank` + `featured_blurb` columns on `blueprints`, `list_marketplace_blueprints()` RPC
- **Org claim flow** — `organization_claims` table + `/organizations/[slug]/claim.tsx` + admin review
- **Interest vocab system** — per-interest swaps; entrepreneur vocab includes Indian festival phase patterns; `crewHeader: 'FLEET'` for sailing
- **i18n infrastructure** — `lib/i18n/index.ts` exists with Hindi resources imported at line 121 (audit round 1 was wrong about this)
- **Voice press-and-hold** capture UI (recording only — transcription is a stub at `VoiceNoteService.ts:254`)

### Per-vertical seed data already loaded
- **Dragon Worlds**: HKDW 2027 blueprint exists; promo redeem flow shipped at `/redeem` + `/r/[token]`; yacht clubs pre-populated from entry list
- **JHU**: `Johns Hopkins School of Nursing` org with Patricia Morrison (admin), Maya Patel + ~20 other students, `org_competencies` (IV insertion, sepsis bundle, …), POIs (Bayview, JHH). Dean persona **not yet seeded** — Wave 1.
- **India SHG**: `PRADAN — Khunti Unit` org with Savitri Devi Munda (member); Phulmani / Champa / Basanti as SHG-mates with narrative depth (MUDRA ₹40k success, applications in flight, newcomer); lac-craft + food + textile blueprints

## What still needs to be built

### Wave 1 — Shared anchors

| Build | Lane | Effort | Notes |
| --- | --- | --- | --- |
| `record_competency_evidence` RPC + migration for new evidence columns + `has_org_role_in` helper | 🟦 Codex | 3h | Foundation for the faculty form *and* sharpens the access model used by portfolio RPCs. |
| `get_member_portfolio_org_scoped` + `get_member_portfolio_full` RPCs + `profiles.portfolio_public_opt_in` column + demo persona opt-in seed | 🟦 Codex | 3h | Two-RPC contract; org-admin vs full-public separation. |
| `admin_competency_evidence_counts(p_org_id, p_cohort_id default null)` signature update + `useAdminCompetencyEvidence` call-site update | 🟦 Codex | 1h | Cohort filter for Insights heatmap. Call site at `hooks/useAdminCompetencyEvidence.ts:146`. |
| `mint_demo_session` edge function + `demo_session_audit` table + `SUPABASE_DEMO_MODE` env flag + rate limit + 5-min magic-link expiry | 🟦 Codex | 3h | Acceptance criteria locked. Hard allowlist of persona keys in function config. |
| Demo persona seeds: Dean Sarah Szanton, PRADAN Field Officer (Savitri's mentor), HK Dragons racer #2 (cohort fan-out target) + `portfolio_public_opt_in=true` for all demo personas | 🟦 Codex (or seed SQL) | 1h | |
| `/demo` page UI + persona registry config | 🟨 UX | 3h | Stubs the mint call; ships before edge function. Three vertical sections, persona cards, role-aware landing routes. |
| Cross-interest portfolio member view `/p/[userId]` (UI + integration with portfolio RPCs) | 🟨 UX | 4h | The hero surface. Renders per-interest cards side-by-side with vision + recent activity + cohort thread peek. |
| Org admin shell vocab generalization (Dean = NGO Director; Cohort = SHG Section / Fleet / Handicap Group; POI = Village) | 🟨 UX | 2h | Vocab swap layer reading `organization.interest_slug` + a small per-vertical lexicon. |
| Cohort dropdown on Insights page → calls updated RPC | 🟨 UX | 1h | After Codex ships the signature update. |
| Demo persona role-landing routes | 🟨 UX | 1h | Map persona → home tab on first sign-in. |
| Nightly demo reseed cron (allowlisted to demo user IDs only) | 🟦 Codex | 2h | Per Codex round 2: no broad deletes, no role-based queries. Hard ID list. |

**Wave 1 total ≈ 24h** (≈10h Codex, ≈11h UX, ≈3h overlap/integration).

### Wave 2 — Per-vertical hero metrics

| Build | Lane | Effort | Notes |
| --- | --- | --- | --- |
| Faculty assess-competency form modal — calls `record_competency_evidence` | 🟨 UX | 3h | Wave 2 entry point; backend RPC ships in Wave 1. |
| Business outcomes schema + dashboard | 🟦 Codex schema + 🟨 UX dashboard | 5h | `business_outcomes (user_id, plan_id, week_start, units_sold, revenue_minor, currency, customer_count, repeat_count)`. `/outcomes` screen weekly card + trend chart. |
| Program browser + cohort enrollment | 🟨 UX | 3h | `/admin/[orgId]/programs` list + edit; bulk-assign cohort → `program_participants`. |
| Real voice transcription (Whisper) | 🟦 Codex (API wiring) + 🟨 UX (UI confidence) | 4h | Replace `VoiceNoteService.ts:254` stub. Hindi + English language selection. |

**Wave 2 total ≈ 15h.** After Wave 2: SHG + JHU demos are workable end-to-end; DW unchanged.

### Wave 3 — Polish + Dragon Worlds finish

| Build | Lane | Effort | Notes |
| --- | --- | --- | --- |
| i18n — locale selection UX, translation coverage audit, `hi-IN` → `hi` mapping | 🟨 UX | 3h | Infra exists at `lib/i18n/index.ts:121`. Real work is coverage + selection. |
| Hindi translation pass for Savitri's visible screens | 🟨 UX | 2h | Capture composer + L3 timeline + portfolio + outcomes. |
| App-wide entrepreneur vocab swaps | 🟨 UX | 2h | Broaden `interestVocab.ts` entrepreneur vocab beyond the L3 arc — tabs, settings, capture composer. |
| DW SQL seed slice + "official from IDA" badge + "have a code?" entry on sign-up | 🟦 Codex + 🟨 UX | 2h | Seed Worlds 2027 fleet, set `is_featured=true`, mint redeem token with explicit dates, link `blueprints.fleet_id`. Badge renders when `blueprint.org_id.organizations.official=true`. |
| Auto-graduate to IDA at event end | 🟦 Codex | 2h | Daily edge function — `plans WHERE ended_at < NOW() AND status='active' AND source_blueprint_id = HKDW` → `status='completed'` + `fleet_members` insert + notification fan-out. |

**Wave 3 total ≈ 11h.** After Wave 3: all three demos ship at full credibility.

### Wave 4 — Institutional infrastructure (deferred until post-demo)

| Build | Lane | Effort |
| --- | --- | --- |
| Bulk CSV invite real wiring | 🟦 Codex + 🟨 UX | 3h |
| Evidence-notes / reviewer-metadata surfacing on person + site detail (closes the Codex-flagged narrative reporting gap) | 🟨 UX | 3h |
| Per-vertical second-pass — golf vernacular, more SHG personas, etc. | 🟨 UX | variable |
| Production migration to separate demo project | 🟦 Codex | variable |

**Grand total Waves 1–3 ≈ 50h** (~21h Codex / ~24h UX / ~5h integration).

## Build order

**Horizontal first, vertical second.** Three of the four verticals genuinely share infrastructure. Per the labor split, **Codex and UX can work in parallel within each Wave** — UX stubs the API surface, Codex ships the contracts, integration is the seam.

**Critical path for the first demo (~7 working days):**

1. Codex ships Wave 1 backend slice (RPCs, edge function, audit table, helpers) — ~10h
2. In parallel, UX stubs `/demo` + persona registry + portfolio shell — ~8h
3. Integration: replace UX stubs with real RPC calls — ~2h
4. Wave 2 hero metrics layered on top — ~15h
5. Wave 3 polish + DW finish — ~11h

A single demo (e.g. JHU first) can ship at the end of Wave 2 (~25h total) by skipping the SHG-specific Wave 2 items and all of Wave 3.

## Demo personas (Wave 1 registry)

| Persona key | Auth user | Vertical | Role | Landing surface | Status |
| --- | --- | --- | --- | --- | --- |
| `savitri` | `demo-savitri@betterat.app` | India SHG (PRADAN — Khunti Unit) | Member | `/practice` | ✅ seeded |
| `maya` | `nursing-peer-1@demo.regattaflow.io` | JHU (Maya Patel) | Student | `/practice` | ✅ seeded |
| `patricia` | `patricia.morrison@jhu-faculty-demo.edu` | JHU (Patricia Morrison) | Faculty / admin | `/admin/[jhsonId]/overview` | ✅ seeded |
| `markus` | `demo-markus@regattaflow.app` | Sail racing (Markus Tham) | Racer | `/practice` | ✅ seeded |
| `szanton` | `sarah.szanton@jhu-faculty-demo.edu` | JHU | Dean | `/admin/[jhsonId]/overview` | 🟦 needs seed |
| `pradan-field` | `field-officer-1@pradan-demo.org` | India SHG | Field Officer | `/admin/[pradanId]/overview` | 🟦 needs seed |
| `hkdragons-2` | `demo-yvonne@regattaflow.app` (existing) | Sail racing | Racer | `/practice` | ✅ seeded |

All demo personas get `profiles.profile_public = true` AND `profiles.portfolio_public_opt_in = true` so the hero portfolio view works against real demo flow.

## Resolved decisions

| Decision | Resolution |
| --- | --- |
| Demo sign-in mechanism | Magic-link via edge function with `SUPABASE_DEMO_MODE` env gate, allowlist, rate limit, audit log |
| Hindi scope for v1 | Visible-only on Savitri-touched screens (Wave 3). Locale selection UX added separately. |
| Voice transcription vendor | Whisper for v1 — best Hindi quality + simplest integration |
| Dean persona — real or stand-in | Real seed account named "Dr. Sarah Szanton" (actual JHSON Dean, public info) |
| `business_outcomes` table location | Add alongside `step_capability_evidence`; different shape, different audience, keep evidence intact |
| Auto-graduate cron timing | Daily |
| Demo data state for prospects | Sandbox with nightly reseed (allowlisted target IDs only) |
| Portfolio access | Two RPCs: org-scoped (admin can call) + full-cross-interest (target opt-in or self). Per Codex round 2. |
| Competency long-term | Converge on `org_competencies`. New writes via `record_competency_evidence` RPC. Legacy `betterat_competency_*` stays readable for old data. |
| HKDW year | "Worlds 2027" is the event name; the event happens November 2026. Codebase uses 2027 in slugs. Audience copy: "Worlds 2027 · November 2026". Dates set explicitly, never parsed from slugs. |
| Demo isolation | Same Supabase project + env flag + allowlisted reseed. Separate demo project is the upgrade path; not v1. |

## Risks

- **Demo isolation on same project** — biggest residual risk. Mitigated by env flag + allowlist + audit log. Upgrade path is separate project if any prospect ever writes data we can't isolate.
- **Voice transcription is a hardcoded stub** — Savitri's voice notes don't produce real transcripts today. Wave 2 item.
- **JHU blueprint dangling references** — the `Fundamentals & Patient Safety` blueprint exists in `blueprint_subscriptions` but not in `blueprints` table. Cohort notifications get an awkward body until we either heal the reference or accept the cosmetic. Optional Wave 4 cleanup.
- **Reporting narrative gap** — Codex-flagged. Faculty's confirmed_notes will surface on evidence rows; mass-aggregate narrative across legacy `betterat_competency_attempts.preceptor_notes` won't auto-migrate. Acceptable for demo.
- **Org-admin → cross-interest leak** — RESOLVED via two-RPC split. Worth re-reviewing the policy when the demo broadens to real customers.

## Demo-day narratives

### HK Dragon Worlds pitch
"Open the Worlds mobile app → tap About BetterAt → land in the App Store → tap install → open → already signed in via the embedded token → land on your fleet's Practice tab → see the next race step + cohort thread already populated with two other competitors' posts → tap Atlas → see the race areas marked → tap any racer's avatar → see their cross-interest portfolio."

### JHU Dean pitch
"You're Sarah Szanton. Open BetterAt → land on the institutional dashboard → see your two BSN cohorts side by side, 84 students, 73% on-pace for accreditation milestones → tap into Maya Patel → see her active nursing plan, her vision (*'Land an ICU job at JHH in May'*), her cohort thread with peers, her competency progress. Tap the 'See full portfolio' affordance (Maya opted in) → see her other interests (sketching, distance running) → understand BetterAt's thesis instantly. Tap into Bayview clinical site → see the heatmap of where your students are evidencing competency. Tap into Patricia Morrison → see her teaching activity + her own personal portfolio."

### Pitroda pitch
"You're Sam. Open BetterAt → land on Savitri Devi Munda's portfolio → see she's running a lac-craft business, learning to read, growing kitchen vegetables, raising her daughter → tap her business plan → see the vision (*'Save ₹10,000 every month'*), her week's revenue (₹1,200, up from ₹600 last month), her customers (10, including 3 repeat), her cohort thread with Phulmani who just landed her MUDRA loan. Tap a voice note Savitri left in Hindi → hear it + read the transcript. Tap Phulmani's portfolio → see what next looks like."

## What I won't build for the demo

- **Real billing / Stripe integration for free passes** — `subscription_tier` already gates; demo personas stay at whatever tier the redeem flow grants. Production hardening separate.
- **Server-side trial-expiry cron** — current client-side enforcement is fine for demos; production gap.
- **SSO / SAML institutional onboarding** — manual seed for now.
- **Full vernacular swap for golf vertical** — vocab + persona registry only; golf members aren't part of any of the three current pitches, but the architecture demonstrably supports them.
- **Separate demo Supabase project** — upgrade path only.
- **Bridge view across `betterat_competencies` ↔ `org_competencies`** — converging on `org_competencies` is enough for the demo.

---

*Updated v2 with Codex review round 1 + round 2 folded in. Source of truth for build order; commits should reference Wave N item M when they land.*
