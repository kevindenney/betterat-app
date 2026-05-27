/**
 * OpenStepPicker — modal popup of all interest steps. Reachable from
 * the "Open step ▾" button in the Atlas bottom sheet. Tapping any row
 * closes the picker and centers the map on that step.
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

const STATUS_BADGE_LABEL: Partial<Record<UserStepStatus, string>> = {
  'planned-next': 'NEXT',
  'done-just-completed': 'JUST DONE',
};

const STATUS_BADGE_TONE: Partial<
  Record<
    UserStepStatus,
    { background: string; border: string; text: string }
  >
> = {
  'planned-next': {
    background: 'rgba(240, 169, 58, 0.18)',
    border: 'rgba(240, 169, 58, 0.7)',
    text: '#8A4B00',
  },
  'done-just-completed': {
    background: 'rgba(52, 199, 89, 0.18)',
    border: 'rgba(52, 199, 89, 0.7)',
    text: '#1F7A3A',
  },
};

/**
 * Some steps carry an unhelpful auto-generated subtitle like
 * "Dropped pin (22.366, 114.270)" because the user dropped a raw pin
 * without naming the place. Treat those as no-subtitle so the row
 * stays clean.
 */
function readableLocationName(name: string | null): string | null {
  if (!name) return null;
  if (/^Dropped pin/i.test(name.trim())) return null;
  return name;
}

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
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          // Pressable inside a Pressable backdrop — stop propagation so
          // taps on the sheet body don't dismiss.
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close step picker"
            >
              <Ionicons name="close" size={22} color={IOS_COLORS.label} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Pick a step to focus</Text>
          {steps.length === 0 ? (
            <Text style={styles.empty}>No steps in this interest yet.</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {steps.map((step) => {
                const badgeLabel = STATUS_BADGE_LABEL[step.status];
                const badgeTone = STATUS_BADGE_TONE[step.status];
                const subtitle = readableLocationName(step.location_name);
                const isHeroStep = step.status === 'planned-next';
                const accentColor =
                  step.status === 'planned-next'
                    ? '#F0A93A'
                    : step.status === 'done-just-completed'
                      ? '#34C759'
                      : step.has_place
                        ? '#0A84FF'
                        : 'rgba(120, 120, 130, 0.5)';
                return (
                  <Pressable
                    key={step.step_id}
                    onPress={() => onPickStep(step)}
                    style={({ pressed }) => [
                      styles.row,
                      isHeroStep && styles.rowHero,
                      pressed && styles.rowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Focus on ${step.title}`}
                  >
                    <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitleRow}>
                        <Text style={styles.title} numberOfLines={2}>
                          {step.title}
                        </Text>
                        {badgeLabel && badgeTone ? (
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: badgeTone.background,
                                borderColor: badgeTone.border,
                              },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: badgeTone.text }]}
                            >
                              {badgeLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.rowMetaRow}>
                        <Ionicons
                          name={step.has_place ? 'location' : 'location-outline'}
                          size={12}
                          color={
                            step.has_place
                              ? IOS_COLORS.systemBlue
                              : IOS_COLORS.tertiaryLabel
                          }
                        />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {subtitle ?? (step.has_place ? 'On the map' : 'Tap to anchor on the map')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={IOS_COLORS.tertiaryLabel}
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    flex: 1,
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
  },
  closeBtn: {
    position: 'absolute',
    right: 10,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scroll: {
    maxHeight: 440,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 6,
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
    paddingRight: 12,
    paddingVertical: 10,
    paddingLeft: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    overflow: 'hidden',
  },
  rowHero: {
    backgroundColor: 'rgba(240, 169, 58, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(240, 169, 58, 0.42)',
  },
  rowPressed: {
    backgroundColor: 'rgba(120, 120, 130, 0.16)',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rowBody: {
    flex: 1,
    gap: 4,
    paddingLeft: 8,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: IOS_COLORS.labelSecondary,
    flexShrink: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
});
