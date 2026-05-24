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
 * Shared color tokens — keep the palette aligned across all three
 * persona styles so the brand feels coherent.
 */
const PALETTE = {
  land: '#F1E9D8',       // cream
  water: '#B7CFE0',      // soft blue
  waterway: '#A6C2D4',   // slightly darker blue for streams/rivers
  grass: '#E8E0C6',      // light cream-tan
  wood: '#E5DCC1',       // slightly darker tan
  building: '#E0D5BC',   // sand
  road: '#D6C9AC',       // muted tan
  park: '#DCE6CC',       // pale green-tan
};

const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const SOURCE_URL = 'https://tiles.openfreemap.org/planet';

/**
 * Sailing — cream land, soft blue water, no labels. Race-marks + wind
 * arrows + tide arrows + POI pins read clearly against this base.
 */
export const SAILING_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Sailing',
  glyphs: GLYPHS,
  sources: {
    openmaptiles: { type: 'vector' as const, url: SOURCE_URL },
  },
  layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': PALETTE.land } },
    {
      id: 'landcover-wood',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': PALETTE.wood, 'fill-opacity': 0.5 },
    },
    {
      id: 'landcover-grass',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'grass'],
      paint: { 'fill-color': PALETTE.grass, 'fill-opacity': 0.4 },
    },
    {
      id: 'water',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': PALETTE.water },
    },
    {
      id: 'waterway',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': PALETTE.waterway, 'line-width': 1 },
    },
  ],
};

/**
 * Nursing — quiet urban base for the Baltimore campus frame (F4/F5).
 * Adds faint major roads + building footprints so a nurse can orient
 * between hospital entrances + parking. Still no commercial POI labels,
 * no district names. Cohort heatmap + preceptor diamonds dominate.
 */
export const NURSING_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Nursing',
  glyphs: GLYPHS,
  sources: {
    openmaptiles: { type: 'vector' as const, url: SOURCE_URL },
  },
  layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': PALETTE.land } },
    {
      id: 'landcover-park',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': PALETTE.park, 'fill-opacity': 0.45 },
    },
    {
      id: 'water',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': PALETTE.water },
    },
    {
      id: 'building',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': PALETTE.building, 'fill-opacity': 0.55 },
    },
    {
      id: 'transportation-major',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      paint: { 'line-color': PALETTE.road, 'line-width': 1.5 },
    },
    {
      id: 'transportation-secondary',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'secondary'],
      paint: { 'line-color': PALETTE.road, 'line-width': 0.8, 'line-opacity': 0.6 },
    },
  ],
};

/**
 * Entrepreneur — sparse rural base for Lakshmi's frame (F7). Cream
 * land + soft blue rivers, faint road network at low contrast so she
 * can orient when planning village-to-market routes. No labels.
 */
export const ENTREPRENEUR_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Entrepreneur',
  glyphs: GLYPHS,
  sources: {
    openmaptiles: { type: 'vector' as const, url: SOURCE_URL },
  },
  layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': PALETTE.land } },
    {
      id: 'landcover-wood',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': PALETTE.wood, 'fill-opacity': 0.4 },
    },
    {
      id: 'water',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': PALETTE.water },
    },
    {
      id: 'waterway',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': PALETTE.waterway, 'line-width': 1 },
    },
    {
      id: 'transportation-network',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      paint: { 'line-color': PALETTE.road, 'line-width': 1, 'line-opacity': 0.5 },
    },
  ],
};
