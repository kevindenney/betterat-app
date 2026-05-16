# HKDW iOS Linking Audit — BetterAt URLs

Date: 2026-05-16  
Auditor: Codex  
HKDW repo inspected: `/Users/kdenney/Developer/DragonWorldsHK2027`  
BetterAt repo output path: `docs/redesign/HKDW_IOS_LINKING_AUDIT_2026-05-16.md`

## Scope

Read-only audit of the HKDW iOS app's "About BetterAt" surface.

Commands used in the HKDW repo were read-only: `git status`, `rg`, `nl`, and `sed`.
The HKDW repo already had unrelated modified/untracked files before this audit; none were touched.

## Relevant Source

- `src/screens/tabs/MoreScreen.tsx:292-298` defines the More-row/tab item:
  `id: 'about-betterat'`, title `About BetterAt`, component `AboutRegattaFlowScreen`.
- `src/screens/AboutRegattaFlowScreen.tsx:24-70` renders the About BetterAt screen and chooses the lead card from `useOnboardingType()`.
- `src/screens/AboutRegattaFlowScreen.tsx:33` treats `undefined` role and `participant` as the Sailor path.
- `src/components/about/ClaimBetterAtCard.tsx:52-156` renders the Sailor claim card and opens the actual BetterAt URL.
- `src/components/about/RoleBetterAtCard.tsx:65-80` renders non-Sailor cards and opens `defaultBetteratUrlForRole(role)`.
- `src/types/community.ts:240-256` defines the non-Sailor role-to-path mapping.
- `src/config/regattaFlow.ts:19,43-60` defines `BETTERAT_BASE_URL = 'https://better.at'` and token-bridge URL construction.

## Findings

The "About BetterAt" row exists in the More/App section and is not role-gated at the row level.
Role-specific behavior happens inside `AboutRegattaFlowScreen`.

The current HKDW app does **not** send all four roles to `https://better.at/redeem`.
No `/redeem` BetterAt landing URL was found in the app-side About BetterAt link path.

The only `/redeem` string found in this flow is the app's backend call to
`/api/betterat/redeem` in `src/services/betteratRedeemService.ts`.
That is not the BetterAt web landing route; it is the HKDW app's claim-status endpoint.

## Role → URL Map

| HKDW role value | Product label | About BetterAt card | URL opened from primary CTA |
|---|---|---|---|
| `participant` | Sailor | `ClaimBetterAtCard` | If `/api/betterat/redeem` returns `available`, opens returned `claimUrl` |
| `participant` | Sailor | `ClaimBetterAtCard` fallback | `https://better.at/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1` |
| `participant` | Sailor with bridge session | `ClaimBetterAtCard` fallback | `https://better.at/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1&rf_access_token=...&rf_refresh_token=...` |
| `undefined` | Unknown / pre-onboarding | `ClaimBetterAtCard` | Same as `participant` because `!role || role === 'participant'` |
| `official` | Official | `RoleBetterAtCard` | `https://better.at/officiating` |
| `media` | Media | `RoleBetterAtCard` | `https://better.at/sports-photography` |
| `spectator` | Spectator | `RoleBetterAtCard` | `https://better.at/` |

## Additional Link On Same Screen

The footer link "Visit the Dragon Worlds community" is present on the About BetterAt screen for all roles.
It opens `REGATTAFLOW_URLS.community(DRAGON_WORLDS_COMMUNITY_SLUG)`, which resolves to:

`https://better.at/community/2027-hk-dragon-worlds`

This footer is separate from the lead BetterAt card CTA.

## Impact For Phase P

Phase P BetterAt `/redeem` is ready, but HKDW iOS is not currently wired to use it from the About BetterAt tab.

Current app behavior is still:

- Sailor / unknown: blueprint URL or claim URL path, potentially with Firebase bridge tokens.
- Official: `/officiating`.
- Media: `/sports-photography`.
- Spectator: `/`.

If the desired May 20 behavior is "all four user types open `/redeem`", the HKDW app needs a follow-up code change in `AboutRegattaFlowScreen` / card CTA routing.
That change is outside this read-only audit and was not made here.
