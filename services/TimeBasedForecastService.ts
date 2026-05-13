// @ts-nocheck

/**
 * Time-Based Forecast Service
 *
 * Manages environmental forecast data across multiple timestamps.
 * Supports interpolation between forecast points and caching of results.
 */

import type { EnvironmentalAnalysis } from './EnvironmentalAnalysisService';

/**
 * Forecast data point at a specific time
 */
export interface ForecastPoint {
  /** Timestamp */
  time: Date;

  /** Environmental analysis at this time */
  analysis: EnvironmentalAnalysis;

  /** Confidence in forecast (decreases further in future) */
  confidence: number;
}

/**
 * Forecast time series
 */
export interface ForecastTimeSeries {
  /** Venue ID */
  venueId: string;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Forecast points (typically hourly) */
  points: ForecastPoint[];

  /** When this forecast was generated */
  generatedAt: Date;

  /** Expiry time (forecasts get stale) */
  expiresAt: Date;
}

/**
 * Time-Based Forecast Service
 */
export class TimeBasedForecastService {
  private forecastCache: Map<string, ForecastTimeSeries> = new Map();

  /**
   * Generate forecast time series for a venue
   *
   * @param venue - Sailing venue
   * @param startTime - Start time (typically race start or current time)
   * @param durationHours - Forecast duration in hours
   * @param intervalHours - Interval between forecast points
   */
  async generateForecastSeries(
    venue: any,
    racingArea: GeoJSON.Polygon,
    startTime: Date,
    durationHours: number = 24,
    intervalHours: number = 1
  ): Promise<ForecastTimeSeries> {
    const cacheKey = `${venue.id}-${startTime.getTime()}`;

    // Check cache
    const cached = this.forecastCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached;
    }

    const points: ForecastPoint[] = [];
    const numPoints = Math.ceil(durationHours / intervalHours) + 1;

    // Generate forecast points with mock environmental data
    // TODO: Replace with real weather API integration (HKO, NOAA, etc.)
    for (let i = 0; i < numPoints; i++) {
      const timeOffset = i * intervalHours * 60 * 60 * 1000; // hours to ms
      const forecastTime = new Date(startTime.getTime() + timeOffset);

      // Confidence decreases with time (95% at t=0, 70% at t=24h)
      const confidence = Math.max(0.7, 0.95 - (i / numPoints) * 0.25);

      // Generate realistic mock environmental data
      const baseWindSpeed = 12;
      const baseWindDirection = 315; // NW
      const baseTideHeight = 1.5;

      // Add realistic variation over time
      const windSpeed = baseWindSpeed + Math.sin(i * 0.3) * 3 + Math.random() * 2;
      const windDirection = (baseWindDirection + Math.sin(i * 0.2) * 15) % 360;
      const currentSpeed = 0.5 + Math.sin(i * 0.25) * 0.3;
      const currentDirection = (windDirection + 180 + Math.random() * 20) % 360;
      const tideHeight = baseTideHeight + Math.sin(i * Math.PI / 6) * 0.8; // ~12h tide cycle

      // Determine tide stage
      const tideRate = Math.cos(i * Math.PI / 6) * 0.1;
      let tideStage: 'high' | 'low' | 'rising' | 'falling';
      if (tideHeight > 2.0) tideStage = 'high';
      else if (tideHeight < 1.0) tideStage = 'low';
      else if (tideRate > 0) tideStage = 'rising';
      else tideStage = 'falling';

      // Calculate racing area bounds from coordinates
      const coords = racingArea.coordinates[0];
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (const [lon, lat] of coords) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }

      const analysis: EnvironmentalAnalysis = {
        air: {
          averageWindSpeed: windSpeed,
          maxWindSpeed: windSpeed * 1.3,
          minWindSpeed: windSpeed * 0.7,
          averageWindDirection: windDirection,
          gustiness: Math.random() * 0.3 + 0.1,
          pressureGradient: { magnitude: 0.5, direction: windDirection },
          terrain: {
            resolution: 30,
            elevations: [[0]], // Flat water
            bounds: {
              north: maxLat,
              south: minLat,
              east: maxLon,
              west: minLon
            },
            source: 'srtm' as any
          },
          buildings: {
            features: [],
            source: 'osm' as any
          },
          gradientWind: {
            speed: windSpeed,
            direction: windDirection,
            source: 'mock' as any,
            timestamp: forecastTime.toISOString()
          },
          windShadowZones: [],
          accelerationZones: [],
          aiAnalysis: `Mock wind analysis for ${venue.name} at ${forecastTime.toLocaleTimeString()}`,
          recommendations: {
            startStrategy: 'Mock start strategy',
            upwindStrategy: 'Mock upwind strategy',
            downwindStrategy: 'Mock downwind strategy',
            markRoundings: 'Mock mark rounding strategy',
            timing: 'Mock timing strategy'
          },
          caveats: [],
          confidence: 'high' as const
        },
        water: {
          averageDepth: 15,
          minDepth: 8,
          maxDepth: 25,
          current: {
            averageSpeed: currentSpeed,
            maxSpeed: currentSpeed * 1.5,
            averageDirection: currentDirection,
            variability: 0.2
          },
          tide: {
            height: tideHeight,
            rate: tideRate,
            stage: tideStage,
            nextHigh: new Date(forecastTime.getTime() + 6 * 60 * 60 * 1000),
            nextLow: new Date(forecastTime.getTime() + 12 * 60 * 60 * 1000)
          },
          bathymetry: {
            resolution: 50,
            depths: [[15]], // Flat bottom at 15m
            bounds: {
              north: maxLat,
              south: minLat,
              east: maxLon,
              west: minLon
            },
            source: 'gebco' as any
          },
          tidal: {
            predictions: [{
              time: forecastTime,
              height: tideHeight,
              currentSpeed: currentSpeed,
              currentDirection: currentDirection
            }],
            source: 'mock' as any,
            harmonicConstants: []
          },
          strategicFeatures: {
            accelerationZones: [],
            eddyZones: [],
            favoredAreas: [],
            adverseAreas: [],
            shearZones: []
          },
          aiAnalysis: `Mock underwater analysis for ${venue.name} at ${forecastTime.toLocaleTimeString()}`,
          recommendations: {
            startStrategy: 'Mock depth-based start strategy',
            upwindStrategy: 'Mock depth-based upwind strategy',
            downwindStrategy: 'Mock depth-based downwind strategy',
            markRoundings: 'Mock depth-based mark rounding strategy',
            timing: 'Mock tidal timing strategy'
          },
          caveats: [],
          confidence: 'high' as const
        },
        combinedRecommendations: {
          primaryFactor: 'both' as const,
          startStrategy: 'Mock combined start strategy',
          upwindStrategy: 'Mock combined upwind strategy',
          downwindStrategy: 'Mock combined downwind strategy',
          markRoundings: 'Mock combined mark rounding strategy',
          timing: 'Mock combined timing strategy',
          optimalConditions: true,
          estimatedAdvantage: '5-10%'
        },
        confidence: 'high' as const,
        caveats: ['This is mock forecast data for testing'],
        timestamp: forecastTime.toISOString(),
        venue
      };

      points.push({
        time: forecastTime,
        analysis,
        confidence
      });

    }

    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const series: ForecastTimeSeries = {
      venueId: venue.id,
      startTime,
      endTime,
      points,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hour expiry
    };

    // Cache the series
    this.forecastCache.set(cacheKey, series);

    return series;
  }

  /**
   * Get forecast at a specific time (with interpolation if needed)
   */
  getForecastAtTime(
    series: ForecastTimeSeries,
    targetTime: Date
  ): ForecastPoint | null {
    if (targetTime < series.startTime || targetTime > series.endTime) {
      return null;
    }

    // Find bracketing points
    let before: ForecastPoint | null = null;
    let after: ForecastPoint | null = null;

    for (const point of series.points) {
      if (point.time <= targetTime) {
        before = point;
      }
      if (point.time >= targetTime && !after) {
        after = point;
        break;
      }
    }

    // Exact match
    if (before && before.time.getTime() === targetTime.getTime()) {
      return before;
    }

    if (after && after.time.getTime() === targetTime.getTime()) {
      return after;
    }

    // Interpolation needed
    if (before && after) {
      return this.interpolateForecast(before, after, targetTime);
    }

    // Use nearest
    if (before) return before;
    if (after) return after;

    return null;
  }

  /**
   * Interpolate forecast between two points
   */
  private interpolateForecast(
    before: ForecastPoint,
    after: ForecastPoint,
    targetTime: Date
  ): ForecastPoint {
    const beforeTime = before.time.getTime();
    const afterTime = after.time.getTime();
    const targetTimeMs = targetTime.getTime();

    // Linear interpolation factor (0 = before, 1 = after)
    const t = (targetTimeMs - beforeTime) / (afterTime - beforeTime);

    // Interpolate wind
    const windSpeed = this.lerp(
      before.analysis.air.averageWindSpeed,
      after.analysis.air.averageWindSpeed,
      t
    );

    const windDirection = this.lerpAngle(
      before.analysis.air.averageWindDirection,
      after.analysis.air.averageWindDirection,
      t
    );

    // Interpolate current
    const currentSpeed = this.lerp(
      before.analysis.water.current?.averageSpeed || 0,
      after.analysis.water.current?.averageSpeed || 0,
      t
    );

    const currentDirection = this.lerpAngle(
      before.analysis.water.current?.averageDirection || 0,
      after.analysis.water.current?.averageDirection || 0,
      t
    );

    // Interpolate confidence
    const confidence = this.lerp(before.confidence, after.confidence, t);

    // Create interpolated analysis
    // For simplicity, we'll use the 'before' analysis structure but update key values
    const interpolated: EnvironmentalAnalysis = {
      ...before.analysis,
      air: {
        ...before.analysis.air,
        averageWindSpeed: windSpeed,
        averageWindDirection: windDirection
      },
      water: {
        ...before.analysis.water,
        current: before.analysis.water.current
          ? {
              ...before.analysis.water.current,
              averageSpeed: currentSpeed,
              averageDirection: currentDirection
            }
          : undefined
      }
    };

    return {
      time: targetTime,
      analysis: interpolated,
      confidence
    };
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Angular interpolation (handles 0-360 wraparound)
   */
  private lerpAngle(a: number, b: number, t: number): number {
    // Normalize to 0-360
    a = ((a % 360) + 360) % 360;
    b = ((b % 360) + 360) % 360;

    // Find shortest path
    let diff = b - a;
    if (Math.abs(diff) > 180) {
      if (diff > 0) {
        diff -= 360;
      } else {
        diff += 360;
      }
    }

    const result = a + diff * t;
    return ((result % 360) + 360) % 360;
  }

  /**
   * Get forecast markers for time slider
   */
  getForecastMarkers(series: ForecastTimeSeries): {
    time: Date;
    label: string;
    color: string;
  }[] {
    const markers: { time: Date; label: string; color: string }[] = [];

    // Add race start marker
    markers.push({
      time: series.startTime,
      label: 'Start',
      color: '#00cc00'
    });

    // Add tide change markers
    for (const point of series.points) {
      if (point.analysis.water.tide?.stage === 'high' || point.analysis.water.tide?.stage === 'low') {
        markers.push({
          time: point.time,
          label: point.analysis.water.tide.stage === 'high' ? 'High Tide' : 'Low Tide',
          color: '#0080ff'
        });
      }
    }

    // Add significant wind change markers (>5 knot change)
    for (let i = 1; i < series.points.length; i++) {
      const prev = series.points[i - 1];
      const curr = series.points[i];

      const windChange = Math.abs(
        curr.analysis.air.averageWindSpeed - prev.analysis.air.averageWindSpeed
      );

      if (windChange > 5) {
        markers.push({
          time: curr.time,
          label: `${curr.analysis.air.averageWindSpeed.toFixed(0)}kt`,
          color: '#ff8800'
        });
      }
    }

    return markers;
  }

  /**
   * Clear expired forecasts from cache
   */
  clearExpiredForecasts(): void {
    const now = new Date();
    const toDelete: string[] = [];

    for (const [key, series] of this.forecastCache.entries()) {
      if (series.expiresAt < now) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => this.forecastCache.delete(key));

    if (toDelete.length > 0) {
    }
  }

  /**
   * Clear all cached forecasts
   */
  clearAllForecasts(): void {
    this.forecastCache.clear();

  }
}
