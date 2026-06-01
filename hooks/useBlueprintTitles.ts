/**
 * useBlueprintTitles — resolve a set of blueprint ids to { title, slug }, for
 * the Watch tab's "By blueprint" group headers.
 *
 * Backed by the get_blueprint_titles SECURITY DEFINER RPC: a followed step can
 * come from an org_members blueprint the viewer can't read directly, so a plain
 * timeline_blueprints query would leave some headers blank.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface BlueprintTitle {
  title: string;
  slug: string | null;
}

export function useBlueprintTitles(ids: string[]) {
  const sorted = Array.from(new Set(ids)).sort();
  const key = sorted.join(',');
  return useQuery({
    queryKey: ['blueprint-titles', key],
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, BlueprintTitle>> => {
      const { data, error } = await supabase.rpc('get_blueprint_titles', {
        p_ids: sorted,
      });
      if (error) {
        console.warn('[useBlueprintTitles] get_blueprint_titles failed', error);
        return new Map();
      }
      const map = new Map<string, BlueprintTitle>();
      for (const row of (data ?? []) as { id: string; title: string | null; slug: string | null }[]) {
        map.set(row.id, { title: row.title ?? 'Untitled blueprint', slug: row.slug });
      }
      return map;
    },
  });
}
