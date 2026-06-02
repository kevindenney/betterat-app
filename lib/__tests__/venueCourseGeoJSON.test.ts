import type { CourseGeometryParams, VenueRaceCourse } from '@/types/courses';
import {
  courseOverlayToFeatures,
  courseParamsToOverlayInput,
  venueCoursesToFeatureCollection,
} from '../venueCourseGeoJSON';
import { deriveCourseOverlay } from '../courseGeometry';

// Due-north course off Victoria Harbour-ish water. Wind from the north (0°),
// so the windward mark sits north (upwind) of the start line.
const baseParams: CourseGeometryParams = {
  committee: { lat: 22.281, lng: 114.171 },
  pin: { lat: 22.281, lng: 114.169 },
  windDirectionDeg: 0,
  legLengthNm: 0.5,
  tackAngleDeg: 42,
  boatLengthM: 8.9,
  startBoxDepthBoatLengths: 5,
  courseType: 'windward_leeward',
};

function course(overrides: Partial<VenueRaceCourse> = {}): VenueRaceCourse {
  return {
    id: 'course-1',
    racingAreaId: 'area-1',
    venueId: null,
    name: 'Victoria Harbour — W/L',
    courseType: 'windward_leeward',
    geometry: baseParams,
    classesUsed: ['Dragon'],
    isActive: true,
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('courseParamsToOverlayInput', () => {
  it('places the windward mark upwind of the start-line center', () => {
    const input = courseParamsToOverlayInput(baseParams);
    expect(input.marks).toHaveLength(1);
    const w = input.marks[0];
    expect(w.type).toBe('windward');
    // Wind from north → windward mark is north → higher latitude than the line.
    expect(w.latitude).toBeGreaterThan(baseParams.committee.lat);
  });

  it('threads the start line straight through from the params', () => {
    const input = courseParamsToOverlayInput(baseParams);
    expect(input.startLine).toEqual({
      pin: baseParams.pin,
      committee: baseParams.committee,
    });
  });

  it('passes wind axis and box/tack params into the overlay input', () => {
    const input = courseParamsToOverlayInput(baseParams);
    expect(input.windDirection).toBe(0);
    expect(input.tackAngleDeg).toBe(42);
    expect(input.startBoxDepthBoatLengths).toBe(5);
    expect(input.boatLengthM).toBe(8.9);
  });

  it('forwards live current from the environment', () => {
    const input = courseParamsToOverlayInput(baseParams, {
      currentDirection: 90,
      currentSpeed: 1.2,
    });
    expect(input.currentDirection).toBe(90);
    expect(input.currentSpeed).toBe(1.2);
  });
});

describe('courseOverlayToFeatures', () => {
  function featuresFor(params = baseParams, id = 'course-1') {
    const overlay = deriveCourseOverlay(courseParamsToOverlayInput(params))!;
    expect(overlay).not.toBeNull();
    return courseOverlayToFeatures(overlay, params, id);
  }

  it('emits start + finish lines, 4 laylines, a start box and 4 marks', () => {
    const f = featuresFor();
    const byType = (t: string) => f.filter((x) => x.properties?.type === t);
    expect(byType('start-line')).toHaveLength(1);
    expect(byType('finish-line')).toHaveLength(1);
    expect(byType('layline')).toHaveLength(4);
    expect(byType('start-box')).toHaveLength(1);
    expect(byType('course-mark')).toHaveLength(4);
  });

  it('tags laylines with tack + anchor', () => {
    const laylines = featuresFor().filter((x) => x.properties?.type === 'layline');
    const tags = laylines.map((l) => `${l.properties?.anchor}-${l.properties?.tack}`).sort();
    expect(tags).toEqual([
      'start-port',
      'start-starboard',
      'windward-port',
      'windward-starboard',
    ]);
  });

  it('tags marks with their markType', () => {
    const marks = featuresFor().filter((x) => x.properties?.type === 'course-mark');
    const kinds = marks.map((m) => m.properties?.markType).sort();
    expect(kinds).toEqual(['committee', 'finish', 'pin', 'windward']);
  });

  it('namespaces every feature id with the courseId', () => {
    const f = featuresFor(baseParams, 'abc');
    expect(f.every((x) => String(x.id).startsWith('abc:'))).toBe(true);
  });

  it('draws the start line between pin and committee', () => {
    const startLine = featuresFor().find((x) => x.properties?.type === 'start-line')!;
    const coords = (startLine.geometry as { coordinates: number[][] }).coordinates;
    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual([baseParams.pin.lng, baseParams.pin.lat]);
    expect(coords[1]).toEqual([baseParams.committee.lng, baseParams.committee.lat]);
  });
});

describe('venueCoursesToFeatureCollection', () => {
  it('returns a FeatureCollection with features for a valid course', () => {
    const fc = venueCoursesToFeatureCollection([course()]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features.every((x) => x.properties?.courseId === 'course-1')).toBe(true);
  });

  it('concatenates features across multiple courses', () => {
    const fc = venueCoursesToFeatureCollection([
      course({ id: 'a' }),
      course({ id: 'b' }),
    ]);
    const ids = new Set(fc.features.map((x) => x.properties?.courseId));
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('skips a degenerate course rather than aborting the whole layer', () => {
    const degenerate = course({
      id: 'bad',
      geometry: { ...baseParams, pin: baseParams.committee }, // zero-length start line
    });
    const fc = venueCoursesToFeatureCollection([degenerate, course({ id: 'good' })]);
    // The good course still renders.
    expect(fc.features.some((x) => x.properties?.courseId === 'good')).toBe(true);
  });

  it('returns an empty collection for no courses', () => {
    expect(venueCoursesToFeatureCollection([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
