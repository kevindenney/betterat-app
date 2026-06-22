/**
 * useStepBeats — CRUD for the time-stamped beats on a step.
 *
 * Beats are owner-only today. Reorder uses a single position column —
 * insert-at-end via `(max + 1)`, drag-reorder rewrites positions in one
 * batch upsert (caller passes the full ordered list).
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface StepBeat {
  id: string;
  step_id: string;
  user_id: string;
  position: number;
  time_label: string | null;
  title: string;
  body: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

function assertChangedStepBeat(data: { id: string } | null): void {
  if (!data) throw new Error('Step beat not found.');
}

export function useStepBeats(stepId: string | undefined) {
  return useQuery<StepBeat[]>({
    queryKey: ['step-beats', stepId],
    enabled: !!stepId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!stepId) return [];
      const { data, error } = await supabase
        .from('step_beats')
        .select('*')
        .eq('step_id', stepId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StepBeat[];
    },
  });
}

interface CreateInput {
  stepId: string;
  title: string;
  time_label?: string | null;
  body?: string | null;
}

export function useCreateStepBeat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ stepId, title, time_label, body }: CreateInput) => {
      if (!user?.id) throw new Error('not authenticated');
      // Position = max + 1 (append to end). One round-trip via head:count.
      const { count, error: countErr } = await supabase
        .from('step_beats')
        .select('id', { count: 'exact', head: true })
        .eq('step_id', stepId);
      if (countErr) throw countErr;
      const nextPos = (count ?? 0) + 1;
      const { data, error } = await supabase
        .from('step_beats')
        .insert({
          step_id: stepId,
          user_id: user.id,
          position: nextPos,
          title: title.trim(),
          time_label: time_label?.trim() || null,
          body: body?.trim() || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as StepBeat;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['step-beats', vars.stepId] });
    },
  });
}

interface UpdateInput {
  id: string;
  stepId: string;
  title?: string;
  time_label?: string | null;
  body?: string | null;
}

export function useUpdateStepBeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, time_label, body }: UpdateInput) => {
      const patch: Record<string, unknown> = {};
      if (typeof title === 'string') patch.title = title.trim();
      if (time_label !== undefined) patch.time_label = time_label?.trim() || null;
      if (body !== undefined) patch.body = body?.trim() || null;
      if (Object.keys(patch).length === 0) return;
      const { data, error } = await supabase
        .from('step_beats')
        .update(patch)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      assertChangedStepBeat(data);
    },
    onMutate: async ({ id, stepId, title, time_label, body }) => {
      const key = ['step-beats', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StepBeat[]>(key);
      qc.setQueryData<StepBeat[]>(key, (old) =>
        (old ?? []).map((b) =>
          b.id === id
            ? {
                ...b,
                title: title?.trim() ?? b.title,
                time_label:
                  time_label === undefined ? b.time_label : time_label?.trim() || null,
                body: body === undefined ? b.body : body?.trim() || null,
              }
            : b,
        ),
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-beats', vars.stepId], ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['step-beats', vars.stepId] });
    },
  });
}

export function useDeleteStepBeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; stepId: string }) => {
      const { data, error } = await supabase
        .from('step_beats')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      assertChangedStepBeat(data);
    },
    onMutate: async ({ id, stepId }) => {
      const key = ['step-beats', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StepBeat[]>(key);
      qc.setQueryData<StepBeat[]>(key, (old) => (old ?? []).filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-beats', vars.stepId], ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['step-beats', vars.stepId] });
    },
  });
}

export function useToggleStepBeatDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; stepId: string; done: boolean }) => {
      const { data, error } = await supabase
        .from('step_beats')
        .update({ done })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      assertChangedStepBeat(data);
    },
    onMutate: async ({ id, stepId, done }) => {
      const key = ['step-beats', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StepBeat[]>(key);
      qc.setQueryData<StepBeat[]>(key, (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, done } : b)),
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-beats', vars.stepId], ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['step-beats', vars.stepId] });
    },
  });
}

export function useReorderStepBeats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderedIds,
    }: {
      stepId: string;
      orderedIds: string[];
    }) => {
      // Rewrite positions 1..N in one round-trip. UPDATE...FROM unnest is the
      // PG idiom but PostgREST exposes it cleanly through upsert when we
      // pass the existing rows back with new positions. Easier: do N
      // updates in a single Promise.all — N is small (a handful of beats).
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase
            .from('step_beats')
            .update({ position: idx + 1 })
            .eq('id', id)
            .select('id')
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) throw error;
              assertChangedStepBeat(data);
            }),
        ),
      );
    },
    onMutate: async ({ stepId, orderedIds }) => {
      const key = ['step-beats', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StepBeat[]>(key);
      qc.setQueryData<StepBeat[]>(key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((b) => [b.id, b] as const));
        return orderedIds
          .map((id, idx) => {
            const b = byId.get(id);
            return b ? { ...b, position: idx + 1 } : null;
          })
          .filter((b): b is StepBeat => b !== null);
      });
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-beats', vars.stepId], ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['step-beats', vars.stepId] });
    },
  });
}

export function useStepBeatsBinding(stepId: string | undefined) {
  const { data: beats = [] } = useStepBeats(stepId);
  const create = useCreateStepBeat();
  const update = useUpdateStepBeat();
  const del = useDeleteStepBeat();
  const toggle = useToggleStepBeatDone();
  const reorder = useReorderStepBeats();

  const onAdd = useCallback(
    (input: { title: string; time_label?: string | null; body?: string | null }) => {
      if (!stepId) return;
      create.mutate({ stepId, ...input });
    },
    [stepId, create],
  );

  const onEdit = useCallback(
    (id: string, patch: { title?: string; time_label?: string | null; body?: string | null }) => {
      if (!stepId) return;
      update.mutate({ id, stepId, ...patch });
    },
    [stepId, update],
  );

  const onDelete = useCallback(
    (id: string) => {
      if (!stepId) return;
      del.mutate({ id, stepId });
    },
    [stepId, del],
  );

  const onReorder = useCallback(
    (orderedIds: string[]) => {
      if (!stepId) return;
      reorder.mutate({ stepId, orderedIds });
    },
    [stepId, reorder],
  );

  const onToggleDone = useCallback(
    (id: string, done: boolean) => {
      if (!stepId) return;
      toggle.mutate({ id, stepId, done });
    },
    [stepId, toggle],
  );

  return { beats, onAdd, onEdit, onDelete, onReorder, onToggleDone };
}
