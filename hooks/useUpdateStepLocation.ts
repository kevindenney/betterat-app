/**
 * useUpdateStepLocation — write a lat/lng (and optional name) to a
 * single timeline_steps row. Used by the Atlas "anchor a step to a
 * place" flow. Invalidates both the timeline-steps and user-atlas-
 * steps query roots so the next-step pin / picker pick up the new
 * location immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';

export interface UpdateStepLocationInput {
  stepId: string;
  lat: number;
  lng: number;
  /** Optional human-readable name (e.g. "Hebe Haven"). Skipped when null. */
  locationName?: string | null;
}

export function useUpdateStepLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, lat, lng, locationName }: UpdateStepLocationInput) => {
      const patch: Record<string, unknown> = {
        location_lat: lat,
        location_lng: lng,
        updated_at: new Date().toISOString(),
      };
      if (locationName != null) patch.location_name = locationName;
      const { data, error } = await supabase
        .from('timeline_steps')
        .update(patch)
        .eq('id', stepId)
        .select('id')
        .maybeSingle();
      if (error) {
        console.warn('[atlas] update step location failed', error);
        throw new Error(error.message || 'Could not save location');
      }
      if (!data) {
        throw new Error('Step not found.');
      }
      return stepId;
    },
    // Optimistic patch — without this the user sees a beat between
    // tap-to-anchor and the pin appearing on the canvas, because the
    // invalidation triggers a fresh network fetch. Patch both query
    // roots locally so the pin renders instantly. The settled refetch
    // confirms the value from the server.
    onMutate: async ({ stepId, lat, lng, locationName }) => {
      await queryClient.cancelQueries({ queryKey: ['user-atlas-steps'] });
      await queryClient.cancelQueries({ queryKey: ['timeline-steps'] });
      const nowIso = new Date().toISOString();
      const patchRow = (row: Record<string, unknown> | null | undefined) => {
        if (!row || (row as { id?: string }).id !== stepId) return row;
        const next: Record<string, unknown> = {
          ...row,
          location_lat: lat,
          location_lng: lng,
          updated_at: nowIso,
        };
        if (locationName != null) next.location_name = locationName;
        return next;
      };
      queryClient.setQueriesData<unknown[]>(
        { predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'user-atlas-steps' },
        (old) => (Array.isArray(old) ? old.map((r) => patchRow(r as Record<string, unknown>)) : old),
      );
      queryClient.setQueriesData<unknown[]>(
        { predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'timeline-steps' },
        (old) => (Array.isArray(old) ? old.map((r) => patchRow(r as Record<string, unknown>)) : old),
      );
    },
    onSettled: () => {
      // Confirm via refetch regardless of mutation outcome — keeps
      // optimistic cache from drifting if the server rejected.
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
    },
  });
}
