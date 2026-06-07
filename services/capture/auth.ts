/**
 * Shared auth/db helpers for the cross-surface CaptureService.
 *
 * Step Arch C/1 — pure extraction of byte-identical helpers from
 * `api/telegram/webhook.ts` and `api/whatsapp/webhook.ts`. No behavior
 * change: same selects, same fallbacks, same return shapes.
 *
 * Used by every bot/voice adapter that needs to resolve an external
 * channel identity (telegram chat_id, whatsapp phone, in-app session)
 * to a BetterAt `AuthContext`.
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step C.
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeTier } from '../../lib/subscriptions/sailorTiers';
import { LIVELIHOOD_INTEREST_SLUGS } from '../../lib/livelihoodInterests';
import type { AuthContext } from '../mcp/server';
import type { UserContext } from './types';

/**
 * Build a Supabase client backed by the service-role key. Returns null when
 * required env vars are missing so callers can short-circuit with a sane
 * "service not configured" reply.
 */
export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve the user's effective club/organization id. Tries the various
 * generations of the `users` schema (`active_organization_id` first, falling
 * back to legacy `organization_id` / `club_id`), then `organization_memberships`
 * as a last resort.
 *
 * Returns null when no membership can be found.
 */
export async function resolveClubId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const selects = [
    'active_organization_id, organization_id, club_id',
    'organization_id, club_id',
    'club_id',
  ];

  for (const fields of selects) {
    const { data, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const code = String(error?.code ?? '');
      const msg = String(error?.message ?? '').toLowerCase();
      if (['42703', 'PGRST204', 'PGRST205'].includes(code) || msg.includes('column')) continue;
      break;
    }

    const row = (data || {}) as Record<string, unknown>;
    const candidate = row.active_organization_id ?? row.organization_id ?? row.club_id ?? null;
    if (candidate && typeof candidate === 'string') return candidate;
  }

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .in('status', ['active', 'verified'])
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}

/**
 * Resolve an `AuthContext` for the given user id by combining club id + tier
 * + email. Used by every channel adapter immediately after pairing an inbound
 * message to a BetterAt user.
 */
export async function resolveAuthContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<AuthContext> {
  const clubId = await resolveClubId(supabase, userId);
  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier, email')
    .eq('id', userId)
    .maybeSingle();

  // Livelihood/micro-enterprise personas get the capture loop for free —
  // entitlement is keyed off having an active interest in that domain, not the
  // subscription tier. See lib/livelihoodInterests + executeTool tier gate.
  const { data: livelihoodRow } = await supabase
    .from('user_interests')
    .select('interest_id, interests!inner(slug)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('interests.slug', LIVELIHOOD_INTEREST_SLUGS as readonly string[])
    .limit(1)
    .maybeSingle();

  return {
    userId,
    email: userRow?.email ?? null,
    clubId,
    tier: normalizeTier(userRow?.subscription_tier),
    captureEntitled: !!livelihoodRow,
  };
}

/**
 * Fetch the per-user context block woven into the CaptureService system prompt:
 * full name + bio (location), active interest + its description, and the
 * org name (when the user has an active membership). Returns undefined when
 * none of the lookups produce any data — caller still calls buildSystemPrompt
 * which handles undefined gracefully.
 *
 * Identical fetch shape across Telegram + WhatsApp + in-app voice so the
 * Anthropic prompt cache hits across surfaces.
 */
export async function loadUserContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clubId: string | null,
): Promise<UserContext | undefined> {
  try {
    const [profileRes, interestRes, orgRes] = await Promise.all([
      supabase.from('profiles').select('full_name, bio').eq('id', userId).maybeSingle(),
      supabase
        .from('user_interests')
        .select('interest_id, interests!inner(name, description)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      clubId
        ? supabase.from('organizations').select('name').eq('id', clubId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const interest = interestRes.data as
      | { interests?: { name?: string | null; description?: string | null } | null }
      | null;
    const profile = profileRes.data as
      | { full_name?: string | null; bio?: string | null }
      | null;
    const org = orgRes.data as { name?: string | null } | null;

    return {
      fullName: profile?.full_name ?? undefined,
      activeInterest: interest?.interests?.name ?? undefined,
      interestDescription: interest?.interests?.description ?? undefined,
      orgName: org?.name ?? undefined,
      location: profile?.bio ?? undefined,
    };
  } catch (e) {
    console.error('[capture] loadUserContext failed:', e);
    return undefined;
  }
}

/**
 * Generate a 6-character pairing code, avoiding visually-ambiguous glyphs
 * (no O/0/1/I). Used by Telegram + WhatsApp link flows when an inbound
 * message arrives from an unpaired external identity.
 */
export function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
