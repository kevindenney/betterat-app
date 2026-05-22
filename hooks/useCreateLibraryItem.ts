/**
 * useCreateLibraryItem — inserts a library_items row and (optionally) sets
 * up the M2M interest scope + topic tags in one mutation.
 *
 * Writes:
 *   - library_items (kind, title, source_label, url_or_blob_id, year,
 *     page_count, duration_min, interest_id as primary/captured-in)
 *   - library_item_interests for the active interest so the row scopes
 *     correctly the moment it lands (no "untagged everywhere" leak)
 *   - library_item_topics for any auto-detected topic tags from the
 *     CaptureSheet detection pass
 *
 * Invalidates downstream query keys (library counts, picker, resources
 * preview) so the Library tab and "+ Pin from library" pickers reflect
 * the new row immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { LibraryFormat } from '@/components/library/resources/types';

export interface CreateLibraryItemInput {
  /** Storage kind. Maps to library_items.kind CHECK constraint. */
  kind: LibraryFormat;
  /** Human-readable title (URL hostname / filename / "Note · …" fallback ok). */
  title: string;
  /** Source label e.g. "YouTube", "NEJM", "Curbsiders". */
  source_label?: string | null;
  /** URL for links/videos/articles; blob ref for uploads (when wired). */
  url_or_blob_id?: string | null;
  year?: number | null;
  page_count?: number | null;
  duration_min?: number | null;
  /** Primary / captured-in interest. NULL when caller has no active interest. */
  interest_id?: string | null;
  /** Topic chips detected from the source. Become library_item_topics rows. */
  topic_tags?: string[];
  /** Additional interests beyond the primary; both end up in the join. */
  extra_interest_ids?: string[];
}

export function useCreateLibraryItem() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateLibraryItemInput) => {
      if (!user?.id) throw new Error('not authenticated');

      const { data: item, error } = await supabase
        .from('library_items')
        .insert({
          user_id: user.id,
          kind: input.kind,
          title: input.title,
          source_label: input.source_label ?? null,
          url_or_blob_id: input.url_or_blob_id ?? null,
          year: input.year ?? null,
          page_count: input.page_count ?? null,
          duration_min: input.duration_min ?? null,
          interest_id: input.interest_id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const itemId = (item as { id: string }).id;

      // Scope to the active interest immediately so the M2M picker
      // doesn't show this row in every interest as an "untagged" fallback.
      const interestIds = Array.from(
        new Set([
          ...(input.interest_id ? [input.interest_id] : []),
          ...(input.extra_interest_ids ?? []),
        ]),
      );
      if (interestIds.length > 0) {
        const { error: tagErr } = await supabase
          .from('library_item_interests')
          .insert(
            interestIds.map((iid) => ({ item_id: itemId, interest_id: iid })),
          );
        if (tagErr) throw tagErr;
      }

      const topics = (input.topic_tags ?? [])
        .map((t) => t.trim())
        .filter(Boolean);
      if (topics.length > 0) {
        const { error: topicErr } = await supabase
          .from('library_item_topics')
          .insert(topics.map((t) => ({ item_id: itemId, topic_tag: t })));
        // Topic insert is best-effort — duplicates ignored, other errors
        // don't unwind the item write.
        if (topicErr && topicErr.code !== '23505') {
          console.warn('[useCreateLibraryItem] topic insert failed', topicErr);
        }
      }

      return { id: itemId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-counts'] });
      qc.invalidateQueries({ queryKey: ['library-resources-preview'] });
      qc.invalidateQueries({ queryKey: ['library-items-for-picker'] });
    },
  });
}
