# Phase 10 · HKDW → BetterAt Onboarding — Engineering Brief

**Purpose.** Build the HKDW (Hong Kong Dragon Worlds) → BetterAt onboarding flow as a real, shippable surface: web-first redeem at `better.at/r/[token]`, first-action Plan view on the same domain, smart-app banner on every BetterAt web page, and the install-sheet that surfaces at the Do tab when native capture becomes load-bearing. Ships ahead of the HKDW November 2026 event, behind a flag, with a sample token for testing.

**Prerequisites.** Phases 0–9 merged. Native app is feature-complete enough to be the "deepens" target. Public web surface for marketing/profile already exists at `better.at`.

**Source of truth.**
- `docs/redesign/ios-register/hkdw-to-betterat-onboarding-canonical.html` (full reference — 4 phases + web variant) + decisions **D21, D22, D23, D24**

**Feature flag.** New flag: `HKDW_REDEEM_FLOW`. Off in production until partnership ships.

---

## What lands

1. **Web · Redeem landing** at `better.at/r/[token]` — purple welcome pill, Kevin's avatar, italic-serif blueprint title, blueprint preview (12 steps / 6 months / 5 caps), fleet badge (63 sailors), `Accept & start preparing` CTA. Mobile Safari + desktop responsive.
2. **Web · First-action Plan view** at `better.at/practice/step/[id]` — same Plan tab Phase 1 ships natively, rendered as web. Welcome toast at top names the source (Kevin's blueprint). Web tab strip at top of page (Practice/Playbook/Discover/Profile).
3. **Smart App Banner** at the top of every BetterAt web page — pinned, dismissible, *"Open in app for voice capture & offline"* with Install button.
4. **Install-sheet at Do tab (web only)** — when the user taps Do in web, a sheet rises explaining native is needed for live capture, with `Install free` and `Not now` CTAs. Behind: the Do empty state shows in a dimmed background.
5. **Redeem token + handoff machinery** — single-use tokens. URL `better.at/r/[token]` resolves to redeem page if valid + unused; auto-creates session-level account on Accept (no form), subscribes user to the blueprint, routes to first step.
6. **Native deep link** — `betterat://r/[token]` opens the app if installed; falls back to web if not (via Universal Links on iOS).

---

## Acceptance criteria

1. Visiting `better.at/r/HKDW-WLDS-2026-XXX` (valid token) renders the redeem landing surface (web)
2. Accept button creates a session-level account (no email form), subscribes user to the HKDW blueprint, routes to `/practice/step/[first-step-id]`
3. Visiting `better.at/r/INVALID-TOKEN` shows a friendly *"This invitation has expired or already been used"* surface with a link to learn about BetterAt
4. First-action Plan view (web) shows welcome toast at top, full Plan tab content per Phase 1, web tab strip
5. Smart App Banner appears on every web page once the user has redeemed; dismissible with × that persists in localStorage for 7 days
6. Tapping Do phase tab in web triggers the install-sheet to rise; Plan + Reflect remain functional in web
7. Native deep link `betterat://r/[token]` opens the iOS app if installed; iOS Universal Links handle this transparently
8. If app not installed, deep link falls back to web redeem URL
9. Session-level account upgrade path — after 3 months, web prompts user to claim the account via email; until then, login state lives in localStorage + cookie
10. Telemetry: every redeem fires an event with `source = 'hkdw-2026'`, `token`, `userId`. Successful first-step write fires another.
11. Sample token `HKDW-WLDS-2026-SAMPLE` works in dev environment for testing without producing real database side effects
12. Flag off → `/r/[token]` URLs return 404 (or a feature-pending page); native deep link is not registered
13. Debug route gains: Redeem landing (valid token), Redeem landing (invalid token), First-action Plan view (web), Install-sheet at Do

---

## Component APIs

### Web routes

```
/r/[token]                        → RedeemLanding
/practice/step/[id]               → PlanView (Phase 1 component, web-rendered)
/practice/step/[id]/do            → DoView (web stub — triggers install-sheet)
/practice/step/[id]/reflect       → ReflectView (Phase 4 component, web-rendered)
```

### `<RedeemLanding>`

```tsx
interface RedeemLandingProps {
  token: string;
  blueprintAuthor: { name: string; affiliation: string; avatarInitials: string };
  blueprint: {
    id: string;
    title: string;
    stepCount: number;
    durationMonths: number;
    capabilities: string[];
  };
  fleetCount: number;            // 63 Worlds sailors
  fleetSampleAvatars: { initials: string; color: string }[];
  freeMonths: number;            // 3
  postFreePrice: string;         // "$9/mo"
  onAccept: () => Promise<void>;
  onSkip: () => void;
}
```

- Renders the canonical's Phase 3 layout — purple welcome pill, KD avatar, italic title, blueprint preview stats, fleet badge, Accept CTA, privacy hint
- Single-page surface; no navigation chrome

### `<SmartAppBanner>`

```tsx
interface SmartAppBannerProps {
  appName: string;
  iconUri: string;
  description: string;          // "Open in app for voice capture & offline"
  installUrl: string;           // App Store URL
  onDismiss: () => void;         // sets localStorage 'sab-dismissed' = now()
}
```

- 48-px tall, pinned at top of viewport on web pages
- Renders only when not dismissed within 7 days

### `<InstallSheet>`

```tsx
interface InstallSheetProps {
  visible: boolean;
  appName: string;
  features: { icon: string; label: string }[];  // mic, camera, offline
  onInstall: () => void;        // routes to App Store
  onNotNow: () => void;         // dismisses sheet, may set 'install-deferred' in localStorage
}
```

### `<WelcomeToast>`

```tsx
interface WelcomeToastProps {
  variant: 'subscription' | 'follow' | 'shared';
  subscriptionSource?: string;   // "Kevin's HKDW blueprint"
  count?: { steps: number; freeMonths: number; fleetSize: number };
  onDismiss: () => void;
}
```

- Purple sparkles glyph + serif italic title + sub-line
- Appears at the top of the Plan view on first land after redeem
- Dismissible × button; auto-hides after first interaction with the field-cards

---

## Backend / API

```
POST /api/redeem
  body: { token: string }
  response:
    200 → { sessionToken, userId, firstStepId, blueprintId }
    400 → { error: "expired" | "already-used" | "invalid" }

GET /api/blueprints/[id]
  response: { id, author, title, steps[], capabilities[], subscriberCount }

POST /api/account/claim
  body: { sessionToken, email, password }
  response: { userId, status: "claimed" }
  — Upgrades a session-level account to a full account
  — Called from the prompt that appears at month 2.5 of the free trial
```

---

## Schema

```sql
-- redeem_tokens (issued ahead of the event)
id, token, blueprint_id, valid_from, valid_to, used_at, used_by_user_id

-- session_accounts (anonymous-but-persistent accounts for redeem-without-email)
id, session_token, blueprint_subscription_id, expires_at (=now + 3 months),
  claimed_email, claimed_at

-- email-claim transition: copy session_account.user_id into a real users row
-- when /api/account/claim succeeds.
```

---

## Files to touch

| Area | Files |
|---|---|
| Web routes | `app/web/r/[token].tsx`, `app/web/practice/step/[id]/index.tsx`, etc. (or however the web tree is organized — Next.js / Remix / your stack) |
| Components | `components/onboarding/RedeemLanding.tsx`, `SmartAppBanner.tsx`, `InstallSheet.tsx`, `WelcomeToast.tsx` |
| Services | `services/RedeemService.ts`, `services/SessionAccountService.ts` |
| API | `api/redeem.ts`, `api/blueprints/[id].ts`, `api/account/claim.ts` |
| Native | iOS Universal Links configuration (associated domains for better.at); deep link handler for `betterat://r/[token]` |
| Telemetry | events for redeem, first-step-write, install-banner-shown, install-clicked |
| Marketing | `better.at/r/[token]` URL pattern in DNS / hosting config |
| Debug | demo states for all 4 web variants |

---

## Out of scope

- Email confirmation / drip campaigns
- Multi-event onboarding (other events than HKDW 2026) — Phase 10.1 generalizes the redeem machinery
- Post-trial conversion UI (the prompt at month 2.5) — Phase 10.1
- Affiliate / referral attribution beyond simple `source` telemetry

---

## Codex prompt (paste verbatim)

```
Task: implement Phase 10 — HKDW → BetterAt onboarding — in betterat-app.

INPUTS:
  • Brief: docs/redesign/ios-register/phase-10-hkdw-onboarding.md
  • Canonical: docs/redesign/ios-register/hkdw-to-betterat-onboarding-canonical.html (full — 4 phones + web variant)

PROCEDURE:

1. Verify inputs in repo. Copy from latest ~/Downloads project zip if missing. Commit brief on docs/ branch, merge.

2. Audit worktree. If uncommitted work in app/web/r/, components/onboarding/, services/Redeem*, services/SessionAccount*, api/redeem.ts, or in iOS Universal Links config, stop and report.

3. Read brief + canonical (all sections including web variant) end-to-end.

4. Schema:
   • redeem_tokens (id, token, blueprint_id, valid_from, valid_to, used_at, used_by_user_id)
   • session_accounts (id, session_token, blueprint_subscription_id, expires_at, claimed_email NULL, claimed_at NULL)

5. New flag HKDW_REDEEM_FLOW (separate from PRACTICE_STEP_LOOP_IOS_REGISTER — onboarding is a distinct product surface).

6. Implement:
   a. RedeemLanding component (web-first; mobile Safari layout per canonical)
   b. SmartAppBanner (pinned top of every web page, dismissible with 7-day persistence)
   c. InstallSheet (rises at Do tab on web)
   d. WelcomeToast (first-land after redeem)
   e. RedeemService + SessionAccountService
   f. API: POST /api/redeem, GET /api/blueprints/[id], POST /api/account/claim
   g. iOS Universal Links config for better.at — associated domains entitlement
   h. betterat://r/[token] deep link handler

7. Web rendering of Phase 1 (Plan) + Phase 4 (Reflect) — these components must work in web context. They use SVG, RN-Web-compatible CSS, no native-only APIs (mic/camera lives in Do, which web stubs out via InstallSheet).

8. Sample token HKDW-WLDS-2026-SAMPLE works in dev env without DB side effects (mock blueprint, mock user creation).

9. Telemetry:
   • event 'redeem_attempted' { token, success }
   • event 'redeem_completed' { token, userId, blueprintId }
   • event 'first_step_written' { userId, stepId }
   • event 'install_banner_shown' { page }
   • event 'install_clicked' { page }
   • event 'install_deferred' { page }

10. Verify all 13 acceptance criteria. Test:
    • Valid token redeem → account created → blueprint subscribed → first step loaded
    • Invalid token → friendly error
    • Smart App Banner → dismissible → 7-day persistence
    • Install-sheet at Do tab → mic icon shown → Install routes to App Store
    • Universal Link → app opens (if installed) or falls back to web

11. Flag off → /r/[token] returns 404; deep link not registered.

12. Commit coherent units. PR with:
    • Screenshots: mobile Safari redeem (valid + invalid), web Plan after redeem with toast + banner, web Do showing install-sheet
    • Native screenshots: app opens via Universal Link with token redemption flow
    • 30-second screen recording: HKDW app mockup → tap "Get started in BetterAt" → web redeem → Accept → land on Plan → start filling Step 1

OUT OF SCOPE:
  • Email drip campaigns
  • Multi-event generalization (10.1)
  • Post-trial conversion UI (10.1)
  • Affiliate attribution

CONSTRAINTS:
  • New flag HKDW_REDEEM_FLOW — separate from step-loop register
  • Web routes must work without app installed (web-first principle from D24)
  • Session-level accounts must persist 3 months without email; never block redeem on email
  • If brief conflicts with codebase, ask.
```
