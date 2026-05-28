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
 * Both RPCs are SECURITY DEFINER. When neither is callable (no
 * relationship, target hasn't opted in), the RPC returns no rows and
 * we surface a typed PortfolioAccessDeniedError so the page can render
 * a "private portfolio" state.
 *
 * Codex ships the RPCs in Wave 1 (backend slice). Until they exist,
 * supabase.rpc throws "function not found"; we surface that as
 * PortfolioRpcUnavailableError so the page renders an explanation
 * rather than a crash.
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
  /** Hex accent color. */
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
  /** Latest cohort thread activity, when this plan has a blueprint. */
  cohortPeek: PortfolioCohortPeek | null;
}

export interface PortfolioStepPreview {
  id: string;
  title: string;
  statusLabel: string;
  updatedAt: string;
}

export interface PortfolioCohortPeek {
  /** How many other plan-members have posted in the cohort thread. */
  cohortSize: number;
  /** Most recent post author (excluding the target user themselves). */
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

interface RawPortfolioRow {
  user: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    profile_public: boolean | null;
  };
  interests: {
    interest_id: string;
    interest_slug: string | null;
    interest_name: string;
    accent_color: string | null;
    active_plan: {
      id: string;
      title: string | null;
      vision_statement: string | null;
      started_at: string;
      ended_at: string | null;
      status: string;
      recent_steps: {
        id: string;
        title: string;
        status_label: string;
        updated_at: string;
      }[];
      cohort_peek: {
        cohort_size: number;
        latest_post_by: string | null;
        latest_post_at: string | null;
        total_posts: number;
      } | null;
    } | null;
    total_plans: number;
    total_steps: number;
  }[];
}

function isFunctionNotFound(error: { message?: string; code?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST202' || // PostgREST: not found
    msg.includes('does not exist') ||
    msg.includes('not found')
  );
}

function deriveInitial(
  full: string | null,
  first: string | null,
  last: string | null,
): string {
  const candidate =
    full?.trim().charAt(0) ||
    first?.trim().charAt(0) ||
    last?.trim().charAt(0) ||
    '?';
  return candidate.toUpperCase();
}

function deriveDisplayName(
  full: string | null,
  first: string | null,
  last: string | null,
): string {
  const trimmed = full?.trim();
  if (trimmed) return trimmed;
  const joined = [first, last]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' ')
    .trim();
  return joined || 'Member';
}

function mapRowToPortfolio(row: RawPortfolioRow): MemberPortfolio {
  return {
    user: {
      id: row.user.id,
      displayName: deriveDisplayName(
        row.user.full_name,
        row.user.first_name,
        row.user.last_name,
      ),
      initial: deriveInitial(
        row.user.full_name,
        row.user.first_name,
        row.user.last_name,
      ),
      avatarUrl: row.user.avatar_url,
      bio: row.user.bio,
      profilePublic: Boolean(row.user.profile_public),
    },
    interests: row.interests.map((i) => ({
      interestId: i.interest_id,
      interestSlug: i.interest_slug,
      interestName: i.interest_name,
      accentColor: i.accent_color ?? '#94A3B8',
      totalPlans: i.total_plans,
      totalSteps: i.total_steps,
      activePlan: i.active_plan
        ? {
            id: i.active_plan.id,
            title: i.active_plan.title,
            visionStatement: i.active_plan.vision_statement,
            startedAt: i.active_plan.started_at,
            endedAt: i.active_plan.ended_at,
            status: (i.active_plan.status as PortfolioPlan['status']) ?? 'active',
            recentSteps: i.active_plan.recent_steps.map((s) => ({
              id: s.id,
              title: s.title,
              statusLabel: s.status_label,
              updatedAt: s.updated_at,
            })),
            cohortPeek: i.active_plan.cohort_peek
              ? {
                  cohortSize: i.active_plan.cohort_peek.cohort_size,
                  latestPostBy: i.active_plan.cohort_peek.latest_post_by,
                  latestPostAt: i.active_plan.cohort_peek.latest_post_at,
                  totalPosts: i.active_plan.cohort_peek.total_posts,
                }
              : null,
          }
        : null,
    })),
  };
}

export async function fetchMemberPortfolioFull(
  targetUserId: string,
): Promise<MemberPortfolio> {
  const { data, error } = await supabase.rpc('get_member_portfolio_full', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    if (isFunctionNotFound(error as { message?: string; code?: string })) {
      throw new PortfolioRpcUnavailableError();
    }
    throw new Error(error.message || 'Failed to load portfolio');
  }
  if (!data) throw new PortfolioAccessDeniedError();
  return mapRowToPortfolio(data as RawPortfolioRow);
}

export async function fetchMemberPortfolioOrgScoped(
  targetUserId: string,
  orgId: string,
): Promise<MemberPortfolio> {
  const { data, error } = await supabase.rpc('get_member_portfolio_org_scoped', {
    p_target_user_id: targetUserId,
    p_org_id: orgId,
  });
  if (error) {
    if (isFunctionNotFound(error as { message?: string; code?: string })) {
      throw new PortfolioRpcUnavailableError();
    }
    throw new Error(error.message || 'Failed to load org-scoped portfolio');
  }
  if (!data) throw new PortfolioAccessDeniedError();
  return mapRowToPortfolio(data as RawPortfolioRow);
}
