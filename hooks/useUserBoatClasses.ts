/**
 * useUserBoatClasses — returns the boat classes the signed-in user
 * races in. Used by the Atlas tab so a Dragon sailor sees Dragon
 * racing areas brightly and other-class areas dimmed.
 *
 * Reads `primary_boat_class` + `secondary_boat_classes` from
 * `profiles`. Coaches and non-sailors return [] — callers should
 * treat that as "no class filter, render everything at default
 * brightness."
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

interface ProfileRow {
  primary_boat_class: string | null;
  secondary_boat_classes: string[] | null;
}

export function useUserBoatClasses() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['user-boat-classes', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('primary_boat_class, secondary_boat_classes')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[atlas] profiles boat-class fetch error', error);
        return null;
      }
      return data;
    },
  });

  const classes = useMemo<string[]>(() => {
    const row = query.data;
    if (!row) return [];
    const out: string[] = [];
    if (row.primary_boat_class) out.push(row.primary_boat_class);
    if (Array.isArray(row.secondary_boat_classes)) {
      for (const c of row.secondary_boat_classes) {
        if (c && !out.includes(c)) out.push(c);
      }
    }
    return out;
  }, [query.data]);

  return { classes, isLoading: query.isLoading };
}
