# Google Play — Data safety form answers

Draft answers for the Play Console **App content → Data safety** form, grounded
in an audit (2026-06-08) of the app's SDKs (`package.json`), Android permissions
(`android/app/src/main/AndroidManifest.xml`), and data-collection code paths.
Transcribe into the Console; re-verify the ⚠️ items before submitting.

## Overview answers

- **Does your app collect or share user data?** → **Yes**
- **Is all collected data encrypted in transit?** → **Yes** (HTTPS/TLS everywhere —
  Supabase, RevenueCat, all APIs)
- **Do you provide a way for users to request data deletion?** → **Yes**
  - In-app: Settings → Delete account (`app/settings/delete-account.tsx`)
  - Also publish the deletion method/URL in `public/privacy.html`
- **Advertising / ads data?** → **No** (no ad SDK in the project)

## Data types — collected / shared / purpose

Shared¹ = transferred to a third **party** (a separate company). Service
providers/processors acting on your behalf are NOT "sharing."

| Data type | Collected | Shared¹ | Req/Opt | Purpose | Source |
| --- | --- | --- | --- | --- | --- |
| Name | Yes | No | Required | Account management, App functionality | `profiles.full_name` |
| Email address | Yes | No | Required | Account management, App functionality | Supabase auth / Google / Apple |
| User IDs | Yes | No | Required | Account management, App functionality, Analytics | auth uid, RevenueCat id, Sentry |
| Purchase history | Yes | No | Optional | App functionality | RevenueCat / Google Play billing² |
| Approximate location | Yes | No | Optional | App functionality | `ACCESS_COARSE_LOCATION` (Atlas/Nearby) |
| Precise location | Yes | No | Optional | App functionality | `ACCESS_FINE_LOCATION`, expo-location, step locations |
| Photos | Yes | ⚠️ See ¹ | Optional | App functionality | expo-camera / image-picker → Supabase storage |
| Other user-generated content (steps, notes, reflections) | Yes | ⚠️ See ¹ | Optional | App functionality, Personalization | core app data |
| Crash logs | Yes | No | — | Analytics | Sentry (processor) |
| Diagnostics | Yes | No | — | Analytics | Sentry performance |
| Device or other IDs | Yes | No | — | Analytics, App functionality | Sentry, RevenueCat |
| Fitness info | Yes (if user logs training) | No | Optional | App functionality | running/fitness interest logs |

**Declare NOT collected:** Audio/voice recordings (recorded on-device for
transcription, not uploaded — the transcription path in
`services/ai/VoiceNoteService.ts` is currently a stub), Payment card numbers²,
Contacts (no permission), Health/medical records, SMS/calls, Browsing history,
Calendar.

## ¹ The AI-processing judgment call (Anthropic + Google Gemini)

User text (and possibly photos) is sent to AI providers for the AI features.
**All AI calls are server-side in Supabase edge functions** — the data path is
app → Supabase backend → AI provider (not direct from the device).

- **Anthropic API** — does not train on API data by default → **processor, not
  shared.** ✅
- **Google Gemini** — code uses the **Gemini Developer API**
  (`generativelanguage.googleapis.com/v1beta`, model `gemini-2.5-flash`), NOT
  Vertex AI. Whether this counts as "shared" depends on the API key's tier:
  - **⚠️ MUST VERIFY:** is the `GEMINI_API_KEY`'s Google project **billing-enabled
    (paid tier)?**
    - **Paid tier** → Google does not use the data → **processor, not shared.**
      Keep "Shared = No" across the board.
    - **Free tier** → Google may use prompts/responses to improve products →
      declare **Photos + Other user-generated content as Shared with Google**,
      OR enable billing / move to Vertex AI to avoid the heavier disclosure.

## ² Payments

On Android, subscription payments run through **Google Play billing**, so the app
never collects or stores card/bank numbers — do **not** declare "Payment info."
(Stripe is web-only and out of scope for the Android Data safety form.)

## Audit basis

- SDKs: `@supabase/supabase-js`, `@sentry/react-native`, `react-native-purchases`
  (RevenueCat), `@anthropic-ai/sdk`, `@google/generative-ai`,
  `@stripe/stripe-react-native` (web), `expo-location`, `expo-camera`,
  `expo-image-picker`, `@react-native-voice/voice`, `expo-notifications`,
  `@react-native-google-signin/google-signin`, `expo-apple-authentication`,
  MapLibre / Google Maps.
- Android permissions include: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
  `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES/VIDEO/AUDIO`, `USE_BIOMETRIC`,
  `INTERNET`. No `READ_CONTACTS`, no ad/advertising-ID permission.
