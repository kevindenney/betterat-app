/**
 * RaceMapCard — race-detail hero map.
 *
 * Renders the race area on MapLibre/OpenFreeMap with the course overlay
 * (start line, marks, path, finish) plus Wind/Current arrow grids that the
 * user can toggle. Replaces the legacy react-native-maps + custom layer
 * system; dead toggles (waves/depth/laylines/strategy) and the 3D pitch
 * camera trick are dropped — they had UI but no real data backing them.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Map as MLMap, Camera as MLCamera, type CameraRef } from '@maplibre/maplibre-react-native';
import { Card } from '@/components/race-ui/Card';
import { Typography, Spacing, BorderRadius, colors } from '@/constants/designSystem';
import { MapControlButton } from './MapControlButton';
import { LayerToggle } from './LayerToggle';
import { CourseOverlay } from './CourseOverlay';
import { WindOverlay } from './WindOverlay';
import { CurrentOverlay } from './CurrentOverlay';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Course {
  startLine: { latitude: number; longitude: number }[];
  finishLine?: { latitude: number; longitude: number }[];
  marks: {
    id?: string;
    coordinate: { latitude: number; longitude: number };
    name?: string;
    type?: string | null;
    sequence?: number;
    rounding?: string | null;
  }[];
  path: { latitude: number; longitude: number }[];
}

interface WindConditions {
  speed: number;
  direction: number;
  gusts?: number;
}

interface CurrentConditions {
  speed: number;
  direction: number;
  strength: 'slack' | 'moderate' | 'strong';
}

interface RaceMapCardProps {
  mapRegion: Region;
  course?: Course;
  windConditions?: WindConditions;
  currentConditions?: CurrentConditions;
  onCenterPress?: () => void;
  onFullscreenPress?: () => void;
}

function zoomFromLatDelta(delta: number): number {
  // 360 / 2^zoom ≈ delta, so zoom ≈ log2(360/delta).
  if (!delta || delta <= 0) return 13;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

export const RaceMapCard: React.FC<RaceMapCardProps> = ({
  mapRegion,
  course,
  windConditions,
  currentConditions,
  onCenterPress,
  onFullscreenPress,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapLayers, setMapLayers] = useState({ wind: true, current: true });
  const cameraRef = useRef<CameraRef>(null);

  const toggleExpand = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsExpanded((prev) => !prev);
  };

  const centerOnVenue = () => {
    cameraRef.current?.flyTo({
      center: [mapRegion.longitude, mapRegion.latitude],
      zoom: zoomFromLatDelta(mapRegion.latitudeDelta),
      duration: 500,
    });
    onCenterPress?.();
  };

  const handleFullscreen = () => {
    onFullscreenPress?.();
  };

  const toggleLayer = (layer: keyof typeof mapLayers) => {
    setMapLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <Card style={styles.container} size="medium">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="map" size={16} color={colors.primary[600]} />
          <Text style={styles.title}>Race Area Map</Text>
        </View>

        <Pressable onPress={toggleExpand} hitSlop={8}>
          <Ionicons
            name={isExpanded ? 'contract' : 'expand'}
            size={16}
            color={colors.text.secondary}
          />
        </Pressable>
      </View>

      {/* Map Container */}
      <View
        style={[
          styles.mapContainer,
          isExpanded && styles.mapContainerExpanded,
        ]}
      >
        {Platform.OS === 'web' ? (
          <View style={styles.webPlaceholder}>
            <Ionicons name="map-outline" size={40} color={colors.text.tertiary} />
            <Text style={styles.webPlaceholderText}>
              Interactive map available on mobile app
            </Text>
            <Text style={styles.webPlaceholderSubtext}>
              Download the iOS or Android app to view race area maps with live overlays
            </Text>
          </View>
        ) : (
          <>
            <MLMap mapStyle={MAP_STYLE_URL} style={styles.map}>
              <MLCamera
                ref={cameraRef}
                initialViewState={{
                  center: [mapRegion.longitude, mapRegion.latitude],
                  zoom: zoomFromLatDelta(mapRegion.latitudeDelta),
                }}
              />
              {course ? <CourseOverlay course={course} /> : null}
              {mapLayers.wind && windConditions ? (
                <WindOverlay conditions={windConditions} region={mapRegion} />
              ) : null}
              {mapLayers.current && currentConditions ? (
                <CurrentOverlay conditions={currentConditions} region={mapRegion} />
              ) : null}
            </MLMap>

            {/* Map Controls — top-right */}
            <View style={styles.mapControls}>
              <MapControlButton
                icon="locate"
                onPress={centerOnVenue}
                tooltip="Center on venue"
              />
              <MapControlButton
                icon="expand"
                onPress={handleFullscreen}
                tooltip="Fullscreen"
              />
            </View>
          </>
        )}
      </View>

      {/* Layer Toggles */}
      <View style={styles.layerToggles}>
        <Text style={styles.layerLabel}>MAP LAYERS</Text>
        <View style={styles.toggleRow}>
          <LayerToggle
            icon="cloudy-outline"
            label="Wind"
            isActive={mapLayers.wind}
            onToggle={() => toggleLayer('wind')}
            color={colors.wind}
          />
          <LayerToggle
            icon="water-outline"
            label="Current"
            isActive={mapLayers.current}
            onToggle={() => toggleLayer('current')}
            color={colors.current}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  title: {
    ...Typography.h3,
    fontSize: 13,
    color: colors.text.primary,
  },
  mapContainer: {
    height: 180,
    borderRadius: BorderRadius.small,
    overflow: 'hidden',
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  mapContainerExpanded: {
    height: 380,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 6,
    right: 6,
    gap: Spacing.xs,
  },
  layerToggles: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  layerLabel: {
    ...Typography.captionBold,
    color: colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  webPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  webPlaceholderText: {
    ...Typography.h3,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  webPlaceholderSubtext: {
    ...Typography.body,
    fontSize: 11,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
