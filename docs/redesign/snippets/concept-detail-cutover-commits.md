# Concept Detail Cutover Commit Templates

## Commit 4 — Render switch in `concept-ios/[slug].tsx`

```text
feat(redesign): cut Concept detail over to iOS register variants

Gate the canonical Concept detail route behind FEATURE_FLAGS.CONCEPT_IOS_REGISTER.

Prerequisites:
- Commit 1 `<commit hash of Commit 1>` added playbook_concept_user_state
- Commit 2 `<commit hash of Commit 2>` added the Concept detail state
  hook/service and linked-reflection metrics
- Commit 3 `<commit hash of Commit 3>` added resolveConceptDetailVariant
  with routing tests

- flag ON: /concept-ios/[slug] maps real concept + reflection data into
  ConceptDetailScreen
- flag OFF: /concept-ios/[slug] keeps the existing data-wired render path
  unchanged
- app/(tabs)/playbook/concepts/[slug].tsx is intentionally untouched; it is
  the legacy Playbook stack route, not the iOS-register Concept detail route
- variant routing supports new, dormant, and breakthrough states without
  touching concept summary cards
- mature non-dormant concepts use standard practicing chrome, not the new or
  breakthrough treatment
- /concept-detail-ios remains available as the direct variant preview route

Revert is a single env flag flip if production regressions surface.
```

## Commit 5 — Migration plan updates

```text
docs(redesign): mark Concept detail cutover shipped

Update migration artifacts after the Concept detail render switch lands.

- record the three pre-cutover commits:
  - `<commit hash of Commit 1>` playbook_concept_user_state migration
  - `<commit hash of Commit 2>` Concept detail state read path
  - `<commit hash of Commit 3>` Concept detail variant routing
- record the render-switch commit: `<commit hash of Commit 4>`
- mark concept-detail-ios shipped in docs/redesign/IOS_SURFACE_INVENTORY.json
- update docs/redesign/IOS_MIGRATION_PLAN.md with the render-switch commit
  and any remaining breakthrough-detector or Work-mode follow-ups
- keep docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md linked as the data-layer
  source of truth that preceded the cutover
- keep Concept summary cards out of scope and preserve the summary-vs-detail
  boundary documented in the migration plan
- resolve or remove any inventory entry that treats Concept variants as a
  separate surface rather than state variants of Concept detail

The cutover ships the full-page Concept detail surface only. Inline actions on
summary cards remain a separate architecture decision.
```
