/**
 * Course Types
 * TypeScript definitions for racing courses and marks
 */

export type CourseType =
  | 'windward_leeward'
  | 'triangle'
  | 'olympic'
  | 'trapezoid'
  | 'custom';

export type MarkType =
  | 'start'
  | 'windward'
  | 'leeward'
  | 'wing'
  | 'offset'
  | 'finish'
  | 'gate';

export type MarkColor =
  | 'red'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'blue'
  | 'white'
  | 'black';

export type MarkShape =
  | 'sphere'
  | 'cylinder'
  | 'can'
  | 'nun'
  | 'triangle'
  | 'inflatable';

export interface Mark {
  id?: string;
  name: string;
  type: MarkType;
  latitude: number;
  longitude: number;
  color?: MarkColor;
  shape?: MarkShape;
  description?: string;
}

export interface CourseLayout {
  sequence: string[]; // Array of mark names in rounding order
  roundingInstructions?: {
    [markName: string]: 'port' | 'starboard' | 'either';
  };
  laps?: number;
  gates?: {
    [gateName: string]: {
      leftMark: string;
      rightMark: string;
    };
  };
}

export interface RaceCourse {
  id: string;
  club_id?: string;
  venue_id?: string;
  name: string;
  description?: string;
  course_type: CourseType;
  marks: Mark[];
  layout?: CourseLayout;
  min_wind_direction?: number;
  max_wind_direction?: number;
  min_wind_speed?: number;
  max_wind_speed?: number;
  typical_length_nm?: number;
  estimated_duration_minutes?: number;
  last_used_date?: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface CourseFilterOptions {
  userId?: string;
  clubId?: string;
  venueId?: string;
  courseType?: CourseType;
  searchQuery?: string;
  windDirection?: number; // Filter courses suitable for this wind direction
  windSpeed?: number; // Filter courses suitable for this wind speed
}

export interface CourseValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface CourseStats {
  totalLength: number; // nautical miles
  estimatedDuration: number; // minutes
  windAngles: {
    upwind: number[];
    downwind: number[];
  };
}

// Helper type for course scope in UI
export type CourseScope = 'personal' | 'club' | 'venue';

// =============================================================================
// POSITIONED COURSE TYPES
// Types for GPS-positioned race courses overlaid on maps
// =============================================================================

/**
 * A mark with positioning information for map overlay
 */
export interface PositionedMark extends Mark {
  /** Rounding direction for this mark */
  rounding: 'port' | 'starboard';
  /** Whether user manually adjusted this mark's position */
  isUserAdjusted?: boolean;
  /** Order in the course sequence */
  sequenceOrder?: number;
}

/**
 * Start line position with pin and committee boat endpoints
 */
export interface StartLinePosition {
  pin: { lat: number; lng: number };
  committee: { lat: number; lng: number };
}

/**
 * A course that has been positioned on the map with GPS coordinates
 */
export interface PositionedCourse {
  id: string;
  regattaId: string;
  sourceDocumentId?: string;
  userId: string;
  courseType: CourseType;
  marks: PositionedMark[];
  startLine: StartLinePosition;
  windDirection: number; // degrees (0 = North, 90 = East, etc.)
  legLengthNm: number; // nautical miles
  startLineLengthM?: number; // start line length in meters (calculated from fleet size)
  hasManualAdjustments?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Template for mark placement relative to start line center
 * Coordinates are in "leg lengths" where 1.0 = one leg length upwind
 */
export interface CourseMarkTemplate {
  name: string;
  type: MarkType;
  /** Position relative to start line center, in leg lengths */
  relX: number; // positive = right (when facing upwind)
  relY: number; // positive = upwind
  rounding: 'port' | 'starboard';
  color?: MarkColor;
}

/**
 * Course type template defining mark positions for each course type
 */
export interface CourseTypeTemplate {
  type: CourseType;
  name: string;
  description: string;
  marks: CourseMarkTemplate[];
  defaultLegLengthNm: number;
}

/**
 * Options for calculating positioned course
 */
export interface CoursePositioningOptions {
  startLineCenter: { lat: number; lng: number };
  windDirection: number; // degrees
  legLengthNm?: number; // defaults to template default
  courseType: CourseType;
}

/**
 * Result of course positioning calculation
 */
export interface PositionedCourseResult {
  marks: PositionedMark[];
  startLine: StartLinePosition;
  boundingBox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * The small, persisted parameter set a full course is derivable from.
 * Stored in venue_race_courses.course_geometry (JSONB); the overlay
 * (windward/leeward marks, finish, laylines, beat corridor, start box)
 * is derived at render time by lib/courseGeometry so geometry stays
 * internally consistent when the wind axis changes.
 */
export interface CourseGeometryParams {
  /** Starboard end of the start line. */
  committee: { lat: number; lng: number };
  /** Port end of the start line. */
  pin: { lat: number; lng: number };
  /** Direction the wind blows FROM, degrees (0 = N, 90 = E) — the course axis. */
  windDirectionDeg: number;
  /** Start → windward mark, nautical miles. */
  legLengthNm: number;
  /** Close-hauled half-angle off the wind, degrees. Default 42. */
  tackAngleDeg: number;
  /** Boat LOA in meters — drives start-box depth. */
  boatLengthM: number;
  /** Start-box depth in boat lengths. Default 5. */
  startBoxDepthBoatLengths: number;
  courseType: CourseType;
}

/**
 * A venue/racing-area-scoped reusable race course (venue_race_courses row).
 */
export interface VenueRaceCourse {
  id: string;
  racingAreaId: string | null;
  venueId: string | null;
  name: string;
  courseType: CourseType;
  geometry: CourseGeometryParams;
  classesUsed: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}
