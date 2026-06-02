import type { PositionedMark, StartLinePosition } from '@/types/courses';
import {
  DEFAULT_TACK_ANGLE_DEG,
  FALLBACK_BOX_DEPTH_LEG_FRACTION,
  deriveCourseOverlay,
  haversineDistance,
  startBoxDepthMeters,
  type CourseOverlayInput,
} from '../courseGeometry';

// A simple due-north windward/leeward course off Victoria Harbour-ish water.
// Wind blows FROM the north (0°), so the beat runs L (south) → W (north).
const W_LAT = 22.29;
const L_LAT = 22.28;
const LNG = 114.17;

function mark(type: PositionedMark['type'], latitude: number, longitude: number): PositionedMark {
  return { name: type, type, latitude, longitude, rounding: 'port' };
}

const baseMarks: PositionedMark[] = [
  mark('windward', W_LAT, LNG),
  mark('leeward', L_LAT, LNG),
];

const startLine: StartLinePosition = {
  // Line roughly perpendicular to the wind, just south of (downwind of) the leeward mark.
  pin: { lat: L_LAT - 0.001, lng: LNG - 0.001 },
  committee: { lat: L_LAT - 0.001, lng: LNG + 0.001 },
};

function input(overrides: Partial<CourseOverlayInput> = {}): CourseOverlayInput {
  return { marks: baseMarks, startLine: null, windDirection: 0, ...overrides };
}

describe('startBoxDepthMeters', () => {
  it('falls back to a fraction of the leg when boat-length params are missing', () => {
    expect(startBoxDepthMeters(1000)).toBeCloseTo(1000 * FALLBACK_BOX_DEPTH_LEG_FRACTION);
  });

  it('uses boat-length depth when both params are supplied', () => {
    expect(startBoxDepthMeters(1000, 5, 11)).toBe(55);
  });

  it('falls back when boat-length params are zero or negative', () => {
    expect(startBoxDepthMeters(1000, 0, 11)).toBeCloseTo(150);
    expect(startBoxDepthMeters(1000, 5, 0)).toBeCloseTo(150);
    expect(startBoxDepthMeters(1000, -5, 11)).toBeCloseTo(150);
  });
});

describe('deriveCourseOverlay', () => {
  it('returns null without marks', () => {
    expect(deriveCourseOverlay(input({ marks: [] }))).toBeNull();
  });

  it('returns null without a windward mark', () => {
    expect(deriveCourseOverlay(input({ marks: [mark('leeward', L_LAT, LNG)] }))).toBeNull();
  });

  it('derives windward/leeward anchors and a midpoint between them', () => {
    const o = deriveCourseOverlay(input())!;
    expect(o).not.toBeNull();
    expect(o.W.latitude).toBeCloseTo(W_LAT);
    expect(o.L.latitude).toBeCloseTo(L_LAT);
    expect(o.M.latitude).toBeCloseTo((W_LAT + L_LAT) / 2);
  });

  it('produces no start box when no start line is given', () => {
    const o = deriveCourseOverlay(input())!;
    expect(o.startBox).toBeNull();
    expect(o.startLabels).toBeNull();
  });

  it('produces a 4-corner start box and two dividers when a start line is given', () => {
    const o = deriveCourseOverlay(input({ startLine }))!;
    expect(o.startBox).not.toBeNull();
    expect(o.startBox!.outline).toHaveLength(4);
    expect(o.startBox!.dividers).toHaveLength(2);
    expect(o.startLabels).not.toBeNull();
  });

  it('places the start box downwind (south) of the start line', () => {
    const o = deriveCourseOverlay(input({ startLine }))!;
    const [P, C, committeeDown, pinDown] = o.startBox!.outline;
    // Wind from north → downwind is south → the box's far corners sit at lower latitude.
    expect(pinDown.latitude).toBeLessThan(P.latitude);
    expect(committeeDown.latitude).toBeLessThan(C.latitude);
  });

  it('scales start-box depth with boat lengths when supplied', () => {
    const legM = haversineDistance(W_LAT, LNG, L_LAT, LNG);
    const shallow = deriveCourseOverlay(
      input({ startLine, startBoxDepthBoatLengths: 2, boatLengthM: 10 }),
    )!;
    const deep = deriveCourseOverlay(
      input({ startLine, startBoxDepthBoatLengths: 20, boatLengthM: 10 }),
    )!;
    const depthOf = (o: NonNullable<ReturnType<typeof deriveCourseOverlay>>) =>
      haversineDistance(
        o.startBox!.outline[0].latitude,
        o.startBox!.outline[0].longitude,
        o.startBox!.outline[3].latitude,
        o.startBox!.outline[3].longitude,
      );
    expect(depthOf(shallow)).toBeCloseTo(20, 0); // 2 × 10m
    expect(depthOf(deep)).toBeCloseTo(200, 0); // 20 × 10m
    // Sanity: both differ from the legacy 0.15×leg fallback.
    expect(legM * FALLBACK_BOX_DEPTH_LEG_FRACTION).toBeGreaterThan(depthOf(shallow));
  });

  it('widens the beat corridor as the tack angle increases', () => {
    const narrow = deriveCourseOverlay(input({ tackAngleDeg: 30 }))!;
    const wide = deriveCourseOverlay(input({ tackAngleDeg: 50 }))!;
    const widthOf = (o: NonNullable<ReturnType<typeof deriveCourseOverlay>>) =>
      haversineDistance(
        o.portCorner.latitude,
        o.portCorner.longitude,
        o.stbdCorner.latitude,
        o.stbdCorner.longitude,
      );
    expect(widthOf(wide)).toBeGreaterThan(widthOf(narrow));
  });

  it('defaults the tack angle to the legacy 45°', () => {
    const explicit = deriveCourseOverlay(input({ tackAngleDeg: DEFAULT_TACK_ANGLE_DEG }))!;
    const implicit = deriveCourseOverlay(input())!;
    expect(implicit.portCorner.latitude).toBeCloseTo(explicit.portCorner.latitude);
    expect(implicit.portCorner.longitude).toBeCloseTo(explicit.portCorner.longitude);
  });

  it('marks a favored side only when current is present and meaningful', () => {
    expect(deriveCourseOverlay(input()).favoredSide).toBeNull();
    expect(
      deriveCourseOverlay(input({ currentDirection: 90, currentSpeed: 0 })).favoredSide,
    ).toBeNull();
    expect(
      deriveCourseOverlay(input({ currentDirection: 90, currentSpeed: 1.2 })).favoredSide,
    ).not.toBeNull();
  });

  it('uses the gate midpoint as the leeward anchor when no leeward mark exists', () => {
    const gateMarks: PositionedMark[] = [
      mark('windward', W_LAT, LNG),
      mark('gate', L_LAT, LNG - 0.0005),
      mark('gate', L_LAT, LNG + 0.0005),
    ];
    const o = deriveCourseOverlay(input({ marks: gateMarks }))!;
    expect(o.L.latitude).toBeCloseTo(L_LAT);
    expect(o.L.longitude).toBeCloseTo(LNG);
  });
});
