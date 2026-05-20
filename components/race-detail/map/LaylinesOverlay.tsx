/**
 * LaylinesOverlay — port + starboard laylines from the windward mark.
 *
 * Laylines show the optimal approach angles. Rendered as two dashed GeoJSON
 * LineString layers inside a <RaceMap>.
 */

import React, { useMemo } from 'react';
import {
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
} from '@maplibre/maplibre-react-native';
import type { CourseMark } from '@/types/raceEvents';

const LAYLINE_COLORS = {
  port: '#ef4444',
  starboard: '#22c55e',
};

interface LaylinesOverlayProps {
  marks: CourseMark[];
  /** Wind direction is FROM (degrees). */
  windDirection: number;
  pointingAngle?: number;
  /** Length in degrees (~0.015 ≈ 1.5 km). */
  laylineLength?: number;
}

function endpoint(
  mark: CourseMark,
  bearing: number,
  length: number,
): [number, number] {
  const bearingRad = (bearing * Math.PI) / 180;
  return [
    mark.longitude + length * Math.sin(bearingRad),
    mark.latitude + length * Math.cos(bearingRad),
  ];
}

function lineFeature(start: [number, number], end: [number, number]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: [start, end],
    },
  };
}

export const LaylinesOverlay: React.FC<LaylinesOverlayProps> = ({
  marks,
  windDirection,
  pointingAngle = 45,
  laylineLength = 0.015,
}) => {
  const features = useMemo(() => {
    const windward = marks.find((m) => m.mark_type === 'windward');
    if (!windward) return null;
    // Layline bearings extend DOWNWIND from the windward mark.
    const portBearing = (windDirection - pointingAngle + 180) % 360;
    const starboardBearing = (windDirection + pointingAngle + 180) % 360;
    const markPoint: [number, number] = [windward.longitude, windward.latitude];
    return {
      port: lineFeature(markPoint, endpoint(windward, portBearing, laylineLength)),
      starboard: lineFeature(
        markPoint,
        endpoint(windward, starboardBearing, laylineLength),
      ),
    };
  }, [marks, windDirection, pointingAngle, laylineLength]);

  if (!features) return null;

  return (
    <>
      <MLGeoJSONSource id="layline-port" data={features.port}>
        <MLLayer
              type="line"
          id="layline-port-layer"
          source="layline-port"
          style={{
            lineColor: LAYLINE_COLORS.port,
            lineWidth: 3,
            lineDasharray: [3, 2],
            lineCap: 'round',
          }}
        />
      </MLGeoJSONSource>
      <MLGeoJSONSource id="layline-starboard" data={features.starboard}>
        <MLLayer
              type="line"
          id="layline-starboard-layer"
          source="layline-starboard"
          style={{
            lineColor: LAYLINE_COLORS.starboard,
            lineWidth: 3,
            lineDasharray: [3, 2],
            lineCap: 'round',
          }}
        />
      </MLGeoJSONSource>
    </>
  );
};
