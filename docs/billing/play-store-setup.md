# Google Play Store billing setup

Seeding checklist for BetterAt's Android subscriptions. Everything in Phases 0–2
must exist **before** running `scripts/revenuecat-play-setup.py`, because the
RevenueCat products reference Play products that have to be live first.

State as of writing: web (Stripe) and iOS (RevenueCat IAP) billing are live.
Android client code is already wired (`react-native-purchases`,
`lib/subscriptions/subscriptionService.ts` selects the Android RC key + product
IDs via `Platform.select`). The only gaps are the Play Console products, the
RevenueCat Play app, and the `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` env var.

## Phase 0 — App + first build (gates everything)

- [ ] Create the app in Play Console: package **`com.betterat.app`**.
- [ ] Complete the one-time blockers Play requires before *any* product
      activates: app content declarations (privacy policy URL, data safety,
      ads, content rating) and a **payments profile** (merchant account) —
      subscriptions are inert without it.
- [ ] Build & upload a first **AAB** to the **Internal testing** track
      (`eas build -p android --profile preview` → `eas submit`). Play won't
      expose products to RevenueCat until a build carrying the billing
      entitlement exists.
- [ ] Add yourself + testers to the internal track's tester list.

> Phase 0's payments profile + content declarations are the slowest,
> most-likely-to-stall items (Google identity/review can take days). Start them
> first.

## Phase 1 — The 4 subscription products

Create under **Monetize → Subscriptions**. Each is a **separate subscription**
(matching the code's 4 distinct product IDs), each with **one base plan**
(auto-renewing). Product IDs are permanent — type them exactly.

| Subscription (product) ID     | Base plan ID | Price (USD) | Billing period      | RC entitlement |
| ----------------------------- | ------------ | ----------- | ------------------- | -------------- |
| `betterat_individual_monthly` | `monthly`    | **$9.00**   | 1 month, auto-renew | individual     |
| `betterat_individual_yearly`  | `annual`     | **$90.00**  | 1 year, auto-renew  | individual     |
| `betterat_pro_monthly`        | `monthly`    | **$29.00**  | 1 month, auto-renew | pro            |
| `betterat_pro_yearly`         | `annual`     | **$290.00** | 1 year, auto-renew  | pro            |

Per product:

- [ ] Base plan id matches the table → this drives the RC `store_identifier` =
      `<productId>:<basePlanId>` (e.g. `betterat_individual_monthly:monthly`).
      **If you name a base plan anything other than `monthly`/`annual`, update
      the `BASE_PLAN` map in `scripts/revenuecat-play-setup.py`.**
- [ ] Set the USD price; let Play auto-convert other markets (refine later).
- [ ] No free trial / intro offer unless wanted (the code assumes none).
- [ ] **Activate** the base plan (draft base plans don't surface to RC).

> Naming convention: iOS uses flat product IDs (`betterat_individual_monthly`).
> Play forces the `productId:basePlanId` shape, so the RC store_identifier
> differs between stores by design — that's why the script appends
> `:monthly`/`:annual`. The code's `Platform.select` product IDs stay flat; RC
> maps them via the shared offering package.

## Phase 2 — Service account for RevenueCat

RC needs Play API access to validate purchases & receive renewal notifications.

- [x] **VERIFIED 2026-06-08** — reuse
      `eas-submit@regattaflowwebsite.iam.gserviceaccount.com`. SA key is valid and
      mints an `androidpublisher`-scoped token (API enabled on project
      `regattaflowwebsite`). In Play Console → Users & permissions the SA already
      holds, at the **Account** level: **View financial data, orders, and
      cancellation survey responses** (incl. Purchases API) **and Manage orders
      and subscriptions** — both billing roles RC requires. No grant changes
      needed. (The probe in Phase 4 returned 404 only because the app doesn't
      exist yet, not a permission gap.)
- [ ] (Recommended) Enable **Real-time developer notifications**: create a
      Pub/Sub topic and paste its name into the app's Monetization setup so
      renewals/cancels reach RC without polling.

## Phase 3 — RevenueCat dashboard (the manual finish the script can't do)

The v2 API does not expose the Play service-account credential upload or the
resulting `goog_` public SDK key (same limitation as the iOS `appl_` key).

- [ ] If the script couldn't auto-create the play_store app, add it: **Apps →
      + New → Play Store**, package `com.betterat.app`.
- [ ] **Project settings → Integrations → Google Play** → upload the service
      account JSON (or grant access).
- [ ] Run `python3 scripts/revenuecat-play-setup.py` → creates products,
      attaches to the existing `pro`/`individual` entitlements and offering
      packages.
- [ ] **Project settings → API keys → App-specific public API keys → BetterAt
      (Play Store)** → copy the `goog_…` key into `.env` as
      `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.

## Phase 4 — Verify

- [ ] New Android build with the `goog_` key baked in (env is read at build
      time).
- [ ] On a device signed in as a Play license tester, open the paywall →
      confirm all 4 products load with correct prices, and a test purchase
      grants the `pro`/`individual` entitlement (check the RC customer + that
      the `revenuecat-webhook` edge function updates `subscription_tier`).

## Reference

- RevenueCat project `bc3ea4eb`, default offering `ofrngca51e2e52e`,
  entitlements `pro` / `individual`. Full ID map: see the iOS catalog notes.
- Setup script: `scripts/revenuecat-play-setup.py` (idempotent; key read from
  `.env`, never printed).
- Service account file: `google-play-service-account.json` (project
  `regattaflowwebsite`).
