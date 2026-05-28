/**
 * OrgLocationsMap — read-only mini-map for an organization's sites.
 *
 * Renders all rows from `organization_locations` as labelled markers on
 * a small MapLibre canvas with auto-fit-to-bounds. Used on the org
 * detail page so a member or visitor can see the institution's
 * geography at a glance (e.g. Johns Hopkins School of Nursing's six
 * Baltimore sites).
 *
 * Web and native share the same component contract; the native side
 * uses @maplibre/maplibre-react-native and the web side falls through
 * to the platform-split `.web.tsx` companion below.
 */

import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Camera as MLCamera,
  Map as MLMap,
  Marker as MLMarker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface OrgLocation {
  id?: string;
  name: string;
  lat: number;
  lng: number;
}

export interface OrgLocationsMapProps {
  locations: OrgLocation[];
  /** Pixel height of the map area. Default 220. */
  height?: number;
}

/**
 * Compute the center + reasonable zoom that fits all locations. Uses
 * the bounding box's longest side to pick zoom; a small padding factor
 * makes sure the edge markers don't sit flush against the frame.
 */
function fitBounds(locs: OrgLocation[]): {
  center: [number, number];
  zoom: number;
} {
  if (locs.length === 0) return { center: [114.17, 22.3], zoom: 11 };
  if (locs.length === 1) return { center: [locs[0].lng, locs[0].lat], zoom: 14 };
  let minLat = locs[0].lat;
  let maxLat = locs[0].lat;
  let minLng = locs[0].lng;
  let maxLng = locs[0].lng;
  for (const l of locs) {
    if (l.lat < minLat) minLat = l.lat;
    if (l.lat > maxLat) maxLat = l.lat;
    if (l.lng < minLng) minLng = l.lng;
    if (l.lng > maxLng) maxLng = l.lng;
  }
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const spanLng = Math.max(maxLng - minLng, 0.001);
  const spanLat = Math.max(maxLat - minLat, 0.001);
  // World ≈ 360° at zoom 0 → each zoom doubles resolution. Aim to fit
  // the longer span in ~70% of the visible canvas (rough heuristic).
  const span = Math.max(spanLng, spanLat * 1.6);
  const zoom = Math.max(3, Math.min(16, Math.log2(360 / span) - 0.5));
  return { center, zoom };
}

export function OrgLocationsMap({ locations, height = 220 }: OrgLocationsMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const { center, zoom } = useMemo(() => fitBounds(locations), [locations]);

  if (locations.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No mapped locations yet.</Text>
      </View>
    );
  }

  // Web has its own MapLibre integration path via the .web.tsx
  // companion. On native render the MapLibre RN bridge directly.
  if (Platform.OS === 'web') {
    // The .web.tsx variant ships maplibre-gl directly. Fallback here
    // is just an empty container so the bundle still resolves.
    return <View style={[styles.empty, { height }]} />;
  }

  return (
    <View style={[styles.container, { height }]}>
      <MLMap mapStyle={MAP_STYLE_URL} style={styles.fill} attribution={false} logo={false}>
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center, zoom }}
        />
        {locations.map((loc) => (
          <MLMarker
            key={loc.id ?? `${loc.lat}:${loc.lng}`}
            id={`org-loc-${loc.id ?? `${loc.lat}-${loc.lng}`}`}
            coordinate={[loc.lng, loc.lat]}
          >
            <View style={styles.marker}>
              <View style={styles.markerDot} />
              <Text style={styles.markerLabel} numberOfLines={1}>
                {loc.name}
              </Text>
            </View>
          </MLMarker>
        ))}
      </MLMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E9EEF4',
  },
  fill: { flex: 1 },
  empty: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#E9EEF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.65)',
  },
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 8,
    paddingLeft: 4,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7893C',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.92)',
    letterSpacing: -0.1,
    maxWidth: 140,
  },
});
