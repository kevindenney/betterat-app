/**
 * Race Data Utilities
 *
 * Pure utility functions for normalizing and extracting race data.
 * No state, no side effects - just data transformation.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TacticalWindSnapshot {
  speed: number;
  direction: number;
  gust?: number;
}

export interface TacticalCurrentSnapshot {
  speed: number;
  direction: number;
  type?: 'flood' | 'ebb' | 'slack';
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed: number;
  heading: number;
  accuracy?: number;
}

export interface DebriefSplitTime {
  markId: string;
  markName: string;
  time: Date;
  position: number;
  roundingType: 'port' | 'starboard';
  roundingTime: number;
}

// =============================================================================
// DIRECTION NORMALIZATION
// =============================================================================

/**
 * Cardinal direction to degrees mapping
 */
export const CARDINAL_TO_DEGREES: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

const DEGREE_PATTERN = /(-?\d+(?:\.\d+)?)/;

/**
 * Normalize a direction value to degrees (0-360)
 * Handles: numeric values, degree strings ("180°"), cardinal directions ("NW")
 */
export function normalizeDirection(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const degreeMatch = trimmed.match(DEGREE_PATTERN);
    if (degreeMatch) {
      const parsed = Number.parseFloat(degreeMatch[1]);
      if (!Number.isNaN(parsed)) {
        const normalized = parsed % 360;
        return normalized < 0 ? normalized + 360 : normalized;
      }
    }

    const lettersOnly = trimmed.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (lettersOnly && CARDINAL_TO_DEGREES[lettersOnly] !== undefined) {
      return CARDINAL_TO_DEGREES[lettersOnly];
    }
  }

  return null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Pick the first finite numeric value from an array of candidates
 */
export function pickNumeric(values: unknown[]): number | null {
  for (const candidate of values) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Normalize current/tide type string to enum
 */
export function normalizeCurrentType(value: unknown): 'flood' | 'ebb' | 'slack' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (lower.includes('flood')) {
    return 'flood';
  }
  if (lower.includes('ebb')) {
    return 'ebb';
  }
  if (lower.includes('slack')) {
    return 'slack';
  }
  return undefined;
}

// =============================================================================
// WIND SNAPSHOT EXTRACTION
// =============================================================================

/**
 * Extract a normalized wind snapshot from various source formats
 * Handles different property naming conventions from various APIs
 */
export function extractWindSnapshot(source: any): TacticalWindSnapshot | null {
  if (!source) {
    return null;
  }

  const direction = normalizeDirection(
    source.direction ??
      source.directionDegrees ??
      source.direction_degrees ??
      source.directionCardinal ??
      source.direction_cardinal ??
      source.heading ??
      source.bearing
  );

  let speed = pickNumeric([
    source.speed,
    source.speedAvg,
    source.average,
    source.knots,
    source.value,
    source.mean,
  ]);

  const min = pickNumeric([source.speedMin, source.speed_min, source.min]);
  const max = pickNumeric([source.speedMax, source.speed_max, source.max, source.gust, source.gusts]);

  if (speed === null) {
    if (min !== null && max !== null) {
      speed = (min + max) / 2;
    } else if (min !== null) {
      speed = min;
    } else if (max !== null) {
      speed = max;
    }
  }

  const gust = pickNumeric([source.gust, source.gusts, source.speedMax, source.speed_max]);

  if (direction === null || speed === null) {
    return null;
  }

  return {
    speed,
    direction,
    ...(gust !== null ? { gust } : {}),
  };
}

// =============================================================================
// CURRENT SNAPSHOT EXTRACTION
// =============================================================================

/**
 * Extract a normalized current/tide snapshot from various source formats
 */
export function extractCurrentSnapshot(source: any): TacticalCurrentSnapshot | null {
  if (!source) {
    return null;
  }

  const direction = normalizeDirection(
    source.direction ??
      source.directionDegrees ??
      source.direction_degrees ??
      source.heading ??
      source.bearing ??
      source.cardinal ??
      source.flow
  );

  const speed = pickNumeric([
    source.speed,
    source.speedKnots,
    source.knots,
    source.rate,
    source.velocity,
    source.strength,
  ]);

  if (direction === null || speed === null) {
    return null;
  }

  const type =
    normalizeCurrentType(source.type) ??
    normalizeCurrentType(source.state) ??
    normalizeCurrentType(source.flow);

  return {
    speed,
    direction,
    ...(type ? { type } : {}),
  };
}

// =============================================================================
// GPS TRACK PARSING
// =============================================================================

/**
 * Parse GPS track data from various formats
 * Returns null if no valid points found
 */
export function parseGpsTrack(rawTrack: unknown): GPSPoint[] | null {
  if (!Array.isArray(rawTrack)) {
    return null;
  }

  const parsed: GPSPoint[] = [];

  for (const point of rawTrack) {
    if (typeof point !== 'object' || point === null) {
      continue;
    }

    const latitude = typeof (point as any).latitude === 'number'
      ? (point as any).latitude
      : typeof (point as any).lat === 'number'
        ? (point as any).lat
        : null;

    const longitude = typeof (point as any).longitude === 'number'
      ? (point as any).longitude
      : typeof (point as any).lng === 'number'
        ? (point as any).lng
        : null;

    const timestampValue = (point as any).timestamp ?? (point as any).time ?? (point as any).recorded_at;
    const timestamp = timestampValue ? new Date(timestampValue) : null;

    if (
      latitude === null ||
      longitude === null ||
      !(timestamp instanceof Date) ||
      Number.isNaN(timestamp.valueOf())
    ) {
      continue;
    }

    const speed = typeof (point as any).speed === 'number'
      ? (point as any).speed
      : typeof (point as any).sog === 'number'
        ? (point as any).sog
        : 0;

    const heading = typeof (point as any).heading === 'number'
      ? (point as any).heading
      : typeof (point as any).cog === 'number'
        ? (point as any).cog
        : 0;

    const accuracy = typeof (point as any).accuracy === 'number'
      ? (point as any).accuracy
      : undefined;

    parsed.push({
      latitude,
      longitude,
      timestamp,
      speed,
      heading,
      accuracy,
    });
  }

  return parsed.length > 0 ? parsed : null;
}

// =============================================================================
// SPLIT TIMES PARSING
// =============================================================================

/**
 * Parse split times data for race debrief
 */
export function parseSplitTimes(rawSplits: unknown): DebriefSplitTime[] | null {
  if (!Array.isArray(rawSplits)) {
    return null;
  }

  const parsed: DebriefSplitTime[] = [];

  for (const split of rawSplits) {
    if (typeof split !== 'object' || split === null) {
      continue;
    }

    const markId = typeof (split as any).markId === 'string'
      ? (split as any).markId
      : typeof (split as any).mark_id === 'string'
        ? (split as any).mark_id
        : null;

    const markName = typeof (split as any).markName === 'string'
      ? (split as any).markName
      : typeof (split as any).mark_name === 'string'
        ? (split as any).mark_name
        : null;

    const timestampValue = (split as any).time ?? (split as any).timestamp ?? (split as any).recorded_at;
    const time = timestampValue ? new Date(timestampValue) : null;

    const position = typeof (split as any).position === 'number'
      ? (split as any).position
      : typeof (split as any).fleet_position === 'number'
        ? (split as any).fleet_position
        : null;

    const roundingRaw = (split as any).roundingType ?? (split as any).rounding_type ?? (split as any).rounding;
    const roundingType = roundingRaw === 'starboard' || roundingRaw === 'port'
      ? roundingRaw
      : roundingRaw === 'stbd'
        ? 'starboard'
        : roundingRaw === 'prt'
          ? 'port'
          : 'port';

    const roundingTime = typeof (split as any).roundingTime === 'number'
      ? (split as any).roundingTime
      : typeof (split as any).rounding_time === 'number'
        ? (split as any).rounding_time
        : 0;

    if (
      !markId ||
      !markName ||
      !(time instanceof Date) ||
      Number.isNaN(time.valueOf()) ||
      typeof position !== 'number'
    ) {
      continue;
    }

    parsed.push({
      markId,
      markName,
      time,
      position,
      roundingType: roundingType as DebriefSplitTime['roundingType'],
      roundingTime,
    });
  }

  return parsed.length > 0 ? parsed : null;
}

// =============================================================================
// RACE TYPE DETECTION
// =============================================================================

/**
 * Detect race type based on name patterns, explicit type, or distance
 * Supports fleet, distance, match, and team racing types
 */
export function detectRaceType(
  raceName: string | undefined,
  explicitType: 'fleet' | 'distance' | 'match' | 'team' | undefined,
  totalDistanceNm: number | undefined
): 'fleet' | 'distance' | 'match' | 'team' {
  // 1. Explicit type takes priority (including match and team)
  if (explicitType) {
    return explicitType;
  }

  // 2. Check distance threshold
  if (totalDistanceNm && totalDistanceNm > 10) {
    return 'distance';
  }

  // 3. Smart name detection for distance races
  if (raceName) {
    const lowerName = raceName.toLowerCase();
    const distanceKeywords = [
      'around',
      'island race',
      'offshore',
      'ocean race',
      'ocean racing',
      'coastal',
      'passage',
      'distance race',
      'long distance',
      'overnight',
      'multi-day',
      'transat',
      'transpac',
      'fastnet',
      'rolex',
      'sydney hobart',
      'bermuda',
      'nm race',
      'mile race',
      // Hong Kong specific distance races
      'four peaks',
      'around the island',
      'port shelter',
      'passage race',
    ];

    // Check for distance keywords
    for (const keyword of distanceKeywords) {
      if (lowerName.includes(keyword)) {
        return 'distance';
      }
    }

    // Check for distance patterns like "25nm", "50 mile", "100 nautical"
    if (/\d+\s*(nm|nautical|mile)/i.test(raceName)) {
      return 'distance';
    }
  }

  // Default to fleet racing
  return 'fleet';
}

// =============================================================================
// COURSE MARK TYPE NORMALIZATION
// =============================================================================

/**
 * Normalize course mark type to a consistent format
 * Maps various mark type names to canonical values
 */
export function normalizeCourseMarkType(type?: string | null): string {
  if (!type) return 'custom';

  switch (type) {
    case 'start_pin':
    case 'pin':
      return 'pin';
    case 'start_boat':
    case 'committee':
    case 'committee_boat':
      return 'committee_boat';
    case 'gate_port':
    case 'gate_left':
      return 'gate_left';
    case 'gate_starboard':
    case 'gate_right':
      return 'gate_right';
    case 'windward_mark':
      return 'windward';
    case 'leeward_mark':
      return 'leeward';
    default:
      return type;
  }
}
