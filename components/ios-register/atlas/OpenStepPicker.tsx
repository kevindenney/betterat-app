/**
 * OpenStepPicker — modal popup that replaces the standalone chip strip.
 *
 * Reachable from the "Open step ▾" button in the Atlas bottom sheet.
 * Lists every active and recently-done step the viewer has for the
 * current interest, with the next step pinned at the top and visually
 * marked with a NEXT badge. Tap any row to navigate. Tapping the
 * backdrop dismisses.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import type { PickerStep, UserStepStatus } from '@/hooks/useUserAtlasSteps';

interface OpenStepPickerProps {
  visible: boolean;
  steps: PickerStep[];
  onDismiss: () => void;
  onPickStep: (step: PickerStep) => void;
}

const STATUS_DOT: Record<UserStepStatus, string> = {
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

export function OpenStepPicker({
  visible,
  steps,
  onDismiss,
  onPickStep,
}: OpenStepPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Pick a step to open</Text>
          {steps.length === 0 ? (
            <Text style={styles.empty}>No steps in this interest yet.</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {steps.map((step) => {
                const badge = STATUS_LABEL[step.status];
                return (
                  <Pressable
                    key={step.step_id}
                    onPress={() => onPickStep(step)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                      step.status === 'planned-next' && styles.rowNext,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${step.title}`}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: STATUS_DOT[step.status] },
                      ]}
                    />
                    <View style={styles.rowText}>
                      {badge ? (
                        <Text style={styles.badge}>{badge}</Text>
                      ) : null}
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {step.title}
                      </Text>
                      {step.location_name ? (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {step.location_name}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={step.has_place ? 'location' : 'location-outline'}
                      size={14}
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
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 4,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.labelSecondary,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
  },
  rowPressed: {
    backgroundColor: 'rgba(120, 120, 130, 0.14)',
  },
  rowNext: {
    backgroundColor: 'rgba(240, 169, 58, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 169, 58, 0.45)',
  },
  rowText: {
    flex: 1,
  },
  badge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#8A4B00',
    marginBottom: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  rowMeta: {
    fontSize: 11,
    color: IOS_COLORS.labelSecondary,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
