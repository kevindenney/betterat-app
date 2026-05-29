/**
 * PortfolioService — typed client for the two member-portfolio RPCs.
 *
 * The hero surface across every demo: "here is this whole human." The
 * RPC contract was locked with Codex (round 2) to keep access tight:
 *
 *   * get_member_portfolio_full(target)
 *       — Returns the full cross-interest portfolio.
 *       — Allowed when caller = target, OR
 *         target has profile_public=true AND portfolio_public_opt_in=true.
 *
 *   * get_member_portfolio_org_scoped(target, org_id)
 *       — Returns plans + activity for target SCOPED to interests
 *         inside that org.
 *       — Allowed when caller has has_org_role_in(org_id, caller,
 *         ARRAY['owner','admin','manager','faculty','instructor']) AND
 *         target is an active member of org_id.
 *
 * Both RPCs are SECURITY DEFINER. The RPCs return a FLAT jsonb shape
 * (profile + interests[] + organizations[] + plans[] + recent_activity[]);
 * this service reshapes that into the per-interest grouped MemberPortfolio
 * the UI renders. Access denials raise typed exceptions so the page
 * can render a "private portfolio" state instead of a generic failure.
 */

import { supabase } from '@/services/supabase';

export interface PortfolioUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  initial: string;
  bio: string | null;
  profilePublic: boolean;
}

export interface PortfolioInterest {
  /** Stable interest id. */
  interestId: string;
  /** URL slug — used for vocab swaps. */
  interestSlug: string | null;
  /** Display name — "Nursing", "Sail Racing", "Lac craft business". */
  interestName: string;
  /** Hex accent color, looked up from a small per-slug table. */
  accentColor: string;
  /** Active plan, if one exists for this interest. */
  activePlan: PortfolioPlan | null;
  /** Counts so the card can show "12 steps · 3 plans" even without
   *  drilling all the way in. */
  totalPlans: number;
  totalSteps: number;
}

export interface PortfolioPlan {
  id: string;
  title: string | null;
  visionStatement: string | null;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  /** Up to 3 most-recent step previews so the card has a pulse. */
  recentSteps: PortfolioStepPreview[];
  /** Latest cohort thread activity. Reserved for a follow-up RPC; for
   *  now always null. */
  cohortPeek: PortfolioCohortPeek | null;
}

export interface PortfolioStepPreview {
  id: string;
  title: string;
  statusLabel: string;
  updatedAt: string;
}

export interface PortfolioCohortPeek {
  cohortSize: number;
  latestPostBy: string | null;
  latestPostAt: string | null;
  totalPosts: number;
}

export interface MemberPortfolio {
  user: PortfolioUser;
  interests: PortfolioInterest[];
}

export class PortfolioAccessDeniedError extends Error {
  constructor() {
    super(
      "This portfolio is private. Ask the person to share it, or sign in as someone with permission to view it."
    );
    this.name = 'PortfolioAccessDeniedError';
  }
}

export class PortfolioRpcUnavailableError extends Error {
  constructor() {
    super(
      'The portfolio access RPCs are not yet deployed in this environment.'
    );
    this.name = 'PortfolioRpcUnavailableError';
  }
}

// ─── Raw RPC shape (what Codex's RPCs actually return) ───────────────

interface RawPortfolioProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  profile_public: boolean | null;
  portfolio_public_opt_in: boolean | null;
}

interface RawInterestMembership {
  id: string;
  slug: string | null;
  name: string;
  added_at: string;
}

interface RawOrgMembership {
  id: string;
  name: string;
  slug: string | null;
  interest_slug: string | null;
  role: string | null;
}

interface RawPlan {
  id: string;
  title: string | null;
  vision_statement: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  interest_id: string | null;
  interest_slug: string | null;
}

interface RawActivity {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string;
  interest_id: string | null;
  interest_slug: string | null;
}

interface RawPortfolioFull {
  scope: 'full';
  target_user_id: string;
  profile: RawPortfolioProfile;
  interests: RawInterestMembership[];
  organizations: RawOrgMembership[];
  plans: RawPlan[];
  recent_activity: RawActivity[];
}

interface RawPortfolioOrgScoped {
  scope: 'org';
  target_user_id: string;
  org_id: string;
  profile: RawPortfolioProfile;
  organization: { id: string; name: string; slug: string | null; interest_slug: string | null };
  cohorts: { id: string; name: string; role: string | null; joined_at: string }[];
  plans: RawPlan[];
  recent_activity: RawActivity[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

const INTEREST_ACCENTS: Record<string, string> = {
  'sail-racing': '#2F8FB0',
  'sailing': '#2F8FB0',
  'nursing': '#3155B5',
  'jhu-nursing': '#3155B5',
  'lac-craft-business': '#A05A2C',
  'india-shg': '#A05A2C',
  'micro-business': '#A05A2C',
  'golf': '#0A6A56',
  'drawing': '#9333EA',
  'running': '#DC2626',
  'painting': '#C2410C',
  'reading': '#7C3AED',
  'gardening': '#15803D',
};

const STATUS_LABEL: Record<string, string> = {
  planning: 'Plan',
  planned: 'Plan',
  in_progress: 'Doing',
  doing: 'Doing',
  reflected: 'Reflected',
  reflect: 'Reflect',
  completed: 'Done',
  done: 'Done',
  pending: 'Plan',
  archived: 'Archived',
  paused: 'Paused',
};

function deriveInitial(fullName: string | null): string {
  const trimmed = fullName?.trim() ?? '';
  return trimmed.charAt(0).toUpperCase() || '?';
}

function deriveDisplayName(profile: RawPortfolioProfile): string {
  return (
    profile.full_name?.trim() ||
    profile.email?.split('@')[0] ||
    'Member'
  );
}

function accentFor(interestSlug: string | null | undefined): string {
  if (!interestSlug) return '#94A3B8';
  return INTEREST_ACCENTS[interestSlug] ?? '#94A3B8';
}

function statusLabelFor(status: string | null): string {
  if (!status) return 'Plan';
  return STATUS_LABEL[status.toLowerCase()] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function planStatus(raw: string): PortfolioPlan['status'] {
  if (raw === 'active' || raw === 'paused' || raw === 'completed' || raw === 'abandoned') {
    return raw;
  }
  return 'active';
}

function buildUser(profile: RawPortfolioProfile): PortfolioUser {
  return {
    id: profile.id,
    displayName: deriveDisplayName(profile),
    initial: deriveInitial(profile.full_name),
    avatarUrl: profile.avatar_url,
    bio: null,
    profilePublic: Boolean(profile.profile_public),
  };
}

interface InterestSlot {
  interestId: string;
  interestSlug: string | null;
  interestName: string;
}

/**
 * Group flat plans + activity arrays into per-interest cards. Picks
 * the active plan (or most-recently-started if multiple) per interest
 * and attaches up to 3 most-recent activity rows from that interest.
 */
function buildInterestCards(
  interestSlots: InterestSlot[],
  plans: RawPlan[],
  activity: RawActivity[],
): PortfolioInterest[] {
  // Bucket plans by interest_id (fallback to interest_slug when the
  // backend didn't resolve an id but did set a slug).
  const plansByInterest = new Map<string, RawPlan[]>();
  for (const p of plans) {
    const key = p.interest_id ?? p.interest_slug ?? '__none__';
    const list = plansByInterest.get(key) ?? [];
    list.push(p);
    plansByInterest.set(key, list);
  }
  const activityByInterest = new Map<string, RawActivity[]>();
  for (const a of activity) {
    const key = a.interest_id ?? a.interest_slug ?? '__none__';
    const list = activityByInterest.get(key) ?? [];
    list.push(a);
    activityByInterest.set(key, list);
  }

  // Seed cards from the interest membership list; tack on any plan
  // buckets whose interest doesn't appear in the membership list (rare
  // edge case — plan still attributes to an interest the user dropped).
  const seenKeys = new Set<string>();
  const cards: PortfolioInterest[] = interestSlots.map((slot) => {
    const key = slot.interestId;
    seenKeys.add(key);
    const interestPlans = plansByInterest.get(key) ?? [];
    const interestActivity = activityByInterest.get(key) ?? [];
    const active =
      interestPlans
        .filter((p) => p.status === 'active')
        .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
      ?? interestPlans.sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
      ?? null;
    return {
      interestId: slot.interestId,
      interestSlug: slot.interestSlug,
      interestName: slot.interestName,
      accentColor: accentFor(slot.interestSlug),
      totalPlans: interestPlans.length,
      totalSteps: interestActivity.length,
      activePlan: active
        ? {
            id: active.id,
            title: active.title,
            visionStatement: active.vision_statement,
            startedAt: active.started_at,
            endedAt: active.ended_at,
            status: planStatus(active.status),
            recentSteps: interestActivity
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 3)
              .map((step) => ({
                id: step.id,
                title: step.title ?? 'Untitled step',
                statusLabel: statusLabelFor(step.status),
                updatedAt: step.updated_at,
              })),
            cohortPeek: null,
          }
        : null,
    };
  });

  return cards;
}

function mapFullPortfolio(raw: RawPortfolioFull): MemberPortfolio {
  const slots: InterestSlot[] = raw.interests.map((i) => ({
    interestId: i.id,
    interestSlug: i.slug,
    interestName: i.name,
  }));
  return {
    user: buildUser(raw.profile),
    interests: buildInterestCards(slots, raw.plans, raw.recent_activity),
  };
}

function mapOrgScopedPortfolio(raw: RawPortfolioOrgScoped): MemberPortfolio {
  // Org-scoped view collapses to a single interest slot (the org's own
  // interest). The page still renders the per-interest card layout —
  // there's just one card.
  const slots: InterestSlot[] = raw.organization.interest_slug
    ? [
        {
          interestId: raw.organization.interest_slug,
          interestSlug: raw.organization.interest_slug,
          interestName: raw.organization.name,
        },
      ]
    : [];
  return {
    user: buildUser(raw.profile),
    interests: buildInterestCards(slots, raw.plans, raw.recent_activity),
  };
}

function isFunctionNotFound(error: { message?: string; code?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST202' ||
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('schema cache')
  );
}

function isAccessDenied(error: { message?: string; code?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === '42501' ||
    msg.includes('insufficient_privilege') ||
    msg.includes('not authorized') ||
    msg.includes('not public')
  );
}

export async function fetchMemberPortfolioFull(
  targetUserId: string,
): Promise<MemberPortfolio> {
  const { data, error } = await supabase.rpc('get_member_portfolio_full', {
    target_user_id: targetUserId,
  });
  if (error) {
    if (isFunctionNotFound(error as { message?: string; code?: string })) {
      throw new PortfolioRpcUnavailableError();
    }
    if (isAccessDenied(error as { message?: string; code?: string })) {
      throw new PortfolioAccessDeniedError();
    }
    throw new Error(error.message || 'Failed to load portfolio');
  }
  if (!data) throw new PortfolioAccessDeniedError();
  return mapFullPortfolio(data as RawPortfolioFull);
}

export async function fetchMemberPortfolioOrgScoped(
  targetUserId: string,
  orgId: string,
): Promise<MemberPortfolio> {
  const { data, error } = await supabase.rpc('get_member_portfolio_org_scoped', {
    target_user_id: targetUserId,
    org_id: orgId,
  });
  if (error) {
    if (isFunctionNotFound(error as { message?: string; code?: string })) {
      throw new PortfolioRpcUnavailableError();
    }
    if (isAccessDenied(error as { message?: string; code?: string })) {
      throw new PortfolioAccessDeniedError();
    }
    throw new Error(error.message || 'Failed to load org-scoped portfolio');
  }
  if (!data) throw new PortfolioAccessDeniedError();
  return mapOrgScopedPortfolio(data as RawPortfolioOrgScoped);
}
