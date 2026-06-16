/**
 * Welcome — Hero screen.
 *
 * First screen of the welcome flow. Shows the brand mark, value prop, and a
 * "Get started" CTA. Returning users should never see this — `app/index.tsx`
 * skips the welcome stack when an interest slug is cached.
 */

import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const ACCENT = '#007AFF';
const BRAND_DARK = '#0B1A33';

export default function WelcomeHeroScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Top bar: Skip (top-right) */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace('/welcome/pick')}
            hitSlop={12}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
          >
            <Text style={styles.skipText}>Skip intro</Text>
          </Pressable>
        </View>

        {/* Top spacer pushes content into the upper-third of the screen */}
        <View style={styles.spacerTop} />

        {/* Hero stack: brand mark + wordmark + headline + subtitle */}
        <View style={styles.heroStack}>
          <Animated.View
            entering={FadeInDown.duration(450)}
            style={styles.brandBlock}
          >
            {/* Soft accent ring behind the mark for visual anchor */}
            <View style={styles.brandRing} />
            <Image
              source={require('@/assets/images/brand-mark-large.png')}
              style={styles.brandMark}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(80).duration(450)}
            style={styles.brandWordmark}
          >
            BetterAt
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(180).duration(450)}
            style={styles.title}
          >
            Get better at the things you care about
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(260).duration(450)}
            style={styles.subtitle}
          >
            A daily practice for the stuff you actually want to improve at.
          </Animated.Text>
        </View>

        {/* Bottom spacer absorbs remaining height */}
        <View style={styles.spacerBottom} />

        {/* CTAs */}
        <Animated.View
          entering={FadeInDown.delay(340).duration(450)}
          style={styles.ctaBlock}
        >
          <Pressable
            onPress={() => router.push('/welcome/how-it-works')}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.primaryBtnIcon} />
          </Pressable>

          <Text style={styles.reassurance}>No account needed to start</Text>

          <View style={styles.authLinksRow}>
            <Pressable
              onPress={() =>
                router.push('/(auth)/login?returnTo=/welcome/pick' as any)
              }
              hitSlop={12}
              style={styles.secondaryLink}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Log in"
              testID="welcome-login-link"
            >
              <Text style={styles.secondaryLinkText}>
                Have an account? <Text style={styles.secondaryLinkBold}>Log in</Text>
              </Text>
            </Pressable>
            <Text style={styles.authLinksDot}>·</Text>
            <Pressable
              onPress={() => router.push('/(auth)/signup' as any)}
              hitSlop={12}
              style={styles.secondaryLink}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
              testID="welcome-create-account-link"
            >
              <Text style={styles.secondaryLinkText}>
                <Text style={styles.secondaryLinkBold}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const BRAND_MARK_SIZE = 96;
const BRAND_RING_SIZE = 156;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 18,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 32,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  skipBtnPressed: {
    opacity: 0.55,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    ...Platform.select({
      ios: { fontFamily: 'Manrope-SemiBold' },
      android: { fontFamily: 'Manrope-SemiBold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '600' as const },
    }),
  },

  // Spacers control vertical rhythm so content anchors in the upper-third
  spacerTop: {
    flexGrow: 0.6,
  },
  spacerBottom: {
    flexGrow: 1,
  },

  // Hero stack
  heroStack: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  // Brand block: ring + mark
  brandBlock: {
    width: BRAND_RING_SIZE,
    height: BRAND_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  brandRing: {
    position: 'absolute',
    width: BRAND_RING_SIZE,
    height: BRAND_RING_SIZE,
    borderRadius: BRAND_RING_SIZE / 2,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.10)',
  },
  brandMark: {
    width: BRAND_MARK_SIZE,
    height: BRAND_MARK_SIZE,
    borderRadius: 24,
    // Lift the mark off the background
    shadowColor: BRAND_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
  },
  brandWordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND_DARK,
    letterSpacing: -0.3,
    marginBottom: 22,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },

  // Headline
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 14,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 16,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // CTAs
  ctaBlock: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryBtnPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.22,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  primaryBtnIcon: {
    marginLeft: 8,
  },
  reassurance: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },
  authLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  authLinksDot: {
    fontSize: 14,
    color: '#94A3B8',
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  secondaryLinkBold: {
    color: ACCENT,
    fontWeight: '600',
  },
});
