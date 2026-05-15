# Trophy of Becoming First-Ship Commit Templates

## Commit 1 — First production mount for Trophy of Becoming

```text
feat(redesign): ship Trophy of Becoming iOS surface behind flag

Expose the first production Trophy of Becoming entry point behind
FEATURE_FLAGS.TROPHY_IOS_REGISTER.

- flag ON: the chosen path-completion entry point renders TrophyScreen with
  data-layer-selected variant, content, and series context
- flag OFF: the new Trophy entry point is hidden or omitted
- variant routing maps first, canonical, mid-career, named-absence, and empty
  states from trophy data
- preview controls stay confined to /trophy-ios review mode and do not leak
  into the canonical mount

Revert is a single env flag flip if production regressions surface.
```

## Commit 2 — Migration plan updates

```text
docs(redesign): mark Trophy of Becoming cutover shipped

Update migration artifacts after the Trophy of Becoming first production mount lands.

- mark trophy-of-becoming-ios shipped in docs/redesign/IOS_SURFACE_INVENTORY.json
- update docs/redesign/IOS_MIGRATION_PLAN.md with the render-switch commit
  and any remaining path-completion synthesis follow-ups
- record the earned-register exception decision as standard density confirmed:
  no new variant-specific weight-up beyond the existing italic user-voice title
- capture any missing synthesis-loading or synthesis-error states as follow-up
  if they are not part of the shipped visual path

The cutover ships the first production Trophy surface. Data-layer synthesis
must already exist before this commit; synthesis quality and non-rendered
instrumentation can remain follow-up work.
```
