import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const IOS_BLUE_TINT = 'rgba(0, 122, 255, 0.10)';
const CORAL = '#FF6B6B';
const GRAY_4 = '#D1D1D6';
const GRAY_6 = '#F2F2F7';
const LABEL = '#1C1C1E';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface DoComposerProps {
  /** Placeholder text inside the composer field. */
  placeholder?: string;
  readOnly?: boolean;
  onAddMore?: () => void;
  onAddPhoto?: () => void;
  onAddVoiceNote?: () => void;
  /** Inline note submit — fired on Return / send tap with the trimmed body. */
  onSubmitNote?: (text: string) => void;
}

/**
 * Frame 2 · F — Composer.
 * The text field is inline: type and hit Return (or the send arrow) to add a
 * note without opening a sheet. While the field is empty the right cluster
 * shows photo + voice; once there's text it swaps to a send button. Mic stays
 * the largest target (44 — Apple's min hit) and is static.
 */
export function DoComposer({
  placeholder = 'Add a capture…',
  readOnly,
  onAddMore,
  onAddPhoto,
  onAddVoiceNote,
  onSubmitNote,
}: DoComposerProps) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const canSend = !readOnly && trimmed.length > 0;

  const handleSend = () => {
    if (!canSend) return;
    onSubmitNote?.(trimmed);
    setDraft('');
  };

  return (
    <View
      style={[styles.composer, readOnly && styles.composerDisabled]}
      accessibilityLabel="Capture composer"
    >
      <View style={styles.field}>
        <Pressable
          onPress={readOnly ? undefined : onAddMore}
          disabled={readOnly}
          accessibilityRole="button"
          accessibilityLabel="More capture types"
          accessibilityState={{ disabled: Boolean(readOnly) }}
          style={styles.icoAdd}
          hitSlop={8}
        >
          <Ionicons name="add" size={13} color={IOS_BLUE} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={LABEL_3}
          editable={!readOnly}
          multiline
          maxLength={4000}
          onSubmitEditing={handleSend}
          blurOnSubmit
          returnKeyType="send"
          style={styles.fieldInput}
          accessibilityLabel="Add a note"
        />
      </View>

      <View style={styles.actions}>
        {canSend ? (
          <Pressable
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Add note"
            style={({ pressed }) => [styles.send, pressed && styles.sendPressed]}
            hitSlop={4}
          >
            <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
          </Pressable>
        ) : (
          <>
            <CircleButton
              icon="camera-outline"
              onPress={onAddPhoto}
              disabled={readOnly}
              accessibilityLabel="Take a photo"
            />
            <Pressable
              onPress={readOnly ? undefined : onAddVoiceNote}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityLabel="Hold to record voice"
              accessibilityState={{ disabled: Boolean(readOnly) }}
              style={({ pressed }) => [styles.mic, pressed && !readOnly && styles.micPressed]}
              hitSlop={4}
            >
              <Ionicons name="mic" size={19} color="#FFFFFF" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

interface CircleButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

function CircleButton({ icon, onPress, disabled, accessibilityLabel }: CircleButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.aBtn,
        pressed && !disabled && styles.aBtnPressed,
        disabled && styles.aBtnDisabled,
      ]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={16} color={LABEL} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  composer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_4,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    minHeight: 56,
  },
  composerDisabled: {
    opacity: 0.6,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  icoAdd: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: IOS_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: LABEL,
    letterSpacing: -0.1,
    paddingVertical: 6,
    paddingHorizontal: 0,
    maxHeight: 96,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendPressed: {
    opacity: 0.86,
  },
  aBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GRAY_6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aBtnPressed: {
    opacity: 0.7,
  },
  aBtnDisabled: {
    opacity: 0.4,
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
    shadowColor: CORAL,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  micPressed: {
    opacity: 0.86,
  },
});
