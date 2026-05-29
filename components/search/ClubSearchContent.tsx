/**
 * ClubSearchContent - Clubs tab content with filters
 *
 * Features:
 * - Search bar
 * - Filter chips (Location, Boat Class)
 * - Club list with join/leave
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Search, X, MapPin, Sailboat, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ClubSearchRow } from './ClubSearchRow';
import { useClubSearch } from '@/hooks/useClubSearch';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

// Location options for filtering (based on seeded clubs)
const LOCATION_OPTIONS = [
  { id: 'US', label: 'United States', flag: '🇺🇸' },
  { id: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { id: 'AU', label: 'Australia', flag: '🇦🇺' },
  { id: 'NZ', label: 'New Zealand', flag: '🇳🇿' },
  { id: 'ES', label: 'Spain', flag: '🇪🇸' },
  { id: 'MC', label: 'Monaco', flag: '🇲🇨' },
  { id: 'IT', label: 'Italy', flag: '🇮🇹' },
  { id: 'CH', label: 'Switzerland', flag: '🇨🇭' },
  { id: 'NL', label: 'Netherlands', flag: '🇳🇱' },
  { id: 'DE', label: 'Germany', flag: '🇩🇪' },
  { id: 'FR', label: 'France', flag: '🇫🇷' },
  { id: 'SE', label: 'Sweden', flag: '🇸🇪' },
  { id: 'HK', label: 'Hong Kong', flag: '🇭🇰' },
  { id: 'SG', label: 'Singapore', flag: '🇸🇬' },
  { id: 'JP', label: 'Japan', flag: '🇯🇵' },
  { id: 'ZA', label: 'South Africa', flag: '🇿🇦' },
  { id: 'AG', label: 'Antigua', flag: '🇦🇬' },
  { id: 'SX', label: 'St. Maarten', flag: '🇸🇽' },
  { id: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { id: 'BR', label: 'Brazil', flag: '🇧🇷' },
];

// Common boat classes for filtering
const BOAT_CLASS_OPTIONS = [
  { id: 'Dragon', label: 'Dragon' },
  { id: 'Etchells', label: 'Etchells' },
  { id: 'J/70', label: 'J/70' },
  { id: 'J/22', label: 'J/22' },
  { id: 'J/24', label: 'J/24' },
  { id: 'Laser', label: 'Laser / ILCA' },
  { id: 'Optimist', label: 'Optimist' },
  { id: '470', label: '470' },
  { id: '49er', label: '49er' },
  { id: 'Melges 24', label: 'Melges 24' },
  { id: 'Star', label: 'Star' },
  { id: 'Finn', label: 'Finn' },
  { id: 'Nacra 17', label: 'Nacra 17' },
  { id: 'Snipe', label: 'Snipe' },
  { id: 'Lightning', label: 'Lightning' },
  { id: 'Hobie 16', label: 'Hobie 16' },
];

interface ClubSearchContentProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const FILTER_CHIPS = [
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'boatClass', label: 'Boat Class', icon: Sailboat },
] as const;

export function ClubSearchContent({
  toolbarOffset = 0,
  onScroll,
}: ClubSearchContentProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoatClass, setSelectedBoatClass] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showBoatClassModal, setShowBoatClassModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const { clubs, isLoading, toggleJoin } = useClubSearch({
    query: searchQuery,
    boatClassId: selectedBoatClass || undefined,
    countryCode: selectedLocation || undefined,
  });

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleFilterPress = useCallback((filterId: string) => {
    if (filterId === 'boatClass') {
      setShowBoatClassModal(true);
    } else if (filterId === 'location') {
      setShowLocationModal(true);
    }
  }, []);

  const handleSelectBoatClass = useCallback((boatClassId: string | null) => {
    setSelectedBoatClass(boatClassId);
    setShowBoatClassModal(false);
  }, []);

  const handleSelectLocation = useCallback((countryCode: string | null) => {
    setSelectedLocation(countryCode);
    setShowLocationModal(false);
  }, []);

  const handleClubPress = useCallback(
    (clubId: string, source?: 'platform' | 'directory') => {
      // Route to the appropriate page based on club source
      if (source === 'directory') {
        router.push(`/club/directory/${clubId}`);
      } else {
        router.push(`/club/${clubId}`);
      }
    },
    [router]
  );

  const handleToggleJoin = useCallback(
    async (clubId: string) => {
      await toggleJoin(clubId);
    },
    [toggleJoin]
  );

  const renderClub = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <ClubSearchRow
        club={item}
        onPress={() => handleClubPress(item.id, item.source)}
        onToggleJoin={() => handleToggleJoin(item.id)}
        showSeparator={index < clubs.length - 1}
      />
    ),
    [clubs.length, handleClubPress, handleToggleJoin]
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  // Rendered as a SIBLING of the FlatList — not its ListHeaderComponent.
  // When this was wired through ListHeaderComponent={ListHeader}, every
  // keystroke recomputed the callback (searchQuery in deps), FlatList
  // saw a new component reference, and remounted the entire header.
  // That dropped focus on the TextInput, so the user could only type one
  // letter at a time before having to tap back in. Hoisting the search
  // bar out of the list keeps the TextInput out of FlatList's
  // reconciliation tree entirely.
  const StickyHeader = (
    <View
      style={[styles.headerContainer, { paddingTop: toolbarOffset + IOS_SPACING.md }]}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search
              size={16}
              color={IOS_COLORS.placeholderText}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clubs"
              placeholderTextColor={IOS_COLORS.placeholderText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClearSearch} hitSlop={8}>
                <X size={16} color={IOS_COLORS.systemGray2} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          {FILTER_CHIPS.map((filter) => {
            const IconComponent = filter.icon;
            // Determine if filter is active
            const isActive =
              (filter.id === 'boatClass' && !!selectedBoatClass) ||
              (filter.id === 'location' && !!selectedLocation);

            // Get label - show selected value if active
            let label = filter.label;
            let clearFilter: (() => void) | null = null;

            if (filter.id === 'boatClass' && selectedBoatClass) {
              label = BOAT_CLASS_OPTIONS.find(c => c.id === selectedBoatClass)?.label || filter.label;
              clearFilter = () => setSelectedBoatClass(null);
            } else if (filter.id === 'location' && selectedLocation) {
              const loc = LOCATION_OPTIONS.find(c => c.id === selectedLocation);
              label = loc ? `${loc.flag} ${loc.label}` : filter.label;
              clearFilter = () => setSelectedLocation(null);
            }

            return (
              <Pressable
                key={filter.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => handleFilterPress(filter.id)}
              >
                <IconComponent
                  size={14}
                  color={isActive ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
                {isActive && clearFilter && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      clearFilter();
                    }}
                    hitSlop={8}
                  >
                    <X size={12} color={IOS_COLORS.systemBlue} />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Results Header */}
      {clubs.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsHeaderText}>
            {clubs.length} CLUB{clubs.length !== 1 ? 'S' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  const ListEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Clubs Found</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? `No clubs matching "${searchQuery}"`
            : 'Try adjusting your filters or search query'}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery]);

  return (
    <>
      {StickyHeader}
      <FlatList
        data={clubs}
        renderItem={renderClub}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        keyboardDismissMode="on-drag"
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      {/* Boat Class Filter Modal */}
      <Modal
        visible={showBoatClassModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBoatClassModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowBoatClassModal(false)} hitSlop={8}>
              <X size={24} color={IOS_COLORS.label} />
            </Pressable>
            <Text style={styles.modalTitle}>Filter by Boat Class</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Clear filter option */}
            <Pressable
              style={styles.boatClassOption}
              onPress={() => handleSelectBoatClass(null)}
            >
              <Text style={styles.boatClassOptionText}>All Classes</Text>
              {!selectedBoatClass && (
                <Check size={20} color={IOS_COLORS.systemBlue} />
              )}
            </Pressable>

            {/* Boat class options */}
            {BOAT_CLASS_OPTIONS.map((boatClass) => (
              <Pressable
                key={boatClass.id}
                style={styles.boatClassOption}
                onPress={() => handleSelectBoatClass(boatClass.id)}
              >
                <Text style={styles.boatClassOptionText}>{boatClass.label}</Text>
                {selectedBoatClass === boatClass.id && (
                  <Check size={20} color={IOS_COLORS.systemBlue} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Location Filter Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowLocationModal(false)} hitSlop={8}>
              <X size={24} color={IOS_COLORS.label} />
            </Pressable>
            <Text style={styles.modalTitle}>Filter by Location</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Clear filter option */}
            <Pressable
              style={styles.boatClassOption}
              onPress={() => handleSelectLocation(null)}
            >
              <Text style={styles.boatClassOptionText}>All Locations</Text>
              {!selectedLocation && (
                <Check size={20} color={IOS_COLORS.systemBlue} />
              )}
            </Pressable>

            {/* Location options */}
            {LOCATION_OPTIONS.map((location) => (
              <Pressable
                key={location.id}
                style={styles.boatClassOption}
                onPress={() => handleSelectLocation(location.id)}
              >
                <Text style={styles.boatClassOptionText}>
                  {location.flag} {location.label}
                </Text>
                {selectedLocation === location.id && (
                  <Check size={20} color={IOS_COLORS.systemBlue} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: IOS_SPACING.sm,
  },
  searchContainer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.md,
    height: 36,
  },
  searchIcon: {
    marginRight: IOS_SPACING.xs,
  },
  searchInput: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    paddingVertical: 0,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.full,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: IOS_COLORS.systemBlue + '20',
  },
  filterChipText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
  },
  filterChipTextActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  resultsHeader: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
  },
  resultsHeaderText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  loadingContainer: {
    padding: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  modalTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  modalContent: {
    flex: 1,
    padding: IOS_SPACING.lg,
  },
  boatClassOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    marginBottom: 1,
  },
  boatClassOptionText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
  },
});
