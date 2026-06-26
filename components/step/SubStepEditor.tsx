/**
 * SubStepEditor — ordered list of sub-steps with add/remove/reorder.
 *
 * Each sub-step row manages its own local text state to prevent cursor jumps
 * from parent re-renders caused by debounced saves.
 *
 * Reorder via up/down arrow buttons on each row.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { SubStep } from '@/types/step-detail';

const SUBSTEP_LINE_HEIGHT = 18;
const SUBSTEP_MIN_HEIGHT = 36;

// ---------------------------------------------------------------------------
// Individual sub-step row with local text state
// ---------------------------------------------------------------------------

function SubStepRow({
  step,
  index,
  total,
  onTextChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: SubStep;
  index: number;
  total: number;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [localText, setLocalText] = useState(step.text);
  const [inputHeight, setInputHeight] = useState<number>(SUBSTEP_MIN_HEIGHT);
  const initializedRef = useRef(false);

  // Seed from prop on mount only
  useEffect(() => {
    if (!initializedRef.current) {
      setLocalText(step.text);
      initializedRef.current = true;
    }
  }, [step.text]);

  const handleChange = useCallback((text: string) => {
    setLocalText(text);
    onTextChange(step.id, text);
  }, [step.id, onTextChange]);

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const next = Math.max(SUBSTEP_MIN_HEIGHT, e.nativeEvent.contentSize.height);
      setInputHeight((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const showReorderButtons = total > 1;

  return (
    <View style={styles.row}>
      {/* Reorder controls */}
      {showReorderButtons && (
        <View style={styles.reorderColumn}>
          <Pressable
            onPress={() => onMoveUp(step.id)}
            hitSlop={4}
            disabled={isFirst}
            style={[styles.reorderButton, isFirst && styles.reorderButtonDisabled]}
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={isFirst ? IOS_COLORS.systemGray4 : IOS_COLORS.systemGray}
            />
          </Pressable>
          <Pressable
            onPress={() => onMoveDown(step.id)}
            hitSlop={4}
            disabled={isLast}
            style={[styles.reorderButton, isLast && styles.reorderButtonDisabled]}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={isLast ? IOS_COLORS.systemGray4 : IOS_COLORS.systemGray}
            />
          </Pressable>
        </View>
      )}

      <Text style={styles.stepNumber}>{index + 1}.</Text>
      <TextInput
        // Native (Fabric) multiline inputs auto-grow intrinsically; a fixed
        // height pins them to one clipped line when onContentSizeChange
        // doesn't fire. Web textareas never auto-grow, so keep the measured
        // height there.
        style={[styles.input, Platform.OS === 'web' ? { height: inputHeight } : null]}
        value={localText}
        onChangeText={handleChange}
        placeholder="Describe this sub-step..."
        placeholderTextColor={IOS_COLORS.tertiaryLabel}
        multiline
        onContentSizeChange={handleContentSizeChange}
        scrollEnabled={false}
        textAlignVertical="top"
      />
      <Pressable
        onPress={() => onRemove(step.id)}
        hitSlop={8}
        style={styles.removeButton}
      >
        <Ionicons name="close-circle" size={20} color={IOS_COLORS.systemGray3} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SubStepEditor
// ---------------------------------------------------------------------------

interface SubStepEditorProps {
  subSteps: SubStep[];
  onChange: (subSteps: SubStep[]) => void;
  readOnly?: boolean;
}

const MIN_SLOTS = 3; // Always show at least this many text entry fields

function makeEmptySlot(index: number): SubStep {
  return {
    id: `ss_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: '',
    sort_order: index,
    completed: false,
  };
}

export function SubStepEditor({ subSteps, onChange, readOnly }: SubStepEditorProps) {
  const subStepsRef = useRef(subSteps);
  subStepsRef.current = subSteps;

  // Ensure we always have at least MIN_SLOTS entries in edit mode
  const ensuredRef = useRef(false);
  useEffect(() => {
    if (readOnly || ensuredRef.current) return;
    if (subSteps.length < MIN_SLOTS) {
      const padded = [...subSteps];
      for (let i = subSteps.length; i < MIN_SLOTS; i++) {
        padded.push(makeEmptySlot(i));
      }
      onChange(padded);
      ensuredRef.current = true;
    } else {
      ensuredRef.current = true;
    }
  }, [readOnly, subSteps, onChange]);

  // Reset the ensured flag when subSteps arrive from outside (e.g., AI-generated)
  const prevLengthRef = useRef(subSteps.length);
  useEffect(() => {
    if (subSteps.length > 0 && prevLengthRef.current === 0) {
      // New content arrived — re-check padding
      ensuredRef.current = false;
    }
    prevLengthRef.current = subSteps.length;
  }, [subSteps.length]);

  const addSubStep = useCallback(() => {
    const newStep = makeEmptySlot(subStepsRef.current.length);
    onChange([...subStepsRef.current, newStep]);
  }, [onChange]);

  const updateText = useCallback((id: string, text: string) => {
    onChange(subStepsRef.current.map((s) => (s.id === id ? { ...s, text } : s)));
  }, [onChange]);

  const removeSubStep = useCallback((id: string) => {
    const filtered = subStepsRef.current
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, sort_order: i }));
    // Never go below MIN_SLOTS in edit mode
    if (filtered.length < MIN_SLOTS) {
      const padded = [...filtered];
      for (let i = filtered.length; i < MIN_SLOTS; i++) {
        padded.push(makeEmptySlot(i));
      }
      onChange(padded);
    } else {
      onChange(filtered);
    }
  }, [onChange]);

  const moveUp = useCallback((id: string) => {
    const items = [...subStepsRef.current];
    const idx = items.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    onChange(items.map((s, i) => ({ ...s, sort_order: i })));
  }, [onChange]);

  const moveDown = useCallback((id: string) => {
    const items = [...subStepsRef.current];
    const idx = items.findIndex((s) => s.id === id);
    if (idx < 0 || idx >= items.length - 1) return;
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    onChange(items.map((s, i) => ({ ...s, sort_order: i })));
  }, [onChange]);

  // In read-only mode, only show sub-steps with text
  const displaySteps = readOnly ? subSteps.filter((s) => s.text.trim()) : subSteps;

  // Seeded / AI-generated sub-steps can arrive with missing or duplicate ids;
  // derive a guaranteed-unique render key per row so React doesn't warn and
  // mis-reconcile inputs on reorder. Stable ids pass through untouched.
  const seenKeys = new Set<string>();
  const rowKeyFor = (step: SubStep, index: number) => {
    let key = step.id || `slot-${index}`;
    while (seenKeys.has(key)) key = `${key}-${index}`;
    seenKeys.add(key);
    return key;
  };

  return (
    <View style={styles.container}>
      {displaySteps.map((step, index) => (
        readOnly ? (
          <View key={rowKeyFor(step, index)} style={styles.row}>
            <Text style={{ fontSize: 13, color: STEP_COLORS.secondaryLabel, width: 18 }}>{index + 1}.</Text>
            <Text style={{ flex: 1, fontSize: 14, color: STEP_COLORS.label }}>{step.text}</Text>
          </View>
        ) : (
          <SubStepRow
            key={rowKeyFor(step, index)}
            step={step}
            index={index}
            total={displaySteps.length}
            onTextChange={updateText}
            onRemove={removeSubStep}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        )
      ))}

      {!readOnly && (
        <Pressable style={styles.addButton} onPress={addSubStep}>
          <Ionicons name="add-circle-outline" size={20} color={STEP_COLORS.accent} />
          <Text style={styles.addText}>Add sub-step</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: IOS_SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
  },
  reorderColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingTop: Platform.OS === 'web' ? 0 : 2,
  },
  reorderButton: {
    padding: 2,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    paddingTop: Platform.OS === 'web' ? 4 : 8,
    minWidth: 20,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: SUBSTEP_LINE_HEIGHT,
    minHeight: SUBSTEP_MIN_HEIGHT,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none' } as any,
    }),
  },
  removeButton: {
    paddingTop: Platform.OS === 'web' ? 4 : 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.sm,
  },
  addText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
});
