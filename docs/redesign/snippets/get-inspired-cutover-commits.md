# Get Inspired Cutover Commit Templates

## Commit 1 — iOS Playbook CTA

```text
feat(redesign): add Get Inspired CTA to iOS Playbook home

Add the single iOS-register Playbook home entry point for Get Inspired.

- render a compact hero CTA between the Vision card and concept shelf
- keep the CTA inline in app/playbook-ios.tsx because it is not reused yet
- let app/(tabs)/playbook/index.tsx own InspirationWizard modal state in
  the PLAYBOOK_IOS_REGISTER branch
- tapping the CTA opens the existing wizard; no route-backed modal migration
  happens in this commit

This prepares the Get Inspired running-state cutover without changing the
pipeline behavior.
```

## Commit 2 — Kit extraction + running-state render switch

```text
feat(redesign): gate Get Inspired running state behind iOS register flag

Extract the Get Inspired running-state UI into an iOS-register kit component
and gate the live modal's long-running analyze/build-plan state behind
FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER.

- flag ON: the running state renders the iOS-register LoadingNarration
  treatment through the kit component extracted from the preview route
- flag OFF: the existing Get Inspired modal behavior remains unchanged
- scope is intentionally limited to the running state; empty, filled, result,
  review, and success states stay on their current paths
- /get-inspired-ios-running remains available as the direct preview route

Abort and canonical error-state wiring land in the follow-up cutover commit.
```

## Commit 3 — Abort semantics + canonical errors

```text
feat(redesign): cancel Get Inspired extraction on user abort

Add AbortSignal plumbing for the Get Inspired extraction pipeline.

- InspirationCaptureStep owns an AbortController for the active extraction
- Stop, modal close, and component unmount abort the in-flight request
- extractInspiration accepts an optional AbortSignal and passes it to the
  Supabase edge-function invocation
- user abort is treated as cancellation, not an error
- non-abort extraction failures render the canonical IOSRegisterErrorState
  variants for network, input, and system failures

The result path stays in-memory and unchanged when extraction completes.

Revert is a single env flag flip if production regressions surface.
```

## Commit 4 — Migration plan updates

```text
docs(redesign): mark Get Inspired running-state cutover shipped

Update migration artifacts after the Get Inspired running-state cutover.

- mark get-inspired-ios staged visual work as shipped for the running-state
  scope in docs/redesign/IOS_SURFACE_INVENTORY.json
- update docs/redesign/IOS_MIGRATION_PLAN.md with CTA 1e0c331b, render
  switch 9580a317, abort semantics 95c9a4aa, and
  planned follow-ups for real progress events / non-running Get Inspired states
- update docs/redesign/CROSS_CUTTING_COMPLIANCE_AUDIT.md so Get Inspired is
  the canonical shipped reference for loading-state narration
- record that Stop semantics cancel the extraction request and require no
  background job/result data layer

The cutover ships the user-visible narration treatment. It does not imply a
full Get Inspired modal redesign.
```
