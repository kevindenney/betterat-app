/**
 * courseAuthoring — pure helpers for the venue race-course authoring flow.
 *
 * The stored shape is CourseGeometryParams (committee + pin endpoints, wind
 * axis, scalars). Authoring captures a single tapped *center* plus a wind
 * direction and a start-line length, from which we derive the two start-
 * line endpoints. Everything else (windward/leeward marks, laylines, start
 * box) is derived downstream by deriveCourseOverlay — see venueCourseGeoJSON.
 */

import { calculateDistanceNm, destinationPoint } from '@/services/CoursePositioningService';
import type { CourseGeometryParams, CourseType } from '@/types/courses';

const M_PER_NM = 1852;

export const DEFAULT_START_LINE_LENGTH_M = 150;
export const DEFAULT_LEG_LENGTH_NM = 0.5;
export const DEFAULT_TACK_ANGLE_DEG = 42;
export const DEFAULT_BOAT_LENGTH_M = 8.9; // Dragon LOA
export const DEFAULT_START_BOX_DEPTH_BOAT_LENGTHS = 5;

export interface BuildCourseParamsInput {
  /**
   * Course center — the point the course should be centered on (the racing
   * area's centroid, or where the user tapped). The start line is derived
   * half a beat downwind of this so the windward leg straddles `center`
   * rather than hanging upwind of it.
   */
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
 * Derive CourseGeometryParams from a course center + wind + line length.
 *
 * `center` is the point the course is centered on. The beat (start line →
 * windward mark) is the course's dominant extent, so we place the start
 * line half a beat DOWNWIND of `center` — the windward mark then lands half
 * a beat upwind, leaving the leg straddling `center`. Without this the start
 * line sits on `center` and the whole course hangs upwind, reading as
 * off-center inside a racing-area polygon.
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
  // Step half a beat downwind (windDirectionDeg + 180) so the windward leg
  // is centered on `center`.
  const startLineCenter = destinationPoint(
    center.lat,
    center.lng,
    (windDirectionDeg + 180) % 360,
    legLengthNm / 2,
  );
  const committee = destinationPoint(startLineCenter.lat, startLineCenter.lng, windDirectionDeg + 90, halfLineNm);
  const pin = destinationPoint(startLineCenter.lat, startLineCenter.lng, windDirectionDeg - 90, halfLineNm);

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

/**
 * Re-orient a stored course to a live wind observation, keeping its center
 * and scale fixed.
 *
 * The persisted endpoints (pin/committee) bake in the wind the course was
 * authored with, so a course drawn at 180° still draws windward-due-south
 * even after the breeze veers. On the water the RC sets the course to the
 * actual wind, so the authored `windDirectionDeg` is really a fallback — the
 * displayed axis should track the current observation.
 *
 * We recover the geometric center (step the start-line midpoint half a beat
 * UPwind along the stored axis — the inverse of the half-beat-downwind step
 * buildCourseParams applies) and the start-line length (pin↔committee
 * distance), then rebuild around the live wind. All scalars carry through.
 */
export function reorientCourseToWind(
  params: CourseGeometryParams,
  liveWindDirectionDeg: number,
): CourseGeometryParams {
  const startMid = {
    lat: (params.pin.lat + params.committee.lat) / 2,
    lng: (params.pin.lng + params.committee.lng) / 2,
  };
  // Undo the half-beat-downwind step to land back on the course center.
  const center = destinationPoint(
    startMid.lat,
    startMid.lng,
    params.windDirectionDeg,
    params.legLengthNm / 2,
  );
  const startLineLengthM =
    calculateDistanceNm(params.pin.lat, params.pin.lng, params.committee.lat, params.committee.lng) *
    M_PER_NM;

  return buildCourseParams({
    center: { lat: center.lat, lng: center.lng },
    windDirectionDeg: liveWindDirectionDeg,
    startLineLengthM,
    legLengthNm: params.legLengthNm,
    tackAngleDeg: params.tackAngleDeg,
    boatLengthM: params.boatLengthM,
    startBoxDepthBoatLengths: params.startBoxDepthBoatLengths,
    courseType: params.courseType,
  });
}
