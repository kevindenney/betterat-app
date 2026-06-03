/**
 * courseStrategy — deterministic tactical advice for a windward-leeward beat,
 * keyed to the same thirds + left/right sections the course overlay draws
 * (see lib/courseGeometry). Pure lat/lng-free math so it's unit-testable.
 *
 * The race committee sets the start line square to the wind, so neither end
 * is *wind*-favored — the start, and which side of the course pays, come down
 * to the CURRENT. We resolve a single up-current side and reference it from
 * every recommendation.
 *
 * CONVENTIONS (must stay consistent with courseGeometry + the app's overlays):
 *  • windDirection — direction the wind blows FROM (0 = N).
 *  • currentDirection — SET: the direction the current flows TO (matches the
 *    tide/wave overlays' "set" convention).
 *  • "Looking upwind" (facing the windward mark / wind source): the RIGHT side
 *    is at bearing wind+90, the LEFT side at wind−90.
 *  • Start line: committee boat sits at the wind+90 (right) end, pin at the
 *    wind−90 (left) end — so the left side ↔ pin, right side ↔ committee.
 *
 * CORE HEURISTIC — "stay up-current": favor the side of the course the current
 * is flowing FROM, so you bank the set and ride it down to the mark. A current
 * flowing toward the right therefore favors the LEFT (up-current) side — which
 * matches deriveCourseOverlay's favoredSide. The cross-current magnitude must
 * clear a threshold or the side reads 'even' (play the breeze instead).
 *
 * HANDEDNESS CAVEAT: the up-current side ↔ committee/pin mapping is parametric
 * about the wind axis and inherits courseGeometry's unverified handedness — it
 * must be checked against a known course in the sim before being trusted.
 */

export type CourseSide = 'left' | 'right' | 'even';
export type StartEnd = 'pin' | 'committee' | 'even';
export type WindBand = 'light' | 'medium' | 'heavy' | 'unknown';
export type ThirdId = 'bottom' | 'middle' | 'upper';

export interface CourseStrategyInput {
  /** Direction the wind blows FROM, degrees (0 = N). */
  windDirection: number;
  /** Wind speed, knots. Undefined → band 'unknown', no breeze modulation. */
  windSpeedKn?: number;
  /** Current SET — direction the current flows TO, degrees. */
  currentDirection?: number;
  /** Current drift, knots. */
  currentSpeedKn?: number;
  /**
   * Optional coastal context: the side of the beat (looking upwind) that land
   * is on. Drives a shore-bend / current-relief note. Omit when offshore.
   */
  shoreSide?: 'left' | 'right';
}

export interface ThirdNote {
  third: ThirdId;
  text: string;
}

export interface LegStrategy {
  favoredSide: CourseSide;
  summary: string;
  /** Ordered bottom → upper so callers can pair with thirdLabels directly. */
  thirds: ThirdNote[];
}

export interface StartStrategy {
  favoredEnd: StartEnd;
  text: string;
}

export interface CourseStrategy {
  start: StartStrategy;
  upwind: LegStrategy;
  downwind: LegStrategy;
  conditions: {
    windDirection: number;
    windSpeedKn: number | null;
    currentDirection: number | null;
    currentSpeedKn: number | null;
    band: WindBand;
    /** Signed cross-course current, knots. + = toward the RIGHT (wind+90). */
    crossCurrentKn: number;
    /** Signed along-course current, knots. + = toward windward (up the beat). */
    alongCurrentKn: number;
  };
}

/** Below this drift (kn) there is effectively no current to play. */
const CURRENT_MIN_KN = 0.1;
/** Cross-course current must clear this (kn) before a side is favored. */
const SIDE_MIN_KN = 0.1;

const toRad = (d: number) => (d * Math.PI) / 180;

/** Smallest signed angle a − b, wrapped to [-180, 180]. */
function angleDiffDeg(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function windBand(windSpeedKn?: number): WindBand {
  if (windSpeedKn == null || !Number.isFinite(windSpeedKn)) return 'unknown';
  if (windSpeedKn < 8) return 'light';
  if (windSpeedKn <= 16) return 'medium';
  return 'heavy';
}

const SIDE_WORD: Record<Exclude<CourseSide, 'even'>, string> = {
  left: 'LEFT',
  right: 'RIGHT',
};
const END_WORD: Record<Exclude<StartEnd, 'even'>, string> = {
  pin: 'pin',
  committee: 'committee-boat',
};

/**
 * Resolve the full course strategy. Deterministic — same inputs, same text.
 */
export function deriveCourseStrategy(input: CourseStrategyInput): CourseStrategy {
  const { windDirection, windSpeedKn, currentDirection, currentSpeedKn, shoreSide } = input;
  const band = windBand(windSpeedKn);

  const hasCurrent =
    currentDirection != null &&
    currentSpeedKn != null &&
    Number.isFinite(currentDirection) &&
    Number.isFinite(currentSpeedKn) &&
    currentSpeedKn > CURRENT_MIN_KN;

  const rightBearing = (windDirection + 90) % 360;
  // + cross = current flowing toward the right; + along = toward windward.
  const crossCurrentKn = hasCurrent
    ? currentSpeedKn! * Math.cos(toRad(angleDiffDeg(currentDirection!, rightBearing)))
    : 0;
  const alongCurrentKn = hasCurrent
    ? currentSpeedKn! * Math.cos(toRad(angleDiffDeg(currentDirection!, windDirection)))
    : 0;

  // Stay up-current: current toward the right → favor the LEFT side.
  const favoredSide: CourseSide =
    crossCurrentKn > SIDE_MIN_KN ? 'left' : crossCurrentKn < -SIDE_MIN_KN ? 'right' : 'even';
  const favoredEnd: StartEnd =
    favoredSide === 'left' ? 'pin' : favoredSide === 'right' ? 'committee' : 'even';

  return {
    start: buildStart(favoredEnd, band, alongCurrentKn),
    upwind: buildUpwind(favoredSide, band, shoreSide),
    downwind: buildDownwind(favoredSide, band),
    conditions: {
      windDirection,
      windSpeedKn: windSpeedKn ?? null,
      currentDirection: currentDirection ?? null,
      currentSpeedKn: currentSpeedKn ?? null,
      band,
      crossCurrentKn,
      alongCurrentKn,
    },
  };
}

function buildStart(end: StartEnd, band: WindBand, alongCurrentKn: number): StartStrategy {
  if (end === 'even') {
    return {
      favoredEnd: 'even',
      text:
        'Line is square to the wind and no current bias — start where you have clear air and lane room. Pick the end that sets you up for the favored first-beat side.',
    };
  }
  const word = END_WORD[end];
  const other = end === 'pin' ? END_WORD.committee : END_WORD.pin;
  const flood =
    alongCurrentKn < -0.1
      ? ' Current is pushing the fleet down off the line, so hold height and time your final approach late.'
      : alongCurrentKn > 0.1
        ? ' Current is setting you up toward the line, so guard against being over early.'
        : '';
  const breeze = band === 'light' ? ' In this light air the current effect is large — protect the favored end aggressively.' : '';
  return {
    favoredEnd: end,
    text: `${capitalize(word)} end favored — it's up-current, so the fleet sags toward the ${other} end. Start here for a clear lane and the current working you toward the mark.${flood}${breeze}`,
  };
}

function buildUpwind(side: CourseSide, band: WindBand, shoreSide?: 'left' | 'right'): LegStrategy {
  const shore = shoreSide
    ? ` Watch the ${SIDE_WORD[shoreSide]} shore for bend in the breeze and current relief close in.`
    : '';

  if (side === 'even') {
    return {
      favoredSide: 'even',
      summary: `No dominant side from current — play the shifts. Tack on headers, keep the fleet between you and the mark, and stay flexible.${shore}`,
      thirds: [
        { third: 'bottom', text: 'Off the line: win clear air and take the first shift; commit to a side only once the breeze shows its hand.' },
        { third: 'middle', text: 'Consolidate gains. In oscillating breeze tack on the headers; keep both sides of the course open.' },
        { third: 'upper', text: 'Layline discipline: approach on the long tack and avoid overstanding the windward mark.' },
      ],
    };
  }

  const word = SIDE_WORD[side];
  const breeze =
    band === 'light'
      ? ` Current dominates in this breeze — commit hard to the ${word} early.`
      : band === 'heavy'
        ? ` In this much breeze current matters less — lean ${word} but never bury a shift for it.`
        : '';
  return {
    favoredSide: side,
    summary: `Favor the ${word} (up-current) side — bank the set early and ride the current down to the windward mark.${breeze}${shore}`,
    thirds: [
      { third: 'bottom', text: `Off the line: work toward the ${word} side to get up-current early and into clear air.` },
      { third: 'middle', text: `Stay committed to the ${word} but consolidate — keep between the fleet and the mark, tack on headers.` },
      { third: 'upper', text: `Layline: come in from the ${word}; allow for the current set at the mark so you don't get swept below the layline.` },
    ],
  };
}

function buildDownwind(side: CourseSide, band: WindBand): LegStrategy {
  // The up-current side stays the same geographic side downwind; pressure can
  // override it. Thirds run from the windward rounding (upper) down to the
  // leeward gate (bottom), but stay ordered bottom→upper for label pairing.
  if (side === 'even') {
    return {
      favoredSide: 'even',
      summary: 'No current bias — hunt pressure and gybe on the downwind shifts. Take the lane with more breeze.',
      thirds: [
        { third: 'bottom', text: 'Leeward approach: come in wide, exit tight, and look for the inside overlap at the gate.' },
        { third: 'middle', text: 'Gybe on pressure and the downwind headers; protect the inside lane into the next mark.' },
        { third: 'upper', text: 'After the rounding: set, get to pressure, and clear your air before committing to a side.' },
      ],
    };
  }
  const word = SIDE_WORD[side];
  const breeze = band === 'heavy' ? ' Pressure rules in this breeze — let a clear puff override the current side.' : '';
  return {
    favoredSide: side,
    summary: `Stay up-current on the ${word} side — the same side that paid upwind, with the current still working for you. Pressure can override: take the breeze when it's clearly better.${breeze}`,
    thirds: [
      { third: 'bottom', text: `Leeward approach: set up for the ${word} (up-current) gate; come in wide-then-tight and mind the set.` },
      { third: 'middle', text: `Hold the ${word} side; gybe on pressure and the downwind headers while staying up-current.` },
      { third: 'upper', text: `After the rounding: head for the ${word} side and the better current; clear your air off the leaders.` },
    ],
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
