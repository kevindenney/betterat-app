/**
 * useBlueprintEditor — create + persist mutations for the Studio editor.
 *
 * `useCreateBlueprint` inserts a System-B public.blueprints row (gated by
 * the blueprints_author_insert RLS policy) and returns the new id so the
 * editor can router.replace onto a real route. `useUpdateBlueprintMeta`
 * persists Overview edits (title / description / access mode / price).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { BlueprintAccessMode } from '@/hooks/useStudioBlueprint';

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'blueprint'}-${suffix}`;
}

export interface CreateBlueprintInput {
  title: string;
  subtitle?: string;
  description?: string;
  accessMode: BlueprintAccessMode;
  orgId?: string | null;
  interestId?: string | null;
  pricePerSeatCents?: number | null;
  authorUserId: string;
}

export function useCreateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBlueprintInput): Promise<{ id: string }> => {
      const title = input.title.trim() || 'Untitled blueprint';
      const payload: Record<string, unknown> = {
        title,
        slug: slugify(title),
        category: 'procedural',
        subtitle: input.subtitle?.trim() || null,
        description: input.description?.trim() || null,
        access_mode: input.accessMode,
        author_user_id: input.authorUserId,
        org_id: input.accessMode === 'independent' ? null : input.orgId ?? null,
        interest_id: input.interestId ?? null,
        status: 'draft',
      };
      if (input.pricePerSeatCents != null) {
        payload.price_per_seat_cents = input.pricePerSeatCents;
      }
      const { data, error } = await supabase
        .from('blueprints')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return { id: (data as { id: string }).id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-home'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });
    },
  });
}

export interface UpdateBlueprintMetaInput {
  title?: string;
  subtitle?: string;
  description?: string;
  accessMode?: BlueprintAccessMode;
  orgId?: string | null;
  pricePerSeatCents?: number | null;
}

export function useUpdateBlueprintMeta(blueprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateBlueprintMetaInput) => {
      const payload: Record<string, unknown> = {};
      if (patch.title !== undefined) payload.title = patch.title.trim() || 'Untitled blueprint';
      if (patch.subtitle !== undefined) payload.subtitle = patch.subtitle.trim() || null;
      if (patch.description !== undefined) payload.description = patch.description.trim() || null;
      if (patch.accessMode !== undefined) {
        payload.access_mode = patch.accessMode;
        payload.org_id = patch.accessMode === 'independent' ? null : patch.orgId ?? null;
      }
      if (patch.pricePerSeatCents !== undefined) payload.price_per_seat_cents = patch.pricePerSeatCents;
      if (Object.keys(payload).length === 0) return;
      // .select() so an RLS-filtered update (e.g. a non-author editing) is a
      // visible error instead of a silent 0-row write behind a "Saved" alert.
      const { data, error } = await supabase
        .from('blueprints')
        .update(payload)
        .eq('id', blueprintId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to edit this blueprint.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-pricing', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });
    },
  });
}
