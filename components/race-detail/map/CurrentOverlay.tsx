/**
 * CurrentOverlay — tidal-current arrow grid overlay for <RaceMap>.
 *
 * 2×2 grid of arrows; color encodes current strength (slack/moderate/strong).
 * Same pattern as WindOverlay but lower density.
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

interface CurrentConditions {
  speed: number;
  direction: number;
  strength: 'slack' | 'moderate' | 'strong';
}

interface CurrentOverlayProps {
  conditions: CurrentConditions;
  region: Region;
}

function generateGrid(region: Region) {
  const grid: { lng: number; lat: number }[] = [];
  const size = 2;
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

const CurrentArrow: React.FC<{ direction: number; strength: 'slack' | 'moderate' | 'strong' }> = ({
  direction,
  strength,
}) => {
  const color =
    strength === 'slack'
      ? colors.neutral[400]
      : strength === 'moderate'
        ? colors.current
        : colors.danger[600];
  return (
    <Svg width={30} height={30}>
      <Path
        d="M15,8 L15,22 M15,22 L11,18 M15,22 L19,18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        transform={`rotate(${(direction + 180) % 360} 15 15)`}
      />
    </Svg>
  );
};

export const CurrentOverlay: React.FC<CurrentOverlayProps> = ({ conditions, region }) => {
  const grid = generateGrid(region);
  return (
    <>
      {grid.map((p, idx) => (
        <MLMarker key={`current-${idx}`} id={`current-${idx}`} lngLat={[p.lng, p.lat]}>
          <CurrentArrow direction={conditions.direction} strength={conditions.strength} />
        </MLMarker>
      ))}
    </>
  );
};
