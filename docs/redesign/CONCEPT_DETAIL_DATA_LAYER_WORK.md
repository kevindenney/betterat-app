# Concept Detail Data-Layer Work Plan

## Discrepancies

- No exported Concept detail design brief exists under `docs/redesign/design-briefs/`. The repo source of truth is the staged `components/ios-register/ConceptDetailScreen.tsx` header, `app/concept-detail-ios.tsx` sample content, and the current data-wired route `app/concept-ios/[slug].tsx`.

## Decisions

- Mature non-dormant concepts use default practicing chrome: full synthesis, practicing pill, no dormant footer, no breakthrough offer.
- Dormancy formula: `total_linked_reflections >= 3` and `days_since_last_reflection > clamp(4 * median_inter_reflection_interval_days, 30, 120)`.
- Per-user state lives in a new `(user_id, playbook_id, concept_id)` table; activity metrics are derived from `step_playbook_links` and completed `timeline_steps` on read.
- Breakthrough wins over dormant when both signals are present, because "something changed" is a stronger user-facing signal than "worth revisiting."

## Specs

- Commit 1: `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_1_MIGRATION.md`
- Commit 2: `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_2_READ_PATH.md`
- Commit 3: `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_3_VARIANT_ROUTING.md`

## Ship Sequence

1. Commit 1 — migration: create `playbook_concept_user_state` using `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_1_MIGRATION.md`.
2. Commit 2 — read path: add the Concept detail state service/hook and derived linked-reflection metrics using `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_2_READ_PATH.md`.
3. Commit 3 — variant routing: add `resolveConceptDetailVariant`, tests, and route-level adapter prep using `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_3_VARIANT_ROUTING.md`.
4. Commit 4 — render switch: gate `app/concept-ios/[slug].tsx` behind `FEATURE_FLAGS.CONCEPT_IOS_REGISTER` using `docs/redesign/snippets/concept-detail-cutover-commits.md`.
5. Commit 5 — migration-plan update: mark the Concept detail cutover shipped and record any remaining breakthrough-detector or Work-mode follow-ups.

## Cutover Bar

The render switch must not land until Commits 1–3 are merged. The Concept detail visual surface can render base concept data today, but the cutover depends on real variant routing so the shipped route does not rely on fixture or broad-timeline heuristic state.
