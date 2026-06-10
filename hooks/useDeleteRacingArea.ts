/**
 * useDeleteRacingArea — soft-delete a user-defined racing area by
 * flipping `is_active` false on its atlas_pois row (preserves history).
 * Invalidates the racing-area queries so the polygon disappears from
 * the canvas.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';

import { invalidateRacingAreaQueries } from './racingAreaInvalidations';

export function useDeleteRacingArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (areaId: string) => {
      const { error } = await supabase
        .from('atlas_pois')
        .update({ is_active: false })
        .eq('id', areaId);
      if (error) {
        console.warn('[atlas] delete racing area failed', error);
        throw new Error(error.message || 'Could not delete racing area');
      }
      return areaId;
    },
    onSuccess: () => {
      invalidateRacingAreaQueries(queryClient);
    },
  });
}
