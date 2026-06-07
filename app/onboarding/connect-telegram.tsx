/**
 * Connect Telegram Screen
 *
 * Final onboarding step. Offers to link the BetterAt Telegram bot so the user
 * can capture steps by chat or voice note without opening the app. Especially
 * valuable for the rural-entrepreneur personas (Priya & co.), who live in
 * Telegram and capture orders/supplier runs by Hindi voice note — so the copy
 * leans into that when a livelihood interest is active. Fully skippable.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Linking,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useInterest } from '@/providers/InterestProvider';

// Actual deployed bot handle — see memory reference_telegram_bot_handle.
const TELEGRAM_BOT_URL = 'https://t.me/betterat_bot';
const TELEGRAM_BLUE = '#229ED9';

// Livelihood/entrepreneur interests get capture-first copy (they live in chat).
const LIVELIHOOD_SLUGS = new Set([
  'lac-craft-business',
  'food-processing',
  'textile-weaving',
]);

type Benefit = { icon: keyof typeof Ionicons.glyphMap; text: string };

const GENERIC_BENEFITS: Benefit[] = [
  { icon: 'mic-outline', text: 'Capture a session by voice note — it lands on your timeline' },
  { icon: 'camera-outline', text: 'Snap a photo and it becomes evidence automatically' },
  { icon: 'chatbubbles-outline', text: 'Ask your coach anything, right from the chat you already use' },
];

const LIVELIHOOD_BENEFITS: Benefit[] = [
  { icon: 'mic-outline', text: 'Log orders and supplier runs by voice note — in your own language' },
  { icon: 'camera-outline', text: 'Send a photo of the batch and it saves to your records' },
  { icon: 'cash-outline', text: 'Track what came in this week without opening the app' },
];

export default function ConnectTelegramScreen() {
  const router = useRouter();
  const { currentInterest } = useInterest();
  const [opened, setOpened] = useState(false);

  const isLivelihood = !!currentInterest?.slug && LIVELIHOOD_SLUGS.has(currentInterest.slug);
  const benefits = isLivelihood ? LIVELIHOOD_BENEFITS : GENERIC_BENEFITS;
  const headline = isLivelihood
    ? 'Run it from Telegram'
    : 'Capture without opening the app';
  const subheadline = isLivelihood
    ? 'You already live in Telegram. Connect the BetterAt bot and capture your day by chat or voice note.'
    : 'Connect the BetterAt bot to log steps, photos, and voice notes straight from Telegram.';

  const finish = useCallback(() => {
    router.replace('/(tabs)/races');
  }, [router]);

  const handleConnect = useCallback(async () => {
    try {
      await Linking.openURL(TELEGRAM_BOT_URL);
      setOpened(true);
    } catch {
      // If Telegram isn't installed, just let them continue.
      setOpened(true);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.badgeRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="paper-plane" size={30} color={TELEGRAM_BLUE} />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(500).springify()}
            style={styles.headlineContainer}
          >
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subheadline}>{subheadline}</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.benefitList}>
            {benefits.map((benefit, index) => (
              <Animated.View
                key={benefit.text}
                entering={FadeInDown.delay(450 + index * 80)
                  .duration(350)
                  .springify()}
                style={styles.benefitRow}
              >
                <View style={styles.benefitIconContainer}>
                  <Ionicons name={benefit.icon} size={20} color={TELEGRAM_BLUE} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(700).duration(400)} style={styles.footer}>
          {opened ? (
            <>
              <TouchableOpacity
                testID="connect-telegram-continue"
                style={styles.primaryButton}
                onPress={finish}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Continue to BetterAt</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConnect} activeOpacity={0.7} style={styles.skipButton}>
                <Text style={styles.skipText}>Open Telegram again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                testID="connect-telegram-connect"
                style={styles.primaryButton}
                onPress={handleConnect}
                activeOpacity={0.85}
              >
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Connect on Telegram</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="connect-telegram-skip"
                onPress={finish}
                activeOpacity={0.7}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>Maybe later</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 40 : 48,
    justifyContent: 'center',
  },
  badgeRow: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TELEGRAM_BLUE + '15',
  },
  headlineContainer: {
    marginBottom: 36,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 23,
  },
  benefitList: {
    gap: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TELEGRAM_BLUE + '15',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 36,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: TELEGRAM_BLUE,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: TELEGRAM_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
