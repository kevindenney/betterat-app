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
import type { DescriptorValues } from '@/lib/profile-descriptors';
import { isResolvedOrgMembershipActive } from '@/hooks/orgMembershipStatus';

export interface PersonTrajectoryItem {
  stepId: string;
  title: string;
  settled: boolean;
  whenISO: string | null;
  interestName: string | null;
  interestSlug: string | null;
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
  /** Verbatim quote from the strongest evidence row; null when none stored. */
  evidence?: string | null;
  /** Provenance label for that quote, e.g. "From “Two-boat testing” · May 2026". */
  provenance?: string | null;
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

export interface PersonInterest {
  name: string;
  slug: string;
  isPrimary?: boolean;
}

/** Which public-face CTAs the viewed person allows. Null pre-auth / on error. */
export interface PersonInteractions {
  allowFollow: boolean;
  allowMessage: boolean;
  allowSuggestStep: boolean;
  allowReflect: boolean;
}

/**
 * Effective per-section visibility for the native public face, as resolved by
 * the RPC (owner always sees everything; peers/preview see the stored flag).
 * The screen gates each section render on these so toggles actually take effect.
 */
export interface PersonSectionFlags {
  framing: boolean;
  workingOnNow: boolean;
  capabilities: boolean;
  practiceTimeline: boolean;
  practiceCircle: boolean;
  events: boolean;
}

/** Default-allow section flags used before the RPC resolves / on error. */
export const DEFAULT_SECTION_FLAGS: PersonSectionFlags = {
  framing: true,
  workingOnNow: true,
  capabilities: true,
  practiceTimeline: true,
  practiceCircle: true,
  events: true,
};

export interface PersonEvent {
  resultId: string;
  regattaName: string;
  raceNumber: number | null;
  venue: string | null;
  whenISO: string | null;
  position: number | null;
  /** Boats in this race (same regatta + race_number); null when unknown. */
  fleetSize: number | null;
  /** OCS / DNF / DNS etc. — null for a clean finish. */
  statusCode: string | null;
}

export interface PersonPublicSections {
  trajectory: PersonTrajectoryItem[];
  /** Total settled/completed steps the viewer can see (trajectory is capped at 6). */
  stepCount: number;
  inCommonOrgs: PersonInCommonOrg[];
  publicThreads: PersonPublicThread[];
  concept: PersonConcept | null;
  capabilities: PersonCapability[];
  circle: PersonCircle | null;
  events: PersonEvent[];
  /** Total race results for the person (events list is capped). */
  eventCount: number;
  /** Flat descriptor bag from profiles.descriptors (interest-aware fields). */
  descriptorValues: DescriptorValues;
  interests: PersonInterest[];
  /** CTA permissions; null until the RPC resolves (default-allow when absent). */
  interactions: PersonInteractions | null;
  /** Effective per-section visibility; default-allow until the RPC resolves. */
  sectionFlags: PersonSectionFlags;
}

const STALE_MS = 60_000;

export interface UsePersonPublicSectionsOptions {
  /**
   * Render the person's own face as a stranger would see it: section flags
   * apply and the owner's private steps stop counting. Only meaningful when the
   * viewer IS the person (the "Preview as public" affordance in settings).
   */
  previewAsPublic?: boolean;
}

export function usePersonPublicSections(
  userId: string | null | undefined,
  options: UsePersonPublicSectionsOptions = {},
) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const previewAsPublic = Boolean(options.previewAsPublic);
  // In preview, treat the owner as a non-self stranger for every direct query
  // and for the RPC, so the preview matches what a real peer sees.
  const isSelf = Boolean(viewerId && viewerId === userId) && !previewAsPublic;

  return useQuery({
    queryKey: ['person-public-sections', viewerId, userId, previewAsPublic],
    enabled: Boolean(userId && viewerId),
    staleTime: STALE_MS,
    queryFn: async (): Promise<PersonPublicSections> => {
      let stepsQuery = supabase
        .from('timeline_steps')
        .select('id, title, status, completed_at, starts_at, interests(name, slug)')
        .eq('user_id', userId!)
        .in('status', ['settled', 'completed'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(6);
      if (!isSelf) {
        stepsQuery = stepsQuery.in('visibility', ['crew', 'fleet', 'public']);
      }

      // Total visible settled/completed steps — a "depth of practice" signal
      // for the follow decision. The trajectory list above is capped at 6.
      let stepCountQuery = supabase
        .from('timeline_steps')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .in('status', ['settled', 'completed']);
      if (!isSelf) {
        stepCountQuery = stepCountQuery.in('visibility', ['crew', 'fleet', 'public']);
      }

      const orgsPromise = isSelf
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from('organization_memberships')
            .select('organization_id, user_id, status, membership_status, organizations!inner(id, name, slug)')
            .in('user_id', [viewerId!, userId!]);

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
        preview_as_public: previewAsPublic,
      });

      const descriptorPromise = supabase
        .from('profiles')
        .select('descriptors, sailing_position, sailing_class, sailing_location, sailing_club, seasons_active')
        .eq('id', userId!)
        .maybeSingle();

      // Events: the person's race results. race_results is readable by any
      // authenticated viewer (no per-row owner gate), so a direct query is
      // fine — no SECURITY DEFINER hop needed.
      const eventsPromise = supabase
        .from('race_results')
        .select('id, regatta_id, race_number, position, status_code, finish_time, regattas!inner(name, start_date, start_area_name)')
        .eq('sailor_id', userId!)
        .order('finish_time', { ascending: false, nullsFirst: false })
        .limit(6);

      const eventCountPromise = supabase
        .from('race_results')
        .select('id', { count: 'exact', head: true })
        .eq('sailor_id', userId!);

      const [stepsRes, stepCountRes, orgsRes, threadsRes, faceRes, descriptorRes, eventsRes, eventCountRes] =
        await Promise.all([
          stepsQuery,
          stepCountQuery,
          orgsPromise,
          threadsPromise,
          facePromise,
          descriptorPromise,
          eventsPromise,
          eventCountPromise,
        ]);

      const trajectory: PersonTrajectoryItem[] = (stepsRes.data ?? []).map(
        (row: any) => {
          // PostgREST returns an embedded to-one as an object (or null).
          const interest = Array.isArray(row.interests) ? row.interests[0] : row.interests;
          return {
            stepId: row.id,
            title: (row.title ?? '').trim() || 'Untitled step',
            settled: row.status === 'settled',
            whenISO: row.completed_at ?? row.starts_at ?? null,
            interestName: interest?.name ?? null,
            interestSlug: interest?.slug ?? null,
          };
        },
      );
      const stepCount = stepCountRes.count ?? trajectory.length;

      // Intersect memberships client-side: keep orgs where BOTH ids appear.
      const byOrg = new Map<string, { name: string; slug: string | null; users: Set<string> }>();
      for (const row of ((orgsRes.data ?? []) as any[]).filter((membership) => isResolvedOrgMembershipActive(membership))) {
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

      // Fleet size per (regatta, race) — one extra read scoped to the
      // regattas already in the events list, counted client-side.
      const eventRows = (eventsRes.data ?? []) as any[];
      const fleetSize = new Map<string, number>();
      const regattaIds = [...new Set(eventRows.map((r) => r.regatta_id).filter(Boolean))];
      if (regattaIds.length > 0) {
        const { data: fleetRows } = await supabase
          .from('race_results')
          .select('regatta_id, race_number')
          .in('regatta_id', regattaIds);
        for (const r of (fleetRows ?? []) as { regatta_id: string; race_number: number | null }[]) {
          const key = `${r.regatta_id}:${r.race_number ?? ''}`;
          fleetSize.set(key, (fleetSize.get(key) ?? 0) + 1);
        }
      }

      const events: PersonEvent[] = eventRows.map((row) => {
        const regatta = Array.isArray(row.regattas) ? row.regattas[0] : row.regattas;
        const key = `${row.regatta_id}:${row.race_number ?? ''}`;
        return {
          resultId: row.id,
          regattaName: (regatta?.name ?? '').trim() || 'Regatta',
          raceNumber: row.race_number ?? null,
          venue: (regatta?.start_area_name ?? '').trim() || null,
          whenISO: row.finish_time ?? regatta?.start_date ?? null,
          position: row.position ?? null,
          fleetSize: fleetSize.get(key) ?? null,
          statusCode: (row.status_code ?? '').trim() || null,
        };
      });
      const eventCount = eventCountRes.count ?? events.length;

      const face = (faceRes.data ?? {}) as {
        concept?: PersonConcept | null;
        capabilities?: PersonCapability[];
        circle?: PersonCircle | null;
        interests?: PersonInterest[];
        interactions?: PersonInteractions | null;
        sections?: Partial<PersonSectionFlags> | null;
      };

      // The RPC returns effective section flags (owner→all true, peer/preview→
      // stored flag). Fall back to default-allow per field if the object is
      // missing (pre-resolve cache, error, or an older RPC without `sections`).
      const sectionFlags: PersonSectionFlags = {
        framing: face.sections?.framing ?? DEFAULT_SECTION_FLAGS.framing,
        workingOnNow: face.sections?.workingOnNow ?? DEFAULT_SECTION_FLAGS.workingOnNow,
        capabilities: face.sections?.capabilities ?? DEFAULT_SECTION_FLAGS.capabilities,
        practiceTimeline: face.sections?.practiceTimeline ?? DEFAULT_SECTION_FLAGS.practiceTimeline,
        practiceCircle: face.sections?.practiceCircle ?? DEFAULT_SECTION_FLAGS.practiceCircle,
        events: face.sections?.events ?? DEFAULT_SECTION_FLAGS.events,
      };

      const d = descriptorRes.data as {
        descriptors: DescriptorValues | null;
        sailing_position: string | null;
        sailing_class: string | null;
        sailing_location: string | null;
        sailing_club: string | null;
        seasons_active: number | null;
      } | null;

      // Flat descriptor bag; hydrate from legacy sailing_* only when empty so
      // pre-migration sailors still render until their first re-save.
      const descriptorValues: DescriptorValues =
        d?.descriptors && typeof d.descriptors === 'object' ? { ...d.descriptors } : {};
      if (Object.keys(descriptorValues).length === 0 && d) {
        if (d.sailing_class) descriptorValues.class = d.sailing_class;
        if (d.sailing_position) descriptorValues.position = d.sailing_position;
        if (d.sailing_location) descriptorValues.location = d.sailing_location;
        if (d.sailing_club) descriptorValues.club = d.sailing_club;
        if (d.seasons_active != null) descriptorValues.seasons = String(d.seasons_active);
      }

      // Interests come from the SECURITY DEFINER public-face RPC, not a direct
      // user_interests read — RLS only lets a person read their own interest
      // rows, so a direct query would return empty for any peer viewer.
      const interests: PersonInterest[] = (face.interests ?? []).filter(
        (i): i is PersonInterest => Boolean(i?.name && i?.slug),
      );

      return {
        trajectory,
        stepCount,
        inCommonOrgs,
        publicThreads,
        concept: face.concept ?? null,
        capabilities: face.capabilities ?? [],
        circle: face.circle ?? null,
        events,
        eventCount,
        descriptorValues,
        interests,
        interactions: face.interactions ?? null,
        sectionFlags,
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
