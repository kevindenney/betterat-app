/**
 * useBlueprintSteps — load + mutate authored steps for one blueprint.
 *
 * Reads via direct table SELECT (RLS allows any org member). Writes via
 * direct UPDATE/INSERT/DELETE (RLS allows author or org admin).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { logAuditEvent } from '@/services/auditLog';

export type StepCategory = 'procedural' | 'assessment' | 'communication' | 'reasoning' | 'other';

export interface BlueprintSubStep {
  n: number;
  text: string;
}

export interface BlueprintStepTemplate {
  id: string;
  blueprintId: string;
  sortOrder: number;
  title: string;
  description: string | null;
  category: StepCategory;
  whatQuestion: string | null;
  subSteps: BlueprintSubStep[];
  preceptorRole: string | null;
  capabilityTags: string[];
}

type RpcRow = {
  id: string;
  blueprint_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  category: string;
  what_question: string | null;
  sub_steps: BlueprintSubStep[] | null;
  preceptor_role: string | null;
  capability_tags: string[] | null;
};

function normalize(r: RpcRow): BlueprintStepTemplate {
  return {
    id: r.id,
    blueprintId: r.blueprint_id,
    sortOrder: r.sort_order,
    title: r.title,
    description: r.description,
    category: r.category as StepCategory,
    whatQuestion: r.what_question,
    subSteps: r.sub_steps ?? [],
    preceptorRole: r.preceptor_role,
    capabilityTags: r.capability_tags ?? [],
  };
}

export function useBlueprintSteps(blueprintId: string, orgId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-step-templates', blueprintId];

  function emitActivity(verbLabel: string, description: string, payload: Record<string, unknown>) {
    if (!orgId) return;
    void logAuditEvent({
      orgId,
      verb: 'edited',
      verbLabel,
      description,
      targetType: 'blueprint',
      targetId: blueprintId,
      payload,
    });
    queryClient.invalidateQueries({ queryKey: ['blueprint-activity', blueprintId] });
  }

  const { data: steps = [], isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<BlueprintStepTemplate[]> => {
      const { data, error } = await supabase
        .from('blueprint_step_templates')
        .select(
          'id, blueprint_id, sort_order, title, description, category, what_question, sub_steps, preceptor_role, capability_tags',
        )
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('[useBlueprintSteps] query failed', error);
        return [];
      }
      return ((data ?? []) as RpcRow[]).map(normalize);
    },
  });

  const updateStep = useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      description?: string | null;
      category?: StepCategory;
      whatQuestion?: string | null;
      subSteps?: BlueprintSubStep[];
      preceptorRole?: string | null;
      capabilityTags?: string[];
    }) => {
      const payload: Record<string, unknown> = {};
      if (input.title !== undefined) payload.title = input.title;
      if (input.description !== undefined) payload.description = input.description;
      if (input.category !== undefined) payload.category = input.category;
      if (input.whatQuestion !== undefined) payload.what_question = input.whatQuestion;
      if (input.subSteps !== undefined) payload.sub_steps = input.subSteps;
      if (input.preceptorRole !== undefined) payload.preceptor_role = input.preceptorRole;
      if (input.capabilityTags !== undefined) payload.capability_tags = input.capabilityTags;

      const { error } = await supabase
        .from('blueprint_step_templates')
        .update(payload)
        .eq('id', input.id);
      if (error) throw error;
      const existing = steps.find((s) => s.id === input.id);
      return { input, existingTitle: existing?.title ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result) {
        const title = result.input.title ?? result.existingTitle ?? 'a step';
        emitActivity('Edited step', `Edited "${title}".`, {
          step_id: result.input.id,
          step_title: title,
        });
      }
    },
  });

  const addStep = useMutation({
    mutationFn: async (input: { title: string; category?: StepCategory }) => {
      const maxOrder = steps[steps.length - 1]?.sortOrder ?? 0;
      const cleanTitle = input.title.trim() || 'Untitled step';
      const { error } = await supabase.from('blueprint_step_templates').insert({
        blueprint_id: blueprintId,
        sort_order: maxOrder + 1,
        title: cleanTitle,
        category: input.category ?? 'other',
      });
      if (error) throw error;
      return { title: cleanTitle };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result) {
        emitActivity('Added step', `Added "${result.title}".`, { step_title: result.title });
      }
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const existing = steps.find((s) => s.id === id);
      const { error } = await supabase.from('blueprint_step_templates').delete().eq('id', id);
      if (error) throw error;
      return { id, title: existing?.title ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result) {
        emitActivity(
          'Removed step',
          result.title ? `Removed "${result.title}".` : 'Removed a step.',
          { step_id: result.id, step_title: result.title },
        );
      }
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Two-pass to avoid unique constraint races (none here, but cleaner)
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase
            .from('blueprint_step_templates')
            .update({ sort_order: idx + 1 })
            .eq('id', id),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    steps,
    loading: isLoading,
    updateStep,
    addStep,
    deleteStep,
    reorder,
  };
}
