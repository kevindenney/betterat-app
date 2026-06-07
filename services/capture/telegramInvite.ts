/**
 * Telegram-first onboarding: redeem an invite token into a fully-provisioned,
 * Telegram-linked BetterAt user.
 *
 * Used by the Telegram webhook when a user taps Start with an `invite_<token>`
 * deep-link payload. Lets rural-entrepreneur personas join + start capturing
 * without ever touching the app or a signup form.
 *
 * Identity model: these are Telegram-only users, so we mint a synthetic email
 * (`tg-<telegram_user_id>@telegram.betterat.app`) and a throwaway password the
 * user never sees. The `on_auth_user_created` trigger creates the `public.users`
 * row and `trg_auth_users_profile_sync` creates `profiles` (full_name from
 * metadata), so this helper only seeds the interest and consumes the invite.
 *
 * Relative imports only — this file is reachable from the Vercel `api/` tree,
 * which cannot resolve `@/` aliases.
 */
import type { createClient } from '@supabase/supabase-js';

type ServiceClient = ReturnType<typeof createClient>;

export interface TelegramInviteUser {
  telegramUserId: number | string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export type ProvisionFailure =
  | 'not-found'
  | 'used'
  | 'expired'
  | 'interest-missing'
  | 'create-failed';

export interface ProvisionResult {
  ok: boolean;
  userId?: string;
  fullName?: string;
  reason?: ProvisionFailure;
}

const SYNTHETIC_EMAIL_DOMAIN = 'telegram.betterat.app';

function syntheticEmailFor(telegramUserId: number | string): string {
  return `tg-${telegramUserId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function deriveFullName(tg: TelegramInviteUser, inviteName?: string | null): string {
  const fromTelegram = [tg.firstName, tg.lastName].filter(Boolean).join(' ').trim();
  return (
    (inviteName && inviteName.trim()) ||
    fromTelegram ||
    (tg.username ? `@${tg.username}` : 'BetterAt User')
  );
}

export async function provisionUserFromInvite(
  supabase: ServiceClient,
  token: string,
  tg: TelegramInviteUser,
): Promise<ProvisionResult> {
  // 1. Validate the invite.
  const { data: invite } = await supabase
    .from('telegram_invites')
    .select('token, interest_slug, organization_id, full_name, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite) return { ok: false, reason: 'not-found' };
  if (invite.used_at) return { ok: false, reason: 'used' };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // 2. Resolve the seed interest.
  const { data: interest } = await supabase
    .from('interests')
    .select('id')
    .eq('slug', invite.interest_slug)
    .maybeSingle();
  if (!interest?.id) return { ok: false, reason: 'interest-missing' };

  // 3. Create (or recover) the Telegram-only auth user.
  const email = syntheticEmailFor(tg.telegramUserId);
  const fullName = deriveFullName(tg, invite.full_name);

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      telegram_user_id: String(tg.telegramUserId),
    },
  });

  let userId = created?.user?.id;
  if (createErr || !userId) {
    // The synthetic identity may already exist (re-redeem / retried webhook).
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    userId = existing?.id;
    if (!userId) return { ok: false, reason: 'create-failed' };
  }

  // 4. Seed the interest as primary + active (drives capture entitlement).
  await supabase
    .from('user_interests')
    .upsert(
      {
        user_id: userId,
        interest_id: interest.id,
        is_primary: true,
        is_active: true,
      },
      { onConflict: 'user_id,interest_id' },
    );

  // 5. Best-effort org membership when the invite is org-scoped.
  if (invite.organization_id) {
    const { data: existingMembership } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('user_id', userId)
      .eq('organization_id', invite.organization_id)
      .maybeSingle();
    if (!existingMembership) {
      await supabase.from('organization_memberships').insert({
        user_id: userId,
        organization_id: invite.organization_id,
        role: 'member',
        status: 'active',
        membership_status: 'active',
      });
    }
  }

  // 6. Consume the invite.
  await supabase
    .from('telegram_invites')
    .update({ used_at: new Date().toISOString(), created_user_id: userId })
    .eq('token', token);

  return { ok: true, userId, fullName };
}
