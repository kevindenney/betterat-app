/**
 * useUserSavedPlaces — the user's personal saved places ("Home", "Club",
 * custom spots) for one-tap step locations.
 *
 * Owner-only by design: rows live in `user_saved_places` (RLS owner-only),
 * NOT `atlas_pois` (anon-readable) — a home address must never be public.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type SavedPlaceKind = 'home' | 'club' | 'custom';

export interface UserSavedPlace {
  id: string;
  interest_slug: string | null;
  label: string;
  kind: SavedPlaceKind;
  lat: number;
  lng: number;
  place_name: string | null;
  created_at: string;
}

const QUERY_KEY = 'user-saved-places';

export function useUserSavedPlaces() {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [QUERY_KEY, userId],
    queryFn: async (): Promise<UserSavedPlace[]> => {
      const { data: rows, error } = await supabase
        .from('user_saved_places')
        .select('id, interest_slug, label, kind, lat, lng, place_name, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (rows ?? []) as UserSavedPlace[];
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
  }, [queryClient, userId]);

  const saveMutation = useMutation({
    mutationFn: async (place: {
      label: string;
      kind: SavedPlaceKind;
      lat: number;
      lng: number;
      placeName?: string | null;
      interestSlug?: string | null;
    }) => {
      const { error } = await supabase.from('user_saved_places').insert({
        user_id: userId,
        label: place.label,
        kind: place.kind,
        lat: place.lat,
        lng: place.lng,
        place_name: place.placeName ?? null,
        interest_slug: place.interestSlug ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_saved_places').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    places: data ?? [],
    savePlace: saveMutation.mutate,
    removePlace: removeMutation.mutate,
    saving: saveMutation.isPending,
  };
}

/** Find a saved place matching the given coords (~100m tolerance). */
export function findSavedPlaceAt(
  places: UserSavedPlace[],
  lat?: number | null,
  lng?: number | null,
): UserSavedPlace | undefined {
  if (lat == null || lng == null) return undefined;
  return places.find(
    (p) => Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001,
  );
}
