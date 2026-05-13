/**
 * VenueBottomSheet - Apple Maps Style Gesture-Driven Bottom Sheet
 *
 * Always-visible sheet with 3 snap points:
 * - Peek (~130px): drag handle + venue name + compact conditions
 * - Half (~45%): conditions widgets + racing areas + next race + actions
 * - Full (~88%): wind patterns + tide + fleet + intel (scrollable)
 *
 * Uses react-native-reanimated + react-native-gesture-handler.
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_ANIMATIONS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { IOSConditionsWidgets } from '../IOSConditionsWidgets';
import { WindPatternCard } from '../WindPatternCard';
import { TideCurrentPanel } from '../TideCurrentPanel';
import { FleetCommunityCard } from '../FleetCommunityCard';
import { RacingIntelSection } from '../RacingIntelSection';
import { useVenueRaces } from '@/hooks/useVenueRaces';
import type { LiveWeatherData } from '@/hooks/useVenueLiveWeather';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Venue {
  id: string;
  name: string;
  country: string;
  region: string;
  venue_type: string;
  coordinates_lat: number;
  coordinates_lng: number;
}

interface VenueBottomSheetProps {
  venue: Venue | null;
  liveWeather: LiveWeatherData | null;
  savedVenueIds: Set<string>;
  onSaveVenue: () => void;
  onAskAI: () => void;
  loadingAI: boolean;
  onCompare: () => void;
  /** When true, the sheet shows a preview banner with Switch / Close actions */
  isPreviewMode?: boolean;
  /** Commit the previewed venue as the new global venue */
  onSwitchVenue?: () => void;
  /** Dismiss preview and revert to the current venue */
  onDismissPreview?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PEEK = 130;
const HALF = SCREEN_HEIGHT * 0.45;
const FULL = SCREEN_HEIGHT * 0.88;

const SNAP_POINTS = [PEEK, HALF, FULL];

const SPRING_CONFIG = IOS_ANIMATIONS.spring.snappy;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function snapToNearest(
  currentHeight: number,
  velocityY: number,
): number {
  'worklet';
  const VELOCITY_THRESHOLD = 500;

  // Velocity-based: if swiping fast, go to next snap in that direction
  if (Math.abs(velocityY) > VELOCITY_THRESHOLD) {
    if (velocityY < 0) {
      // Swiping up → expand (increase height)
      for (let i = 0; i < SNAP_POINTS.length; i++) {
        if (SNAP_POINTS[i] > currentHeight) return SNAP_POINTS[i];
      }
      return SNAP_POINTS[SNAP_POINTS.length - 1];
    } else {
      // Swiping down → collapse (decrease height)
      for (let i = SNAP_POINTS.length - 1; i >= 0; i--) {
        if (SNAP_POINTS[i] < currentHeight) return SNAP_POINTS[i];
      }
      return SNAP_POINTS[0];
    }
  }

  // Otherwise snap to nearest
  let nearest = SNAP_POINTS[0];
  let minDist = Math.abs(currentHeight - nearest);
  for (let i = 1; i < SNAP_POINTS.length; i++) {
    const dist = Math.abs(currentHeight - SNAP_POINTS[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = SNAP_POINTS[i];
    }
  }
  return nearest;
}

// ---------------------------------------------------------------------------
// Action Button
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ActionCircle({
  icon,
  label,
  isActive,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  isActive?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.actionCircleContainer, animStyle]}
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        triggerHaptic('impactLight');
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.9, IOS_ANIMATIONS.spring.stiff);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
      }}
    >
      <View
        style={[
          styles.actionCircle,
          isActive && styles.actionCircleActive,
          disabled && styles.actionCircleDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={isActive ? IOS_COLORS.systemBlue : IOS_COLORS.label}
        />
      </View>
      <Text
        style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Next Race Row
// ---------------------------------------------------------------------------

function NextRaceRow({ venueId }: { venueId: string }) {
  const { races, isLoading } = useVenueRaces(venueId, 1);

  if (isLoading || races.length === 0) return null;

  const race = races[0];

  return (
    <View style={styles.nextRaceRow}>
      <View style={styles.nextRaceLeft}>
        <Ionicons name="flag-outline" size={18} color={IOS_COLORS.systemBlue} />
        <View style={styles.nextRaceInfo}>
          <Text style={styles.nextRaceName} numberOfLines={1}>
            {race.eventName}
          </Text>
          <Text style={styles.nextRaceDate}>
            {race.isToday
              ? 'Today'
              : race.daysUntilStart <= 1
                ? 'Tomorrow'
                : `${race.daysUntilStart} days`}
            {' · '}
            {race.formattedDateRange}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function VenueBottomSheet({
  venue,
  liveWeather,
  savedVenueIds,
  onSaveVenue,
  onAskAI,
  loadingAI,
  onCompare,
  isPreviewMode = false,
  onSwitchVenue,
  onDismissPreview,
}: VenueBottomSheetProps) {
  // Sheet height as animated value (height of visible portion from bottom)
  const sheetHeight = useSharedValue(PEEK);
  const contextY = useSharedValue(0);

  const fireHaptic = useCallback(() => {
    triggerHaptic('impactLight');
  }, []);

  // Auto-expand to HALF when entering preview, snap back to PEEK when leaving
  useEffect(() => {
    if (isPreviewMode) {
      sheetHeight.value = withSpring(HALF, SPRING_CONFIG);
    } else {
      sheetHeight.value = withSpring(PEEK, SPRING_CONFIG);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewMode]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      // translationY negative = dragging up = expanding sheet
      sheetHeight.value = clamp(
        contextY.value - e.translationY,
        PEEK,
        FULL,
      );
    })
    .onEnd((e) => {
      // velocityY negative = swiping up
      const target = snapToNearest(sheetHeight.value, -e.velocityY);
      sheetHeight.value = withSpring(target, SPRING_CONFIG);
      runOnJS(fireHaptic)();
    });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  // Conditions data for widgets
  const conditionsData = useMemo(() => {
    if (!liveWeather) return undefined;
    return {
      windSpeed: liveWeather.windSpeed,
      windGusts: liveWeather.windGusts,
      windDirection: liveWeather.windDirection,
      tidalHeight: liveWeather.tidalHeight,
      tidalState: liveWeather.tidalState as 'rising' | 'falling' | 'high' | 'low' | 'slack' | undefined,
      airTemperature: liveWeather.airTemperature,
      waterTemperature: liveWeather.waterTemperature,
      waveHeight: liveWeather.waveHeight,
      currentSpeed: liveWeather.currentSpeed,
      currentDirection: liveWeather.currentDirection,
    };
  }, [liveWeather]);

  const isSaved = venue ? savedVenueIds.has(venue.id) : false;

  const SheetBg = Platform.OS === 'ios' ? BlurView : View;
  const sheetBgProps = Platform.OS === 'ios'
    ? { intensity: 90, tint: 'systemChromeMaterial' as const }
    : {};

  if (!venue) {
    return (
      <View style={styles.gestureRoot}>
        <Animated.View style={[styles.sheetOuter, { height: PEEK }]}>
          <SheetBg {...sheetBgProps} style={styles.sheetInner}>
            <View style={styles.handle} />
            <View style={styles.peekContent}>
              <Text style={styles.venueName}>Find your sailing base</Text>
              <Text style={styles.venueSubtitle}>
                Explore venues on the map above
              </Text>
            </View>
          </SheetBg>
        </Animated.View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.sheetOuter, sheetAnimStyle]}>
        <SheetBg {...sheetBgProps} style={styles.sheetInner}>
          {/* Drag handle */}
          <View style={styles.handle} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={false}
          >
            {/* ===== PEEK ZONE ===== */}
            <View style={styles.peekContent}>
              {isPreviewMode && (
                <View style={styles.previewBanner}>
                  <View style={styles.previewBannerLeft}>
                    <Ionicons name="eye-outline" size={14} color={IOS_COLORS.systemOrange} />
                    <Text style={styles.previewLabel}>Previewing</Text>
                  </View>
                  <View style={styles.previewBannerActions}>
                    <Pressable
                      style={styles.previewCloseButton}
                      onPress={() => {
                        triggerHaptic('impactLight');
                        onDismissPreview?.();
                      }}
                      accessibilityLabel="Close preview"
                      accessibilityRole="button"
                    >
                      <Text style={styles.previewCloseText}>Close</Text>
                    </Pressable>
                    <Pressable
                      style={styles.previewSwitchButton}
                      onPress={() => {
                        triggerHaptic('impactMedium');
                        onSwitchVenue?.();
                      }}
                      accessibilityLabel="Switch to this venue"
                      accessibilityRole="button"
                    >
                      <Text style={styles.previewSwitchText}>Switch Here</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <Text style={styles.venueName} numberOfLines={1}>
                {venue.name}
              </Text>
              <Text style={styles.venueSubtitle} numberOfLines={1}>
                {venue.country}
                {venue.region ? ` · ${venue.region}` : ''}
              </Text>
            </View>

            {/* ===== HALF ZONE ===== */}
            <View style={styles.halfContent}>
              {/* Conditions Widgets (2x2 grid) */}
              <IOSConditionsWidgets
                conditions={conditionsData}
                isLoading={!liveWeather}
              />

              {/* Next race */}
              <NextRaceRow venueId={venue.id} />

              {/* Action buttons row */}
              <View style={styles.actionsRow}>
                <ActionCircle
                  icon="sparkles-outline"
                  label="Analysis"
                  onPress={onAskAI}
                  disabled={loadingAI || isPreviewMode}
                />
                <ActionCircle
                  icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                  label={isSaved ? 'Saved' : 'Save'}
                  isActive={isSaved}
                  onPress={onSaveVenue}
                  disabled={isPreviewMode}
                />
                {savedVenueIds.size >= 2 && (
                  <ActionCircle
                    icon="copy-outline"
                    label="Compare"
                    onPress={onCompare}
                    disabled={isPreviewMode}
                  />
                )}
              </View>
            </View>

            {/* ===== FULL ZONE ===== */}
            <View style={styles.fullContent}>
              <WindPatternCard
                venueId={venue.id}
                venueName={venue.name}
                currentWindDirection={liveWeather?.windDirection}
                currentWindSpeed={liveWeather?.windSpeed}
              />

              <TideCurrentPanel
                latitude={venue.coordinates_lat}
                longitude={venue.coordinates_lng}
              />

              <FleetCommunityCard
                venueId={venue.id}
                venueName={venue.name}
              />

              <RacingIntelSection
                venueId={venue.id}
                venueName={venue.name}
              />
            </View>
          </ScrollView>
        </SheetBg>
      </Animated.View>
    </GestureDetector>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  gestureRoot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  sheetOuter: {
    borderTopLeftRadius: IOS_RADIUS.md,
    borderTopRightRadius: IOS_RADIUS.md,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  sheetInner: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.97)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(40px)',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
      } as any,
      default: {},
    }),
  },

  // Drag handle
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_COLORS.systemGray4,
    alignSelf: 'center',
    marginTop: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.xs,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Preview banner
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.sm,
    backgroundColor: `${IOS_COLORS.systemOrange}12`,
    borderRadius: IOS_RADIUS.sm,
  },
  previewBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  previewLabel: {
    fontSize: IOS_TYPOGRAPHY.caption1.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.systemOrange,
    letterSpacing: IOS_TYPOGRAPHY.caption1.letterSpacing,
  },
  previewBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  previewCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  previewCloseText: {
    fontSize: IOS_TYPOGRAPHY.caption1.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  previewSwitchButton: {
    paddingVertical: 4,
    paddingHorizontal: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  previewSwitchText: {
    fontSize: IOS_TYPOGRAPHY.caption1.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Peek zone
  peekContent: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.sm,
  },
  venueName: {
    fontSize: IOS_TYPOGRAPHY.headline.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: IOS_TYPOGRAPHY.headline.letterSpacing,
  },
  venueSubtitle: {
    fontSize: IOS_TYPOGRAPHY.footnote.fontSize,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
    letterSpacing: IOS_TYPOGRAPHY.footnote.letterSpacing,
  },

  // Half zone
  halfContent: {
    paddingTop: IOS_SPACING.lg,
  },

  // Next race
  nextRaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.md,
  },
  nextRaceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    flex: 1,
  },
  nextRaceInfo: {
    flex: 1,
  },
  nextRaceName: {
    fontSize: IOS_TYPOGRAPHY.subhead.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  nextRaceDate: {
    fontSize: IOS_TYPOGRAPHY.caption1.fontSize,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: IOS_SPACING.xxl,
    paddingVertical: IOS_SPACING.lg,
    paddingHorizontal: IOS_SPACING.lg,
  },
  actionCircleContainer: {
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleActive: {
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
  },
  actionCircleDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontSize: IOS_TYPOGRAPHY.caption2.fontSize,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  actionLabelDisabled: {
    opacity: 0.4,
  },

  // Full zone
  fullContent: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
  },
});

export default VenueBottomSheet;
