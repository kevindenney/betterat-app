/**
 * <CapabilityChipSet> — purple chip set above More Options on the Plan body.
 *
 * Phase 1 · iOS register · D10a. Surfaces the capabilities this step
 * develops. Reads from existing planData.competency_ids; auto-tagged from
 * blueprint or AI; multi-select; tap-x removes; "+ tag" opens
 * CompetencyPickerModal at the call site.
 *
 * Canonical: docs/redesign/ios-register/becoming-loop-canonical.html
 *            .caps-section · line 390–429
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  IOS_PURPLE,
  IOS_PURPLE_DEEP,
  IOS_PURPLE_SOFT,
  IOS_PURPLE_TINT,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export interface CapabilityChip {
  id: string;
  label: string;
}

export interface CapabilityChipSetProps {
  selected: CapabilityChip[];
  onRemove: (id: string) => void;
  onAddPress: () => void;
  /** Source-of-tagging note shown beneath chips. e.g. "Sam Cooke's heavy-air blueprint". */
  autoTagSource?: string;
  readOnly?: boolean;
  testID?: string;
}

export function CapabilityChipSet({
  selected,
  onRemove,
  onAddPress,
  autoTagSource,
  readOnly,
  testID,
}: CapabilityChipSetProps) {
  const hintText = autoTagSource
    ? `Auto-tagged from ${autoTagSource} · tap chip to edit`
    : 'Tap chip to edit · + tag to add';

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.head}>
        <View style={styles.eye}>
          <Sparkles size={11} color={IOS_PURPLE} />
          <Text style={styles.eyeText}>Capabilities this will develop</Text>
        </View>
        {!readOnly ? (
          <Pressable
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel="Tag a capability"
            hitSlop={6}
          >
            <Text style={styles.addLink}>+ tag</Text>
          </Pressable>
        ) : null}
      </View>

      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selected.map((chip) => (
            <View key={chip.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {chip.label}
              </Text>
              {!readOnly ? (
                <Pressable
                  onPress={() => onRemove(chip.id)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${chip.label}`}
                  style={styles.chipX}
                >
                  <X size={12} color={IOS_PURPLE_DEEP} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.hint}>{hintText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    marginTop: 6,
    paddingTop: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  eye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  addLink: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_BLUE,
    letterSpacing: -0.05,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: IOS_PURPLE_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_PURPLE_SOFT,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_PURPLE_DEEP,
    letterSpacing: -0.05,
  },
  chipX: {
    opacity: 0.55,
  },
  hint: {
    marginTop: 7,
    fontSize: 10.5,
    fontStyle: 'italic',
    color: LABEL_3,
  },
});
