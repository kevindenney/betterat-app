/**
 * DesktopOnlyGate
 *
 * One reusable, on-register gate for management-class surfaces that are
 * not phone-screen jobs (Org admin / People, Creator Studio, Cohorts).
 * Rendered on narrow (phone) viewports in place of the real surface.
 *
 * Register: gray6 ground, a single white card (16pt radius / 20pt padding
 * / standard card shadow), SF Pro (system default). Plain-language title +
 * one line of body + a single next-action button — the error-state
 * principle (say what's happening, give one way forward). No error code,
 * no decorative icon clutter, no editorial cream/navy/lavender.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_REGISTER, IOS_RADIUS, IOS_SHADOWS, IOS_SPACING } from '@/lib/design-tokens-ios';

/** Below this width we treat the viewport as a phone and show the gate. */
export const DESKTOP_GATE_MIN_WIDTH = 920;

export function DesktopOnlyGate({
  title = 'Better on a bigger screen',
  body = 'Managing members and cohorts needs more room than a phone gives — open BetterAt on iPad or desktop.',
  onBack,
}: {
  title?: string;
  body?: string;
  onBack?: () => void;
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.ground}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            onPress={handleBack}
            style={styles.button}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back to BetterAt"
          >
            <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Back to BetterAt</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: IOS_SPACING.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: IOS_RADIUS.lg,
    padding: IOS_SPACING.xl,
    alignItems: 'center',
    ...IOS_SHADOWS.card,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    marginTop: IOS_SPACING.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: IOS_SPACING.xl,
    borderRadius: IOS_RADIUS.md,
    backgroundColor: IOS_REGISTER.accentUserAction,
    marginTop: IOS_SPACING.xl,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
