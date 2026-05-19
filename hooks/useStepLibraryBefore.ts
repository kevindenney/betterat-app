/**
 * useStepLibraryBefore — reads the D37 "Before the shift" library-item
 * checklist for a step. Joins step_library_before → library_items so we get
 * format, title, and meta in one shot.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { LibraryFormat } from '@/components/library/resources/types';

interface JoinedRow {
  id: string;
  step_id: string;
  library_item_id: string;
  position: number;
  read_at: string | null;
  library_items: {
    id: string;
    kind: string;
    title: string;
    source_label: string | null;
    page_count: number | null;
    duration_min: number | null;
  } | null;
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

function toBeforeShiftItem(row: JoinedRow): BeforeShiftItem | null {
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
    format,
    title: row.library_items.title,
    meta: metaParts.join(' · '),
    read: row.read_at != null,
  };
}

export function useStepLibraryBefore(stepId: string | undefined) {
  return useQuery<BeforeShiftItem[]>({
    queryKey: ['step-library-before', stepId],
    enabled: !!stepId,
    queryFn: async () => {
      if (!stepId) return [];
      const { data, error } = await supabase
        .from('step_library_before')
        .select(
          'id, step_id, library_item_id, position, read_at, library_items(id, kind, title, source_label, page_count, duration_min)'
        )
        .eq('step_id', stepId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as unknown as JoinedRow[])
        .map(toBeforeShiftItem)
        .filter((x): x is BeforeShiftItem => x !== null);
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
      const prev = qc.getQueryData<BeforeShiftItem[]>(key);
      qc.setQueryData<BeforeShiftItem[]>(key, (old) =>
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

export function useLibraryBeforeBinding(stepId: string | undefined) {
  const { data: items = [] } = useStepLibraryBefore(stepId);
  const toggle = useToggleStepLibraryRead(stepId);
  const onToggle = useCallback(
    (rowId: string) => {
      const row = items.find((it) => it.id === rowId);
      if (!row) return;
      toggle.mutate({ rowId, read: !row.read });
    },
    [items, toggle]
  );
  const totalEstimate = computeTotalEstimate(items);
  return { items, onToggle, totalEstimate };
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
