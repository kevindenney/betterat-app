/**
 * WindOverlay — wind-arrow grid overlay rendered inside a <RaceMap>.
 *
 * Generates a 3×3 grid of arrows across the visible region. Each arrow is a
 * MapLibre Marker with an inline SVG; arrow opacity scales with wind speed.
 *
 * `region` shape is kept for backward compat with the legacy react-native-maps
 * API even though MapLibre uses lng/lat ordering internally.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { Marker as MLMarker } from '@maplibre/maplibre-react-native';
import { colors } from '@/constants/designSystem';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface WindConditions {
  speed: number;
  direction: number;
  gusts?: number;
}

interface WindOverlayProps {
  conditions: WindConditions;
  region: Region;
}

function generateGrid(region: Region) {
  const grid: { lng: number; lat: number }[] = [];
  const size = 3;
  const latStep = region.latitudeDelta / (size + 1);
  const lonStep = region.longitudeDelta / (size + 1);
  const baseLat = region.latitude - region.latitudeDelta / 2;
  const baseLng = region.longitude - region.longitudeDelta / 2;
  for (let i = 1; i <= size; i++) {
    for (let j = 1; j <= size; j++) {
      grid.push({ lat: baseLat + i * latStep, lng: baseLng + j * lonStep });
    }
  }
  return grid;
}

const WindArrow: React.FC<{ direction: number; speed: number }> = ({ direction, speed }) => {
  const opacity = Math.min(speed / 20, 1);
  return (
    <Svg width={30} height={30}>
      <Path
        d="M15,5 L15,20 M15,5 L10,10 M15,5 L20,10"
        stroke={colors.wind}
        strokeWidth={2}
        strokeLinecap="round"
        transform={`rotate(${(direction + 180) % 360} 15 15)`}
        opacity={opacity}
      />
    </Svg>
  );
};

export const WindOverlay: React.FC<WindOverlayProps> = ({ conditions, region }) => {
  const grid = generateGrid(region);
  return (
    <>
      {grid.map((p, idx) => (
        <MLMarker key={`wind-${idx}`} id={`wind-${idx}`} lngLat={[p.lng, p.lat]}>
          <WindArrow direction={conditions.direction} speed={conditions.speed} />
        </MLMarker>
      ))}
    </>
  );
};
