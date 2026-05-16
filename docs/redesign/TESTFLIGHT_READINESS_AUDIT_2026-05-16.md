---
title: TestFlight & App Store Production Build Readiness Audit
date: 2026-05-16
status: read-only audit, no changes applied
target: TestFlight build Sun 2026-05-17, App Store submission Mon 2026-05-18, Dragon Worlds launch 2026-05-20
---

## Summary

**Verdict: NOT READY — multiple hard blockers.**

The `production` profile in `eas.json` is essentially empty (only `resourceClass` is set on each platform). It is missing `distribution: "store"`, `ios.buildConfiguration: "Release"`, `android.buildType: "app-bundle"`, the entire `env` block, and any `autoIncrement` for build numbers. As a result, an `eas build --profile production --platform ios` today would (a) ship a Debug-configuration binary, (b) have **no EXPO_PUBLIC_*** values at all (Supabase URL/anon key, Google Maps, Google OAuth, OpenWeatherMap, Sentry), and (c) collide with the existing buildNumber `2` on next submission. Compounding that, all three EAS environments (`production`, `preview`, `development`) report **zero variables** server-side — every build today depends on local `.env` interpolation through the `${...}` placeholders in `eas.json`, and `production` does not even have those placeholders. The May 20 cutover flag `EXPO_PUBLIC_FF_REDEEM` is not set anywhere (`.env`, `.env.local`, or EAS) yet defaults to `false` in code, and `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER` is only present in `.env.local`. iOS credentials state could not be verified non-interactively (eas-cli requires a TTY for `eas credentials`) — needs a human run.

## Findings

### 1. `eas.json` production profile completeness

**Preview profile (`build.preview`) — what's set:**
- `distribution: "store"`
- `env: { … 9 vars … }` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`, `EXPO_PUBLIC_OPENWEATHERMAP_API_KEY`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `SENTRY_DISABLE_AUTO_UPLOAD`
- `ios.simulator: false`, `ios.resourceClass: "m-medium"`, `ios.buildConfiguration: "Release"`
- `android.buildType: "app-bundle"`, `android.resourceClass: "medium"`

**Production profile (`build.production`) — what's set:**
- `ios.resourceClass: "m-medium"`
- `android.resourceClass: "medium"`
- (nothing else — no `distribution`, no `env`, no `ios.buildConfiguration`, no `android.buildType`)

**Gaps vs. what App Store production needs:**
- ❌ `distribution: "store"` — without it, EAS defaults to `internal` and the IPA can't be submitted to ASC.
- ❌ `ios.buildConfiguration: "Release"` — preview sets this; production omits it, so the iOS build runs Debug config (slower, debug symbols, dev assertions).
- ❌ `android.buildType: "app-bundle"` — Play Store requires AAB, not APK.
- ❌ `env` block missing entirely — see Finding 4. Even with EAS env vars empty server-side, preview at least interpolates from local shell at build submission; production won't even attempt.
- ❌ No `autoIncrement` (neither `"version"` nor `"buildNumber"`). With `cli.appVersionSource: "local"`, build numbers come from `app.config.js` — currently hardcoded `ios.buildNumber: '2'`. The next iOS build will fail ASC upload if buildNumber 2 was already used.
- ❌ No `submit.production` step linked from build, no auto-submit configuration (not a blocker — manual `eas submit` works).

### 2. `app.config.js` production values

| Field | Value | Notes |
|---|---|---|
| `name` | `BetterAt` | ✓ |
| `version` | `1.0.0` | First public version — fine |
| `ios.bundleIdentifier` | `com.betterat.app` | ✓ matches ASC `ascAppId: 6757738277` |
| `ios.buildNumber` | `'2'` | ⚠️ Hardcoded; no autoIncrement. Must be manually bumped before each build. |
| `android.package` | `com.betterat.app` | ✓ |
| `android.versionCode` | `5` | ⚠️ Hardcoded. Must be manually bumped before each Play build. |
| `updates.enabled` | `false` | ✓ Matches docs requirement (no OTA on production launch) |
| `usesAppleSignIn` | `true` | Requires Sign in with Apple capability on the provisioning profile — see Finding 3. |
| `ios.entitlements` | _not set_ | No `aps-environment` declared. OK only if push notifications are not used in v1. Sentry/Supabase do not require push entitlement. If push is on the roadmap, this needs `"production"` for App Store builds, not `"development"`. |

**NSUsageDescription strings — all clean, no `$(PRODUCT_NAME)` placeholders:**
- `NSLocationWhenInUseUsageDescription` — references "BetterAt" + race performance / wind / current ✓
- `NSLocationAlwaysAndWhenInUseUsageDescription` — same copy ✓ (consider: Apple now scrutinizes Always-usage; only request if app genuinely needs background location, otherwise drop to When-In-Use only to avoid reviewer pushback)
- `NSCameraUsageDescription` — "race moments and scan course marks" ✓
- `NSMicrophoneUsageDescription` — "voice notes and coaching feedback" ✓
- `NSPhotoLibraryUsageDescription` — "save and share race media" ✓
- `NSSpeechRecognitionUsageDescription` — "voice commands and hands-free operation while sailing" ✓
- `ITSAppUsesNonExemptEncryption: false` ✓ (skips export compliance prompt at submission)

**Privacy URL:** not configured in `app.config.js` (this is correct — it lives in App Store Connect, not the binary). Must be set in ASC before submission. See Finding 5.

**Privacy Manifest (`PrivacyInfo.xcprivacy`):** no explicit reference in `app.config.js` or `eas.json`. Expo SDK 54 first-party modules include their own manifests; third-party libs (Sentry, Supabase, MapLibre, Google Sign-In) may trigger Apple's "required reason API" warnings at submission. Not a hard blocker — Apple currently only warns — but worth flagging.

### 3. iOS credentials

**Could not be verified non-interactively.** `eas credentials -p ios` does not accept `--non-interactive` (eas-cli 18.13.0) and blocks waiting for a TTY menu. **This needs Kevin to run manually:**

```
npx eas credentials -p ios
```

…and confirm:
- Distribution certificate exists and is not expired (rolls every 12 months — Apple Distribution).
- App Store provisioning profile for `com.betterat.app` exists, is current, and includes capabilities matching `app.config.js`: Sign in with Apple (mandatory — `usesAppleSignIn: true`), Push Notifications (only if pushes will be used).
- Apple Team ID `67845JJJZJ` (from `eas.json`) matches the active membership.
- ASC API key for `eas submit` is registered (otherwise submit prompts for 2FA).

**Note on Apple Sign-In audience:** prior conversations (saved memory `feedback_supabase_apple_audience_rebrand.md`) flag that the native iOS `aud` is the bundle id `com.betterat.app`. Confirm this string is in Supabase's `external_apple_client_id` comma-list before TestFlight users try to sign in — otherwise auth will fail with "Unacceptable audience in id_token".

### 4. Production EAS env vars

**Result of `eas env:list --environment production`:**
```
No variables found for this environment.
```

Same result for `preview` and `development` — all three EAS environments are empty server-side. Preview builds work today only because `eas.json` `preview.env` declares `${VAR}` interpolation that reads from the **local shell / .env at build submission time**. Production has no env block at all, so even local interpolation does not happen.

**For Monday's production build, exactly one of these must be true:**
- **Option A (recommended):** Push every required env var into EAS production environment via `eas env:create --environment production` so the build is reproducible from any machine and not silently dependent on Kevin's laptop.
- **Option B (lower effort, fragile):** Copy `preview.env` into `production.env` in `eas.json` so the same `${VAR}` interpolation runs at build submission. Build must then be triggered from a machine with the populated `.env`.

**Specific feature flags for May 20:**
- `EXPO_PUBLIC_FF_REDEEM` — **NOT SET anywhere** (not in `.env`, not in `.env.local`, not on EAS). Defaults `false` in code (`lib/featureFlags.ts:351`). The flag's own doc-comment says: _"Defaults false so the May 20 cutover can be controlled by build env."_ For the Dragon Worlds launch this MUST be `true` in the production build's environment.
- `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER` — set only in `.env.local` (not committed, not in EAS, not in `eas.json`). Defaults `false` in code (`lib/featureFlags.ts:344`). If the canonical Series treatment is meant to ship in the May 20 build, this must also be `true` in production env. (If not — leave it off; this is a behavioural change.)

### 5. App Store Connect metadata

No `store.config.json`, no `fastlane/`, no `metadata/`, no `.fastlane/` directory. There is **no codified ASC metadata config** in the repo — App Store listing fields (name, subtitle, description, keywords, screenshots, support URL, marketing URL, privacy policy URL, age rating questionnaire, App Privacy "data collected" responses) will be edited **manually in App Store Connect** before submission.

Minimum ASC fields that must exist before Monday's submission:
- App Store icon (1024×1024 PNG, no alpha) — separate from `assets/images/icon.png`, must be uploaded directly to ASC.
- At least one iPhone 6.7" screenshot set (1290×2796 or 1320×2868).
- iPad screenshots **only if** `ios.supportsTablet: true` is kept (it is — Finding 2). If iPad submission isn't ready, flip `supportsTablet` to `false` before building.
- App description, keywords, support URL, **privacy policy URL** (required field).
- App Privacy questionnaire answered (location, photo library, camera, microphone, speech recognition, third-party SDKs — Sentry, Supabase, Google).
- Age rating questionnaire.
- Build attached to a version (1.0.0).

## Required actions before Monday build

**Hard blockers (must be done before `eas build --profile production`):**

1. **Fix `eas.json` production profile.** Add `distribution: "store"`, `ios.buildConfiguration: "Release"`, `android.buildType: "app-bundle"`, and either (a) an `env` block mirroring preview, or (b) populate EAS production env (see #2). Without this the build is unusable.
2. **Populate production environment.** Either run `eas env:create --environment production` for every var preview declares, **plus** `EXPO_PUBLIC_FF_REDEEM=true`, **plus** `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=true` _if_ Series-canonical is in scope for May 20; or copy preview's `env` block into production in `eas.json` and ensure the build host's local env has every value.
3. **Bump `ios.buildNumber` and `android.versionCode`** in `app.config.js` before each build. iOS is currently `'2'`. If buildNumber 2 was already uploaded to ASC, the next submission will reject. Recommended: bump to `'3'` for Sunday's TestFlight build, then again for Monday if a second build is cut.
4. **Verify iOS credentials interactively** — run `npx eas credentials -p ios` and confirm distribution cert + ASC provisioning profile are current and include Sign in with Apple.
5. **Confirm `com.betterat.app` is in Supabase `external_apple_client_id`** — without this, Apple sign-in fails on the TestFlight build with "Unacceptable audience in id_token" (per `feedback_supabase_apple_audience_rebrand`).
6. **Set ASC privacy policy URL.** Required field; ASC won't accept submission without it.

**Soft blockers (need decision before Monday, but not a build failure):**

7. **Decide on `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER`.** Doc comment calls it "a substantive visual and control-flow change" — confirm whether it ships in the May 20 build or stays off.
8. **App Privacy questionnaire in ASC** — must be answered before submission. Sentry, Supabase, Google sign-in, MapLibre, and location/camera/mic/photos usage all need to be declared accurately.
9. **iPad screenshots or flip `supportsTablet: false`.** Tablet submissions require dedicated screenshots.

## Nice-to-have, not blocking

- Add `autoIncrement: true` (or `"version"` / `"buildNumber"`) to `eas.json` production profile so build numbers stop being a manual chore.
- Consider switching `NSLocationAlwaysAndWhenInUseUsageDescription` → drop entirely if background location isn't used (App Review tightens scrutiny on Always-usage).
- Upgrade local `eas-cli` from 18.7 to 18.13 to get any recent EAS Build fixes; not load-bearing.
- Add a `PrivacyInfo.xcprivacy` manifest at the iOS native layer to silence Apple's "required reason API" warnings from Sentry / MapLibre / Supabase — a warning today, may become a blocker in future submissions.
- Add a `store.config.json` (or fastlane `metadata/`) in a follow-up so ASC metadata is version-controlled rather than hand-edited.
