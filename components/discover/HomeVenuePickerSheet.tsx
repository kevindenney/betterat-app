/**
 * HomeVenuePickerSheet — bottom sheet for setting the user's *current*
 * location focus (users.location_focus_*). People travel, so this is a
 * movable anchor, not a fixed home base.
 *
 * Three ways to set it:
 *   1. "Use my current location" — expo-location, labeled via the
 *      nearest_named_place RPC with a Nominatim reverse-geocode fallback.
 *   2. Sailing-venue search (`sailing_venues`) — also snapshots the
 *      home_venue_* columns so racing-area lookups stay keyed.
 *   3. General place search (Nominatim) — any town/harbour/campus.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  useVenueSearch,
  usePlaceSearch,
  type VenueSearchResult,
  type PlaceSearchResult,
} from '@/hooks/useHomeVenuePicker';
import { useSetLocationFocus, labelForCoords } from '@/hooks/useLocationFocus';

interface HomeVenuePickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Fired after the location focus is saved successfully. */
  onSaved?: () => void;
}

export function HomeVenuePickerSheet({
  visible,
  onDismiss,
  onSaved,
}: HomeVenuePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const { data: venues = [], isFetching: venuesFetching } = useVenueSearch(query);
  const { data: places = [], isFetching: placesFetching } = usePlaceSearch(query);
  const setFocus = useSetLocationFocus();
  const trimmed = query.trim();
  const isFetching = venuesFetching || placesFetching;
  const busy = setFocus.isPending || locating;

  const finish = () => {
    setQuery('');
    setLocateError(null);
    onSaved?.();
    onDismiss();
  };

  const handleVenue = (venue: VenueSearchResult) => {
    setFocus.mutate(
      { lat: venue.lat, lng: venue.lng, label: venue.name, venueId: venue.id },
      { onSuccess: finish },
    );
  };

  const handlePlace = (place: PlaceSearchResult) => {
    setFocus.mutate(
      { lat: place.lat, lng: place.lng, label: place.name },
      { onSuccess: finish },
    );
  };

  const handleUseCurrentLocation = async () => {
    setLocateError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocateError('Location permission denied — search for a place instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      const label = await labelForCoords(lat, lng);
      setFocus.mutate({ lat, lng, label }, { onSuccess: finish });
    } catch {
      setLocateError('Couldn’t get your location — search for a place instead.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onDismiss} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Set your location</Text>
                <Text style={styles.subtitle}>
                  Nearby and Atlas center here — update it whenever you travel
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={onDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.currentLocationRow, busy && styles.rowDisabled]}
              disabled={busy}
              onPress={handleUseCurrentLocation}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
            >
              <View style={styles.iconCircle}>
                {locating ? (
                  <ActivityIndicator size="small" color="#0A84FF" />
                ) : (
                  <Ionicons name="navigate" size={16} color="#0A84FF" />
                )}
              </View>
              <Text style={styles.currentLocationText}>
                {locating ? 'Finding where you are…' : 'Use my current location'}
              </Text>
            </Pressable>
            {locateError ? <Text style={styles.locateError}>{locateError}</Text> : null}

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={IOS_REGISTER.labelTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search any town, harbour, or venue…"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                autoCorrect={false}
                style={styles.searchInput}
              />
              {isFetching ? <ActivityIndicator size="small" /> : null}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {trimmed.length < 2 ? (
                <Text style={styles.hint}>Type at least 2 letters to search.</Text>
              ) : venues.length === 0 && places.length === 0 && !isFetching ? (
                <Text style={styles.hint}>No places match “{trimmed}”.</Text>
              ) : (
                <>
                  {venues.length > 0 && (
                    <Text style={styles.sectionLabel}>SAILING VENUES</Text>
                  )}
                  {venues.map((venue) => (
                    <Pressable
                      key={venue.id}
                      style={[styles.row, busy && styles.rowDisabled]}
                      disabled={busy}
                      onPress={() => handleVenue(venue)}
                    >
                      <View style={styles.iconCircle}>
                        <Ionicons name="boat-outline" size={16} color="#0A84FF" />
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {venue.name}
                        </Text>
                        {venue.region || venue.country ? (
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {[venue.region, venue.country].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {setFocus.isPending ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Ionicons name="add-circle-outline" size={20} color="#0A84FF" />
                      )}
                    </Pressable>
                  ))}
                  {places.length > 0 && <Text style={styles.sectionLabel}>PLACES</Text>}
                  {places.map((place) => (
                    <Pressable
                      key={place.id}
                      style={[styles.row, busy && styles.rowDisabled]}
                      disabled={busy}
                      onPress={() => handlePlace(place)}
                    >
                      <View style={styles.iconCircle}>
                        <Ionicons name="location" size={16} color="#0A84FF" />
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        {place.detail ? (
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {place.detail}
                          </Text>
                        ) : null}
                      </View>
                      {setFocus.isPending ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Ionicons name="add-circle-outline" size={20} color="#0A84FF" />
                      )}
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 380,
    maxHeight: '85%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  currentLocationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A84FF',
    letterSpacing: -0.2,
  },
  locateError: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginHorizontal: 16,
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  scroll: { marginTop: 8 },
  scrollContent: { paddingBottom: 24 },
  hint: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    padding: 24,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  rowDisabled: { opacity: 0.5 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
});

export default HomeVenuePickerSheet;
