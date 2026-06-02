/**
 * courseAuthoring — pure helpers for the venue race-course authoring flow.
 *
 * The stored shape is CourseGeometryParams (committee + pin endpoints, wind
 * axis, scalars). Authoring captures a single tapped *center* plus a wind
 * direction and a start-line length, from which we derive the two start-
 * line endpoints. Everything else (windward/leeward marks, laylines, start
 * box) is derived downstream by deriveCourseOverlay — see venueCourseGeoJSON.
 */

import { destinationPoint } from '@/services/CoursePositioningService';
import type { CourseGeometryParams, CourseType } from '@/types/courses';

const M_PER_NM = 1852;

export const DEFAULT_START_LINE_LENGTH_M = 150;
export const DEFAULT_LEG_LENGTH_NM = 0.5;
export const DEFAULT_TACK_ANGLE_DEG = 42;
export const DEFAULT_BOAT_LENGTH_M = 8.9; // Dragon LOA
export const DEFAULT_START_BOX_DEPTH_BOAT_LENGTHS = 5;

export interface BuildCourseParamsInput {
  /** Start-line center — where the user tapped/long-pressed on the water. */
  center: { lat: number; lng: number };
  /** Direction the wind blows FROM (0=N, 90=E) — the course axis. */
  windDirectionDeg: number;
  /** Total pin ↔ committee start-line length, meters. */
  startLineLengthM: number;
  legLengthNm: number;
  tackAngleDeg: number;
  boatLengthM: number;
  startBoxDepthBoatLengths: number;
  courseType?: CourseType;
}

/**
 * Derive CourseGeometryParams from a tapped center + wind + line length.
 *
 * The start line is perpendicular to the wind axis. Facing upwind (toward
 * the wind source at windDirectionDeg), the committee boat sits at the
 * starboard / right-hand end and the pin at the port / left end.
 *
 * HANDEDNESS CAVEAT: the committee/pin side assignment is parametric about
 * the wind axis and must be verified against a known course in the sim —
 * see ATLAS_RACE_COURSE_GEOMETRY_SPEC §4.2 + feedback_sailing_conventions.
 */
export function buildCourseParams(input: BuildCourseParamsInput): CourseGeometryParams {
  const {
    center,
    windDirectionDeg,
    startLineLengthM,
    legLengthNm,
    tackAngleDeg,
    boatLengthM,
    startBoxDepthBoatLengths,
    courseType = 'windward_leeward',
  } = input;

  const halfLineNm = startLineLengthM / 2 / M_PER_NM;
  const committee = destinationPoint(center.lat, center.lng, windDirectionDeg + 90, halfLineNm);
  const pin = destinationPoint(center.lat, center.lng, windDirectionDeg - 90, halfLineNm);

  return {
    committee: { lat: committee.lat, lng: committee.lng },
    pin: { lat: pin.lat, lng: pin.lng },
    windDirectionDeg,
    legLengthNm,
    tackAngleDeg,
    boatLengthM,
    startBoxDepthBoatLengths,
    courseType,
  };
}
