# Get Inspired Commit 4 Spec: Migration Plan Update

## Scope

Documentation-only follow-up after the Get Inspired render switch and abort semantics land.

## Files

- `docs/redesign/IOS_MIGRATION_PLAN.md`
- `docs/redesign/IOS_SURFACE_INVENTORY.json`
- `docs/redesign/CROSS_CUTTING_COMPLIANCE_AUDIT.md`
- `docs/redesign/snippets/get-inspired-cutover-commits.md` if commit hashes changed during execution

## IOS_MIGRATION_PLAN.md Updates

In `## Cutover readiness`, update Get Inspired:

```md
| Get Inspired running state | no | no | no | shipped | Shipped in `<render switch commit>`; single Playbook-home CTA, cancel-on-abort semantics, canonical error state for non-abort failures. |
```

In `## Staged cutover plan index`, update the Get Inspired row:

```md
| Get Inspired iOS running state | `7c2dfeeb` | `docs/redesign/GET_INSPIRED_CUTOVER_PLAN.md` | Shipped in `<render switch commit>`; follow-ups are real progress events and the non-running Get Inspired states. |
```

In `## Cutover execution order (revised)`, remove Get Inspired from the future execution list or mark it shipped:

```md
1. Concept detail iOS — execute the 3 pre-cutover specs, then ship the render switch; Get Inspired is no longer ahead of it because the running-state cutover has shipped.
```

Add follow-ups:

- Real progress events from the edge function so narration can become event-backed instead of timer-backed.
- Other Get Inspired states: empty, filled, result/plan-ready, review, and success.
- Error-state refinements beyond the extraction failure path if the full modal later gets redesigned.

## IOS_SURFACE_INVENTORY.json Updates

Update the `get-inspired-ios` entry:

```json
{
  "id": "get-inspired-ios",
  "canonical_status": "shipped",
  "shipped_in_commit": "<render switch commit>",
  "shipped_on": "2026-05-15",
  "notes": "Running-state scope only. Empty, filled, result, review, and success states remain existing implementation or future iOS-register passes."
}
```

Keep:

```json
"build_only_commit": "7c2dfeeb",
"feature_flag": "GET_INSPIRED_IOS_REGISTER",
"preview_route": "/get-inspired-ios-running"
```

## CROSS_CUTTING_COMPLIANCE_AUDIT.md Updates

Update Get Inspired loading-state narration to compliant:

```md
- **Get Inspired iOS** — compliant. The shipped running-state cutover is the canonical Principle #1 implementation: plain-language loading narration, no spinner-only wait, no error-code language, and Stop cancels the in-flight extraction.
```

Update error-state principle to compliant for extraction failures:

```md
- **Get Inspired iOS** — compliant for running-state extraction failures. Non-abort failures render `IOSRegisterErrorState`; abort is cancellation, not an error.
```

If the audit tracks non-running states separately, keep those out of scope rather than overstating the cutover.

## Verification

- Inventory JSON validates with `node -e "JSON.parse(require('fs').readFileSync('docs/redesign/IOS_SURFACE_INVENTORY.json','utf8'))"`.
- Migration plan no longer says Get Inspired is ready-to-execute; it is shipped or removed from pending execution order.
- Cross-cutting audit identifies Get Inspired as the canonical shipped loading-state reference.

## Commit Message

```text
docs(redesign): mark Get Inspired running-state cutover shipped

Update the migration artifacts after the Get Inspired running-state cutover.

- mark get-inspired-ios shipped for the running-state scope in the iOS
  surface inventory
- record the render-switch commit and follow-ups in IOS_MIGRATION_PLAN.md
- update the cross-cutting compliance audit so Get Inspired is the shipped
  canonical loading-state narration reference
- keep non-running Get Inspired states explicitly out of scope

The cutover ships user-visible narration and cancellation semantics; full
Get Inspired modal redesign remains a future pass.
```
