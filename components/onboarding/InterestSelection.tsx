/**
 * InterestSelection — Fullscreen onboarding modal for first-time users.
 *
 * Shown when a user has no preferred interest set. Presents a grid of
 * available interests and lets the user pick one before continuing into
 * the app. The selection is committed via `switchInterest()` from the
 * InterestProvider only when the user taps "Continue".
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InterestSelectionProps {
  /** Whether to show the modal */
  visible: boolean;
  /** Called after an interest has been selected and persisted */
  onComplete: () => void;
}

export interface InterestSelectionContentProps {
  /** Header title shown at the top of the picker */
  title?: string;
  /** Subtitle line below the title */
  subtitle?: string;
  /** When set, renders a warm "Welcome, {name}." eyebrow above the title. */
  greetingName?: string;
  /** Called after an interest has been selected and persisted */
  onComplete: () => void;
  /** Optional back button rendered in the top-left */
  onBack?: () => void;
  /** When true, applies safe-area insets (for fullscreen welcome use). Modals don't need this. */
  applySafeArea?: boolean;
  /** Optional content rendered above the back button (e.g. a brand pill) */
  headerSlot?: React.ReactNode;
  /** Optional footer content (e.g. progress dots) rendered below the grid */
  footer?: React.ReactNode;
  /** Open the Inspiration Wizard when user can't find their interest */
  onOpenInspiration?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Fallback Ionicon for interests whose `icon_name` is null in the database.
// Once the backfill migration is applied this map is mostly inert, but it
// keeps the UI from looking broken in environments that haven't run the migration.
const FALLBACK_ICONS: Record<string, string> = {
  drawing: 'pencil',
  fitness: 'barbell',
  'global-health': 'medkit',
  golf: 'golf',
  nursing: 'pulse',
  'sail-racing': 'boat',
  design: 'brush',
  knitting: 'cut',
  'self-mastery': 'shield-checkmark',
};

const DEFAULT_ICON = 'sparkles';

/**
 * The picker UI on its own — no Modal wrapper. Used by both:
 *   1. The fullscreen `<InterestSelection>` modal (recovery net for signed-in
 *      users with a missing preference).
 *   2. The `app/welcome/pick.tsx` screen in the first-launch flow.
 */
export function InterestSelectionContent({
  title = 'What do you want to get better at?',
  subtitle = 'Pick what matters most right now — you can add more anytime.',
  greetingName,
  onComplete,
  onBack,
  applySafeArea = false,
  headerSlot,
  footer,
  onOpenInspiration,
}: InterestSelectionContentProps) {
  const {
    allInterests,
    groupedInterests,
    switchInterest,
    addInterest,
    loading: interestsLoading,
    getDomainForInterest,
    refreshInterests,
  } = useInterest();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [committingSlug, setCommittingSlug] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Responsive column count — explicit breakpoints, no math that can collapse to 1.
  const numColumns = screenWidth >= 900 ? 4 : screenWidth >= 600 ? 3 : 2;

  // Live filter against name + description + hero_tagline
  const normalizedQuery = query.trim().toLowerCase();

  const matches = useCallback(
    (interest: Interest) => {
      if (!normalizedQuery) return true;
      const haystack = [
        interest.name,
        interest.description,
        interest.hero_tagline,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    },
    [normalizedQuery],
  );

  const filteredGroups = useMemo(
    () =>
      groupedInterests
        .map((group) => ({
          ...group,
          interests: group.interests.filter(matches),
        }))
        .filter((group) => group.interests.length > 0),
    [groupedInterests, matches],
  );

  const filteredFlat = useMemo(
    () => allInterests.filter(matches),
    [allInterests, matches],
  );

  const totalResultCount = useMemo(
    () =>
      filteredGroups.length > 0
        ? filteredGroups.reduce((sum, g) => sum + g.interests.length, 0)
        : filteredFlat.length,
    [filteredGroups, filteredFlat],
  );

  const handleSelect = useCallback(
    async (slug: string) => {
      if (committingSlug) return;
      // The first declaration of "I want to get better at this" is the start of
      // the practice loop — make the commit a felt beat, not a silent tap.
      hapticSelection();
      setCommittingSlug(slug);
      try {
        await addInterest(slug);
        await switchInterest(slug);
        hapticSuccess();
        onComplete();
      } catch (error) {
        console.warn('[InterestSelection] Failed to switch interest:', error);
        setCommittingSlug(null);
      }
    },
    [committingSlug, addInterest, switchInterest, onComplete],
  );

  const cardFlexBasis = `${100 / numColumns}%` as const;

  const renderInterestCard = (interest: Interest) => {
    const isCommitting = committingSlug === interest.slug;
    const isDimmed = !!committingSlug && !isCommitting;
    const accentColor = interest.accent_color || '#2563EB';
    const iconName =
      interest.icon_name || FALLBACK_ICONS[interest.slug] || DEFAULT_ICON;

    // Tagline fallback chain: hero_tagline → description → parent domain name
    const parentDomain = getDomainForInterest(interest.id);
    const tagline =
      interest.hero_tagline ||
      interest.description ||
      (parentDomain ? parentDomain.name : '');

    return (
      <View
        key={interest.id}
        style={[styles.cardCell, { flexBasis: cardFlexBasis }]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.card,
            isCommitting && [styles.cardSelected, { borderColor: accentColor }],
            isDimmed && styles.cardDimmed,
            pressed && !committingSlug && styles.cardPressed,
          ]}
          onPress={() => handleSelect(interest.slug)}
          disabled={!!committingSlug}
          accessibilityRole="button"
          accessibilityLabel={`${interest.name}. ${tagline}`}
        >
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: accentColor },
            ]}
          >
            {isCommitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name={iconName as any} size={20} color="#FFFFFF" />
            )}
          </View>

          <Text style={styles.cardName} numberOfLines={1}>
            {interest.name}
          </Text>

          {tagline ? (
            <Text style={styles.cardTagline} numberOfLines={2}>
              {tagline}
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  };

  const showDomainHeaders = groupedInterests.length > 1;

  const containerStyle = [
    styles.container,
    applySafeArea && {
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
    },
  ];

  return (
    <View style={containerStyle}>
      {/* Optional brand pill / header slot */}
      {headerSlot}

      {/* Optional back button */}
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </Pressable>
      )}

      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(440)}
        style={[styles.header, onBack && styles.headerWithBack]}
      >
        {greetingName ? (
          <Text style={styles.greeting}>Welcome, {greetingName}.</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>

        {/* Search */}
        {!interestsLoading && allInterests.length > 0 && (
          <View style={styles.searchWrap}>
            <Ionicons
              name="search"
              size={18}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search interests…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {Platform.OS !== 'ios' && query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                style={styles.searchClear}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        )}

        {/* Interest grid */}
        {interestsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#64748B" />
            <Text style={styles.loadingText}>Loading interests...</Text>
          </View>
        ) : !interestsLoading && allInterests.length === 0 && !query ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Couldn't load interests</Text>
            <Text style={styles.emptySubtitle}>
              Check your connection and try again.
            </Text>
            <Pressable onPress={() => refreshInterests()} style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : totalResultCount === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={32} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySubtitle}>
              Try a different word, or browse the full list.
            </Text>
            <Pressable onPress={() => setQuery('')} style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>Clear search</Text>
            </Pressable>
          </View>
        ) : showDomainHeaders ? (
          <ScrollView
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredGroups.map((group) => (
              <View key={group.domain.slug} style={styles.domainSection}>
                <View style={styles.domainHeaderRow}>
                  <View style={[styles.domainAccent, { backgroundColor: group.domain.accent_color }]} />
                  <Text style={styles.domainHeaderText}>{group.domain.name}</Text>
                </View>
                <View style={styles.cardGrid}>
                  {group.interests.map(renderInterestCard)}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardGrid}>
              {filteredFlat.map(renderInterestCard)}
            </View>
          </ScrollView>
        )}

      {onOpenInspiration && (
        <Pressable onPress={onOpenInspiration} style={styles.inspirationLink}>
          <Ionicons name="sparkles" size={16} color="#AF52DE" />
          <Text style={styles.inspirationLinkText}>
            Can't find yours? Describe something that inspires you
          </Text>
        </Pressable>
      )}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

/**
 * Modal wrapper for the picker. Used by `InterestSelectionGate` in
 * `app/_layout.tsx` as a recovery net for signed-in users whose preference
 * is missing.
 */
export function InterestSelection({ visible, onComplete }: InterestSelectionProps) {
  const { userProfile } = useAuth();

  // First name for the warm greeting — skip if the stored name is just the
  // email (common for OAuth/seed accounts that never set a display name).
  const rawName = (userProfile?.full_name ?? '').trim();
  const greetingName =
    rawName && !rawName.includes('@') ? rawName.split(/\s+/)[0] : undefined;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        // Android back-button: no-op because we require a selection
      }}
    >
      <InterestSelectionContent
        onComplete={onComplete}
        greetingName={greetingName}
        applySafeArea
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 20,
  },

  // Back button (top-left, only when onBack provided)
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 4,
  },

  // Header
  header: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  headerWithBack: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.1,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  inspirationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inspirationLinkText: {
    fontSize: 14,
    color: '#AF52DE',
    fontWeight: '500',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 38,
    letterSpacing: -0.3,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingVertical: Platform.OS === 'ios' ? 0 : 6,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: {
        fontFamily: 'Manrope, system-ui, sans-serif',
        outlineStyle: 'none' as any,
      },
    }),
  },
  searchClear: {
    paddingHorizontal: 4,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Domain sections
  domainSection: {
    marginBottom: 20,
  },
  domainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  domainAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  domainHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },

  // Grid
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  gridContent: {
    paddingBottom: 32,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cardCell: {
    paddingHorizontal: 6,
    paddingBottom: 12,
    // Equal-height stretch: cells in a row match the tallest sibling.
    alignSelf: 'stretch',
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    minHeight: 132,
    justifyContent: 'flex-start',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: '#FAFCFF',
    borderWidth: 2,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  cardDimmed: {
    opacity: 0.45,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  // Icon badge (top-left of card)
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    // Subtle shadow so the badge feels lifted off the card
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  cardTagline: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Checkmark badge
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

});

export default InterestSelection;
