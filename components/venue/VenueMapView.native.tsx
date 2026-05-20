/**
 * VenueMapView Component - Native Implementation
 *
 * MapLibre + OpenFreeMap world map of sailing venues with built-in MapLibre
 * clustering (no external clustering library). Venues render as colored
 * circle dots when zoomed out (one CircleLayer for all points), and when
 * zoomed in the same layer keeps them tappable. The yacht-club layer
 * shares the same source.
 *
 * Lost capability vs the legacy super-cluster + react-native-maps version:
 * - Custom React View markers with Ionicons inside — replaced with native
 *   MapLibre CircleLayer styling. The trophy/star/boat icons that used to
 *   sit inside the marker pin are dropped; color still encodes venue type.
 *   Re-add later by switching to a SymbolLayer with sprite-based icons if
 *   we want the original look back.
 * - onMarkerPress relies on tap-on-feature: we resolve the pressed venue
 *   from MLMap's onPress event via queryRenderedFeaturesAtPoint.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/services/supabase';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

interface Venue {
  id: string;
  name: string;
  country: string;
  region: string;
  venue_type: string;
  coordinates_lat: number;
  coordinates_lng: number;
}

interface YachtClub {
  id: string;
  name: string;
  short_name?: string;
  coordinates_lat: number;
  coordinates_lng: number;
  prestige_level?: string;
  venue_id?: string;
}

export interface VenueMapViewProps {
  currentVenue?: Venue | null;
  onMarkerPress?: (venue: Venue) => void;
  showAllVenues?: boolean;
  selectedVenue?: Venue | null;
  showOnlySavedVenues?: boolean;
  savedVenueIds?: Set<string>;
  is3DEnabled?: boolean;
  mapLayers?: {
    yachtClubs?: boolean;
    sailmakers?: boolean;
    riggers?: boolean;
    coaches?: boolean;
    chandlery?: boolean;
    clothing?: boolean;
    marinas?: boolean;
    repair?: boolean;
    engines?: boolean;
  };
}

function venueColor(venueType: string): string {
  switch (venueType) {
    case 'championship':
      return '#ffc107';
    case 'premier':
      return '#007AFF';
    case 'regional':
      return '#666';
    default:
      return '#007AFF';
  }
}

function zoomFromLatDelta(delta: number): number {
  if (!delta || delta <= 0) return 11;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

export function VenueMapView({
  currentVenue,
  onMarkerPress,
  showAllVenues = false,
  selectedVenue,
  showOnlySavedVenues = false,
  savedVenueIds = new Set(),
  mapLayers = {},
}: VenueMapViewProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [yachtClubs, setYachtClubs] = useState<YachtClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('sailing_venues')
          .select('id, name, country, region, venue_type, coordinates_lat, coordinates_lng')
          .order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setVenues(data || []);
      } catch {
        // empty list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapLayers.yachtClubs) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('yacht_clubs')
          .select('id, name, short_name, coordinates_lat, coordinates_lng, prestige_level, venue_id')
          .not('coordinates_lat', 'is', null)
          .not('coordinates_lng', 'is', null)
          .order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setYachtClubs(data || []);
      } catch {
        // empty list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapLayers.yachtClubs]);

  // Fly to the current/selected venue.
  useEffect(() => {
    const target = selectedVenue || currentVenue;
    if (!target) return;
    cameraRef.current?.flyTo({
      center: [target.coordinates_lng, target.coordinates_lat],
      zoom: zoomFromLatDelta(0.08),
      duration: 500,
    });
  }, [currentVenue, selectedVenue]);

  const displayVenues = useMemo(() => {
    if (showOnlySavedVenues && savedVenueIds.size > 0) {
      return venues.filter((v) => savedVenueIds.has(v.id));
    }
    if (showAllVenues) return venues;
    if (currentVenue) return [currentVenue];
    return [];
  }, [venues, showAllVenues, currentVenue, showOnlySavedVenues, savedVenueIds]);

  const venueFeatureCollection = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: displayVenues.map((v) => ({
        type: 'Feature' as const,
        properties: {
          venueId: v.id,
          venue_type: v.venue_type,
          color: venueColor(v.venue_type),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [v.coordinates_lng, v.coordinates_lat],
        },
      })),
    };
  }, [displayVenues]);

  const yachtClubFeatureCollection = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: yachtClubs.map((c) => ({
        type: 'Feature' as const,
        properties: {
          clubId: c.id,
          venueId: c.venue_id,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [c.coordinates_lng, c.coordinates_lat],
        },
      })),
    };
  }, [yachtClubs]);

  const initialCenter: [number, number] = currentVenue
    ? [currentVenue.coordinates_lng, currentVenue.coordinates_lat]
    : [114.1628, 22.2793];
  const initialZoom = currentVenue ? 11 : 2;

  const handleMapPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const features = event.nativeEvent.features ?? [];
    const venueFeature = features.find((f) => f.properties?.venueId);
    if (!venueFeature) return;
    const venueId = venueFeature.properties?.venueId as string;
    const club = !venueId
      ? features.find((f) => f.properties?.clubId)?.properties?.venueId
      : null;
    const targetId = venueId || club;
    if (!targetId) return;
    const venue = venues.find((v) => v.id === targetId);
    if (venue && onMarkerPress) onMarkerPress(venue);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Loading venues...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MLMap mapStyle={MAP_STYLE_URL} style={styles.map} onPress={handleMapPress}>
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: initialCenter, zoom: initialZoom }}
        />

        <MLGeoJSONSource
          id="venues-source"
          data={venueFeatureCollection}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
        >
          {/* Cluster circles (filled when point_count exists) */}
          <MLLayer
              type="circle"
            id="venue-clusters"
            source="venues-source"
            filter={['has', 'point_count']}
            style={{
              circleColor: '#3b82f6',
              circleRadius: ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
            }}
          />
          {/* Cluster count labels */}
          <MLLayer
              type="symbol"
            id="venue-cluster-counts"
            source="venues-source"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 12,
              textColor: '#FFFFFF',
              textHaloColor: 'rgba(0,0,0,0.4)',
              textHaloWidth: 1,
            }}
          />
          {/* Individual venue points */}
          <MLLayer
              type="circle"
            id="venue-points"
            source="venues-source"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: ['get', 'color'],
              circleRadius: 6,
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
            }}
          />
        </MLGeoJSONSource>

        {mapLayers.yachtClubs ? (
          <MLGeoJSONSource id="yacht-clubs-source" data={yachtClubFeatureCollection}>
            <MLLayer
              type="circle"
              id="yacht-club-points"
              source="yacht-clubs-source"
              style={{
                circleColor: '#34c759',
                circleRadius: 5,
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: 1.5,
              }}
            />
          </MLGeoJSONSource>
        ) : null}
      </MLMap>

      {showAllVenues ? (
        <View style={styles.counterOverlay}>
          <Text style={styles.counterText}>
            {showOnlySavedVenues
              ? `${displayVenues.length} saved venue${displayVenues.length !== 1 ? 's' : ''}`
              : `${venues.length} venues worldwide`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default VenueMapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748B',
  },
  counterOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  counterText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});
