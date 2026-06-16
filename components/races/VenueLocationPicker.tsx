/**
 * Venue Location Picker
 * Hybrid text + map interface for selecting racing area location
 *
 * Features:
 * - Text input with venue autocomplete
 * - Optional "Refine on Map" for precision
 * - Stores both venue name and exact coordinates
 * - Used for accurate weather forecasting
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { fontFamily } from '@/lib/design-tokens-editorial';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VenueLocation {
  name: string;
  lat: number;
  lng: number;
}

interface VenueLocationPickerProps {
  value: string; // Venue name
  onChangeText: (name: string) => void;
  coordinates: { lat: number; lng: number } | null;
  onCoordinatesChange: (coords: { lat: number; lng: number } | null) => void;
  placeholder?: string;
}

const logger = createLogger('VenueLocationPicker');
const VENUE_CACHE_KEY = 'regattaflow_venue_cache_v1';
const VENUE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

// Web-only map component using Leaflet
function VenueMapWeb({
  coordinates,
  value: _value,
  onMapClick,
  showMap,
}: {
  coordinates: { lat: number; lng: number } | null;
  value: string;
  onMapClick: (lat: number, lng: number) => void;
  showMap: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!showMap || Platform.OS !== 'web') return;
    
    // Wait for ref to be set
    if (typeof window === 'undefined' || !mapContainerRef.current) {
      // Try again after a short delay
      const timeout = setTimeout(() => {
        if (mapContainerRef.current) {
          // Trigger re-run by updating a state or force re-render
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    let isMounted = true;

    const loadLeaflet = async () => {
      try {
        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Load Leaflet JS
        if (!(window as any).L) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = resolve;
            script.onerror = () => {
              logger.error('Failed to load Leaflet script');
              reject(new Error('Leaflet script failed to load'));
            };
            document.head.appendChild(script);
          });
        }

        if (!isMounted || !mapContainerRef.current) return;

        const L = (window as any).L;
        if (!L) {
          logger.error('Leaflet failed to load');
          return;
        }

        // Initialize map
        const initialLat = coordinates?.lat || 22.3193;
        const initialLng = coordinates?.lng || 114.1694;

        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(mapRef.current);

          // Add initial marker if coordinates exist
          if (coordinates) {
            markerRef.current = L.marker([initialLat, initialLng]).addTo(mapRef.current);
          }

          // Handle map clicks
          mapRef.current.on('click', (e: any) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            if (markerRef.current) {
              markerRef.current.setLatLng([lat, lng]);
            } else {
              markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
            }

            onMapClick(lat, lng);
          });
        } else {
          // Update map view if coordinates changed
          mapRef.current.setView([initialLat, initialLng], 13);
          if (markerRef.current) {
            markerRef.current.setLatLng([initialLat, initialLng]);
          }
        }
      } catch (error) {
        logger.error('Failed to load Leaflet map:', error);
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMap, coordinates, onMapClick]);

  if (Platform.OS !== 'web') return null;

  // For React Native Web, we need to use a View that will render as a div
  // The ref will work correctly on web
  return (
    <View
      ref={mapContainerRef as any}
      style={{ width: '100%', height: '100%', minHeight: 400 }}
    />
  );
}

export function VenueLocationPicker({
  value,
  onChangeText,
  coordinates,
  onCoordinatesChange,
  placeholder = 'Enter venue name...',
}: VenueLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const [showMap, setShowMap] = useState(false);
  const [venueSuggestions, setVenueSuggestions] = useState<VenueLocation[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cachedVenues, setCachedVenues] = useState<VenueLocation[]>([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const cachedVenuesRef = useRef<VenueLocation[]>([]);
  
  // Handle map clicks
  const handleMapClick = useCallback((lat: number, lng: number) => {
    onCoordinatesChange({ lat, lng });
    // Try to find a venue name for these coordinates
    const matchingVenue = venueSuggestions.find(
      v => Math.abs(v.lat - lat) < 0.01 && Math.abs(v.lng - lng) < 0.01
    );
    if (matchingVenue) {
      onChangeText(matchingVenue.name);
    } else if (!value) {
      // If no venue name set, use coordinates as placeholder
      onChangeText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
    // Don't close the map - let user continue selecting or click Done
  }, [onCoordinatesChange, onChangeText, venueSuggestions, value]);
  
  // Listen for map clicks on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !showMap) return;

    const handleMapClickEvent = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      handleMapClick(lat, lng);
    };

    window.addEventListener('venueMapClick', handleMapClickEvent as EventListener);
    
    return () => {
      window.removeEventListener('venueMapClick', handleMapClickEvent as EventListener);
    };
  }, [showMap, handleMapClick]);

  // Keep ref in sync with state without triggering effects
  useEffect(() => {
    cachedVenuesRef.current = cachedVenues;
  }, [cachedVenues]);

  // Helpers ------------------------------------------------------------------
  const readCache = async (): Promise<VenueLocation[]> => {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          raw = window.localStorage?.getItem(VENUE_CACHE_KEY) ?? null;
        }
      } else {
        raw = await AsyncStorage.getItem(VENUE_CACHE_KEY);
      }

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as { updatedAt?: number; venues?: VenueLocation[] };
      if (!parsed?.venues || !Array.isArray(parsed.venues)) {
        return [];
      }

      if (
        parsed.updatedAt &&
        Date.now() - parsed.updatedAt > VENUE_CACHE_TTL_MS
      ) {
        logger.debug('[VenueLocationPicker] Venue cache expired, will refresh in background');
      }

      return parsed.venues;
    } catch (error) {
      logger.warn('[VenueLocationPicker] Failed to read venue cache', error);
      return [];
    }
  };

  const persistCache = async (venues: VenueLocation[]) => {
    try {
      if (venues.length === 0) return;

      const payload = JSON.stringify({
        updatedAt: Date.now(),
        venues,
      });

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage?.setItem(VENUE_CACHE_KEY, payload);
        }
      } else {
        await AsyncStorage.setItem(VENUE_CACHE_KEY, payload);
      }
    } catch (error) {
      logger.warn('[VenueLocationPicker] Failed to persist venue cache', error);
    }
  };

  const mergeVenues = (existing: VenueLocation[], incoming: VenueLocation[]) => {
    if (incoming.length === 0) {
      return existing;
    }

    const byName = new Map<string, VenueLocation>();
    const normalize = (name: string) => name.trim().toLowerCase();

    for (const venue of existing) {
      if (!venue?.name) continue;
      byName.set(normalize(venue.name), venue);
    }

    let changed = false;

    for (const venue of incoming) {
      if (!venue?.name) continue;
      const key = normalize(venue.name);
      const current = byName.get(key);
      if (!current) {
        byName.set(key, venue);
        changed = true;
        continue;
      }

      if (current.lat !== venue.lat || current.lng !== venue.lng) {
        byName.set(key, venue);
        changed = true;
      }
    }

    if (!changed) {
      return existing;
    }

    return Array.from(byName.values());
  };

  const filterCachedVenues = (search: string) => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) {
      return [];
    }

    return cachedVenuesRef.current
      .filter((venue) => venue.name.toLowerCase().includes(query))
      .slice(0, 5);
  };

  // Load cached venues on mount
  useEffect(() => {
    let cancelled = false;
    const loadCache = async () => {
      const venues = await readCache();
      if (!cancelled && venues.length > 0) {
        logger.debug(`[VenueLocationPicker] Loaded ${venues.length} venues from cache`);
        setCachedVenues(venues);
      }
      if (!cancelled) {
        setCacheLoaded(true);
      }
    };

    loadCache();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch venue suggestions as user types
  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length < 2) {
      setVenueSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Immediately provide cached suggestions (if any)
    if (cacheLoaded) {
      const cachedMatches = filterCachedVenues(trimmed);
      if (cachedMatches.length > 0) {
        setVenueSuggestions(cachedMatches);
        setShowSuggestions(true);
      }
    }
    
    // Show fallback suggestions immediately for common venues (don't wait for database)
    if (trimmed.length >= 2) {
      const commonVenues: VenueLocation[] = [];
      const lowerTrimmed = trimmed.toLowerCase();
      
      // Hong Kong venues
      if (lowerTrimmed.includes('victoria') || lowerTrimmed.includes('hong kong') || lowerTrimmed.includes('hk') || lowerTrimmed === 'vic') {
        commonVenues.push({
          name: 'Victoria Harbour, Hong Kong',
          lat: 22.3193,
          lng: 114.1694,
        });
      }
      
      if (commonVenues.length > 0) {
        setVenueSuggestions(prev => {
          // Merge with existing suggestions, avoiding duplicates
          const existing = prev.map(v => v.name.toLowerCase());
          const newOnes = commonVenues.filter(v => !existing.includes(v.name.toLowerCase()));
          return [...prev, ...newOnes];
        });
        setShowSuggestions(true);
      }
    }

    let cancelled = false;

    const fetchVenues = async () => {
      setLoadingVenues(true);
      let suggestions: VenueLocation[] = [];
      
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 5000);
        });

        // Try to query with coordinates_lat/lng first (simpler schema)
        const queryPromise = supabase
          .from('sailing_venues')
          .select('id, name, coordinates_lat, coordinates_lng')
          .ilike('name', `%${trimmed}%`)
          .limit(10);

        let { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        // If that fails or returns no data, try PostGIS schema with computed columns
        if (error || !data || data.length === 0) {
          const pgQueryPromise = supabase
            .from('sailing_venues')
            .select('id, name')
            .ilike('name', `%${trimmed}%`)
            .limit(10);
          
          const pgResult = await Promise.race([pgQueryPromise, timeoutPromise]) as any;
          const { data: pgData, error: pgError } = pgResult;
          
          if (!pgError && pgData && pgData.length > 0) {
            // If we have PostGIS schema, we need to extract coordinates differently
            // For now, use a fallback: try to get coordinates from a view or function
            data = pgData.map((v: any) => ({
              ...v,
              coordinates_lat: null,
              coordinates_lng: null,
            }));
            error = null;
          }
        }

        if (error) {
          if (!cancelled) {
            logger.warn('[VenueLocationPicker] Database error:', error);
          }
        }

        suggestions = (data || [])
          .map((v: any) => {
            // Handle both schema types
            const lat = v.coordinates_lat ?? v.latitude ?? (v.coordinates ? v.coordinates.lat : null);
            const lng = v.coordinates_lng ?? v.longitude ?? (v.coordinates ? v.coordinates.lng : null);
            
            return {
              name: v.name,
              lat: lat || 0,
              lng: lng || 0,
            };
          })
          .filter((v: { name: string; lat: number; lng: number }) => v.name); // Filter out any invalid entries

        logger.debug(`[VenueLocationPicker] Found ${suggestions.length} venues matching "${trimmed}"`);

      } catch (error: any) {
        if (!cancelled) {
          logger.warn('[VenueLocationPicker] Query failed or timed out:', error.message);
        }
      }

      // Add common venue fallbacks if no database results (even on error/timeout)
      // But only if we don't already have suggestions from the immediate fallback
      if (suggestions.length === 0 && trimmed.length >= 2) {
        const commonVenues: VenueLocation[] = [];
        const lowerTrimmed = trimmed.toLowerCase();
        
        // Hong Kong venues
        if (lowerTrimmed.includes('victoria') || lowerTrimmed.includes('hong kong') || lowerTrimmed.includes('hk') || lowerTrimmed === 'vic') {
          commonVenues.push({
            name: 'Victoria Harbour, Hong Kong',
            lat: 22.3193,
            lng: 114.1694,
          });
        }
        
        // Add more common venues
        if (lowerTrimmed.includes('sydney')) {
          commonVenues.push({
            name: 'Sydney Harbour, Australia',
            lat: -33.8688,
            lng: 151.2093,
          });
        }
        
        if (lowerTrimmed.includes('san francisco') || lowerTrimmed.includes('sf')) {
          commonVenues.push({
            name: 'San Francisco Bay, USA',
            lat: 37.7749,
            lng: -122.4194,
          });
        }
        
        if (commonVenues.length > 0) {
          suggestions.push(...commonVenues);
        }
      }

      if (!cancelled && trimmed === value.trim()) {
        if (suggestions.length > 0) {
          // Merge with any existing suggestions (from immediate fallback)
          setVenueSuggestions(prev => {
            const existingNames = new Set(prev.map(v => v.name.toLowerCase()));
            const newSuggestions = suggestions.filter(v => !existingNames.has(v.name.toLowerCase()));
            return newSuggestions.length > 0 ? [...prev, ...newSuggestions] : prev;
          });
          setShowSuggestions(true);
        }
        // Don't hide suggestions here - they might have been set by immediate fallback

        let mergedForCache: VenueLocation[] | null = null;
        setCachedVenues((prev) => {
          const merged = mergeVenues(prev, suggestions);
          if (merged === prev) {
            return prev;
          }
          mergedForCache = merged;
          return merged;
        });

        if (mergedForCache) {
          persistCache(mergedForCache);
        }
      }
      
      // Always clear loading state, even on error
      if (!cancelled) {
        setLoadingVenues(false);
      }
    };

    // Debounce venue search
    const timeoutId = setTimeout(fetchVenues, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value, cacheLoaded]);

  const handleSelectSuggestion = (suggestion: VenueLocation) => {
    onChangeText(suggestion.name);
    onCoordinatesChange({ lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    logger.debug(`[VenueLocationPicker] Selected venue: ${suggestion.name} (${suggestion.lat}, ${suggestion.lng})`);
  };

  const handleOpenMap = () => {
    setShowMap(true);
  };

  const handleMapClose = () => {
    setShowMap(false);
  };

  const handleOpenExternalMap = async () => {
    const query = coordinates
      ? `${coordinates.lat},${coordinates.lng}`
      : value || 'sailing venue';
    const url = `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.error('[VenueLocationPicker] Failed to open maps app:', error);
      showAlert('Map Unavailable', 'Could not open a maps app on this device.');
    }
  };


  const coordinatesDisplay = coordinates
    ? `${coordinates.lat.toFixed(4)}°N, ${coordinates.lng.toFixed(4)}°E`
    : 'Location will be auto-detected from venue name';

  return (
    <View style={styles.container}>
      {/* Venue Name Input */}
      <Text style={styles.label}>Race Location</Text>
      <View style={styles.inputContainer}>
        <MapPin size={20} color="#64748B" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            // Clear coordinates when venue name changes manually
            if (coordinates) {
              onCoordinatesChange(null);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          onFocus={() => {
            if (venueSuggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow for selection
            setTimeout(() => {
              setShowSuggestions(false);
            }, 200);
          }}
        />
        {loadingVenues && (
          <ActivityIndicator size="small" color="#3B82F6" style={styles.loader} />
        )}
      </View>

      {/* Venue Suggestions Dropdown */}
      {showSuggestions && venueSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {venueSuggestions.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.name}-${index}`}
              style={({ pressed }) => [
                styles.suggestionItem,
                pressed && styles.suggestionItemPressed,
              ]}
              onPress={() => handleSelectSuggestion(suggestion)}
            >
              <MapPin size={16} color="#3B82F6" />
              <Text style={styles.suggestionText}>{suggestion.name}</Text>
              <Text style={styles.suggestionCoords}>
                {suggestion.lat.toFixed(3)}°, {suggestion.lng.toFixed(3)}°
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      
      {/* Show message if no suggestions found but user has typed enough */}
      {!loadingVenues && value.trim().length >= 3 && !showSuggestions && venueSuggestions.length === 0 && (
        <View style={styles.noSuggestionsContainer}>
          <Text style={styles.noSuggestionsText}>
            No venues found. You can type a custom location.
          </Text>
        </View>
      )}

      {/* Coordinates Display & Map Button */}
      <View style={styles.metadataRow}>
        <View style={styles.coordinatesDisplay}>
          <Text style={styles.coordinatesLabel}>Coordinates:</Text>
          <Text style={styles.coordinatesValue}>{coordinatesDisplay}</Text>
        </View>

        <Pressable style={styles.mapButton} onPress={handleOpenMap}>
          <MapPin size={16} color="#3B82F6" />
          <Text style={styles.mapButtonText}>
            {coordinates ? 'Refine' : 'Show Map'}
          </Text>
        </Pressable>
      </View>

      {/* Accuracy Indicator */}
      {coordinates && (
        <View style={styles.accuracyIndicator}>
          <Text style={styles.accuracyText}>
            📍 Weather accurate to ±500m
          </Text>
        </View>
      )}

      {/* Map Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        transparent={false}
        onRequestClose={handleMapClose}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <Pressable onPress={handleMapClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <VenueMapWeb
                coordinates={coordinates}
                value={value}
                onMapClick={handleMapClick}
                showMap={showMap}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <MapPin size={48} color="#3B82F6" />
                <Text style={styles.mapPlaceholderText}>
                  Map preview unavailable on this device
                </Text>
                <Text style={styles.mapPlaceholderSubtext}>
                  Open your maps app to refine location, then keep this venue selected.
                </Text>
                <Pressable style={styles.externalMapButton} onPress={handleOpenExternalMap}>
                  <Text style={styles.externalMapButtonText}>Open in Maps</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalFooterText}>
              {coordinates
                ? `Selected: ${coordinates.lat.toFixed(4)}°N, ${coordinates.lng.toFixed(4)}°E - Click on the map to change location`
                : 'Click on the map to select a location'}
            </Text>
            <Pressable onPress={handleMapClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    padding: 0,
  },
  loader: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginTop: 4,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 200,
    zIndex: 1000,
    position: 'relative',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionItemPressed: {
    backgroundColor: '#F1F5F9',
  },
  noSuggestionsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noSuggestionsText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    marginLeft: 8,
  },
  suggestionCoords: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  coordinatesDisplay: {
    flex: 1,
  },
  coordinatesLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  coordinatesValue: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    color: '#0F172A',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  mapButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  accuracyIndicator: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  accuracyText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 14,
  },
  externalMapButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  externalMapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalFooterText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
