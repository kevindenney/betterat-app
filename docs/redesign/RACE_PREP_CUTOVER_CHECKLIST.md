# Race Prep Cutover Checklist

## Pre-cutover gates
- [ ] `per-interest-beats.ts` shipped and verified across sailing, nursing, and drawing
- [ ] Race Prep cards iOS design exists in Claude Design as the canonical summary-surface design
- [ ] Race Prep cards iOS design export is available to engineering
- [ ] Existing Race Prep iOS detail design exists in Claude Design as the canonical detail-surface design
- [ ] Existing Race Prep iOS detail design export is available to engineering
- [ ] Architecture decision #4 is documented in the migration plan:
  Summary vs detail surfaces get distinct designs, and RaceSummaryCard + StepDetailContent cut over together
- [ ] Feature-flag cutover pattern used for Playbook home is reusable for Race Prep
- [ ] Banner-hide precedent from `da8c4270` is understood before implementation starts

## Cutover sequence
- [ ] Add a Race Prep iOS cutover feature flag to the flags config
- [ ] Wire `RaceSummaryCard.tsx` render switch:
  Flag ON → cards iOS
  Flag OFF → existing summary card
- [ ] Wire `StepDetailContent.tsx` render switch:
  Flag ON → detail iOS
  Flag OFF → existing detail layout
- [ ] Hide the preview/banner treatment for `embedded={true}` on both summary and detail render paths
- [ ] Preserve deep links:
  `/race/ios/[stepId]` still opens the preview/detail route
- [ ] Preserve preview access from the timeline-step overflow menu during rollout
- [ ] Keep existing fallback render paths intact until verification passes with flag ON

## Verification matrix
- [ ] Sailing step: cards view renders correctly
- [ ] Sailing step: tap-through from card to detail works
- [ ] Nursing step: cards view renders correctly
- [ ] Nursing step: tap-through from card to detail works
- [ ] Drawing step: cards view renders correctly
- [ ] Drawing step: tap-through from card to detail works
- [ ] Four state grammar is visible and distinct on cards:
  planned, in progress, debriefed, current
- [ ] Earned exception renders on current card only
- [ ] Flag OFF: existing summary and detail layouts render unchanged
- [ ] Preview route still works independently of canonical flag state
- [ ] Horizontal timeline-grid layout holds at iPhone 16e width

## Rollback triggers
- [ ] Roll back immediately on any regression in existing sailing renders
- [ ] Roll back immediately on any crash for an unmapped interest
- [ ] Roll back immediately on any layout break in the horizontal timeline-grid at iPhone 16e width

## Post-cutover documentation updates
- [ ] Strike Race Prep cutover from "What's blocked" in `docs/redesign/IOS_MIGRATION_PLAN.md`
- [ ] Mark Race Prep cutover as `shipped` in `docs/redesign/IOS_MIGRATION_PLAN.json`
- [ ] Update `docs/redesign/IOS_STATUS.md` to show `2/12` surfaces cut over
- [ ] Update `docs/redesign/IOS_SURFACE_INVENTORY.json` canonical status fields for Race Prep surfaces
