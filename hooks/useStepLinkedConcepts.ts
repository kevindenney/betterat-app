import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/services/supabase';
import { getStepConceptLinks, getStepLinks } from '@/services/PlaybookService';

export interface LinkedConcept {
  id: string;
  title: string;
  slug?: string;
}

/**
 * Loads the concepts linked to a step (Phase 6 `step_concept_links`, falling
 * back to the older generic `step_playbook_links`). Refetches whenever the
 * containing screen regains focus, so a concept linked from elsewhere (e.g.
 * the concept detail's "Link to a step" flow) surfaces on return without a
 * relaunch. Shared by Plan / Do / Review so the three phases stay in sync.
 */
export function useStepLinkedConcepts(stepId?: string | null): {
  concepts: LinkedConcept[];
  reload: () => void;
} {
  const [concepts, setConcepts] = useState<LinkedConcept[]>([]);

  const load = useCallback(async () => {
    if (!stepId) {
      setConcepts([]);
      return;
    }
    try {
      let conceptIds: string[] = [];
      try {
        const links = await getStepConceptLinks(stepId);
        conceptIds = links.map((l) => l.concept_id);
      } catch {
        const links = await getStepLinks(stepId);
        conceptIds = links
          .filter((l) => l.item_type === 'concept')
          .map((l) => l.item_id);
      }
      if (conceptIds.length === 0) {
        setConcepts([]);
        return;
      }
      const { data } = await supabase
        .from('playbook_concepts')
        .select('id, title, slug')
        .in('id', conceptIds);
      setConcepts(
        (data || []).map((c: any) => ({ id: c.id, title: c.title, slug: c.slug })),
      );
    } catch {
      setConcepts([]);
    }
  }, [stepId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (cancelled) return;
        await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  return { concepts, reload: load };
}
