/**
 * useUserBoatClasses — returns the boat classes the signed-in user
 * races in. Used by the Atlas tab so a Dragon sailor sees Dragon
 * racing areas brightly and other-class areas dimmed.
 *
 * Reads `sailor_classes` joined to `boat_classes` — the canonical
 * "which classes does this sailor race?" relation. `profiles` does
 * NOT carry a primary_boat_class column in this schema, so the
 * earlier read path returned [] for everyone and nothing dimmed.
 *
 * Primary classes are emitted first so callers can treat
 * `classes[0]` as "the one they identify with most". Coaches and
 * non-sailors return [] — callers should treat that as "no class
 * filter, render everything at default brightness."
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

interface SailorClassRow {
  is_primary: boolean | null;
  boat_classes: { name: string | null } | { name: string | null }[] | null;
}

export function useUserBoatClasses() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['user-boat-classes', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SailorClassRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('sailor_classes')
        .select('is_primary, boat_classes(name)')
        .eq('sailor_id', userId);
      if (error) {
        console.warn('[atlas] sailor_classes fetch error', error);
        return [];
      }
      return (data ?? []) as SailorClassRow[];
    },
  });

  const classes = useMemo<string[]>(() => {
    const rows = query.data ?? [];
    const out: string[] = [];
    // Primary first, then secondary — so callers reading classes[0]
    // get the user's main class.
    const ordered = [...rows].sort(
      (a, b) => Number(b.is_primary ?? false) - Number(a.is_primary ?? false),
    );
    for (const row of ordered) {
      // supabase-js can return embedded relations as either an object
      // or a single-element array depending on the FK cardinality.
      // Normalize both shapes.
      const embed = row.boat_classes;
      const name = Array.isArray(embed) ? embed[0]?.name : embed?.name;
      if (name && !out.includes(name)) out.push(name);
    }
    return out;
  }, [query.data]);

  return { classes, isLoading: query.isLoading };
}
