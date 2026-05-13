/**
 * AI Tactical Chips Container
 *
 * Displays a horizontal scrolling list of AI-generated tactical recommendations
 * Integrates with RaceConditionsStore for state management
 */

import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TacticalChip } from './TacticalChip';
import {
  useRaceConditions,
  selectAIRecommendations,
  selectPinnedChips,
  type AIChip
} from '@/stores/raceConditionsStore';
import {
  Colors,
  Typography,
  Spacing,
  ZIndex
} from '@/constants/RacingDesignSystem';

interface AITacticalChipsProps {
  onChipExpand?: (chip: AIChip) => void;
  maxHeight?: number;
  showPinnedOnly?: boolean;
}

export function AITacticalChips({
  onChipExpand,
  maxHeight = 200,
  showPinnedOnly = false
}: AITacticalChipsProps) {
  // Get state from store
  const allChips = useRaceConditions(selectAIRecommendations);
  const pinnedChips = useRaceConditions(selectPinnedChips);
  const isLoading = useRaceConditions(state => state.isLoading.ai);
  const error = useRaceConditions(state => state.errors.ai);

  // Get actions
  const pinChip = useRaceConditions(state => state.pinChip);
  const unpinChip = useRaceConditions(state => state.unpinChip);
  const removeChip = useRaceConditions(state => state.removeAIChip);
  const setChipAlert = useRaceConditions(state => state.setChipAlert);
  const refreshAI = useRaceConditions(state => state.refreshAI);

  // Select which chips to display
  const displayChips = showPinnedOnly ? pinnedChips : allChips;

  // Handlers
  const handlePin = useCallback((chipId: string) => {
    const chip = allChips.find(c => c.id === chipId);
    if (chip?.isPinned) {
      unpinChip(chipId);
    } else {
      pinChip(chipId);
    }
  }, [allChips, pinChip, unpinChip]);

  const handleDismiss = useCallback((chipId: string) => {
    removeChip(chipId);
  }, [removeChip]);

  const handleSetAlert = useCallback((chipId: string, time: Date) => {
    setChipAlert(chipId, time);
  }, [setChipAlert]);

  const handleExpand = useCallback((chip: AIChip) => {
    onChipExpand?.(chip);
  }, [onChipExpand]);

  const handleRefresh = useCallback(() => {
    void refreshAI();
  }, [refreshAI]);

  // Render empty state
  if (!isLoading && displayChips.length === 0 && !error) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="brain"
          size={32}
          color={Colors.text.disabled}
        />
        <Text style={styles.emptyText}>
          {showPinnedOnly
            ? 'No pinned recommendations'
            : 'Analyzing conditions...'}
        </Text>
        {!showPinnedOnly && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={16}
              color={Colors.primary.blue}
            />
            <Text style={styles.refreshText}>Refresh AI</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Render error state
  if (error && !isLoading) {
    return (
      <View style={styles.errorState}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={32}
          color={Colors.status.danger}
        />
        <Text style={styles.errorText}>Failed to load recommendations</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { maxHeight }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="robot"
            size={20}
            color={Colors.primary.blue}
          />
          <Text style={styles.headerTitle}>
            {showPinnedOnly ? 'Pinned' : 'Tactical Recommendations'}
          </Text>
        </View>

        {!showPinnedOnly && (
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.primary.blue} />
            ) : (
              <MaterialCommunityIcons
                name="refresh"
                size={20}
                color={Colors.primary.blue}
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Chips List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {displayChips.map(chip => (
          <View key={chip.id} style={styles.chipWrapper}>
            <TacticalChip
              chip={chip}
              isPinned={chip.isPinned}
              onPin={handlePin}
              onDismiss={handleDismiss}
              onSetAlert={handleSetAlert}
              onExpand={handleExpand}
            />
          </View>
        ))}
      </ScrollView>

      {/* Chip Count */}
      {displayChips.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {displayChips.length} recommendation{displayChips.length !== 1 ? 's' : ''}
          </Text>
          {pinnedChips.length > 0 && !showPinnedOnly && (
            <Text style={styles.footerText}>
              • {pinnedChips.length} pinned
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: ZIndex.chip
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  headerTitle: {
    fontSize: Typography.fontSize.h4,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginLeft: Spacing.sm
  },

  refreshIconButton: {
    padding: Spacing.xs
  },

  scrollView: {
    flexGrow: 0
  },

  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },

  chipWrapper: {
    width: 320, // Fixed width for horizontal scrolling
    marginRight: Spacing.md
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
    gap: Spacing.sm
  },

  footerText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md
  },

  emptyText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.tertiary,
    textAlign: 'center'
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.ui.surface,
    borderRadius: 8,
    gap: Spacing.xs
  },

  refreshText: {
    fontSize: Typography.fontSize.bodySmall,
    color: Colors.primary.blue,
    fontWeight: Typography.fontWeight.semiBold
  },

  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm
  },

  errorText: {
    fontSize: Typography.fontSize.body,
    color: Colors.status.danger,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center'
  },

  errorDetail: {
    fontSize: Typography.fontSize.bodySmall,
    color: Colors.text.tertiary,
    textAlign: 'center',
    maxWidth: '80%'
  },

  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.status.danger,
    borderRadius: 8,
    marginTop: Spacing.sm
  },

  retryText: {
    fontSize: Typography.fontSize.bodySmall,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.semiBold
  }
});
