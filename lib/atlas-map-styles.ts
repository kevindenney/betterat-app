/**
 * Custom MapLibre styles for Atlas — minimal, brand-palette, no
 * commercial POI noise. Lets persona overlays (pins, glow, wind, tide)
 * dominate the canvas.
 *
 * Sources from OpenFreeMap's free planet vector tiles (no API key).
 * The schema is OpenMapTiles — see https://openmaptiles.org/schema/.
 *
 * Strategy: keep only the layers that read as MAP at a glance — water,
 * landcover, major waterways. Drop everything else (roads, streets,
 * buildings, transit, all symbol/label layers). The cream-on-blue
 * palette gives high contrast against overlay UI.
 */

/**
 * Sailing — cream land, soft blue water, no labels. Race-marks + wind
 * arrows + tide arrows + POI pins read clearly against this base.
 */
export const SAILING_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Sailing',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector' as const,
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': '#F1E9D8' },
    },
    {
      id: 'landcover-wood',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': '#E5DCC1', 'fill-opacity': 0.5 },
    },
    {
      id: 'landcover-grass',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'grass'],
      paint: { 'fill-color': '#E8E0C6', 'fill-opacity': 0.4 },
    },
    {
      id: 'water',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#B7CFE0' },
    },
    {
      id: 'waterway',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': '#A6C2D4', 'line-width': 1 },
    },
  ],
};
