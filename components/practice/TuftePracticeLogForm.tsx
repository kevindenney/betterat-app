/**
 * TuftePracticeLogForm
 *
 * True Tufte design: minimal ink, maximum data.
 * - No boxes, no cards, no unnecessary borders
 * - Typography creates hierarchy
 * - Understated selection states
 * - Feels like writing in a logbook
 */

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { SkillArea } from '@/types/practice';

// Muted, ink-like colors
const COLORS = {
  ink: '#1a1a1a',
  muted: '#666666',
  faint: '#999999',
  accent: '#2c5282', // Deep blue, like ink
  underline: '#d4d4d4',
  bg: 'transparent',
};

// Skill area options - even more condensed
const SKILL_OPTIONS: { area: SkillArea; label: string }[] = [
  { area: 'start-execution', label: 'starts' },
  { area: 'upwind-execution', label: 'upwind' },
  { area: 'downwind-speed', label: 'downwind' },
  { area: 'shift-awareness', label: 'shifts' },
  { area: 'windward-rounding', label: 'marks' },
  { area: 'crew-coordination', label: 'crew' },
  { area: 'equipment-prep', label: 'boat' },
];

export interface LogPracticeData {
  focusAreas: SkillArea[];
  durationMinutes: number;
  notes: string;
}

interface TuftePracticeLogFormProps {
  onSubmit: (data: LogPracticeData) => Promise<void>;
  isSubmitting?: boolean;
}

export function TuftePracticeLogForm({
  onSubmit,
  isSubmitting = false,
}: TuftePracticeLogFormProps) {
  const [focusAreas, setFocusAreas] = useState<SkillArea[]>([]);
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState<string>('');

  const toggleFocusArea = (area: SkillArea) => {
    setFocusAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area].slice(0, 3)
    );
  };

  const handleSubmit = async () => {
    if (focusAreas.length === 0 || duration === 0) return;

    await onSubmit({
      focusAreas,
      durationMinutes: duration,
      notes,
    });

    setFocusAreas([]);
    setDuration(30);
    setNotes('');
  };

  const isValid = focusAreas.length > 0 && duration > 0;

  // Build duration display with inline selection
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hrs}h ${remaining}m` : `${hrs}h`;
  };

  return (
    <View style={styles.container}>
      {/* Focus areas as inline text flow */}
      <View style={styles.row}>
        <Text style={styles.prompt}>Practiced</Text>
        <View style={styles.inlineOptions}>
          {SKILL_OPTIONS.map((option) => {
            const isSelected = focusAreas.includes(option.area);
            return (
              <TouchableOpacity
                key={option.area}
                onPress={() => toggleFocusArea(option.area)}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.option,
                    isSelected && styles.optionSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Duration as natural sentence */}
      <View style={styles.row}>
        <Text style={styles.prompt}>for</Text>
        <View style={styles.durationOptions}>
          {[15, 30, 45, 60, 90].map((mins) => {
            const isSelected = duration === mins;
            return (
              <TouchableOpacity
                key={mins}
                onPress={() => setDuration(mins)}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.durationOption,
                    isSelected && styles.durationSelected,
                  ]}
                >
                  {formatDuration(mins)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notes as simple underlined input */}
      <View style={styles.notesRow}>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="notes..."
          placeholderTextColor={COLORS.faint}
          multiline
        />
      </View>

      {/* Submit - just text */}
      <TouchableOpacity
        style={styles.submitRow}
        onPress={handleSubmit}
        disabled={!isValid || isSubmitting}
        activeOpacity={0.6}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <Text style={[styles.submitText, !isValid && styles.submitDisabled]}>
            Log →
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  prompt: {
    fontSize: 16,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 8,
  },
  option: {
    fontSize: 16,
    color: COLORS.faint,
  },
  optionSelected: {
    color: COLORS.ink,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: COLORS.accent,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  durationOption: {
    fontSize: 16,
    color: COLORS.faint,
    fontVariant: ['tabular-nums'],
  },
  durationSelected: {
    color: COLORS.ink,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: COLORS.accent,
  },
  notesRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.underline,
    paddingBottom: 4,
  },
  notesInput: {
    fontSize: 15,
    color: COLORS.ink,
    padding: 0,
    minHeight: 24,
  },
  submitRow: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  submitText: {
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: '500',
  },
  submitDisabled: {
    color: COLORS.faint,
  },
});

export default TuftePracticeLogForm;
