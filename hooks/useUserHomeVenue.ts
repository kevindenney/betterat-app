/**
 * useUserHomeVenue — resolve the current user's home venue + coords for the
 * cross-tab LocationAnchor pill and the Nearby surfaces.
 *
 * Reads the `home_venue_*` snapshot columns on `sailor_profiles`. The home
 * venue is a `sailing_venues` row (clubs carry no coordinates), and its id +
 * name + lat/lng are snapshotted on the profile so this is a single-table
 * read with no join.
 *
 * Behavior:
 *   - Returns `null` until the auth user is known.
 *   - Returns all-null fields when the user has no home venue set. Callers
 *     should hide the pill / show the empty state in that case.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export const USER_HOME_VENUE_KEY = 'user-home-venue';

/** Interest slugs for which a home venue is a meaningful anchor. */
const SAILING_INTEREST_SLUGS = new Set([
  'sail-racing',
  'offshore-yacht-racing',
  'team-racing',
]);

/**
 * The cross-tab LocationAnchor pill resolves a `sailing_venues` row, so it
 * only reads correctly on sailing interests. On any other interest the venue
 * is irrelevant and surfaces as a leak (e.g. "Hong Kong - Victoria Harbor"
 * sitting atop a Lac Craft Business surface). Gate header anchors with this.
 */
export function isSailingInterest(slug?: string | null): boolean {
  return slug != null && SAILING_INTEREST_SLUGS.has(slug);
}

export interface UserHomeVenue {
  region: string | null;
  venue: string | null;
  /** Home venue coords — drive the Nearby bbox queries. */
  lat: number | null;
  lng: number | null;
}

interface SailorProfileRow {
  home_venue_id: string | null;
  home_venue_name: string | null;
  home_venue_lat: number | null;
  home_venue_lng: number | null;
}

async function fetchHomeVenue(userId: string): Promise<UserHomeVenue> {
  const { data: sailor } = await supabase
    .from('sailor_profiles')
    .select('home_venue_id, home_venue_name, home_venue_lat, home_venue_lng')
    .eq('user_id', userId)
    .maybeSingle<SailorProfileRow>();

  if (!sailor?.home_venue_id) {
    return { region: null, venue: null, lat: null, lng: null };
  }

  const lat = Number.isFinite(sailor.home_venue_lat) ? (sailor.home_venue_lat as number) : null;
  const lng = Number.isFinite(sailor.home_venue_lng) ? (sailor.home_venue_lng as number) : null;
  return {
    region: null,
    venue: sailor.home_venue_name ?? null,
    lat,
    lng,
  };
}

export function useUserHomeVenue(): UserHomeVenue | null {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;

  const { data } = useQuery({
    queryKey: [USER_HOME_VENUE_KEY, userId],
    queryFn: () => fetchHomeVenue(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) return null;
  return data ?? null;
}
