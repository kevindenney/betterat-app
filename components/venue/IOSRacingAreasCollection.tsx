/**
 * IOSRacingAreasCollection - iOS Collection View Style
 *
 * Horizontal scroll collection for racing areas:
 * - Card: mini map thumbnail + name + verification badge
 * - Tap to expand in bottom sheet
 * - "See All" section header
 * - iOS styling with haptic feedback
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_ANIMATIONS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

// Types
interface RacingArea {
  id: string;
  name: string;
  description?: string;
  source?: 'official' | 'community' | 'ai';
  verification_status?: 'verified' | 'pending' | 'unverified';
  confirmation_count?: number;
  latitude?: number;
  longitude?: number;
  thumbnail_url?: string;
  distance_km?: number;
}

interface IOSRacingAreasCollectionProps {
  /** List of racing areas */
  areas: RacingArea[];
  /** Currently selected area ID */
  selectedAreaId?: string | null;
  /** Handler for area selection */
  onAreaSelect: (area: RacingArea) => void;
  /** Handler for "See All" press */
  onSeeAll?: () => void;
  /** Section title */
  title?: string;
  /** Show empty state */
  showEmptyState?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Verification badge component
interface VerificationBadgeProps {
  source?: string;
  status?: string;
  confirmationCount?: number;
}

function VerificationBadge({ source, status, confirmationCount }: VerificationBadgeProps) {
  let icon: React.ComponentProps<typeof Ionicons>['name'] = 'help-circle';
  let color = IOS_COLORS.systemGray;
  let label = 'Unknown';

  if (status === 'verified' || source === 'official') {
    icon = 'checkmark-shield';
    color = IOS_COLORS.systemGreen;
    label = 'Verified';
  } else if (source === 'community') {
    icon = 'people';
    color = IOS_COLORS.systemBlue;
    label = confirmationCount && confirmationCount > 0
      ? `${confirmationCount} confirm${confirmationCount !== 1 ? 's' : ''}`
      : 'Community';
  } else if (source === 'ai') {
    icon = 'sparkles';
    color = IOS_COLORS.systemPurple;
    label = 'Suggested';
  }

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={10} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// Individual area card
interface AreaCardProps {
  area: RacingArea;
  isSelected?: boolean;
  onPress: () => void;
}

function AreaCard({ area, isSelected, onPress }: AreaCardProps) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    triggerHaptic('impactLight');
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Generate a static map thumbnail URL (using MapLibre/OpenStreetMap style)
  const thumbnailUrl = area.thumbnail_url || (
    area.latitude && area.longitude
      ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${area.longitude},${area.latitude},12,0/160x100?access_token=pk.placeholder`
      : null
  );

  return (
    <AnimatedPressable
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.97, IOS_ANIMATIONS.spring.stiff);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${area.name} racing area`}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Map Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="map" size={24} color={IOS_COLORS.systemGray3} />
          </View>
        )}

        {/* Distance overlay */}
        {area.distance_km !== undefined && (
          <View style={styles.distanceOverlay}>
            <Text style={styles.distanceText}>
              {area.distance_km < 1
                ? `${Math.round(area.distance_km * 1000)}m`
                : `${area.distance_km.toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.areaName} numberOfLines={1}>
          {area.name}
        </Text>

        <VerificationBadge
          source={area.source}
          status={area.verification_status}
          confirmationCount={area.confirmation_count}
        />
      </View>

      {/* Selection indicator */}
      {isSelected && (
        <View style={styles.selectionIndicator}>
          <Ionicons name="checkmark-circle-outline" size={16} color={IOS_COLORS.systemBlue} />
        </View>
      )}
    </AnimatedPressable>
  );
}

// Main collection component
export function IOSRacingAreasCollection({
  areas,
  selectedAreaId,
  onAreaSelect,
  onSeeAll,
  title = 'Racing Areas',
  showEmptyState = true,
}: IOSRacingAreasCollectionProps) {
  if (areas.length === 0 && !showEmptyState) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        {onSeeAll && areas.length > 0 && (
          <Pressable
            style={styles.seeAllButton}
            onPress={() => {
              triggerHaptic('impactLight');
              onSeeAll();
            }}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.systemBlue} />
          </Pressable>
        )}
      </View>

      {/* Area Cards */}
      {areas.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={168} // Card width + gap
          snapToAlignment="start"
        >
          {areas.map((area) => (
            <AreaCard
              key={area.id}
              area={area}
              isSelected={selectedAreaId === area.id}
              onPress={() => onAreaSelect(area)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="map-outline" size={32} color={IOS_COLORS.systemGray3} />
          </View>
          <Text style={styles.emptyTitle}>No Racing Areas</Text>
          <Text style={styles.emptySubtitle}>
            Racing areas for this venue haven't been defined yet
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
  },
  sectionTitle: {
    fontSize: IOS_TYPOGRAPHY.caption1.fontSize,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: IOS_COLORS.secondaryLabel,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: IOS_TYPOGRAPHY.subhead.fontSize,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  scrollContent: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  card: {
    width: 160,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: IOS_COLORS.systemBlue,
  },
  thumbnailContainer: {
    height: 90,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: IOS_COLORS.systemGray6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceOverlay: {
    position: 'absolute',
    top: IOS_SPACING.sm,
    right: IOS_SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 2,
    borderRadius: IOS_RADIUS.sm,
  },
  distanceText: {
    fontSize: IOS_TYPOGRAPHY.caption2.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardContent: {
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
  },
  areaName: {
    fontSize: IOS_TYPOGRAPHY.subhead.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: IOS_TYPOGRAPHY.caption2.fontSize,
    fontWeight: '500',
  },
  selectionIndicator: {
    position: 'absolute',
    top: IOS_SPACING.sm,
    left: IOS_SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xxl,
    paddingHorizontal: IOS_SPACING.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IOS_COLORS.systemGray6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOS_SPACING.md,
  },
  emptyTitle: {
    fontSize: IOS_TYPOGRAPHY.headline.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  emptySubtitle: {
    fontSize: IOS_TYPOGRAPHY.subhead.fontSize,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});

export default IOSRacingAreasCollection;
