import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const IOS_BLUE_TINT = 'rgba(0, 122, 255, 0.10)';
const CORAL = '#FF6B6B';
const GRAY_4 = '#D1D1D6';
const GRAY_6 = '#F2F2F7';
const LABEL = '#1C1C1E';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

const PULSE_DURATION_MS = 1800;

export interface DoComposerProps {
  /** Placeholder text inside the composer field. */
  placeholder?: string;
  readOnly?: boolean;
  onAddQuickNote?: () => void;
  onAddPhoto?: () => void;
  onAddVoiceNote?: () => void;
}

/**
 * Frame 2 · F — Composer.
 * Three first-class affordances: typed note, photo, voice. Mic is the largest
 * target (44 — Apple's min hit) and the only animated control on the surface.
 */
export function DoComposer({
  placeholder = 'Add a capture…',
  readOnly,
  onAddQuickNote,
  onAddPhoto,
  onAddVoiceNote,
}: DoComposerProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (readOnly) return undefined;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: PULSE_DURATION_MS,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, readOnly]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0, 0] });

  return (
    <View
      style={[styles.composer, readOnly && styles.composerDisabled]}
      accessibilityLabel="Capture composer"
    >
      <View style={styles.field}>
        <View style={styles.icoAdd}>
          <Ionicons name="add" size={13} color={IOS_BLUE} />
        </View>
        <Text style={styles.fieldText} numberOfLines={1}>
          {placeholder}
        </Text>
      </View>

      <View style={styles.actions}>
        <CircleButton
          icon="create-outline"
          onPress={onAddQuickNote}
          disabled={readOnly}
          accessibilityLabel="Type a note"
        />
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
          {!readOnly ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
          ) : null}
          <Ionicons name="mic" size={19} color="#FFFFFF" />
        </Pressable>
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
  fieldText: {
    flex: 1,
    fontSize: 13,
    color: LABEL_3,
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  micRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORAL,
  },
});
