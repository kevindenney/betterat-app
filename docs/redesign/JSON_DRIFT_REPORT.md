# JSON Drift Report

Audit target:
- Markdown: [IOS_MIGRATION_PLAN.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:1)
- JSON: [IOS_MIGRATION_PLAN.json](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.json:1)

## Summary

| Drift type | High | Medium | Low | Total |
|---|---:|---:|---:|---:|
| `missing` | 0 | 4 | 3 | 7 |
| `stale` | 0 | 0 | 1 | 1 |
| `lossy` | 2 | 1 | 0 | 3 |
| `schema-gap` | 1 | 2 | 0 | 3 |
| **Total** | **3** | **7** | **4** | **14** |

## Update 2026-05-15 — Inventory schema widened for Reflect sub-surfaces

- `docs/redesign/IOS_SURFACE_INVENTORY.json` now treats `race-log-ios` and `profile-ios` as first-class surface entries rather than implicit sub-surfaces of Reflect.
- This is an intentional structural change: inventory tracks surfaces, not cutovers.
- The migration-plan markdown and migration-plan JSON still describe Reflect primarily at the cutover level, so downstream consumers should expect temporary asymmetry until those artifacts are regenerated around the new surface-level rule.

## Update 2026-05-15 — Concept variants consolidated under Concept detail

- `docs/redesign/IOS_SURFACE_INVENTORY.json` no longer treats `concept-detail-ios-variants` as a separate surface-like entry.
- This is an intentional structural cleanup: `new`, `dormant`, and `breakthrough` are state variants of `concept-detail-ios`, not independent surfaces.
- The current working tree keeps the variant preview route at `/concept-detail-ios`; the canonical route remains `/concept-ios/<slug>` until the render switch lands.

## High

### 1. Surface inventory and preview-route coverage are not represented
- MD section/path: `## Surface inventory — 12 iOS register previews shipped (Phases 0–5)`, `### Entry points`
- JSON section/path: `absent`
- Drift type: `schema-gap`
- Severity: `high`
- Why it matters: The markdown is the only place that enumerates all 12 preview surfaces, their routes, users, wire-up state, and entry points. A JSON-only consumer cannot validate the "12/12 surfaces designed" claim or reason about which previews exist.
- Suggested resolution: `extend schema`
  Add `surfaces[]` with `surface`, `route`, `type`, `user`, `wire_up`, `preview_status`, and optional `entry_points[]`.

### 2. Debrief and Competency Assessment cutover state is flattened in JSON
- MD section/path: `## Resolved architecture decision (2026-05-14) — Reflection vs Competency Assessment`, `## Surface inventory — 12 iOS register previews shipped`, `## What's left before cutover`
- JSON section/path: `cutovers[4]`, `cutovers[5]`
- Drift type: `lossy`
- Severity: `high`
- Why it matters: The markdown distinguishes between "preview built", "canonical student-facing reflection visual pass complete", and "cannot fully retire the existing After tab until Competency Assessment lands". JSON collapses that into a single `pending` cutover status for both surfaces, which hides a meaningful built-vs-cutover-vs-retirement distinction.
- Suggested resolution: `extend schema`
  Add separate fields for `preview_built`, `canonical_cutover_status`, and `legacy_retirement_blockers`, or split preview inventory from cutover status.

### 3. Summary-vs-detail is double-counted across register and architecture decisions
- MD section/path: `## Resolved register decision (2026-05-15) — Summary vs detail surfaces`
- JSON section/path: `register_decisions[6]`, `architecture_decisions[2]`, `architecture_decisions[3]`
- Drift type: `lossy`
- Severity: `high`
- Why it matters: One markdown decision is represented three times in JSON: once as a register decision, once as a generalized architecture rule, and once as a RaceSummaryCard-specific duality rule. That makes downstream counts look more authoritative than the prose structure supports and can mislead readers of the dashboard.
- Suggested resolution: `regenerate`
  Normalize this into one canonical decision record with optional `facets` or `implications[]`, or add a `derived_from` link so the duplication is explicit rather than counted as separate first-class decisions.

## Medium

### 4. Source-design commitments are only partially represented
- MD section/path: `## Source design — what the iOS register commits to`
- JSON section/path: `register_decisions[]`, `cross_cutting_principles[]` (partial only)
- Drift type: `schema-gap`
- Severity: `medium`
- Why it matters: The markdown carries first-order design constraints such as "two accents, two jobs", scoped atmospheric tint, component grammars, preserved cross-register elements, and named absences. JSON has no place for these commitments except incidental references in decision rationale.
- Suggested resolution: `extend schema`
  Add a `design_commitments[]` or `register_commitments[]` section for durable visual-system rules.

### 5. Token replacement inventory is absent from JSON
- MD section/path: `## (1) Editorial tokens that need replacement`
- JSON section/path: `absent`
- Drift type: `schema-gap`
- Severity: `medium`
- Why it matters: The markdown contains the authoritative token-by-token mapping and the new `IOS_REGISTER` additions. JSON cannot answer which editorial tokens were replaced, which stayed editorial, or what the new token set includes.
- Suggested resolution: `extend schema`
  Add `token_migrations[]` and `new_tokens[]`, or leave it out intentionally and add a note that token detail remains markdown-only.

### 6. The 14-commit re-skin inventory is missing
- MD section/path: `## (2) Existing components that need re-skinning per the 14 redesign commits`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `medium`
- Why it matters: The markdown preserves file-level migration history and commit-level re-skin intent. JSON retains only coarse phase summaries, so the audit trail from editorial commit to iOS-register re-skin is lost.
- Suggested resolution: `leave as-is with note`
  If JSON is only meant to support status dashboards, document that this file-level migration inventory stays markdown-only.

### 7. Race Prep-specific fresh-build surface inventory is missing
- MD section/path: `## (3) Surfaces in the Race Prep file that don't exist in code yet`, `### Addendum — Phase 5 fresh-build surfaces`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `medium`
- Why it matters: The markdown distinguishes between re-skins and truly new surfaces/components. JSON loses that nuance, which matters when deciding whether future work is incremental chrome work or fresh implementation.
- Suggested resolution: `extend schema`
  Add a `surface_work_items[]` or `fresh_build_surfaces[]` section keyed by surface and work type.

### 8. Three open follow-ups in the markdown are not carried into JSON
- MD section/path: `## Open architecture follow-ups`, items `8`, `9`, `10`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `medium`
- Why it matters: These items remain in the markdown but do not appear in JSON:
  - active-interest mismatch on competency progress
  - Competency Assessment "0 captures" empty-state copy
  - post-cutover cleanup pass on Playbook home
  A JSON-only reader will miss non-trivial cleanup and UX risks.
- Suggested resolution: `extend schema`
  Add `nonblocking_followups[]` or widen `data_layer_followups[]` into a more general `followups[]` collection with category and blocking level.

### 9. Cross-cutting principles are reduced to one-line summaries
- MD section/path: `## Cross-cutting principles`, `### Loading-state narration`, `### Error-state principle`
- JSON section/path: `cross_cutting_principles[0..1]`
- Drift type: `lossy`
- Severity: `medium`
- Why it matters: The markdown includes examples, voice rules, first target surface, visual treatment, and scope-of-application guidance. JSON keeps only name plus one-line description, which is not enough to reconstruct the principle operationally.
- Suggested resolution: `extend schema`
  Add optional fields like `applies_to[]`, `examples[]`, `first_target_surface`, and `visual_treatment`.

### 10. Verification plan is unrepresented
- MD section/path: `## Verification plan`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `medium`
- Why it matters: The markdown specifies phase-by-phase validation expectations. JSON cannot support a "what still needs to be validated" view or distinguish implementation status from verification status.
- Suggested resolution: `extend schema`
  Add `verification_checks[]` keyed by phase, or leave markdown as the canonical verification artifact and note that explicitly.

## Low

### 11. Historical framing and original planning context are absent
- MD section/path: `## Context`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `low`
- Why it matters: JSON has no place for the origin story of the migration, the original coexist-vs-replace question, or the note that this began as a planning document.
- Suggested resolution: `leave as-is with note`
  This is useful background, but not essential to structured status reporting.

### 12. Entry-point documentation is markdown-only
- MD section/path: `### Entry points`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `low`
- Why it matters: The markdown lists how reviewers reach each preview surface from the product. JSON consumers cannot reconstruct navigation affordances for QA or demo use.
- Suggested resolution: `extend schema`
  Fold this into a future `surfaces[]` schema as optional `entry_points[]`.

### 13. Component kit summary is markdown-only
- MD section/path: `### Component kit summary`
- JSON section/path: `absent`
- Drift type: `missing`
- Severity: `low`
- Why it matters: The markdown is the only place that summarizes the shared `components/ios-register/` kit and where each component is used.
- Suggested resolution: `leave as-is with note`
  Unless a component inventory is needed downstream, this can remain markdown-only.

### 14. Architecture decision dates in JSON do not match the markdown heading dates
- MD section/path: `## Resolved architecture decision (2026-05-14) — Reflection vs Competency Assessment`, `## Resolved architecture decision (2026-05-14) — Playbook home scope`
- JSON section/path: `architecture_decisions[0].resolved_in_session`, `architecture_decisions[1].resolved_in_session`
- Drift type: `stale`
- Severity: `low`
- Why it matters: The markdown headings date those decisions as `2026-05-14`, while JSON records `resolved_in_session: "2026-05-15"` for every architecture decision. That may be intentional, but a reader could interpret it as the original resolution date.
- Suggested resolution: `regenerate`
  Either align the field with the markdown heading date, or rename the field to something unambiguous like `captured_in_session`.
