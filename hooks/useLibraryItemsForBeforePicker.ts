/**
 * useLibraryItemsForBeforePicker — list the user's library_items for the
 * "Add from library" picker that attaches items to step_library_before.
 *
 * Returns rows in capture order (most recent first) with the minimum
 * fields the picker shows: format, title, source, brief meta.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { LibraryFormat } from '@/components/library/resources/types';

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

export interface PickerLibraryItem {
  id: string;
  format: LibraryFormat;
  title: string;
  source: string | null;
  meta: string;
}

function toFormat(kind: string | null | undefined): LibraryFormat {
  if (kind && (VALID_FORMATS as string[]).includes(kind)) {
    return kind as LibraryFormat;
  }
  return 'link';
}

interface RawRow {
  id: string;
  kind: string | null;
  title: string;
  source_label: string | null;
  page_count: number | null;
  duration_min: number | null;
}

function buildMeta(row: RawRow): string {
  const parts: string[] = [];
  if (row.page_count) parts.push(`${row.page_count} pages`);
  else if (row.duration_min) parts.push(`${row.duration_min} min`);
  if (row.source_label) parts.push(row.source_label);
  return parts.join(' · ');
}

export function useLibraryItemsForBeforePicker() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PickerLibraryItem[]>({
    queryKey: ['library-items-for-picker', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('library_items')
        .select('id, kind, title, source_label, page_count, duration_min')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as RawRow[]).map<PickerLibraryItem>((r) => ({
        id: r.id,
        format: toFormat(r.kind),
        title: r.title,
        source: r.source_label,
        meta: buildMeta(r),
      }));
    },
  });
}
