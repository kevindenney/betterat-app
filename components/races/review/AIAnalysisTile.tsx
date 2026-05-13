/**
 * AIAnalysisTile - Apple Weather-inspired AI analysis widget
 *
 * Two sizes:
 * - Small (155x155): shown when analysis is not yet available (locked, ready, generating, error)
 * - Large (322x322): shown when analysis is complete, displaying key insights inline
 *
 * Follows IOSWidgetCard animation (Reanimated scale 0.96 spring, haptics)
 * and IOSConditionsWidgets visual style.
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Brain, Check, Lock, Sparkles, Target, Zap } from 'lucide-react-native';
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

export interface AIAnalysisTileProps {
  /** Whether AI analysis has been generated */
  hasAnalysis: boolean;
  /** Whether prerequisites (result + debrief) are met */
  canGenerate: boolean;
  /** Whether analysis is currently being generated */
  isGenerating: boolean;
  /** Whether there was a generation error */
  hasError: boolean;
  /** Primary insight text to show when complete */
  insightText?: string;
  /** Strength identified from AI analysis */
  strengthText?: string;
  /** Whether the analysis was just newly generated */
  isNew?: boolean;
  /** Callback when tile is pressed */
  onPress: () => void;
}

export function AIAnalysisTile({
  hasAnalysis,
  canGenerate,
  isGenerating,
  hasError,
  insightText,
  strengthText,
  isNew,
  onPress,
}: AIAnalysisTileProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = !hasAnalysis && !canGenerate;
  const isLarge = hasAnalysis;

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.96, IOS_ANIMATIONS.spring.snappy);
    }
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
  };
  const handlePress = () => {
    if (!isDisabled) {
      triggerHaptic('impactLight');
      onPress();
    }
  };

  const getHint = () => {
    if (hasAnalysis) return 'View full insights';
    if (hasError) return 'Tap to retry';
    if (isGenerating) return 'Analyzing...';
    if (canGenerate) return 'Generate';
    return 'Complete debrief first';
  };

  const getAccessibilityLabel = () => {
    if (hasAnalysis) return 'Analysis complete. View insights';
    if (isGenerating) return 'Analysis generating';
    if (canGenerate) return 'Generate analysis';
    return 'Analysis locked. Complete debrief first';
  };

  // Large format: analysis complete with insights
  if (isLarge) {
    return (
      <AnimatedPressable
        style={[
          styles.largeTile,
          animatedStyle,
          Platform.OS === 'ios' && IOS_SHADOWS.card,
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
      >
        {/* Completion badge */}
        <View style={styles.completeBadge}>
          <Check size={10} color="#FFFFFF" strokeWidth={3} />
        </View>

        {/* Header row */}
        <View style={styles.header}>
          <Brain size={12} color={COLORS.purple} />
          <Text style={styles.headerLabel}>ANALYSIS</Text>
          {isNew && (
            <View style={styles.newBadge}>
              <Sparkles size={8} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Insights content area */}
        <View style={styles.largeBody}>
          {insightText ? (
            <View style={styles.insightCard}>
              <View style={styles.insightCardHeader}>
                <Target size={14} color={COLORS.purple} />
                <Text style={styles.insightCardLabel}>FOCUS FOR NEXT RACE</Text>
              </View>
              <Text style={styles.insightCardText} numberOfLines={3}>
                {insightText}
              </Text>
            </View>
          ) : null}

          {strengthText ? (
            <View style={styles.strengthCard}>
              <View style={styles.insightCardHeader}>
                <Zap size={14} color={COLORS.green} />
                <Text style={[styles.insightCardLabel, { color: COLORS.green }]}>STRENGTH</Text>
              </View>
              <Text style={styles.strengthCardText} numberOfLines={3}>
                {strengthText}
              </Text>
            </View>
          ) : null}

          {!insightText && !strengthText && (
            <View style={styles.largeCompleteState}>
              <Check size={32} color={COLORS.green} />
              <Text style={styles.completeText}>Analysis complete</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.hint} numberOfLines={1}>
          {getHint()}
        </Text>
      </AnimatedPressable>
    );
  }

  // Small format: not yet complete
  return (
    <AnimatedPressable
      style={[
        styles.tile,
        animatedStyle,
        Platform.OS === 'ios' && IOS_SHADOWS.card,
        isDisabled && styles.tileDisabled,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled && !hasError}
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel()}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Brain size={12} color={isDisabled ? COLORS.gray3 : COLORS.purple} />
        <Text style={[styles.headerLabel, isDisabled && styles.headerLabelDisabled]}>
          AI ANALYSIS
        </Text>
      </View>

      {/* Central content area */}
      <View style={styles.body}>
        {isGenerating ? (
          <>
            <ActivityIndicator size="small" color={COLORS.purple} />
            <Text style={styles.generatingText}>Analyzing</Text>
          </>
        ) : isDisabled ? (
          <>
            <Lock size={24} color={COLORS.gray3} />
            <Text style={styles.lockedText}>Locked</Text>
          </>
        ) : hasError ? (
          <>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>Failed</Text>
          </>
        ) : (
          <>
            <Sparkles size={24} color={COLORS.purple} />
            <Text style={styles.readyText}>Ready</Text>
          </>
        )}
      </View>

      {/* Footer */}
      <Text
        style={[styles.hint, isDisabled && styles.hintDisabled]}
        numberOfLines={1}
      >
        {getHint()}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // Small tile (not yet complete)
  tile: {
    flex: 1,
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
  // Large tile (analysis complete) - spans 2x2 grid cells
  largeTile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${COLORS.purple}30`,
    padding: 12,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
      },
      default: {},
    }),
  },
  completeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tileDisabled: {
    opacity: 0.7,
  },
  header: {
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
  headerLabelDisabled: {
    color: COLORS.gray3,
  },
  newBadge: {
    backgroundColor: COLORS.purple,
    borderRadius: 6,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Small tile body
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  // Large tile body
  largeBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  largeCompleteState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  // Insight card within large tile
  insightCard: {
    backgroundColor: `${COLORS.purple}10`,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
    gap: 6,
  },
  insightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.purple,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  insightCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    lineHeight: 20,
  },
  // Strength card within large tile
  strengthCard: {
    backgroundColor: `${COLORS.green}10`,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.green,
    gap: 6,
  },
  strengthCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    lineHeight: 20,
  },
  // Complete state
  completeText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.secondaryLabel,
  },
  // Generating state
  generatingText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.purple,
  },
  // Locked state
  lockedText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray3,
  },
  // Ready state
  readyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.purple,
  },
  // Error state
  errorIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF3B30',
  },
  // Footer
  hint: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.blue,
  },
  hintDisabled: {
    color: COLORS.gray,
  },
});

export default AIAnalysisTile;
