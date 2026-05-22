/**
 * useLibraryZonesData — drives the Resources zone shelves with live data,
 * falling back to the curated MSN-Capstone demo content when the user has
 * zero captures (so the demo screenshots still work on empty accounts).
 *
 * Three shelves come back together so the empty-state decision can be
 * made once at the call site:
 *   - inPlay      · items captured in the last ~14 days, up to 5
 *   - recent      · most-recent items, up to 5
 *   - collections · library_collections rows with item count + format strip
 *
 * Scope: items where library_item_interests has a row for the active
 * interest OR no rows at all (matches the picker RPC semantics).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type {
  CollectionCard,
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

interface CollectionRow {
  id: string;
  name: string;
}

export interface LibraryZonesData {
  inPlay: LibraryItemRow[];
  recent: LibraryItemRow[];
  collections: CollectionCard[];
  /** True when the user has at least one library_items row. Drives the
   *  demo-fallback decision at the call site. */
  hasAnyItems: boolean;
}

export function useLibraryZonesData(interestId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<LibraryZonesData>({
    queryKey: ['library-zones-data', userId, interestId ?? null],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const empty: LibraryZonesData = {
        inPlay: [],
        recent: [],
        collections: [],
        hasAnyItems: false,
      };
      if (!userId) return empty;

      // Picker RPC encodes the scoping rule we want everywhere else too:
      // "tagged for this interest OR completely untagged."
      const { data: items, error: itemsErr } = await supabase.rpc(
        'library_items_for_picker',
        { p_interest_id: interestId ?? null },
      );
      if (itemsErr) throw itemsErr;

      const rows = (items ?? []) as ItemRow[];

      // Already ordered by captured_at desc, limit 200, by the RPC.
      const sinceMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const inPlay = rows
        .filter((r) => {
          if (!r.captured_at) return false;
          return new Date(r.captured_at).getTime() >= sinceMs;
        })
        .slice(0, 5)
        .map<LibraryItemRow>((r) => ({
          id: r.id,
          format: toFormat(r.kind),
          source: r.source_label ?? '',
          title: r.title,
          meta: metaFor(r),
          active: true,
        }));

      const recent = rows.slice(0, 5).map<LibraryItemRow>((r) => ({
        id: r.id,
        format: toFormat(r.kind),
        source: r.source_label ?? '',
        title: r.title,
        capturedFrom: r.source_label ? `From ${r.source_label}` : undefined,
        capturedAt: formatRelative(r.captured_at),
      }));

      // Collections aren't interest-scoped in the schema (yet); user-only.
      const { data: cols, error: colsErr } = await supabase
        .from('library_collections')
        .select('id, name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6);
      if (colsErr) throw colsErr;

      // Per-collection item count + format strip (best-effort, not blocking).
      const collections: CollectionCard[] = await Promise.all(
        ((cols ?? []) as CollectionRow[]).map(async (c) => {
          const { data: linkRows } = await supabase
            .from('library_item_collections')
            .select('item_id, library_items(kind)')
            .eq('collection_id', c.id)
            .limit(20);
          const formatStrip = Array.from(
            new Set(
              ((linkRows ?? []) as {
                library_items: { kind: string | null } | null;
              }[])
                .map((r) => toFormat(r.library_items?.kind))
                .slice(0, 4),
            ),
          );
          return {
            id: c.id,
            name: c.name,
            itemCount: linkRows?.length ?? 0,
            formatStrip,
          };
        }),
      );

      return {
        inPlay,
        recent,
        collections,
        hasAnyItems: rows.length > 0,
      };
    },
  });
}
