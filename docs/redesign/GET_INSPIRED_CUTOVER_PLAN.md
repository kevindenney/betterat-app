# Get Inspired iOS Running-State Cutover Checklist

## Pre-cutover gates

- [ ] `app/get-inspired-ios-running.tsx` exists and is visually verified in simulator at `/get-inspired-ios-running`
- [ ] `FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER` exists in `lib/featureFlags.ts`
- [ ] `LoadingNarration` is exported from `components/ios-register/index.ts`
- [ ] `IOSRegisterErrorState` is exported from `components/ios-register/index.ts`; canonical error implementation shipped in commit `5c3ab6a4`
- [ ] The existing Get Inspired modal flow is verified in `components/inspiration/InspirationWizard.tsx`
- [ ] The iOS-register Playbook entry point is present:
  `app/(tabs)/playbook/index.tsx` owns `InspirationWizard` state when `PLAYBOOK_IOS_REGISTER=true`, and passes `onOpenInspiration` into `app/playbook-ios.tsx`
- [ ] `extractInspiration(...)` accepts an `AbortSignal`, and `InspirationCaptureStep` aborts the in-flight extraction when the user taps Stop or dismisses the running state
- [ ] The actual analyze/build-plan running step is available in `InspirationWizard` or its child capture flow; do not wire the visual state until there is a real >2s pipeline stage to narrate
- [ ] Current repo-state checks remain clean:
  `npm run typecheck` and targeted ESLint on `app/get-inspired-ios-running.tsx`, `components/ios-register/LoadingNarration.tsx`, `components/inspiration/InspirationWizard.tsx`, and any touched child step file

## Cutover sequence

- [ ] Keep the cutover single-surface:
  one flag, one running-state render switch, no pairing with Reflect or Discover work
- [ ] Gate only the running state behind `FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER`
- [ ] Flag ON:
  when the submitted inspiration source is actively being analyzed or converted into a plan, render the iOS-register running state using `LoadingNarration`
- [ ] Flag OFF:
  keep the existing modal behavior unchanged
- [ ] Do not replace the empty, filled, review-interest, review-blueprint, or success states in this cutover unless the live flow already renders those states today
- [ ] Replace extraction failure alerts with `IOSRegisterErrorState` only for Get Inspired running-state failures; cancellation is not an error state
- [ ] Keep the preview route `/get-inspired-ios-running` intact for regression review

## Surface role

Get Inspired running state is the canonical implementation of cross-cutting Principle #1: loading-state narration. It uses plain-language staged narration, no anonymous spinner, no error code language, and the OpenAI ChatGPT plan-ready flow as its reference pattern.

Future surfaces with AI work, network fetches, or multi-step processing over roughly two seconds should reference commit `7c2dfeeb` as the canonical implementation baseline.

## Pipeline hook (resolved)

Long-running extraction call:

- File: `components/inspiration/InspirationCaptureStep.tsx`
- Component: `InspirationCaptureStep`
- Function: `handleAnalyze`
- Call: `extractInspiration(...)` from `services/InspirationService.ts`, which invokes the Supabase edge function `inspiration-extract`

Existing loading state being replaced:

- A button-local `ActivityIndicator` plus rotating text messages: `Reading content...`, `Extracting skills...`, `Building your plan...`.
- The messages are timer-driven every 3 seconds and are not backed by progress events from the edge function.

Mount chain:

- `components/playbook/PlaybookHome.tsx` mounts `InspirationWizard`.
- `InspirationWizard` renders `InspirationCaptureStep` for the capture step.
- `QuickCaptureModal` can also hand off to the same `InspirationWizard` through `PlaybookHome`'s `onOpenInspiration` callback.

Result state that continues unchanged:

- On extraction success, `InspirationWizard` stores the returned `InspirationExtraction` and advances to `InspirationInterestStep`.
- After the user reviews the interest and blueprint, `InspirationWizard` calls `activateInspiration(...)`; the success state remains `InspirationSuccessStep`.

Flag scope:

- `GET_INSPIRED_IOS_REGISTER` should gate only the extraction loading state inside `InspirationCaptureStep`.
- It should not gate the review-interest, review-blueprint, activation, or success states.

Important routing caveat:

- Current default Playbook tab rendering is gated by `PLAYBOOK_IOS_REGISTER` and uses `app/playbook-ios.tsx`; grep found no Get Inspired action in that iOS-register Playbook route. The existing live Get Inspired wizard is mounted from legacy `PlaybookHome`. A cutover that expects Get Inspired inside the default iOS Playbook surface must first decide where the modal entry point reappears.

## Decision 1: iOS Playbook entry-point (resolved)

Choice: single hero CTA on the iOS-register Playbook home.

Get Inspired should be visible on the Playbook home, but not scattered across every sparse section. The iOS Playbook cutover intentionally removed the legacy toolbar/control-panel density; one compact card preserves that simplification while giving users an obvious way to start a playbook from an outside source. Empty shelves can still explain that concepts appear from reflections, but they should not each become acquisition CTAs.

Implementation path:

- `app/(tabs)/playbook/index.tsx` owns `const [inspirationWizardOpen, setInspirationWizardOpen] = useState(false)` in the `PLAYBOOK_IOS_REGISTER=true` branch.
- It renders `<PlaybookIosPreview embedded onOpenInspiration={() => setInspirationWizardOpen(true)} />` plus `<InspirationWizard visible={inspirationWizardOpen} onClose={() => setInspirationWizardOpen(false)} />`.
- `app/playbook-ios.tsx` extends `Props` with `onOpenInspiration?: () => void`.
- `PlaybookIosPreview` renders one white iOS-register card between the Vision card and "Working on this season": title `Start from something inspiring`, supporting copy `Drop a link, paste text, or describe what you want to learn. BetterAt will turn it into a first plan.`, sparkles glyph, and CTA label `Get Inspired`.
- Tap behavior: call `onOpenInspiration` when provided. No `router.push` happens in the cutover because the production flow is the existing `InspirationWizard` modal, not the visual-only `/get-inspired-ios` preview route. If the modal becomes route-backed later, the reversible substitution is `router.push('/get-inspired-ios' as any)`.

How to reverse: remove the home CTA and move `onOpenInspiration` to another Playbook affordance; the wizard and running-state cutover remain unchanged.

## Decision 2: Stop semantics (resolved)

Choice: pipeline cancels.

Stop means stop. The running preview labels the footer affordance `Stop`, not `Hide`, and the current extraction result has no persistent destination until the user reviews the generated interest and plan. Letting the request complete in the background would require a new job/result model and would make cancellation semantics dishonest for this cutover.

Implementation path:

- Extend `extractInspiration(input, options?: { signal?: AbortSignal })` and pass the signal through the Supabase function request path.
- `InspirationCaptureStep` owns an `AbortController` for the active `handleAnalyze` call.
- Tapping Stop, pressing modal back/close while running, or swiping the sheet down aborts the controller, clears loading narration, and returns the user to the filled capture state with their submitted input preserved.
- A user-initiated abort is not shown as `IOSRegisterErrorState`; it is a successful cancellation and no result persists.
- Network/API/input/system failures that are not user aborts transition to `IOSRegisterErrorState` with `headerTitle="Get Inspired"`, the submitted source preserved in a reference card, and primary action `Try again`.
- If the user closes the whole wizard after stopping, existing `handleClose` reset behavior applies and the typed source is discarded with the modal.

How to reverse: replace the abort path with a persistent inspiration job/result model and make Stop mean "leave this running"; that requires a new data-layer plan before the UX can change.

## Data-layer dependencies (resolved)

No data-layer dependency blocks this cutover.

The chosen Stop semantics cancel the in-flight extraction instead of persisting a background job or result. The running state can render from local input plus local loading state, and the existing result path remains `InspirationExtraction` in memory → `InspirationInterestStep` → `InspirationBlueprintStep` → `InspirationSuccessStep`.

Required implementation work is source-level, not data-layer:

- Add abort-signal plumbing from `InspirationCaptureStep` into `extractInspiration`.
- Render `LoadingNarration` while the request is active.
- Render `IOSRegisterErrorState` for non-abort failures.
- Add the single iOS Playbook home entry point that opens `InspirationWizard`.

## State scope

This cutover ships the running state only.

In scope:

- Submitted source is already captured
- BetterAt is actively reading/analyzing/building
- The user needs narration while work is in progress
- The running-state footer can provide a quiet stop affordance

Out of scope:

- Empty CTA-disabled state
- Filled CTA-enabled state
- Result/plan-ready state
- Full Get Inspired modal redesign

## Verification matrix

- [ ] Playbook tab opens normally with `PLAYBOOK_IOS_REGISTER=true`
- [ ] iOS Playbook home shows exactly one Get Inspired entry point
- [ ] Tapping the iOS Playbook Get Inspired CTA opens `InspirationWizard`
- [ ] Legacy Playbook path still opens `InspirationWizard` with `PLAYBOOK_IOS_REGISTER=false`
- [ ] Get Inspired capture flow reaches the running stage under realistic slow network or mocked long-running analysis
- [ ] Flag ON renders the narrated running state
- [ ] Flag OFF preserves the existing running behavior
- [ ] Narration lines advance on the same timer cadence as the current implementation until the edge function emits real progress events
- [ ] No spinner-only or `Loading...` copy remains in the gated running state
- [ ] Stop aborts extraction and returns to the filled capture state with input preserved
- [ ] Non-abort extraction failures render `IOSRegisterErrorState` with the submitted source preserved
- [ ] `/get-inspired-ios-running` preview route still works independently of canonical flag state

## Rollback triggers

- [ ] Roll back immediately if the Get Inspired modal cannot complete plan creation
- [ ] Roll back immediately if users can get trapped in running state after the pipeline finishes or fails
- [ ] Roll back immediately if Stop/Cancel behavior loses typed or pasted source content unexpectedly
- [ ] Roll back immediately if Stop appears to cancel but the flow still advances to review-interest later
- [ ] Roll back immediately if the new running state appears for sub-600ms work and creates visual flicker

## Post-cutover documentation updates

- [ ] Update `docs/redesign/IOS_MIGRATION_PLAN.md` to mark Get Inspired running-state cutover shipped and reference the render-switch commit
- [ ] Update `docs/redesign/IOS_SURFACE_INVENTORY.json` so `get-inspired-ios` flips from `canonical_status: "staged"` to `canonical_status: "shipped"` only for the running-state scope
- [ ] Update `docs/redesign/CROSS_CUTTING_COMPLIANCE_AUDIT.md` if the audit still marks Get Inspired loading-state narration as incomplete
- [ ] Record the shipped render-switch commit as the new canonical loading-state reference alongside `7c2dfeeb`

## Open questions for human review

No open product questions blocking the cutover.

## Ship-readiness verdict

Ready to execute. The remaining work is source implementation across the four executable specs below: add the single iOS Playbook entry point, wire the running-state render switch, add abort semantics, and update migration docs once shipped.

## Executable specs

Execute in this order:

1. `docs/redesign/specs/GET_INSPIRED_COMMIT_1_PLAYBOOK_CTA.md` — add the single iOS Playbook home CTA and modal entry point.
2. `docs/redesign/specs/GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md` — gate the extraction wait state behind `GET_INSPIRED_IOS_REGISTER`.
3. `docs/redesign/specs/GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md` — thread `AbortSignal`, make Stop cancel, and render `IOSRegisterErrorState` for non-abort failures.
4. `docs/redesign/specs/GET_INSPIRED_COMMIT_4_MIGRATION_PLAN_UPDATE.md` — mark the running-state cutover shipped and capture follow-ups.
