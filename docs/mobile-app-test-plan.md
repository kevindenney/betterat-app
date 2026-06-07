# Mobile App Test Plan

## Target

Primary target: iOS Simulator, currently iPhone 17 Pro Max, app id `com.betterat.app`.

Fallback target: Android emulator with the same Maestro flows after `adb devices` shows an attached emulator.

## Setup

1. Boot/open Simulator.
2. Run `npx expo run:ios --device "iPhone 17 Pro Max"`.
3. Keep Metro running on `localhost:8081`.
4. Use Maestro for repeatable flows and `xcrun simctl io booted screenshot` for visual checks.

## Automated Coverage

Run these first:

1. `maestro test .maestro/smoke/core-mobile-navigation.yaml`
2. `maestro test .maestro/auth/sign-in.yaml` with `DEMO_PASSWORD` set.
3. `maestro test .maestro/auth/sign-out.yaml`
4. `maestro test .maestro/auth/guest-mode.yaml`
5. `maestro test .maestro/races/delete-race-alert.yaml`
6. `maestro test .maestro/races/hide-race-alert.yaml`
7. `maestro test .maestro/steps/after-tab-persist.yaml` with a real `STEP_ID`.

## Manual Route Matrix

Core learner tabs:

1. Practice: Step, Arc, All zoom rail; previous/next step; add step; phase tabs; note/capture composer.
2. Library: plans, blueprints, ask flow, detail screens, back navigation.
3. Watch: following feed, suggested people, adapt step, profile deep links.
4. Atlas: map load, search, saved places, nearby list, layer controls, add/recenter.

Account and auth:

1. Cold signed-out launch routes to login on native.
2. Login, logout, account modal, subscriptions, connected services.
3. Guest mode if available.
4. Deep links: `betterat://account`, `betterat://step/<id>`, `betterat://share/<token>`.

Creation and editing:

1. Add blank step.
2. Add suggested step.
3. Edit/delete step.
4. Add/edit season arc.
5. Move/tag/schedule bulk actions.
6. Share/suggest/copy link.

Error and offline cases:

1. Launch without network.
2. Supabase schema drift or missing optional tables.
3. Permission prompts for location, camera, microphone, photos.
4. Map tile failures and retry behavior.

Visual checks:

1. No red error overlays.
2. Floating tab bar does not hide primary actions.
3. Right zoom rail does not cover essential content.
4. Text fits at iPhone and iPad sizes.
5. Empty states explain the next action without dead ends.

## Known Findings From 2026-06-06 Pass

1. Build/run on iOS succeeded with warnings only.
2. `SharedStepsService` hit missing `shared_steps` schema on launch; direct/group share now fail soft, link share uses the unified token RPC.
3. Practice timeline controls needed stable test IDs for automation; added for tabs, zoom rail, and now float.
4. L3 Arc content can still scroll under the floating tab bar. It is usable but should be reviewed in a design pass because filter chips can sit visually behind the tab pill.

## Verified Signup/JHU Flows From 2026-06-07 Pass

1. Multi-interest signup in simulator:
   - Flow: `.maestro/smoke/signup-multi-interest.yaml`
   - Latest verified fixture: `qa-multi-202606071430@betterat.app`
   - Current next-run fixture in YAML: `qa-multi-202606071600@betterat.app`
   - Verified DB state: `user_interests` contains `nursing` and `sail-racing`.
2. Interest + blueprint signup in simulator:
   - Flow: `.maestro/smoke/signup-interest-blueprint.yaml`
   - Latest verified fixture: `qa-blueprint-202606071130@betterat.app`
   - Current next-run fixture in YAML: `qa-blueprint-202606071600@betterat.app`
   - Verified DB state: Nursing interest and active `blueprint_subscriptions` row for `pre-clinical`.
3. JHU Nursing author/admin/student/mentor scenario:
   - Latest verified author fixture: `qa-jhu-author-202606071130@betterat.app`
   - Latest verified student fixture: `qa-jhu-student-202606071430@betterat.app`
   - Current next-run fixtures in YAML: `qa-jhu-author-202606071600@betterat.app`, `qa-jhu-student-202606071600@betterat.app`
   - JHU org: `johns-hopkins-school-of-nursing`
   - Blueprint: `mobile-qa-jhu-nursing-plan-202606070913`
   - Verified DB state: author active JHU admin, student active JHU member, published org-member blueprint, active student subscription, adopted student step, and author progress RPC returns the student adoption.
   - Post-student-signup helper: `npm run smoke:jhu-blueprint-postsignup` marks the current student fixture as an active JHU member, subscribes them to the seeded JHU blueprint, and records first-step adoption.

## Current Gaps

1. Full `npm run typecheck` still fails on existing inspiration spacing-token issues, Ionicons typing, timeline season/subscribed-blueprint types, and a few unrelated component type errors.
2. Expo dev-menu startup after Maestro `clearState` is flaky; smoke flows include defensive endpoint selection and menu-close steps.
3. Admin Add Person modal opens on mobile, but deeper fields are not reliably accessible in the compact simulator layout.
4. Org-member blueprint subscription during signup requires the student membership to exist first; otherwise the account and interest are created but the restricted blueprint subscription is skipped. For the JHU smoke, mark the student as an active JHU member before asserting subscription/adoption.
