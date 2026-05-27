/**
 * StepPickerStrip — horizontal chip strip of the viewer's active and
 * recently-done steps for the current interest. Sits above the bottom
 * sheet on the Atlas surface so the user can:
 *   - jump the map to a step that already has a place (tap a placed chip)
 *   - anchor a step that has no place yet (tap an un-placed chip)
 *
 * Source: useUserAtlasSteps().pickerSteps, ordered: in_progress first,
 * then queued by creation order, then most recent done.
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import type { PickerStep, UserStepStatus } from '@/hooks/useUserAtlasSteps';

interface StepPickerStripProps {
  steps: PickerStep[];
  /** Currently focused step id (the one the map is centered on). */
  activeStepId?: string | null;
  onPickStepWithPlace: (step: PickerStep) => void;
  onPickStepWithoutPlace: (step: PickerStep) => void;
}

const STATUS_DOT_COLOR: Record<UserStepStatus, string> = {
  'planned-next': '#F0A93A',
  'planned-week': '#0A84FF',
  'done-just-completed': '#34C759',
  'done-recent': 'rgba(0, 122, 255, 0.55)',
  'done-old': 'rgba(0, 122, 255, 0.3)',
};

const STATUS_LABEL: Record<UserStepStatus, string> = {
  'planned-next': 'NEXT',
  'planned-week': '',
  'done-just-completed': 'JUST DONE',
  'done-recent': '',
  'done-old': '',
};

export function StepPickerStrip({
  steps,
  activeStepId = null,
  onPickStepWithPlace,
  onPickStepWithoutPlace,
}: StepPickerStripProps) {
  if (steps.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {steps.map((step) => {
          const isActive = step.step_id === activeStepId;
          const statusBadge = STATUS_LABEL[step.status];
          return (
            <Pressable
              key={step.step_id}
              onPress={() =>
                step.has_place
                  ? onPickStepWithPlace(step)
                  : onPickStepWithoutPlace(step)
              }
              style={({ pressed }) => [
                styles.chip,
                step.has_place ? styles.chipPlaced : styles.chipUnplaced,
                isActive && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${step.title}${step.has_place ? ', focus on map' : ', anchor to a place'}`}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_DOT_COLOR[step.status] },
                ]}
              />
              {statusBadge ? (
                <Text style={styles.statusBadge}>{statusBadge}</Text>
              ) : null}
              <Text style={styles.title} numberOfLines={1}>
                {step.title}
              </Text>
              <Ionicons
                name={step.has_place ? 'location' : 'location-outline'}
                size={12}
                color={
                  step.has_place
                    ? IOS_COLORS.systemBlue
                    : IOS_COLORS.tertiaryLabel
                }
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  chipPlaced: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(0, 122, 255, 0.35)',
  },
  chipUnplaced: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: IOS_COLORS.separator,
    borderStyle: 'dashed',
  },
  chipActive: {
    backgroundColor: 'rgba(240, 169, 58, 0.18)',
    borderColor: 'rgba(240, 169, 58, 0.75)',
  },
  chipPressed: {
    opacity: 0.65,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#8A4B00',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.label,
    flexShrink: 1,
  },
});
