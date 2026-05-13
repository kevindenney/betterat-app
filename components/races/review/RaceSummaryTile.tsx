/**
 * RaceSummaryTile - Apple Weather-inspired race summary widget (large 2x2 tile)
 *
 * Large tile (full width of 2-column row) showing an at-a-glance summary
 * with result, wind, tide, key learning, and completion badges.
 *
 * Follows IOSWidgetCard animation (Reanimated scale 0.96 spring, haptics)
 * and IOSConditionsWidgets visual style.
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Trophy,
  Wind,
  Waves,
  Lightbulb,
  Calendar,
  Check,
  ClipboardList,
} from 'lucide-react-native';
import { triggerHaptic } from '@/lib/haptics';
import { IOS_ANIMATIONS, IOS_SHADOWS } from '@/lib/design-tokens-ios';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  purple: '#AF52DE',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  background: '#FFFFFF',
};

const TILE_WIDTH = 322;
const TILE_HEIGHT = 322;

export interface RaceSummaryTileProps {
  /** Race date string */
  raceDate: string;
  /** Result text e.g. "3rd of 12" */
  resultText?: string;
  /** Whether result exists */
  hasResult: boolean;
  /** Wind info */
  wind?: { direction: string; speedMin: number; speedMax: number };
  /** Tide info */
  tide?: { state: string; height?: number; direction?: string };
  /** Key learning text */
  keyLearning?: string;
  /** Whether debrief is complete */
  debriefComplete: boolean;
  /** Whether AI analysis is complete */
  hasAIAnalysis: boolean;
  /** Callback when tile is pressed */
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function formatWind(wind?: { direction: string; speedMin: number; speedMax: number }): string {
  if (!wind) return '\u2014';
  const dir = wind.direction || '?';
  if (wind.speedMin === wind.speedMax) return `${dir} ${wind.speedMin} kts`;
  return `${dir} ${wind.speedMin}-${wind.speedMax} kts`;
}

function formatTide(tide?: { state: string }): string {
  if (!tide?.state) return '\u2014';
  return tide.state.charAt(0).toUpperCase() + tide.state.slice(1);
}

function formatDaysAgo(dateStr: string): string {
  const raceDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - raceDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RaceSummaryTile({
  raceDate,
  resultText,
  hasResult,
  wind,
  tide,
  keyLearning,
  debriefComplete,
  hasAIAnalysis,
  onPress,
}: RaceSummaryTileProps) {
  // Animation (IOSWidgetCard pattern)
  const scaleVal = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
  }));

  const handlePressIn = () => {
    scaleVal.value = withSpring(0.96, IOS_ANIMATIONS.spring.snappy);
  };
  const handlePressOut = () => {
    scaleVal.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
  };
  const handlePress = () => {
    triggerHaptic('impactLight');
    onPress();
  };

  const completedBadges: { label: string; color: string }[] = [];
  if (hasResult) completedBadges.push({ label: 'Result', color: COLORS.green });
  if (debriefComplete) completedBadges.push({ label: 'Debrief', color: COLORS.orange });
  if (hasAIAnalysis) completedBadges.push({ label: 'Analysis', color: COLORS.purple });

  return (
    <AnimatedPressable
      style={[
        styles.tile,
        animatedStyle,
        Platform.OS === 'ios' && IOS_SHADOWS.card,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Race Summary: ${hasResult ? resultText : 'no result'}, ${formatDaysAgo(raceDate)}`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                         */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ClipboardList size={12} color={COLORS.gray} />
          <Text style={styles.headerLabel}>RACE SUMMARY</Text>
        </View>
        <View style={styles.dateBadge}>
          <Calendar size={10} color={COLORS.gray} />
          <Text style={styles.dateBadgeText}>{formatDaysAgo(raceDate)}</Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Body: 2x2 grid                                                     */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.grid}>
        {/* Row 1 */}
        <View style={styles.gridRow}>
          {/* Result */}
          <View style={styles.gridCell}>
            <View style={styles.cellHeader}>
              <Trophy size={14} color={COLORS.green} />
              <Text style={styles.cellLabel}>Result</Text>
            </View>
            <Text
              style={[styles.cellValue, !hasResult && styles.cellValueEmpty]}
              numberOfLines={1}
            >
              {hasResult && resultText ? resultText : '\u2014'}
            </Text>
          </View>

          {/* Wind */}
          <View style={styles.gridCell}>
            <View style={styles.cellHeader}>
              <Wind size={14} color={COLORS.blue} />
              <Text style={styles.cellLabel}>Wind</Text>
            </View>
            <Text
              style={[styles.cellValue, !wind && styles.cellValueEmpty]}
              numberOfLines={1}
            >
              {formatWind(wind)}
            </Text>
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.gridRow}>
          {/* Tide */}
          <View style={styles.gridCell}>
            <View style={styles.cellHeader}>
              <Waves size={14} color={COLORS.orange} />
              <Text style={styles.cellLabel}>Tide</Text>
            </View>
            <Text
              style={[styles.cellValue, !tide?.state && styles.cellValueEmpty]}
              numberOfLines={1}
            >
              {formatTide(tide)}
            </Text>
          </View>

          {/* Key Learning */}
          <View style={styles.gridCell}>
            <View style={styles.cellHeader}>
              <Lightbulb size={14} color={COLORS.purple} />
              <Text style={styles.cellLabel}>Key Learning</Text>
            </View>
            <Text
              style={[styles.cellValue, !keyLearning && styles.cellValueEmpty]}
              numberOfLines={2}
            >
              {keyLearning || '\u2014'}
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Completion badges                                                  */}
      {/* ------------------------------------------------------------------ */}
      {completedBadges.length > 0 && (
        <View style={styles.badgesRow}>
          {completedBadges.map((badge) => (
            <View
              key={badge.label}
              style={[styles.badge, { backgroundColor: `${badge.color}18` }]}
            >
              <Check size={10} color={badge.color} strokeWidth={3} />
              <Text style={[styles.badgeLabel, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer hint                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.hint} numberOfLines={1}>
        View details
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray5,
    padding: 12,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
      },
      default: {},
    }),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.gray6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
  },

  // 2x2 Grid
  grid: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCell: {
    flex: 1,
    backgroundColor: COLORS.gray6,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 72,
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondaryLabel,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.label,
    letterSpacing: -0.2,
  },
  cellValueEmpty: {
    color: COLORS.gray3,
    fontWeight: '500',
  },

  // Completion badges
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Footer
  hint: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.blue,
  },
});

export default RaceSummaryTile;
