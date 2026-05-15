# Spec Audit — 2026-05-15

## Scope

Audit target: unexecuted cutover/data specs that may still be consumed by Claude Code after the preview-component-in-production defect was found.

Rule enforced: production code must not import route preview wrappers from `app/`. Production mounts should import kit components from `components/ios-register/` or another non-route module, then pass production-shaped props from hooks/adapters. Modifying an `app/` route file is allowed; importing one `app/` route module into another production component is the defect.

## Known Flagged Spec

### `GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md` — flagged

Finding: the spec imports `GetInspiredIosRunningPreview` from `@/app/get-inspired-ios-running` into `components/inspiration/InspirationCaptureStep.tsx`.

Why this is a defect: it repeats the same structural pattern as the original Reflect data-wiring specs. Even if this specific preview component has production-shaped props, production code should not mount an `app/` preview route component.

Required revision before execution: extract the reusable UI into a kit component, e.g. `components/ios-register/GetInspiredRunningScreen.tsx`, keep `app/get-inspired-ios-running.tsx` as the preview-route wrapper, and have `InspirationCaptureStep.tsx` import the kit component only.

## Remaining Spec Audit

### `CONCEPT_DETAIL_COMMIT_2_READ_PATH.md` — clean

Result: no production import from `app/` found. The spec adds a hook/read path and references `app/concept-ios/[slug].tsx` as the eventual consumer, but it does not instruct production code to import a route preview wrapper.

### `CONCEPT_DETAIL_COMMIT_3_VARIANT_ROUTING.md` — clean

Result: no production import from `app/` found. The spec patches `app/concept-ios/[slug].tsx`, which is the production route target, and imports routing logic from `@/lib/concept-detail/variantRouting`.

### `GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md` — clean

Result: no production import from `app/` found. The only `app/` reference is `app/error-state-ios.tsx` as a preview-pattern reference for visual behavior; it does not instruct a production import.

### `GET_INSPIRED_COMMIT_4_MIGRATION_PLAN_UPDATE.md` — clean

Result: documentation/status update only. No production import instructions.

### `DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md` — clean

Result: no production import from `app/` found. The spec creates types and mapper functions under non-route modules.

### `DISCOVER_GRAPH_ADAPTER_COMMIT_2_SERVICE_READ_PATH.md` — clean

Result: no production import from `app/` found. The spec imports Supabase services, logger, types, and mapper modules only.

### `DISCOVER_GRAPH_ADAPTER_COMMIT_3_HOOKS_AND_SELECTORS.md` — clean

Result: no production import from `app/` found. The spec creates hooks/selectors over the graph adapter and does not mount UI.

## Summary

- Audited remaining named specs: 7
- Clean among remaining named specs: 7
- Defective among remaining named specs: 0
- Known defective spec outside the remaining-list audit: 1 (`GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md`)

## Recommendation

Revise `GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md` before execution. Future spec-writing prompts for any production render switch should include an explicit check: "verify no production code imports from `app/`; extract preview-route UI into a kit component if needed."
