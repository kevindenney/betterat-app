# App Store Connect Prep Audit - BetterAt

Date: 2026-05-16
Scope: read-only local repo audit for the May 20 production submission
Sources read: `app.config.js`, `eas.json`, `ios/BetterAt/Info.plist`, `ios/BetterAt/BetterAt.entitlements`, `ios/BetterAt.xcodeproj/project.pbxproj`, `package.json`, and existing docs under `docs/`

Note: this is an inventory of what App Store Connect will need. It does not apply fixes or verify live App Store Connect state.

## Required for submission (hard blockers)

### App Store listing metadata

- REQUIRED: App Store name. Local binary display name is `BetterAt` from `ios/BetterAt/Info.plist` `CFBundleDisplayName`; Expo `name` is also `BetterAt`.
- REQUIRED: Subtitle. No App Store subtitle or short tagline metadata was found in the repo.
- REQUIRED: Description. The web manifest description exists in `app.config.js`, but no App Store Connect description metadata was found.
- REQUIRED: Keywords. No App Store keyword metadata was found.
- REQUIRED: Support URL. No App Store support URL metadata was found.
- REQUIRED: Marketing URL. No App Store marketing URL metadata was found.
- REQUIRED: Privacy policy URL. No App Store privacy policy URL metadata was found in the local config or docs read.
- REQUIRED: App Store category selection. No primary or secondary App Store category metadata was found.
- REQUIRED: App privacy questionnaire. No codified ASC privacy questionnaire answers were found.
- REQUIRED: Age rating questionnaire. No codified ASC age-rating answers were found.

### Privacy policy URL

- The repo context contains `/dragon-worlds-privacy`, but the HKDW infrastructure audit describes it as privacy copy for the DragonWorldsHK2027 iOS app, not a general BetterAt privacy policy.
- No local file read here establishes `/dragon-worlds-privacy` as BetterAt's own privacy policy URL.
- For App Store Connect inventory purposes, BetterAt needs a general privacy policy URL decision before submission.

### Screenshots

- `app.config.js` sets `ios.supportsTablet: true`.
- `ios/BetterAt.xcodeproj/project.pbxproj` has `TARGETED_DEVICE_FAMILY = "1,2"`, so the native project targets iPhone and iPad.
- App Store Connect will therefore need iPhone screenshots and iPad screenshots unless tablet support changes before the production build.
- Standard ASC practice is up to 10 screenshots per device family/localization; at least one required screenshot set must be supplied for each supported device family.
- Exact current iOS 26-era screenshot size acceptance was not externally verified in this repo-only audit.
- Practical screenshot inventory needed: iPhone large display set, plus iPad large display set because tablet is supported.

### Build identity and versioning

- Bundle ID inventory: `com.betterat.app`.
- EAS submit target inventory: `ascAppId: 6757738277`, `appleTeamId: 67845JJJZJ`, `appleId: kdenney@me.com`.
- Expo app version is `1.0.0` in `app.config.js`.
- Checked-in native plist has `CFBundleShortVersionString` as `1.0.0`.
- `app.config.js` has `ios.buildNumber: '3'`.
- Checked-in `ios/BetterAt/Info.plist` has `CFBundleVersion` as `2`.
- Checked-in Xcode project has `CURRENT_PROJECT_VERSION = 1` in both visible build configurations.
- Inventory risk: EAS prebuild/app config may override native checked-in values, but the repo contains conflicting build-number signals that should be visible before submission.

### Sign in with Apple

- `app.config.js` has `ios.usesAppleSignIn: true`.
- `app.config.js` includes the `expo-apple-authentication` plugin.
- `ios/BetterAt/BetterAt.entitlements` includes `com.apple.developer.applesignin` with `Default`.
- Because the app also includes Google sign-in support, Apple review will expect Sign in with Apple to be available wherever equivalent third-party account sign-in is offered.
- ASC/provisioning inventory needed: App ID capability, provisioning profile capability, and Supabase Apple audience configuration for `com.betterat.app`.

### Age rating questionnaire implications

- The app includes user-generated reflections, plans, notes, profile content, photos, voice notes/audio, and potentially comments/community surfaces.
- Age rating questions to anticipate: user-generated content, whether UGC is moderated or reportable, unrestricted web access, social features, messaging or comments, contests, gambling, medical/treatment content, location sharing, profanity, alcohol/tobacco/drug references, sexual content, violence, and simulated gambling.
- BetterAt's nursing and fitness verticals may trigger health/medical-adjacent review questions even if the app is educational and practice-oriented rather than clinical.
- Location permissions mention race performance, wind, and current data; age rating and privacy responses should reflect location collection if those flows are in the submitted app.

### App privacy questionnaire implications

- Contact info: likely email, name/display name, username/profile fields through Supabase auth and profile records.
- Identifiers: user ID, auth IDs, Supabase auth identifiers, Firebase/HKDW bridge identifiers for HKDW arrivals, and third-party SDK identifiers.
- User content: plans, practice steps, reflections, notes, photos/images, voice/audio, transcriptions, uploaded documents/media, public profile content, community content.
- Location: `expo-location` is present and iOS usage strings request when-in-use and always location access.
- Photos/camera: `expo-camera`, `expo-image-picker`, `expo-media-library`, camera usage text, and photo library usage text are present.
- Audio/speech: `expo-av`, `@react-native-voice/voice`, microphone usage text, and speech recognition usage text are present.
- Purchases/payment: `@stripe/stripe-react-native` is present.
- Diagnostics: `@sentry/react-native` is present; crash and performance diagnostics should be considered.
- Usage data: app activity and product interaction may be captured through backend records and diagnostics, even if no separate analytics SDK was identified in the allowed files.
- Health/fitness/sensitive info: fitness and nursing use cases exist in docs and product scope; ASC data-category answers need Kevin's intended submitted-scope decision.
- Tracking: no ad SDK or ATT permission was identified in the allowed files. Whether any SDK data is used for tracking across companies' apps/sites remains an ASC policy answer, not derivable from local files alone.

## Available in codebase (already set)

### App name and bundle identity

- Binary display name: `BetterAt`.
- Expo app name: `BetterAt`.
- Web manifest name: `BetterAt - Get Better at What Matters to You`.
- Web short name: `BetterAt`.
- iOS bundle identifier: `com.betterat.app`.
- Android package: `com.betterat.app`.
- EAS project ID: `88a65b55-6656-418d-86cd-909eea27e895`.
- ASC app ID in `eas.json`: `6757738277`.
- Apple team ID in `eas.json`: `67845JJJZJ`.

### Native permissions and capabilities

- Camera usage string exists: capture race moments and scan course marks.
- Microphone usage string exists: voice notes and coaching feedback.
- Photo library usage string exists: save and share race media.
- Speech recognition usage string exists: voice commands and hands-free operation while sailing.
- Location when-in-use usage string exists: race performance, wind, and current data.
- Location always-and-when-in-use usage string exists with the same race performance, wind, and current framing.
- Face ID usage string exists in the native plist.
- Sign in with Apple entitlement exists.
- Push notification entitlement exists as `aps-environment = development` in checked-in entitlements.
- Export compliance flag exists: `ITSAppUsesNonExemptEncryption` is `false`.

### EAS submission config

- `eas.json` has `submit.production.ios.appleId = kdenney@me.com`.
- `eas.json` has `submit.production.ios.ascAppId = 6757738277`.
- `eas.json` has `submit.production.ios.appleTeamId = 67845JJJZJ`.
- Existing docs include `docs/redesign/EAS_PRODUCTION_ENV_2026-05-16.md`, which records production EAS env values including `EXPO_PUBLIC_FF_REDEEM=true` and `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=true`.
- Existing docs include `docs/redesign/TESTFLIGHT_READINESS_AUDIT_2026-05-16.md`, which inventories build-readiness concerns separately from App Store Connect metadata.

### Existing product copy usable as raw material

- Web description in `app.config.js`: "The deliberate practice platform. Plan, Do, Review - whatever your discipline. Sailing, nursing, drawing, fitness, and more."
- Redesign docs consistently frame BetterAt as a deliberate practice platform across sailing, nursing, drawing, and fitness.
- Phase P docs establish May 20 HKDW traffic as a launch source but not the whole App Store listing audience.

## Needs Kevin's input (decisions or writing)

### Store positioning

- App Store display name decision: keep `BetterAt` or use a longer ASC listing name if available in App Store Connect.
- Subtitle writing is needed; no repo source-of-truth exists.
- App description writing is needed; the web manifest description is too short to serve as a complete ASC description by itself.
- Keyword list writing is needed.
- Category decision is needed. Based on product scope, primary category fit appears to be Education; secondary could be Health & Fitness, Sports, or Productivity depending the launch positioning Kevin wants reviewers and users to see.

### URLs

- Privacy policy URL decision is needed.
- Support URL decision is needed.
- Marketing URL decision is needed.
- If `/dragon-worlds-privacy` is used anywhere in ASC, it should be treated as HKDW-specific per existing audit context, not assumed to be BetterAt's general policy.

### Privacy answers

- Kevin needs to decide which data is collected in the submitted May 20 binary versus present only in dormant/deferred code paths.
- Kevin needs to decide whether any data is used for tracking under Apple's App Privacy definition.
- Kevin needs to decide whether nursing/fitness reflections, health goals, or performance data should be disclosed as health/fitness or sensitive data.
- Kevin needs to decide retention/deletion language for user-generated content, media, and account data.
- Kevin needs to decide whether community/profile surfaces expose UGC broadly enough to require moderation/reporting statements in review notes.

### Review notes and test account

- ASC review notes will need a test account or clear account-creation path.
- If `/redeem` and HKDW onboarding are part of the review narrative, review notes should explain how a reviewer reaches the standard BetterAt app without HKDW credentials.
- If feature flags are build-time enabled for the submitted binary, review notes should match the actual visible scope.

## Nice to have but not blocking

### Metadata as code

- No `store.config.json`, `fastlane/metadata`, or equivalent ASC metadata-as-code directory was found.
- Manual ASC entry is therefore the current inventory state.

### Screenshot organization

- The repo already banks product screenshots under `docs/redesign/screenshots/`, including Phase P and redesign verification captures.
- Those screenshots are engineering verification artifacts, not necessarily App Store-framed marketing screenshots.
- A separate ASC screenshot set will still need final copy, device framing decisions, and iPhone/iPad coverage.

### Native project cleanup visibility

- Checked-in native build-number values do not match `app.config.js`.
- Checked-in entitlements show development push environment.
- These may be harmless if EAS regenerates native settings from Expo config at build time, but they are visible in the repo and should not be confused with ASC metadata.

### Privacy manifest visibility

- No explicit `PrivacyInfo.xcprivacy` file was identified in the allowed local files.
- Expo modules and third-party SDKs may provide their own privacy manifests, but this audit did not inspect generated build artifacts.

### App icon inventory

- `app.config.js` points to `./assets/images/icon.png`.
- App Store Connect separately requires a 1024x1024 App Store icon upload.
- This audit did not inspect image dimensions because the requested read scope was config, iOS metadata, package, README, and docs.
