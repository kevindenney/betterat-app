import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TimelinePlacement } from '@/services/AddToTimelineService';

interface AddToTimelineSheetProps {
  visible: boolean;
  preview: {
    sourceLabel: string;
    title: string;
    body: string;
    capabilities: string[];
  };
  defaultPlacement?: TimelinePlacement;
  onAdd: (placement: TimelinePlacement, date?: string) => void | Promise<void>;
  onSaveToDeck: () => void | Promise<void>;
  onDismiss: () => void;
}

const OPTIONS: { key: TimelinePlacement; label: string; hint: string }[] = [
  { key: 'next-up', label: 'Next up', hint: 'Right after your current step · default' },
  { key: 'end', label: 'End of timeline', hint: 'After your last planned step' },
  { key: 'specific-date', label: 'Specific date', hint: 'Pin to a calendar date' },
];

export function AddToTimelineSheet({
  visible,
  preview,
  defaultPlacement = 'next-up',
  onAdd,
  onSaveToDeck,
  onDismiss,
}: AddToTimelineSheetProps) {
  const [placement, setPlacement] = useState<TimelinePlacement>(defaultPlacement);
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setPlacement(defaultPlacement);
      setDate('');
      setSubmitting(false);
    }
  }, [visible, defaultPlacement]);

  const canSubmit = useMemo(
    () => placement !== 'specific-date' || /^\d{4}-\d{2}-\d{2}$/.test(date),
    [placement, date],
  );

  const runAction = async (action: () => void | Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await action();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.eyebrow}>{preview.sourceLabel}</Text>
          <Text style={styles.title}>{preview.title}</Text>
          <Text style={styles.body}>{preview.body}</Text>
          {preview.capabilities.length > 0 && (
            <View style={styles.chips}>
              {preview.capabilities.slice(0, 5).map((cap) => (
                <View key={cap} style={styles.chip}>
                  <Text style={styles.chipText}>{cap}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.groupLabel}>Where should it land?</Text>
          <View style={styles.optionGroup}>
            {OPTIONS.map((option) => {
              const selected = option.key === placement;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setPlacement(option.key)}
                >
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionHint}>{option.hint}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {placement === 'specific-date' && (
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <Pressable
            style={[styles.primary, (!canSubmit || submitting) && styles.primaryDisabled]}
            disabled={!canSubmit || submitting}
            onPress={() => runAction(() => onAdd(placement, date || undefined))}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Add to my timeline</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.secondary}
            disabled={submitting}
            onPress={() => runAction(onSaveToDeck)}
          >
            <Text style={styles.secondaryText}>Save to deck for later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    color: '#111827',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    color: '#6B7280',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6B7280',
    marginTop: 4,
  },
  optionGroup: {
    gap: 8,
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#2563EB',
  },
  optionHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#2563EB',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primary: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#B45309',
    fontWeight: '600',
    fontSize: 14,
  },
});
