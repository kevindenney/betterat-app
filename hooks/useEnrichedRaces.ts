/**
 * Hook to enrich races with real weather data
 * Fetches weather for races that don't have it in metadata
 */

import { createLogger } from '@/lib/utils/logger';
import type { RaceWeatherMetadata } from '@/services/RaceWeatherService';
import { RaceWeatherService } from '@/services/RaceWeatherService';
import { supabase } from '@/services/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const logger = createLogger('useEnrichedRaces');

const FALLBACK_WARNING_TIME = '10:00';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toCoordinatePair(latValue: unknown, lngValue: unknown): { lat: number; lng: number } | null {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng };
}

/**
 * Calculate race duration in hours from schedule array
 * Looks for "Race Start" and "Race Finish Deadline" events
 */
function calculateDurationFromSchedule(
  schedule: { date: string; time: string; event: string }[] | undefined,
  startDate: string
): number | null {
  if (!schedule || !Array.isArray(schedule)) {
    return null;
  }

  // Find finish deadline event
  const finishEvent = schedule.find(e =>
    e.event?.toLowerCase().includes('finish') &&
    (e.event?.toLowerCase().includes('deadline') || e.event?.toLowerCase().includes('time'))
  );

  if (!finishEvent?.date || !finishEvent?.time) {
    return null;
  }

  try {
    // Parse start date (already includes time for races with start_date timestamp)
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return null;
    }

    // Parse finish date and time
    const [finishH, finishM] = finishEvent.time.split(':').map(Number);
    const finishDate = new Date(finishEvent.date);
    finishDate.setUTCHours(finishH, finishM, 0, 0);

    const durationMs = finishDate.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    return durationHours > 0 ? durationHours : null;
  } catch (error) {
    logger.warn('[calculateDurationFromSchedule] Error calculating duration:', error);
    return null;
  }
}

// Cache for venue coordinates fetched from sailing_venues table.
// Backed by localStorage on web so hard refreshes don't re-hit the database.
const venueCoordinatesCache = new Map<string, { lat: number; lng: number } | null>();
const VENUE_CACHE_STORAGE_KEY = 'regattaflow:venueCoordinatesCache:v1';

function loadVenueCacheFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(VENUE_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { lat: number; lng: number } | null>;
    for (const [id, coords] of Object.entries(parsed)) {
      venueCoordinatesCache.set(id, coords);
    }
  } catch {
    // ignore corrupt cache
  }
}

function saveVenueCacheToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const obj: Record<string, { lat: number; lng: number } | null> = {};
    venueCoordinatesCache.forEach((value, key) => {
      obj[key] = value;
    });
    window.localStorage.setItem(VENUE_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage errors (quota etc)
  }
}

// Populate the in-memory cache from localStorage on module init
loadVenueCacheFromStorage();

/**
 * Fetch venue coordinates from sailing_venues table for races that have venue_id
 * but don't have coordinates in metadata
 */
async function fetchVenueCoordinatesFromDB(venueIds: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const result = new Map<string, { lat: number; lng: number }>();

  // Filter out already cached venues
  const uncachedIds = venueIds.filter(id => !venueCoordinatesCache.has(id));

  if (uncachedIds.length === 0) {
    // Return from cache
    venueIds.forEach(id => {
      const cached = venueCoordinatesCache.get(id);
      if (cached) result.set(id, cached);
    });
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('sailing_venues')
      .select('id, coordinates_lat, coordinates_lng')
      .in('id', uncachedIds);

    if (error) {
      logger.warn('[useEnrichedRaces] Error fetching venue coordinates:', error);
      return result;
    }

    if (data) {
      data.forEach(venue => {
        const coords = toCoordinatePair(venue.coordinates_lat, venue.coordinates_lng);
        if (coords) {
          result.set(venue.id, coords);
          venueCoordinatesCache.set(venue.id, coords);
          return;
        }
        venueCoordinatesCache.set(venue.id, null);
      });
      // Persist the updated cache so subsequent hard refreshes skip this round-trip
      saveVenueCacheToStorage();
    }

    // Add cached results
    venueIds.forEach(id => {
      if (!result.has(id)) {
        const cached = venueCoordinatesCache.get(id);
        if (cached) result.set(id, cached);
      }
    });

    logger.debug(`[useEnrichedRaces] Fetched ${result.size} venue coordinates from DB`);
  } catch (error) {
    logger.error('[useEnrichedRaces] Exception fetching venue coordinates:', error);
  }

  return result;
}

function extract24HourTime(isoDate: string | undefined | null): string {
  if (!isoDate) {
    return FALLBACK_WARNING_TIME;
  }

  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      logger.warn('[useEnrichedRaces] Unable to parse start date for fallback time:', isoDate);
      return FALLBACK_WARNING_TIME;
    }

    // Use UTC methods to match how EditRaceForm stores/reads times
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    if (hours === 0 && minutes === 0) {
      return FALLBACK_WARNING_TIME;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    logger.warn('[useEnrichedRaces] Exception deriving fallback warning time:', error);
    return FALLBACK_WARNING_TIME;
  }
}

interface Race {
  id: string;
  name: string;
  venue?: string;
  boat_id?: string | null;
  date: string;
  startTime?: string;
  boatClass?: string;
  classId?: string | null; // For rig tuning lookup
  vhf_channel?: string | null; // VHF channel at top level
  wind?: {
    direction: string;
    speedMin: number;
    speedMax: number;
  } | null;
  tide?: {
    state: 'flooding' | 'ebbing' | 'slack' | 'high' | 'low';
    height: number;
    direction?: string;
  } | null;
  weatherStatus?: 'loading' | 'available' | 'unavailable' | 'error' | 'too_far' | 'past' | 'no_venue';
  weatherError?: string;
  venueCoordinates?: { lat: number; lng: number } | null;
  critical_details?: {
    vhf_channel?: string;
    warning_signal?: string;
    first_start?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Extract venue coordinates from regatta metadata
 * Checks multiple possible locations where coordinates might be stored
 */
function extractVenueCoordinates(regatta: RegattaRaw): { lat: number; lng: number } | null {
  // 0. Check top-level latitude/longitude columns on race_events table
  // Note: Supabase may return these as strings if the column type is numeric
  const topLevelCoords = toCoordinatePair(regatta.latitude, regatta.longitude);
  if (topLevelCoords) {
    return topLevelCoords;
  }

  const metadata = regatta.metadata;

  if (!metadata) {
    return null;
  }

  // 1. Check explicit venue_lat/venue_lng
  const explicitVenueCoords = toCoordinatePair(metadata.venue_lat, metadata.venue_lng);
  if (explicitVenueCoords) {
    return explicitVenueCoords;
  }

  // 2. Check racing_area_coordinates
  const racingAreaCoords = metadata.racing_area_coordinates;
  const racingAreaCoordinates = toCoordinatePair(racingAreaCoords?.lat, racingAreaCoords?.lng);
  if (racingAreaCoordinates) {
    return racingAreaCoordinates;
  }

  // 3. Check venue_coordinates
  const venueCoords = metadata.venue_coordinates;
  const metadataVenueCoordinates = toCoordinatePair(venueCoords?.lat, venueCoords?.lng);
  if (metadataVenueCoordinates) {
    return metadataVenueCoordinates;
  }

  // 3b. Check start_coordinates (from add-tufte form)
  const startCoords = metadata.start_coordinates;
  const startCoordinates = toCoordinatePair(startCoords?.lat, startCoords?.lng);
  if (startCoordinates) {
    return startCoordinates;
  }

  // 3c. Check direct latitude/longitude in metadata (legacy sample race format)
  const legacyCoords = toCoordinatePair(metadata.latitude, metadata.longitude);
  if (legacyCoords) {
    return legacyCoords;
  }

  // 4. Check route_waypoints (distance racing) - calculate centroid
  const waypoints = regatta.route_waypoints;
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    const validWaypoints = waypoints.filter(
      (wp: any) => typeof wp.latitude === 'number' && typeof wp.longitude === 'number'
    );
    if (validWaypoints.length > 0) {
      const lat = validWaypoints.reduce((sum: number, wp: any) => sum + wp.latitude, 0) / validWaypoints.length;
      const lng = validWaypoints.reduce((sum: number, wp: any) => sum + wp.longitude, 0) / validWaypoints.length;
      return { lat, lng };
    }
  }

  // 5. Check racing_area_polygon - calculate centroid
  const polygon = regatta.racing_area_polygon?.coordinates?.[0];
  if (Array.isArray(polygon) && polygon.length > 0) {
    const coords = polygon
      .filter((coord: any) => Array.isArray(coord) && coord.length >= 2)
      .map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }));
    if (coords.length > 0) {
      const lat = coords.reduce((sum, point) => sum + point.lat, 0) / coords.length;
      const lng = coords.reduce((sum, point) => sum + point.lng, 0) / coords.length;
      return { lat, lng };
    }
  }

  return null;
}

interface RegattaRaw {
  id: string;
  name: string;
  start_date: string;
  warning_signal_time?: string;
  metadata?: {
    venue_name?: string;
    wind?: any;
    tide?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Build a Race object from a regatta using only synchronous logic.
 * Weather fields start as `weatherStatus: 'loading'` and get patched in later.
 * Extracted so the UI can paint immediately without awaiting weather fetches.
 */
function buildBaseRace(
  regatta: RegattaRaw,
  venueCoordinatesFromDB: Map<string, { lat: number; lng: number }>
): Race {
  // Timeline steps pass-through (no weather enrichment)
  if ((regatta as any).isTimelineStep) {
    return {
      ...regatta,
      venue: (regatta as any).venue || '',
      date: (regatta as any).date || regatta.start_date,
      isTimelineStep: true,
    } as Race;
  }

  const venueName = regatta.metadata?.venue_name || (regatta.metadata as any)?.venue || 'Venue TBD';
  const raceDate = regatta.start_date;

  let venueCoordinates = extractVenueCoordinates(regatta);
  if (!venueCoordinates && regatta.metadata?.venue_id) {
    venueCoordinates = venueCoordinatesFromDB.get(regatta.metadata.venue_id) || null;
  }

  const vhfChannel =
    regatta.vhf_channel ||
    regatta.metadata?.vhf_channel ||
    regatta.metadata?.critical_details?.vhf_channel ||
    regatta.metadata?.communications?.vhf ||
    (Array.isArray(regatta.metadata?.vhf_channels) && regatta.metadata.vhf_channels[0]?.channel) ||
    null;

  const critical_details = {
    ...regatta.metadata?.critical_details,
    vhf_channel: vhfChannel,
  };

  const classId =
    regatta.class_id ||
    regatta.metadata?.class_id ||
    regatta.metadata?.classId ||
    null;

  let className =
    regatta.metadata?.class ||
    regatta.metadata?.class_name ||
    null;

  if (!className && regatta.name) {
    const raceNameLower = regatta.name.toLowerCase();
    const knownClasses = ['dragon', 'j/80', 'j80', 'laser', 'optimist', 'rs21', 'etchells', 'farr 40', 'irc', 'orc', 'sportsboat'];
    for (const knownClass of knownClasses) {
      if (raceNameLower.includes(knownClass)) {
        className = knownClass.charAt(0).toUpperCase() + knownClass.slice(1);
        if (className.toLowerCase() === 'j80') className = 'J/80';
        break;
      }
    }
  }

  const calculatedDuration = calculateDurationFromSchedule(regatta.schedule, regatta.start_date);
  const effectiveTimeLimitHours = regatta.time_limit_hours ?? calculatedDuration;

  return {
    id: regatta.id,
    name: regatta.name,
    venue: venueName,
    date: raceDate,
    startTime: regatta.warning_signal_time || extract24HourTime(raceDate),
    boatClass: className || 'Class TBD',
    classId,
    vhf_channel: vhfChannel,
    status: regatta.status || 'upcoming',
    strategy: regatta.metadata?.strategy || 'Race strategy will be generated based on conditions.',
    critical_details,
    created_by: regatta.created_by,
    venueCoordinates,
    metadata: regatta.metadata,
    boat_id: regatta.boat_id,
    race_type: regatta.race_type || (regatta.route_waypoints?.length > 0 ? 'distance' : 'fleet'),
    total_distance_nm: regatta.total_distance_nm,
    time_limit_hours: effectiveTimeLimitHours,
    time_limit_minutes: regatta.time_limit_minutes,
    route_waypoints: regatta.route_waypoints,
    start_finish_same_location: regatta.start_finish_same_location,
    finish_venue: regatta.finish_venue,
    weatherStatus: 'loading',
  };
}

/**
 * Resolve the weather patch (wind/tide/weatherStatus) for a single race.
 * For synchronous-decidable cases (metadata has real weather, cache hit, past race,
 * too far out, no venue) this resolves immediately without an await. Otherwise
 * it fetches weather with a 5s timeout.
 */
async function resolveRaceWeather(
  regatta: RegattaRaw,
  baseRace: Race,
  weatherCache: Map<string, RaceWeatherMetadata | null>,
  cacheUpdates: Map<string, RaceWeatherMetadata | null>,
  persistenceQueue: { regattaId: string; weather: RaceWeatherMetadata; metadata: any }[],
): Promise<Partial<Race>> {
  // Timeline steps never need weather
  if ((regatta as any).isTimelineStep) {
    return {};
  }

  const venueName = baseRace.venue ?? 'Venue TBD';
  const raceDate = baseRace.date;

  const hasWind = regatta.metadata?.wind;
  const hasTide = regatta.metadata?.tide;
  const isPlaceholderWind = hasWind && hasWind.direction === 'Variable' && hasWind.speedMin === 8 && hasWind.speedMax === 15;
  const isPlaceholderTide = hasTide && hasTide.state === 'slack' && hasTide.height === 1.0;

  if (hasWind && hasTide && !isPlaceholderWind && !isPlaceholderTide) {
    return { wind: regatta.metadata!.wind, tide: regatta.metadata!.tide, weatherStatus: 'available' };
  }

  const cacheKey = `${venueName}-${raceDate}`;
  if (weatherCache.has(cacheKey)) {
    const cachedWeather = weatherCache.get(cacheKey);
    if (cachedWeather) {
      return { wind: cachedWeather.wind, tide: cachedWeather.tide, weatherStatus: 'available' };
    }
    return { wind: null, tide: null, weatherStatus: 'unavailable' };
  }

  const raceDateObj = new Date(raceDate);
  const now = new Date();
  const hoursUntil = (raceDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < -24) {
    const r = regatta as any;
    const hasStoredWind = r.expected_wind_speed_min || r.expected_wind_speed_max || r.metadata?.wind || r.weather_conditions;
    if (hasStoredWind) {
      const wc = r.weather_conditions || {};
      const windDir = wc.wind_direction || r.expected_wind_direction || r.metadata?.wind?.direction || 'N';
      const windMin = wc.wind_speed_min ?? r.expected_wind_speed_min ?? r.metadata?.wind?.speedMin ?? 0;
      const windMax = wc.wind_speed_max ?? r.expected_wind_speed_max ?? r.metadata?.wind?.speedMax ?? windMin;
      if (windMin > 0 || windMax > 0) {
        return {
          wind: { direction: windDir, speedMin: windMin, speedMax: windMax },
          tide: (wc.tide_height || r.tide_at_start) ? {
            state: wc.tide_state || r.tide_at_start || 'unknown',
            height: wc.tide_height || 0,
            direction: wc.tide_direction || r.current_direction,
          } : null,
          weatherStatus: 'past',
        };
      }
    }
    return { wind: null, tide: null, weatherStatus: 'past' };
  }

  if (hoursUntil > 240) {
    return { wind: null, tide: null, weatherStatus: 'too_far' };
  }

  if (!venueName || venueName === 'Venue TBD') {
    return { wind: null, tide: null, weatherStatus: 'no_venue' };
  }

  try {
    const warningSignal = regatta.warning_signal_time
      || regatta.metadata?.warning_signal
      || regatta.metadata?.first_warning
      || regatta.metadata?.warning_signal_time
      || null;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        logger.warn(`[useEnrichedRaces] Weather fetch timeout for ${regatta.name}`);
        resolve(null);
      }, 5000);
    });

    let coords: { lat: number; lng: number } | null = null;
    const racingAreaCoords = regatta.metadata?.racing_area_coordinates;
    if (racingAreaCoords?.lat && racingAreaCoords?.lng) {
      coords = { lat: racingAreaCoords.lat, lng: racingAreaCoords.lng };
    }
    if (!coords && regatta.metadata?.venue_lat && regatta.metadata?.venue_lng) {
      coords = { lat: regatta.metadata.venue_lat, lng: regatta.metadata.venue_lng };
    }
    const vCoords = regatta.metadata?.venue_coordinates;
    if (!coords && vCoords?.lat && vCoords?.lng) {
      coords = { lat: vCoords.lat, lng: vCoords.lng };
    }
    const sCoords = regatta.metadata?.start_coordinates;
    if (!coords && sCoords?.lat && sCoords?.lng) {
      coords = { lat: sCoords.lat, lng: sCoords.lng };
    }
    const waypoints = regatta.route_waypoints;
    if (!coords && Array.isArray(waypoints) && waypoints.length > 0) {
      const validWaypoints = waypoints.filter(
        (wp: any) => typeof wp.latitude === 'number' && typeof wp.longitude === 'number'
      );
      if (validWaypoints.length > 0) {
        const lat = validWaypoints.reduce((s: number, wp: any) => s + wp.latitude, 0) / validWaypoints.length;
        const lng = validWaypoints.reduce((s: number, wp: any) => s + wp.longitude, 0) / validWaypoints.length;
        coords = { lat, lng };
      }
    }
    // Fallback to DB-looked-up coords stored on baseRace
    if (!coords && baseRace.venueCoordinates) {
      coords = baseRace.venueCoordinates;
    }

    const weatherPromise = coords
      ? RaceWeatherService.fetchWeatherByCoordinates(coords.lat, coords.lng, raceDate, venueName, { warningSignalTime: warningSignal })
      : RaceWeatherService.fetchWeatherByVenueName(venueName, raceDate, { warningSignalTime: warningSignal });

    const weather = await Promise.race([weatherPromise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    cacheUpdates.set(cacheKey, weather);

    if (weather) {
      persistenceQueue.push({ regattaId: regatta.id, weather, metadata: regatta.metadata || {} });
      return { wind: weather.wind, tide: weather.tide, weatherStatus: 'available' };
    }
    return { wind: null, tide: null, weatherStatus: 'unavailable' };
  } catch (error: any) {
    logger.error(`[useEnrichedRaces] Error fetching weather for ${regatta.name}:`, error);
    cacheUpdates.set(cacheKey, null);
    return { wind: null, tide: null, weatherStatus: 'error', weatherError: error?.message || 'Failed to fetch weather' };
  }
}

/**
 * Hook to enrich races with real weather data from RaceWeatherService
 *
 * @param races - Array of race objects from database
 * @returns Enriched races with real weather data where available
 */
export function useEnrichedRaces(races: RegattaRaw[]) {
  const [enrichedRaces, setEnrichedRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);
  const [weatherCache, setWeatherCache] = useState<Map<string, RaceWeatherMetadata | null>>(new Map());
  const previousRacesRef = useRef<string>('');

  /**
   * Persist weather data back to Supabase regatta metadata
   */
  const persistWeatherToDatabase = useCallback(async (
    regattaId: string,
    weather: RaceWeatherMetadata,
    existingMetadata: any
  ) => {
    try {
      const updatedMetadata = {
        ...existingMetadata,
        wind: weather.wind,
        tide: weather.tide,
        weather_provider: weather.provider,
        weather_fetched_at: weather.fetchedAt,
        weather_confidence: weather.confidence,
      };

      const { error } = await supabase
        .from('regattas')
        .update({ metadata: updatedMetadata })
        .eq('id', regattaId);

      if (error) {
        logger.error(`[useEnrichedRaces] Failed to persist weather for regatta ${regattaId}:`, error);
      } else {
        logger.debug(`[useEnrichedRaces] ✓ Persisted weather to database for regatta ${regattaId}`);
      }
    } catch (error) {
      logger.error(`[useEnrichedRaces] Exception persisting weather for regatta ${regattaId}:`, error);
    }
  }, []);

  const enrichRaces = useCallback(async () => {
    logger.info('[useEnrichedRaces] ===== STARTING ENRICHMENT =====');
    logger.info('[useEnrichedRaces] Input races:', races?.length || 0);

    if (!races || races.length === 0) {
      logger.debug('[useEnrichedRaces] No races to enrich');
      setEnrichedRaces([]);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Collect venue_ids from races that might need coordinate lookup
      const venueIdsNeedingLookup = races
        .filter(r => r.metadata?.venue_id && !extractVenueCoordinates(r))
        .map(r => r.metadata!.venue_id as string);

      // Step 2: Fetch venue coordinates from sailing_venues table (cached, usually fast)
      const venueCoordinatesFromDB = venueIdsNeedingLookup.length > 0
        ? await fetchVenueCoordinatesFromDB([...new Set(venueIdsNeedingLookup)])
        : new Map<string, { lat: number; lng: number }>();

      if (venueCoordinatesFromDB.size > 0) {
        logger.info(`[useEnrichedRaces] Fetched ${venueCoordinatesFromDB.size} venue coordinates from DB`);
      }

      // Step 3: Build base races synchronously and PAINT IMMEDIATELY with weatherStatus: 'loading'
      // so the UI unblocks without waiting for any weather fetch.
      const baseRaces: Race[] = races.map(regatta => buildBaseRace(regatta, venueCoordinatesFromDB));
      setEnrichedRaces(baseRaces);
      setLoading(false);

      // Step 4: Resolve each race's weather in parallel. Each resolution patches that one
      // race into state via functional setState so the UI streams in as results arrive.
      const cacheUpdates = new Map<string, RaceWeatherMetadata | null>();
      const persistenceQueue: { regattaId: string; weather: RaceWeatherMetadata; metadata: any }[] = [];

      await Promise.all(baseRaces.map(async (baseRace, i) => {
        const regatta = races[i];
        const patch = await resolveRaceWeather(regatta, baseRace, weatherCache, cacheUpdates, persistenceQueue);
        if (!patch || Object.keys(patch).length === 0) return;
        setEnrichedRaces(prev => prev.map(r => r.id === baseRace.id ? { ...r, ...patch } : r));
      }));

      // Step 5: Batch-update the in-memory weather cache and persist newly fetched weather to DB
      if (cacheUpdates.size > 0) {
        setWeatherCache(prev => {
          const newCache = new Map(prev);
          cacheUpdates.forEach((value, key) => newCache.set(key, value));
          return newCache;
        });
      }

      if (persistenceQueue.length > 0) {
        logger.info(`[useEnrichedRaces] Persisting ${persistenceQueue.length} weather updates to database`);
        await Promise.all(
          persistenceQueue.map(({ regattaId, weather, metadata }) =>
            persistWeatherToDatabase(regattaId, weather, metadata)
          )
        );
      }

      logger.info('[useEnrichedRaces] ===== ENRICHMENT COMPLETE =====');
      logger.info('[useEnrichedRaces] Enriched races count:', baseRaces.length);
    } catch (error) {
      logger.error('[useEnrichedRaces] Error enriching races:', error);
      // Fall back to basic mapping with status indicators so the UI still renders.
      const fallbackMap = new Map<string, { lat: number; lng: number }>();
      setEnrichedRaces(races.map(regatta => ({
        ...buildBaseRace(regatta, fallbackMap),
        wind: null,
        tide: null,
        weatherStatus: 'error' as const,
        weatherError: 'Failed to load weather data',
      })));
    } finally {
      setLoading(false);
    }
  }, [persistWeatherToDatabase, races, weatherCache]);


  useEffect(() => {
    // Create a stable key based on race IDs and dates to detect actual changes
    const racesKey = races.map(r => `${r.id}-${r.start_date}`).join(',');

    // Only enrich if races actually changed
    if (racesKey !== previousRacesRef.current) {
      previousRacesRef.current = racesKey;
      // Optimistic paint: synchronously seed enrichedRaces with the base
      // rows so newly-added items (e.g. optimistic Universal Plus inserts)
      // appear in the carousel immediately, without waiting for the async
      // venue-coordinate lookup inside enrichRaces(). Weather patches
      // stream in afterwards via setEnrichedRaces(prev => prev.map(...)).
      // Timeline steps go through buildBaseRace's pass-through branch so
      // no DB lookup is needed — this is essentially a free render.
      const emptyVenueMap = new Map<string, { lat: number; lng: number }>();
      const baseRacesSync = races.map(r => buildBaseRace(r, emptyVenueMap));
      setEnrichedRaces(baseRacesSync);
      enrichRaces();
    } else if (races.length > 0 && enrichedRaces.length > 0) {
      // Same IDs/dates — pass through field changes (title, status, etc.)
      // without re-running weather enrichment.
      const inputById = new Map(races.map(r => [r.id, r]));
      const updated = enrichedRaces.map(enriched => {
        const latest = inputById.get(enriched.id);
        if (!latest) return enriched;
        // For timeline steps, replace entirely (no weather data to preserve)
        if ((enriched as any).isTimelineStep) {
          return {
            ...latest,
            venue: (latest as any).venue || '',
            date: (latest as any).date || (latest as any).start_date,
            isTimelineStep: true,
          } as Race;
        }
        // For regular races, merge non-weather fields
        return { ...enriched, name: latest.name ?? enriched.name };
      });
      setEnrichedRaces(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races]);

  return useMemo(() => ({
    races: enrichedRaces,
    loading,
    refresh: enrichRaces,
  }), [enrichedRaces, loading, enrichRaces]);
}
