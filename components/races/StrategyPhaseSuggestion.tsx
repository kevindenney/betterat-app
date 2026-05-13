import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/Colors';
import type { PerformancePattern } from '@/types/raceLearning';

interface StrategyPhaseSuggestionProps {
  phase: string;
  phaseLabel: string;
  pattern: PerformancePattern | null;
  aiSuggestion?: string;
  loading?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

export function StrategyPhaseSuggestion({
  phase: _phase,
  phaseLabel,
  pattern,
  aiSuggestion,
  loading = false,
  expanded = true,
  onToggle,
}: StrategyPhaseSuggestionProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary.default} />
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  if (!pattern && !aiSuggestion) {
    return null;
  }

  const isStrength = pattern ? pattern.average >= 4.0 : false;
  const isFocusArea = pattern ? pattern.average <= 3.0 : false;
  const trendIcon = pattern?.trend === 'improving' ? 'trending-up' : pattern?.trend === 'declining' ? 'trending-down' : 'remove';
  const trendColor = pattern?.trend === 'improving' ? colors.success.default : pattern?.trend === 'declining' ? colors.error.default : colors.text.tertiary;

  return (
    <View style={[
      styles.container,
      isStrength && styles.strengthContainer,
      isFocusArea && styles.focusContainer
    ]}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          {isStrength && (
            <Ionicons name="checkmark-circle" size={18} color={colors.success.default} />
          )}
          {isFocusArea && (
            <Ionicons name="alert-circle" size={18} color={colors.warning.default} />
          )}
          <Text style={styles.headerTitle}>
            {isStrength ? 'Strength' : isFocusArea ? 'Focus Area' : 'Performance Insight'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {pattern && (
            <>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  {pattern.average.toFixed(1)}
                </Text>
              </View>
              <Ionicons name={trendIcon as any} size={16} color={trendColor} style={styles.trendIcon} />
            </>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.text.secondary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {pattern && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Avg Rating</Text>
                <Text style={[
                  styles.statValue,
                  isStrength && styles.successText,
                  isFocusArea && styles.warningText
                ]}>
                  {pattern.average.toFixed(1)}/5.0
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Trend</Text>
                <View style={styles.trendRow}>
                  <Ionicons name={trendIcon as any} size={14} color={trendColor} />
                  <Text style={[styles.statValue, { color: trendColor }]}>
                    {pattern.trend}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Races</Text>
                <Text style={styles.statValue}>{pattern.sampleCount}</Text>
              </View>
            </View>
          )}

          {aiSuggestion && (
            <View style={styles.suggestionBox}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="bulb" size={16} color={colors.accent.default} />
                <Text style={styles.suggestionLabel}>Suggestion</Text>
              </View>
              <Text style={styles.suggestionText}>{aiSuggestion}</Text>
            </View>
          )}

          {!aiSuggestion && pattern && (
            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionText}>
                {isStrength
                  ? `You excel at ${phaseLabel.toLowerCase()} (${pattern.average.toFixed(1)} avg across ${pattern.sampleCount} races). Leverage this strength in your strategy.`
                  : isFocusArea
                  ? `${phaseLabel} needs work (${pattern.average.toFixed(1)} avg, ${pattern.trend} trend). Focus on specific techniques to improve this phase.`
                  : `Your ${phaseLabel.toLowerCase()} performance: ${pattern.average.toFixed(1)} avg across ${pattern.sampleCount} races.`
                }
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
    overflow: 'hidden',
  },
  strengthContainer: {
    borderColor: colors.success.light,
    backgroundColor: '#F0FDF4',
  },
  focusContainer: {
    borderColor: colors.warning.light,
    backgroundColor: '#FFFBEB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    backgroundColor: colors.primary.default,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  trendIcon: {
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: colors.background.default,
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  successText: {
    color: colors.success.default,
  },
  warningText: {
    color: colors.warning.default,
  },
  suggestionBox: {
    backgroundColor: colors.accent.light,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.default,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent.dark,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  loadingText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: 8,
  },
});
