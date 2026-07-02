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
import type {
  BlueprintAccessMode,
  BlueprintBillingCadence,
  BlueprintCurrency,
  BlueprintDurationUnit,
  BlueprintSkillLevel,
  BlueprintStatus,
} from '@/hooks/useStudioBlueprint';

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
  billingCadence?: BlueprintBillingCadence;
  currency?: BlueprintCurrency;
  durationValue?: number | null;
  durationUnit?: BlueprintDurationUnit;
  skillLevel?: BlueprintSkillLevel;
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
      if (input.billingCadence !== undefined) payload.billing_cadence = input.billingCadence;
      if (input.currency !== undefined) payload.currency = input.currency;
      if (input.durationValue !== undefined) payload.duration_value = input.durationValue;
      if (input.durationUnit !== undefined) payload.duration_unit = input.durationUnit;
      if (input.skillLevel !== undefined) payload.skill_level = input.skillLevel;
      const { data, error } = await supabase
        .from('blueprints')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return { id: (data as { id: string }).id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-home-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });
    },
  });
}

export interface UpdateBlueprintMetaInput {
  title?: string;
  subtitle?: string;
  description?: string;
  interestId?: string | null;
  accessMode?: BlueprintAccessMode;
  orgId?: string | null;
  pricePerSeatCents?: number | null;
  billingCadence?: BlueprintBillingCadence;
  currency?: BlueprintCurrency;
  durationValue?: number | null;
  durationUnit?: BlueprintDurationUnit;
  skillLevel?: BlueprintSkillLevel;
  status?: BlueprintStatus;
  version?: string;
  publishedAt?: string | null;
}

export function useUpdateBlueprintMeta(blueprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateBlueprintMetaInput) => {
      const payload: Record<string, unknown> = {};
      if (patch.title !== undefined) payload.title = patch.title.trim() || 'Untitled blueprint';
      if (patch.subtitle !== undefined) payload.subtitle = patch.subtitle.trim() || null;
      if (patch.description !== undefined) payload.description = patch.description.trim() || null;
      if (patch.interestId !== undefined) payload.interest_id = patch.interestId;
      if (patch.accessMode !== undefined) {
        payload.access_mode = patch.accessMode;
        payload.org_id = patch.accessMode === 'independent' ? null : patch.orgId ?? null;
      }
      if (patch.pricePerSeatCents !== undefined) payload.price_per_seat_cents = patch.pricePerSeatCents;
      if (patch.billingCadence !== undefined) payload.billing_cadence = patch.billingCadence;
      if (patch.currency !== undefined) payload.currency = patch.currency;
      if (patch.durationValue !== undefined) payload.duration_value = patch.durationValue;
      if (patch.durationUnit !== undefined) payload.duration_unit = patch.durationUnit;
      if (patch.skillLevel !== undefined) payload.skill_level = patch.skillLevel;
      if (patch.status !== undefined) payload.status = patch.status === 'in_review' ? 'review' : patch.status;
      if (patch.version !== undefined) payload.version = patch.version.trim() || 'v1.0 live';
      if (patch.publishedAt !== undefined) payload.published_at = patch.publishedAt;
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

export function useAddBlueprintCoAuthor(blueprintId: string, orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('blueprint_authors')
        .upsert(
          {
            blueprint_id: blueprintId,
            user_id: userId,
            role: 'co_author',
          },
          { onConflict: 'blueprint_id,user_id', ignoreDuplicates: true },
        )
        .select('blueprint_id,user_id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Co-author already added.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['studio-home-blueprints'] });
      if (orgId) queryClient.invalidateQueries({ queryKey: ['admin-people', orgId] });
    },
  });
}

export function useRemoveBlueprintCoAuthor(blueprintId: string, orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('blueprint_authors')
        .delete()
        .eq('blueprint_id', blueprintId)
        .eq('user_id', userId)
        .select('blueprint_id,user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Co-author could not be removed.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['studio-home-blueprints'] });
      if (orgId) queryClient.invalidateQueries({ queryKey: ['admin-people', orgId] });
    },
  });
}
