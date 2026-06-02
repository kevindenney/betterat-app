import { parseGeometry, toCourse, type RawCourse } from '../useVenueRaceCourses.utils';

const validGeometry = {
  committee: { lat: 22.281, lng: 114.171 },
  pin: { lat: 22.281, lng: 114.169 },
  windDirectionDeg: 10,
  legLengthNm: 0.5,
  tackAngleDeg: 42,
  boatLengthM: 8.9,
  startBoxDepthBoatLengths: 5,
  courseType: 'windward_leeward',
};

function rawCourse(overrides: Partial<RawCourse> = {}): RawCourse {
  return {
    id: 'course-1',
    racing_area_id: 'area-1',
    venue_id: null,
    name: 'Victoria Harbour — W/L short',
    course_type: 'windward_leeward',
    course_geometry: validGeometry,
    classes_used: ['Dragon'],
    is_active: true,
    created_by: 'user-1',
    created_at: '2026-06-03T00:00:00Z',
    updated_at: '2026-06-03T00:00:00Z',
    ...overrides,
  };
}

describe('parseGeometry', () => {
  it('parses a well-formed geometry blob', () => {
    const g = parseGeometry(validGeometry)!;
    expect(g).not.toBeNull();
    expect(g.committee).toEqual({ lat: 22.281, lng: 114.171 });
    expect(g.windDirectionDeg).toBe(10);
    expect(g.startBoxDepthBoatLengths).toBe(5);
    expect(g.courseType).toBe('windward_leeward');
  });

  it('rejects non-object input', () => {
    expect(parseGeometry(null)).toBeNull();
    expect(parseGeometry('nope')).toBeNull();
    expect(parseGeometry(42)).toBeNull();
  });

  it('rejects missing or malformed endpoints', () => {
    expect(parseGeometry({ ...validGeometry, committee: undefined })).toBeNull();
    expect(parseGeometry({ ...validGeometry, pin: { lat: 'x', lng: 1 } })).toBeNull();
  });

  it('rejects when any required scalar is non-finite', () => {
    expect(parseGeometry({ ...validGeometry, legLengthNm: undefined })).toBeNull();
    expect(parseGeometry({ ...validGeometry, tackAngleDeg: 'NaN' })).toBeNull();
    expect(parseGeometry({ ...validGeometry, boatLengthM: null })).toBeNull();
  });

  it('falls back to windward_leeward for an unknown courseType', () => {
    expect(parseGeometry({ ...validGeometry, courseType: 'banana' })!.courseType).toBe(
      'windward_leeward',
    );
  });
});

describe('toCourse', () => {
  it('maps a raw row into a typed VenueRaceCourse', () => {
    const c = toCourse(rawCourse())!;
    expect(c).not.toBeNull();
    expect(c.id).toBe('course-1');
    expect(c.racingAreaId).toBe('area-1');
    expect(c.venueId).toBeNull();
    expect(c.name).toBe('Victoria Harbour — W/L short');
    expect(c.courseType).toBe('windward_leeward');
    expect(c.classesUsed).toEqual(['Dragon']);
    expect(c.isActive).toBe(true);
  });

  it('drops a row whose geometry is malformed', () => {
    expect(toCourse(rawCourse({ course_geometry: { committee: null } }))).toBeNull();
  });

  it('defaults classes_used to an empty array when null', () => {
    expect(toCourse(rawCourse({ classes_used: null }))!.classesUsed).toEqual([]);
  });

  it('falls back to the geometry courseType when the column is unknown', () => {
    const c = toCourse(rawCourse({ course_type: 'bogus' }))!;
    expect(c.courseType).toBe('windward_leeward');
  });
});
