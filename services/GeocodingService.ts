/**
 * GeocodingService — Converts location names to coordinates using OpenStreetMap Nominatim.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';

interface GeocodedResult {
  lat: number;
  lng: number;
}

export interface PlaceSearchResult {
  name: string;
  lat: number;
  lng: number;
}

interface NominatimSearchResult {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

interface NominatimAddress {
  bay?: string;
  harbour?: string;
  water?: string;
  reservoir?: string;
  beach?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  country?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

const REVERSE_CACHE_PREFIX = 'geocode:reverse:';
// 4 decimals ≈ 11 m: two taps at the same spot dedupe to the same cache key.
const REVERSE_COORD_PRECISION = 4;
const REVERSE_USER_AGENT = `BetterAt/1.0 (${Platform.OS})`;

function reverseCacheKey(lat: number, lng: number): string {
  return `${REVERSE_CACHE_PREFIX}${lat.toFixed(REVERSE_COORD_PRECISION)},${lng.toFixed(
    REVERSE_COORD_PRECISION,
  )}`;
}

/**
 * Pick the most sailing-friendly name from a Nominatim response. Prefers
 * named water features (bay/harbour/water/reservoir/beach) over populated
 * places — a sailor cares more about "Victoria Harbour" than "Central".
 */
function chooseVenueName(r: NominatimReverseResponse): string | null {
  const a = r.address ?? {};
  const water = a.bay || a.harbour || a.water || a.reservoir || a.beach;
  if (water) return water;
  if (r.name?.trim()) return r.name.trim();
  const place = a.suburb || a.neighbourhood || a.village || a.town || a.city;
  if (place) return place;
  if (r.display_name) {
    const segments = r.display_name.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length > 0) return segments.slice(0, 2).join(', ');
  }
  return null;
}

export class GeocodingService {
  private static readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

  static async geocode(query: string): Promise<GeocodedResult | null> {
    if (!query?.trim()) return null;

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'json',
        limit: '1',
      });

      const response = await fetch(`${this.NOMINATIM_URL}?${params}`, {
        headers: {
          'User-Agent': 'BetterAt/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn('[GeocodingService] Nominatim request failed:', response.status);
        return null;
      }

      const results = await response.json();
      if (!results?.length) {
        logger.debug('[GeocodingService] No results for:', query);
        return null;
      }

      const { lat, lon } = results[0];
      const parsed = { lat: parseFloat(lat), lng: parseFloat(lon) };

      if (isNaN(parsed.lat) || isNaN(parsed.lng)) return null;

      logger.debug('[GeocodingService] Geocoded:', query, '→', parsed);
      return parsed;
    } catch (error) {
      logger.warn('[GeocodingService] Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Forward-search a free-text place name to a list of named candidates.
   * Powers the location picker typeahead so well-known places (yacht clubs,
   * marinas, landmarks) resolve even when they aren't in our venues table.
   */
  static async searchPlaces(query: string, limit = 5): Promise<PlaceSearchResult[]> {
    const q = query?.trim();
    if (!q) return [];

    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: String(limit),
        addressdetails: '1',
      });
      const response = await fetch(`${this.NOMINATIM_URL}?${params}`, {
        headers: {
          'User-Agent': REVERSE_USER_AGENT,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        logger.warn('[GeocodingService] Nominatim search failed:', response.status);
        return [];
      }

      const results = (await response.json()) as NominatimSearchResult[];
      if (!Array.isArray(results)) return [];

      return results
        .map((r) => {
          const lat = parseFloat(r.lat ?? '');
          const lng = parseFloat(r.lon ?? '');
          if (isNaN(lat) || isNaN(lng)) return null;
          const name =
            r.name?.trim() ||
            r.display_name?.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', ') ||
            '';
          if (!name) return null;
          return { name, lat, lng };
        })
        .filter((r): r is PlaceSearchResult => r !== null);
    } catch (error) {
      logger.warn('[GeocodingService] Place search failed:', error);
      return [];
    }
  }

  /**
   * Reverse-geocode a coordinate to a human-readable venue name. Returns null
   * on failure — callers should fall back to raw coordinates. Cached in
   * AsyncStorage keyed by rounded lat/lng so the same pin doesn't pay the
   * round-trip twice.
   */
  static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const key = reverseCacheKey(lat, lng);

    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) return cached;
    } catch {
      // AsyncStorage hiccup — fall through to network.
    }

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        zoom: '14',
        addressdetails: '1',
      });
      const response = await fetch(`${this.NOMINATIM_REVERSE_URL}?${params}`, {
        headers: {
          'User-Agent': REVERSE_USER_AGENT,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        logger.warn('[GeocodingService] Nominatim reverse failed:', response.status);
        return null;
      }
      const data = (await response.json()) as NominatimReverseResponse;
      const name = chooseVenueName(data);
      if (name) {
        try {
          await AsyncStorage.setItem(key, name);
        } catch {
          // best effort
        }
      }
      return name;
    } catch (error) {
      logger.warn('[GeocodingService] Reverse geocoding failed:', error);
      return null;
    }
  }
}
