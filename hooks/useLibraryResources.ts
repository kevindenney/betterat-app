/**
 * useLibraryResources — the full, flat resource list behind the Resources
 * zone's managed view (search + format filter + per-row actions).
 *
 * Reuses the same scoping rule as the shelves ("tagged for this interest OR
 * untagged", via library_items_for_interest) but returns every row (not the
 * top-5 slice) plus a pin count — how many steps pin each item as before-shift
 * reading — so the row can show a "used in N steps" pill.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type {
  LibraryFormat,
  LibraryItemRow,
} from '@/components/library/resources/types';

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

function toFormat(kind: string | null | undefined): LibraryFormat {
  if (kind && (VALID_FORMATS as string[]).includes(kind)) {
    return kind as LibraryFormat;
  }
  return 'link';
}

function formatRelative(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return undefined;
  const diffMs = Date.now() - then;
  const hours = Math.floor(diffMs / 36e5);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} wk ago`;
  return new Date(iso).toLocaleDateString();
}

function metaFor(row: {
  page_count: number | null;
  duration_min: number | null;
}): string | undefined {
  if (row.page_count) return `${row.page_count} pages`;
  if (row.duration_min) return `${row.duration_min} min`;
  return undefined;
}

interface ItemRow {
  id: string;
  kind: string | null;
  title: string;
  source_label: string | null;
  page_count: number | null;
  duration_min: number | null;
  captured_at: string | null;
}

export function useLibraryResources(interestId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<LibraryItemRow[]>({
    queryKey: ['library-resources', userId, interestId ?? null],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      const { data: items, error: itemsErr } = await supabase.rpc(
        'library_items_for_interest',
        { p_interest_id: interestId ?? null },
      );
      if (itemsErr) throw itemsErr;
      const rows = (items ?? []) as ItemRow[];
      if (rows.length === 0) return [];

      // Pin counts: how many steps pin each item as before-shift reading.
      const ids = rows.map((r) => r.id);
      const { data: pinRows, error: pinErr } = await supabase
        .from('step_library_before')
        .select('library_item_id')
        .in('library_item_id', ids);
      if (pinErr) throw pinErr;
      const pinCounts = new Map<string, number>();
      for (const p of (pinRows ?? []) as { library_item_id: string }[]) {
        pinCounts.set(
          p.library_item_id,
          (pinCounts.get(p.library_item_id) ?? 0) + 1,
        );
      }

      return rows.map<LibraryItemRow>((r) => ({
        id: r.id,
        format: toFormat(r.kind),
        source: r.source_label ?? '',
        title: r.title,
        meta: metaFor(r),
        capturedFrom: r.source_label ? `From ${r.source_label}` : undefined,
        capturedAt: formatRelative(r.captured_at),
        pinCount: pinCounts.get(r.id) ?? 0,
      }));
    },
  });
}
