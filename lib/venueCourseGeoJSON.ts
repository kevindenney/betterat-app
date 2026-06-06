/**
 * venueCourseGeoJSON — turn persisted CourseGeometryParams into the
 * MapLibre-ready GeoJSON the Atlas canvas draws.
 *
 * Pipeline (all pure, no React / MapLibre):
 *   CourseGeometryParams
 *     → courseParamsToOverlayInput()   (derive windward mark + start line)
 *     → deriveCourseOverlay()          (lib/courseGeometry — W/L overlay)
 *     → courseOverlayToFeatures()      (tag each piece with properties.type)
 *
 * Emitted feature `properties.type` values (so the canvas can paint each
 * differently): 'course-leg', 'start-line', 'finish-line', 'layline',
 * 'start-box', 'course-mark'. Laylines carry `tack: 'port'|'starboard'`
 * and `anchor: 'windward'|'start'`; marks carry `markType`.
 *
 * Handedness caveat: port vs starboard layline sides are assigned
 * parametrically about the wind axis here and must be verified against a
 * known course diagram in the sim — see the spec's handedness note.
 */

import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';

import { reorientCourseToWind } from '@/lib/courseAuthoring';
import {
  type Coord,
  type CourseOverlayGeometry,
  type CourseOverlayInput,
  deriveCourseOverlay,
} from '@/lib/courseGeometry';
import { CoursePositioningService, destinationPoint } from '@/services/CoursePositioningService';
import type { CourseGeometryParams, VenueRaceCourse } from '@/types/courses';

export interface CourseEnvironment {
  /** Live current set, degrees — drives favored-side shading. */
  currentDirection?: number;
  /** Live current drift, knots. */
  currentSpeed?: number;
  /**
   * Live wind direction (degrees the wind blows FROM). When present, each
   * course is re-oriented to this axis before deriving the overlay, so the
   * windward mark tracks the current breeze rather than the wind the course
   * was authored with. Falls back to the stored windDirectionDeg when absent.
   */
  windDirection?: number;
}

function toLngLat(c: Coord): [number, number] {
  return [c.longitude, c.latitude];
}

function midpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { lat: number; lng: number } {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Derive the minimal mark set + start line deriveCourseOverlay needs from
 * the stored params. We place only the windward mark explicitly (upwind
 * of the start-line center along the wind axis) and let the overlay infer
 * the leeward anchor from the start line — the beat runs start → windward.
 */
export function courseParamsToOverlayInput(
  params: CourseGeometryParams,
  env: CourseEnvironment = {},
): CourseOverlayInput {
  const center = midpoint(params.pin, params.committee);
  // windDirectionDeg is the direction the wind blows FROM, so the windward
  // mark sits upwind — toward the wind source — at that bearing.
  const windward = destinationPoint(
    center.lat,
    center.lng,
    params.windDirectionDeg,
    params.legLengthNm,
  );
  return {
    marks: [
      {
        id: 'windward',
        name: 'Windward',
        type: 'windward',
        latitude: windward.lat,
        longitude: windward.lng,
        rounding: 'port',
      },
    ],
    startLine: {
      pin: { lat: params.pin.lat, lng: params.pin.lng },
      committee: { lat: params.committee.lat, lng: params.committee.lng },
    },
    windDirection: params.windDirectionDeg,
    currentDirection: env.currentDirection,
    currentSpeed: env.currentSpeed,
    tackAngleDeg: params.tackAngleDeg,
    startBoxDepthBoatLengths: params.startBoxDepthBoatLengths,
    boatLengthM: params.boatLengthM,
  };
}

function lineFeature(
  id: string,
  points: Coord[],
  props: Record<string, unknown>,
): Feature<LineString> {
  return {
    type: 'Feature',
    id,
    properties: props,
    geometry: { type: 'LineString', coordinates: points.map(toLngLat) },
  };
}

function polygonFeature(
  id: string,
  ring: Coord[],
  props: Record<string, unknown>,
): Feature<Polygon> {
  const closed = ring[0] === ring[ring.length - 1] ? ring : [...ring, ring[0]];
  return {
    type: 'Feature',
    id,
    properties: props,
    geometry: { type: 'Polygon', coordinates: [closed.map(toLngLat)] },
  };
}

function pointFeature(
  id: string,
  c: Coord,
  props: Record<string, unknown>,
): Feature<Point> {
  return {
    type: 'Feature',
    id,
    properties: props,
    geometry: { type: 'Point', coordinates: toLngLat(c) },
  };
}

/**
 * Emit the tagged GeoJSON features for one derived overlay. `courseId`
 * namespaces feature ids so multiple courses can share one collection.
 */
export function courseOverlayToFeatures(
  overlay: CourseOverlayGeometry,
  params: CourseGeometryParams,
  courseId: string,
): Feature[] {
  const {
    W,
    P,
    C,
    portCorner,
    stbdCorner,
    startBox,
    leftPoly,
    rightPoly,
    thirdDividers,
    thirdLabels,
    leftLabel,
    rightLabel,
    favoredSide,
  } = overlay;
  const features: Feature[] = [];

  // Favored-side shading — the two halves of the beat (looking upwind). The
  // current-favored side is tagged `favored` so the canvas can tint it.
  features.push(
    polygonFeature(`${courseId}:side-left`, leftPoly, {
      type: 'course-side',
      side: 'left',
      favored: favoredSide === 'left',
      courseId,
    }),
    polygonFeature(`${courseId}:side-right`, rightPoly, {
      type: 'course-side',
      side: 'right',
      favored: favoredSide === 'right',
      courseId,
    }),
  );

  // Thirds dividers — the bottom/middle/upper splits across the beat.
  thirdDividers.forEach((divider, i) => {
    features.push(
      lineFeature(`${courseId}:third-${i}`, divider, { type: 'course-third', courseId }),
    );
  });

  // Thirds labels — tie each band on the map back to the strategy card's
  // BOTTOM/MIDDLE/UPPER ⅓ rows. Anchored at the band centers (1/6, 1/2, 5/6
  // of the beat). ASCII labels only — the ⅓ glyph isn't in the map font.
  (['bottom', 'middle', 'upper'] as const).forEach((band) => {
    features.push(
      pointFeature(`${courseId}:third-label-${band}`, thirdLabels[band], {
        type: 'course-third-label',
        label: band.toUpperCase(),
        courseId,
      }),
    );
  });

  // Side labels — LEFT/RIGHT at the two half-centers, echoing the strategy
  // card's favored-side language. The current-favored side is tagged so the
  // canvas can tint it the same green as its shading.
  features.push(
    pointFeature(`${courseId}:side-label-left`, leftLabel, {
      type: 'course-side-label',
      label: 'LEFT',
      favored: favoredSide === 'left',
      courseId,
    }),
    pointFeature(`${courseId}:side-label-right`, rightLabel, {
      type: 'course-side-label',
      label: 'RIGHT',
      favored: favoredSide === 'right',
      courseId,
    }),
  );

  // Start line (pin ↔ committee).
  features.push(
    lineFeature(`${courseId}:start-line`, [P, C], { type: 'start-line', courseId }),
  );

  // Finish line: committee ↔ finish buoy (pin reflected across committee).
  const finish = CoursePositioningService.calculateFinishMark(
    { pin: { lat: P.latitude, lng: P.longitude }, committee: { lat: C.latitude, lng: C.longitude } },
    params.windDirectionDeg,
  );
  const finishCoord: Coord = { latitude: finish.lat, longitude: finish.lng };
  features.push(
    lineFeature(`${courseId}:finish-line`, [C, finishCoord], { type: 'finish-line', courseId }),
  );

  // Laylines — 4 segments, tagged tack + anchor. Mirrors the race-detail
  // overlay: windward-anchored laylines run down to the corners, start-
  // anchored laylines run up from the line ends to the same corners.
  features.push(
    lineFeature(`${courseId}:layline-wind-stbd`, [W, stbdCorner], {
      type: 'layline',
      tack: 'starboard',
      anchor: 'windward',
      courseId,
    }),
    lineFeature(`${courseId}:layline-start-stbd`, [P, stbdCorner], {
      type: 'layline',
      tack: 'starboard',
      anchor: 'start',
      courseId,
    }),
    lineFeature(`${courseId}:layline-wind-port`, [W, portCorner], {
      type: 'layline',
      tack: 'port',
      anchor: 'windward',
      courseId,
    }),
    lineFeature(`${courseId}:layline-start-port`, [C, portCorner], {
      type: 'layline',
      tack: 'port',
      anchor: 'start',
      courseId,
    }),
  );

  // Starting box polygon.
  if (startBox) {
    features.push(
      polygonFeature(`${courseId}:start-box`, startBox.outline, { type: 'start-box', courseId }),
    );
  }

  // Marks: windward + the start-line buoys + finish buoy.
  features.push(
    pointFeature(`${courseId}:mark-windward`, W, { type: 'course-mark', markType: 'windward', courseId }),
    pointFeature(`${courseId}:mark-pin`, P, { type: 'course-mark', markType: 'pin', courseId }),
    pointFeature(`${courseId}:mark-committee`, C, { type: 'course-mark', markType: 'committee', courseId }),
    pointFeature(`${courseId}:mark-finish`, finishCoord, { type: 'course-mark', markType: 'finish', courseId }),
  );

  return features;
}

function startLineCenter(params: CourseGeometryParams): Coord {
  return {
    latitude: (params.pin.lat + params.committee.lat) / 2,
    longitude: (params.pin.lng + params.committee.lng) / 2,
  };
}

function triangleCourseToFeatures(params: CourseGeometryParams, courseId: string): Feature[] {
  const start = startLineCenter(params);
  const pin: Coord = { latitude: params.pin.lat, longitude: params.pin.lng };
  const committee: Coord = {
    latitude: params.committee.lat,
    longitude: params.committee.lng,
  };
  const windwardPoint = destinationPoint(
    start.latitude,
    start.longitude,
    params.windDirectionDeg,
    params.legLengthNm,
  );
  const windward: Coord = {
    latitude: windwardPoint.lat,
    longitude: windwardPoint.lng,
  };
  const wingAxis = destinationPoint(
    start.latitude,
    start.longitude,
    params.windDirectionDeg,
    params.legLengthNm * 0.5,
  );
  const wingPoint = destinationPoint(
    wingAxis.lat,
    wingAxis.lng,
    params.windDirectionDeg + 90,
    params.legLengthNm * 0.866,
  );
  const wing: Coord = {
    latitude: wingPoint.lat,
    longitude: wingPoint.lng,
  };

  return [
    lineFeature(`${courseId}:start-line`, [pin, committee], {
      type: 'start-line',
      courseId,
    }),
    lineFeature(`${courseId}:triangle-leg`, [start, windward, wing, start], {
      type: 'course-leg',
      courseId,
      courseType: 'triangle',
    }),
    pointFeature(`${courseId}:mark-windward`, windward, {
      type: 'course-mark',
      markType: 'windward',
      courseId,
    }),
    pointFeature(`${courseId}:mark-wing`, wing, {
      type: 'course-mark',
      markType: 'wing',
      courseId,
    }),
    pointFeature(`${courseId}:mark-pin`, pin, {
      type: 'course-mark',
      markType: 'pin',
      courseId,
    }),
    pointFeature(`${courseId}:mark-committee`, committee, {
      type: 'course-mark',
      markType: 'committee',
      courseId,
    }),
  ];
}

/**
 * Convert a list of venue race courses into a single FeatureCollection
 * ready for the Atlas canvas. Courses whose geometry can't be derived
 * (degenerate params) are skipped rather than aborting the whole layer.
 */
export function venueCoursesToFeatureCollection(
  courses: VenueRaceCourse[],
  env: CourseEnvironment = {},
): FeatureCollection {
  const features: Feature[] = [];
  for (const course of courses) {
    // Re-orient to the live wind when we have an observation; otherwise draw
    // the course as authored.
    const geometry =
      env.windDirection != null
        ? reorientCourseToWind(course.geometry, env.windDirection)
        : course.geometry;
    if (geometry.courseType === 'triangle' || course.courseType === 'triangle') {
      features.push(...triangleCourseToFeatures(geometry, course.id));
      continue;
    }
    if (
      geometry.courseType !== 'windward_leeward' &&
      course.courseType !== 'windward_leeward'
    ) {
      continue;
    }
    const overlay = deriveCourseOverlay(courseParamsToOverlayInput(geometry, env));
    if (!overlay) continue;
    features.push(...courseOverlayToFeatures(overlay, geometry, course.id));
  }
  return { type: 'FeatureCollection', features };
}
