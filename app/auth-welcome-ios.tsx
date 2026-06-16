/**
 * Auth Welcome — iOS register preview (pre-auth landing)
 *
 * Eleventh and last iOS-register preview surface. The first surface a
 * new user sees. Pre-auth — no app chrome, no tab nav, no floating nav.
 * Full-bleed white (intentional departure from the system gray 6 used
 * everywhere else in the register — pre-auth has no app chrome to
 * ground).
 *
 * Three-band vertical composition:
 *   1. Wordmark band — "BetterAt" mixed-weight (Better bold, At regular
 *      in secondary label)
 *   2. Hero — 32pt regular headline + 17pt secondary sub
 *   3. Action stack — Continue with phone (iOS blue fill), Sign in
 *      (text-only), Terms · Privacy footer
 *
 * Architectural commitments (from the design's side rail):
 *   - Full-bleed white #FFFFFF (not system gray 6) — pre-auth has no
 *     app chrome to ground; the gray ground that holds white cards
 *     elsewhere becomes white itself when there are no cards.
 *   - iOS blue replaces Ocean Blue #2563EB — same register rule
 *     applied universally.
 *   - One declarative headline in the product's actual language. No
 *     marketing copy, no carousel, no social proof slot.
 *   - Three-band vertical composition: wordmark top, hero centered,
 *     action stack bottom.
 *
 * Open at /auth-welcome-ios.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export default function AuthWelcomeIosPreview() {
  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Tiny close glyph top-right — only because this is a preview;
            real Auth Welcome has no chrome at all */}
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.labelTertiary}
            />
          </Pressable>
        </View>

        {/* Band 1 — Wordmark */}
        <View style={styles.wordmarkBand}>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkB}>Better</Text>
            <Text style={styles.wordmarkA}>At</Text>
          </Text>
        </View>

        {/* Band 2 — Hero (centered) */}
        <View style={styles.hero}>
          <Text style={styles.headline}>
            Get better at the things you care about.
          </Text>
          <Text style={styles.sub}>
            Drop a link to something inspiring. We'll build the plan.
          </Text>
        </View>

        {/* Band 3 — Action stack (bottom) */}
        <View style={styles.actions}>
          <Pressable
            style={styles.ctaPrimary}
            accessibilityRole="button"
            accessibilityLabel="Continue with phone"
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.ctaPrimaryText}>Continue with phone</Text>
          </Pressable>
          <Pressable
            style={styles.ctaSecondary}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={() => router.push('/(auth)/login' as any)}
          >
            <Text style={styles.ctaSecondaryText}>Sign in</Text>
          </Pressable>
          <View style={styles.legalRow}>
            <Pressable hitSlop={4}>
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalSep}>·</Text>
            <Pressable hitSlop={4}>
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF', // full-bleed white, NOT system gray 6
  },
  safe: {
    flex: 1,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  leftPad: { width: 1 },
  glyphBtn: { padding: 6 },
  // Band 1 — Wordmark
  wordmarkBand: {
    paddingTop: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 22,
    letterSpacing: -0.2,
  },
  wordmarkB: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  wordmarkA: {
    fontWeight: '400',
    color: IOS_REGISTER.labelSecondary,
  },
  // Band 2 — Hero
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 20,
  },
  headline: {
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 38,
    letterSpacing: -0.7,
    color: IOS_REGISTER.label,
    textAlign: 'center',
    marginBottom: 16,
  },
  sub: {
    fontSize: 17,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 24,
    letterSpacing: -0.34,
    textAlign: 'center',
  },
  // Band 3 — Actions
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingVertical: 16,
    borderRadius: 999,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  ctaSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ctaSecondaryText: {
    fontSize: 17,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
  },
  legalLink: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  legalSep: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
  },
});
