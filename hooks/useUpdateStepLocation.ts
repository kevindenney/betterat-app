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
      const { error } = await supabase
        .from('timeline_steps')
        .update(patch)
        .eq('id', stepId);
      if (error) {
        console.warn('[atlas] update step location failed', error);
        throw new Error(error.message || 'Could not save location');
      }
      return stepId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
    },
  });
}
