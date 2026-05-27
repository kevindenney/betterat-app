/**
 * useDeleteRacingArea — soft-delete a user-defined racing area by
 * flipping `is_active` false (preserves history). Invalidates the
 * atlas-racing-areas query so the polygon disappears from the canvas.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';

export function useDeleteRacingArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (areaId: string) => {
      const { error } = await supabase
        .from('venue_racing_areas')
        .update({ is_active: false })
        .eq('id', areaId);
      if (error) {
        console.warn('[atlas] delete racing area failed', error);
        throw new Error(error.message || 'Could not delete racing area');
      }
      return areaId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atlas-racing-areas'] });
    },
  });
}
