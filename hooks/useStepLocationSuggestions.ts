/**
 * useStepLocationSuggestions — generate quick-pick venue suggestions
 * for the Plan-tab "Where?" card.
 *
 * The card already supports `quickPicks` but the existing wiring only
 * fetches `organization_locations` for nursing. Sailing (and other
 * interests with public venue data) ends up with an empty quick-pick
 * row, which is why most sailing steps ship without a location: a map
 * drop-pin is the only path and friction wins.
 *
 * Strategy: union three sources, dedupe by lat/lng+name, cap at 6.
 *   1. Home venue (sailor's home_club_id → clubs)
 *   2. The user's recently-used step locations (top 5 distinct)
 *   3. Title-keyword matches against sailing_pois (e.g. step title
 *      contains "spinnaker" → suggest Hebe Haven)
 *
 * Future: add a "near you" branch keyed off geolocation when permission
 * is granted. v1 keeps it offline-cheap so the picker never gates on a
 * permission prompt.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface StepLocationSuggestion {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  /** Why this suggestion surfaced — used for an optional subtitle. */
  reason: 'home_venue' | 'recent' | 'title_match' | 'org_location';
}

interface UseStepLocationSuggestionsArgs {
  interestSlug?: string | null;
  /** When provided, title-keyword matching expands the candidate set. */
  stepTitle?: string | null;
}

const TITLE_KEYWORD_MAP: { keywords: string[]; kinds: string[] }[] = [
  { keywords: ['spinnaker', 'kite', 'downwind'], kinds: ['marina'] },
  { keywords: ['sail loft', 'sail-loft', 'sail repair', 'new sail', 'recut'], kinds: ['sail_loft'] },
  { keywords: ['chandler', 'rigging', 'hardware', 'shackle'], kinds: ['chandler', 'rigging'] },
  { keywords: ['repair', 'haulout', 'gelcoat', 'hull'], kinds: ['repair'] },
];

function kindsForTitle(title: string): string[] {
  const lower = title.toLowerCase();
  const kinds = new Set<string>();
  for (const entry of TITLE_KEYWORD_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      entry.kinds.forEach((k) => kinds.add(k));
    }
  }
  return Array.from(kinds);
}

interface SailingPoiRow {
  id: string;
  kind: string;
  name: string;
  short_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface RecentLocationRow {
  step_id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  set_at: string;
}

async function fetchSuggestions(args: {
  userId: string;
  interestSlug?: string | null;
  stepTitle?: string | null;
}): Promise<StepLocationSuggestion[]> {
  const out: StepLocationSuggestion[] = [];
  const seen = new Set<string>();

  const pushIfNew = (s: StepLocationSuggestion) => {
    const key = s.name.toLowerCase() + '|' + (s.lat ?? '') + '|' + (s.lng ?? '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  // 1) Home venue from sailor_profiles.home_club_id → clubs.
  const { data: sailor } = await supabase
    .from('sailor_profiles')
    .select('home_club_id')
    .eq('user_id', args.userId)
    .maybeSingle<{ home_club_id: string | null }>();

  if (sailor?.home_club_id) {
    // Coordinates live on `sailing_pois` (keyed by club_id), not `clubs` —
    // the clubs table only carries a free-text `location`/`address`.
    const { data: poi } = await supabase
      .from('sailing_pois')
      .select('id, name, short_name, latitude, longitude')
      .eq('club_id', sailor.home_club_id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1)
      .maybeSingle<SailingPoiRow>();
    if (poi && poi.latitude != null && poi.longitude != null) {
      pushIfNew({
        id: `home:${poi.id}`,
        name: poi.short_name ?? poi.name,
        lat: Number(poi.latitude),
        lng: Number(poi.longitude),
        reason: 'home_venue',
      });
    }
  }

  // 2) Recent step locations the user has set themselves.
  const { data: recents } = await supabase
    .from('step_location')
    .select('step_id, name, lat, lng, set_at')
    .eq('set_by', args.userId)
    .not('name', 'is', null)
    .order('set_at', { ascending: false })
    .limit(15);

  if (recents) {
    for (const row of recents as RecentLocationRow[]) {
      if (!row.name) continue;
      pushIfNew({
        id: `recent:${row.step_id}`,
        name: row.name,
        lat: row.lat != null ? Number(row.lat) : undefined,
        lng: row.lng != null ? Number(row.lng) : undefined,
        reason: 'recent',
      });
      if (out.length >= 5) break;
    }
  }

  // 3) Title-keyword matches against sailing_pois.
  if (args.stepTitle && args.interestSlug === 'sail-racing') {
    const kinds = kindsForTitle(args.stepTitle);
    if (kinds.length > 0) {
      const { data: pois } = await supabase
        .from('sailing_pois')
        .select('id, kind, name, short_name, latitude, longitude')
        .in('kind', kinds)
        .limit(8);
      if (pois) {
        for (const p of pois as SailingPoiRow[]) {
          if (p.latitude == null || p.longitude == null) continue;
          pushIfNew({
            id: `poi:${p.id}`,
            name: p.short_name ?? p.name,
            lat: Number(p.latitude),
            lng: Number(p.longitude),
            reason: 'title_match',
          });
          if (out.length >= 6) break;
        }
      }
    }
  }

  return out.slice(0, 6);
}

export function useStepLocationSuggestions({
  interestSlug,
  stepTitle,
}: UseStepLocationSuggestionsArgs): StepLocationSuggestion[] {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;
  const titleKey = (stepTitle ?? '').trim().toLowerCase().slice(0, 80);

  const { data } = useQuery({
    queryKey: ['step-location-suggestions', userId, interestSlug, titleKey],
    queryFn: () => fetchSuggestions({ userId: userId!, interestSlug, stepTitle }),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  return data ?? [];
}
