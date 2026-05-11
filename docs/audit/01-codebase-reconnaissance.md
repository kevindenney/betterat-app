# Pass 1 — Codebase Reconnaissance

Read-only structural survey. Cite-and-don't-touch.

## 1. Stack

From `package.json:60-` and `app.config.js:1-117`:

| Layer | Tech |
| --- | --- |
| Runtime | Expo SDK 54, React Native 0.81, new arch enabled (`app.config.js:17`) |
| Router | Expo Router 6 (file-based, `app/`), `typedRoutes` experiment on (`app.config.js:104-106`) |
| Language | TypeScript (strict — see `tsconfig.json`) |
| Server state | TanStack React Query 5.90 (`app/_layout.tsx:31`, configured at lines 97+) |
| Local state | React Context (`providers/` — 12 providers) |
| Styling | NativeWind / TailwindCSS, Gluestack UI primitives, design tokens in `lib/design-tokens.ts` & `lib/design-tokens-ios.ts` |
| Backend | Supabase (PostgreSQL + Auth + Storage + 57 Edge Functions) |
| AI | `@anthropic-ai/sdk` ^0.67.0 (server-side / scripts only — client routes through edge functions) plus Google Generative AI |
| Maps | MapLibre GL, react-map-gl, deck.gl 9, react-native-maps, Google Maps (`app.config.js:61-65`) |
| Payments | Stripe React Native ^0.57 + Stripe Connect for blueprint marketplace |
| Auth providers | Apple (`expo-apple-authentication`, `app.config.js:86`), Google (`@react-native-google-signin/google-signin`, `app.config.js:88-92`), Email/Password |
| Telemetry | Sentry (`app.config.js:93-99`, init at `app/_layout.tsx:7-10`) |
| Forms / validation | Zod ^3.25 |
| i18n | Custom in `lib/i18n/` |

App identity (`app.config.js`):
- `name: 'BetterAt'`, `slug: 'betterat-app'`, `scheme: 'betterat'`
- iOS bundle: `com.betterat.app`, build 2
- Android package: `com.betterat.app`, versionCode 5
- ⚠️ Google Sign-in iosUrlScheme still uses a `com.googleusercontent.apps.176626806015-...` reverse client id (`app.config.js:90`) — this is Apple/Google console-side branding that surfaces the "RegattaFlowWeb" string the user reported in screenshots. Not changeable in this repo alone.

## 2. Top-level layout (depth 3)

```
app/                          # Expo Router screens (124 entries at top level)
  _layout.tsx                 # Root: providers, fonts, font/i18n init, splash
  (auth)/                     # Login/signup/onboarding (sailor + coach + club variants)
  (tabs)/                     # Tab navigator + per-tab screens
  step/[id].tsx               # Step detail (deep-linked from cards/timeline)
  blueprint/[slug].tsx        # Blueprint detail / paywall
  creator/                    # Creator dashboard, [id], earnings, subscriber views
  club/                       # Club admin surfaces (entries, scoring, jury, etc.)
  organization/               # Org admin (cohorts, billing, access-requests)
  coach/                      # Coach booking + artifact review
  nursing/ drawing/ design/ fitness/ knitting/ ...  # Interest landing pages
  p/                          # Public share routes (steps, regattas, results)
  embed/                      # Embeddable views
  invite/ team-invite/ org-invite.tsx
  ...one-off screens (account, profile, settings, modal, more, etc.)

components/                   # 87 top-level subdirs
  cards/ content/ step/ races/ blueprint/ creator/ playbook/ reflect/
  discover/ learn/ map/ venue/ ui/ navigation/ onboarding/ ...

services/                     # 213 entries
  ai/                         # AIClient, ClaudeClient (deprecated re-export), AIMemory, etc.
  agents/                     # Tool-using LLM agents
  coach/ bathymetry/ community/ current/ demo/ domain/ location/ payments/
  BlueprintService.ts BlueprintPaymentService.ts CompetencyService.ts ...

providers/                    # 12 React context providers (Auth, Interest, Organization,
                              # CoachWorkspace, ContextualHint, FeatureTour, GlobalSearch,
                              # Stripe.{native,web}, WebDrawer)

hooks/                        # 247 hooks (one per feature, plus hooks/ai/, hooks/__tests__/)
lib/                          # 60+ subdirs of utilities, auth helpers, gates, navigation-config,
                              # vocabulary, design tokens, telemetry, i18n
types/                        # Per-feature TS types
api/                          # Vercel serverless functions (web preview/share routes)
supabase/
  migrations/                 # 393 .sql files (2024-11 through 2026-05)
  functions/                  # 57 edge functions (Deno)
skills/                       # Anthropic Skills (uploaded via scripts/upload-all-skills.mjs)
scripts/                      # ~120 mjs/ts scripts (seeders, validators, gate checks, etc.)
docs/                         # Architecture + audit docs (this folder)
```

## 3. Apps / packages

Single Expo app (not a monorepo). No workspaces declared in `package.json`. The web build is the same RN codebase exported via `expo export --platform web` (`package.json:16`) and the `api/` directory adds Vercel serverless endpoints for share/embed routes (not Next.js — these are bare-handler `.ts` files Vercel auto-mounts).

## 4. Routing

Expo Router file-based routing, all under `app/`. Two synthetic groups:
- `(auth)` — unauthenticated flow, has its own `_layout.tsx`
- `(tabs)` — main tab navigator, central layout at `app/(tabs)/_layout.tsx`

Tab config is **not** colocated with screens — it lives in `lib/navigation-config.ts` (the single source of truth referenced by `app/(tabs)/_layout.tsx`, `components/navigation/NavigationDrawer.tsx`, and `components/navigation/WebSidebarNav.tsx`). Tab labels are derived from the user's interest vocabulary via `getEventTabTitle(vocabulary, activeDomain)` (`lib/navigation-config.ts:58-70`).

Deep links: scheme `betterat://`, plus `regattaflow.io` host (`app.config.js:18-21`).

Public share routes live under `app/p/` and `app/embed/`, intentionally outside the auth gate.

## 5. State management

| Concern | Mechanism |
| --- | --- |
| Auth/session | `providers/AuthProvider.tsx` (`useAuth()`) — Supabase session + profile + capabilities |
| Active interest | `providers/InterestProvider.tsx` (`useInterest()`) — drives vocabulary + navigation |
| Org workspace | `providers/OrganizationProvider.tsx` |
| Coach workspace | `providers/CoachWorkspaceProvider.tsx` |
| Server data | TanStack Query everywhere; query keys typically include `user.id` (e.g. `[INTERESTS_QUERY_KEY, user?.id ?? 'anon']` `providers/InterestProvider.tsx:190`). 5-min default `staleTime` (`app/_layout.tsx:100`). |
| Persistence | `expo-secure-store` on native, `localStorage` on web — switching logic in `services/supabase.ts:57-101` |
| Realtime | Supabase realtime channels (e.g. `services/coachHomeRealtimeController.ts`) |
| Light global state | `stores/` directory (Zustand-style, e.g. `stores/raceConditionsStore.ts`) |

QueryClient is created in `app/_layout.tsx:97+` with defaults; not exported, so all hooks consume the provider.

## 6. Styling

- **Primary**: NativeWind classNames + Tailwind config (`tailwind.config.js`). `web:` prefix used for web-specific overrides.
- **Components**: Gluestack UI primitives under `components/ui/` (Button, Modal, Toast, AlertDialog, etc.).
- **Design tokens**: `lib/design-tokens.ts` + `lib/design-tokens-ios.ts` (separated because the iOS visual language was lifted from a prior design system).
- **Web alerts**: `Alert.alert` is banned — `lib/utils/crossPlatformAlert.ts` + `components/ui/WebAlertDialog.tsx` provide `showAlert`/`showConfirm` (per `CLAUDE.md`).
- Global stylesheet: `global.css` (imported `app/_layout.tsx:5`).

## 7. Supabase usage

Single client created in `services/supabase.ts:111-191`:

- Reads env via `process.env.EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` with fallback to `Constants.expoConfig.extra` (`services/supabase.ts:16-23`).
- Storage adapter chooses `window.localStorage` on web, `expo-secure-store` on native, in-memory map otherwise (`services/supabase.ts:57-101`).
- `flowType: 'implicit'` is **explicit** (not default) — comment at `services/supabase.ts:120-126` explains the callback at `app/(auth)/callback.tsx` parses tokens from the hash, so PKCE would break it (this is already in the user's feedback memory).
- `detectSessionInUrl: false`, autoRefresh on, persistSession on.
- Custom `fetch` wrapper adds a 30s abort timeout and a `[SUPABASE-FETCH]` diagnostic log per request (`services/supabase.ts:137-188`). `'x-client-info': 'regattaflow-app'` is still sent on every request (`services/supabase.ts:135`) — leftover branding.
- 393 migrations under `supabase/migrations/`. Oldest visible: `20241130...`, latest dated 2026-05.
- 57 edge functions under `supabase/functions/` — notable ones for the audit:
  - AI: `anthropic-skills-proxy`, `race-coaching-chat`, `generate-race-coaching`, `clinical-reasoning-evaluate`, `step-plan-suggest`, `sail-analysis-chat`, `inspiration-extract`, `playbook-{ingest-debrief, ingest-inbox, pattern-detect, qa, weekly-review, cross-interest}`, `extract-course-from-{document,text,url}`, `extract-pdf-text`, `extract-race-{details,info}`, `extract-url-metadata`, `coach-matching`, `course-checkout` (LLM), `club-scrape`, `club-onboarding`.
  - Stripe: `blueprint-checkout`, `course-checkout`, `create-checkout-session`, `create-org-checkout-session`, `create-payment-intent`, `create-stripe-connect-account`, `stripe-balance`, `stripe-connect-dashboard`, `stripe-connect-status`, `stripe-create-payout`, `stripe-transactions`, `stripe-webhooks`, `verify-purchase`.
  - Notifications: `send-email`, `send-push-notification`, `send-team-invite`, `send-trial-reminder`, `send-welcome-email`, `send-sailor-onboarding-emails`, `session-reminders`, `expire-booking-requests`, `on-registration-created`.
  - Auth: `firebase-auth-bridge` (legacy bridge, see "Dead code smells").

Vocabulary lives in a `betterat_vocabulary` table; client falls back to in-file maps when the table is empty or unreachable (`lib/vocabulary.ts:30-292`).

## 8. Firebase usage

Strictly a bridge for legacy auth tokens. `lib/auth/firebaseBridge.ts` + `supabase/functions/firebase-auth-bridge/index.ts` exchange a Firebase HKDW token for a Supabase session during the auth callback (`app/_layout.tsx:11-19`). No Firebase client SDK in `package.json`. No live Firestore/Realtime DB usage observed.

## 9. Anthropic / OpenAI clients

**Anthropic SDK on the client is *forbidden***. `services/ai/AIClient.ts:1-44` shows the "AIClient" is just a thin Supabase-edge-function invoker — it routes everything to `supabase.functions.race-coaching-chat` (or another named function via `invokeAIEdgeFunction`). The class accepts an `_apiKey` arg but never uses it.

The real `@anthropic-ai/sdk` imports (from grep `from '@anthropic-ai/sdk'` or `new Anthropic(`) all live in:
- `supabase/functions/*/index.ts` — `club-scrape`, `coach-matching`, `club-onboarding` (edge functions get the API key from env).
- `api/telegram/webhook.ts`, `api/whatsapp/webhook.ts` — Vercel serverless.
- `services/coach/CoachService.ts`, `services/agents/{Base,Conversational}OnboardingAgent.ts`, `services/TuningGuideExtractionService.ts` — these *can* run in node contexts (scripts/seeders) but the agent base guards against shipping a key to the client.
- `scripts/*` — seeders, skill uploaders, smoke tests.

The legacy `services/ai/ClaudeClient.ts` is a 12-line `@deprecated` re-export of `AIClient` for back-compat (`services/ai/ClaudeClient.ts:1-12`).

There are also `EnhancedClaudeClient.ts`, `EnhancedAIClient.ts`, and `EnhancedAIIntegrationService.ts` in `services/ai/` — three different generations of wrappers. **Pick-one-and-delete-the-rest is a candidate for the synthesis pass.**

Google Generative AI is referenced (per `CLAUDE.md`) but I did not find concrete usage in this pass — flag for Pass 6.

No OpenAI SDK in dependencies.

## 10. Conventions

| Convention | Source |
| --- | --- |
| `@/` alias = repo root | `tsconfig.json` / `babel.config.js` |
| Cross-platform alerts via `lib/utils/crossPlatformAlert.ts` | `CLAUDE.md` |
| Services: PascalCase classes + `Service` suffix, often singleton static methods | `services/` |
| Hooks: camelCase, `use` prefix, one file per concern | `hooks/` (247 files) |
| Platform variants: `.native.tsx`, `.web.tsx` | e.g. `providers/StripeProvider.{native,web}.tsx` |
| Logging: `createLogger('namespace')` from `lib/utils/logger.ts` | used in `services/supabase.ts:6`, `providers/InterestProvider.tsx:33` |
| Env: `EXPO_PUBLIC_*` for client-readable, plain names for server | per Expo + `.env.example` |
| RegattaFlow → BetterAt migration | partial — see dead code smells |

## 11. Dead code smells (carry into later passes)

| # | Smell | Evidence |
| --- | --- | --- |
| 1 | **Three generations of AI client wrappers** — `AIClient`, `EnhancedAIClient`, `EnhancedClaudeClient`, `EnhancedAIIntegrationService`, plus deprecated `ClaudeClient` re-export | `services/ai/AIClient.ts:41`, `services/ai/ClaudeClient.ts:1-12`, `services/ai/EnhancedAIClient.ts`, `services/ai/EnhancedClaudeClient.ts`, `services/ai/EnhancedAIIntegrationService.ts` |
| 2 | **`StripeProvider.tsx.old`** kept in git | `providers/StripeProvider.tsx.old` |
| 3 | **`app/legacy.tsx`** screen | `app/legacy.tsx` |
| 4 | **`regattaflow`/`RegattaFlow` strings in 100+ source files** post-rebrand — including the `x-client-info` Supabase header (`services/supabase.ts:135`), references in `app/_layout.tsx`, `services/supabase.ts`, `providers/AuthProvider.tsx`, ~90 components and services. None breaks behavior but they will leak into headers, logs, share copy, OG images (`api/public/steps/[token]/og.ts`). | `grep RegattaFlow\|regattaflow → 65+ occurrences across ≥100 files` |
| 5 | **Apple/Google sign-in identifiers still tied to RegattaFlow developer accounts** — iOS reverse-client-id in `app.config.js:90`; "Sign in with RegattaFlowWeb" string in screenshots is from those developer-console projects, not from this repo. | `app.config.js:90`, `~/Desktop/betteratredesign/Screenshot 2026-05-08 at 7.40.55 AM.png` |
| 6 | **`SUPABASE-DIAG` bundle marker** + verbose `[SUPABASE-FETCH]` per-request console logs shipped to prod web build | `services/supabase.ts:13`, `:148-167` |
| 7 | **Coach persona partly deprecated** — `lib/navigation-config.ts:118-119` comment: *"Legacy coach users now get the same tabs as learners (coach persona deprecated)"* — but the `'coach'` switch case in `getNavItemsForUserType` (`lib/navigation-config.ts:209`) still exists, `COACH_NAV_ITEMS` is still exported (`:164-168`), tab list still has `clients`/`schedule`/`earnings` when `capabilities.hasCoaching` is set. Likely source of the *Coaches → Shift Log → Coaches* mislabel in screenshots — needs Pass 2 trace. | `lib/navigation-config.ts:118-141` |
| 8 | **`firebase-auth-bridge` edge function + `lib/auth/firebaseBridge.ts`** kept for HKDW (Hong Kong demo) migration — works, but it's pure legacy. | `supabase/functions/firebase-auth-bridge/`, `lib/auth/firebaseBridge.ts` |
| 9 | **Database `Database` interface in `services/supabase.ts:194-746` is enormous and stale** — hand-typed schema covers `users`, `club_profiles`, `club_subscriptions`, `coach_*`, `boat_classes`, `regattas`, `races`, `user_capabilities`. None of the BetterAt vocabulary tables (interests, betterat_vocabulary, user_interests, organization_memberships, etc.) are typed. New code uses `any`/explicit casts. | `services/supabase.ts:194-746` |
| 10 | **Bundle marker comment** asks future devs to bump it, indicating cache-busting was a recurring pain (`services/supabase.ts:8-13`). | same |
| 11 | **`google-play-service-account.json`** present at repo root | `google-play-service-account.json` — likely should be in `.gitignore` or moved to CI secrets. Worth a security review (out of scope for this audit but noted). |
| 12 | **Vocabulary "Clinical" vs screenshot "Shift Log"** — the nursing fallback at `lib/vocabulary.ts:53` maps `Learning Event → "Clinical"` and `getEventTabTitle` takes the last word, so tab label *should* be `"Clinical"`. Screenshots show `"Shift Log"` in some places. Either the DB row overrides to `"Clinical Shift"` (last word: `"Shift"`) or another label source is in play. Trace in Pass 2. | `lib/vocabulary.ts:52-68`, `lib/navigation-config.ts:58-70`, screenshots |

## 12. App identity reality-check

- This codebase **is BetterAt** (`package.json` name, `app.config.js` name + slug + bundle id all say so).
- The user's working hypothesis that *"Apple sign-in says RegattaFlowWeb because of a developer-console issue, not the code"* is **confirmed** for the iOS Apple Sign-in surface and the Google iOS URL scheme (`app.config.js:90`) — no code change in this repo would fix it; those need to be re-provisioned in the Apple/Google developer consoles.
- The user-facing branding bug *inside the app* (RegattaFlow strings in 100+ files) is a separate, code-fixable issue and will be surfaced in the synthesis as a P1 cleanup with a measurable scope.

---

Pass 1 deliverable: structural map + lens for everything that follows. Pass 2 will trace interest-aware navigation and bottom out the `"Shift Log"`/`"Coaches"` mislabel mystery.
