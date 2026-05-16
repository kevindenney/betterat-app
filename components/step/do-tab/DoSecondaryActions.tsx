import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const GRAY_1 = '#8E8E93';
const GRAY_2 = '#AEAEB2';

export interface DoSecondaryActionsProps {
  onAddAnotherCapture?: () => void;
  onDiscardActivity?: () => void;
  /** Optional read-only mode disables both buttons. */
  readOnly?: boolean;
  /** Override the additive button label. */
  addLabel?: string;
  /** Override the destructive button label. */
  discardLabel?: string;
}

/**
 * Phase B.7 · Frame 3 · G — Secondary actions row.
 * Two text buttons: additive (left, blue, plus glyph) and destructive
 * (right, gray-1, trash glyph). No chrome — they sit below the primary
 * blue CTA and stay deliberately quiet. Both meet the 44 px hit-target
 * minimum via hitSlop even though the rendered row is only 28 px tall.
 */
export function DoSecondaryActions({
  onAddAnotherCapture,
  onDiscardActivity,
  readOnly,
  addLabel = 'Add another capture',
  discardLabel = 'Discard activity',
}: DoSecondaryActionsProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={readOnly ? undefined : onAddAnotherCapture}
        disabled={readOnly}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        style={({ pressed }) => [styles.btn, pressed && !readOnly && styles.btnPressed]}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
      >
        <Ionicons name="add" size={14} color={IOS_BLUE} />
        <Text style={styles.addLabel}>{addLabel}</Text>
      </Pressable>

      <Pressable
        onPress={readOnly ? undefined : onDiscardActivity}
        disabled={readOnly}
        accessibilityRole="button"
        accessibilityLabel={discardLabel}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        style={({ pressed }) => [styles.btn, pressed && !readOnly && styles.btnPressed]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
      >
        <Ionicons name="trash-outline" size={14} color={GRAY_2} />
        <Text style={styles.discardLabel}>{discardLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  btnPressed: {
    opacity: 0.6,
  },
  addLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: IOS_BLUE,
  },
  discardLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: GRAY_1,
  },
});
