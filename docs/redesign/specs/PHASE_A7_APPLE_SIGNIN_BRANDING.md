# Phase A.7 Spec: Apple Sign-In Branding Audit

## Goal

Verify and correct Apple sign-in branding so the iOS authentication surface presents BetterAt, not RegattaFlow, for organization adoption readiness. This phase is primarily an audit plus external Apple Developer / Supabase OAuth configuration check. It should produce code changes only if the repo still contains auth-facing RegattaFlow branding in files that affect Apple sign-in.

## Source

- Master backlog Phase A.7.
- Current app config and auth implementation.
- No visual canonical applies; this is platform/auth hygiene.

## Pre-Execution Reality Check

Before changing anything, Claude Code must verify the current state:

```bash
sed -n '1,130p' app.config.js
sed -n '1,130p' ios/BetterAt/Info.plist
sed -n '1480,1585p' providers/AuthProvider.tsx
sed -n '1,190p' lib/auth/nativeOAuth.ts
rg -n "RegattaFlow|BetterAt|Sign in with Apple|Continue with Apple|Apple Sign-In|apple" app components providers services lib ios android app.config.js eas.json -g '*.{ts,tsx,js,json,plist,xml}'
```

Verified at spec-write time:

- `app.config.js` uses `name: 'BetterAt'`, `slug: 'betterat-app'`, `scheme: 'betterat'`, iOS `bundleIdentifier: 'com.betterat.app'`, and `usesAppleSignIn: true`.
- `ios/BetterAt/Info.plist` has `CFBundleDisplayName` set to `BetterAt`.
- Apple auth is implemented in `providers/AuthProvider.tsx` and `lib/auth/nativeOAuth.ts`.
- Several legacy `RegattaFlow` strings remain in non-auth surfaces such as public sailing share pages, legacy onboarding copy, subscription copy, and old RegattaFlow-branded sailing areas. Those are not automatically part of A.7.

Stop and surface if:

- App display name or bundle ID differs from `BetterAt` / `com.betterat.app`.
- Apple auth has moved out of `providers/AuthProvider.tsx` and `lib/auth/nativeOAuth.ts`.
- Supabase/Apple service configuration cannot be verified by repo or human-provided screenshots.

## Commit Boundaries

### Commit 1: Repo Branding Audit

Message:

```text
docs(auth): audit Apple sign-in branding
```

Files:

- New `docs/redesign/APPLE_SIGNIN_BRANDING_AUDIT.md`

Produce an audit table:

- Repo file / external surface.
- Current brand shown.
- Affects Apple sign-in yes/no.
- Action required.

Include at minimum:

- `app.config.js`
- `ios/BetterAt/Info.plist`
- `providers/AuthProvider.tsx`
- `lib/auth/nativeOAuth.ts`
- `lib/i18n/locales/en/auth.json`
- `app/(auth)/*` Apple sign-in buttons.
- Supabase Auth provider display name / redirect URLs (external check).
- Apple Developer App ID, Services ID, Bundle ID, Sign in with Apple capability (external check).

### Commit 2: Auth-Facing Copy Fixes, If Needed

Message:

```text
chore(auth): align Apple sign-in copy with BetterAt
```

Files:

- Only auth-facing files identified by Commit 1.

Allowed changes:

- Replace `RegattaFlow` with `BetterAt` in auth/OAuth/sign-in copy.
- Update Apple sign-in button context copy if it mentions the old brand.
- Update i18n auth strings if they contain the old brand.

Not allowed:

- Do not sweep every `RegattaFlow` string in the repo. Public sailing share pages and legacy sailing product copy are separate brand-migration work.
- Do not change OAuth implementation behavior.
- Do not change bundle ID, scheme, EAS config, or Apple team IDs without human confirmation.

Skip Commit 2 if no auth-facing copy fixes are needed.

### Commit 3: External Configuration Verification Note

Message:

```text
docs(auth): record Apple sign-in external branding check
```

Files:

- `docs/redesign/APPLE_SIGNIN_BRANDING_AUDIT.md`
- Optional `docs/redesign/MASTER_IMPLEMENTATION_BACKLOG.md` status update if the human confirms external settings.

Record the external checks the human or executor must perform:

- Apple Developer Console: App name/display name for bundle `com.betterat.app`.
- Apple Developer Console: Sign in with Apple capability enabled for the BetterAt bundle.
- Supabase Auth Apple provider: client ID / bundle ID uses BetterAt app ID, redirect URL is correct, provider display name is not RegattaFlow.
- EAS credentials: bundle identifier and Apple team match the intended BetterAt app.

This commit can land as “verified” only with human confirmation or screenshots/logs from the external consoles.

## Files to Change

- `docs/redesign/APPLE_SIGNIN_BRANDING_AUDIT.md`
- Auth-facing files only if the audit finds a real BetterAt/RegattaFlow mismatch.
- `docs/redesign/MASTER_IMPLEMENTATION_BACKLOG.md` only for status after verification.

## Files to NOT Change

- Do not change visual redesign canonicals.
- Do not change non-auth legacy RegattaFlow copy in public sailing/share pages.
- Do not change `app.config.js`, `ios/BetterAt/Info.plist`, or EAS credentials unless the audit proves they are wrong and the human confirms.
- Do not touch `providers/AuthProvider.tsx` control flow unless required for a branding string.

## Cutover Flag

None. This is branding/config hygiene, not a runtime feature rollout. External Apple/Supabase settings cannot be feature-flagged inside the app.

## Test Approach

Repo checks:

```bash
npm run typecheck
rg -n "RegattaFlow" app components providers services lib ios android app.config.js -g '*.{ts,tsx,js,json,plist,xml}'
```

The grep is not expected to be zero. The executor must classify results and ensure no auth-facing Apple sign-in surface still displays RegattaFlow.

Manual checks:

- iOS simulator or device: Apple sign-in button appears in auth flow and app name presented by the native Apple sheet is BetterAt.
- Supabase redirect flow still completes.
- Existing Google/email auth flows still work.

## Rollback Path

Revert any repo copy-fix commit. External Apple/Supabase changes should be documented before modification so they can be restored manually if needed.

## Risks and Open Questions

- External console state is not fully knowable from the repo. Do not mark A.7 shipped until Apple Developer and Supabase provider settings are verified.
- Broad RegattaFlow copy cleanup is out of scope. The risk is turning a narrow auth-branding check into a whole-product brand migration.
- Apple sign-in sheets may display app metadata controlled by Apple Developer, not local source files; local repo correctness is necessary but not sufficient.
