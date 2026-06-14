/**
 * usePersonPublicSections — real data behind the public Person surfaces.
 *
 * Powers the Discover Person calling card and the deeper public face:
 *   - trajectory: the person's settled/completed steps the viewer can see
 *   - inCommonOrgs: orgs where both viewer and person are active members
 *   - publicThreads: top-level discussion posts the person wrote on
 *     public steps
 *
 * Sections render absent when a list is empty — RLS decides what the
 * viewer can actually read, so an empty list is the privacy-correct
 * answer, not an error.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface PersonTrajectoryItem {
  stepId: string;
  title: string;
  settled: boolean;
  whenISO: string | null;
}

export interface PersonInCommonOrg {
  orgId: string;
  name: string;
  slug: string | null;
}

export interface PersonPublicThread {
  postId: string;
  stepId: string;
  snippet: string;
  stepTitle: string;
  whenISO: string;
  replies: number;
}

export interface PersonConcept {
  id: string;
  title: string;
  body: string;
  state: 'forming' | 'testing';
  weekTail: number;
  linkedStepCount: number;
  settledCount: number;
}

export interface PersonCapability {
  name: string;
  standing: 'settled' | 'working' | 'emerging';
  evidenceCount: number;
  pipLevel: number;
}

export interface PersonCircleMember {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  role?: string;
  isPrimary?: boolean;
}

export interface PersonCircle {
  mutuals: PersonCircleMember[];
  mutualCount: number;
  crew: PersonCircleMember[];
  crewCount: number;
}

export interface PersonDescriptorFields {
  sailingPosition: string | null;
  sailingClass: string | null;
  sailingLocation: string | null;
  sailingClub: string | null;
  seasonsActive: number | null;
}

export interface PersonInterest {
  name: string;
  slug: string;
}

export interface PersonPublicSections {
  trajectory: PersonTrajectoryItem[];
  inCommonOrgs: PersonInCommonOrg[];
  publicThreads: PersonPublicThread[];
  concept: PersonConcept | null;
  capabilities: PersonCapability[];
  circle: PersonCircle | null;
  descriptor: PersonDescriptorFields | null;
  interests: PersonInterest[];
}

const STALE_MS = 60_000;

export function usePersonPublicSections(userId: string | null | undefined) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const isSelf = Boolean(viewerId && viewerId === userId);

  return useQuery({
    queryKey: ['person-public-sections', viewerId, userId],
    enabled: Boolean(userId && viewerId),
    staleTime: STALE_MS,
    queryFn: async (): Promise<PersonPublicSections> => {
      let stepsQuery = supabase
        .from('timeline_steps')
        .select('id, title, status, completed_at, starts_at')
        .eq('user_id', userId!)
        .in('status', ['settled', 'completed'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(6);
      if (!isSelf) {
        stepsQuery = stepsQuery.in('visibility', ['crew', 'fleet', 'public']);
      }

      const orgsPromise = isSelf
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from('organization_memberships')
            .select('organization_id, user_id, organizations!inner(id, name, slug)')
            .in('user_id', [viewerId!, userId!])
            .eq('membership_status', 'active');

      const threadsPromise = supabase
        .from('step_discussions')
        .select('id, body, created_at, step_id, timeline_steps!step_id!inner(id, title, visibility)')
        .eq('user_id', userId!)
        .is('parent_id', null)
        .eq('timeline_steps.visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(3);

      const facePromise = supabase.rpc('get_person_public_face', {
        target_user_id: userId!,
      });

      const descriptorPromise = supabase
        .from('profiles')
        .select('sailing_position, sailing_class, sailing_location, sailing_club, seasons_active')
        .eq('id', userId!)
        .maybeSingle();

      const [stepsRes, orgsRes, threadsRes, faceRes, descriptorRes] = await Promise.all([
        stepsQuery,
        orgsPromise,
        threadsPromise,
        facePromise,
        descriptorPromise,
      ]);

      const trajectory: PersonTrajectoryItem[] = (stepsRes.data ?? []).map(
        (row: any) => ({
          stepId: row.id,
          title: (row.title ?? '').trim() || 'Untitled step',
          settled: row.status === 'settled',
          whenISO: row.completed_at ?? row.starts_at ?? null,
        }),
      );

      // Intersect memberships client-side: keep orgs where BOTH ids appear.
      const byOrg = new Map<string, { name: string; slug: string | null; users: Set<string> }>();
      for (const row of (orgsRes.data ?? []) as any[]) {
        const org = row.organizations;
        if (!org) continue;
        const entry = byOrg.get(row.organization_id) ?? {
          name: org.name,
          slug: org.slug ?? null,
          users: new Set<string>(),
        };
        entry.users.add(row.user_id);
        byOrg.set(row.organization_id, entry);
      }
      const inCommonOrgs: PersonInCommonOrg[] = [...byOrg.entries()]
        .filter(([, v]) => v.users.size >= 2)
        .map(([orgId, v]) => ({ orgId, name: v.name, slug: v.slug }));

      const threadRows = (threadsRes.data ?? []) as any[];
      const replyCounts = new Map<string, number>();
      if (threadRows.length > 0) {
        const { data: replyRows } = await supabase
          .from('step_discussions')
          .select('parent_id')
          .in('parent_id', threadRows.map((row) => row.id));
        for (const row of (replyRows ?? []) as { parent_id: string }[]) {
          replyCounts.set(row.parent_id, (replyCounts.get(row.parent_id) ?? 0) + 1);
        }
      }

      const publicThreads: PersonPublicThread[] = threadRows.map((row: any) => ({
        postId: row.id,
        stepId: row.step_id,
        snippet: (row.body ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
        stepTitle: (row.timeline_steps?.title ?? '').trim() || 'a step',
        whenISO: row.created_at,
        replies: replyCounts.get(row.id) ?? 0,
      }));

      const face = (faceRes.data ?? {}) as {
        concept?: PersonConcept | null;
        capabilities?: PersonCapability[];
        circle?: PersonCircle | null;
        interests?: PersonInterest[];
      };

      const d = descriptorRes.data as {
        sailing_position: string | null;
        sailing_class: string | null;
        sailing_location: string | null;
        sailing_club: string | null;
        seasons_active: number | null;
      } | null;

      // Interests come from the SECURITY DEFINER public-face RPC, not a direct
      // user_interests read — RLS only lets a person read their own interest
      // rows, so a direct query would return empty for any peer viewer.
      const interests: PersonInterest[] = (face.interests ?? []).filter(
        (i): i is PersonInterest => Boolean(i?.name && i?.slug),
      );

      return {
        trajectory,
        inCommonOrgs,
        publicThreads,
        concept: face.concept ?? null,
        capabilities: face.capabilities ?? [],
        circle: face.circle ?? null,
        descriptor: d
          ? {
              sailingPosition: d.sailing_position,
              sailingClass: d.sailing_class,
              sailingLocation: d.sailing_location,
              sailingClub: d.sailing_club,
              seasonsActive: d.seasons_active,
            }
          : null,
        interests,
      };
    },
  });
}

/** "Mar 2026" display form for trajectory/thread dates. */
export function formatPersonWhen(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
