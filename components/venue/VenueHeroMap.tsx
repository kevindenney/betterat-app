/**
 * VenueHeroMap
 *
 * MapLibre + OpenFreeMap hero map for venue screens. Racing areas display
 * as filled circles via RacingAreaCircleOverlay; community-feed posts pin
 * via MapPostMarkers.
 *
 * Lost capability vs the legacy react-native-maps version:
 * - onLongPress for manual pin placement — MapLibre RN doesn't expose a
 *   long-press event on the Map. Callers needing manual pin placement
 *   should adopt a button-driven flow ("Drop pin at center"). The
 *   `onMapLongPress` prop is still accepted but never fires.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  Platform,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  type CameraRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';
import { TufteTokens } from '@/constants/designSystem';
import { RacingAreaCircleOverlay } from './RacingAreaCircleOverlay';
import { UnknownAreaBanner } from './UnknownAreaPrompt';
import { MapPostMarkers } from './map/MapPostMarkers';
import type { VenueRacingArea } from '@/services/venue/CommunityVenueCreationService';
import type { FeedPost } from '@/types/community-feed';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export interface VenueHeroMapProps {
  venueName?: string;
  venueCountry?: string;
  center?: { latitude: number; longitude: number };
  racingAreas: VenueRacingArea[];
  selectedAreaId?: string | null;
  onAreaSelect?: (area: VenueRacingArea) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
  /** No-op on the new stack — MapLibre RN has no long-press event. */
  onMapLongPress?: (coords: { latitude: number; longitude: number }) => void;
  isInUnknownArea?: boolean;
  onCreateAreaPress?: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
  manualPinLocation?: { latitude: number; longitude: number } | null;
  onClearManualPin?: () => void;
  height?: number | string;
  showUserLocation?: boolean;
  showCompass?: boolean;
  showConditionsOverlay?: boolean;
  isLoading?: boolean;
  // Weather data (passed through for the deprecated fallback card path; safe to ignore).
  windSpeed?: number;
  windDirection?: string;
  windData?: number[];
  tideHeight?: number;
  tideState?: 'rising' | 'falling' | 'high' | 'low';
  tideData?: number[];
  currentSpeed?: number;
  currentData?: number[];
  discussionCount?: number;
  mapPinnedPosts?: FeedPost[];
  onPostMarkerPress?: (post: FeedPost) => void;
}

function zoomFromLatDelta(delta: number): number {
  if (!delta || delta <= 0) return 11;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

export function VenueHeroMap({
  center,
  racingAreas,
  selectedAreaId,
  onAreaSelect,
  onMapPress,
  isInUnknownArea = false,
  onCreateAreaPress,
  userLocation,
  manualPinLocation,
  onClearManualPin,
  height = 280,
  showUserLocation = true,
  isLoading = false,
  mapPinnedPosts,
  onPostMarkerPress,
}: VenueHeroMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initial center: explicit prop > first racing area > sensible default.
  const initialView = useMemo(() => {
    if (center) {
      return { lng: center.longitude, lat: center.latitude, zoom: 11 };
    }
    if (racingAreas.length > 0) {
      const first = racingAreas.find((a) => a.center_lat && a.center_lng);
      if (first) {
        return { lng: first.center_lng!, lat: first.center_lat!, zoom: 11 };
      }
    }
    return { lng: 114.17, lat: 22.3, zoom: 9 };
  }, [center, racingAreas]);

  // Animate to selected area when it changes.
  React.useEffect(() => {
    if (!mapReady || !selectedAreaId) return;
    const area = racingAreas.find((a) => a.id === selectedAreaId);
    if (!area?.center_lat || !area?.center_lng) return;
    const delta = (area.radius_meters || 2000) / 50000;
    cameraRef.current?.flyTo({
      center: [area.center_lng, area.center_lat],
      zoom: zoomFromLatDelta(delta),
      duration: 300,
    });
  }, [selectedAreaId, racingAreas, mapReady]);

  const fitAllAreas = useCallback(() => {
    const valid = racingAreas.filter((a) => a.center_lat && a.center_lng);
    if (valid.length === 0) return;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const a of valid) {
      if (a.center_lat! < minLat) minLat = a.center_lat!;
      if (a.center_lat! > maxLat) maxLat = a.center_lat!;
      if (a.center_lng! < minLng) minLng = a.center_lng!;
      if (a.center_lng! > maxLng) maxLng = a.center_lng!;
    }
    cameraRef.current?.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: { paddingTop: 50, paddingRight: 50, paddingBottom: 100, paddingLeft: 50 },
      duration: 400,
    });
  }, [racingAreas]);

  const handleMapPress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      const [lng, lat] = event.nativeEvent.lngLat;
      onMapPress?.({ latitude: lat, longitude: lng });
    },
    [onMapPress],
  );

  return (
    <View style={[styles.container, { height } as { height: number | string }]}>
      {Platform.OS === 'web' ? null : (
        <MLMap
          mapStyle={MAP_STYLE_URL}
          style={styles.map}
          onPress={handleMapPress}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <MLCamera
            ref={cameraRef}
            initialViewState={{
              center: [initialView.lng, initialView.lat],
              zoom: initialView.zoom,
            }}
          />

          <RacingAreaCircleOverlay
            areas={racingAreas}
            selectedAreaId={selectedAreaId}
            onAreaPress={onAreaSelect}
            showLabels
          />

          {mapPinnedPosts && mapPinnedPosts.length > 0 ? (
            <MapPostMarkers posts={mapPinnedPosts} onPostPress={onPostMarkerPress} />
          ) : null}

          {manualPinLocation ? (
            <MLMarker
              id="manual-pin"
              lngLat={[manualPinLocation.longitude, manualPinLocation.latitude]}
            >
              <View style={styles.manualPinContainer}>
                <View style={styles.manualPin}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.manualPinShadow} />
              </View>
            </MLMarker>
          ) : null}
        </MLMap>
      )}

      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : null}

      {isInUnknownArea && userLocation && onCreateAreaPress && !manualPinLocation ? (
        <View style={styles.unknownAreaBanner}>
          <UnknownAreaBanner
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            onPress={onCreateAreaPress}
          />
        </View>
      ) : null}

      {manualPinLocation && onCreateAreaPress ? (
        <View style={styles.manualPinBanner}>
          <Pressable style={styles.manualPinAction} onPress={onCreateAreaPress}>
            <View style={styles.manualPinActionIcon}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.manualPinActionText}>
              <Text style={styles.manualPinActionTitle}>Create Racing Area Here</Text>
              <Text style={styles.manualPinActionSubtitle}>
                {manualPinLocation.latitude.toFixed(4)}°, {manualPinLocation.longitude.toFixed(4)}°
              </Text>
            </View>
          </Pressable>
          {onClearManualPin ? (
            <Pressable style={styles.manualPinClear} onPress={onClearManualPin}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={fitAllAreas}>
          <Ionicons name="scan-outline" size={18} color="#374151" />
        </Pressable>

        {showUserLocation && userLocation ? (
          <Pressable
            style={styles.controlButton}
            onPress={() => {
              cameraRef.current?.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 14,
                duration: 300,
              });
            }}
          >
            <Ionicons name="navigate" size={18} color="#2563EB" />
          </Pressable>
        ) : null}
      </View>

      {racingAreas.length > 0 ? (
        <View style={styles.areaBadge}>
          <Text style={styles.areaBadgeText}>
            {racingAreas.length} area{racingAreas.length !== 1 ? 's' : ''}
          </Text>
        </View>
      ) : null}

      {racingAreas.length === 0 && !manualPinLocation && !isLoading ? (
        <View style={styles.hintBadge}>
          <Ionicons name="hand-left-outline" size={12} color="#6B7280" />
          <Text style={styles.hintText}>Tap to drop a pin</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Compact version for inline use. */
export function VenueHeroMapCompact(props: VenueHeroMapProps) {
  return <VenueHeroMap {...props} height={180} showCompass={false} />;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: TufteTokens.backgrounds.subtle,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    right: TufteTokens.spacing.standard,
    bottom: TufteTokens.spacing.standard,
    gap: TufteTokens.spacing.compact,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...TufteTokens.shadows.subtle,
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  areaBadge: {
    position: 'absolute',
    left: TufteTokens.spacing.standard,
    bottom: TufteTokens.spacing.standard,
    paddingHorizontal: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.tight,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: TufteTokens.borderRadius.subtle,
    ...TufteTokens.shadows.subtle,
  },
  areaBadgeText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontWeight: '600',
  },
  hintBadge: {
    position: 'absolute',
    left: TufteTokens.spacing.standard,
    bottom: TufteTokens.spacing.standard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.tight,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: TufteTokens.borderRadius.subtle,
    ...TufteTokens.shadows.subtle,
  },
  hintText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
  },
  unknownAreaBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TufteTokens.spacing.section + 40,
  },
  manualPinContainer: {
    alignItems: 'center',
  },
  manualPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...TufteTokens.shadows.subtle,
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  manualPinShadow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginTop: -4,
  },
  manualPinBanner: {
    position: 'absolute',
    left: TufteTokens.spacing.standard,
    right: TufteTokens.spacing.standard,
    bottom: TufteTokens.spacing.section + 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: TufteTokens.borderRadius.subtle,
    ...TufteTokens.shadows.subtle,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  manualPinAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: TufteTokens.spacing.standard,
    gap: TufteTokens.spacing.standard,
  },
  manualPinActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualPinActionText: {
    flex: 1,
    gap: 2,
  },
  manualPinActionTitle: {
    ...TufteTokens.typography.secondary,
    fontWeight: '600',
    color: '#111827',
  },
  manualPinActionSubtitle: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  manualPinClear: {
    padding: TufteTokens.spacing.standard,
    borderLeftWidth: TufteTokens.borders.hairline,
    borderLeftColor: TufteTokens.borders.colorSubtle,
  },
});

export default VenueHeroMap;
