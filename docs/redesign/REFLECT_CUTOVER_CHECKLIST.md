# Reflect Cutover Checklist

## Pre-cutover gates
- [ ] `app/race-log-ios.tsx` exists and is visually verified in simulator at `/race-log-ios`
- [ ] `app/profile-ios.tsx` exists and is visually verified in simulator at `/profile-ios`
- [ ] `FEATURE_FLAGS.RACE_LOG_IOS_REGISTER` exists in [`lib/featureFlags.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:236)
- [ ] `FEATURE_FLAGS.PROFILE_IOS_REGISTER` exists in `lib/featureFlags.ts`
- [ ] Race Log iOS components are exported from [`components/ios-register/index.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/index.ts:1)
- [ ] Profile iOS components are exported from `components/ios-register/index.ts`
- [ ] Both preview routes are reachable independently of the Reflect tab render path
- [ ] Reflect cutover remains scoped to the Reflect segment switch in [`app/(tabs)/reflect.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/reflect.tsx:930)
- [ ] Shipment bar for the two surfaces is understood:
  components committed, flags exist, preview routes reachable, and simulator verification passed
- [ ] Reflection-usage tracking is NOT a precondition for Race Log iOS or Profile iOS shipment:
  current repo-state verification found no rendered Race Log or Profile element that depends on that tracking
- [ ] Current repo-state lint check is clean on the likely switch files:
  `app/(tabs)/reflect.tsx`, `app/race-log-ios.tsx`, `lib/featureFlags.ts`
- [ ] `--no-verify` is treated as conditional, not assumed:
  re-check the final touched file set once Profile lands

## Cutover sequence
- [ ] Add `PROFILE_IOS_REGISTER` to `lib/featureFlags.ts`
- [ ] Keep `RACE_LOG_IOS_REGISTER` and `PROFILE_IOS_REGISTER` default ON with `EXPO_PUBLIC_FF_*` rollback overrides
- [ ] Wire the Race Log render switch in [`app/(tabs)/reflect.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/reflect.tsx:930):
  Flag ON → embedded Race Log iOS surface
  Flag OFF → existing `RaceLogView`
- [ ] Wire the Profile render switch in `app/(tabs)/reflect.tsx`:
  Flag ON → embedded Profile iOS surface
  Flag OFF → existing `ProfileView`
- [ ] Keep the Progress segment legacy in both flag states unless a separate Reflect-home cutover commit explicitly changes it
- [ ] Keep the top-level Preview entry intact:
  `router.push('/reflect-ios')` remains the review-only root surface, separate from the canonical sub-tab switch
- [ ] Keep existing fallback render paths intact until verification passes with both flags ON

## Verification matrix
- [ ] Reflect tab, Progress segment:
  unchanged under both flag states
- [ ] Reflect tab, Race Log segment:
  flag ON renders embedded Race Log iOS surface
- [ ] Reflect tab, Race Log segment:
  flag OFF renders existing `RaceLogView`
- [ ] Reflect tab, Profile segment:
  flag ON renders embedded Profile iOS surface
- [ ] Reflect tab, Profile segment:
  flag OFF renders existing `ProfileView`
- [ ] Embedded Race Log path hides preview-only chrome and close-X
- [ ] Embedded Profile path hides preview-only chrome and close-X
- [ ] Preview routes still work independently of canonical flag state:
  `/race-log-ios`
  `/profile-ios`
- [ ] Interest-specific segment labels still render correctly in Reflect after the switch
- [ ] Reflect toolbar still renders Export + Preview actions correctly after the segment switch

## Rollback triggers
- [ ] Roll back immediately on any regression in the Progress segment
- [ ] Roll back immediately on any broken segment switching between Progress / Race Log / Profile
- [ ] Roll back immediately on any embedded preview chrome leaking into the canonical Reflect tab
- [ ] Roll back immediately on any crash caused by missing Profile route, missing flag, or missing component export

## Post-cutover documentation updates
- [ ] Strike `Race Log iOS` and `Profile iOS` from the handoff backlog table in [`docs/redesign/IOS_MIGRATION_PLAN.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:387)
- [ ] Update the prose immediately below that table in `IOS_MIGRATION_PLAN.md`:
  Proposed wording: `Three design handoffs still outstanding. Reflect cutover shipped once Race Log iOS and Profile iOS were wired into the canonical Reflect tab; Discover sub-surfaces remain the only blocked-cutover handoffs.`
- [ ] Update the Reflect entry in the surface inventory table in [`docs/redesign/IOS_MIGRATION_PLAN.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.md:485)
  Proposed wording: change wire-up note from `moments returned to wired; arc + thinking-shifted placeholder` to reflect that Race Log + Profile now cut over in the canonical tab while reflection-usage tracking may still be a follow-up
- [ ] Mark Reflect cutover as shipped in [`docs/redesign/IOS_MIGRATION_PLAN.json`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_MIGRATION_PLAN.json:156)
  Proposed change: `canonical_cutover_status: "shipped"` and remove `Race Log iOS design handoff` / `Profile iOS design handoff` from `blocked_by`
- [ ] Update [`docs/redesign/IOS_STATUS.md`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_STATUS.md:3) to reflect the revised surface-counting rule:
  if `race-log-ios` and `profile-ios` ship while `reflect-home-ios` stays parked, the shipped count becomes `4/15`
- [ ] Update [`docs/redesign/IOS_SURFACE_INVENTORY.json`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_SURFACE_INVENTORY.json:117) and [`docs/redesign/IOS_SURFACE_INVENTORY.json`](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_SURFACE_INVENTORY.json:133) so `race-log-ios` and `profile-ios` remain first-class surface entries and flip to `canonical_status: "shipped"` when their flags default on
- [ ] Human confirmation:
  confirm the canonical mount point is still only [`app/(tabs)/reflect.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/reflect.tsx:930). Grep found no second Reflect segment mount, but re-check before landing.
- [ ] Human confirmation:
  confirm Profile’s density behavior when embedded in Reflect. The Profile brief says “standard iOS settings density” and “platform convention first”; verify that no extra Reflect-specific spacing or wrapper chrome distorts that treatment.
- [ ] Human confirmation:
  confirm whether `reflect-home-ios` itself remains `parked` until the contemplative `/reflect-ios` root surface cuts over, even if `race-log-ios` and `profile-ios` ship inside the legacy Reflect tab first. If yes, do not flip `reflect-home-ios` in the inventory or shipped-count summary as part of this cutover.
