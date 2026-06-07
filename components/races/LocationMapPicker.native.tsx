/**
 * LocationMapPicker - Native Implementation
 *
 * Full-screen modal for selecting race location on a map.
 * - Tap to place pin (racing area center)
 * - Search bar with venue autocomplete
 * - Quick select from recent venues
 *
 * Uses react-native-maps (requires development build, not Expo Go)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Linking,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MapPin, Search, Navigation, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { GeocodingService } from '@/services/GeocodingService';
import { createLogger } from '@/lib/utils/logger';
import { IOS_COLORS } from '@/components/cards/constants';
import type { RaceType } from './RaceTypeSelector';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  type CameraRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';

// OpenFreeMap "Liberty" — fully free, no API key, community-funded. We can
// swap in MapTiler / Stadia later by changing this URL.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const mapsAvailable = true;

const logger = createLogger('LocationMapPicker');

// =============================================================================
// TYPES
// =============================================================================

export interface LocationMapPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: { name: string; lat: number; lng: number }) => void;
  raceType?: RaceType;
  initialLocation?: { lat: number; lng: number } | null;
  initialName?: string;
}

interface VenueLocation {
  name: string;
  lat: number;
  lng: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CENTER = { lat: 22.3193, lng: 114.1694 }; // Hong Kong
const RECENT_VENUES_KEY = 'regattaflow_recent_venues';

// =============================================================================
// COMPONENT
// =============================================================================

export function LocationMapPicker({
  visible,
  onClose,
  onSelectLocation,
  raceType = 'fleet',
  initialLocation,
  initialName = '',
}: LocationMapPickerProps) {
  const cameraRef = useRef<CameraRef>(null);
  const insets = useSafeAreaInsets();

  // State
  const [selectedLocation, setSelectedLocation] = useState<VenueLocation | null>(
    initialLocation ? { name: initialName, lat: initialLocation.lat, lng: initialLocation.lng } : null
  );
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<VenueLocation[]>([]);
  const [recentVenues, setRecentVenues] = useState<VenueLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Load recent venues on mount
  useEffect(() => {
    loadRecentVenues();
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedLocation(
        initialLocation ? { name: initialName, lat: initialLocation.lat, lng: initialLocation.lng } : null
      );
      setSearchText(initialName);
      setShowSearchResults(false);
    }
  }, [visible, initialLocation, initialName]);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  const loadRecentVenues = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_VENUES_KEY);
      if (stored) {
        const venues = JSON.parse(stored) as VenueLocation[];
        setRecentVenues(venues.slice(0, 5));
      }
      // No hardcoded defaults: Quick Select stays empty until the user has
      // actually picked somewhere. Search + map-tap cover first-time discovery.
    } catch (e) {
      setRecentVenues([]);
    }
  };

  const saveToRecentVenues = useCallback(async (venue: VenueLocation) => {
    try {
      const current = [...recentVenues];
      // Remove if exists
      const filtered = current.filter(
        (v) => v.name.toLowerCase() !== venue.name.toLowerCase()
      );
      // Add to front
      const updated = [venue, ...filtered].slice(0, 5);
      setRecentVenues(updated);
      await AsyncStorage.setItem(RECENT_VENUES_KEY, JSON.stringify(updated));
    } catch (e) {
      logger.warn('Failed to save recent venue:', e);
    }
  }, [recentVenues]);

  // =============================================================================
  // SEARCH
  // =============================================================================

  const searchVenues = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);

    try {
      // Query database
      const { data, error } = await supabase
        .from('sailing_venues')
        .select('id, name, coordinates_lat, coordinates_lng')
        .ilike('name', `%${query}%`)
        .limit(8);

      if (error) throw error;

      const dbResults: VenueLocation[] = (data || [])
        .filter((v: any) => v.coordinates_lat && v.coordinates_lng)
        .map((v: any) => ({
          name: v.name,
          lat: v.coordinates_lat,
          lng: v.coordinates_lng,
        }));

      // Our venues table only knows sailing spots we've seeded. Augment the
      // typeahead with a Nominatim place search so common named places (yacht
      // clubs, marinas, landmarks) resolve too. DB hits rank first; geocoded
      // places fill the rest, deduped by name.
      const placeResults = await GeocodingService.searchPlaces(query, 6);
      const seen = new Set(dbResults.map((v) => v.name.toLowerCase()));
      const merged = [...dbResults];
      for (const p of placeResults) {
        const key = p.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(p);
      }

      setSearchResults(merged.slice(0, 8));
    } catch (e) {
      logger.warn('Venue search failed:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchText.length >= 2) {
        searchVenues(searchText);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText, searchVenues]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleMapPress = useCallback((event: NativeSyntheticEvent<PressEvent>) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    const fallbackName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    // Show the coordinate-based name immediately, then upgrade asynchronously
    // when Nominatim returns a real venue name. Race-safe: only upgrade if
    // the user hasn't picked a different point in the meantime.
    setSelectedLocation({ name: fallbackName, lat, lng });
    setSearchText('');
    setShowSearchResults(false);
    Keyboard.dismiss();
    void GeocodingService.reverseGeocode(lat, lng).then((name) => {
      if (!name) return;
      setSelectedLocation((current) => {
        if (!current) return current;
        if (current.lat !== lat || current.lng !== lng) return current;
        return { ...current, name };
      });
    });
  }, []);

  const handleSelectVenue = useCallback((venue: VenueLocation) => {
    setSelectedLocation(venue);
    setSearchText(venue.name);
    setShowSearchResults(false);
    Keyboard.dismiss();

    // Animate map to location via Camera ref
    cameraRef.current?.flyTo({
      center: [venue.lng, venue.lat],
      zoom: 11,
      duration: 600,
    });
  }, []);

  // Press "search" on the keyboard to commit. If a known venue matched, take
  // the top hit; otherwise forward-geocode the free text so any place the user
  // names resolves to a pin (and enables Done) without a manual map tap.
  const handleSearchSubmit = useCallback(async () => {
    const query = searchText.trim();
    if (!query) return;
    if (searchResults.length > 0) {
      handleSelectVenue(searchResults[0]);
      return;
    }
    setSearching(true);
    try {
      const coords = await GeocodingService.geocode(query);
      if (coords) {
        handleSelectVenue({ name: query, lat: coords.lat, lng: coords.lng });
      }
    } finally {
      setSearching(false);
    }
  }, [searchText, searchResults, handleSelectVenue]);

  const handleConfirm = useCallback(() => {
    if (selectedLocation) {
      saveToRecentVenues(selectedLocation);
      onSelectLocation(selectedLocation);
    }
    onClose();
  }, [selectedLocation, saveToRecentVenues, onSelectLocation, onClose]);

  const handleUseCurrentLocation = useCallback(async () => {
    // TODO: Implement geolocation
    // For now, just use default center
    handleSelectVenue({
      name: 'Current Location',
      lat: DEFAULT_CENTER.lat,
      lng: DEFAULT_CENTER.lng,
    });
  }, [handleSelectVenue]);

  const handleContactSupport = useCallback(() => {
    const subject = encodeURIComponent('Location Map Unavailable');
    const body = encodeURIComponent(
      `Location picker map is unavailable on this build.\n\n` +
      `Race type: ${raceType}\n` +
      `Platform: ${Platform.OS}\n` +
      `Maps module available: ${mapsAvailable ? 'yes' : 'no'}`
    );
    const mailtoUrl = `mailto:support@regattaflow.com?subject=${subject}&body=${body}`;
    Linking.openURL(mailtoUrl).catch((error) => {
      logger.warn('Failed to open support email:', error);
    });
  }, [raceType]);

  // =============================================================================
  // RENDER
  // =============================================================================

  const initialCenter: [number, number] = [
    initialLocation?.lng ?? DEFAULT_CENTER.lng,
    initialLocation?.lat ?? DEFAULT_CENTER.lat,
  ];

  // Fallback when maps not available
  if (!mapsAvailable) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={IOS_COLORS.label} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Location</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.fallbackContainer}>
            <MapPin size={48} color={IOS_COLORS.gray} />
            <Text style={styles.fallbackTitle}>Map Unavailable</Text>
            <Text style={styles.fallbackText}>
              Native maps require a development build.
            </Text>
            <Text style={styles.fallbackText}>
              Select from venues below:
            </Text>
            <View style={styles.fallbackActions}>
              <TouchableOpacity style={styles.fallbackActionButton} onPress={handleContactSupport}>
                <Text style={styles.fallbackActionText}>Contact Support</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fallbackVenueList}>
              {recentVenues
                .filter((venue, index, self) =>
                  index === self.findIndex(v => v.name.toLowerCase() === venue.name.toLowerCase())
                )
                .slice(0, 6)
                .map((venue, i) => (
                <TouchableOpacity
                  key={`${venue.name}-${i}`}
                  style={styles.venueItem}
                  onPress={() => {
                    onSelectLocation(venue);
                    onClose();
                  }}
                >
                  <MapPin size={16} color={IOS_COLORS.blue} />
                  <Text style={styles.venueItemText}>{venue.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header - separate View with explicit zIndex to ensure touch handling */}
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.6}
            >
              <X size={24} color={IOS_COLORS.label} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Location</Text>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.doneButton, !selectedLocation && styles.doneButtonDisabled]}
              disabled={!selectedLocation}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.6}
            >
              <Text style={[styles.doneButtonText, !selectedLocation && styles.doneButtonTextDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color={IOS_COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search venues..."
              placeholderTextColor={IOS_COLORS.gray}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              onFocus={() => searchText.length >= 2 && setShowSearchResults(true)}
            />
            {searching && <ActivityIndicator size="small" color={IOS_COLORS.blue} />}
          </View>

          {/* Current Location Button */}
          <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation}>
            <Navigation size={20} color={IOS_COLORS.blue} />
          </TouchableOpacity>
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectVenue(item)}
                >
                  <MapPin size={16} color={IOS_COLORS.blue} />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultCoords}>
                      {item.lat.toFixed(3)}°, {item.lng.toFixed(3)}°
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <View style={styles.mapContainer}>
          <MLMap
            mapStyle={MAP_STYLE_URL}
            style={styles.map}
            onPress={handleMapPress}
          >
            <MLCamera
              ref={cameraRef}
              initialViewState={{
                center: initialCenter,
                zoom: 10,
              }}
            />
            {selectedLocation && (
              <MLMarker
                id="selected"
                lngLat={[selectedLocation.lng, selectedLocation.lat]}
              >
                <View style={styles.mapPin}>
                  <MapPin size={28} color={IOS_COLORS.blue} fill={IOS_COLORS.blue} />
                </View>
              </MLMarker>
            )}
          </MLMap>

          {/* Selected Location Badge */}
          {selectedLocation && (
            <View style={styles.selectedBadge}>
              <Check size={14} color={IOS_COLORS.green} />
              <Text style={styles.selectedBadgeText} numberOfLines={1}>
                {selectedLocation.name}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Select */}
        {!showSearchResults && recentVenues.length > 0 && (
          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectTitle}>QUICK SELECT</Text>
            <FlatList
              data={recentVenues}
              keyExtractor={(item, index) => `recent-${item.name}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickSelectList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.quickSelectItem,
                    selectedLocation?.name === item.name && styles.quickSelectItemSelected,
                  ]}
                  onPress={() => handleSelectVenue(item)}
                >
                  <MapPin
                    size={14}
                    color={selectedLocation?.name === item.name ? IOS_COLORS.blue : IOS_COLORS.gray}
                  />
                  <Text
                    style={[
                      styles.quickSelectItemText,
                      selectedLocation?.name === item.name && styles.quickSelectItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Tap Hint */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Search, or tap the map to drop a pin
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  headerWrapper: {
    backgroundColor: IOS_COLORS.systemBackground,
    zIndex: 1000,
    elevation: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
    backgroundColor: IOS_COLORS.systemBackground,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 11,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    width: 44,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 11,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  doneButtonTextDisabled: {
    color: IOS_COLORS.gray,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: IOS_COLORS.systemBackground,
    zIndex: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
  },
  locationButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 10,
  },

  // Search Results
  searchResultsContainer: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    maxHeight: 200,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  searchResultCoords: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedBadgeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },

  // Quick Select
  quickSelectContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
  },
  quickSelectTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickSelectList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  quickSelectItemSelected: {
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
  },
  quickSelectItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
    maxWidth: 150,
  },
  quickSelectItemTextSelected: {
    color: IOS_COLORS.blue,
  },

  // Hint
  hintContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  hintText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },

  // Fallback
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 16,
  },
  fallbackText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: 8,
  },
  fallbackActions: {
    marginTop: 16,
    width: '100%',
  },
  fallbackActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.gray4,
  },
  fallbackActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  fallbackVenueList: {
    marginTop: 24,
    width: '100%',
  },
  venueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 10,
    marginBottom: 8,
  },
  venueItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
});

export default LocationMapPicker;
