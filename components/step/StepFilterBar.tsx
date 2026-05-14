/**
 * StepFilterBar - Horizontal filter chips for timeline steps
 *
 * Sits above the TimelineGridView for non-sailing interests.
 * Provides status filtering (All / Plan / Do / Done) and
 * a skills dropdown to filter by capability goal.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_PALETTE } from '@/lib/step-theme';

// =============================================================================
// TYPES
// =============================================================================

export interface StepFilters {
  /** null = all statuses */
  status: string | null;
  /** null = all goals */
  capabilityGoal: string | null;
}

interface StepFilterBarProps {
  filters: StepFilters;
  onFiltersChange: (filters: StepFilters) => void;
  /** Unique capability goals collected from steps */
  availableGoals: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_OPTIONS: { key: string | null; label: string; icon: string }[] = [
  { key: null, label: 'All', icon: 'apps-outline' },
  { key: 'pending', label: 'Before', icon: 'bulb-outline' },
  { key: 'in_progress', label: 'During', icon: 'play-circle-outline' },
  { key: 'completed', label: 'Done', icon: 'checkmark-circle-outline' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function StepFilterBar({ filters, onFiltersChange, availableGoals }: StepFilterBarProps) {
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const handleStatusPress = useCallback(
    (statusKey: string | null) => {
      onFiltersChange({ ...filters, status: statusKey });
    },
    [filters, onFiltersChange],
  );

  const handleGoalSelect = useCallback(
    (goal: string | null) => {
      onFiltersChange({ ...filters, capabilityGoal: goal });
      setShowGoalPicker(false);
    },
    [filters, onFiltersChange],
  );

  const hasActiveFilters = filters.status !== null || filters.capabilityGoal !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status chips */}
        {STATUS_OPTIONS.map((opt) => {
          const isActive = filters.status === opt.key;
          return (
            <Pressable
              key={opt.key ?? 'all'}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handleStatusPress(opt.key)}
            >
              <Ionicons
                name={opt.icon as any}
                size={14}
                color={isActive ? STEP_PALETTE.ctaText : STEP_PALETTE.textSecondary}
              />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Divider */}
        {availableGoals.length > 0 && <View style={styles.divider} />}

        {/* Skills chip */}
        {availableGoals.length > 0 && (
          <Pressable
            style={[
              styles.chip,
              filters.capabilityGoal !== null && styles.chipActive,
            ]}
            onPress={() => setShowGoalPicker(true)}
          >
            <Ionicons
              name="trophy-outline"
              size={14}
              color={filters.capabilityGoal !== null ? STEP_PALETTE.ctaText : STEP_PALETTE.textSecondary}
            />
            <Text
              style={[
                styles.chipText,
                filters.capabilityGoal !== null && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              {filters.capabilityGoal ?? 'Skills'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={filters.capabilityGoal !== null ? STEP_PALETTE.ctaText : STEP_PALETTE.textTertiary}
            />
          </Pressable>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <Pressable
            style={styles.clearChip}
            onPress={() => onFiltersChange({ status: null, capabilityGoal: null })}
          >
            <Ionicons name="close-circle" size={14} color={IOS_COLORS.systemRed} />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Goal picker modal */}
      {showGoalPicker && (
        <GoalPickerOverlay
          goals={availableGoals}
          selected={filters.capabilityGoal}
          onSelect={handleGoalSelect}
          onClose={() => setShowGoalPicker(false)}
        />
      )}
    </View>
  );
}

// =============================================================================
// GOAL PICKER
// =============================================================================

function GoalPickerOverlay({
  goals,
  selected,
  onSelect,
  onClose,
}: {
  goals: string[];
  selected: string | null;
  onSelect: (goal: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlayBackdrop} onPress={onClose}>
        <View style={styles.overlaySheet}>
          <Text style={styles.overlayTitle}>Filter by Skill</Text>

          <Pressable
            style={[styles.overlayRow, selected === null && styles.overlayRowActive]}
            onPress={() => onSelect(null)}
          >
            <Text style={[styles.overlayRowText, selected === null && styles.overlayRowTextActive]}>
              All Skills
            </Text>
            {selected === null && (
              <Ionicons name="checkmark" size={18} color={STEP_PALETTE.textPrimary} />
            )}
          </Pressable>

          {goals.map((goal) => {
            const isActive = selected === goal;
            return (
              <Pressable
                key={goal}
                style={[styles.overlayRow, isActive && styles.overlayRowActive]}
                onPress={() => onSelect(goal)}
              >
                <Text
                  style={[styles.overlayRowText, isActive && styles.overlayRowTextActive]}
                  numberOfLines={1}
                >
                  {goal}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark" size={18} color={STEP_PALETTE.textPrimary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.sm,
  },
  scrollContent: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STEP_PALETTE.bgPrimary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
  },
  chipActive: {
    backgroundColor: STEP_PALETTE.ctaBg,
    borderColor: STEP_PALETTE.ctaBg,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_PALETTE.textSecondary,
    maxWidth: 120,
  },
  chipTextActive: {
    color: STEP_PALETTE.ctaText,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: STEP_PALETTE.borderTertiary,
    marginHorizontal: 2,
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemRed,
  },

  // Goal picker overlay
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  overlaySheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    padding: IOS_SPACING.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
        elevation: 10,
      },
    }),
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.md,
  },
  overlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  overlayRowActive: {
    backgroundColor: IOS_COLORS.systemGray6,
  },
  overlayRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    flex: 1,
  },
  overlayRowTextActive: {
    fontWeight: '600',
    color: STEP_PALETTE.textPrimary,
  },
});
