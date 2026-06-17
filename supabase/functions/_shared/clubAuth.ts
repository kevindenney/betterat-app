/**
 * Shared club-context helpers for the AI edge functions.
 *
 * Ported from the (paused) Vercel handlers' api/middleware/auth.ts +
 * api/middleware/domain.ts so the club AI surfaces can run on Supabase Edge
 * Functions instead of Vercel serverless.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204', 'PGRST205']);

// deno-lint-ignore no-explicit-any
function isMissingColumnError(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return MISSING_COLUMN_CODES.has(code) || message.includes('column');
}

/**
 * Resolve the user's active club/organization id, mirroring the Vercel
 * middleware fallback chain: users columns → active org membership → legacy
 * club_staff.
 */
export async function resolveClubId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const userSelects = [
    'active_organization_id, organization_id, club_id',
    'organization_id, club_id',
    'club_id',
  ];

  for (const fields of userSelects) {
    const { data, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) continue;
      break;
    }

    const row = (data || {}) as Record<string, unknown>;
    const candidate =
      row.active_organization_id ?? row.organization_id ?? row.club_id ?? null;
    if (candidate && typeof candidate === 'string') return candidate;
  }

  const membership = await supabase
    .from('organization_memberships')
    .select('organization_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'verified'])
    .limit(1)
    .maybeSingle();

  if (!membership.error && membership.data?.organization_id) {
    return membership.data.organization_id as string;
  }

  const legacyClub = await supabase
    .from('club_staff')
    .select('club_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!legacyClub.error && legacyClub.data?.club_id) {
    return legacyClub.data.club_id as string;
  }

  return null;
}

export type WorkspaceDomain =
  | 'sailing'
  | 'nursing'
  | 'drawing'
  | 'fitness'
  | 'generic';

function inferDomainFromInterest(value: string | null | undefined): WorkspaceDomain {
  const normalized = String(value || '').toLowerCase().trim();
  if (!normalized) return 'generic';
  if (normalized.includes('sail') || normalized.includes('regatta')) return 'sailing';
  if (normalized.includes('nurs') || normalized.includes('clinical')) return 'nursing';
  if (normalized.includes('draw') || normalized.includes('art')) return 'drawing';
  if (normalized.includes('fit') || normalized.includes('golf') || normalized.includes('coach')) {
    return 'fitness';
  }
  return 'generic';
}

export function resolveWorkspaceDomainForAuth(input: {
  organizationType?: string | null;
  activeInterestId?: string | null;
  activeInterestSlug?: string | null;
}): WorkspaceDomain {
  const orgType = String(input.organizationType || '').toLowerCase().trim();

  // Security-sensitive gating always trusts persisted organization_type first.
  if (orgType === 'club' || orgType === 'yacht_club' || orgType === 'fleet') return 'sailing';
  if (orgType === 'institution') return 'nursing';

  const fromSlug = inferDomainFromInterest(input.activeInterestSlug);
  if (fromSlug !== 'generic') return fromSlug;

  const fromId = inferDomainFromInterest(input.activeInterestId);
  if (fromId !== 'generic') return fromId;

  return 'generic';
}

/**
 * Returns true when the club is a sailing workspace (the only domain these AI
 * surfaces support). Mirrors the 403 DOMAIN_GATED branch in the old handlers:
 * if the organization row is missing we do NOT gate (fail open, matching the
 * `organization && resolvedDomain !== 'sailing'` condition).
 */
export async function isSailingWorkspace(
  supabase: SupabaseClient,
  clubId: string,
): Promise<boolean> {
  const { data: organization, error } = await supabase
    .from('organizations')
    .select('organization_type, metadata')
    .eq('id', clubId)
    .maybeSingle();

  if (error || !organization) return true;

  const metadata = (organization.metadata as Record<string, unknown> | null) || {};
  const domain = resolveWorkspaceDomainForAuth({
    organizationType: (organization.organization_type as string | null) ?? null,
    activeInterestId: String(metadata.active_interest_id || ''),
    activeInterestSlug: String(metadata.active_interest_slug || metadata.interest_slug || ''),
  });

  return domain === 'sailing';
}

export interface ClubContext {
  name: string | null;
  isSailing: boolean;
  found: boolean;
}

/**
 * Resolve a club's display name + sailing-domain status in a single lookup.
 *
 * The id space is split on dev: the client (and `club_events.club_id`) carries
 * a legacy `clubs.id`, while `resolveClubId` returns a live `organizations.id`.
 * The abandoned `club_profiles` table holds neither, so we try `clubs` first,
 * then `organizations`, and fail open (sailing) when the id matches neither —
 * mirroring the old handler's `organization && domain !== 'sailing'` gate.
 */
export async function loadClubContext(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubContext> {
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, club_type')
    .eq('id', clubId)
    .maybeSingle();

  if (club) {
    const domain = resolveWorkspaceDomainForAuth({
      organizationType: (club.club_type as string | null) ?? null,
    });
    return { name: (club.name as string) ?? null, isSailing: domain === 'sailing', found: true };
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('name, organization_type, metadata')
    .eq('id', clubId)
    .maybeSingle();

  if (organization) {
    const metadata = (organization.metadata as Record<string, unknown> | null) || {};
    const domain = resolveWorkspaceDomainForAuth({
      organizationType: (organization.organization_type as string | null) ?? null,
      activeInterestId: String(metadata.active_interest_id || ''),
      activeInterestSlug: String(metadata.active_interest_slug || metadata.interest_slug || ''),
    });
    return { name: (organization.name as string) ?? null, isSailing: domain === 'sailing', found: true };
  }

  return { name: null, isSailing: true, found: false };
}

/**
 * Tolerant JSON extraction for Gemini output: strips ```json fences and grabs
 * the first {...} block if the model wrapped it in prose.
 */
// deno-lint-ignore no-explicit-any
export function extractJson(raw: string): any {
  const trimmed = String(raw).trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw new Error('AI response was not valid JSON');
  }
}
