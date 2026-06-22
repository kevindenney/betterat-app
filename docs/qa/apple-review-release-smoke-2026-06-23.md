# Apple Review Release Smoke — 2026-06-23

Scope: Chrome web and iOS Simulator verification for BetterAt release-readiness using the Emily JHU demo account.

## Environment

- Repo: `/Users/kdenney/Developer/BetterAt/betterat-app`
- Web smoke: Chrome against `http://localhost:8083`
- iOS smoke: iPhone 17 Pro simulator, iOS 26.0, BetterAt dev build against Metro on `8082`
- Account: Emily JHU demo account

## Chrome Web

Passed:
- Signed in as Emily and loaded authenticated app.
- Verified `Build a worked example` from the New Step composer for:
  - Nursing: generated a clinical worked example with `SHIFT BEATS`, sub-steps, and editable detail fields.
  - Sail Racing: generated `Worked example · 4 sub-steps · 6 beats`.
  - Entrepreneur: generated a worked example with run-through and editable details.
  - Golf: generated `Worked example · 4 sub-steps · 8 beats`.
- Practice, Library, Watch, and Atlas routes loaded without visible blank/error states.

Observed:
- Chrome console reported a pre-existing nested `<button>` hydration warning in the profile menu.

## iOS Simulator

Passed:
- App launched on iPhone 17 Pro simulator.
- Core navigation smoke passed: Practice, Library, Watch, Atlas tabs and taskbar controls.
- Add plain step smoke passed: created and displayed `Mobile QA plain step`.
- Switch-interest add-step smoke passed: switched to Sail Racing, created and displayed `Mobile QA sail interest step`.
- Native Account modal now exposes a visible `Sign Out` row and `account-sign-out-button`.

Fixed During Smoke:
- The unified Account modal had `Delete Account` but no signed-in `Sign Out` action. Added the existing confirm-and-sign-out behavior to `components/account/AccountModalContent.tsx`.
- Updated `.maestro/auth/sign-in.yaml` to wait on the stable Account sign-out testID and current signed-out route behavior.

Observed:
- Manual sign-in succeeded after the simulator was signed in by the user.
- Fresh automated iOS credential entry remains brittle because Maestro does not expose the nested login `TextInput` fields in the hierarchy and coordinate entry can focus the wrong field on this modal.
- Metro warnings during simulator smoke: deprecated `SafeAreaView`, one require cycle in Discover detail components, unsupported dashed/dotted border style, RevenueCat cache notices, and Reanimated worklet mutation warnings.

## Command Verification

Passed:
- `npm run typecheck`
- `npm run lint` — 0 errors / 2,092 warnings
- `npm run lint -- --quiet`
- `npm run test -- --runInBand` — 196 suites / 819 tests

Documented missing command:
- `npm run build` fails because `package.json` has no script named exactly `build`.

## Ship Assessment

Not fully Apple-review-green yet. The main user flows checked here pass in Chrome and iOS after manual sign-in, and the Account modal now has the expected Sign Out control. Remaining pre-submit work is to decide whether the Metro warnings and automated native auth limitation are acceptable for this review build, or to add a dedicated native-login test harness before final release sign-off.
