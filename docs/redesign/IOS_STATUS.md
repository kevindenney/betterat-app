# iOS Register Migration — Status

## Shipping
- 13/13 surfaces designed (12 original previews + Race Prep cards canonical summary)
- 2/13 surfaces cut over:
  - Playbook home (`ae0334fd`, 2026-05-15)
  - Race Prep cards iOS (`01c6af34`, 2026-05-15)
- 8 register decisions resolved
- 3 architecture decisions resolved
  - #3 summary vs detail is now substantiated by two shipped cutovers: Playbook home and Race Prep cards iOS

## Blocked
- Reflect home — Race Log iOS designed, Profile iOS designed; cutover itself not yet planned/started, reflection-usage tracking still open
- Discover tab — blocked on Discover-Orgs iOS, Discover-People iOS, Discover-Forums iOS

## Queued
### Design handoffs (Claude Design)
- 3 remaining:
  - Discover-Orgs iOS
  - Discover-People iOS
  - Discover-Forums iOS
- Race Log iOS designed today, ready for Reflect cutover when scheduled
- Profile iOS designed today, ready for Reflect cutover when scheduled
- Get Inspired iOS running state may land today (in flight in Claude Design)

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

## Principles
- Loading-state narration
- Error-state principle

## Open architecture follow-ups
- #11 `/step/[id]` vs `/race/ios/[stepId]` detail-surface split
- #12 inline-action affordances on iOS-register summary cards (Edit / Delete / MarkDone re-surface question after the tap-only cutover)

## Last updated
- 2026-05-15T04:08:47Z
