/**
 * Unified Tracking Service
 * 
 * Provides a single interface for all tracking integrations:
 * - Velocitek device imports
 * - TracTrac live tracking
 * - GPX file imports
 * - Smartphone GPS tracking
 * 
 * Also handles track analysis and storage.
 */

import { VelocitekParser } from './VelocitekParser';
import { TracTracService, TracTracConfig } from './TracTracService';
import { GPXParser } from './GPXParser';
import {
  Track,
  RaceTrack,
  TrackPoint,
  TrackImportResult,
  TrackFileFormat,
  TrackExportOptions,
  LiveTrackingSession,
  LiveBoat,
  TrackingDeviceType,
  TackTrackerStats,
} from './types';

// ============================================================================
// Service Class
// ============================================================================

export class TrackingService {
  private velocitekParser: VelocitekParser;
  private gpxParser: GPXParser;
  private tracTracService: TracTracService | null = null;

  constructor() {
    this.velocitekParser = new VelocitekParser();
    this.gpxParser = new GPXParser();
  }

  // ==========================================================================
  // File Import
  // ==========================================================================

  /**
   * Import tracks from a file
   */
  async importFile(
    file: File | { name: string; data: ArrayBuffer | string }
  ): Promise<TrackImportResult> {
    const format = this.detectFileFormat(file.name);
    
    let data: ArrayBuffer | string;
    if (file instanceof File) {
      data = format === 'vcc' 
        ? await file.arrayBuffer()
        : await file.text();
    } else {
      data = file.data;
    }

    switch (format) {
      case 'vcc':
        return this.velocitekParser.parse(data as ArrayBuffer);
      case 'gpx':
        return this.gpxParser.parse(data as string);
      case 'csv':
        return this.velocitekParser.parse(data as string);
      default:
        return {
          success: false,
          tracks: [],
          errors: [`Unsupported file format: ${format}`],
          sourceFormat: format,
        };
    }
  }

  /**
   * Detect file format from extension
   */
  private detectFileFormat(filename: string): TrackFileFormat {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'vcc': return 'vcc';
      case 'gpx': return 'gpx';
      case 'kml': return 'kml';
      case 'csv': return 'csv';
      case 'nmea':
      case 'txt': return 'nmea';
      case 'json': return 'json';
      default: return 'gpx'; // Default to GPX
    }
  }

  // ==========================================================================
  // Track Export
  // ==========================================================================

  /**
   * Export track to various formats
   */
  exportTrack(track: Track, options: TrackExportOptions): string {
    switch (options.format) {
      case 'gpx':
        return this.exportToGPX(track, options);
      case 'csv':
        return this.exportToCSV(track, options);
      case 'json':
        return JSON.stringify(track, null, 2);
      default:
        throw new Error(`Export format not supported: ${options.format}`);
    }
  }

  /**
   * Export track to GPX format
   */
  private exportToGPX(track: Track, options: TrackExportOptions): string {
    let points = track.points;
    
    if (options.simplify && options.simplifyTolerance) {
      points = this.simplifyTrack(points, options.simplifyTolerance);
    }

    const gpxPoints = points.map(p => {
      let extensions = '';
      if (options.includeStats && (p.speed !== undefined || p.heading !== undefined)) {
        extensions = `
        <extensions>
          ${p.speed !== undefined ? `<speed>${p.speed.toFixed(2)}</speed>` : ''}
          ${p.heading !== undefined ? `<course>${p.heading.toFixed(1)}</course>` : ''}
          ${p.twa !== undefined ? `<twa>${p.twa.toFixed(1)}</twa>` : ''}
          ${p.tws !== undefined ? `<tws>${p.tws.toFixed(1)}</tws>` : ''}
        </extensions>`;
      }

      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">
        <ele>${p.altitude?.toFixed(1) ?? 0}</ele>
        <time>${new Date(p.timestamp).toISOString()}</time>${extensions}
      </trkpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BetterAt"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${track.metadata?.name || 'BetterAt Track'}</name>
    <time>${new Date(track.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${track.metadata?.name || 'Track'}</name>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;
  }

  /**
   * Export track to CSV format
   */
  private exportToCSV(track: Track, options: TrackExportOptions): string {
    const headers = ['timestamp', 'lat', 'lng', 'speed', 'heading', 'cog', 'altitude'];
    if (options.includeWind) {
      headers.push('twa', 'tws');
    }

    let points = track.points;
    if (options.simplify && options.simplifyTolerance) {
      points = this.simplifyTrack(points, options.simplifyTolerance);
    }

    const rows = points.map(p => {
      const row = [
        new Date(p.timestamp).toISOString(),
        p.lat.toFixed(7),
        p.lng.toFixed(7),
        p.speed?.toFixed(2) ?? '',
        p.heading?.toFixed(1) ?? '',
        p.cog?.toFixed(1) ?? '',
        p.altitude?.toFixed(1) ?? '',
      ];
      if (options.includeWind) {
        row.push(p.twa?.toFixed(1) ?? '', p.tws?.toFixed(1) ?? '');
      }
      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Simplify track using Douglas-Peucker algorithm
   */
  private simplifyTrack(points: TrackPoint[], tolerance: number): TrackPoint[] {
    if (points.length <= 2) return points;

    // Find point furthest from line between first and last
    let maxDist = 0;
    let maxIndex = 0;

    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDist > tolerance) {
      const left = this.simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
      const right = this.simplifyTrack(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    }

    // Otherwise, return just the endpoints
    return [first, last];
  }

  /**
   * Calculate perpendicular distance from point to line
   */
  private perpendicularDistance(
    point: TrackPoint,
    lineStart: TrackPoint,
    lineEnd: TrackPoint
  ): number {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return 0;

    const u = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (mag * mag);
    
    const closestLng = lineStart.lng + u * dx;
    const closestLat = lineStart.lat + u * dy;

    // Return distance in meters (approximate)
    const dLat = (point.lat - closestLat) * 111000;
    const dLng = (point.lng - closestLng) * 111000 * Math.cos(point.lat * Math.PI / 180);

    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  // ==========================================================================
  // Live Tracking (TracTrac)
  // ==========================================================================

  /**
   * Connect to TracTrac live tracking
   */
  connectLiveTracking(config: TracTracConfig): TracTracService {
    if (this.tracTracService) {
      this.tracTracService.disconnect();
    }
    
    this.tracTracService = new TracTracService(config);
    
    if (config.eventId) {
      this.tracTracService.connect(config.eventId);
    }

    return this.tracTracService;
  }

  /**
   * Disconnect from live tracking
   */
  disconnectLiveTracking(): void {
    this.tracTracService?.disconnect();
    this.tracTracService = null;
  }

  /**
   * Get current live positions
   */
  getLivePositions(): LiveBoat[] {
    return this.tracTracService?.getBoatPositions() || [];
  }

  // ==========================================================================
  // Track Analysis
  // ==========================================================================

  /**
   * Calculate track statistics
   */
  calculateStats(track: Track): TackTrackerStats {
    const points = track.points;
    if (points.length === 0) {
      return {
        maxSpeed: 0,
        avgSpeed: 0,
        distance: 0,
        duration: 0,
      };
    }

    let maxSpeed = 0;
    let totalSpeed = 0;
    let speedCount = 0;
    let distance = 0;
    let tackCount = 0;
    let gybeCount = 0;
    let lastHeading: number | undefined;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Speed stats
      if (point.speed !== undefined) {
        maxSpeed = Math.max(maxSpeed, point.speed);
        totalSpeed += point.speed;
        speedCount++;
      }

      // Distance
      if (i > 0) {
        distance += this.haversineDistance(points[i - 1], point);
      }

      // Tack/gybe detection
      if (lastHeading !== undefined && point.heading !== undefined) {
        const headingChange = this.normalizeAngle(point.heading - lastHeading);
        
        // Significant heading change (> 60°) indicates tack or gybe
        if (Math.abs(headingChange) > 60) {
          // Determine if tack or gybe based on wind angle (if available)
          if (point.twa !== undefined) {
            if (Math.abs(point.twa) < 90) {
              tackCount++;
            } else {
              gybeCount++;
            }
          }
        }
      }
      lastHeading = point.heading;
    }

    const duration = track.endTime - track.startTime;

    return {
      maxSpeed,
      avgSpeed: speedCount > 0 ? totalSpeed / speedCount : 0,
      distance: distance / 1852, // Convert meters to nautical miles
      duration,
      tackCount,
      gybeCount,
    };
  }

  /**
   * Calculate VMG (Velocity Made Good) for a track
   */
  calculateVMG(track: Track, windDirection: number): { vmgUp: number; vmgDown: number } {
    const upwindPoints: number[] = [];
    const downwindPoints: number[] = [];

    for (const point of track.points) {
      if (point.speed === undefined || point.heading === undefined) continue;

      const twa = this.normalizeAngle(point.heading - windDirection);
      const vmg = point.speed * Math.cos(twa * Math.PI / 180);

      if (Math.abs(twa) < 90) {
        upwindPoints.push(vmg);
      } else {
        downwindPoints.push(Math.abs(vmg));
      }
    }

    return {
      vmgUp: upwindPoints.length > 0 
        ? upwindPoints.reduce((a, b) => a + b, 0) / upwindPoints.length 
        : 0,
      vmgDown: downwindPoints.length > 0 
        ? downwindPoints.reduce((a, b) => a + b, 0) / downwindPoints.length 
        : 0,
    };
  }

  /**
   * Haversine distance (meters)
   */
  private haversineDistance(p1: TrackPoint, p2: TrackPoint): number {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Normalize angle to -180 to 180
   */
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }
}

export default TrackingService;
