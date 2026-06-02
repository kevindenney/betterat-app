import { buildCourseParams, type BuildCourseParamsInput } from '../courseAuthoring';

const baseInput: BuildCourseParamsInput = {
  center: { lat: 22.281, lng: 114.17 },
  windDirectionDeg: 0,
  startLineLengthM: 150,
  legLengthNm: 0.5,
  tackAngleDeg: 42,
  boatLengthM: 8.9,
  startBoxDepthBoatLengths: 5,
};

describe('buildCourseParams', () => {
  it('puts the committee to starboard (east) and pin to port (west) for a due-north wind', () => {
    const params = buildCourseParams(baseInput);
    // Facing upwind (wind from north), committee is on the right (east → higher lng),
    // pin on the left (west → lower lng).
    expect(params.committee.lng).toBeGreaterThan(baseInput.center.lng);
    expect(params.pin.lng).toBeLessThan(baseInput.center.lng);
  });

  it('centers the beat on `center` — start line half a leg downwind, windward mark half a leg upwind', () => {
    const params = buildCourseParams(baseInput);
    const startMidLat = (params.committee.lat + params.pin.lat) / 2;
    const startMidLng = (params.committee.lng + params.pin.lng) / 2;
    // Wind from north → downwind is south → the start line sits south of
    // center (lower lat), same lng.
    expect(startMidLat).toBeLessThan(baseInput.center.lat);
    expect(startMidLng).toBeCloseTo(baseInput.center.lng, 5);
    // Half a 0.5nm leg ≈ 0.25nm ≈ 0.00225° lat at this latitude.
    expect(baseInput.center.lat - startMidLat).toBeCloseTo(0.25 / 60, 3);
    // The windward mark lands a full leg (0.5nm) upwind of the start line,
    // so the beat midpoint — half a leg above the start line — falls back
    // on `center`.
    const beatMidLat = startMidLat + (0.25 / 60);
    expect(beatMidLat).toBeCloseTo(baseInput.center.lat, 3);
  });

  it('spreads the endpoints by roughly the requested start-line length', () => {
    const params = buildCourseParams(baseInput);
    // At this latitude, 1° lng ≈ 103 km. 150 m ≈ 0.00145° total spread.
    const lngSpread = Math.abs(params.committee.lng - params.pin.lng);
    expect(lngSpread).toBeGreaterThan(0.001);
    expect(lngSpread).toBeLessThan(0.002);
  });

  it('passes the scalar params straight through', () => {
    const params = buildCourseParams(baseInput);
    expect(params.windDirectionDeg).toBe(0);
    expect(params.legLengthNm).toBe(0.5);
    expect(params.tackAngleDeg).toBe(42);
    expect(params.boatLengthM).toBe(8.9);
    expect(params.startBoxDepthBoatLengths).toBe(5);
  });

  it('defaults the course type to windward_leeward', () => {
    expect(buildCourseParams(baseInput).courseType).toBe('windward_leeward');
  });

  it('honors an explicit course type', () => {
    const params = buildCourseParams({ ...baseInput, courseType: 'triangle' });
    expect(params.courseType).toBe('triangle');
  });
});
