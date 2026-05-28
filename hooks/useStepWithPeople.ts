/**
 * useStepWithPeople — unified people roster for one step.
 *
 * The L1 step surface had four overlapping representations of "who's on
 * this step?": "N peers" (reflectors), "X person has access" (Mine
 * discussion access), "Mine / Cohort" thread toggle (different threads,
 * not people), and a cohort avatar stack ("3+4 on this plan"). They
 * combined three actual concepts — explicit access grants, blueprint-
 * subscription cohort, and reflection authors — into a confusing
 * cluster.
 *
 * This hook merges all three into one deduplicated list of `StepPerson`
 * rows, each tagged with the relationships that apply (`isOwner`,
 * `inAccess`, `inCohort`, `hasReflected`). Callers render one chip
 * with the total count and one sheet that lists everyone once.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useCohortMates } from '@/hooks/useCohortMates';
import { useStepPeerReflections } from '@/hooks/useStepPeerReflections';
import type { StepAccessPerson } from '@/components/step/StepDiscussionInline';

export interface StepPerson {
  userId: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  isOwner: boolean;
  isViewer: boolean;
  inAccess: boolean;
  inCohort: boolean;
  hasReflected: boolean;
}

interface UseStepWithPeopleArgs {
  stepId: string;
  accessPeople: StepAccessPerson[];
  viewerUserId: string | null;
}

function makeInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function useStepWithPeople({
  stepId,
  accessPeople,
  viewerUserId,
}: UseStepWithPeopleArgs) {
  // Resolve the blueprint_step_id so we can look up cohort mates.
  const { data: blueprintStepId = null } = useQuery({
    queryKey: ['timeline-step-blueprint-step-id', stepId],
    enabled: Boolean(stepId),
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from('timeline_steps')
        .select('source_blueprint_step_id')
        .eq('id', stepId)
        .maybeSingle();
      return (
        (data as { source_blueprint_step_id?: string | null } | null)
          ?.source_blueprint_step_id ?? null
      );
    },
  });

  const { data: cohortMates = [] } = useCohortMates(blueprintStepId);

  const reflectionStepIds = useMemo(() => [stepId], [stepId]);
  const { data: reflectionsMap } = useStepPeerReflections(reflectionStepIds);
  const reflectorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reflectionsMap?.get(stepId) ?? []) {
      ids.add(r.peerUserId);
    }
    return ids;
  }, [reflectionsMap, stepId]);

  const people = useMemo<StepPerson[]>(() => {
    const byId = new Map<string, StepPerson>();

    // Seed with explicit access grants (owner + invited collaborators).
    for (const p of accessPeople) {
      byId.set(p.userId, {
        userId: p.userId,
        displayName: p.displayName,
        initials: p.initials,
        avatarUrl: null,
        avatarColor: p.avatarColor ?? null,
        isOwner: p.isOwner === true,
        isViewer: p.userId === viewerUserId,
        inAccess: true,
        inCohort: false,
        hasReflected: reflectorIds.has(p.userId),
      });
    }

    // Merge cohort members. Existing rows pick up the `inCohort` flag;
    // brand-new rows materialize with the cohort relationship only.
    for (const m of cohortMates) {
      const existing = byId.get(m.userId);
      if (existing) {
        existing.inCohort = true;
        if (!existing.avatarUrl && m.avatarUrl) existing.avatarUrl = m.avatarUrl;
      } else {
        byId.set(m.userId, {
          userId: m.userId,
          displayName: m.displayName,
          initials: makeInitials(m.displayName),
          avatarUrl: m.avatarUrl,
          avatarColor: null,
          isOwner: false,
          isViewer: m.isViewer,
          inAccess: false,
          inCohort: true,
          hasReflected: reflectorIds.has(m.userId),
        });
      }
    }

    // Sort: owner first, then viewer, then alphabetical by display name.
    const list = Array.from(byId.values());
    list.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      if (a.isViewer && !b.isViewer) return -1;
      if (!a.isViewer && b.isViewer) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return list;
  }, [accessPeople, cohortMates, reflectorIds, viewerUserId]);

  return {
    people,
    totalCount: people.length,
    reflectorCount: reflectorIds.size,
    blueprintStepId,
  };
}
