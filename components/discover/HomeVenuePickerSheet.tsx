/**
 * HomeVenuePickerSheet — search-and-select bottom sheet for setting the
 * user's home venue. Writes the chosen `sailing_venues` row onto
 * `sailor_profiles` (id + name + coords), which lights up the Nearby
 * surfaces. Dismisses on success.
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

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  useVenueSearch,
  useSetHomeVenue,
  type VenueSearchResult,
} from '@/hooks/useHomeVenuePicker';

interface HomeVenuePickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Fired after the home venue is saved successfully. */
  onSaved?: () => void;
}

export function HomeVenuePickerSheet({
  visible,
  onDismiss,
  onSaved,
}: HomeVenuePickerSheetProps) {
  const [query, setQuery] = useState('');
  const { data: results = [], isFetching } = useVenueSearch(query);
  const setHomeVenue = useSetHomeVenue();
  const trimmed = query.trim();

  const handleSelect = (venue: VenueSearchResult) => {
    setHomeVenue.mutate(venue, {
      onSuccess: () => {
        setQuery('');
        onSaved?.();
        onDismiss();
      },
    });
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
                <Text style={styles.title}>Set home venue</Text>
                <Text style={styles.subtitle}>
                  Search for a marina, club, or sailing area near your home base
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={onDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={IOS_REGISTER.labelTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search venues…"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                autoFocus
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
              ) : results.length === 0 && !isFetching ? (
                <Text style={styles.hint}>No venues match “{trimmed}”.</Text>
              ) : (
                results.map((venue) => (
                  <Pressable
                    key={venue.id}
                    style={styles.row}
                    disabled={setHomeVenue.isPending}
                    onPress={() => handleSelect(venue)}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons name="location" size={16} color="#0A84FF" />
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
                    {setHomeVenue.isPending ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color="#0A84FF" />
                    )}
                  </Pressable>
                ))
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
    minHeight: 340,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
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
