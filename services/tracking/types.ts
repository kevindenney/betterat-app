/**
 * GPS Tracking Types
 * 
 * Common types for boat tracking integrations including:
 * - Velocitek (SpeedPuck, Shift, ProStart, RTK Puck)
 * - TracTrac (live race tracking)
 * - TackTracker (analysis platform)
 * - eStela (app-based tracking)
 * - KWINDOO (smartphone tracking)
 */

// ============================================================================
// Core Types
// ============================================================================

export interface GPSPosition {
  lat: number;
  lng: number;
  timestamp: number; // Unix timestamp in ms
  accuracy?: number; // meters
  altitude?: number; // meters
}

export interface TrackPoint extends GPSPosition {
  speed?: number; // knots
  heading?: number; // degrees true
  cog?: number; // course over ground, degrees
  sog?: number; // speed over ground, knots
  twa?: number; // true wind angle, degrees
  tws?: number; // true wind speed, knots
  heel?: number; // heel angle, degrees (if available)
  pitch?: number; // pitch angle, degrees (if available)
}

export interface Track {
  id: string;
  boatId?: string;
  sailNumber?: string;
  deviceId?: string;
  deviceType: TrackingDeviceType;
  points: TrackPoint[];
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

export interface RaceTrack extends Track {
  raceId: string;
  className?: string;
  helmName?: string;
  position?: number; // finishing position
  elapsedTime?: number; // ms
}

// ============================================================================
// Device Types
// ============================================================================

export type TrackingDeviceType =
  | 'velocitek_speedpuck'
  | 'velocitek_shift'
  | 'velocitek_prostart'
  | 'velocitek_rtk_puck'
  | 'tractrac'
  | 'tacktracker'
  | 'estela'
  | 'kwindoo'
  | 'smartphone_gps'
  | 'ais'
  | 'generic_gpx'
  | 'unknown';

export interface TrackingDevice {
  id: string;
  type: TrackingDeviceType;
  name: string;
  serialNumber?: string;
  firmwareVersion?: string;
  batteryLevel?: number; // percentage
  lastSeen?: number; // Unix timestamp
  isConnected: boolean;
}

// ============================================================================
// Velocitek Types
// ============================================================================

export interface VelocitekVCCHeader {
  deviceType: 'SpeedPuck' | 'Shift' | 'ProStart' | 'RTK Puck';
  serialNumber: string;
  firmwareVersion: string;
  trackName: string;
  startTime: string; // ISO date
  endTime: string;
  sampleRate: number; // Hz
}

export interface VelocitekTrackPoint extends TrackPoint {
  // Velocitek-specific fields
  hdop?: number; // horizontal dilution of precision
  satellites?: number;
  batteryVoltage?: number;
}

export interface VelocitekTrack extends Track {
  deviceType: 'velocitek_speedpuck' | 'velocitek_shift' | 'velocitek_prostart' | 'velocitek_rtk_puck';
  header: VelocitekVCCHeader;
  points: VelocitekTrackPoint[];
}

// ============================================================================
// TracTrac Types
// ============================================================================

export interface TracTracEvent {
  eventId: string;
  eventName: string;
  startTime: string;
  endTime?: string;
  venue: {
    name: string;
    lat: number;
    lng: number;
  };
  classes: TracTracClass[];
  races: TracTracRace[];
}

export interface TracTracClass {
  id: string;
  name: string;
  color: string; // hex color for visualization
}

export interface TracTracRace {
  id: string;
  raceNumber: number;
  className: string;
  status: 'scheduled' | 'started' | 'finished' | 'abandoned';
  startTime?: string;
  finishTime?: string;
  boats: TracTracBoat[];
}

export interface TracTracBoat {
  id: string;
  sailNumber: string;
  boatName?: string;
  helmName?: string;
  trackerId: string;
  color?: string;
  currentPosition?: GPSPosition;
  lastUpdate?: number;
  isActive: boolean;
}

export interface TracTracLiveUpdate {
  eventId: string;
  raceId: string;
  boatId: string;
  position: GPSPosition;
  speed: number;
  heading: number;
  timestamp: number;
}

// ============================================================================
// TackTracker Types
// ============================================================================

export interface TackTrackerSession {
  id: string;
  name: string;
  date: string;
  venue?: string;
  tracks: TackTrackerTrack[];
  windData?: TackTrackerWindData;
}

export interface TackTrackerTrack extends Track {
  color: string;
  visible: boolean;
  stats: TackTrackerStats;
}

export interface TackTrackerStats {
  maxSpeed: number;
  avgSpeed: number;
  distance: number; // nm
  duration: number; // ms
  vmgUp?: number; // VMG upwind
  vmgDown?: number; // VMG downwind
  tackCount?: number;
  gybeCount?: number;
}

export interface TackTrackerWindData {
  direction: number; // degrees true
  speed: number; // knots
  source: 'manual' | 'sensor' | 'calculated';
}

// ============================================================================
// eStela Types
// ============================================================================

export interface eStelaEvent {
  id: string;
  name: string;
  organizer: string;
  startDate: string;
  endDate: string;
  venue: {
    name: string;
    coordinates: GPSPosition;
  };
  fleets: eStelaFleet[];
  isLive: boolean;
  publicUrl: string;
}

export interface eStelaFleet {
  id: string;
  name: string;
  boats: eStelaBoat[];
}

export interface eStelaBoat {
  id: string;
  sailNumber: string;
  name?: string;
  skipper: string;
  accessKey: string; // unique key for tracking app
  isTracking: boolean;
}

// ============================================================================
// KWINDOO Types
// ============================================================================

export interface KwindooEvent {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  venue: string;
  coordinates?: GPSPosition;
  classes: KwindooClass[];
  isPublic: boolean;
}

export interface KwindooClass {
  id: string;
  name: string;
  boats: KwindooBoat[];
}

export interface KwindooBoat {
  id: string;
  sailNumber: string;
  boatName?: string;
  skipperName: string;
  crewNames?: string[];
  clubName?: string;
  phoneNumber?: string; // for SMS-based tracking
}

// ============================================================================
// Import/Export Types
// ============================================================================

export type TrackFileFormat = 
  | 'vcc' // Velocitek Control Center
  | 'gpx' // GPS Exchange Format
  | 'kml' // Keyhole Markup Language
  | 'csv' // Generic CSV
  | 'nmea' // NMEA 0183 sentences
  | 'json'; // BetterAt native

export interface TrackImportResult {
  success: boolean;
  tracks: Track[];
  errors?: string[];
  warnings?: string[];
  sourceFormat: TrackFileFormat;
  deviceType?: TrackingDeviceType;
}

export interface TrackExportOptions {
  format: TrackFileFormat;
  includeWind?: boolean;
  includeStats?: boolean;
  simplify?: boolean; // reduce point count
  simplifyTolerance?: number; // meters
}

// ============================================================================
// Live Tracking Types
// ============================================================================

export interface LiveTrackingSession {
  id: string;
  raceId: string;
  eventId?: string;
  provider: 'tractrac' | 'estela' | 'kwindoo' | 'regattaflow';
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  boats: LiveBoat[];
  lastUpdate: number;
  viewerCount?: number;
}

export interface LiveBoat {
  id: string;
  sailNumber: string;
  name?: string;
  position: GPSPosition;
  speed: number;
  heading: number;
  isActive: boolean;
  color: string;
  trail: GPSPosition[]; // recent positions for trail visualization
}

export interface LiveTrackingConfig {
  provider: 'tractrac' | 'estela' | 'kwindoo' | 'regattaflow';
  apiKey?: string;
  eventId?: string;
  raceId?: string;
  updateInterval?: number; // ms
  trailLength?: number; // number of positions to keep
}
