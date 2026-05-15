# iOS Register Migration — Status

## Shipping
- 15/15 surfaces designed (12 original previews + Race Prep cards canonical summary + Race Log iOS + Profile iOS)
- 4/15 surfaces cut over:
  - Playbook home (`ae0334fd`, 2026-05-15)
  - Race Prep cards iOS (`01c6af34`, 2026-05-15)
  - Race Log iOS (staged `316c5486`; cut over inside the Reflect tab `3d8b45dc`, 2026-05-15)
  - Profile iOS (staged `505de4e3`; cut over inside the Reflect tab `3d8b45dc`, 2026-05-15)
- The contemplative `/reflect-ios` root surface (Reflect home) stays parked. The sub-tab cutover above is distinct from the Reflect-home-level cutover.
- 8 register decisions resolved
- 4 architecture decisions resolved
  - #3 summary vs detail is now substantiated by two shipped cutovers: Playbook home and Race Prep cards iOS
  - Decision A density refinement (commit `90a9ed97`): density is the surface, not the principle — register defers to platform on what platform does well, asserts itself only where it adds something

## Staged but not cut over
- Get Inspired iOS running state (`7c2dfeeb`, flag `GET_INSPIRED_IOS_REGISTER`) — render switch into the live modal still pending until the analyze/build-plan pipeline lands
- Trophy of Becoming variants (`496d2481`, flag `TROPHY_IOS_REGISTER`) — render switch pending until path-completion synthesis service ships
- Concept detail variants (`a6c27c70`, flag `CONCEPT_IOS_REGISTER`) — render switch pending until per-user concept state schema + dormancy heuristic land

## Blocked
- Reflect home (root `/reflect-ios`) — blocked on reflection-usage tracking
- Discover tab — blocked on Discover-Orgs iOS, Discover-People iOS, Discover-Forums iOS

## Queued
### Design handoffs (Claude Design)
- 3 remaining:
  - Discover-Orgs iOS
  - Discover-People iOS
  - Discover-Forums iOS

### Data-layer follow-ups (Claude Code)
- 1. Competency Assessment surface implementation
- 2. Per-user concept state schema
- 3. Concept-to-step association
- 4. Weather service integration
- 5. Prior-debrief quote query
- 6. Concept-suggestion service
- 7. step_rules schema
- 8. Authoring flow for prose beats
- 9. Reflection-usage tracking
- 10. Analyze/build-plan pipeline (unblocks Get Inspired running-state render switch)
- 11. Path-completion synthesis service (unblocks Trophy of Becoming render switch)

## Principles
- Loading-state narration (canonical implementation shipped 2026-05-15 in `7c2dfeeb`)
- Error-state principle

## Open architecture follow-ups
- #11 `/step/[id]` vs `/race/ios/[stepId]` detail-surface split
- #12 inline-action affordances on iOS-register summary cards (Edit / Delete / MarkDone re-surface question after the tap-only cutover)

## Last updated
- 2026-05-15T05:30:00Z
