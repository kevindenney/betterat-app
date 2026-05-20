/**
 * LocationPreviewMap (Native) — small static map showing a race location pin.
 *
 * MapLibre + OpenFreeMap Positron (clean light-gray basemap). Interactions
 * disabled — this is a non-interactive preview tile.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
} from '@maplibre/maplibre-react-native';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

interface LocationPreviewMapProps {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
}

export function LocationPreviewMap({ latitude, longitude, width, height }: LocationPreviewMapProps) {
  return (
    <View style={{ width, height, borderRadius: 8, overflow: 'hidden' }}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={StyleSheet.absoluteFill}
        dragPan={false}
        touchZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <MLCamera initialViewState={{ center: [longitude, latitude], zoom: 12 }} />
        <MLMarker id="location-preview" lngLat={[longitude, latitude]}>
          <View style={styles.pin} />
        </MLMarker>
      </MLMap>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5AC8FA',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
