/**
 * AddVenueMapNative - Native implementation
 *
 * MapLibre + OpenFreeMap "Liberty" venue picker for iOS/Android.
 * Shows existing venues and allows tapping to place a new venue marker.
 * No Google Maps API key — uses OSM-based vector tiles.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  type CameraRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';
import { supabase } from '@/services/supabase';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// Continental US view — matches the legacy "show me sailing in the world" start.
const INITIAL_CENTER: [number, number] = [-95, 40];
const INITIAL_ZOOM = 3;

interface Venue {
  id: string;
  name: string;
  coordinates_lat: number;
  coordinates_lng: number;
  venue_type: string;
}

interface AddVenueMapNativeProps {
  selectedLocation: { lat: number; lng: number } | null;
  onLocationSelect: (lat: number, lng: number) => void;
  searchQuery?: string;
}

function venueTypeColor(venueType: string): string {
  switch (venueType) {
    case 'championship':
      return '#ffc107';
    case 'premier':
      return '#007AFF';
    default:
      return '#8e8e93';
  }
}

export function AddVenueMapNative({
  selectedLocation,
  onLocationSelect,
  searchQuery,
}: AddVenueMapNativeProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSearchRef = useRef<string>('');

  // Fetch existing venues
  useEffect(() => {
    async function fetchVenues() {
      try {
        const { data, error } = await supabase
          .from('sailing_venues')
          .select('id, name, coordinates_lat, coordinates_lng, venue_type')
          .not('coordinates_lat', 'is', null)
          .not('coordinates_lng', 'is', null);

        if (!error && data) {
          setVenues(data);
        }
      } catch {
        // Silent error
      } finally {
        setLoading(false);
      }
    }

    fetchVenues();
  }, []);

  // Handle map press → forward as selected location
  const handleMapPress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      const [lng, lat] = event.nativeEvent.lngLat;
      onLocationSelect(lat, lng);
    },
    [onLocationSelect],
  );

  // Animate to selected location
  useEffect(() => {
    if (!selectedLocation) return;
    cameraRef.current?.flyTo({
      center: [selectedLocation.lng, selectedLocation.lat],
      zoom: 11,
      duration: 400,
    });
  }, [selectedLocation]);

  // Geocode the search query and pan to the result
  useEffect(() => {
    if (!searchQuery) return;
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 3 || trimmedQuery === lastSearchRef.current) return;

    const timeoutId = setTimeout(async () => {
      lastSearchRef.current = trimmedQuery;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmedQuery)}&limit=1`,
          {
            headers: {
              'User-Agent': 'BetterAt/1.0 (https://better.at)',
            },
          },
        );
        if (response.ok) {
          const results = await response.json();
          if (results && results.length > 0) {
            const { lat, lon } = results[0];
            cameraRef.current?.flyTo({
              center: [parseFloat(lon), parseFloat(lat)],
              zoom: 8,
              duration: 600,
            });
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Geocoding failed:', err);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={styles.map}
        onPress={handleMapPress}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }}
        />

        {/* Existing venue markers */}
        {venues.map((venue) => (
          <MLMarker
            key={venue.id}
            id={`venue-${venue.id}`}
            lngLat={[venue.coordinates_lng, venue.coordinates_lat]}
          >
            <View
              style={[
                styles.venuePin,
                { backgroundColor: venueTypeColor(venue.venue_type) },
              ]}
            />
          </MLMarker>
        ))}

        {/* New venue location marker */}
        {selectedLocation && (
          <MLMarker
            id="new-venue"
            lngLat={[selectedLocation.lng, selectedLocation.lat]}
          >
            <View style={styles.newVenueMarker}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
          </MLMarker>
        )}
      </MLMap>
    </View>
  );
}

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
    backgroundColor: '#f8f9fa',
  },
  venuePin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    opacity: 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  newVenueMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 6,
  },
});

export default AddVenueMapNative;
