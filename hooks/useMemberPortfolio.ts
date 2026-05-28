/**
 * useMemberPortfolio — fetches a member's portfolio via the two RPCs.
 *
 * Pass `orgId` to call get_member_portfolio_org_scoped (org-admin
 * lens — Patricia / Szanton viewing Maya through JHSON). Omit it for
 * get_member_portfolio_full (target opted-in public OR self).
 *
 * The query surfaces typed errors so the page can render either
 * a "private portfolio" state (access denied) or a "demo backend not
 * deployed" state (RPC not found) instead of generic failures.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchMemberPortfolioFull,
  fetchMemberPortfolioOrgScoped,
  type MemberPortfolio,
} from '@/services/PortfolioService';

const STALE_MS = 60_000;

const portfolioKey = (
  targetUserId: string | null | undefined,
  orgId?: string | null,
) =>
  [
    'member-portfolio',
    targetUserId ?? 'none',
    orgId ?? 'full',
  ] as const;

export function useMemberPortfolio(
  targetUserId: string | null | undefined,
  orgId?: string | null,
) {
  return useQuery<MemberPortfolio>({
    queryKey: portfolioKey(targetUserId, orgId),
    enabled: Boolean(targetUserId),
    staleTime: STALE_MS,
    retry: false,
    queryFn: () => {
      if (!targetUserId) {
        throw new Error('targetUserId is required');
      }
      return orgId
        ? fetchMemberPortfolioOrgScoped(targetUserId, orgId)
        : fetchMemberPortfolioFull(targetUserId);
    },
  });
}
