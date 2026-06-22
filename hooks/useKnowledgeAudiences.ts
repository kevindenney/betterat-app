/**
 * useKnowledgeAudiences — the audiences the signed-in user can address a
 * venue-knowledge post to: their active fleets (fleet_members), active org
 * memberships, blueprints they subscribe to or own, and cohorts they belong
 * to. Public is implicit and always available; this hook returns only the
 * membership-gated options.
 *
 * Mirrors the RLS author gate (can_access_venue_scope) so the composer never
 * offers a scope the insert policy would reject.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { KnowledgeScopeType } from '@/types/community-feed';
import { isResolvedOrgMembershipActive } from '@/hooks/orgMembershipStatus';

export interface KnowledgeAudience {
  scopeType: Extract<KnowledgeScopeType, 'fleet' | 'org' | 'blueprint' | 'cohort'>;
  scopeId: string;
  name: string;
}

export function useKnowledgeAudiences() {
  const { user } = useAuth();
  const userId = user?.id || null;

  return useQuery<KnowledgeAudience[]>({
    queryKey: ['knowledge-audiences', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];

      const [fleetRes, orgRes, subRes, ownedRes, cohortRes] = await Promise.all([
        supabase
          .from('fleet_members')
          .select('fleet_id, fleets(id, name)')
          .eq('user_id', userId)
          .eq('status', 'active'),
        supabase
          .from('organization_memberships')
          .select('organization_id, status, membership_status, organizations(id, name, is_active)')
          .eq('user_id', userId),
        supabase
          .from('blueprint_subscriptions')
          .select('blueprint_id, timeline_blueprints(id, title)')
          .eq('subscriber_id', userId),
        supabase
          .from('timeline_blueprints')
          .select('id, title')
          .eq('user_id', userId)
          .eq('is_published', true),
        supabase
          .from('betterat_org_cohort_members')
          .select('cohort_id, betterat_org_cohorts(id, name)')
          .eq('user_id', userId),
      ]);

      const audiences: KnowledgeAudience[] = [];
      const seen = new Set<string>();
      const push = (a: KnowledgeAudience) => {
        const key = `${a.scopeType}:${a.scopeId}`;
        if (seen.has(key)) return;
        seen.add(key);
        audiences.push(a);
      };

      for (const row of fleetRes.data || []) {
        const fleet = Array.isArray((row as any).fleets)
          ? (row as any).fleets[0]
          : (row as any).fleets;
        if (fleet?.id && fleet?.name) {
          push({ scopeType: 'fleet', scopeId: fleet.id, name: fleet.name });
        }
      }

      for (const row of orgRes.data || []) {
        if (!isResolvedOrgMembershipActive(row as any)) continue;
        const org = Array.isArray((row as any).organizations)
          ? (row as any).organizations[0]
          : (row as any).organizations;
        if (org?.id && org?.name && org.is_active !== false) {
          push({ scopeType: 'org', scopeId: org.id, name: org.name });
        }
      }

      for (const row of subRes.data || []) {
        const bp = Array.isArray((row as any).timeline_blueprints)
          ? (row as any).timeline_blueprints[0]
          : (row as any).timeline_blueprints;
        if (bp?.id && bp?.title) {
          push({ scopeType: 'blueprint', scopeId: bp.id, name: bp.title });
        }
      }

      for (const bp of ownedRes.data || []) {
        if ((bp as any).id && (bp as any).title) {
          push({ scopeType: 'blueprint', scopeId: (bp as any).id, name: (bp as any).title });
        }
      }

      for (const row of cohortRes.data || []) {
        const cohort = Array.isArray((row as any).betterat_org_cohorts)
          ? (row as any).betterat_org_cohorts[0]
          : (row as any).betterat_org_cohorts;
        if (cohort?.id && cohort?.name) {
          push({ scopeType: 'cohort', scopeId: cohort.id, name: cohort.name });
        }
      }

      return audiences;
    },
  });
}
