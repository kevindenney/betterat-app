---
title: EAS Production Environment Variables — Snapshot
date: 2026-05-16
source: `npx eas env:list --environment production`
purpose: Record of what was set in EAS production env on 2026-05-16 ahead of the May 20 Dragon Worlds production build.
---

## Listing

```
Environment: production
EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER=true
EXPO_PUBLIC_FF_REDEEM=true
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=176626806015-053v2arr6ieimmfstdfn43quu6kut9s7.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=176626806015-2aa2ujl7jiierinonf1v5rmnkjfhmodp.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=***** (sensitive)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=***** (sensitive)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=176626806015-s39mdhh67n9u2vpmo62jacrcif0g4g0d.apps.googleusercontent.com
EXPO_PUBLIC_OPENWEATHERMAP_API_KEY=***** (sensitive)
EXPO_PUBLIC_SUPABASE_ANON_KEY=***** (sensitive)
EXPO_PUBLIC_SUPABASE_URL=https://qavekrwdbsobecwrfxwu.supabase.co
```

## Notes

- Visibility split: feature flags, the Supabase URL, and Google OAuth client IDs are stored as `plaintext` because they are public identifiers that ship in the client bundle anyway. API-key-shaped values (Supabase anon key, Google Maps keys, OpenWeather key) are stored as `sensitive` so they are masked in EAS UI listings. None are stored as `secret` — that would prevent them from being read into the JS bundle at build time.
- Values were sourced from local `/Users/kdenney/Developer/BetterAt/betterat-app/.env` at audit time (both `.env` and `.env.local` had the same Supabase project `qavekrwdbsobecwrfxwu`).
- Feature flags `EXPO_PUBLIC_FF_REDEEM` and `EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER` are explicitly `true` for the May 20 Dragon Worlds build per Kevin's direction.
- `EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS` is intentionally **not set** — code default of `false` stands until separately authorized.
- `SENTRY_DISABLE_AUTO_UPLOAD` is **not set** here and was intentionally omitted from `eas.json`'s production `env` block as well, so production builds upload source maps to Sentry by default. (Preview keeps it disabled.)
- This file is a point-in-time record. If env changes, re-run `npx eas env:list --environment production` rather than trusting this snapshot.
