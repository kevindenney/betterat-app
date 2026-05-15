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

- Ambiguous references: 3
- Wrong references: 16
- Shipped-spec drift risk: low for B.5/B.6/F.1/G.1, medium for C.5 if the executor copies visual canonical tab labels literally.

## Ambiguous References

| File | Line | Offending text | Why ambiguous |
|---|---:|---|---|
| `docs/redesign/FOUR_SURFACES_FAST_SPEC_ADDENDUM.md` | 57 | `- Bottom tab bar stays the same` | In the interest-switcher flow, the tab destinations stay the same, but the first tab's visible label may change when switching from Sail Racing to Nursing. |
| `docs/redesign/ios-register/four-small-surfaces-canonical.html` | 1572 | `<span class="back"><i class="ti ti-chevron-left"></i>Practice</span>` | This is a visible back label from a Sail Racing step-detail/share context. It is unclear whether back labels should use canonical route identity (`Practice`) or interest vocabulary (`Race`). |
| `docs/redesign/ios-register/nursing-interest-catalog-canonical.html` | 1869 | `<div class="tab"><i class="ti ti-anchor"></i><span>Practice</span></div>` | Nursing may resolve to `Practice` or `Shift` depending on vocabulary config. This is plausible but should be confirmed against the intended Nursing vocabulary. |

## Wrong References

These are visual canonical bottom-tab labels that show active interest context as **Sail Racing** while rendering the first bottom tab as visible `Practice`. Under A.10, Sail Racing should render the visible label `Race`.

| File | Line | Offending text |
|---|---:|---|
| `docs/redesign/ios-register/practice-timeline-canonical.html` | 1042 | `<span>Practice</span>` |
| `docs/redesign/ios-register/practice-timeline-canonical.html` | 1175 | `<span>Practice</span>` |
| `docs/redesign/ios-register/practice-timeline-canonical.html` | 1286 | `<span>Practice</span>` |
| `docs/redesign/ios-register/practice-timeline-canonical.html` | 1390 | `<span>Practice</span>` |
| `docs/redesign/ios-register/add-step-flow-canonical.html` | 955 | `<span>Practice</span>` |
| `docs/redesign/ios-register/add-step-flow-canonical.html` | 1061 | `<button class="t on" aria-current="page"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/plan-tab-three-states-canonical.html` | 837 | `<span>Practice</span>` |
| `docs/redesign/ios-register/plan-tab-three-states-canonical.html` | 979 | `<span>Practice</span>` |
| `docs/redesign/ios-register/plan-tab-three-states-canonical.html` | 1153 | `<span>Practice</span>` |
| `docs/redesign/ios-register/zoomed-out-view-canonical.html` | 883 | `<button class="t on"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/zoomed-out-view-canonical.html` | 1066 | `<button class="t on" aria-current="page"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/zoomed-out-view-canonical.html` | 1167 | `<button class="t on" aria-current="page"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/social-timeline-layer-canonical.html` | 1047 | `<button class="t on" aria-current="page"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/social-timeline-layer-canonical.html` | 1150 | `<button class="t on" aria-current="page"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/four-small-surfaces-canonical.html` | 1388 | `<button class="t on"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |
| `docs/redesign/ios-register/four-small-surfaces-canonical.html` | 1502 | `<button class="t on"><i class="ti ti-flag-3-filled"></i><span>Practice</span></button>` |

## Shipped Spec Impact

- `PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md`: no direct label drift found; it discusses the Plan tab interior and route, not bottom-tab visible copy.
- `PHASE_B6_ADD_STEP_FAB_SPEC.md`: spec text is fine, but its visual canonical (`add-step-flow-canonical.html`) contains two wrong Sail Racing bottom-tab labels. Claude Code already executed B.6 without touching tab labels, so execution drift risk is low.
- `PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md`: spec text is fine, but its visual canonical (`zoomed-out-view-canonical.html`) contains three wrong Sail Racing bottom-tab labels. Risk is medium because C.5 may implement broader shell visuals.
- `PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md`: no A.10 label drift found.
- `PHASE_G1_BLUEPRINT_CREATOR_DASHBOARD_MAIN_SPEC.md`: no A.10 label drift found in the spec. The creator dashboard visual canonical has `Practice` sidebar items, but those are creator/admin navigation labels rather than the learner bottom tab and are not flagged here.

## Recommendation

Do not edit implementation specs yet. Before executing any phase that copies bottom-tab chrome from an HTML canonical, add an execution note: for Sail Racing screenshots, render first-tab label as `Race`, not `Practice`; for Nursing, use vocabulary-resolved `Practice`/`Shift`.
