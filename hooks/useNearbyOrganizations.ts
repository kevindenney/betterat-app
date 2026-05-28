/**
 * useNearbyOrganizations — orgs with a location within ~25km of (lat, lng).
 *
 * Joins organization_locations to organizations and returns one row per
 * org (the primary / lowest-sort_order location). Powers the Discover
 * Nearby segment so a sailor in HK sees nearby yacht clubs instead of
 * the global catalog.
 *
 * Distance is computed client-side from the bbox query results so we
 * can sort nearest-first and surface a "X km away" label.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface NearbyOrganization {
  id: string;
  name: string;
  shortName: string | null;
  slug: string | null;
  type: string | null;
  locationName: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface UseNearbyOrganizationsArgs {
  lat: number | null;
  lng: number | null;
  radiusKm?: number;
  enabled?: boolean;
}

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useNearbyOrganizations({
  lat,
  lng,
  radiusKm = 25,
  enabled = true,
}: UseNearbyOrganizationsArgs) {
  // bbox math: 1° lat ≈ 111km; 1° lng ≈ 111km * cos(lat).
  const bbox = useMemo(() => {
    if (lat == null || lng == null) return null;
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
    return {
      minLat: lat - dLat,
      maxLat: lat + dLat,
      minLng: lng - dLng,
      maxLng: lng + dLng,
    };
  }, [lat, lng, radiusKm]);

  return useQuery({
    queryKey: ['nearby-organizations', lat, lng, radiusKm],
    enabled: enabled && bbox != null,
    staleTime: 60_000,
    queryFn: async (): Promise<NearbyOrganization[]> => {
      if (!bbox || lat == null || lng == null) return [];

      // Step 1: bbox query against organization_locations.
      const { data: locRows, error: locErr } = await supabase
        .from('organization_locations')
        .select('organization_id, name, lat, lng, sort_order')
        .gte('lat', bbox.minLat)
        .lte('lat', bbox.maxLat)
        .gte('lng', bbox.minLng)
        .lte('lng', bbox.maxLng)
        .order('sort_order', { ascending: true });
      if (locErr) {
        console.warn('[nearby-orgs] location query failed', locErr);
        return [];
      }
      const rows = (locRows ?? []) as {
        organization_id: string;
        name: string | null;
        lat: number;
        lng: number;
      }[];
      if (rows.length === 0) return [];

      // Keep the lowest-sort_order location per org (already ordered).
      const primaryByOrg = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!primaryByOrg.has(r.organization_id)) primaryByOrg.set(r.organization_id, r);
      }
      const orgIds = Array.from(primaryByOrg.keys());

      // Step 2: pull org metadata.
      const { data: orgs, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name, short_name, slug, type')
        .in('id', orgIds);
      if (orgErr) {
        console.warn('[nearby-orgs] org query failed', orgErr);
        return [];
      }
      const orgById = new Map(
        ((orgs ?? []) as {
          id: string;
          name: string;
          short_name: string | null;
          slug: string | null;
          type: string | null;
        }[]).map((o) => [o.id, o]),
      );

      // Step 3: compute precise distance + filter to actual radius
      // (bbox can over-include corners), sort nearest-first.
      const out: NearbyOrganization[] = [];
      for (const [orgId, loc] of primaryByOrg) {
        const org = orgById.get(orgId);
        if (!org) continue;
        const distance = haversineKm(lat, lng, loc.lat, loc.lng);
        if (distance > radiusKm) continue;
        out.push({
          id: org.id,
          name: org.name,
          shortName: org.short_name,
          slug: org.slug,
          type: org.type,
          locationName: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          distanceKm: distance,
        });
      }
      out.sort((a, b) => a.distanceKm - b.distanceKm);
      return out;
    },
  });
}
