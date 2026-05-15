# Cross-Cutting Compliance Audit

This audit uses only:
- `docs/redesign/IOS_SURFACE_INVENTORY.json`
- `docs/redesign/IOS_MIGRATION_PLAN.md`
- `docs/redesign/design-briefs/*`

Status rule for this audit:
- `compliant` = the provided sources explicitly design the state
- `needs-design` = the state is missing in the provided sources, or the canonical design appears to exist only in Claude Design and cannot be verified from the repo export
- `not-applicable` = the provided sources explicitly indicate the principle does not apply, or the behavior falls to standard iOS/system treatment rather than a BetterAt-designed state

Source discrepancy:
- `IOS_SURFACE_INVENTORY.json` currently lists 12 surfaces, not 13.
- A 13th documented iOS surface exists in the provided briefs: `Profile iOS`.
- This audit therefore covers 13 documented surfaces total: the 12 inventory surfaces plus `Profile iOS` from `docs/redesign/design-briefs/profile-ios.md`.

## Summary Table

| Surface | Loading-state narration | Error-state principle | Evidence note |
|---|---|---|---|
| Race Prep iOS | needs-design | needs-design | Migration plan explicitly says loading applies here; no exported surface brief in repo. |
| On the Water iOS | needs-design | needs-design | No exported surface brief in repo; design canonical in Claude Design. |
| Debrief iOS | needs-design | needs-design | Migration plan explicitly says loading applies here; no exported surface brief in repo. |
| Playbook home iOS | needs-design | needs-design | No exported surface brief in repo; design canonical in Claude Design. |
| Concept detail iOS | needs-design | needs-design | Migration plan explicitly says loading applies here; no exported surface brief in repo. |
| Reflect home iOS | needs-design | needs-design | No exported surface brief in repo; design canonical in Claude Design. |
| Discover Paths iOS | needs-design | needs-design | No exported surface brief in repo; design canonical in Claude Design. |
| Get Inspired iOS | compliant | compliant | Running-state cutover shipped canonical narration and extraction-failure error fallback. |
| Trophy of Becoming iOS | needs-design | needs-design | Fresh-build synthesis surface noted in migration plan; no exported surface brief in repo. |
| Step transition hinge iOS | needs-design | needs-design | No exported surface brief in repo; design canonical in Claude Design. |
| Auth Welcome iOS | not-applicable | not-applicable | No AI work is documented; sign-in failure is a system iOS pattern, not BetterAt-specific. |
| Competency Assessment iOS | needs-design | needs-design | Migration plan explicitly says loading applies here; no exported surface brief in repo. |
| Profile iOS | not-applicable | needs-design | Profile brief documents a utility/settings surface with no AI pipeline, but no error treatments. |

## Loading-State Narration

### Compliant

- **Get Inspired iOS** — compliant. The shipped running-state cutover is the canonical Principle #1 implementation: plain-language loading narration, no spinner-only wait, no error-code language, and Stop cancels the in-flight extraction.

### Needs-Design

- **Race Prep iOS** — loading-state narration missing for weather fetch, prior-debrief query, and the “From your playbook” concept-suggestion work. `IOS_MIGRATION_PLAN.md` explicitly lists those flows as places where loading narration applies. No exported Race Prep brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **On the Water iOS** — exported loading-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Debrief iOS** — loading-state narration missing for the AI clustering path behind Debrief’s “A pattern in your captures” offer. `IOS_MIGRATION_PLAN.md` explicitly lists this flow. No exported Debrief brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **Playbook home iOS** — exported loading-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Concept detail iOS** — loading-state narration missing for the resynthesize action. `IOS_MIGRATION_PLAN.md` explicitly lists this flow. No exported Concept detail brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **Reflect home iOS** — exported loading-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Discover Paths iOS** — exported loading-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Trophy of Becoming iOS** — loading-state narration missing for the path-completion synthesis flow. `IOS_MIGRATION_PLAN.md` identifies Trophy of Becoming as a fresh-build synthesis artifact. No exported Trophy brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **Step transition hinge iOS** — exported loading-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Competency Assessment iOS** — loading-state narration missing for AI capture surfacing. `IOS_MIGRATION_PLAN.md` explicitly lists this flow. No exported Competency Assessment brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.

### Not Applicable

- **Auth Welcome iOS** — no AI work, narrated pipeline, or documented multi-step processing appears in the provided sources. Sign-in chrome follows system iOS auth conventions rather than a BetterAt-specific narrated state.
- **Profile iOS** — the brief describes a calm, utility-first account/settings surface with grouped rows, preferences, subscription, and account actions. No AI work or multi-step processing is documented, so loading-state narration is not applicable on the evidence provided.

## Error-State Principle

### Compliant

- **Get Inspired iOS** — compliant for running-state extraction failures. Non-abort failures render `IOSRegisterErrorState`; abort is cancellation, not an error. Non-running Get Inspired states remain out of scope for this cutover.

### Needs-Design

- **Race Prep iOS** — error-state suite is incomplete in the provided sources. `IOS_MIGRATION_PLAN.md` gives a principle-level weather-error example, but the surface also carries prior-debrief and concept-suggestion failures with no exported surface brief covering the full error treatment. Design canonical in Claude Design — audit incomplete pending export.
- **On the Water iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Debrief iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Playbook home iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Concept detail iOS** — error-state suite is incomplete in the provided sources. `IOS_MIGRATION_PLAN.md` gives a principle-level missing-concept example, but it does not amount to an exported surface brief for the full set of Concept detail failures. Design canonical in Claude Design — audit incomplete pending export.
- **Reflect home iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Discover Paths iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Trophy of Becoming iOS** — error-state treatment is missing for a synthesis surface that can fail during generation or data assembly. No exported Trophy brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **Step transition hinge iOS** — exported error-state treatment is missing from the provided sources. No `design-briefs` export exists for this surface; design canonical in Claude Design — audit incomplete pending export.
- **Competency Assessment iOS** — error-state treatment is missing for faculty-facing save/load/API failure paths and any AI capture-surfacing failures. No exported Competency Assessment brief is present in `docs/redesign/design-briefs`; design canonical in Claude Design — audit incomplete pending export.
- **Profile iOS** — error states are missing for inline-edit failures, account data save failures, subscription-state failures, and account-action failures such as sign-out/support flows. The brief defines the sections and density, but no plain-language error states or next actions.

### Not Applicable

- **Auth Welcome iOS** — sign-in failure is a system iOS/auth-provider pattern rather than a BetterAt-specific error state in the provided design corpus, so this audit treats the cross-cutting BetterAt error-state principle as not applicable here.
