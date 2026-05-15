# Phase B.9 Spec: Share Dialog Wrapper

## Goal

Introduce a flagged iOS-register share dialog wrapper for BetterAt content, starting with steps and blueprints. The dialog presents the canonical three-layer model: native/system sharing, BetterAt-specific actions, and visibility. V1 must reuse existing share-token and native share infrastructure; it must not invent follower approval, suggestion delivery, or new public-link permissions.

This phase is infrastructure for future share affordances. It does not change the Practice route, does not alter tab labels, and does not implement the Suggest bar itself.

## Source Canonicals

- Design addendum: `docs/redesign/FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, Surface C: Share Dialog.
- Visual canonical: `docs/redesign/ios-register/four-small-surfaces-canonical.html`, Frame 3: Share dialog.
- Existing share components/services: `components/step/ShareStepSheet.tsx`, `services/ShareTokenService.ts`, `components/blueprint/PublishBlueprintSheet.tsx`, `app/blueprint/[slug].tsx`, `app/creator/[id].tsx`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

```bash
sed -n '1,280p' components/step/ShareStepSheet.tsx
sed -n '1,160p' services/ShareTokenService.ts
sed -n '1,130p' types/timeline-steps.ts
rg -n "Share\\.share|enableStepSharing|createShareToken|buildShareUrl|ShareStepSheet|share-outline" app components hooks services lib -g '*.{ts,tsx}'
rg -n "SHARE_DIALOG_IOS_REGISTER|FF_SHARE_DIALOG" lib .env* app components
```

Verified at spec-write time:

- `ShareStepSheet` already provides a step-focused modal with follower-post creation, copy-link, and native share fallback.
- `ShareTokenService` supports `target_type: 'step' | 'blueprint'`, token creation, and `/share/<token>` URLs.
- `TimelineStepVisibility` is `private | followers | coaches | organization`; there is no verified `public` value for `timeline_steps`.
- Existing direct shares still use `Share.share()` in multiple places.

Stop and surface if:

- `ShareTokenService` no longer supports both step and blueprint targets.
- A share-dialog flag already exists under another name.
- The target surface expects profile or evidence sharing first; this spec only makes step/blueprint v1 executable.

## Commit Boundaries

### Commit 1: Flag, Types, and Link Helpers

Message:

```text
feat(redesign): add share dialog model
```

Files:

- `lib/featureFlags.ts`
- New `components/share-dialog/types.ts`
- New `components/share-dialog/shareDialogModel.ts`
- New `components/share-dialog/__tests__/shareDialogModel.test.ts` or matching test convention.

Add flag:

- `SHARE_DIALOG_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_SHARE_DIALOG_IOS_REGISTER`
- Default: `false`

Types:

```ts
export type ShareDialogTargetType = 'step' | 'blueprint';
export type ShareVisibilityOption = 'public_link' | 'followers' | 'private';

export interface ShareDialogTarget {
  type: ShareDialogTargetType;
  id: string;
  title: string;
  subtitle?: string | null;
}

export interface ShareDialogActionState {
  canSendToFollower: boolean;
  canSuggestAsStep: boolean;
  canSaveToPlaybook: boolean;
  disabledReason?: string;
}
```

Model rules:

- Step target can create a `/share/<token>` URL via `createShareToken('step', id)` and `buildShareUrl(token)`.
- Blueprint target can create a `/share/<token>` URL via `createShareToken('blueprint', id)` and `buildShareUrl(token)`.
- `followers` is the default selected visibility in the UI, matching the canonical. In v1, it is UI intent only unless the target type has verified persistence support.
- `public_link` maps to token sharing, not `timeline_steps.visibility = 'public'`, because `TimelineStepVisibility` has no `public` member.
- `private` disables external link sharing for the current invocation; it does not mutate the underlying target unless a verified persistence API exists.

### Commit 2: Presentational Share Dialog

Message:

```text
feat(redesign): build iOS share dialog surface
```

Files:

- New `components/share-dialog/ShareDialog.tsx`
- New `components/share-dialog/ShareDialogPreview.tsx` if useful for internal testing
- New `components/share-dialog/index.ts`

Props:

```ts
export interface ShareDialogProps {
  visible: boolean;
  target: ShareDialogTarget;
  defaultVisibility?: ShareVisibilityOption;
  onClose: () => void;
  onNativeShare: (visibility: ShareVisibilityOption) => Promise<void>;
  onCopyLink: (visibility: ShareVisibilityOption) => Promise<void>;
  onSendToFollower?: () => void;
  onSuggestAsStep?: () => void;
  onSaveToPlaybook?: () => void;
  actionState?: ShareDialogActionState;
}
```

Render:

- Header preview: `Share step` or `Share blueprint` plus target title.
- Recent contacts row as disabled placeholder unless a verified recent-contacts source exists.
- System apps row with `Messages`, `WhatsApp`, `Mail`, `X`, `LinkedIn`, `Copy link`, `Shareable link`, `More`. These should call native share/copy flows, not direct app integrations.
- BetterAt section with `Send to follower`, `Suggest as step`, `Save to my Playbook`; disabled unless callbacks are supplied.
- Visibility section with Public link, Followers only, Private. Copy must avoid promising follower-gated access if persistence is not enforced.

### Commit 3: Step Integration Behind Flag

Message:

```text
feat(redesign): gate step sharing through share dialog
```

Files:

- `components/step/ShareStepSheet.tsx` or the verified step share mount point.
- Optional `components/share-dialog/useShareDialogHandlers.ts`.

When `SHARE_DIALOG_IOS_REGISTER` is on, step share actions use `ShareDialog`.

Implementation rules:

- Native share uses `Share.share`.
- Copy link uses `createShareToken('step', stepId)` + `buildShareUrl(token)` + existing clipboard mechanism.
- Existing follower-post creation in `ShareStepSheet` remains available either as the `Send to follower` action or as the legacy flag-off path.
- Do not remove legacy `ShareStepSheet` behavior.
- Do not touch `app/(tabs)/races.tsx`; if the desired trigger lives there, defer that wiring until A.9 is complete.

### Commit 4: Blueprint Integration Behind Flag

Message:

```text
feat(redesign): gate blueprint sharing through share dialog
```

Files:

- `app/blueprint/[slug].tsx`
- `app/creator/[id].tsx`
- Optional shared hook from Commit 3.

When the flag is on, blueprint share buttons open `ShareDialog` instead of calling `Share.share()` directly.

Implementation rules:

- Copy/shareable link uses `createShareToken('blueprint', blueprint.id)` + `buildShareUrl(token)`.
- Native share includes title and generated URL.
- `Save to my Playbook` is disabled for owner-authored blueprints unless a verified save/adopt API exists.

## Files to Change

- `lib/featureFlags.ts`
- New `components/share-dialog/*`
- `components/step/ShareStepSheet.tsx` or verified step share mount point.
- `app/blueprint/[slug].tsx`
- `app/creator/[id].tsx`
- Tests for model/link helper behavior.

## Files to NOT Change

- Do not change `app/(tabs)/races.tsx` in this phase unless A.9 has shipped and the trigger cannot be reached otherwise.
- Do not add Supabase migrations.
- Do not change `TimelineStepVisibility` type.
- Do not implement Suggest bar delivery; that is Phase L / L.5.
- Do not implement follower approval or recent-contact ranking.
- Do not change public share route behavior in `app/share/[token].tsx`.

## Cutover Flag

Required. This changes share UI, link-generation behavior, and integration flow.

- Flag: `SHARE_DIALOG_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_SHARE_DIALOG_IOS_REGISTER`
- Default: `false`

## Test Approach

Unit tests:

- Target model labels `step` and `blueprint` correctly.
- Public-link option uses share tokens rather than invalid `visibility='public'`.
- Private visibility disables link generation for the invocation.
- Disabled BetterAt actions render with disabled reasons.

Manual checks:

- Step share with flag off still shows existing behavior.
- Step share with flag on opens canonical dialog, copies a `/share/<token>` link, and native share opens.
- Blueprint share with flag on opens canonical dialog and creates a blueprint token.
- Disabled BetterAt actions do not navigate.
- Visibility selector changes UI state and does not mutate target visibility unexpectedly.

Run:

```bash
npm run typecheck
npx eslint components/share-dialog components/step/ShareStepSheet.tsx app/blueprint/'[slug]'.tsx app/creator/'[id]'.tsx --ext .ts,.tsx --max-warnings 0
```

## Rollback Path

Set `EXPO_PUBLIC_FF_SHARE_DIALOG_IOS_REGISTER=false` to restore direct legacy share behavior. Revert integration commits first if a target-specific flow breaks; the model and presentational component are inert without wiring.

## Risks and Open Questions

- The canonical says “Public,” but `TimelineStepVisibility` does not include `public`. V1 must label this as `Public link` and implement it through share tokens.
- Followers-only link enforcement is not fully verified in the current share-token service. Do not promise enforcement beyond existing `/share/<token>` behavior.
- Recent contacts, Send to follower, Suggest as step, and Save to my Playbook require separate data/product flows. This spec renders them safely but does not complete those systems.
