/**
 * useLibraryResourcesPreview — recent library_items for the All / Resources
 * zone previews.
 *
 * Returns the user's saved resources sorted by most-recently-added,
 * mapped into the LibraryItemRow shape the Resources surface renders.
 * Scoped through `library_items_for_interest` so the preview only shows
 * items tagged for this interest OR completely untagged — otherwise a
 * nursing resource would surface atop a Lac Craft Business library.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { LibraryFormat, LibraryItemRow } from '@/components/library/resources/types';

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

export function useLibraryResourcesPreview(interestId?: string | null, limit = 3) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<LibraryItemRow[]>({
    queryKey: ['library-resources-preview', userId, interestId ?? null, limit],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];
      // Same RPC the "See all" zone uses: filters to "tagged for this
      // interest OR completely untagged", ordered by captured_at desc.
      const { data, error } = await supabase.rpc('library_items_for_interest', {
        p_interest_id: interestId ?? null,
      });
      if (error) throw error;
      return ((data ?? []) as {
        id: string;
        kind: string | null;
        title: string;
        source_label: string | null;
        captured_at: string | null;
      }[])
        .slice(0, limit)
        .map<LibraryItemRow>((r) => ({
        id: r.id,
        format: toFormat(r.kind),
        source: r.source_label ?? '',
        title: r.title,
        capturedFrom: r.source_label ? `From ${r.source_label}` : undefined,
        capturedAt: formatRelative(r.captured_at),
      }));
    },
  });
}
