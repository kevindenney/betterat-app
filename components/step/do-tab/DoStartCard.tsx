import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface DoStartCardProps {
  readOnly?: boolean;
  onVoiceNote?: () => void;
  onPhotoOrVideo?: () => void;
  onQuickNote?: () => void;
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
  onQuickNote,
}: DoStartCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Start capturing</Text>
      <Text style={styles.subtitle}>Voice, photo, or quick notes — capture as you go.</Text>

      <View style={styles.trio}>
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
        <CaptureButton
          label="Quick note"
          icon="create"
          accent="note"
          disabled={readOnly}
          onPress={onQuickNote}
          accessibilityLabel="Write a quick note"
        />
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
  trio: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    marginTop: 4,
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
