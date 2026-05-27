/**
 * Atlas racing-area shape helpers.
 *
 * A racing area can be a circle (good default for "we race around
 * here") or an axis-aligned rectangle (the more realistic case for
 * club-published racing zones: bounded boxes between GPS corners).
 * Both render as a Polygon so MapLibre paints them identically and
 * the read hook needs no shape-specific branch.
 *
 * Rotation/bearing is intentionally deferred — most demo content
 * stays N-aligned; we'll add bearing once a sailor pushes back.
 */

import type { Polygon } from 'geojson';

export type RacingAreaShape =
  | {
      kind: 'circle';
      centerLat: number;
      centerLng: number;
      radiusMeters: number;
    }
  | {
      kind: 'rectangle';
      centerLat: number;
      centerLng: number;
      /** East-west extent in meters. */
      lengthMeters: number;
      /** North-south extent in meters. */
      widthMeters: number;
    };

const KM_PER_DEG_LAT = 111.32;
const CIRCLE_SEGMENTS = 48;

function lngScaleKm(lat: number): number {
  const v = Math.cos((lat * Math.PI) / 180) * KM_PER_DEG_LAT;
  return v > 0 ? v : KM_PER_DEG_LAT;
}

export function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
): Polygon {
  const radiusKm = radiusMeters / 1000;
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / lngScaleKm(centerLat);
  const ring: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i += 1) {
    const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    ring.push([
      centerLng + Math.cos(theta) * dLng,
      centerLat + Math.sin(theta) * dLat,
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function rectanglePolygon(
  centerLng: number,
  centerLat: number,
  lengthMeters: number,
  widthMeters: number,
): Polygon {
  const halfLengthKm = lengthMeters / 1000 / 2;
  const halfWidthKm = widthMeters / 1000 / 2;
  const dLat = halfWidthKm / KM_PER_DEG_LAT;
  const dLng = halfLengthKm / lngScaleKm(centerLat);
  const w = centerLng - dLng;
  const e = centerLng + dLng;
  const s = centerLat - dLat;
  const n = centerLat + dLat;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, n],
        [e, n],
        [e, s],
        [w, s],
        [w, n],
      ],
    ],
  };
}

export function shapeToPolygon(shape: RacingAreaShape): Polygon {
  if (shape.kind === 'circle') {
    return circlePolygon(shape.centerLng, shape.centerLat, shape.radiusMeters);
  }
  return rectanglePolygon(
    shape.centerLng,
    shape.centerLat,
    shape.lengthMeters,
    shape.widthMeters,
  );
}

/**
 * Bounding-circle radius for the shape — used to fill the
 * `radius_meters` column on persisted rows so simplified
 * point+radius consumers keep working when the row is actually a
 * polygon. Half-diagonal for rectangles, native radius for circles.
 */
export function shapeBoundingRadiusMeters(shape: RacingAreaShape): number {
  if (shape.kind === 'circle') return shape.radiusMeters;
  return (
    Math.sqrt(shape.lengthMeters ** 2 + shape.widthMeters ** 2) / 2
  );
}
