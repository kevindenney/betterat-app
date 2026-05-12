# Decisions to Make

**Source**: Consolidated from `docs/audit/step-architecture-migration-plan.md` and `docs/audit/onboarding-and-identity-plan.md`.
**Purpose**: Single review surface for every open decision across both plans, ordered by urgency.

**Status**: ✅ **All 13 decisions resolved 2026-05-12.** Recommendations below were accepted as-shipped. Caveats on D10/D11/D13 noted by the user — revisit if assumptions change. Implementation now follows the migration sequences in both plan documents.

---

## Locked decisions — quick reference

| # | Decision | Locked answer |
|---|---|---|
| D1 | Recent-activity table | `step_recent_activity`, UPSERT on `(user_id, step_id)`, 7-day TTL, `source` column |
| D2 | AsyncStorage migration safety | Audit readers, then dual-write for one release before cutover |
| D3 | Display rename scope | Display-only; internal symbols stay `plan/act/review` |
| D4 | Card render convergence | Shared selector, separate layout components |
| D5 | Instructor + competency in `sections[]` | Keep separate |
| D6 | `next_step_notes` panel | Fold into `anything_else` |
| D7 | Legacy `[YYYY-MM-DD via Telegram]` stamp | Parse + populate `captured_at`, snapshot raw blob before transform |
| D8 | Persona pill at signup | Remove pill; default learner; org-setup via separate entry |
| D9 | `user_type` column | Retain; do not migrate now |
| D10 | Read-only share scope | Steps + blueprints only, revocable, optional expiry |
| D11 | CRP-assisted model | v1: learner owns account (a). Long-term target: dual-keyed CRP role (c) — separate build |
| D12 | SAML/SSO | Google Workspace OAuth only; confirm with JHU IT first |
| D13 | Trial gating | Soft gate at day 14 (nudges/banners), confirm pricing intent |

---

## Summary

- **Total decisions to make**: 13
- **Block the first build session (Step A of step arch)**: 0 — Step A is a pure read-side selector with no schema or surface change. Onboarding Step 1, however, has one safety prerequisite (D2).
- **Block the first month of work** (through Step C of step arch + Steps 1–3 of onboarding): 3 (D1, D2, D7)
- **Can wait** (later steps, or scope-questioning): 10

Decisions D1–D7 are ordered by which build-session they block. D8–D13 are product-shape / longer-horizon.

---

## D1. Recent-activity table name + TTL semantics

**Source:** Step arch plan, §5 row 2 (Step B)
**What's being asked:** What do we name the table backing the `recentlyActiveStep` signal, what columns does it carry, and how long does an entry stay "recent" for routing fallback?
**Why it matters:** Step B writes into this table on every bot turn. The name is sticky once production data lands; TTL governs how stale a step can be before the bot stops auto-routing to it.
**Options:**
- (a) `step_recent_activity` with `(user_id, step_id, last_active_at, source)` and 7-day partial index. Append-only, dedupe on write.
- (b) Same shape, but UPSERT keyed on `(user_id, step_id)` to keep one row per (user, step). Smaller table.
- (c) `recently_active_step` singular naming to match spec's variable name (`recentlyActiveStep`).
**Your recommendation:** Option (b) with the name `step_recent_activity` (plural — consistent with `timeline_steps`, `user_interests`, etc.). UPSERT keeps it bounded; 7-day TTL via cleanup cron or partial index. Add a `source` column for analytics — useful when comparing Telegram/WhatsApp routing accuracy later.
**Reversibility:** Hard to rename after Step B ships (foreign-key churn). TTL can be retuned easily.
**Decision needed by:** Start of Step B.

---

## D2. AsyncStorage onboarding state migration safety

**Source:** Onboarding plan, §5 row 6 (Step 1)
**What's being asked:** Before moving `onboarding_interest_slug` out of AsyncStorage and into `user_interests` as source of truth, what existing screens read `hasSeenOnboarding` or other AsyncStorage onboarding keys, and would clearing/migrating them break in-flight user journeys (e.g. resurfacing onboarding to existing users)?
**Why it matters:** Onboarding Step 1 is the only thing in the first month that could brick existing accounts if done wrong. Risk doc explicitly flags "screens will look empty" if not done atomically.
**Options:**
- (a) Audit all readers of `OnboardingStateService` keys before Step 1, then change in one PR.
- (b) Dual-write for one release: keep AsyncStorage write *and* `user_interests` insert; cut over readers screen-by-screen.
- (c) Snapshot test the post-signup user journey end-to-end before any change, then change with confidence.
**Your recommendation:** Option (b). It's slower but eliminates the "empty screens" failure mode. The audit (a) is necessary input regardless — do (a) first, then dual-write per (b). Snapshot tests (c) are good but won't catch the AsyncStorage race that fires on app reload mid-onboarding.
**Reversibility:** Easy if dual-write. Painful if we cut over and a screen still reads AsyncStorage.
**Decision needed by:** Start of Onboarding Step 1.

---

## D3. Display-rename scope (Plan/Act/Critique → Before/During/After)

**Source:** Step arch plan, §5 row 3 (Step D)
**What's being asked:** Does the rename touch only user-visible strings, or also internal symbols, analytics event names, deep-link paths, and prop types?
**Why it matters:** Full rename is ~150 call sites and breaks deep links + analytics dashboards retroactively. Display-only is one i18n file change.
**Options:**
- (a) Display-only — internal symbols stay `plan`/`act`/`review`, only copy/labels change.
- (b) Full rename — all symbols, events, and deep links.
- (c) Display-only now, full rename later if there's a concrete reason (e.g. external API consumers see internal names).
**Your recommendation:** Option (a). Future-self will thank you. The mapping is 1:1 and the internal names are private to the codebase. Only revisit if you ship a public API surface that exposes them.
**Reversibility:** Easy to upgrade (a) → (b) later if needed. Painful to downgrade.
**Decision needed by:** Start of Step D.

---

## D4. Card render convergence approach

**Source:** Step arch plan, §5 row 4 (Step D)
**What's being asked:** When converging the card path (`StepPlanQuestions`/`StepDrawContent`) with the detail path (`StepDetailContent`/`PlanTab`), keep two separate compact components or use one composition with a `compact` prop?
**Why it matters:** The two trees have already drifted (per `feedback_card_rendering_path.md`). Continuing to maintain two compositions invites further drift; collapsing into one with `compact` prop centralizes the source of truth but risks layout regressions on cards.
**Options:**
- (a) Single composition with `compact` prop variant.
- (b) Keep separate components but have both consume the same `getReviewSections` selector — shared data, separate layout.
- (c) Replace card content entirely with a single-line summary derived from the most-recent section, no shared layout.
**Your recommendation:** Option (b). Cards are visually distinct from detail (different padding, truncation, badges) and forcing them into one component will accumulate `compact ? a : b` branches. Sharing the *data* is the win; sharing the layout is overcommitment.
**Reversibility:** Easy. Option (b) doesn't lock anything in.
**Decision needed by:** Start of Step D.

---

## D5. Instructor + competency assessments — inside or outside `sections[]`

**Source:** Step arch plan, §5 row 5 (Step D)
**What's being asked:** When refactoring the After tab to render `sections[]`, should instructor assessment and competency assessment become entries in the `sections[]` array, or stay as separate panels?
**Why it matters:** They have different *write paths* (instructor writes, not user/bot) and different *visibility rules* (competency rolls up to faculty dashboards). Conflating them with user-authored sections muddles authorship and may break faculty RLS reads.
**Options:**
- (a) Keep separate — `sections[]` is user/bot-authored capture only.
- (b) Absorb both — add `author_role` per section, render uniformly.
- (c) Absorb only competency (it's user-claimed), keep instructor separate.
**Your recommendation:** Option (a). Authorship boundary matters; absorbing them tomorrow would let two write paths corrupt each other's data. `sections[]` should mean "what the learner / bot captured." Instructor + competency are first-class panels with their own contracts.
**Reversibility:** Easy to merge later; painful to split after absorbed.
**Decision needed by:** Start of Step D.

---

## D6. `next_step_notes` — keep as standalone panel or fold into `anything_else`?

**Source:** Step arch plan, §5 row 1 (Step E)
**What's being asked:** The five canonical prompts (`what_happened`, `what_worked`, `what_didnt`, `what_did_you_learn`, `anything_else`) don't include "next step notes." On backfill, does that legacy field become its own panel, or get absorbed into `anything_else`?
**Why it matters:** Affects whether the After tab has 5 panels or 6, and whether forward-looking commentary stays first-class or becomes a free-text afterthought.
**Options:**
- (a) Fold into `anything_else`. Simpler. Spec-compliant.
- (b) Add a 6th canonical prompt `next_step_notes` to preserve forward-looking commentary as a distinct affordance.
- (c) Convert into a structured "follow-up step" suggestion — write to a separate field/table that links to a new draft step.
**Your recommendation:** Option (a). The spec explicitly defines the five prompts. Forward-looking notes still appear in the After tab via `anything_else`. Option (c) is interesting but is a feature design decision (a "suggested next step" flow), not a backfill decision — defer until you have the AI extraction pattern from `project_step_provenance_gaps.md`.
**Reversibility:** Medium. Re-splitting requires re-parsing `anything_else` content later.
**Decision needed by:** Start of Step E.

---

## D7. Legacy `[YYYY-MM-DD via Telegram]` stamp — strip or preserve as `captured_at`?

**Source:** Step arch plan, §5 row 6 (Step E)
**What's being asked:** The current bot writes inline date stamps inside the string content. On backfill into `sections[]`, parse those stamps out and use them as `captured_at`, or strip and synthesize `captured_at` from `step.completed_at`?
**Why it matters:** The stamps are the only signal of when individual debriefs were recorded for steps that received multiple bot writes. Throwing them away loses temporal granularity.
**Options:**
- (a) Parse the stamps with a regex, populate `captured_at`, strip from content.
- (b) Strip entirely, set `captured_at = step.completed_at ?? step.updated_at`, lose granularity.
- (c) Hybrid: parse when present, fall back to `step.updated_at` when malformed.
**Your recommendation:** Option (c). The stamp format is deterministic (`[YYYY-MM-DD via Telegram]`) so parsing is safe, but defensive: fall back gracefully. Preserve the source tag (`via Telegram`) by setting `source: 'telegram'` on parsed entries.
**Reversibility:** Once you strip, the original strings are gone — keep a snapshot of the raw `metadata.review` blob in a backfill audit table before transforming.
**Decision needed by:** Start of Step E.

---

## D8. Persona at signup — keep three pills or remove and infer?

**Source:** Onboarding plan, §5 row 3 (Step 1)
**What's being asked:** Currently signup asks sailor/coach/club. Capabilities are now additive via `user_capabilities`. Do we still need the persona pill at signup, or infer/upgrade later?
**Why it matters:** This is a first-30-seconds friction question. Removing it simplifies onboarding for the dominant case (individual consumer) but loses the org-onboarding fork (sailor → trial-activation vs club → club-onboarding-chat).
**Options:**
- (a) Keep three pills as-is.
- (b) Default to `sailor`, remove pill, surface "I'm setting up an organization" as a separate entry point.
- (c) Infer from invite token / URL params: if `?org=` present and user is the creator, set `club`; otherwise default `sailor`.
**Your recommendation:** Option (b). Most signups are individuals; the org-setup case is a different journey that warrants a different entry point (`/setup-organization` from a landing-page CTA). This also makes the signup screen narrower and faster.
**Reversibility:** Easy. The persona column stays; you'd just stop showing the picker.
**Decision needed by:** Onboarding Step 1 polish (not blocking but should be decided alongside).

---

## D9. `user_type` column — drop, retain, or migrate?

**Source:** Onboarding plan, §5 row 5 (Step 1)
**What's being asked:** Now that capabilities are additive (`user_capabilities`), is `users.user_type` doing real work, or is it shadowing `user_capabilities`?
**Why it matters:** Two sources of truth for "what can this user do" causes drift. But UI conditional logic uses `user_type` today.
**Options:**
- (a) Retain — change nothing now, revisit when capability migration is more mature.
- (b) Compute `user_type` as a view over `user_capabilities` (e.g. has 'coaching' → coach).
- (c) Migrate UI conditionals to read `user_capabilities` and deprecate the column.
**Your recommendation:** Option (a). It's not hurting anything. Revisit once you've shipped Onboarding Step 1 and have a clearer picture of which surfaces still branch on `user_type`. Don't do migration cleanup mid-onboarding redesign.
**Reversibility:** Easy at any time.
**Decision needed by:** Whenever — not blocking.

---

## D10. Read-only share scope — what can be shared, to whom, for how long?

**Source:** Onboarding plan, §5 row 4 (Step 4)
**What's being asked:** The `share_tokens` table needs a scope. Step-level only? Blueprint-level? Cohort-level? Time-limited or evergreen? Revocable individually?
**Why it matters:** This is product-shape. It determines whether the app is shareable like a Notion doc, viewable like a portfolio page, or something in between. Different answers warrant different schema columns.
**Options:**
- (a) Steps + blueprints only, revocable, optional expiry, no auth required to view.
- (b) Same as (a) plus "view a profile" (whole-user share).
- (c) Same as (a) plus emailed view, password-protected.
- (d) Step-only first; add blueprint sharing in a later iteration.
**Your recommendation:** Option (a). Steps + blueprints cover the parent / coach / mentor use cases. Profile-level sharing introduces privacy questions you don't want to tackle in Step 4. Password gating is a heavier lift; rate-limiting + unguessable tokens is enough for v1.
**Reversibility:** Adding scopes later is additive. Removing scopes after they're in use breaks live links.
**Decision needed by:** Start of Onboarding Step 4.

---

## D11. CRP-assisted onboarding — separate accounts with consent, or proxy/sub-accounts?

**Source:** Onboarding plan, §5 row 2 (Step 5)
**What's being asked:** When a Community Resource Person helps a learner sign up in the field, is the resulting account fully the learner's (CRP just types for them), or is there a CRP-as-proxy model where the CRP maintains the account on the learner's behalf?
**Why it matters:** This is a fundamental product/identity question. "Whose account is this?" affects RLS, recovery, billing, and how SMS/voice notifications get routed. The decision shapes how scale works in dev-context markets.
**Options:**
- (a) Fully the learner's account; CRP is just a typist. Phone+OTP goes to learner's number.
- (b) CRP-as-proxy: CRP holds account, learner has a "managed" status with eventual hand-off when literacy/phone-access improves.
- (c) Dual-keyed: account is the learner's, but CRP has an "assisted" role attached that lets them see/edit until revoked.
**Your recommendation:** Option (a) for v1 of phone+OTP (matches the plan's "leave CRP-as-proxy out of v1"). Option (c) is the right long-term answer because it lets a CRP see progress without owning the account — but it's a separate, larger build. Don't conflate.
**Reversibility:** Painful. The shape of "who owns the row" is baked into RLS and recovery.
**Decision needed by:** Before Step 5 ships to first dev-context pilot. Phone+OTP alone unblocks the prototype; the proxy model can come after.

---

## D12. SAML/SSO for institutional cohorts — required for first institutions or not?

**Source:** Onboarding plan, §5 row 1 (Step 2 / institutional segment)
**What's being asked:** Is Google Workspace OAuth sufficient for JHU and the first few institutional customers, or does the spec implicitly require enterprise SAML/OIDC?
**Why it matters:** SAML/OIDC is a multi-week build with vendor selection (WorkOS / Auth0 / Stytch / self-host) and per-institution onboarding. If JHU is fine with Google Workspace OAuth, this question disappears for ~6 months.
**Options:**
- (a) Google Workspace OAuth only for first institutions; defer SAML until a deal requires it.
- (b) Add SAML now via WorkOS or similar before institutional pilot ramps.
- (c) Build a SAML stub that returns "talk to sales" while pilots run on OAuth.
**Your recommendation:** Option (a). Get a definitive answer from JHU IT before doing anything — most universities accept Google Workspace OAuth for low-risk apps. If the answer is "we need SAML," that's a separate scoped project and likely a paid integration (WorkOS).
**Reversibility:** Easy — SAML is additive when added.
**Decision needed by:** Before institutional pilot expands beyond JHU dean demo.

---

## D13. Trial gating — advisory flag or actually enforced?

**Source:** Onboarding plan, §5 row 7 (cross-cutting)
**What's being asked:** Today `subscription_status: 'trialing'` is set at signup but no enforcement was found in this audit. Is the trial actually meant to gate features at day 14, or is it informational?
**Why it matters:** Business model question. If it's enforced, the redesign needs trial-expired states, paywalls, and a payment surface. If it's advisory, this plan is correct to leave it alone.
**Options:**
- (a) Advisory only — used for UI nudges and analytics, no hard gate. Current behavior, codify intent.
- (b) Soft gate at day 14 — limited features, banner to upgrade.
- (c) Hard gate — most features behind paywall after trial.
**Your recommendation:** Decide based on memory `project_outcome_pricing_strategy.md` — your stated strategy is "outcome guarantee on normal per-seat pricing." That implies (b) for individuals (soft gate / nudge) and per-seat billing for institutions (orthogonal to individual trial). Confirm against current pricing intent before locking.
**Reversibility:** Adding enforcement later is easy if `subscription_status` is already populated. Removing enforcement after users rely on free features is hard.
**Decision needed by:** Out of scope for either current plan, but should be answered before launch.

---
