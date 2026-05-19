/**
 * Races Floating Header - Redesigned with TabScreenToolbar
 *
 * Consistent tab screen header using the shared TabScreenToolbar:
 * - Large left-aligned "Races" title
 * - Race counter subtitle ("13 of 22 | 11 upcoming")
 * - White capsule with add (+) icon
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { NotificationBell } from '@/components/social/NotificationBell';
import { TourStep } from '@/components/onboarding/TourStep';
import { router } from 'expo-router';
import { useInboxCount } from '@/hooks/useInboxCount';
import {
  TabScreenToolbar,
  capsuleStyles,
} from '@/components/ui/TabScreenToolbar';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_SHADOWS,
  IOS_ANIMATIONS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { useVocabulary } from '@/hooks/useVocabulary';
import type { LayoutRectangle } from 'react-native';

export type RaceFilterSegment = 'upcoming' | 'past' | 'progress';

export interface RacesFloatingHeaderProps {
  /** Top inset for safe area */
  topInset: number;
  /** Whether insights are loading */
  loadingInsights?: boolean;
  /** Whether weather is loading */
  weatherLoading?: boolean;
  /** Whether device is online */
  isOnline: boolean;
  /** Whether grid (zoom-out) view is active */
  isGridView?: boolean;
  /** Toggle between card and grid view */
  onToggleGridView?: () => void;
  /** Callback when add race is pressed */
  onAddRace: () => void;
  /** Callback when add blank step is pressed */
  onAddStep?: () => void;
  /** Callback when add practice is pressed */
  onAddPractice?: () => void;
  /** Callback when new season is pressed */
  onNewSeason?: () => void;
  /** Callback when publish as blueprint is pressed */
  onPublishBlueprint?: () => void;
  /** Label for blueprint button (changes when already published) */
  blueprintLabel?: string;
  /** Whether a published blueprint exists for this interest */
  isBlueprintPublished?: boolean;
  /** Current scroll offset for large title collapse */
  scrollOffset?: number;
  /** Callback to expose the + button's layout for onboarding tour spotlight */
  onAddButtonLayout?: (layout: LayoutRectangle) => void;
  /** Trigger value to force re-measurement of add button (e.g., when tour becomes visible) */
  measureTrigger?: boolean | number;
  /** Total number of races in the season */
  totalRaces?: number;
  /** Number of upcoming races */
  upcomingRaces?: number;
  /** Current race index (1-based, for "X of Y" display) */
  currentRaceIndex?: number;
  /** Callback when "X upcoming" is pressed to navigate to next race */
  onUpcomingPress?: () => void;
  /** Season/context label shown in subtitle line (single-line header mode) */
  seasonLabel?: string;
  /** Opens season picker/settings */
  onSeasonPress?: () => void;
  /** Opens step picker (when "X of Y" is tapped) */
  onStepPickerPress?: () => void;
  /** Callback reporting the measured height of the toolbar (for content paddingTop) */
  onMeasuredHeight?: (height: number) => void;
  /** When true the toolbar slides up off-screen */
  hidden?: boolean;
  /** When provided, the "+" button calls this instead of opening the inline menu */
  onAddPress?: () => void;
  /** Whether domain view is active */
  isDomainView?: boolean;
  /** Toggle domain view */
  onToggleDomainView?: () => void;
  /** Label for domain view toggle (e.g., "All Healthcare") */
  domainLabel?: string;
  /** Legacy drawer props - kept for compatibility but not rendered */
  drawerVisible?: boolean;
  onDrawerVisibleChange?: (visible: boolean) => void;
  onLearnItemLayout?: (layout: LayoutRectangle) => void;
  onVenueItemLayout?: (layout: LayoutRectangle) => void;
  onCoachingItemLayout?: (layout: LayoutRectangle) => void;
  onPricingItemLayout?: (layout: LayoutRectangle) => void;
  skipDrawer?: boolean;
  /**
   * When true, render the canonical Phase I "series-chip" + "jump-pill"
   * treatment in the subtitle slot per
   * docs/redesign/ios-register/series-feature-canonical.html Frame 3.
   * When false (default), keep the existing single-line subtitle layout.
   */
  useCanonicalSeasonChip?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Races Header built on TabScreenToolbar
 */
export function RacesFloatingHeader({
  topInset,
  loadingInsights = false,
  weatherLoading = false,
  isOnline,
  isGridView,
  onToggleGridView,
  onAddRace,
  onAddStep,
  onAddPractice,
  onNewSeason,
  onPublishBlueprint,
  blueprintLabel,
  isBlueprintPublished: _isBlueprintPublished,
  scrollOffset: _scrollOffset = 0,
  onAddButtonLayout,
  measureTrigger,
  totalRaces,
  upcomingRaces,
  currentRaceIndex,
  onUpcomingPress,
  seasonLabel,
  onSeasonPress,
  onStepPickerPress,
  onMeasuredHeight,
  hidden,
  onAddPress,
  isDomainView: _isDomainView,
  onToggleDomainView: _onToggleDomainView,
  domainLabel: _domainLabel,
  useCanonicalSeasonChip,
}: RacesFloatingHeaderProps) {
  const collapsableProp = Platform.OS === 'web' ? undefined : false;
  const [menuVisible, setMenuVisible] = useState(false);
  const config = useInterestEventConfig();
  const { vocab } = useVocabulary();
  const { data: inboxCount = 0 } = useInboxCount();

  // Animation values
  const menuFadeAnim = useSharedValue(0);
  const menuScaleAnim = useSharedValue(0.9);
  const addButtonScale = useSharedValue(1);

  // Ref for the + button to expose layout for onboarding tour
  const addButtonRef = useRef<View>(null);

  // Measure and report the + button's layout for onboarding tour spotlight
  useEffect(() => {
    if (!onAddButtonLayout) return;

    const timer = setTimeout(() => {
      if (Platform.OS === 'web') {
        const buttonNode = addButtonRef.current as unknown as { getBoundingClientRect?: () => DOMRect };
        if (buttonNode?.getBoundingClientRect) {
          const rect = buttonNode.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            onAddButtonLayout({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
          }
        }
      } else {
        addButtonRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            onAddButtonLayout({ x, y, width, height });
          }
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [onAddButtonLayout, measureTrigger]);

  // Show menu with animation
  const showMenu = () => {
    setMenuVisible(true);
    menuFadeAnim.value = withTiming(1, { duration: 200 });
    menuScaleAnim.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
  };

  // Hide menu with animation
  const hideMenu = () => {
    menuFadeAnim.value = withTiming(0, { duration: 150 });
    menuScaleAnim.value = withTiming(0.9, { duration: 150 });
    setTimeout(() => setMenuVisible(false), 150);
  };

  // Handle add button press
  const handleAddPress = () => {
    triggerHaptic('impactLight');
    if (onAddPress) {
      onAddPress();
      return;
    }
    if (!onAddStep && !onAddPractice && !onNewSeason && !onPublishBlueprint) {
      onAddRace();
      return;
    }
    showMenu();
  };

  const handleMenuOption = (action: () => void) => {
    hideMenu();
    setTimeout(() => {
      action();
    }, 100);
  };

  // Animated styles
  const menuOverlayStyle = useAnimatedStyle(() => ({
    opacity: menuFadeAnim.value,
  }));

  const menuContainerStyle = useAnimatedStyle(() => ({
    opacity: menuFadeAnim.value,
    transform: [{ scale: menuScaleAnim.value }],
  }));

  const addButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addButtonScale.value }],
  }));

  const isLoading = loadingInsights || weatherLoading;
  const isNursingInterest = config.interestSlug === 'nursing';
  const hasSimulationSubtype = (config.eventSubtypes || []).some((subtype) => {
    const token = `${subtype.id} ${subtype.label}`.toLowerCase();
    return token.includes('simulation');
  });
  const hasSkillsLabSubtype = (config.eventSubtypes || []).some((subtype) => {
    const token = `${subtype.id} ${subtype.label}`.toLowerCase();
    return token.includes('skills') && token.includes('lab');
  });
  const practiceLabelLower = String(vocab('Practice') || '').toLowerCase();
  const hasCohortPracticeItem = Boolean(
    isNursingInterest &&
    onAddPractice &&
    (practiceLabelLower.includes('group learning cycle') || practiceLabelLower.includes('cohort'))
  );
  const showNursingSimulationItem = isNursingInterest && hasSimulationSubtype;
  const showNursingSkillsLabItem = isNursingInterest && (hasSkillsLabSubtype || !hasCohortPracticeItem);

  // Build single-line subtitle: season/context + counters
  const hasIndexCounter = Boolean(currentRaceIndex && totalRaces && totalRaces > 0 && currentRaceIndex <= totalRaces);
  const hasUpcoming = upcomingRaces !== undefined && upcomingRaces > 0;
  const subtitleParts: string[] = [];
  if (seasonLabel) {
    subtitleParts.push(seasonLabel);
  }
  if (hasIndexCounter) {
    subtitleParts.push(`${currentRaceIndex} of ${totalRaces}`);
  }
  if (hasUpcoming) {
    subtitleParts.push(`${upcomingRaces} upcoming`);
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' | ') : undefined;

  // Build custom subtitle content with separately tappable parts.
  // Kept focused: season | current of total | N upcoming.
  // Domain toggle and Published indicator were removed — the active-interest
  // pill in the header already identifies the domain, and blueprint-published
  // state belongs near the blueprint actions rather than in the subtitle.
  const hasMultipleActions = Boolean(onSeasonPress && (hasIndexCounter || hasUpcoming));
  const legacySubtitleContent = hasMultipleActions ? (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {seasonLabel && (
        <Pressable onPress={onSeasonPress} hitSlop={{ top: 8, bottom: 8, right: 4 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="grid-outline" size={11} color={IOS_COLORS.systemBlue} />
          <Text style={{ fontSize: 13, color: IOS_COLORS.systemBlue, fontWeight: '500' }}>
            {seasonLabel}
          </Text>
        </Pressable>
      )}
      {seasonLabel && (hasIndexCounter || hasUpcoming) && (
        <Text style={{ fontSize: 13, color: IOS_COLORS.secondaryLabel, marginHorizontal: 4 }}>|</Text>
      )}
      {hasIndexCounter && (
        <>
          <Pressable onPress={onStepPickerPress} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={{ fontSize: 13, color: onStepPickerPress ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel, fontWeight: onStepPickerPress ? '500' : '400' }}>
              {currentRaceIndex} of {totalRaces}
            </Text>
          </Pressable>
          {hasUpcoming && (
            <Text style={{ fontSize: 13, color: IOS_COLORS.secondaryLabel, marginHorizontal: 4 }}>|</Text>
          )}
        </>
      )}
      {hasUpcoming && (
        <Pressable onPress={onUpcomingPress} hitSlop={{ top: 8, bottom: 8, left: 4 }}>
          <Text style={{ fontSize: 13, color: IOS_COLORS.systemBlue, fontWeight: '500' }}>
            {upcomingRaces} upcoming
          </Text>
        </Pressable>
      )}
    </View>
  ) : undefined;

  // Phase I Frame 3 — canonical series-chip + jump-pill treatment.
  // The series chip carries the active series name with a gold trophy mini icon
  // and opens the switcher sheet on tap; the jump pill is an iOS-blue tinted
  // counter (N of M) with a chevron-down that opens the Jump-to picker.
  const canonicalSubtitleContent = useCanonicalSeasonChip
    ? (
      <View style={canonicalChipStyles.row} testID="series-canonical-subtitle">
        {seasonLabel && (
          <Pressable
            onPress={onSeasonPress}
            hitSlop={{ top: 8, bottom: 8, right: 4 }}
            style={canonicalChipStyles.seriesChip}
            accessibilityRole="button"
            accessibilityLabel={`Switch active series`}
            testID="series-chip"
          >
            <View style={canonicalChipStyles.trophyMini}>
              <Ionicons name="trophy" size={9} color="#8A5A00" />
            </View>
            <Text style={canonicalChipStyles.seriesChipText} numberOfLines={1}>
              {seasonLabel}
            </Text>
          </Pressable>
        )}
        {hasIndexCounter && (
          <Pressable
            onPress={onStepPickerPress}
            hitSlop={{ top: 8, bottom: 8, left: 4 }}
            style={[canonicalChipStyles.jumpPill, !onStepPickerPress && canonicalChipStyles.jumpPillDisabled]}
            disabled={!onStepPickerPress}
            accessibilityRole="button"
            accessibilityLabel={`Jump to another step. Currently viewing step ${currentRaceIndex} of ${totalRaces}.`}
            testID="series-jump-pill"
          >
            <Text style={canonicalChipStyles.jumpPillText}>
              {currentRaceIndex} of {totalRaces}
            </Text>
            <Ionicons name="chevron-down" size={12} color={IOS_COLORS.blue} />
          </Pressable>
        )}
        {hasUpcoming && (
          <Pressable
            onPress={onUpcomingPress}
            hitSlop={{ top: 8, bottom: 8, left: 4 }}
            style={canonicalChipStyles.upcomingPress}
          >
            <Text style={canonicalChipStyles.upcomingText}>
              {upcomingRaces} upcoming
            </Text>
          </Pressable>
        )}
      </View>
    )
    : undefined;

  const subtitleContent = useCanonicalSeasonChip ? canonicalSubtitleContent : legacySubtitleContent;

  // Custom right capsule with notification bell, inbox, grid toggle, and add button
  const rightCapsule = (
    <View style={capsuleStyles.capsule}>
      {/* Notification bell */}
      <View style={capsuleStyles.actionButton}>
        <NotificationBell size={20} color={IOS_COLORS.secondaryLabel} />
      </View>

      <View style={capsuleStyles.capsuleDivider} />

      {/* Practice Inbox — step suggestions + plan pushes + on-deck items */}
      <Pressable
        style={capsuleStyles.actionButton}
        onPress={() => {
          triggerHaptic('selection');
          router.push('/practice/inbox' as any);
        }}
        accessibilityLabel={
          inboxCount > 0
            ? `Inbox — ${inboxCount} item${inboxCount === 1 ? '' : 's'} waiting`
            : 'Inbox'
        }
        accessibilityRole="button"
        hitSlop={6}
      >
        <View>
          <Ionicons
            name="mail-outline"
            size={20}
            color={IOS_COLORS.secondaryLabel}
          />
          {inboxCount > 0 ? (
            <View style={inboxBadgeStyles.badge}>
              <Text style={inboxBadgeStyles.badgeText}>
                {inboxCount > 99 ? '99+' : inboxCount}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={capsuleStyles.capsuleDivider} />

      {/* Grid/card view toggle */}
      {onToggleGridView && (
        <>
          <Pressable
            style={capsuleStyles.actionButton}
            onPress={() => {
              triggerHaptic('selection');
              onToggleGridView();
            }}
            accessibilityLabel={isGridView ? 'Card view' : 'Grid view'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isGridView ? 'square-outline' : 'grid-outline'}
              size={18}
              color={isGridView ? IOS_COLORS.blue : IOS_COLORS.secondaryLabel}
            />
          </Pressable>
          <View style={capsuleStyles.capsuleDivider} />
        </>
      )}


      {/* Add button (with ref for onboarding spotlight) */}
      <TourStep step="add_your_race" position="bottom" horizontalAlign="targetRight" distance={18}>
        <View ref={addButtonRef} collapsable={collapsableProp}>
          <AnimatedPressable
            style={[capsuleStyles.actionButton, addButtonAnimStyle, isLoading && { opacity: 0.4 }]}
            onPress={handleAddPress}
            disabled={isLoading}
            onPressIn={() => {
              addButtonScale.value = withSpring(0.9, IOS_ANIMATIONS.spring.stiff);
            }}
            onPressOut={() => {
              addButtonScale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
            }}
            accessibilityLabel="Add race"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color={IOS_COLORS.secondaryLabel} />
          </AnimatedPressable>
        </View>
      </TourStep>
    </View>
  );

  return (
    <>
      <TabScreenToolbar
        title={config.eventNoun}
        subtitle={subtitleContent ? undefined : subtitle}
        subtitleContent={subtitleContent}
        onSubtitlePress={subtitleContent ? undefined : (onSeasonPress ?? (hasUpcoming ? onUpcomingPress : undefined))}
        topInset={topInset}
        isLoading={isLoading}
        rightContent={rightCapsule}
        onMeasuredHeight={onMeasuredHeight}
        hidden={hidden}
      >
        {/* Offline indicator */}
        {!isOnline && (
          <View style={styles.offlineContainer}>
            <OfflineIndicator />
          </View>
        )}
      </TabScreenToolbar>

      {/* Add Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={hideMenu}
        statusBarTranslucent
      >
        <Animated.View style={[styles.menuOverlay, menuOverlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideMenu} />
          <Animated.View style={[styles.menuContainer, menuContainerStyle]}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Create New</Text>
              <TouchableOpacity
                onPress={hideMenu}
                style={styles.menuCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color={IOS_COLORS.systemGray3} />
              </TouchableOpacity>
            </View>

            {/* Menu Options */}
            <View style={styles.menuOptions}>
              {isNursingInterest ? (
                <>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => handleMenuOption(onAddRace)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemBlue}15` }]}>
                      <MaterialCommunityIcons name="flag-checkered" size={24} color={IOS_COLORS.systemBlue} />
                    </View>
                    <View style={styles.menuOptionContent}>
                      <Text style={styles.menuOptionTitle}>Add Clinical Shift</Text>
                      <Text style={styles.menuOptionSubtitle}>
                        Standard clinical rotation shift
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                  </TouchableOpacity>


                  {hasCohortPracticeItem && onAddPractice ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <View style={styles.menuSection}>
                        <Text style={styles.menuSectionTitle}>Program</Text>
                        <TouchableOpacity
                          style={styles.menuOption}
                          onPress={() => handleMenuOption(onAddPractice)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemTeal}15` }]}>
                            <MaterialCommunityIcons name="account-group-outline" size={24} color={IOS_COLORS.systemTeal} />
                          </View>
                          <View style={styles.menuOptionContent}>
                            <Text style={styles.menuOptionTitle}>Add Cohort Learning Cycle</Text>
                            <Text style={styles.menuOptionSubtitle}>
                              Shared plan and review loop for your cohort
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}

                  {showNursingSimulationItem ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onAddRace)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemPurple}15` }]}>
                          <MaterialCommunityIcons name="hospital-box-outline" size={24} color={IOS_COLORS.systemPurple} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>Add Simulation</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            High-fidelity simulation shift or scenario
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {showNursingSkillsLabItem ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(hasSkillsLabSubtype ? onAddRace : (onAddPractice || onAddRace))}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemGreen}15` }]}>
                          <MaterialCommunityIcons name="sail-boat" size={24} color={IOS_COLORS.systemGreen} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>Add Skills Lab</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Skills lab session or training
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {onAddStep ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onAddStep)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemTeal}15` }]}>
                          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={IOS_COLORS.systemTeal} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>Add Custom Learning Step</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Study block, assignment, debrief, or practice
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {onNewSeason ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onNewSeason)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemOrange}15` }]}>
                          <MaterialCommunityIcons name="calendar-plus" size={24} color={IOS_COLORS.systemOrange} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>Add Rotation (Placement Block)</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Start a new clinical placement period
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {onPublishBlueprint ? (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onPublishBlueprint)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: 'rgba(0,137,123,0.1)' }]}>
                          <Ionicons name="layers-outline" size={24} color="#00897B" />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>{blueprintLabel ?? 'Publish as Blueprint'}</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Make your timeline subscribable for others
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Add Race Option */}
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => handleMenuOption(onAddRace)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemBlue}15` }]}>
                      <MaterialCommunityIcons name="flag-checkered" size={24} color={IOS_COLORS.systemBlue} />
                    </View>
                    <View style={styles.menuOptionContent}>
                      <Text style={styles.menuOptionTitle}>{config.addEventLabel}</Text>
                      <Text style={styles.menuOptionSubtitle}>
                        {config.eventSubtypes?.[0]?.description || `Add a new ${config.eventNoun.toLowerCase()}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                  </TouchableOpacity>


                  {/* Add Step Option */}
                  {onAddStep && (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onAddStep)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemTeal}15` }]}>
                          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={IOS_COLORS.systemTeal} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>Add Step</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Dump ideas, links, and notes — AI structures your plan
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Separator */}
                  <View style={styles.menuSeparator} />

                  {/* Add Practice Option */}
                  {onAddPractice && (
                    <TouchableOpacity
                      style={styles.menuOption}
                      onPress={() => handleMenuOption(onAddPractice)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemGreen}15` }]}>
                        <MaterialCommunityIcons name="sail-boat" size={24} color={IOS_COLORS.systemGreen} />
                      </View>
                      <View style={styles.menuOptionContent}>
                        <Text style={styles.menuOptionTitle}>Add {vocab('Practice')}</Text>
                        <Text style={styles.menuOptionSubtitle}>
                          {vocab('Practice')} session or training
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                    </TouchableOpacity>
                  )}

                  {/* New Season Option */}
                  {onNewSeason && (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onNewSeason)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: `${IOS_COLORS.systemOrange}15` }]}>
                          <MaterialCommunityIcons name="calendar-plus" size={24} color={IOS_COLORS.systemOrange} />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>New {vocab('Period')}</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Start a new {vocab('Period').toLowerCase()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  )}

                  {onPublishBlueprint && (
                    <>
                      <View style={styles.menuSeparator} />
                      <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => handleMenuOption(onPublishBlueprint)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuOptionIcon, { backgroundColor: 'rgba(0,137,123,0.1)' }]}>
                          <Ionicons name="layers-outline" size={24} color="#00897B" />
                        </View>
                        <View style={styles.menuOptionContent}>
                          <Text style={styles.menuOptionTitle}>{blueprintLabel ?? 'Publish as Blueprint'}</Text>
                          <Text style={styles.menuOptionSubtitle}>
                            Make your timeline subscribable for others
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.systemGray3} />
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  offlineContainer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xs,
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.xl,
  },
  menuContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    width: '100%',
    maxWidth: 340,
    ...(Platform.OS === 'ios' ? IOS_SHADOWS.card : {}),
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
  },
  menuTitle: {
    fontSize: IOS_TYPOGRAPHY.title3.fontSize,
    fontWeight: IOS_TYPOGRAPHY.title3.fontWeight as any,
    color: IOS_COLORS.label,
  },
  menuCloseButton: {
    padding: IOS_SPACING.xs,
    marginRight: -IOS_SPACING.xs,
  },
  menuOptions: {
    paddingBottom: IOS_SPACING.md,
  },
  menuSection: {
    paddingTop: IOS_SPACING.xs,
  },
  menuSectionTitle: {
    fontSize: IOS_TYPOGRAPHY.footnote.fontSize,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
  },
  menuOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: IOS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionContent: {
    flex: 1,
    marginLeft: IOS_SPACING.md,
    marginRight: IOS_SPACING.sm,
  },
  menuOptionTitle: {
    fontSize: IOS_TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  menuOptionSubtitle: {
    fontSize: IOS_TYPOGRAPHY.footnote.fontSize,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginHorizontal: IOS_SPACING.lg,
    marginLeft: 76, // Align with text after icon
  },
});

// =============================================================================
// PHASE I — canonical series-chip + jump-pill styles
// =============================================================================

const canonicalChipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  seriesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  trophyMini: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#FFD789',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesChipText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    maxWidth: 180,
  },
  jumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingLeft: 11,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: `${IOS_COLORS.blue}1F`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${IOS_COLORS.blue}30`,
  },
  jumpPillDisabled: {
    opacity: 0.5,
  },
  jumpPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    fontVariant: ['tabular-nums'],
  },
  upcomingPress: {
    paddingHorizontal: 4,
  },
  upcomingText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
});

const inboxBadgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 15,
    height: 15,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
});

export default RacesFloatingHeader;
