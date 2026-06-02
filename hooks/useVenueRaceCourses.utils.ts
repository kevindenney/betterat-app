/**
 * Pure row-mapping + validation helpers for useVenueRaceCourses, split
 * out (like useAtlasNextEvent.utils) so the parsing can be unit-tested
 * without pulling in supabase / react-query at module load.
 */

import type {
  CourseGeometryParams,
  CourseType,
  VenueRaceCourse,
} from '@/types/courses';

export interface RawCourse {
  id: string;
  racing_area_id: string | null;
  venue_id: string | null;
  name: string;
  course_type: string | null;
  course_geometry: unknown;
  classes_used: string[] | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const COURSE_TYPES: CourseType[] = [
  'windward_leeward',
  'triangle',
  'olympic',
  'trapezoid',
  'custom',
];

function isLatLng(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as { lat?: unknown; lng?: unknown };
  return Number.isFinite(o.lat) && Number.isFinite(o.lng);
}

/** Boundary guard: course_geometry is JSONB from the DB, so validate the
 *  required endpoints + scalars before trusting it. Returns null for any
 *  malformed shape so the caller can skip the row. */
export function parseGeometry(raw: unknown): CourseGeometryParams | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (!isLatLng(g.committee) || !isLatLng(g.pin)) return null;
  if (
    !Number.isFinite(g.windDirectionDeg) ||
    !Number.isFinite(g.legLengthNm) ||
    !Number.isFinite(g.tackAngleDeg) ||
    !Number.isFinite(g.boatLengthM) ||
    !Number.isFinite(g.startBoxDepthBoatLengths)
  ) {
    return null;
  }
  const courseType = COURSE_TYPES.includes(g.courseType as CourseType)
    ? (g.courseType as CourseType)
    : 'windward_leeward';
  return {
    committee: g.committee as { lat: number; lng: number },
    pin: g.pin as { lat: number; lng: number },
    windDirectionDeg: g.windDirectionDeg as number,
    legLengthNm: g.legLengthNm as number,
    tackAngleDeg: g.tackAngleDeg as number,
    boatLengthM: g.boatLengthM as number,
    startBoxDepthBoatLengths: g.startBoxDepthBoatLengths as number,
    courseType,
  };
}

export function toCourse(row: RawCourse): VenueRaceCourse | null {
  const geometry = parseGeometry(row.course_geometry);
  if (!geometry) return null;
  const courseType = COURSE_TYPES.includes(row.course_type as CourseType)
    ? (row.course_type as CourseType)
    : geometry.courseType;
  return {
    id: row.id,
    racingAreaId: row.racing_area_id,
    venueId: row.venue_id,
    name: row.name,
    courseType,
    geometry,
    classesUsed: row.classes_used ?? [],
    isActive: row.is_active ?? true,
    createdBy: row.created_by,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
