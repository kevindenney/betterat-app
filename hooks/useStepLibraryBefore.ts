/**
 * useStepLibraryBefore — reads the D37 "Before the shift" library-item
 * checklist for a step. Joins step_library_before → library_items so we get
 * format, title, and meta in one shot.
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { LibraryFormat } from '@/components/library/resources/types';

interface JoinedRow {
  id: string;
  step_id: string;
  library_item_id: string;
  position: number;
  read_at: string | null;
  how_sub_step_id: string | null;
  beat_id: string | null;
  library_items: {
    id: string;
    kind: string;
    title: string;
    source_label: string | null;
    page_count: number | null;
    duration_min: number | null;
  } | null;
}

interface BeforeRowWithItemId extends BeforeShiftItem {
  libraryItemId: string;
  howSubStepId: string | null;
  beatId: string | null;
}

const VALID_FORMATS: LibraryFormat[] = [
  'pdf',
  'video',
  'book',
  'link',
  'audio',
  'article',
  'note',
  'image',
];

function toBeforeShiftItem(row: JoinedRow): BeforeRowWithItemId | null {
  if (!row.library_items) return null;
  const kind = row.library_items.kind;
  const format: LibraryFormat = (VALID_FORMATS as string[]).includes(kind)
    ? (kind as LibraryFormat)
    : 'link';
  const metaParts: string[] = [format.toUpperCase()];
  if (row.library_items.page_count) {
    metaParts.push(`${row.library_items.page_count} pages`);
  } else if (row.library_items.duration_min) {
    metaParts.push(`${row.library_items.duration_min} min`);
  }
  if (row.library_items.source_label) {
    metaParts.push(row.library_items.source_label);
  }
  return {
    id: row.id,
    libraryItemId: row.library_items.id,
    howSubStepId: row.how_sub_step_id,
    beatId: row.beat_id,
    format,
    title: row.library_items.title,
    meta: metaParts.join(' · '),
    read: row.read_at != null,
  };
}

export function useStepLibraryBefore(stepId: string | undefined) {
  return useQuery<BeforeRowWithItemId[]>({
    queryKey: ['step-library-before', stepId],
    enabled: !!stepId,
    queryFn: async () => {
      if (!stepId) return [];
      const { data, error } = await supabase
        .from('step_library_before')
        .select(
          'id, step_id, library_item_id, position, read_at, how_sub_step_id, beat_id, library_items(id, kind, title, source_label, page_count, duration_min)'
        )
        .eq('step_id', stepId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as unknown as JoinedRow[])
        .map(toBeforeShiftItem)
        .filter((x): x is BeforeRowWithItemId => x !== null);
    },
  });
}

export function useToggleStepLibraryRead(stepId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId, read }: { rowId: string; read: boolean }) => {
      const { error } = await supabase
        .from('step_library_before')
        .update({ read_at: read ? new Date().toISOString() : null })
        .eq('id', rowId);
      if (error) throw error;
    },
    onMutate: async ({ rowId, read }) => {
      const key = ['step-library-before', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BeforeRowWithItemId[]>(key);
      qc.setQueryData<BeforeRowWithItemId[]>(key, (old) =>
        (old ?? []).map((it) => (it.id === rowId ? { ...it, read } : it))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-library-before', stepId], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['step-library-before', stepId] });
    },
  });
}

export function useAttachLibraryItemToStepBefore(stepId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      libraryItemId,
      howSubStepId,
      beatId,
    }: {
      libraryItemId: string;
      howSubStepId?: string | null;
      beatId?: string | null;
    }) => {
      if (!stepId) throw new Error('stepId required');
      if (!user?.id) throw new Error('not authenticated');
      // Pick next position: count existing + 1, server-side via head:true.
      const { count, error: countErr } = await supabase
        .from('step_library_before')
        .select('id', { count: 'exact', head: true })
        .eq('step_id', stepId);
      if (countErr) throw countErr;
      const nextPosition = (count ?? 0) + 1;
      const { error } = await supabase.from('step_library_before').insert({
        step_id: stepId,
        library_item_id: libraryItemId,
        position: nextPosition,
        added_by: user.id,
        how_sub_step_id: howSubStepId ?? null,
        beat_id: beatId ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['step-library-before', stepId] });
    },
  });
}

export function useDetachLibraryItemFromStepBefore(stepId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId }: { rowId: string }) => {
      const { data, error } = await supabase
        .from('step_library_before')
        .delete()
        .eq('id', rowId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Step library item not found.');
    },
    onMutate: async ({ rowId }) => {
      const key = ['step-library-before', stepId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BeforeRowWithItemId[]>(key);
      qc.setQueryData<BeforeRowWithItemId[]>(key, (old) =>
        (old ?? []).filter((it) => it.id !== rowId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['step-library-before', stepId], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['step-library-before', stepId] });
    },
  });
}

export function useLibraryBeforeBinding(
  stepId: string | undefined,
  interestId?: string | undefined,
) {
  const { data: items = [] } = useStepLibraryBefore(stepId);
  const toggle = useToggleStepLibraryRead(stepId);
  const attach = useAttachLibraryItemToStepBefore(stepId);
  const detach = useDetachLibraryItemFromStepBefore(stepId);
  const [pickerOpen, setPickerOpen] = useState(false);
  // When the picker was opened from a specific How row, attach the pick to
  // that sub-step; from a beat, to that beat; both null = step-level pin.
  const [pickerSubStepId, setPickerSubStepId] = useState<string | null>(null);
  const [pickerBeatId, setPickerBeatId] = useState<string | null>(null);

  const onToggle = useCallback(
    (rowId: string) => {
      const row = items.find((it) => it.id === rowId);
      if (!row) return;
      toggle.mutate({ rowId, read: !row.read });
    },
    [items, toggle]
  );

  const onRemove = useCallback(
    (rowId: string) => {
      detach.mutate({ rowId });
    },
    [detach]
  );

  const onAddFromLibrary = useCallback(() => {
    setPickerSubStepId(null);
    setPickerBeatId(null);
    setPickerOpen(true);
  }, []);

  // Open the picker targeted at a How sub-step — the pick is pinned beneath it.
  const onAddToSubStep = useCallback((subStepId: string) => {
    setPickerSubStepId(subStepId);
    setPickerBeatId(null);
    setPickerOpen(true);
  }, []);

  // Open the picker targeted at a beat — the pick is pinned beneath it.
  const onAddToBeat = useCallback((beatId: string) => {
    setPickerBeatId(beatId);
    setPickerSubStepId(null);
    setPickerOpen(true);
  }, []);

  const onPickerClose = useCallback(() => {
    setPickerOpen(false);
    setPickerSubStepId(null);
    setPickerBeatId(null);
  }, []);

  const onPickerSelect = useCallback(
    (libraryItemId: string) => {
      attach.mutate({
        libraryItemId,
        howSubStepId: pickerSubStepId,
        beatId: pickerBeatId,
      });
      setPickerOpen(false);
      setPickerSubStepId(null);
      setPickerBeatId(null);
    },
    [attach, pickerSubStepId, pickerBeatId]
  );

  const attachedItemIds = useMemo(
    () => items.map((it) => it.libraryItemId),
    [items]
  );
  const totalEstimate = computeTotalEstimate(
    items.filter((it) => !it.howSubStepId && !it.beatId)
  );

  // Step-level pins (the "Before the shift" card) — exclude anchored items so
  // they're not double-shown; anchored items render under their How row / beat.
  const cardItems: BeforeShiftItem[] = useMemo(
    () =>
      items
        .filter((it) => !it.howSubStepId && !it.beatId)
        .map(({ id, libraryItemId, format, title, meta, read }) => ({
          id,
          libraryItemId,
          format,
          title,
          meta,
          read,
        })),
    [items]
  );

  // Anchored pins grouped by How sub-step id, for inline rendering on each row.
  const itemsBySubStep: Record<string, BeforeShiftItem[]> = useMemo(() => {
    const map: Record<string, BeforeShiftItem[]> = {};
    for (const it of items) {
      if (!it.howSubStepId) continue;
      (map[it.howSubStepId] ??= []).push({
        id: it.id,
        libraryItemId: it.libraryItemId,
        format: it.format,
        title: it.title,
        meta: it.meta,
        read: it.read,
      });
    }
    return map;
  }, [items]);

  // Anchored pins grouped by beat id, for inline rendering on each beat row.
  const itemsByBeat: Record<string, BeforeShiftItem[]> = useMemo(() => {
    const map: Record<string, BeforeShiftItem[]> = {};
    for (const it of items) {
      if (!it.beatId) continue;
      (map[it.beatId] ??= []).push({
        id: it.id,
        libraryItemId: it.libraryItemId,
        format: it.format,
        title: it.title,
        meta: it.meta,
        read: it.read,
      });
    }
    return map;
  }, [items]);

  return {
    items: cardItems,
    itemsBySubStep,
    itemsByBeat,
    onToggle,
    onRemove,
    onAddFromLibrary,
    onAddToSubStep,
    onAddToBeat,
    totalEstimate,
    picker: {
      visible: pickerOpen,
      onClose: onPickerClose,
      onSelect: onPickerSelect,
      attachedItemIds,
      stepId,
      interestId,
    },
  };
}

function computeTotalEstimate(items: BeforeShiftItem[]): string | undefined {
  if (items.length === 0) return undefined;
  // Best-effort: pull "X min" / "X pages" from meta and sum.
  let minutes = 0;
  let pages = 0;
  for (const it of items) {
    const minMatch = it.meta.match(/(\d+)\s*min/i);
    const pgMatch = it.meta.match(/(\d+)\s*pages/i);
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    if (pgMatch) pages += parseInt(pgMatch[1], 10);
  }
  // Rough rule: ~1 page/min for reference reading.
  const total = minutes + Math.round(pages * 0.7);
  if (total <= 0) return undefined;
  return `~${total} min total`;
}
