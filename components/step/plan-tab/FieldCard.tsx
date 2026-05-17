/**
 * <FieldCard> — composable card for WHAT / HOW / WHY (and any future plan field).
 *
 * Phase 1 · iOS register (revised by Phase 1 refinements, D25 + D26).
 * White card with eyebrow + body. AI affordance lives in <AIHelperLine> at the
 * top of the Plan body — no per-field spark button.
 *
 * Text inputs auto-grow with content (no inner scrollbar). The Plan body
 * scrolls; individual fields do not.
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html
 *            .field-card · line 694–732
 * Refinements: docs/redesign/ios-register/phase-1-refinements.md (§ D25, D26)
 */

import React, { useState } from 'react';
import {
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  View,
  type ViewStyle,
} from 'react-native';
import { HelpCircle, Lightbulb, List } from 'lucide-react-native';
import {
  GRAY_5,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export type FieldCardIcon = 'bulb' | 'list' | 'help';

const LINE_HEIGHT = 19;
const MIN_LINES = 1;
const MAX_LINES = 8;
const MIN_HEIGHT = LINE_HEIGHT * MIN_LINES;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;

export interface FieldCardProps {
  eyebrow: string;
  icon: FieldCardIcon;
  placeholder: string;
  value: string;
  onChangeText?: (v: string) => void;
  multiline?: boolean;
  readOnly?: boolean;
  style?: ViewStyle;
  /**
   * Optional render override for the body. If omitted, a TextInput is rendered
   * using `value` / `onChangeText`. Use this slot when the body is not a simple
   * text field (e.g. SubStepEditor for the HOW field).
   */
  renderBody?: () => React.ReactNode;
  testID?: string;
}

function IconForKind({ kind }: { kind: FieldCardIcon }) {
  if (kind === 'bulb') return <Lightbulb size={12} color={LABEL_3} />;
  if (kind === 'list') return <List size={12} color={LABEL_3} />;
  return <HelpCircle size={12} color={LABEL_3} />;
}

export function FieldCard({
  eyebrow,
  icon,
  placeholder,
  value,
  onChangeText,
  multiline = true,
  readOnly,
  style,
  renderBody,
  testID,
}: FieldCardProps) {
  const [contentHeight, setContentHeight] = useState<number>(MIN_HEIGHT);

  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const next = e.nativeEvent.contentSize.height;
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next));
    if (clamped !== contentHeight) setContentHeight(clamped);
  };

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.head}>
        <View style={styles.eye}>
          <IconForKind kind={icon} />
          <Text style={styles.eyeText}>{eyebrow}</Text>
        </View>
      </View>
      {renderBody ? (
        renderBody()
      ) : (
        <TextInput
          style={[
            styles.input,
            multiline ? { height: contentHeight } : null,
            !value && styles.inputEmpty,
          ]}
          value={value}
          onChangeText={readOnly ? undefined : onChangeText}
          placeholder={readOnly ? '' : placeholder}
          placeholderTextColor={LABEL_3}
          multiline={multiline}
          onContentSizeChange={multiline ? handleContentSizeChange : undefined}
          scrollEnabled={false}
          textAlignVertical="top"
          editable={!readOnly}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  eye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 13.5,
    color: LABEL,
    letterSpacing: -0.05,
    lineHeight: LINE_HEIGHT,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any,
    }),
  },
  inputEmpty: {
    fontStyle: 'italic',
  },
});
