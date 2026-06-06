/**
 * useAtlasCockpitStep — fetches the single timeline_step that the Atlas
 * cockpit is currently focused on (the viewer's next step) so the
 * kind-adaptive cockpit can render its real "how" checklist.
 *
 * Atlas pins only carry enough to plot a dot; the cockpit needs the
 * step's `metadata.plan.how_sub_steps[]` to show an ashore step's tuning /
 * prep checklist instead of irrelevant wind/tide gauges. Rather than
 * bloat every pin with a sub-step array, we fetch the one focused step
 * on demand. Enabled only when a stepId is present (i.e. there is a
 * next-step pin), so on-water frames pay nothing.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface CockpitSubStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface CockpitBeat {
  id: string;
  title: string;
  timeLabel: string | null;
  body: string | null;
  done: boolean;
}

export interface AtlasCockpitStep {
  stepId: string;
  title: string;
  locationName: string | null;
  subSteps: CockpitSubStep[];
  beats: CockpitBeat[];
}

export function useAtlasCockpitStep(stepId: string | null) {
  const { data = null } = useQuery<AtlasCockpitStep | null>({
    queryKey: ['atlas-cockpit-step', stepId],
    enabled: !!stepId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!stepId) return null;
      const { data: row, error } = await supabase
        .from('timeline_steps')
        .select('id, title, location_name, metadata')
        .eq('id', stepId)
        .maybeSingle();
      if (error || !row) return null;
      const plan = (row.metadata as { plan?: { how_sub_steps?: unknown } } | null)?.plan;
      const rawSubs = Array.isArray(plan?.how_sub_steps) ? plan!.how_sub_steps : [];
      const subSteps: CockpitSubStep[] = rawSubs
        .map((s) => {
          const sub = s as { id?: unknown; text?: unknown; completed?: unknown };
          const text = typeof sub.text === 'string' ? sub.text.trim() : '';
          if (!text) return null;
          return {
            id: typeof sub.id === 'string' ? sub.id : text,
            text,
            completed: sub.completed === true,
          };
        })
        .filter((s): s is CockpitSubStep => s != null);
      const { data: beatRows, error: beatsError } = await supabase
        .from('step_beats')
        .select('id, title, time_label, body, done')
        .eq('step_id', stepId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (beatsError) {
        console.warn('[atlas] step beats query error', beatsError);
      }
      const beats: CockpitBeat[] = (beatRows ?? [])
        .map((b) => {
          const title = typeof b.title === 'string' ? b.title.trim() : '';
          if (!title) return null;
          return {
            id: String(b.id),
            title,
            timeLabel:
              typeof b.time_label === 'string' && b.time_label.trim().length > 0
                ? b.time_label.trim()
                : null,
            body:
              typeof b.body === 'string' && b.body.trim().length > 0
                ? b.body.trim()
                : null,
            done: b.done === true,
          };
        })
        .filter((b): b is CockpitBeat => b != null);
      return {
        stepId: row.id,
        title: row.title,
        locationName: row.location_name ?? null,
        subSteps,
        beats,
      };
    },
  });

  return data;
}
