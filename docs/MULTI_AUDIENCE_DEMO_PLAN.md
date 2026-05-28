# Multi-Audience Demo Plan

> Three pitches, two architectural patterns, one platform thesis.

## Audiences

| Pitch | Who | When | Stakes |
| --- | --- | --- | --- |
| **HK Dragon Worlds 2026** | Competitors at the regatta, via the HK Dragon Worlds mobile app's "About BetterAt" tab | Pre-event + during the event | Sign-ups + retention into ongoing fleet |
| **Johns Hopkins School of Nursing** | The Dean, plus her admin / faculty / students | Single demo, then institutional rollout conversation | Institutional adoption (paid) |
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

**Dragon Worlds isn't a separate pattern** — it's an event-bounded slice of sail racing. HK Dragons at RHKYC is the ongoing version; Worlds 2026 is the same fleet with a date range.

## The cross-interest portfolio thesis

The single most persuasive surface across every pitch is the **portfolio member view** — "here is this whole human."

- Dean sees Maya Patel and learns she's a nursing student *and* a golfer *and* learning to sketch.
- Pitroda sees Savitri Devi Munda and learns she's a lac-craft entrepreneur *and* a mother managing the household *and* growing kitchen vegetables.
- Bram sees a HK Dragons sailor and learns he's also a runner training for the marathon *and* recently took up oil painting.

The same screen sells the platform thesis to every audience. The cohort dashboards, the assessment tools, the outcome metrics — those just *prove* the thesis once the user buys in.

## What's already built (audit summary)

### Schema + plumbing that carries across pitches
- **Plans** as a first-class entity (recently shipped) — `plans.vision_statement`, `plans.vision_competency_ids`, `plans.source_blueprint_id`, `plans.status`, RLS-gated per-user
- **Cohort discussion** at `blueprint_step_id` scope — RLS via `is_plan_member_for_blueprint_step()`, realtime publication, notification fan-out trigger
- **Watch tab "From your cohorts" stream**, `?scope=cohort` deep-link, Inbox tap-routing
- **Org admin shell** at `/admin/[orgId]/{overview,insights,cohorts,people}` with real heatmap RPC
- **Faculty review** at `/faculty-dashboard` with sign-off chain → `betterat_competency_reviews`
- **Cohort/section** primitive — `betterat_org_cohorts` + `betterat_org_cohort_members`
- **Programs** schema — `programs`, `program_sessions`, `program_participants`, `program_templates` (no UI yet)
- **Org invite token** flow + landing screen — bulk CSV is demo-mocked
- **Phone OTP auth** at `app/(auth)/phone.tsx` — full working flow
- **`session_accounts`** anonymous-but-claimable pattern, used by `/r/[token]` redeem flow
- **Featured blueprints** — `is_featured` + `featured_rank` + `featured_blurb` columns on `blueprints`, `list_marketplace_blueprints()` RPC
- **Org claim flow** — `organization_claims` table + `/organizations/[slug]/claim.tsx` + admin review
- **Interest vocab system** — per-interest swaps; entrepreneur vocab includes Indian festival phase patterns; `crewHeader: 'FLEET'` for sailing
- **Voice press-and-hold** capture UI (recording only — transcription is a stub)

### Per-vertical seed data already loaded
- **Dragon Worlds**: HKDW 2027 blueprint exists; promo redeem flow shipped at `/redeem` + `/r/[token]`; yacht clubs pre-populated from entry list
- **JHU**: `Johns Hopkins School of Nursing` org with Patricia Morrison (admin), Maya Patel + ~20 other students, `org_competencies` (IV insertion, sepsis bundle, …), POIs (Bayview, JHH)
- **India SHG**: `PRADAN — Khunti Unit` org with Savitri Devi Munda (member); Phulmani / Champa / Basanti as SHG-mates with narrative depth (MUDRA ₹40k success, applications in flight, newcomer); lac-craft + food + textile blueprints

## What still needs to be built

### Shared across all four verticals (highest leverage)
| Build | Effort | Notes |
| --- | --- | --- |
| **`/demo` page + persona registry** | 3h | Three-card grid; tapping a persona signs you in as them |
| **`mint_demo_session` edge function** | 2h | Service-role-backed magic-link generator for demo personas |
| **Org admin shell vocab generalization** | 2h | Dean = NGO Director; Faculty = Field Officer; Cohort = SHG Section / Fleet / Handicap Group; POI = Village |
| **Cohort-scoped outcomes filter on Insights** | 2h | `admin_competency_evidence_counts()` gains a `cohort_id` arg; dropdown in `/admin/[orgId]/insights` |
| **Cross-interest portfolio member view** | 4h | `/p/[userId]` or `/people/[userId]` — list interests, active plan vision, recent activity per interest, side-by-side |
| **Nightly demo reseed cron** | 2h | Edge function resets demo personas' user-generated state |

### JHU-specific
| Build | Effort | Notes |
| --- | --- | --- |
| **Faculty assess-competency form** | 4h | Form modal in cohort detail → writes `betterat_competency_attempts` (preceptor_rating + notes) → enters review queue |
| **Program browser + cohort enrollment** | 3h | `/admin/[orgId]/programs` list + edit; bulk-assign cohort → `program_participants` |
| **Bulk CSV invite real wiring** | 3h | Replace mock data on `/admin/[orgId]/people/bulk-csv` with real CSV parse + batch invite RPC |

### India SHG-specific
| Build | Effort | Notes |
| --- | --- | --- |
| **Business outcomes schema + dashboard** | 5h | New table `business_outcomes (user_id, plan_id, week_start, units_sold, revenue_minor, currency, customer_count, repeat_count)`. `/outcomes` screen with weekly card + trend chart |
| **Real voice transcription** | 4h | Replace `VoiceNoteService.ts:254` stub with Whisper or Google Cloud Speech-to-Text; Hindi + Bengali model selection |
| **i18n bootstrap + Hindi seed** | 5h | Create missing `lib/i18n.ts`, populate `locales/hi-IN/*.json` for core UI (nav, tabs, step labels, vocab); seed Savitri's profile with `locale: 'hi-IN'` |
| **App-wide entrepreneur vocab swaps** | 2h | Broaden `interestVocab.ts` entrepreneur vocab beyond the L3 arc — tabs, settings, capture composer |

### Dragon Worlds-specific
| Build | Effort | Notes |
| --- | --- | --- |
| **"Have a promo code?" entry on sign-up** | 1.5h | Add a link from `app/(auth)/...` to `/redeem` so general visitors can land in the cohort path |
| **Auto-graduate to IDA at event end** | 2h | Daily edge function — `plans WHERE ended_at < NOW() AND status='active' AND source_blueprint_id = HKDW` → set `status='completed'` + insert `fleet_members` into IDA fleet + notification |
| **"Official from IDA" badge** | 0.5h | Render on blueprint card when `blueprint.org_id` belongs to an org with `official = true` (after Bram claims it) |
| **SQL seed slice** | 0.5h | Create `Dragon Worlds 2026 Fleet` + `HK Dragons Fleet`; set `is_featured=true` on the Worlds blueprint; mint redeem token; link `blueprints.fleet_id` |

## Build order

**Horizontal first, vertical second.** Justified because the three Institution → Satellite → Member verticals genuinely share infrastructure.

### Wave 1 — Anchors (shared, powers every pitch) — ~17h
1. `/demo` page + persona registry (3h) ← **start here**
2. `mint_demo_session` edge function (2h)
3. Cross-interest portfolio member view (4h) ← **the hero surface**
4. Org admin shell vocab generalization (2h)
5. Cohort-scoped outcomes filter on Insights (2h)
6. Nightly demo reseed cron (2h)
7. Demo persona role-landing routing (built into #1) (2h)

After Wave 1: every demo can be opened, but the dean/Pitroda demos are still missing their hero metric.

### Wave 2 — Per-vertical hero metrics — ~14h
8. Business outcomes schema + dashboard (SHG hero) (5h)
9. Faculty assess-competency form (JHU completes the sign-off loop) (4h)
10. Program browser + cohort enrollment (JHU's "BSN Class of 2027" as a clickable entity) (3h)
11. Real voice transcription (SHG's voice-first proof) (2h to start, depends on chosen vendor)

After Wave 2: SHG and JHU demos are complete. DW unchanged.

### Wave 3 — Polish + Dragon Worlds finish — ~8h
12. Hindi i18n seed (SHG demo-language credibility) (5h)
13. App-wide entrepreneur vocab swaps (2h)
14. DW SQL seed + "official from IDA" badge + "have a code?" entry (2h)
15. Auto-graduate cron (2h)

### Wave 4 — Institutional infrastructure (deferred until post-demo) — variable
16. Bulk CSV invite real wiring (3h)
17. Other follow-ups identified during demos

## Demo personas (Wave 1 registry)

Existing seed I can use as-is — confirmed in DB:

| Persona key | Auth user | Vertical | Role | Landing surface |
| --- | --- | --- | --- | --- |
| `savitri` | `demo-savitri@betterat.app` | India SHG (PRADAN — Khunti Unit) | Member | `/practice` |
| `maya` | `nursing-peer-1@demo.regattaflow.io` | JHU (Maya Patel) | Student | `/practice` |
| `patricia` | `patricia.morrison@jhu-faculty-demo.edu` | JHU (Patricia Morrison) | Faculty / admin | `/admin/[jhsonId]/overview` |
| `markus` | `demo-markus@regattaflow.app` | Sail racing (Markus Tham) | Racer | `/practice` |

To add as seed for the demo:
- A **Dean** persona at JHSON (Patricia can serve as a stand-in for v1 since she has `role='admin'`, but a separately-named Dean persona reads more clearly)
- A **Field Officer** persona at PRADAN — Khunti Unit (Savitri's mentor)
- An optional **HK Dragons racer** who's *not* Markus, to demo the cohort discussion fan-out

## Open decisions

| Decision | Options | My lean |
| --- | --- | --- |
| Demo sign-in mechanism | (a) `signInWithPassword` with known demo passwords (b) magic-link via edge function (c) `session_accounts` token reused | (b) — safest, no leaked credentials, integrates with existing auth |
| Hindi scope for v1 | Translate every UI string vs only the visible Savitri-touched screens | Visible-only for v1; expand if Pitroda wants a full Hindi review |
| Voice transcription vendor | Whisper API vs Google Cloud Speech vs OpenAI | Whisper for v1 — best Hindi quality + simplest integration |
| "Dean" persona — real or stand-in? | Seed a real Dean account vs use Patricia | Seed a real one; named "Dr. Sarah Szanton" (actual JHSON Dean — public info, sharpens the pitch) |
| `business_outcomes` table location | Replace `step_capability_evidence` for SHG vs add alongside | Add alongside — different audience, different shape; keep evidence concept for compatibility |
| Auto-graduate cron timing | Daily vs hourly vs event-driven | Daily — cheapest, fine for plan/event end dates |
| Demo data state for prospects | Read-only vs sandbox-with-nightly-reset | Sandbox with nightly reset — lets them poke around without poisoning |

## Risks

- **i18n missing infrastructure** (`lib/i18n.ts` doesn't exist despite being imported in `phone.tsx`) — discovered during audit. Means Hindi demo currently shows English everywhere except phone OTP. Wave 3 closes this.
- **Voice transcription is a hardcoded stub** — Savitri's voice notes don't produce real transcripts today. The placeholder is *visible* in the UI ("Voice capture · 5s"). Cannot demo voice-first without Wave 2 item 11.
- **JHU blueprint dangling references** — the `Fundamentals & Patient Safety` blueprint exists in `blueprint_subscriptions` but not in `blueprints` table. Cohort notifications get an awkward body until we either heal the reference or accept the cosmetic.
- **Demo data corruption** — without the reseed cron, prospects' clicks accumulate. Risk: each successive demo gets messier. Wave 1 item 6 mitigates.
- **Service-role secrets in edge function** — `mint_demo_session` needs the Supabase service role key. Standard practice; needs to be reviewed before any non-demo use.

## Demo-day narratives

### HK Dragon Worlds pitch
"Open the Worlds mobile app → tap About BetterAt → land in the App Store → tap install → open → already signed in via the embedded token → land on your fleet's Practice tab → see the next race step + cohort thread already populated with two other competitors' posts → tap Atlas → see the race areas marked → tap any racer's avatar → see their cross-interest portfolio."

### JHU Dean pitch
"You're Sarah Szanton. Open BetterAt → land on the institutional dashboard → see your two BSN cohorts side by side, 84 students, 73% on-pace for accreditation milestones → tap into Maya Patel → see her active plan, her vision (*'Land an ICU job at JHH in May'*), her cohort thread with peers, her competency progress, **and** her other interests (sketching, distance running). Tap into Bayview clinical site → see the heatmap of where your students are evidencing competency. Tap into Patricia Morrison → see her teaching activity + her own personal portfolio."

### Pitroda pitch
"You're Sam. Open BetterAt → land on Savitri Devi Munda's portfolio → see she's running a lac-craft business, learning to read, growing kitchen vegetables, raising her daughter → tap her business plan → see the vision (*'Save ₹10,000 every month'*), her week's revenue (₹1,200, up from ₹600 last month), her customers (10, including 3 repeat), her cohort thread with Phulmani who just landed her MUDRA loan. Tap a voice note Savitri left in Hindi → hear it + read the transcript. Tap Phulmani's portfolio → see what next looks like."

## What I won't build for the demo

- **Real billing / Stripe integration for free passes** — `subscription_tier` already gates; demo personas stay at whatever tier the redeem flow grants. Production hardening separate.
- **Server-side trial-expiry cron** — current client-side enforcement is fine for demos; production gap.
- **SSO / SAML institutional onboarding** — manual seed for now.
- **Full vernacular swap for golf vertical** — vocab + persona registry only; golf members aren't part of any of the three current pitches, but the architecture demonstrably supports them.

---

*Updated: building Wave 1 in flight. This document is the source of truth for build order; commits should reference Wave N item M when they land.*
