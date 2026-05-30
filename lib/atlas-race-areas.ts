/**
 * Atlas race-areas — soft polygons drawn over water where racing
 * happens. Rendered as a MapLibre fill layer (gated by the F1/F6
 * "Race areas" toggle) so they're geographic rather than SVG-overlay
 * approximations.
 *
 * Coordinates are rough manual polygons covering the canonical HK
 * racing areas. Replace with surveyed waypoints when racing-area
 * geometry lands in Supabase.
 */

import type { FeatureCollection, Polygon } from 'geojson';

export const RACE_AREAS_GEOJSON: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Victoria Harbour', priority: 'primary' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [114.150, 22.296],
            [114.205, 22.296],
            [114.220, 22.286],
            [114.205, 22.275],
            [114.150, 22.275],
            [114.140, 22.286],
            [114.150, 22.296],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Port Shelter', priority: 'secondary' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [114.265, 22.380],
            [114.310, 22.380],
            [114.320, 22.355],
            [114.305, 22.340],
            [114.270, 22.345],
            [114.260, 22.365],
            [114.265, 22.380],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Middle Island Channel', priority: 'secondary' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [114.180, 22.235],
            [114.215, 22.235],
            [114.225, 22.220],
            [114.215, 22.210],
            [114.180, 22.210],
            [114.170, 22.220],
            [114.180, 22.235],
          ],
        ],
      },
    },
  ],
};
