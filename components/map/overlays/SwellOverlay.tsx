/**
 * SwellOverlay Component
 *
 * Displays swell direction arrows with primary and secondary swell systems
 * Uses multi-swell data for comprehensive visualization
 */

import React from 'react';
import { Platform } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { Marker as MLMarker } from '@maplibre/maplibre-react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface SwellConditions {
  primarySwell: {
    height: number; // meters
    period: number; // seconds
    direction: number; // degrees
  };
  secondarySwell?: {
    height: number;
    period: number;
    direction: number;
  };
}

interface SwellOverlayProps {
  conditions: SwellConditions;
  region: Region;
  showSecondary?: boolean;
}

// Generate grid of swell arrows
const generateSwellArrowGrid = (region: Region, gridSize: number = 2) => {
  const positions = [];
  const latStep = region.latitudeDelta / (gridSize + 1);
  const lonStep = region.longitudeDelta / (gridSize + 1);

  for (let i = 1; i <= gridSize; i++) {
    for (let j = 1; j <= gridSize; j++) {
      positions.push({
        latitude: region.latitude - region.latitudeDelta / 2 + i * latStep,
        longitude: region.longitude - region.longitudeDelta / 2 + j * lonStep,
      });
    }
  }

  return positions;
};

interface SwellArrowProps {
  primarySwell: {
    height: number;
    period: number;
    direction: number;
  };
  secondarySwell?: {
    height: number;
    period: number;
    direction: number;
  };
  showSecondary: boolean;
}

const SwellArrow: React.FC<SwellArrowProps> = ({
  primarySwell,
  secondarySwell,
  showSecondary
}) => {
  // Color intensity based on swell height
  const getPrimaryColor = (height: number) => {
    if (height < 1) return '#4A90E2'; // Light blue - small swell
    if (height < 2) return '#2E7BCF'; // Medium blue
    if (height < 3) return '#1E5FA3'; // Dark blue
    return '#0D3D6B'; // Very dark blue - large swell
  };

  const getSecondaryColor = (height: number) => {
    if (height < 1) return '#8BC34A'; // Light green
    if (height < 2) return '#66BB6A'; // Medium green
    return '#43A047'; // Dark green
  };

  const primaryColor = getPrimaryColor(primarySwell.height);
  const primaryOpacity = Math.min(primarySwell.height / 3, 1);
  const primaryWidth = 2 + (primarySwell.height / 3) * 2; // 2-4px based on height

  return (
    <Svg width={50} height={50} viewBox="0 0 50 50">
      {/* Primary Swell Arrow */}
      <Path
        d="M25,10 L25,35 M25,35 L20,28 M25,35 L30,28"
        stroke={primaryColor}
        strokeWidth={primaryWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`rotate(${primarySwell.direction} 25 25)`}
        opacity={primaryOpacity}
      />

      {/* Primary swell height indicator */}
      <Circle
        cx="25"
        cy="8"
        r="5"
        fill={primaryColor}
        opacity={primaryOpacity * 0.8}
        transform={`rotate(${primarySwell.direction} 25 25)`}
      />
      <SvgText
        x="25"
        y="11"
        fontSize="7"
        fill="white"
        textAnchor="middle"
        fontWeight="bold"
        transform={`rotate(${primarySwell.direction} 25 25)`}
      >
        {primarySwell.height.toFixed(1)}
      </SvgText>

      {/* Secondary Swell Arrow (if present and visible) */}
      {showSecondary && secondarySwell && secondarySwell.height > 0.3 && (
        <>
          <Path
            d="M25,12 L25,32 M25,32 L21,26 M25,32 L29,26"
            stroke={getSecondaryColor(secondarySwell.height)}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="3,2"
            transform={`rotate(${secondarySwell.direction} 25 25)`}
            opacity={0.7}
          />
          <Circle
            cx="25"
            cy="10"
            r="3"
            fill={getSecondaryColor(secondarySwell.height)}
            opacity={0.6}
            transform={`rotate(${secondarySwell.direction} 25 25)`}
          />
          <SvgText
            x="25"
            y="12"
            fontSize="5"
            fill="white"
            textAnchor="middle"
            fontWeight="bold"
            transform={`rotate(${secondarySwell.direction} 25 25)`}
          >
            {secondarySwell.height.toFixed(1)}
          </SvgText>
        </>
      )}

      {/* Period indicator (bottom corner) */}
      <SvgText
        x="42"
        y="45"
        fontSize="6"
        fill={primaryColor}
        textAnchor="end"
        opacity={0.8}
      >
        {primarySwell.period}s
      </SvgText>
    </Svg>
  );
};

export const SwellOverlay: React.FC<SwellOverlayProps> = ({
  conditions,
  region,
  showSecondary = true
}) => {
  // Only show if swell is significant
  if (conditions.primarySwell.height < 0.2) {
    return null;
  }

  const positions = generateSwellArrowGrid(region);

  if (Platform.OS === 'web') {
    // Web rendering is provided through getSwellLayerSpec() for map engines.
    return null;
  }

  return (
    <>
      {positions.map((p, idx) => (
        <MLMarker
          key={`swell-${idx}`}
          id={`swell-${idx}`}
          lngLat={[p.longitude, p.latitude]}
        >
          <SwellArrow
            primarySwell={conditions.primarySwell}
            secondarySwell={conditions.secondarySwell}
            showSecondary={showSecondary}
          />
        </MLMarker>
      ))}
    </>
  );
};

/**
 * MapLibre layer spec for web
 */
export function getSwellLayerSpec(
  conditions: SwellConditions,
  region: Region,
  showSecondary: boolean = true
): any[] {
  if (!conditions || conditions.primarySwell.height < 0.2) {
    return [];
  }

  const positions = generateSwellArrowGrid(region);
  const swellFeatures = positions.map((position, index) => ({
    type: 'Feature' as const,
    id: `swell-${index}`,
    geometry: {
      type: 'Point' as const,
      coordinates: [position.longitude, position.latitude],
    },
    properties: {
      primaryDirection: Number(conditions.primarySwell.direction) || 0,
      primaryHeight: Number(conditions.primarySwell.height) || 0,
      primaryPeriod: Number(conditions.primarySwell.period) || 0,
      secondaryDirection: Number(conditions.secondarySwell?.direction) || 0,
      secondaryHeight: Number(conditions.secondarySwell?.height) || 0,
      secondaryPeriod: Number(conditions.secondarySwell?.period) || 0,
      showSecondary: showSecondary ? 1 : 0,
      // Keep these as plain strings so map text-field can consume directly.
      primaryHeightLabel: `${conditions.primarySwell.height.toFixed(1)}m`,
      primaryPeriodLabel: `${conditions.primarySwell.period.toFixed(0)}s`,
      secondaryHeightLabel: conditions.secondarySwell
        ? `${conditions.secondarySwell.height.toFixed(1)}m`
        : '',
      primaryArrowGlyph: '▲',
      secondaryArrowGlyph: '△',
    },
  }));

  const source = {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: swellFeatures,
    },
  };

  const primaryArrowLayer = {
    id: 'swell-primary-arrow',
    type: 'symbol',
    source,
    layout: {
      'text-field': ['get', 'primaryArrowGlyph'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['get', 'primaryHeight'],
        0.2,
        12,
        1.5,
        18,
        3.5,
        24,
      ],
      // Convert incoming direction to visual "arrow points toward swell direction".
      'text-rotate': ['+', ['get', 'primaryDirection'], 180],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': [
        'step',
        ['get', 'primaryHeight'],
        '#4A90E2',
        1,
        '#2E7BCF',
        2,
        '#1E5FA3',
        3,
        '#0D3D6B',
      ],
      'text-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'primaryHeight'],
        0.2,
        0.35,
        3.5,
        0.95,
      ],
      'text-halo-color': '#0B1F33',
      'text-halo-width': 0.75,
    },
  };

  const primaryHeightLabelLayer = {
    id: 'swell-primary-height-label',
    type: 'symbol',
    source,
    layout: {
      'text-field': ['get', 'primaryHeightLabel'],
      'text-size': 10,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#D6E6F7',
      'text-halo-color': '#0B1F33',
      'text-halo-width': 1,
      'text-opacity': 0.85,
    },
  };

  const primaryPeriodLabelLayer = {
    id: 'swell-primary-period-label',
    type: 'symbol',
    source,
    layout: {
      'text-field': ['get', 'primaryPeriodLabel'],
      'text-size': 9,
      'text-offset': [1.2, -1.2],
      'text-anchor': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#B7CCE6',
      'text-halo-color': '#0B1F33',
      'text-halo-width': 1,
      'text-opacity': 0.8,
    },
  };

  const secondaryLayers =
    showSecondary && conditions.secondarySwell && conditions.secondarySwell.height > 0.3
      ? [
          {
            id: 'swell-secondary-arrow',
            type: 'symbol',
            source,
            layout: {
              'text-field': ['get', 'secondaryArrowGlyph'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['get', 'secondaryHeight'],
                0.3,
                9,
                1.5,
                14,
                3,
                18,
              ],
              'text-rotate': ['+', ['get', 'secondaryDirection'], 180],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': [
                'step',
                ['get', 'secondaryHeight'],
                '#8BC34A',
                1,
                '#66BB6A',
                2,
                '#43A047',
              ],
              'text-opacity': 0.7,
              'text-halo-color': '#0B1F33',
              'text-halo-width': 0.75,
            },
          },
          {
            id: 'swell-secondary-height-label',
            type: 'symbol',
            source,
            layout: {
              'text-field': ['get', 'secondaryHeightLabel'],
              'text-size': 8,
              'text-offset': [0, -1.8],
              'text-anchor': 'bottom',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#D6F2D6',
              'text-halo-color': '#0B1F33',
              'text-halo-width': 1,
              'text-opacity': 0.75,
            },
          },
        ]
      : [];

  return [
    primaryArrowLayer,
    primaryHeightLabelLayer,
    primaryPeriodLabelLayer,
    ...secondaryLayers,
  ];
}
