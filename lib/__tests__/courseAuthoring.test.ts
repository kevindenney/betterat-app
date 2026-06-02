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

  it('keeps the start-line midpoint at the tapped center', () => {
    const params = buildCourseParams(baseInput);
    const midLat = (params.committee.lat + params.pin.lat) / 2;
    const midLng = (params.committee.lng + params.pin.lng) / 2;
    expect(midLat).toBeCloseTo(baseInput.center.lat, 5);
    expect(midLng).toBeCloseTo(baseInput.center.lng, 5);
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
