/**
 * Welcome — How it works.
 *
 * Second screen of the welcome flow. Three short value-prop cards (Capture /
 * Plan / Reflect) and a "Continue" CTA. Pure marketing — kept short on purpose
 * so the picker on the next screen feels like the real onboarding.
 */

import React from 'react';
import {
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

import { BrandMark } from '@/components/BrandMark';

const ACCENT = '#007AFF';
const BRAND_DARK = '#0B1A33';

type Step = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: 'sparkles',
    iconColor: '#007AFF',
    title: 'Capture',
    body: 'Drop notes, photos, and videos as you go — anything that helps you learn.',
  },
  {
    icon: 'compass',
    iconColor: '#16A34A',
    title: 'Plan',
    body: 'Build a routine that fits your life, with steps you actually want to do.',
  },
  {
    icon: 'sync',
    iconColor: '#DB2777',
    title: 'Reflect',
    body: 'Look back, learn, and adjust — your best ideas come from your own work.',
  },
];

export default function WelcomeHowItWorksScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Top bar: back (left) + skip (right) */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
          </Pressable>

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

        {/* Subtle brand pill (consistent with hero) */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.brandPill}
        >
          <BrandMark size={32} />
          <Text style={styles.brandPillText}>BetterAt</Text>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.header}>
          <Text style={styles.title}>How it works</Text>
          <Text style={styles.subtitle}>Three simple ideas, one daily habit.</Text>
        </Animated.View>

        {/* Steps — grouped on a single card so the trio reads as one idea */}
        <Animated.View entering={FadeInDown.delay(200).duration(420)} style={styles.stepsCard}>
          {STEPS.map((step, index) => (
            <View key={step.title}>
              {index > 0 && <View style={styles.stepDivider} />}
              <View style={styles.stepRow}>
                <View style={[styles.stepBadge, { backgroundColor: step.iconColor }]}>
                  <Ionicons name={step.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Footer: CTA + progress. Static (no entering animation) so the
            primary advance control is always painted and tappable. */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push('/welcome/pick')}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.primaryBtnIcon} />
          </Pressable>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotInactive]} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotInactive]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 24,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -8,
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

  // Brand pill (small, horizontal — consistent with hero)
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 8,
    marginBottom: 18,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.10)',
  },
  brandPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_DARK,
    letterSpacing: -0.1,
    marginRight: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },

  // Header
  header: {
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.4,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#64748B',
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Steps
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(11, 26, 51, 0.06)',
    shadowColor: BRAND_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  stepDivider: {
    height: 1,
    backgroundColor: 'rgba(11, 26, 51, 0.06)',
    marginLeft: 64,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 18,
  },
  stepBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  stepText: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  stepBody: {
    fontSize: 14.5,
    lineHeight: 20,
    color: '#64748B',
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    gap: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: ACCENT,
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryBtnIcon: {
    marginLeft: 8,
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: '#1A1A1A',
  },
  dotInactive: {
    backgroundColor: '#D4D4D8',
  },
});
