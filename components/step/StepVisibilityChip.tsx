/**
 * <StepVisibilityChip> — tappable visibility affordance for steps.
 *
 * Steps are created private silently (every creation path defaults
 * 'private'), which left users believing sharing was broken. This chip
 * makes the tier visible and changeable in place — on the step header
 * for existing steps and on the quick-capture sheet for new ones.
 * Tier labels resolve per interest via getVisibilityLabels (sailing →
 * Crew/Fleet, default → Collaborators/Group).
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GRAY_5, IOS_BLUE, LABEL, LABEL_2, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';
import { getVisibilityLabels } from '@/lib/vocabulary';
import type { TimelineStepVisibility } from '@/types/timeline-steps';

const TIER_ORDER: TimelineStepVisibility[] = ['private', 'crew', 'fleet', 'public'];

const TIER_ICONS: Record<TimelineStepVisibility, keyof typeof Ionicons.glyphMap> = {
  private: 'lock-closed',
  crew: 'people-outline',
  fleet: 'people',
  public: 'globe-outline',
};

export function visibilityChipLabel(
  visibility: TimelineStepVisibility,
  interestSlug?: string | null,
): string {
  const labels = getVisibilityLabels(interestSlug);
  switch (visibility) {
    case 'private':
      return 'Private · only you';
    case 'crew':
      return labels.crew;
    case 'fleet':
      return labels.fleet;
    case 'public':
      return 'Public';
  }
}

function tierDescription(
  visibility: TimelineStepVisibility,
  interestSlug?: string | null,
): string {
  const labels = getVisibilityLabels(interestSlug);
  switch (visibility) {
    case 'private':
      return 'Only you can see this step';
    case 'crew':
      return `${labels.crew} on this step, plus followers you allow`;
    case 'fleet':
      return `Your wider ${labels.fleet.toLowerCase()}, plus followers you allow`;
    case 'public':
      return 'Anyone on BetterAt';
  }
}

export interface StepVisibilityChipProps {
  visibility: TimelineStepVisibility;
  interestSlug?: string | null;
  /** Omit to render a read-only chip with no picker. */
  onChange?: (visibility: TimelineStepVisibility) => void;
  disabled?: boolean;
  testID?: string;
}

export function StepVisibilityChip({
  visibility,
  interestSlug,
  onChange,
  disabled,
  testID,
}: StepVisibilityChipProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editable = Boolean(onChange) && !disabled;

  const handleSelect = (tier: TimelineStepVisibility) => {
    setPickerOpen(false);
    if (tier !== visibility) onChange?.(tier);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Step visibility: ${visibilityChipLabel(visibility, interestSlug)}`}
        onPress={editable ? () => setPickerOpen(true) : undefined}
        disabled={!editable}
        hitSlop={6}
        style={styles.chip}
        testID={testID}
      >
        <Ionicons name={TIER_ICONS[visibility]} size={11} color={LABEL_2} />
        <Text style={styles.chipText} numberOfLines={1}>
          {visibilityChipLabel(visibility, interestSlug)}
        </Text>
        {editable ? <Ionicons name="chevron-down" size={10} color={LABEL_3} /> : null}
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.scrim}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => setPickerOpen(false)}
          />
          <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Who can see this step?</Text>
              {TIER_ORDER.map((tier) => {
                const selected = tier === visibility;
                return (
                  <Pressable
                    key={tier}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelect(tier)}
                    style={styles.optionRow}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons name={TIER_ICONS[tier]} size={17} color={selected ? IOS_BLUE : LABEL_2} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {visibilityChipLabel(tier, interestSlug)}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {tierDescription(tier, interestSlug)}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={IOS_BLUE} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GRAY_5,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
  },
  optionIcon: {
    width: 28,
    alignItems: 'center',
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: LABEL,
    letterSpacing: -0.2,
  },
  optionLabelSelected: {
    color: IOS_BLUE,
  },
  optionDescription: {
    fontSize: 12,
    color: LABEL_3,
    marginTop: 2,
  },
});

export default StepVisibilityChip;
