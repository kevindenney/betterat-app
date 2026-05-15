# A.10 Language Audit — Practice Engine Label Drift

**Date:** 2026-05-16  
**Scope:** `docs/redesign/` and `docs/redesign/specs/` references to "Practice tab", tab labels, and visible "Practice" nav text after Phase A.10.

## Baseline

Phase A.10 resolved that the first learner tab's **identity** is the universal Practice engine, but the visible **label** is interest-specific:

- Sail Racing: `Race`
- Nursing: `Practice` or `Shift`, depending on vocabulary configuration
- Other interests: vocabulary-resolved by `lib/navigation-config.ts` / `getEventTabTitle`

References to "Practice tab" as product identity are fine. References that imply a universal visible `Practice` label are ambiguous or wrong.

## Summary

- Ambiguous references found: 3
- Wrong references found: 16
- Resolution status: all 19 audit-flagged references resolved on 2026-05-16.
- Shipped-spec drift risk after fixes: low. `PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md` now includes an explicit A.10 label guard.

## Ambiguous References

| File | Original line | Offending text | Why ambiguous | Resolution |
|---|---:|---|---|---|
| `docs/redesign/FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | 57 | `- Bottom tab bar stays the same` | In the interest-switcher flow, the tab destinations stay the same, but the first tab's visible label may change when switching from Sail Racing to Nursing. | Resolved in `aed61138`: copy now says bottom tab destinations stay stable while the first visible label re-resolves through active-interest vocabulary. |
| `docs/redesign/ios-register/four-small-surfaces-canonical.html` | 1572 | `<span class="back"><i class="ti ti-chevron-left"></i>Practice</span>` | This is a visible back label from a Sail Racing step-detail/share context. It is unclear whether back labels should use canonical route identity (`Practice`) or interest vocabulary (`Race`). | Resolved in `55df641d`: Sail Racing step-detail back label now reads `Race`. |
| `docs/redesign/ios-register/nursing-interest-catalog-canonical.html` | 1869 | `<div class="tab"><i class="ti ti-anchor"></i><span>Practice</span></div>` | Nursing may resolve to `Practice` or `Shift` depending on vocabulary config. This is plausible but should be confirmed against the intended Nursing vocabulary. | Resolved in `a20e782a`: element is annotated with `data-tab-identity="practice-engine"` and `data-visible-label-source="nursing-vocabulary"`. |

## Wrong References

These are visual canonical bottom-tab labels that show active interest context as **Sail Racing** while rendering the first bottom tab as visible `Practice`. Under A.10, Sail Racing should render the visible label `Race`.

| File | Original line(s) | Offending text | Resolution |
|---|---:|---|---|
| `docs/redesign/ios-register/practice-timeline-canonical.html` | 1042, 1175, 1286, 1390 | `<span>Practice</span>` | Resolved in `95dd7595`: all four Sail Racing bottom-tab labels now read `Race`; design notes clarify Practice as tab identity. |
| `docs/redesign/ios-register/add-step-flow-canonical.html` | 955, 1061 | `<span>Practice</span>` / bottom-tab button with `Practice` | Resolved in `f0127b66`: both Sail Racing bottom-tab labels now read `Race`. |
| `docs/redesign/ios-register/plan-tab-three-states-canonical.html` | 837, 979, 1153 | `<span>Practice</span>` | Resolved in `6d477906`: all three Sail Racing bottom-tab labels now read `Race`. |
| `docs/redesign/ios-register/zoomed-out-view-canonical.html` | 883, 1066, 1167 | bottom-tab button with `Practice` | Resolved in `bacf9db3`: all three Sail Racing bottom-tab labels now read `Race`. |
| `docs/redesign/ios-register/social-timeline-layer-canonical.html` | 1047, 1150 | bottom-tab button with `Practice` | Resolved in `b586f1bc`: both Sail Racing bottom-tab labels now read `Race`. |
| `docs/redesign/ios-register/four-small-surfaces-canonical.html` | 1388, 1502 | bottom-tab button with `Practice` | Resolved in `55df641d`: both Sail Racing bottom-tab labels now read `Race`. |

## Shipped Spec Impact

- `PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md`: no direct label drift found; it discusses the Plan tab interior and route, not bottom-tab visible copy.
- `PHASE_B6_ADD_STEP_FAB_SPEC.md`: spec text remains fine; its visual canonical (`add-step-flow-canonical.html`) was corrected in `f0127b66`. Claude Code already executed B.6 without touching tab labels, so residual drift risk is low.
- `PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md`: resolved in two places. Its visual canonical (`zoomed-out-view-canonical.html`) was corrected in `bacf9db3`, and the spec now includes an A.10 label guard in `3ce11a67` so Claude Code does not hardcode `Practice` while implementing broader shell visuals.
- `PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md`: no A.10 label drift found.
- `PHASE_G1_BLUEPRINT_CREATOR_DASHBOARD_MAIN_SPEC.md`: no A.10 label drift found in the spec. The creator dashboard visual canonical has `Practice` sidebar items, but those are creator/admin navigation labels rather than the learner bottom tab and are not flagged here.

## Recommendation

Audit closed. For future specs that copy bottom-tab chrome from an HTML canonical, preserve the A.10 model: Practice is the first-tab identity, while the visible label comes from active-interest vocabulary.
