/**
 * Welcome — Pick your first focus.
 *
 * Third and final screen of the welcome flow. Reuses `InterestSelectionContent`
 * with welcome-specific copy and a back button. After the user picks an
 * interest, `InterestSelectionContent` persists it via the InterestProvider
 * (cache + DB if signed in), and we replace into the races tab.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { InterestSelectionContent } from '@/components/onboarding/InterestSelection';
import { BrandMark } from '@/components/BrandMark';

const BRAND_DARK = '#0B1A33';

function BrandPill() {
  return (
    <View style={styles.brandPill}>
      <BrandMark size={32} />
      <Text style={styles.brandPillText}>BetterAt</Text>
    </View>
  );
}

export default function WelcomePickScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <InterestSelectionContent
        title="What do you want to get better at?"
        subtitle="Pick one to begin your practice — you can add more anytime."
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/welcome');
          }
        }}
        onComplete={() => router.replace('/(tabs)/races')}
        headerSlot={<BrandPill />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  // Brand pill (consistent with hero + how-it-works)
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
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
});
