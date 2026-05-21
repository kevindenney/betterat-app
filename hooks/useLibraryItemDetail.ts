/**
 * useLibraryItemDetail — hydrates the /library/items/[id] detail screen.
 *
 * Reads the library_items row plus three sets of back-references:
 *   - concept_origins   → "Origin" rows (a concept was seeded by this item)
 *   - concept_citations → "Cited" rows (a concept cites this item)
 *   - step_library_before → "In step" rows (this item is on a step's
 *                            before-shift checklist)
 *
 * Returns a ResourceItemFull (with marks: [] until library_marks exists).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { DEMO_LIBRARY_ITEMS } from '@/components/library/resources/demoItems';
import type {
  BackRefRow,
  LibraryFormat,
  ResourceItemFull,
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

function formatLabelFor(format: LibraryFormat): string {
  return format === 'pdf' ? 'PDF' : format.charAt(0).toUpperCase() + format.slice(1);
}

function metaFor(row: {
  page_count: number | null;
  duration_min: number | null;
  year: number | null;
}): string {
  const parts: string[] = [];
  if (row.page_count) parts.push(`${row.page_count} pages`);
  else if (row.duration_min) parts.push(`${row.duration_min} min`);
  if (row.year) parts.push(String(row.year));
  return parts.join(' · ');
}

function sourceLineFor(row: {
  source_label: string | null;
  captured_at: string | null;
}): string {
  const parts: string[] = [];
  if (row.source_label) parts.push(row.source_label);
  if (row.captured_at) {
    parts.push(
      `Added ${new Date(row.captured_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
    );
  }
  return parts.join(' · ');
}

export function useLibraryItemDetail(id: string | undefined) {
  return useQuery<ResourceItemFull | null>({
    queryKey: ['library-item-detail', id],
    enabled: Boolean(id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!id) return null;

      // ResourcesZone ships hardcoded demo cards (aacn-sepsis, jhh-code-blue,
      // …). Without DB seeding, tapping one resolves nothing; short-circuit
      // to inline demo data so the detail screen renders.
      const demo = DEMO_LIBRARY_ITEMS[id];
      if (demo) return demo;

      const { data: item, error: itemErr } = await supabase
        .from('library_items')
        .select(
          'id, kind, title, source_label, year, page_count, duration_min, captured_at',
        )
        .eq('id', id)
        .maybeSingle();
      if (itemErr) throw itemErr;
      if (!item) return null;

      const [
        { data: origins },
        { data: citations },
        { data: stepRefs },
      ] = await Promise.all([
        supabase
          .from('concept_origins')
          .select('concept_id, quote_text')
          .eq('library_item_id', id),
        supabase
          .from('concept_citations')
          .select('concept_id, context')
          .eq('library_item_id', id),
        supabase
          .from('step_library_before')
          .select('step_id, read_at')
          .eq('library_item_id', id),
      ]);

      const conceptIds = Array.from(
        new Set([
          ...((origins ?? []) as { concept_id: string }[]).map((r) => r.concept_id),
          ...((citations ?? []) as { concept_id: string }[]).map((r) => r.concept_id),
        ]),
      );
      const stepIds = Array.from(
        new Set(((stepRefs ?? []) as { step_id: string }[]).map((r) => r.step_id)),
      );

      const conceptById = new Map<string, { title: string }>();
      if (conceptIds.length > 0) {
        const { data: concepts } = await supabase
          .from('playbook_concepts')
          .select('id, title')
          .in('id', conceptIds);
        for (const c of (concepts ?? []) as { id: string; title: string }[]) {
          conceptById.set(c.id, { title: c.title });
        }
      }
      const stepById = new Map<string, { title: string }>();
      if (stepIds.length > 0) {
        const { data: steps } = await supabase
          .from('timeline_steps')
          .select('id, title')
          .in('id', stepIds);
        for (const s of (steps ?? []) as { id: string; title: string }[]) {
          stepById.set(s.id, { title: s.title });
        }
      }

      const backRefs: BackRefRow[] = [];
      for (const r of (origins ?? []) as {
        concept_id: string;
        quote_text: string | null;
      }[]) {
        const c = conceptById.get(r.concept_id);
        if (!c) continue;
        backRefs.push({
          id: `origin-${r.concept_id}`,
          role: 'origin',
          title: c.title,
          subtitle: r.quote_text
            ? `Concept · "${r.quote_text}" seeded this`
            : 'Concept · seeded by this item',
        });
      }
      for (const r of (citations ?? []) as {
        concept_id: string;
        context: string | null;
      }[]) {
        const c = conceptById.get(r.concept_id);
        if (!c) continue;
        backRefs.push({
          id: `cited-${r.concept_id}`,
          role: 'cited',
          title: c.title,
          subtitle: r.context ? `Concept · ${r.context}` : 'Concept · references this',
        });
      }
      for (const r of (stepRefs ?? []) as {
        step_id: string;
        read_at: string | null;
      }[]) {
        const s = stepById.get(r.step_id);
        if (!s) continue;
        backRefs.push({
          id: `step-${r.step_id}`,
          role: 'in_step',
          title: s.title,
          subtitle: r.read_at
            ? `Read ${new Date(r.read_at).toLocaleDateString()}`
            : 'Included as read before shift',
        });
      }

      const row = item as {
        id: string;
        kind: string | null;
        title: string;
        source_label: string | null;
        year: number | null;
        page_count: number | null;
        duration_min: number | null;
        captured_at: string | null;
      };
      const format = toFormat(row.kind);

      return {
        id: row.id,
        format,
        formatLabel: formatLabelFor(format),
        meta: metaFor(row),
        title: row.title,
        sourceLine: sourceLineFor(row),
        backRefs,
        marks: [],
      };
    },
  });
}
