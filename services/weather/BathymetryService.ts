/**
 * Bathymetry Service
 * Provides elevation/depth data for marine areas using Open Topo Data GEBCO
 *
 * Data source: Open Topo Data GEBCO (https://www.opentopodata.org/datasets/gebco2020/)
 * Coverage: Global
 * Resolution: 15 arc-seconds (~450m at equator)
 * Cost: Free, no quota limits
 */

import axios from 'axios';
import { createLogger } from '@/lib/utils/logger';
import type { GeoLocation } from '@/lib/types/map';

// Supabase Edge Function URL for bathymetry proxy (avoids CORS)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qavekrwdbsobecwrfxwu.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const BATHYMETRY_PROXY_URL = `${SUPABASE_URL}/functions/v1/bathymetry-proxy`;

// Cache duration - bathymetry doesn't change
const ELEVATION_CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 1 year
const logger = createLogger('BathymetryService');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class BathymetryService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private static instance: BathymetryService | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): BathymetryService {
    if (!BathymetryService.instance) {
      BathymetryService.instance = new BathymetryService();
    }
    return BathymetryService.instance;
  }

  /**
   * POST to the bathymetry proxy, retrying once on a 429. Upstream Open Topo
   * Data allows ~1 call/sec, so concurrent callers can trip a transient rate
   * limit; the proxy signals it with 429 + Retry-After, which we honor here.
   */
  private async postProxy(
    locations: { lat: number; lng: number }[],
    timeout: number
  ) {
    const doPost = () =>
      axios.post(
        BATHYMETRY_PROXY_URL,
        { locations },
        {
          timeout,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

    try {
      return await doPost();
    } catch (error: any) {
      if (error?.response?.status !== 429) throw error;
      const retryAfter = Number(error?.response?.headers?.['retry-after']) || 2;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 5) * 1000));
      return doPost();
    }
  }

  /**
   * Get elevation/bathymetry at a single point
   * Returns elevation in meters (negative = below sea level / ocean depth)
   *
   * Resolution: ~450m (15 arc-seconds)
   * Data source: Open Topo Data GEBCO (free, global coverage via Supabase Edge Function)
   */
  async getElevation(location: GeoLocation): Promise<number> {
    // Round to 4 decimal places for cache key (still ~11m accuracy)
    const roundedLat = Math.round(location.latitude * 10000) / 10000;
    const roundedLng = Math.round(location.longitude * 10000) / 10000;
    const cacheKey = `elevation_${roundedLat}_${roundedLng}`;

    const cached = this.getCached<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    try {
      // Use Supabase Edge Function proxy to avoid CORS
      const response = await this.postProxy(
        [{ lat: location.latitude, lng: location.longitude }],
        15000
      );

      const result = response.data;

      if (result.status !== 'OK' || !result.results || result.results.length === 0) {
        logger.warn('[Bathymetry] Invalid response:', result);
        return 0;
      }

      // Elevation is already in meters (negative = below sea level)
      const elevation = result.results[0].elevation;

      logger.info('[Bathymetry] Elevation fetched:', { location, elevation });

      // Cache for 1 year - bathymetry doesn't change
      this.setCache(cacheKey, elevation, ELEVATION_CACHE_DURATION);

      return elevation;
    } catch (error: any) {
      // Bathymetry is optional enrichment; it fails soft to 0. A transient
      // upstream rate-limit / network blip must not surface as a red error box.
      logger.warn('[Bathymetry] Failed to fetch elevation (non-fatal):', {
        error: error?.message || error,
        status: error?.response?.status,
        location,
      });
      return 0;
    }
  }

  /**
   * Get elevations for multiple locations in a single batched request
   * Uses the Supabase Edge Function proxy for CORS-free requests
   * Supports up to 100 locations per request
   */
  async getElevationsBatch(
    locations: { latitude: number; longitude: number }[]
  ): Promise<{ lat: number; lng: number; elevation: number }[]> {
    if (locations.length === 0) {
      return [];
    }

    // Check cache for each location
    const results: { lat: number; lng: number; elevation: number; cached: boolean }[] = [];
    const uncachedLocations: { lat: number; lng: number; index: number }[] = [];

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const roundedLat = Math.round(loc.latitude * 10000) / 10000;
      const roundedLng = Math.round(loc.longitude * 10000) / 10000;
      const cacheKey = `elevation_${roundedLat}_${roundedLng}`;

      const cached = this.getCached<number>(cacheKey);
      if (cached !== null && cached !== undefined) {
        results.push({
          lat: loc.latitude,
          lng: loc.longitude,
          elevation: cached,
          cached: true
        });
      } else {
        uncachedLocations.push({
          lat: loc.latitude,
          lng: loc.longitude,
          index: i
        });
        results.push({
          lat: loc.latitude,
          lng: loc.longitude,
          elevation: 0, // Will be updated
          cached: false
        });
      }
    }

    // If all locations are cached, return immediately
    if (uncachedLocations.length === 0) {
      logger.info('[Bathymetry] All', locations.length, 'locations served from cache');
      return results.map(r => ({ lat: r.lat, lng: r.lng, elevation: r.elevation }));
    }

    logger.info('[Bathymetry] Fetching', uncachedLocations.length, 'uncached locations (', locations.length - uncachedLocations.length, 'from cache)');

    try {
      // Call edge function with batched locations (30s timeout for batches)
      const response = await this.postProxy(
        uncachedLocations.map(loc => ({ lat: loc.lat, lng: loc.lng })),
        30000
      );

      const data = response.data;

      if (data.status !== 'OK' || !data.results) {
        logger.warn('[Bathymetry] Batch request failed:', data.error || 'Unknown error');
        return results.map(r => ({ lat: r.lat, lng: r.lng, elevation: r.elevation }));
      }

      // Update results with fetched elevations and cache them
      for (let i = 0; i < data.results.length && i < uncachedLocations.length; i++) {
        const fetchedResult = data.results[i];
        const originalIndex = uncachedLocations[i].index;
        const elevation = fetchedResult.elevation ?? 0;

        results[originalIndex].elevation = elevation;

        // Cache the result
        const loc = locations[originalIndex];
        const roundedLat = Math.round(loc.latitude * 10000) / 10000;
        const roundedLng = Math.round(loc.longitude * 10000) / 10000;
        const cacheKey = `elevation_${roundedLat}_${roundedLng}`;
        this.setCache(cacheKey, elevation, ELEVATION_CACHE_DURATION);
      }

      logger.info('[Bathymetry] Successfully fetched', data.results.length, 'elevations');

    } catch (error: any) {
      // Optional enrichment — fails soft to elevation 0 for uncached points.
      // Keep this at warn so a transient blip never shows a red error box.
      logger.warn('[Bathymetry] Batch request error (non-fatal):', {
        error: error?.message || error,
        status: error?.response?.status
      });
    }

    return results.map(r => ({ lat: r.lat, lng: r.lng, elevation: r.elevation }));
  }

  /**
   * Get elevation grid for a racing area
   * Returns a grid of depth points for visualization
   *
   * Uses batched requests to the Supabase Edge Function for efficiency.
   * Up to 100 points per request (gridSize 10x10 = 100 points = 1 API call)
   *
   * @param center - Center of the racing area
   * @param radiusKm - Radius in kilometers (default 5km for 10km x 10km coverage)
   * @param gridSize - Number of points per side (default 10 = 100 total points)
   * @returns Grid of elevation points with lat, lng, and depth
   */
  async getElevationGrid(
    center: GeoLocation,
    radiusKm: number = 5,
    gridSize: number = 10
  ): Promise<{
    points: { lat: number; lng: number; elevation: number; depth: number }[];
    bounds: { north: number; south: number; east: number; west: number };
    center: GeoLocation;
    minDepth: number;
    maxDepth: number;
  }> {
    // Create cache key based on center and parameters
    const cacheKey = `elevation_grid_${center.latitude.toFixed(3)}_${center.longitude.toFixed(3)}_${radiusKm}_${gridSize}`;
    const cached = this.getCached<any>(cacheKey);

    if (cached) {
      logger.info('[Bathymetry] Elevation grid served from cache');
      return cached;
    }

    // Calculate bounds
    const kmPerDegreeLat = 111.32;
    const kmPerDegreeLng = 111.32 * Math.cos(center.latitude * Math.PI / 180);

    const latOffset = radiusKm / kmPerDegreeLat;
    const lngOffset = radiusKm / kmPerDegreeLng;

    const bounds = {
      north: center.latitude + latOffset,
      south: center.latitude - latOffset,
      east: center.longitude + lngOffset,
      west: center.longitude - lngOffset,
    };

    // Generate grid points
    const latStep = (bounds.north - bounds.south) / (gridSize - 1);
    const lngStep = (bounds.east - bounds.west) / (gridSize - 1);

    const gridPoints: { latitude: number; longitude: number }[] = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        gridPoints.push({
          latitude: bounds.south + i * latStep,
          longitude: bounds.west + j * lngStep,
        });
      }
    }

    logger.info('[Bathymetry] Fetching elevation grid:', gridSize, 'x', gridSize, '=', gridPoints.length, 'points');

    // Use batched request for efficiency (1 API call for up to 100 points)
    const batchResults = await this.getElevationsBatch(gridPoints);

    // Transform results to include depth
    const points = batchResults.map(result => ({
      lat: result.lat,
      lng: result.lng,
      elevation: result.elevation,
      depth: result.elevation < 0 ? Math.abs(result.elevation) : 0, // Depth is positive, 0 for land
    }));

    // Calculate min/max depth (only for water)
    const waterPoints = points.filter(p => p.elevation < 0);
    const minDepth = waterPoints.length > 0
      ? Math.min(...waterPoints.map(p => p.depth))
      : 0;
    const maxDepth = waterPoints.length > 0
      ? Math.max(...waterPoints.map(p => p.depth))
      : 0;

    logger.info('[Bathymetry] Elevation grid complete:', waterPoints.length, 'water points,', 'depth range:', minDepth, '-', maxDepth, 'm');

    const result = {
      points,
      bounds,
      center,
      minDepth,
      maxDepth,
    };

    // Cache for 1 year
    this.setCache(cacheKey, result, ELEVATION_CACHE_DURATION);

    return result;
  }

  /**
   * Get cached data
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache data
   */
  private setCache<T>(key: string, data: T, duration: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
