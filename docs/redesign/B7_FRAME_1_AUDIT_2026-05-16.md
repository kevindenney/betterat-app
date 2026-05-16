# Phase B.7 Frame 1 Audit — Do Tab Interior

Date: 2026-05-16

Scope:

- Spec: `docs/redesign/specs/PHASE_B7_DO_TAB_INTERIOR_SPEC.md`
- Canonical: `docs/redesign/ios-register/do-tab-interior-canonical.html`, Frame 1 "Pre-activity"
- Implementation commits: `075da509`, `6069fe4d`
- Implementation files: `components/step/do-tab/*`, tests in `components/step/do-tab/__tests__/`
- Audit was read-only except for this document.

## 1. Canonical Frame 1 Render Match

- PASS — Core Frame 1 body content exists in code: `Start capturing`, `Voice, photo, or quick notes — capture as you go.`, `Voice note`, `Photo or video`, `Quick note`, `Captures will appear here as you go.`, and `Auto-summarize my Plan as a starting frame`.

- PASS — Canonical ordering is preserved in the body: start card first, three capture affordances in voice/photo/quick-note order, empty-line helper, then Plan starting-frame row.

- MINOR — The implementation is intentionally only the tab interior. Canonical phone chrome, app top header, step header, phase tabs, side peeks, bottom tab bar, and home indicator are not present in `DoTabInterior`. This is acceptable only if existing parent card/chrome owns those surfaces.

- MAJOR — Frame 1 is not actually reachable from the production Do tab in these commits. `lib/featureFlags.ts` defines `PRACTICE_DO_TAB_IOS_REGISTER`, but `components/step/ActTab.tsx` still renders `StepDrawContent` unconditionally and does not import or branch to `DoTabInterior`.

- MAJOR — The canonical start card is visually centered and elevated; implementation text is left-aligned by default. `DoStartCard` sets no `textAlign: 'center'` on title or subtitle, while the canonical centers both.

- MAJOR — The canonical capture buttons are white cards with borders and a distinct emphasized primary mic button. Implementation uses `IOS_COLORS.systemGray6`, no border, and the `emphasized` prop only changes icon size; the mic circle remains 44x44 instead of the canonical 52x52.

- MINOR — The canonical start card uses a white-to-offwhite gradient, 18px radius, hairline border, and subtle shadow. Implementation uses a flat `systemBackground`, radius 14, 1px border, and no shadow. This is likely acceptable for RN parity if Kevin is not expecting pixel fidelity, but it is not "exact."

- MAJOR — The canonical Plan starting-frame row is blue-tinted with a blue border and blue glyph. Implementation keeps the glyph blue but renders the row on `systemGray6` with gray border. This weakens the intended "AI starting frame" affordance.

- MINOR — Canonical row subcopy says `Pull What · How · Why into Do as opening context`; implementation matches text and italicizes `What · How · Why`. Good copy match, weaker visual match.

- MINOR — Canonical camera icon is a camera and quick-note icon is a pencil. Implementation uses Ionicons `camera` and `create`, close enough visually but not exact to Tabler `ti-camera` / `ti-pencil`.

- MINOR — Code has no visible extra body elements beyond the canonical Frame 1 body, except an empty `<View />` placeholder for non-pre states. That placeholder does not affect Frame 1.

## 2. Spec Frame 1 Match

- PASS — Required Frame 1 copy is present:
  - `Start capturing`
  - `Voice, photo, or quick notes — capture as you go.`
  - `Captures will appear here as you go.`

- PASS — Required three large affordances are present:
  - `Voice note`
  - `Photo or video`
  - `Quick note`

- PASS — Required bottom row is present:
  - `Auto-summarize my Plan as a starting frame`
  - Subcopy pulls `What · How · Why` into Do.

- PASS — `DoTabInterior` is presentational. It accepts state, plan data, capture items, callbacks, and footer. It does not call Supabase, ImagePicker, or persistence code.

- PASS — The state derivation follows the spec's intended order: `activityEndedAt` wins, then `status === 'in_progress'` or `act.started_at`, then existing capture content, otherwise `pre_activity`.

- MINOR — The spec's selector API included `hasAnyCapture` as an input. Implementation computes capture presence internally via `hasAnyDoCapture(act)`. Behavior matches, but the API differs from the spec text.

- MAJOR — Spec says Frame 1 photo/video should reuse existing `handlePickMedia`, quick note should open the existing typed observation path, and voice should route to existing Train chat or be disabled/focused. The Frame 1 component exposes callbacks only; no controller wiring exists yet to prove these handlers are connected.

- MAJOR — Spec verification says "Flag on, no `metadata.act.started_at` and no captures: the start card is the only primary content." Because `ActTab` is not wired to the flag, this cannot currently be true in the app. The component can render in isolation, but the flagged app path does not exist.

- MAJOR — Spec verification says "Flag off: existing `ActTab` / `StepDrawContent` renders unchanged." That is true only because the new UI is not wired at all. There is no tested flag-on/flag-off branch in `ActTab`.

- MINOR — Read-only behavior is partially handled: capture affordances and Plan row can disable. There is no visible read-only copy explaining why actions are unavailable; the spec did not require that, but it may be useful.

- MINOR — `PlanStartingFrameRow` disables itself when the plan has no `what_will_you_do`, `why_reasoning`, or `how_sub_steps` content. The canonical does not show a disabled variant. This is reasonable product behavior but not depicted in Frame 1.

## 3. Unit Test Coverage

- PASS — There are 34 `it(...)` test cases under `components/step/do-tab/__tests__/`, matching the claimed count.

- PASS — Strong test: `doState.test.ts` verifies `post_activity` overrides live signals. This catches a real state-machine regression that would matter for Frames 3/4.

- PASS — Strong test: `doCaptureModel.test.ts` verifies reverse chronological ordering. This is not Frame 1 UI, but it directly protects the Frame 2 contract from the spec and proves the model is being staged usefully.

- PASS — Strong test: `DoTabInterior.test.tsx` verifies Frame 1 components mount only for `pre_activity` and not for `live` or `post_activity`. This protects the basic state gate inside the presentational component.

- MINOR — Weak test: `DoTabInterior.contract.test.ts` reads source files as strings and asserts copy exists. It would pass if the strings were present in dead code, comments, unreachable branches, or visually hidden elements.

- MINOR — Weak test: `DoTabInterior.contract.test.ts` checks label order with `indexOf` in source text. It does not prove rendered order, layout order, or accessibility traversal order.

- MINOR — Weak test: `PlanStartingFrameRow` predicate tests validate whitespace/content detection, but not that disabled state blocks `onPress`, exposes correct accessibility state, or preserves the canonical row when content exists.

- MAJOR — The tests do not cover the most important Frame 1 contract: pressing `Photo or video`, `Quick note`, or `Voice note` from the real Do tab reaches existing capture handlers. That gap exists because the parent controller is not wired.

- MAJOR — The tests do not cover flag gating at the app integration boundary. There is no test that `FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER=false` keeps `ActTab` on `StepDrawContent`, or that `true` renders `DoTabInterior`.

- MINOR — There is no visual/style regression coverage. Tests would not catch the current differences from canonical centering, blue-tinted Plan row, button borders, or mic emphasis.

## 4. Code Quality Red Flags

- PASS — The new implementation uses existing design tokens (`IOS_COLORS`, `IOS_SPACING`) rather than hardcoding most colors and spacing.

- PASS — Capture buttons and Plan row include `accessibilityRole`, `accessibilityLabel`, and `accessibilityState`.

- MINOR — `emphasized` on `CaptureButton` is underpowered. It changes icon glyph size but not the icon container size, so the primary mic affordance does not materially match the canonical.

- MINOR — Several pixel values are inline local constants (`44`, `22`, `14`, `12`, etc.). This is normal in RN styling, but if this surface is meant to become a design-system reference, these should eventually map to named component tokens.

- MINOR — `DoTabInteriorProps` already includes `captures`, `summaryText`, `evidenceSelections`, `onTagCapture`, `onMoveToReflect`, and `onRefineSummary`, but Frame 1 ignores them. This is forward-looking, not harmful, but it can hide unused-prop drift until Frames 2-4 land.

- MINOR — `normalizeDoCaptures` does not include legacy `metadata.act.notes` even though `DoCaptureSource` includes `notes_legacy` and `hasAnyDoCapture` treats notes as capture content. That can create a future mismatch: state becomes `live`, but normalized stream is empty.

- MINOR — `normalizeDoCaptures` skips observations/media/links without IDs. This is safe for React list keys, but if legacy data lacks IDs it will disappear from the canonical stream.

- MINOR — `PlanStartingFrameRow` imports `View` and uses it, no unused import issue visible. `DoTabInterior` imports and renders an empty `View` placeholder for deferred frames; not a functional problem, but it is low signal.

- MINOR — Hardcoded user-facing strings are directly inside components. That matches current repo style for this redesign work, but there is no localization/vocabulary layer if BetterAt later localizes the practice loop.

## 5. Forward Compatibility For Frames 2-4

- PASS — `DoInteriorState` is small and aligned with the spec's three time states: `pre_activity`, `live`, `post_activity`.

- PASS — `DoCaptureItem` shape matches the spec closely and is suitable for Frame 2 stream rows and Frame 4 evidence marking.

- PASS — `sortCapturesNewestFirst` and source normalization are useful building blocks for Frame 2 and Frame 3 compressed lists.

- PASS — `DoTabInterior` already has props for captures, summary, evidence selections, tag capture, move to Reflect, and refine summary. This makes it easier to add presentational Frames 2-4 without changing the public component shape much.

- MAJOR — The current state machine cannot represent the spec's Frame 4 modal/sheet state. It will need additional local UI state outside `DoInteriorState` or a richer discriminated model such as `evidence_marking`.

- MAJOR — The current state machine uses `'live'` rather than a more explicit `'live_capturing'`. That is workable, but if Kevin wants states named exactly as the later orchestration prompt suggests (`live_capturing`, `post_activity`, `evidence_marking`), a rename/refactor will be needed.

- MAJOR — The lack of `ActTab` integration means Frames 2-4 still need the hard part: adapting existing `StepDrawContent` read/write handlers into a controller without duplicating storage/upload logic.

- MINOR — `activityEndedAt` is an input but no approved source exists yet. This preserves the spec uncertainty, but Frame 3 cannot be completed until Kevin decides whether Do completion stamps `metadata.act.ended_at`, `timeline_steps.ends_at`, or only switches tabs.

- MINOR — Capability and flag fields are initialized empty/false. That is safe for Frame 1 and Frame 2 rendering, but Frame 4 will need a metadata persistence decision to avoid local-only evidence selections.

- MINOR — Because `hasAnyDoCapture` can return true for legacy notes that are not normalized into capture items, Frame 2 may need either `notes_legacy` normalization or a special fallback empty-live state.

## Overall

- MAJOR — As a component-level Frame 1 prototype, the implementation covers the canonical content and the spec's basic presentational shape.

- MAJOR — As an app-level Frame 1 implementation, it is incomplete: the flag exists but is not wired into `ActTab`, the real capture handlers are not connected, and the tests do not protect flag gating or handler handoff.

- MAJOR — Visual fidelity is directionally correct but not exact. The main visible gaps are centered typography, capture button card treatment, primary mic emphasis, and the blue-tinted Plan starting-frame row.
