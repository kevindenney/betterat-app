/**
 * HeroMicComposer — On the Water capture surface composer.
 *
 * Two 44px satellites flanking an 84px hero mic. Camera left, Flag right
 * (coral). The user can capture in motion with one tap: hold-to-speak,
 * snap a photo, or tag the moment silently with the flag.
 *
 * Architectural principle (carried from the editorial register, inverted
 * for iOS): CAPTURE surfaces get the hero mic; COMPOSITION surfaces get
 * the toolbar (see ToolbarComposer). On the Water is a capture surface.
 *
 * The flag is the new component the iOS register introduces — the
 * lightest possible "this matters" gesture, sized to one tap.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  prompt?: string;
  onMicPress?: () => void;
  onMicLongPress?: () => void;
  onCameraPress?: () => void;
  onFlagPress?: () => void;
}

export function HeroMicComposer({
  prompt = 'Capture.',
  onMicPress,
  onMicLongPress,
  onCameraPress,
  onFlagPress,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>{prompt}</Text>
      <View style={styles.cluster}>
        <Pressable
          style={styles.sat}
          onPress={onCameraPress}
          accessibilityLabel="Camera"
          accessibilityRole="button"
        >
          <Ionicons
            name="camera"
            size={19}
            color="rgba(255, 255, 255, 0.92)"
          />
        </Pressable>
        <Pressable
          style={styles.mic}
          onPress={onMicPress}
          onLongPress={onMicLongPress}
          accessibilityLabel="Hold to speak"
          accessibilityRole="button"
        >
          <Ionicons name="mic" size={36} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.sat, styles.satFlag]}
          onPress={onFlagPress}
          accessibilityLabel="Flag this moment for the playbook"
          accessibilityRole="button"
        >
          <Ionicons
            name="flag"
            size={19}
            color={IOS_REGISTER.accentMarkedContent}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  prompt: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: -0.1,
    marginBottom: 14,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  sat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satFlag: {
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
  },
  mic: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: IOS_REGISTER.accentUserAction,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0, 122, 255, 0.32)',
      } as any,
      default: {
        shadowColor: IOS_REGISTER.accentUserAction,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
  },
});
