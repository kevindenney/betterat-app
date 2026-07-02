/**
 * Core Services Index
 * Central export for all BetterAt services
 */

// Venue Intelligence
export { VenueService } from './venueService';
export { supabaseVenueService } from './venue/SupabaseVenueService';

// AI & Strategy
export { AIStrategyService } from './aiService';
export { DocumentParsingService } from './DocumentParsingService';

// GPS & Tracking
export { GPSTrackingService } from './gpsService';

// Offline & Sync
export { OfflineService } from './offlineService';

// Results & Scoring
export { ScoringEngine, DEFAULT_LOW_POINT_CONFIG } from './scoring/ScoringEngine';
export { ResultsService } from './ResultsService';

// Type exports
export type {
  VenueDetectionResult,
  RegionalAdaptation,
  VenueSwitchResult
} from './venueService';

export type {
  CourseExtraction,
  RaceStrategy,
  StrategyOptions,
  CourseMark,
  CourseConfiguration
} from './aiService';

export type {
  GPSPoint,
  RaceTrack,
  VMGCalculation,
  TrackAnalysis
} from './gpsService';

export type {
  CachedVenue,
  CachedStrategy,
  CachedTrack,
  SyncStatus
} from './offlineService';

export type {
  ScoringSystem,
  ScoreCode,
  RaceResult,
  SeriesEntry,
  SeriesRace,
  RaceScore,
  SeriesStanding,
  ScoringConfiguration,
  DiscardRule,
  TieBreakerRule
} from './scoring/ScoringEngine';
