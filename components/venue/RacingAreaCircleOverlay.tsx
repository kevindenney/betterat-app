/**
 * RacingAreaCircleOverlay
 *
 * MapLibre overlay for displaying racing areas as filled circles (point +
 * radius). Each area becomes a GeoJSON Polygon (32-point approximation) + a
 * Marker label at the center. Color encodes verification status:
 * official/verified/pending/disputed.
 *
 * MapLibre RN has no native Circle primitive (unlike react-native-maps),
 * so we approximate the circle as a polygon. The label callout was a
 * react-native-maps Callout — dropped here; callers handle `onAreaPress`.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  Marker as MLMarker,
} from '@maplibre/maplibre-react-native';
import type { VenueRacingArea } from '@/services/venue/CommunityVenueCreationService';
import { TufteTokens } from '@/constants/designSystem';

interface RacingAreaCircleOverlayProps {
  areas: VenueRacingArea[];
  selectedAreaId?: string | null;
  onAreaPress?: (area: VenueRacingArea) => void;
  showLabels?: boolean;
}

const AREA_COLORS = {
  official: {
    fill: 'rgba(37, 99, 235, 0.12)',
    stroke: '#2563EB',
    selectedFill: 'rgba(37, 99, 235, 0.22)',
    selectedStroke: '#1D4ED8',
  },
  verified: {
    fill: 'rgba(5, 150, 105, 0.12)',
    stroke: '#059669',
    selectedFill: 'rgba(5, 150, 105, 0.22)',
    selectedStroke: '#047857',
  },
  pending: {
    fill: 'rgba(156, 163, 175, 0.08)',
    stroke: '#9CA3AF',
    selectedFill: 'rgba(156, 163, 175, 0.16)',
    selectedStroke: '#6B7280',
  },
  disputed: {
    fill: 'rgba(217, 119, 6, 0.12)',
    stroke: '#D97706',
    selectedFill: 'rgba(217, 119, 6, 0.22)',
    selectedStroke: '#B45309',
  },
};

function getAreaColors(area: VenueRacingArea, isSelected: boolean) {
  let set = AREA_COLORS.official;
  if (area.source === 'community') {
    if (area.verification_status === 'verified') set = AREA_COLORS.verified;
    else if (area.verification_status === 'disputed') set = AREA_COLORS.disputed;
    else set = AREA_COLORS.pending;
  }
  return {
    fill: isSelected ? set.selectedFill : set.fill,
    stroke: isSelected ? set.selectedStroke : set.stroke,
  };
}

/**
 * Approximate a circle (center + radius_meters) as a 32-point GeoJSON Polygon.
 * Earth radius ≈ 6,371,000 m. Latitude degrees are ~constant; longitude
 * scales by cos(latitude).
 */
function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  points = 32,
): [number, number][] {
  const earthRadius = 6371000;
  const latRad = (centerLat * Math.PI) / 180;
  const dLat = ((radiusMeters / earthRadius) * 180) / Math.PI;
  const dLng = dLat / Math.max(Math.cos(latRad), 0.0001);

  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([centerLng + dLng * Math.cos(theta), centerLat + dLat * Math.sin(theta)]);
  }
  return coords;
}

export function RacingAreaCircleOverlay({
  areas,
  selectedAreaId,
  onAreaPress,
  showLabels = true,
}: RacingAreaCircleOverlayProps) {
  const handlePress = useCallback(
    (area: VenueRacingArea) => onAreaPress?.(area),
    [onAreaPress],
  );

  const validAreas = useMemo(
    () =>
      areas.filter(
        (a) =>
          a.center_lat != null &&
          a.center_lng != null &&
          a.radius_meters != null &&
          a.radius_meters > 0,
      ),
    [areas],
  );

  if (validAreas.length === 0) return null;

  return (
    <>
      {validAreas.map((area) => {
        const isSelected = area.id === selectedAreaId;
        const colors = getAreaColors(area, isSelected);
        const isPending = area.source === 'community' && area.verification_status === 'pending';
        const polygonCoords = circlePolygon(
          area.center_lng!,
          area.center_lat!,
          area.radius_meters!,
        );

        const polygonFeature = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [polygonCoords],
          },
        };

        return (
          <React.Fragment key={area.id}>
            <MLGeoJSONSource id={`area-${area.id}`} shape={polygonFeature}>
              <MLLayer
                id={`area-${area.id}-fill`}
                sourceID={`area-${area.id}`}
                style={{ fillColor: colors.fill, fillOutlineColor: colors.stroke }}
              />
              <MLLayer
                id={`area-${area.id}-stroke`}
                sourceID={`area-${area.id}`}
                style={{
                  lineColor: colors.stroke,
                  lineWidth: isSelected ? 2.5 : 1.5,
                  lineDasharray: isPending ? [2, 2] : undefined,
                }}
              />
            </MLGeoJSONSource>

            {showLabels ? (
              <MLMarker
                id={`area-${area.id}-label`}
                lngLat={[area.center_lng!, area.center_lat!]}
              >
                <View
                  onTouchEnd={() => handlePress(area)}
                  style={[styles.labelContainer, isSelected && styles.labelSelected]}
                >
                  <Text
                    style={[
                      styles.labelText,
                      isSelected && styles.labelTextSelected,
                      isPending && styles.labelTextPending,
                    ]}
                    numberOfLines={1}
                  >
                    {area.name}
                  </Text>
                  {isPending ? (
                    <View style={styles.confirmBadge}>
                      <Text style={styles.confirmBadgeText}>
                        {area.confirmation_count}/3
                      </Text>
                    </View>
                  ) : null}
                  {area.source === 'official' && !isSelected ? (
                    <View style={styles.officialDot} />
                  ) : null}
                </View>
              </MLMarker>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** GeoJSON helper still used by the web map (unchanged). */
export function useRacingAreasAsGeoJSON(
  areas: VenueRacingArea[],
  selectedAreaId?: string | null,
) {
  return useMemo(() => {
    const validAreas = areas.filter(
      (a) => a.center_lat != null && a.center_lng != null && a.radius_meters,
    );
    return {
      type: 'FeatureCollection' as const,
      features: validAreas.map((area) => {
        const isSelected = area.id === selectedAreaId;
        const colors = getAreaColors(area, isSelected);
        return {
          type: 'Feature' as const,
          id: area.id,
          properties: {
            name: area.name,
            description: area.description,
            source: area.source,
            verification_status: area.verification_status,
            confirmation_count: area.confirmation_count,
            radius_meters: area.radius_meters,
            fillColor: colors.fill,
            strokeColor: colors.stroke,
            isSelected,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [area.center_lng!, area.center_lat!],
          },
        };
      }),
    };
  }, [areas, selectedAreaId]);
}

const styles = StyleSheet.create({
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: TufteTokens.borderRadius.subtle,
    borderWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
    maxWidth: 140,
    ...TufteTokens.shadows.subtle,
  },
  labelSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  labelText: {
    ...TufteTokens.typography.micro,
    color: '#374151',
    fontWeight: '600',
    flexShrink: 1,
  },
  labelTextSelected: {
    color: '#FFFFFF',
  },
  labelTextPending: {
    color: '#6B7280',
    fontWeight: '500',
  },
  officialDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2563EB',
  },
  confirmBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  confirmBadgeText: {
    ...TufteTokens.typography.micro,
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '600',
  },
});

export default RacingAreaCircleOverlay;
