/**
 * useKnowledgeAudiences — the audiences the signed-in user can address a
 * venue-knowledge post to: their active fleets (fleet_members), active org
 * memberships, and blueprints they subscribe to or own. Public is implicit
 * and always available; this hook returns only the membership-gated options.
 *
 * Mirrors the RLS author gate (can_access_venue_scope) so the composer never
 * offers a scope the insert policy would reject.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { KnowledgeScopeType } from '@/types/community-feed';

export interface KnowledgeAudience {
  scopeType: Extract<KnowledgeScopeType, 'fleet' | 'org' | 'blueprint'>;
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

      const [fleetRes, orgRes, subRes, ownedRes] = await Promise.all([
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
          .select('blueprint_id, timeline_blueprints(id, name)')
          .eq('subscriber_id', userId),
        supabase
          .from('timeline_blueprints')
          .select('id, name')
          .eq('user_id', userId)
          .eq('is_published', true),
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
        const status = (row as any).status || (row as any).membership_status;
        if (status !== 'active' && status !== 'invite_accepted') continue;
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
        if (bp?.id && bp?.name) {
          push({ scopeType: 'blueprint', scopeId: bp.id, name: bp.name });
        }
      }

      for (const bp of ownedRes.data || []) {
        if ((bp as any).id && (bp as any).name) {
          push({ scopeType: 'blueprint', scopeId: (bp as any).id, name: (bp as any).name });
        }
      }

      return audiences;
    },
  });
}
