/**
 * Bathymetric and Tidal Analysis Types
 *
 * Types for underwater depth analysis and tidal current predictions
 * used for strategic racing recommendations.
 */

import type { SailingVenue } from '@/lib/types/global-venues';

/**
 * Bathymetric (underwater depth) data for a racing area
 */
export interface BathymetricData {
  /** Resolution in meters per grid cell */
  resolution: number;

  /** 2D array of depth values in meters (positive = depth below surface) */
  depths: number[][];

  /** Geographic bounds of the data */
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  /** Data source name */
  source: BathymetrySource;

  /** Date the data was collected/published */
  date?: string;

  /** Substrate type if available (sand, mud, rock, etc.) */
  substrate?: SubstrateType[][];
}

/**
 * Available bathymetric data sources
 */
export enum BathymetrySource {
  /** General Bathymetric Chart of the Oceans (global, ~450m resolution) */
  GEBCO = 'GEBCO',

  /** NOAA National Centers for Environmental Information (US, high resolution) */
  NOAA_NCEI = 'NOAA_NCEI',

  /** European Marine Observation and Data Network (Europe, high resolution) */
  EMODnet = 'EMODnet',

  /** Japan Oceanographic Data Center (Asia-Pacific) */
  JODC = 'JODC',

  /** Hong Kong Hydrographic Office */
  HKO = 'HKO',

  /** Navionics commercial charts */
  Navionics = 'Navionics',

  /** C-MAP commercial charts */
  CMAP = 'CMAP',

  /** Manual user input */
  Manual = 'Manual'
}

/**
 * Bottom substrate types affecting current friction
 */
export enum SubstrateType {
  Sand = 'sand',
  Mud = 'mud',
  Clay = 'clay',
  Rock = 'rock',
  Coral = 'coral',
  Shells = 'shells',
  Weed = 'weed',
  Unknown = 'unknown'
}

/**
 * Single tidal prediction (height or current at a specific time)
 */
export interface TidalPrediction {
  /** ISO timestamp of prediction */
  timestamp: string;

  /** Tidal phase */
  type: 'flood' | 'ebb' | 'slack' | 'high_water' | 'low_water';

  /** Current direction in degrees true (0-360, where 0=north, 90=east) */
  direction?: number;

  /** Current speed in knots */
  speed?: number;

  /** Tidal height in meters above chart datum */
  height?: number;

  /** Tidal coefficient (0-1, where 1=max spring, 0=max neap) */
  coefficient?: number;
}

/**
 * Complete tidal analysis for a location and time range
 */
export interface TidalAnalysis {
  /** Array of tidal predictions covering the time range */
  predictions: TidalPrediction[];

  /** Representative current speed for the analysis window (knots) */
  currentSpeed?: number;

  /** Representative current direction for the analysis window (degrees true) */
  currentDirection?: number;

  /** Summary of prevailing current for race window */
  currentSummary?: {
    /** Average current speed in knots */
    averageSpeed: number;

    /** Average current direction in degrees true */
    averageDirection: number;

    /** Variability factor (0-1, higher = more variable) */
    variability?: number;

    /** Whether the current is flood, ebb, or slack dominant */
    dominantPhase?: 'flood' | 'ebb' | 'slack';
  };

  /** Instantaneous current snapshot for race start */
  currentSnapshot?: {
    speed: number;
    direction: number;
    phase: 'flood' | 'ebb' | 'slack';
  };

  /** Amphidromic point if relevant (point of zero tidal range) */
  amphidromicPoint?: {
    lat: number;
    lng: number;
    description: string;
  };

  /** Tidal characteristics for this location */
  characteristics: {
    /** Tidal type (semi-diurnal, diurnal, or mixed) */
    type: 'semi-diurnal' | 'diurnal' | 'mixed';

    /** Tidal range classification */
    range: 'microtidal' | 'mesotidal' | 'macrotidal';

    /** Human-readable description */
    description: string;

    /** Whether tidal current is rotary (direction rotates vs simple reversal) */
    rotary?: boolean;
  };

  /** Data source */
  source: TidalDataSource;
}

/**
 * Available tidal prediction data sources
 */
export enum TidalDataSource {
  /** NOAA Center for Operational Oceanographic Products and Services (US) */
  NOAA_COOPS = 'NOAA_COOPS',

  /** UK Hydrographic Office */
  UKHO = 'UKHO',

  /** Hong Kong Observatory */
  HKO = 'HKO',

  /** France Hydrographic Service */
  SHOM = 'SHOM',

  /** Japan Meteorological Agency */
  JMA = 'JMA',

  /** Australia Bureau of Meteorology */
  BOM = 'BOM',

  /** XTide open-source harmonics */
  XTide = 'XTide',

  /** Manual user input */
  Manual = 'Manual'
}

/**
 * Strategic zone identified from bathymetry and tidal analysis
 */
export interface StrategicZone {
  /** GeoJSON Polygon defining the zone */
  polygon: GeoJSON.Polygon;

  /** Zone type */
  type: 'acceleration' | 'deceleration' | 'eddy' | 'shear' | 'favorable' | 'adverse';

  /** Human-readable description */
  description: string;

  /** Estimated current speed in this zone (knots) */
  estimatedCurrent: number;

  /** Confidence in this prediction (0-1) */
  confidence: number;

  /** Optional friendly name */
  name?: string;

  /** Additional computed properties for visualization layers */
  properties?: {
    speedIncrease?: number;
    confidence?: number;
    description?: string;
    name?: string;
  };
}

/**
 * Complete underwater analysis for a racing area
 */
export interface UnderwaterAnalysis {
  /** Bathymetric data for the area */
  bathymetry: BathymetricData;

  /** Tidal predictions for the race time window */
  tidal: TidalAnalysis;

  /** Identified strategic zones */
  strategicFeatures: {
    /** Zones where current accelerates (favorable if current is favorable) */
    accelerationZones: StrategicZone[];

    /** Zones with eddy/counter-current formation */
    eddyZones: StrategicZone[];

    /** Zones with favorable current */
    favoredAreas: StrategicZone[];

    /** Zones with adverse current */
    adverseAreas: StrategicZone[];

    /** Zones with current shear (boundaries between fast/slow) */
    shearZones?: StrategicZone[];
  };

  /** AI-generated analysis text from Claude with bathymetric-tidal-analyst Skill */
  aiAnalysis: string;

  /** Strategic recommendations */
  recommendations: {
    /** Start line strategy and favored end */
    startStrategy: string;

    /** Upwind tactical recommendations */
    upwindStrategy: string;

    /** Downwind tactical recommendations */
    downwindStrategy: string;

    /** Mark rounding approach recommendations */
    markRoundings: string;

    /** Optimal race timing assessment */
    timing: string;
  };

  /** Confidence level in this analysis */
  confidence: 'high' | 'moderate' | 'low';

  /** Caveats and factors that could change the analysis */
  caveats?: string[];

  /** Timestamp of analysis */
  timestamp: string;

  /** Venue context */
  venue: SailingVenue;

  /** Aggregated current metrics derived from tidal + bathymetry data */
  current?: {
    /** Average speed across the racing area */
    averageSpeed: number;

    /** Average direction across the racing area (degrees true) */
    averageDirection: number;

    /** Variability factor (0-1) */
    variability?: number;

    /** Collection of sampled current vectors for visualization */
    samples?: {
      lat: number;
      lng: number;
      speed: number;
      direction: number;
      timestamp?: string;
    }[];
  };
}

/**
 * Configuration for bathymetric data fetching
 */
export interface BathymetryFetchConfig {
  /** Racing area polygon */
  racingArea: GeoJSON.Polygon;

  /** Preferred data source (will fallback if unavailable) */
  preferredSource?: BathymetrySource;

  /** Desired resolution in meters (will use best available) */
  desiredResolution?: number;

  /** Buffer around racing area in meters (default: 500m) */
  buffer?: number;
}

/**
 * Configuration for tidal prediction fetching
 */
export interface TidalFetchConfig {
  /** Center point of racing area */
  centerPoint: {
    lat: number;
    lng: number;
  };

  /** Start of time range */
  startTime: Date;

  /** End of time range */
  endTime: Date;

  /** Preferred data source (will fallback if unavailable) */
  preferredSource?: TidalDataSource;

  /** Interval between predictions in minutes (default: 15) */
  interval?: number;
}

/**
 * Request for complete underwater analysis
 */
export interface UnderwaterAnalysisRequest {
  /** Racing area boundary */
  racingArea: GeoJSON.Polygon;

  /** Scheduled race time (start) */
  raceTime: Date;

  /** Estimated race duration in minutes */
  raceDuration?: number;

  /** Venue context */
  venue: SailingVenue;

  /** Bathymetry fetch configuration */
  bathymetryConfig?: Partial<BathymetryFetchConfig>;

  /** Tidal fetch configuration */
  tidalConfig?: Partial<TidalFetchConfig>;
}

/**
 * Depth contour for visualization
 */
export interface DepthContour {
  /** Depth value in meters */
  depth: number;

  /** GeoJSON LineString for the contour */
  contour: GeoJSON.LineString;

  /** Label position (lat, lng) */
  labelPosition?: [number, number];
}

/**
 * Tidal current vector for visualization
 */
export interface CurrentVector {
  /** Position (lat, lng) */
  position: [number, number];

  /** Direction in degrees true */
  direction: number;

  /** Speed in knots */
  speed: number;

  /** Timestamp */
  timestamp: string;

  /** Tidal phase */
  phase: 'flood' | 'ebb' | 'slack';
}
