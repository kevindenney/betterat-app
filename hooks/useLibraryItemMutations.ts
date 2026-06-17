/**
 * useLibraryItemMutations — update + delete for a single library_items row.
 *
 * Used by the resource detail screen's "More" menu to edit metadata or
 * delete an item. RLS enforces user ownership server-side; these mutations
 * just write through and invalidate the caches the rest of the library UI
 * depends on.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

interface UpdateInput {
  title?: string;
  source_label?: string | null;
  year?: number | null;
}

export function useUpdateLibraryItem(itemId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInput) => {
      if (!itemId) throw new Error('itemId required');
      const { error } = await supabase
        .from('library_items')
        .update(input)
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-item-detail', itemId] });
      qc.invalidateQueries({ queryKey: ['library-zones-data'] });
      qc.invalidateQueries({ queryKey: ['library-items-for-picker'] });
      qc.invalidateQueries({ queryKey: ['library-resources-preview'] });
      // step-library-before joins library_items(title, source_label, …), so a
      // title/source edit must refresh any step that pinned this item or its
      // before-shift label stays stale.
      qc.invalidateQueries({ queryKey: ['step-library-before'] });
    },
  });
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('library_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_data, itemId) => {
      // Cascade joins (library_item_interests, library_item_topics,
      // step_library_before, concept_origins, concept_citations,
      // step_beat_pins) drop server-side via ON DELETE CASCADE.
      qc.invalidateQueries({ queryKey: ['library-item-detail', itemId] });
      qc.invalidateQueries({ queryKey: ['library-zones-data'] });
      qc.invalidateQueries({ queryKey: ['library-items-for-picker'] });
      qc.invalidateQueries({ queryKey: ['library-resources-preview'] });
      qc.invalidateQueries({ queryKey: ['library-counts'] });
      // Any step that had this item in its before-shift list also refreshes.
      qc.invalidateQueries({ queryKey: ['step-library-before'] });
    },
  });
}
