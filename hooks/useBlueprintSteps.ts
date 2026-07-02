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

export interface BlueprintBeat {
  timeLabel: string;
  title: string;
  body: string | null;
}

export interface BlueprintStepPlanMetadata {
  why: string | null;
  whenLabel: string | null;
  whereLabel: string | null;
  beats: BlueprintBeat[];
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
  capabilityCompetencyIds: string[];
  planMetadata: BlueprintStepPlanMetadata;
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
  capability_competency_ids: string[] | null;
  plan_metadata: Record<string, unknown> | null;
};

const STEP_SELECT_BASE =
  'id, blueprint_id, sort_order, title, description, category, what_question, sub_steps, preceptor_role, capability_tags, plan_metadata';
const STEP_SELECT_WITH_COMPETENCY_IDS = `${STEP_SELECT_BASE}, capability_competency_ids`;

function isMissingCapabilityCompetencyColumn(error: { message?: string; details?: string } | null) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
  return text.includes('capability_competency_ids');
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeBeats(value: unknown): BlueprintBeat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((beat) => {
      if (!beat || typeof beat !== 'object') return null;
      const row = beat as Record<string, unknown>;
      const title = textOrNull(row.title);
      if (!title) return null;
      return {
        timeLabel: textOrNull(row.timeLabel ?? row.time_label) ?? '',
        title,
        body: textOrNull(row.body),
      };
    })
    .filter((beat): beat is BlueprintBeat => !!beat);
}

function normalizePlanMetadata(value: Record<string, unknown> | null): BlueprintStepPlanMetadata {
  const meta = value ?? {};
  return {
    why: textOrNull(meta.why),
    whenLabel: textOrNull(meta.whenLabel ?? meta.when_label),
    whereLabel: textOrNull(meta.whereLabel ?? meta.where_label),
    beats: normalizeBeats(meta.beats),
  };
}

function serializePlanMetadata(input: Partial<BlueprintStepPlanMetadata>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.why !== undefined) payload.why = input.why?.trim() || null;
  if (input.whenLabel !== undefined) payload.when_label = input.whenLabel?.trim() || null;
  if (input.whereLabel !== undefined) payload.where_label = input.whereLabel?.trim() || null;
  if (input.beats !== undefined) {
    payload.beats = input.beats
      .map((beat) => ({
        time_label: beat.timeLabel.trim(),
        title: beat.title.trim(),
        body: beat.body?.trim() || null,
      }))
      .filter((beat) => beat.title.length > 0);
  }
  return payload;
}

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
    capabilityCompetencyIds: r.capability_competency_ids ?? [],
    planMetadata: normalizePlanMetadata(r.plan_metadata),
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
      const request = supabase
        .from('blueprint_step_templates')
        .select(STEP_SELECT_WITH_COMPETENCY_IDS)
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: true });
      const { data, error } = await request;
      if (error) {
        if (isMissingCapabilityCompetencyColumn(error)) {
          const fallback = await supabase
            .from('blueprint_step_templates')
            .select(STEP_SELECT_BASE)
            .eq('blueprint_id', blueprintId)
            .order('sort_order', { ascending: true });
          if (!fallback.error) return ((fallback.data ?? []) as RpcRow[]).map(normalize);
        }
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
      capabilityCompetencyIds?: string[];
      planMetadata?: Partial<BlueprintStepPlanMetadata>;
    }) => {
      const payload: Record<string, unknown> = {};
      if (input.title !== undefined) payload.title = input.title;
      if (input.description !== undefined) payload.description = input.description;
      if (input.category !== undefined) payload.category = input.category;
      if (input.whatQuestion !== undefined) payload.what_question = input.whatQuestion;
      if (input.subSteps !== undefined) payload.sub_steps = input.subSteps;
      if (input.preceptorRole !== undefined) payload.preceptor_role = input.preceptorRole;
      if (input.capabilityTags !== undefined) payload.capability_tags = input.capabilityTags;
      if (input.capabilityCompetencyIds !== undefined) {
        payload.capability_competency_ids = input.capabilityCompetencyIds;
      }
      if (input.planMetadata !== undefined) {
        const existing = steps.find((s) => s.id === input.id);
        payload.plan_metadata = {
          ...serializePlanMetadata(existing?.planMetadata ?? {}),
          ...serializePlanMetadata(input.planMetadata),
        };
      }

      const { error } = await supabase
        .from('blueprint_step_templates')
        .update(payload)
        .eq('id', input.id);
      if (error) {
        if (isMissingCapabilityCompetencyColumn(error) && 'capability_competency_ids' in payload) {
          const retryPayload = { ...payload };
          delete retryPayload.capability_competency_ids;
          const retry = await supabase
            .from('blueprint_step_templates')
            .update(retryPayload)
            .eq('id', input.id);
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
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
      const { data, error } = await supabase
        .from('blueprint_step_templates')
        .insert({
          blueprint_id: blueprintId,
          sort_order: maxOrder + 1,
          title: cleanTitle,
          category: input.category ?? 'other',
          plan_metadata: {},
        })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id as string, title: cleanTitle };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result) {
        emitActivity('Added step', `Added "${result.title}".`, { step_title: result.title });
      }
    },
  });

  const importTimelineSteps = useMutation({
    mutationFn: async (picks: { title: string; description: string | null }[]) => {
      if (picks.length === 0) return { count: 0 };
      const base = steps[steps.length - 1]?.sortOrder ?? 0;
      const rows = picks.map((p, i) => ({
        blueprint_id: blueprintId,
        sort_order: base + i + 1,
        title: p.title.trim() || 'Untitled step',
        description: p.description,
        category: 'other' as StepCategory,
        plan_metadata: {},
      }));
      const { error } = await supabase.from('blueprint_step_templates').insert(rows);
      if (error) throw error;
      return { count: rows.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result && result.count > 0) {
        emitActivity(
          'Imported steps',
          `Imported ${result.count} step${result.count !== 1 ? 's' : ''} from timeline.`,
          { count: result.count },
        );
      }
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const existing = steps.find((s) => s.id === id);
      const { data, error } = await supabase
        .from('blueprint_step_templates')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Blueprint step not found.');
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
    importTimelineSteps,
    deleteStep,
    reorder,
  };
}
