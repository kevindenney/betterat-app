/**
 * courseGeometry — pure derivation of a race course's tactical overlay from a
 * positioned course (marks + start line + wind/current). Extracted from
 * components/races/NativeCourseOverlayMap so the same geometry can render on the
 * Atlas canvas. No React, no MapLibre — just lat/lng math, so it's unit-testable.
 *
 * Produces: windward/leeward anchors, the beat corridor (port/starboard layline
 * polygons), thirds dividers, favored-side shading, and — when a start line is
 * present — the starting box and the start-line laylines intersected up to the
 * windward-mark laylines.
 *
 * Parameterized where the original hardcoded constants:
 *   • tackAngleDeg — close-hauled half-angle off the wind. Legacy default 45°.
 *   • start-box depth — legacy 0.15 × leg; pass boatLengthM +
 *     startBoxDepthBoatLengths to drive it off boat lengths instead.
 * Defaults preserve the original race-detail rendering exactly.
 */

import type { PositionedMark, StartLinePosition } from '@/types/courses';

export type Coord = { latitude: number; longitude: number };

/** Legacy close-hauled angle. Real boats point ~42°; kept at 45 so the existing
 *  race-detail overlay is pixel-identical until a caller opts in. */
export const DEFAULT_TACK_ANGLE_DEG = 45;

/** Legacy start-box depth as a fraction of the windward leg, used when boat-length
 *  depth isn't supplied. */
export const FALLBACK_BOX_DEPTH_LEG_FRACTION = 0.15;

// ── geometry helpers ────────────────────────────────────────────────────────

export function offsetCoordinate(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
): Coord {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const d = distanceM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function lerpCoord(a: Coord, b: Coord, t: number): Coord {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

export function flatBearing(from: Coord, to: Coord): number {
  const toRad = Math.PI / 180;
  const dlng = (to.longitude - from.longitude) * Math.cos(from.latitude * toRad);
  const dlat = to.latitude - from.latitude;
  return ((Math.atan2(dlng, dlat) * 180) / Math.PI + 360) % 360;
}

export function rayIntersection(p1: Coord, b1: number, p2: Coord, b2: number): Coord | null {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(p1.latitude * toRad);
  const dx1 = Math.sin(b1 * toRad);
  const dy1 = Math.cos(b1 * toRad);
  const dx2 = Math.sin(b2 * toRad);
  const dy2 = Math.cos(b2 * toRad);
  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-10) return null;
  const ex = (p2.longitude - p1.longitude) * cosLat;
  const ey = p2.latitude - p1.latitude;
  const t1 = (ex * dy2 - ey * dx2) / det;
  if (t1 < 0) return null;
  return {
    latitude: p1.latitude + t1 * dy1,
    longitude: p1.longitude + (t1 * dx1) / cosLat,
  };
}

/** Start-box depth in meters: boat-length-driven when supplied, else legacy
 *  fraction of the windward leg. */
export function startBoxDepthMeters(
  legDistanceM: number,
  startBoxDepthBoatLengths?: number,
  boatLengthM?: number,
): number {
  if (
    startBoxDepthBoatLengths != null &&
    startBoxDepthBoatLengths > 0 &&
    boatLengthM != null &&
    boatLengthM > 0
  ) {
    return startBoxDepthBoatLengths * boatLengthM;
  }
  return legDistanceM * FALLBACK_BOX_DEPTH_LEG_FRACTION;
}

// ── overlay derivation ──────────────────────────────────────────────────────

export interface CourseOverlayInput {
  marks: PositionedMark[];
  startLine: StartLinePosition | null;
  /** Direction the wind blows FROM, degrees (0 = N). */
  windDirection: number;
  currentDirection?: number;
  currentSpeed?: number;
  /** Close-hauled half-angle off the wind. Default 45 (legacy). ~42 is realistic. */
  tackAngleDeg?: number;
  /** Start-box depth in boat lengths (needs boatLengthM). Default falls back to 0.15×leg. */
  startBoxDepthBoatLengths?: number;
  boatLengthM?: number;
}

export interface CourseOverlayGeometry {
  W: Coord;
  L: Coord;
  M: Coord;
  P: Coord;
  C: Coord;
  startMid: Coord;
  portCorner: Coord;
  stbdCorner: Coord;
  leftPoly: Coord[];
  rightPoly: Coord[];
  thirdDividers: Coord[][];
  thirdLabels: { bottom: Coord; middle: Coord; upper: Coord };
  favoredSide: 'left' | 'right' | null;
  leftLabel: Coord;
  rightLabel: Coord;
  laylineLabels: { port: Coord; stbd: Coord };
  startBox: { outline: Coord[]; dividers: Coord[][] } | null;
  startLabels: { pinEnd: Coord; middle: Coord; boatEnd: Coord } | null;
}

/**
 * Derive the full tactical overlay for a positioned course. Returns null when
 * there's no windward mark / no way to infer a leeward anchor.
 */
export function deriveCourseOverlay(input: CourseOverlayInput): CourseOverlayGeometry | null {
  const {
    marks,
    startLine,
    windDirection,
    currentDirection,
    currentSpeed,
    tackAngleDeg = DEFAULT_TACK_ANGLE_DEG,
    startBoxDepthBoatLengths,
    boatLengthM,
  } = input;

  if (marks.length === 0) return null;
  const windwardMark = marks.find((m) => m.type === 'windward');
  const leewardMark = marks.find((m) => m.type === 'leeward');
  const gateMarks = marks.filter((m) => m.type === 'gate');
  const leewardPos = leewardMark
    ? { latitude: leewardMark.latitude, longitude: leewardMark.longitude }
    : gateMarks.length >= 2
      ? {
          latitude: (gateMarks[0].latitude + gateMarks[1].latitude) / 2,
          longitude: (gateMarks[0].longitude + gateMarks[1].longitude) / 2,
        }
      : gateMarks.length === 1
        ? { latitude: gateMarks[0].latitude, longitude: gateMarks[0].longitude }
        : startLine
          ? {
              latitude: (startLine.pin.lat + startLine.committee.lat) / 2,
              longitude: (startLine.pin.lng + startLine.committee.lng) / 2,
            }
          : null;
  if (!windwardMark || !leewardPos) return null;

  const W: Coord = { latitude: windwardMark.latitude, longitude: windwardMark.longitude };
  const L: Coord = leewardPos;
  const M = lerpCoord(L, W, 0.5);

  const legDistanceM = haversineDistance(W.latitude, W.longitude, L.latitude, L.longitude);
  const halfWidth = (legDistanceM / 2) * Math.tan((tackAngleDeg * Math.PI) / 180);

  const rightBearing = (windDirection + 90) % 360;
  const leftBearing = (windDirection - 90 + 360) % 360;
  const downwindBearing = (windDirection + 180) % 360;

  let portCorner = offsetCoordinate(M.latitude, M.longitude, rightBearing, halfWidth);
  let stbdCorner = offsetCoordinate(M.latitude, M.longitude, leftBearing, halfWidth);

  const oneThird = lerpCoord(L, W, 1 / 3);
  const twoThirds = lerpCoord(L, W, 2 / 3);
  const oneThirdHW = halfWidth * (2 / 3);
  const twoThirdsHW = halfWidth * (2 / 3);
  const oneThirdLeft = offsetCoordinate(oneThird.latitude, oneThird.longitude, leftBearing, oneThirdHW);
  const oneThirdRight = offsetCoordinate(oneThird.latitude, oneThird.longitude, rightBearing, oneThirdHW);
  const twoThirdsLeft = offsetCoordinate(twoThirds.latitude, twoThirds.longitude, leftBearing, twoThirdsHW);
  const twoThirdsRight = offsetCoordinate(twoThirds.latitude, twoThirds.longitude, rightBearing, twoThirdsHW);

  const bottomThirdLabel = lerpCoord(L, W, 1 / 6);
  const middleThirdLabel = lerpCoord(L, W, 1 / 2);
  const upperThirdLabel = lerpCoord(L, W, 5 / 6);

  const hasCurrent = currentDirection !== undefined && currentSpeed !== undefined && currentSpeed > 0.05;
  let favoredSide: 'left' | 'right' | null = null;
  if (hasCurrent) {
    const rel = (((currentDirection! - windDirection) % 360) + 360) % 360;
    favoredSide = rel > 0 && rel < 180 ? 'left' : 'right';
  }

  const sideOffset = halfWidth * 0.5;
  const leftLabel = offsetCoordinate(M.latitude, M.longitude, leftBearing, sideOffset);
  const rightLabel = offsetCoordinate(M.latitude, M.longitude, rightBearing, sideOffset);

  let portLLLabel = lerpCoord(W, portCorner, 0.5);
  let stbdLLLabel = lerpCoord(W, stbdCorner, 0.5);

  let P: Coord = L;
  let C: Coord = L;
  let startMid: Coord = L;
  let startBox: { outline: Coord[]; dividers: Coord[][] } | null = null;
  let startLabels: { pinEnd: Coord; middle: Coord; boatEnd: Coord } | null = null;

  if (startLine) {
    P = { latitude: startLine.pin.lat, longitude: startLine.pin.lng };
    C = { latitude: startLine.committee.lat, longitude: startLine.committee.lng };
    startMid = lerpCoord(P, C, 0.5);

    const boxDepth = startBoxDepthMeters(legDistanceM, startBoxDepthBoatLengths, boatLengthM);
    const dLat = C.latitude - P.latitude;
    const dLng = (C.longitude - P.longitude) * Math.cos((P.latitude * Math.PI) / 180);
    const lineBearingPtoC = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;

    const candidateA = (lineBearingPtoC - tackAngleDeg + 360) % 360;
    const candidateB = (lineBearingPtoC + tackAngleDeg) % 360;
    const diffA = Math.abs((((candidateA - downwindBearing + 540) % 360) - 180));
    const diffB = Math.abs((((candidateB - downwindBearing + 540) % 360) - 180));
    const shortSideBearing = diffA < diffB ? candidateA : candidateB;

    const pinDown = offsetCoordinate(P.latitude, P.longitude, shortSideBearing, boxDepth);
    const committeeDown = offsetCoordinate(C.latitude, C.longitude, shortSideBearing, boxDepth);
    const startOneThird = lerpCoord(P, C, 1 / 3);
    const startTwoThirds = lerpCoord(P, C, 2 / 3);
    const oneThirdDown = offsetCoordinate(startOneThird.latitude, startOneThird.longitude, shortSideBearing, boxDepth);
    const twoThirdsDown = offsetCoordinate(startTwoThirds.latitude, startTwoThirds.longitude, shortSideBearing, boxDepth);

    const labelDownOffset = boxDepth * 0.5;
    const pinEndLabel = offsetCoordinate(
      lerpCoord(P, startOneThird, 0.5).latitude,
      lerpCoord(P, startOneThird, 0.5).longitude,
      shortSideBearing,
      labelDownOffset,
    );
    const startMidLabel = offsetCoordinate(startMid.latitude, startMid.longitude, shortSideBearing, labelDownOffset);
    const boatEndLabel = offsetCoordinate(
      lerpCoord(startTwoThirds, C, 0.5).latitude,
      lerpCoord(startTwoThirds, C, 0.5).longitude,
      shortSideBearing,
      labelDownOffset,
    );

    startBox = {
      outline: [P, C, committeeDown, pinDown],
      dividers: [
        [startOneThird, oneThirdDown],
        [startTwoThirds, twoThirdsDown],
      ],
    };
    startLabels = { pinEnd: pinEndLabel, middle: startMidLabel, boatEnd: boatEndLabel };

    const laylineBearingFromP = (windDirection - tackAngleDeg + 360) % 360;
    const laylineBearingFromC = (windDirection + tackAngleDeg) % 360;
    const bearingWtoPort = flatBearing(W, portCorner);
    const bearingWtoStbd = flatBearing(W, stbdCorner);

    const newStbd = rayIntersection(P, laylineBearingFromP, W, bearingWtoStbd);
    const newPort = rayIntersection(C, laylineBearingFromC, W, bearingWtoPort);

    if (newStbd) stbdCorner = newStbd;
    if (newPort) portCorner = newPort;

    portLLLabel = lerpCoord(W, portCorner, 0.5);
    stbdLLLabel = lerpCoord(W, stbdCorner, 0.5);
  }

  return {
    W,
    L,
    M,
    P,
    C,
    startMid,
    portCorner,
    stbdCorner,
    leftPoly: [W, stbdCorner, P, startMid],
    rightPoly: [W, portCorner, C, startMid],
    thirdDividers: [
      [oneThirdLeft, oneThirdRight],
      [twoThirdsLeft, twoThirdsRight],
    ],
    thirdLabels: { bottom: bottomThirdLabel, middle: middleThirdLabel, upper: upperThirdLabel },
    favoredSide,
    leftLabel,
    rightLabel,
    laylineLabels: { port: portLLLabel, stbd: stbdLLLabel },
    startBox,
    startLabels,
  };
}
