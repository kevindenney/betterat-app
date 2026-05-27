/**
 * useUserHomeVenue — resolve the current user's home venue + region for the
 * cross-tab LocationAnchor pill.
 *
 * Pulls `sailor_profiles.home_club_id`, joins `clubs` to get name + city +
 * country, and returns the LocationAnchor-shaped `{ region, venue }` tuple.
 *
 * Behavior:
 *   - Returns `null` until the auth user is known.
 *   - Returns `{ region: null, venue: null }` when the user has no home club
 *     set. Callers should hide the pill in that case.
 *   - `region` prefers `city`; falls back to `country`.
 *   - `venue` prefers `short_name`; falls back to `name`.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface UserHomeVenue {
  region: string | null;
  venue: string | null;
  /** Home club coords — populated when the club row has lat/lng. */
  lat: number | null;
  lng: number | null;
}

interface SailorProfileRow {
  home_club_id: string | null;
}

interface ClubRow {
  name: string | null;
  short_name: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function fetchHomeVenue(userId: string): Promise<UserHomeVenue> {
  const { data: sailor, error: sailorError } = await supabase
    .from('sailor_profiles')
    .select('home_club_id')
    .eq('user_id', userId)
    .maybeSingle<SailorProfileRow>();

  if (sailorError || !sailor?.home_club_id) {
    return { region: null, venue: null, lat: null, lng: null };
  }

  const { data: club } = await supabase
    .from('clubs')
    .select('name, short_name, city, country, latitude, longitude')
    .eq('id', sailor.home_club_id)
    .maybeSingle<ClubRow>();

  if (!club) {
    return { region: null, venue: null, lat: null, lng: null };
  }

  const lat = Number.isFinite(club.latitude) ? (club.latitude as number) : null;
  const lng = Number.isFinite(club.longitude) ? (club.longitude as number) : null;
  return {
    region: club.city ?? club.country ?? null,
    venue: club.short_name ?? club.name ?? null,
    lat,
    lng,
  };
}

export function useUserHomeVenue(): UserHomeVenue | null {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;

  const { data } = useQuery({
    queryKey: ['user-home-venue', userId],
    queryFn: () => fetchHomeVenue(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) return null;
  return data ?? null;
}
