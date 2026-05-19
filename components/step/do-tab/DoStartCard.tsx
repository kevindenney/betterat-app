import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface DoStartCardProps {
  readOnly?: boolean;
  onVoiceNote?: () => void;
  onPhotoOrVideo?: () => void;
  /**
   * Direct text submit for the inline quick-note composer. Receives the
   * trimmed body. Caller should write into the captures list and clear UI.
   */
  onQuickNoteSubmit?: (text: string) => void;
}

interface CaptureButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: 'mic' | 'cam' | 'note';
  emphasized?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}

function CaptureButton({
  label,
  icon,
  accent,
  emphasized,
  disabled,
  onPress,
  accessibilityLabel,
}: CaptureButtonProps) {
  const iconBg = ICON_BG[accent];
  const iconSize = emphasized ? 26 : 22;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.capBtn,
        pressed && !disabled && styles.capBtnPressed,
        disabled && styles.capBtnDisabled,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={iconSize} color="#FFFFFF" />
      </View>
      <Text style={styles.capLabel}>{label}</Text>
    </Pressable>
  );
}

const ICON_BG: Record<'mic' | 'cam' | 'note', string> = {
  mic: IOS_COLORS.systemBlue,
  cam: IOS_COLORS.label,
  note: IOS_COLORS.systemGray,
};

export function DoStartCard({
  readOnly,
  onVoiceNote,
  onPhotoOrVideo,
  onQuickNoteSubmit,
}: DoStartCardProps) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const canSubmit = !readOnly && trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onQuickNoteSubmit?.(trimmed);
    setDraft('');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Start capturing</Text>
      <Text style={styles.subtitle}>Voice, photo, or quick notes — capture as you go.</Text>

      <View style={styles.duo}>
        <CaptureButton
          label="Voice note"
          icon="mic"
          accent="mic"
          emphasized
          disabled={readOnly}
          onPress={onVoiceNote}
          accessibilityLabel="Start a voice note"
        />
        <CaptureButton
          label="Photo or video"
          icon="camera"
          accent="cam"
          disabled={readOnly}
          onPress={onPhotoOrVideo}
          accessibilityLabel="Capture photo or video"
        />
      </View>

      {/* Inline quick-note composer — replaces the popup-modal flow. Type
          and tap send (or hit Return) to add a note without opening a
          separate sheet. */}
      <View style={styles.composerRow}>
        <View style={styles.composerIcon}>
          <Ionicons name="create-outline" size={16} color={IOS_COLORS.label} />
        </View>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Jot a quick note…"
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          editable={!readOnly}
          multiline
          maxLength={4000}
          onSubmitEditing={handleSubmit}
          blurOnSubmit
          returnKeyType="send"
          accessibilityLabel="Quick note"
        />
        <Pressable
          style={[styles.sendBtn, !canSubmit && styles.sendBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Add note"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <Text style={styles.emptyLine}>Captures will appear here as you go.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    padding: IOS_SPACING.md,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.sm,
  },
  duo: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    marginTop: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: IOS_SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  composerIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.label,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  capBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  capBtnPressed: {
    opacity: 0.7,
  },
  capBtnDisabled: {
    opacity: 0.4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptyLine: {
    fontSize: 12,
    fontStyle: 'italic',
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.sm,
  },
});
