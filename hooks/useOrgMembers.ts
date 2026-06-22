import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus';

export type OrgMember = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
};

type UseOrgMembersOptions = {
  organizationId?: string | null;
  limit?: number;
  enabled?: boolean;
};

type UseOrgMembersResult = {
  members: OrgMember[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  retry: () => void;
};

const DEFAULT_LIMIT = 200;

const normalizeStatus = (membershipStatus: unknown, status: unknown): string => {
  const primary = String(membershipStatus ?? '').trim().toLowerCase();
  const canonical = String(status ?? '').trim().toLowerCase();
  if (!primary && !canonical) return '';
  return resolveOrgMembershipStatus({
    membership_status: primary || null,
    status: canonical || null,
  });
};

const resolveDisplayName = (name: unknown, email: unknown): string => {
  const fullName = typeof name === 'string' ? name.trim() : '';
  if (fullName.length > 0) return fullName;
  const emailValue = typeof email === 'string' ? email.trim() : '';
  return emailValue.length > 0 ? emailValue : 'Unknown user';
};

export function useOrgMembers(options: UseOrgMembersOptions): UseOrgMembersResult {
  const { organizationId, enabled = true } = options;
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !organizationId || !isUuid(organizationId)) {
        setMembers([]);
        setHasMore(false);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const queryLimit = limit + 1;

      try {
        const { data: membershipsData, error: membershipsError } = await supabase
          .from('organization_memberships')
          .select('user_id, role, membership_status, status')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(queryLimit);

        if (membershipsError) {
          throw membershipsError;
        }

        const membershipRows = membershipsData || [];
        const userIds = Array.from(
          new Set(
            membershipRows
              .map((row: any) => row.user_id)
              .filter((id: unknown): id is string => typeof id === 'string' && isUuid(id))
          )
        );

        let usersById = new Map<string, { full_name?: string | null; email?: string | null }>();
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds);

          if (usersError) {
            throw usersError;
          }

          usersById = new Map(
            (usersData || []).map((user: any) => [
              String(user.id),
              {
                full_name: user.full_name ?? null,
                email: user.email ?? null,
              },
            ])
          );
        }

        const rows = membershipRows.map((row: any) => {
          const user = usersById.get(String(row.user_id)) || null;
          return { ...row, users: user };
        });

        const nextHasMore = rows.length > limit;
        const normalized = rows.slice(0, limit).map((row: any): OrgMember => {
          const user = Array.isArray(row.users) ? row.users[0] : row.users;
          const status = normalizeStatus(row.membership_status, row.status);
          const email = typeof user?.email === 'string' ? user.email : null;
          return {
            userId: String(row.user_id),
            name: resolveDisplayName(user?.full_name, email),
            email,
            role: String(row.role || 'member'),
            status: status || 'unknown',
          };
        });

        if (!cancelled) {
          setMembers(normalized);
          setHasMore(nextHasMore);
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          setMembers([]);
          setHasMore(false);
          setError(fetchError?.message || 'Unable to load organization members.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, limit, organizationId, reloadKey]);

  return useMemo(
    () => ({
      members,
      loading,
      error,
      hasMore,
      retry,
    }),
    [members, loading, error, hasMore, retry]
  );
}
