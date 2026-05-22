/**
 * useLibraryItemInterestTags — reads + mutates the library_item_interests
 * tags for a single library item. Drives the chip row on /library/items/[id]
 * so a user can declare which interests an item is relevant to.
 *
 * Untagged items behave as "available everywhere" in the picker RPC; once
 * any tag is set, the item scopes to those interests only.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export function useLibraryItemInterestTags(libraryItemId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['library-item-interest-tags', libraryItemId],
    enabled: Boolean(libraryItemId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!libraryItemId) return [];
      const { data, error } = await supabase
        .from('library_item_interests')
        .select('interest_id')
        .eq('item_id', libraryItemId);
      if (error) throw error;
      return ((data ?? []) as { interest_id: string }[]).map((r) => r.interest_id);
    },
  });
}

interface ToggleVars {
  interestId: string;
  on: boolean;
}

export function useToggleLibraryItemInterestTag(
  libraryItemId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ interestId, on }: ToggleVars) => {
      if (!libraryItemId) throw new Error('libraryItemId required');
      if (on) {
        const { error } = await supabase
          .from('library_item_interests')
          .insert({ item_id: libraryItemId, interest_id: interestId });
        if (error && error.code !== '23505') throw error; // ignore duplicate
      } else {
        const { error } = await supabase
          .from('library_item_interests')
          .delete()
          .eq('item_id', libraryItemId)
          .eq('interest_id', interestId);
        if (error) throw error;
      }
    },
    onMutate: async ({ interestId, on }) => {
      const key = ['library-item-interest-tags', libraryItemId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key);
      qc.setQueryData<string[]>(key, (old) => {
        const set = new Set(old ?? []);
        if (on) set.add(interestId);
        else set.delete(interestId);
        return Array.from(set);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['library-item-interest-tags', libraryItemId], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['library-item-interest-tags', libraryItemId] });
      // Picker reads change too; nuke its caches so the next open is fresh.
      qc.invalidateQueries({ queryKey: ['library-items-for-picker'] });
    },
  });
}

export function useLibraryItemInterestTagsBinding(
  libraryItemId: string | undefined,
) {
  const { data: tagIds = [] } = useLibraryItemInterestTags(libraryItemId);
  const toggle = useToggleLibraryItemInterestTag(libraryItemId);
  const onToggle = useCallback(
    (interestId: string) => {
      const isOn = tagIds.includes(interestId);
      toggle.mutate({ interestId, on: !isOn });
    },
    [tagIds, toggle],
  );
  return { tagIds, onToggle };
}
