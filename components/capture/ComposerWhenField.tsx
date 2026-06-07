/**
 * ComposerWhenField — the WHEN slot inside the step composers.
 *
 * Wraps the same DueDatePickerModal the step cover uses, so scheduling a step
 * here gets the full quick-pick + date + time picker instead of a free-text
 * field. Emits a full ISO datetime (or undefined when cleared), which the
 * capture payload maps to the step's starts_at.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { DueDatePickerModal } from '@/components/step/DueDatePickerModal';

interface ComposerWhenFieldProps {
  value?: string | null;
  onChange: (next: string | undefined) => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const h = d.getHours();
  const m = d.getMinutes();
  // Picker stores 23:59:59 to mean "date only" — hide that as a time.
  const hasTime = !(h === 0 && m === 0) && !(h === 23 && m === 59);
  const dateLabel = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (!hasTime) return dateLabel;
  const timeLabel = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} at ${timeLabel}`;
}

export function ComposerWhenField({ value, onChange }: ComposerWhenFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const hasValue = Boolean(value);

  const handleSelect = useCallback(
    (iso: string) => {
      onChange(iso);
      setPickerVisible(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
    setPickerVisible(false);
  }, [onChange]);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.trigger}
        onPress={() => setPickerVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="When"
      >
        <Ionicons name="calendar-outline" size={18} color={IOS_COLORS.systemBlue} />
        <Text style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]} numberOfLines={1}>
          {hasValue ? formatWhen(value!) : 'When will you do this?'}
        </Text>
        {hasValue ? (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessibilityLabel="Clear when"
          >
            <Ionicons name="close-circle" size={18} color={IOS_REGISTER.labelTertiary} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={IOS_REGISTER.labelTertiary} />
        )}
      </Pressable>

      <DueDatePickerModal
        visible={pickerVisible}
        title="When"
        currentDate={value ?? null}
        onSelect={handleSelect}
        onClear={handleClear}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 26,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
  },
  triggerPlaceholder: {
    color: IOS_REGISTER.labelTertiary,
  },
});
