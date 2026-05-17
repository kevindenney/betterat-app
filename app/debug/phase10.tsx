import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import {
  InstallSheet,
  RedeemLanding,
  SmartAppBanner,
  WelcomeToast,
} from '@/components/onboarding';

const SAMPLE_BLUEPRINT = {
  id: 'sample-blueprint',
  title: 'Worlds prep — six months on a single line',
  stepCount: 12,
  durationMonths: 6,
  capabilities: ['Heavy-air helm', 'Light-air starts', 'Lane defense', 'Crew calls', 'Mark roundings'],
};

const SAMPLE_AUTHOR = {
  name: 'Kevin Denney',
  affiliation: 'RHKYC',
  avatarInitials: 'KD',
};

export default function Phase10Debug() {
  const [installVisible, setInstallVisible] = useState(false);
  const [variant, setVariant] = useState<'valid' | 'invalid'>('valid');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Phase 10 · HKDW onboarding' }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Smart App Banner">
          <View style={styles.bannerHost}>
            <SmartAppBanner
              appName="BetterAt"
              description="Open in app for voice capture & offline"
              installUrl="https://apps.apple.com/"
              page="debug/phase10"
            />
          </View>
          <Text style={styles.note}>
            The real banner pins to the top of every web page and persists dismissal for 7 days via
            localStorage. iOS-only Safari surface — Android and native render nothing.
          </Text>
        </Section>

        <Section title="Welcome toast (after redeem)">
          <WelcomeToast
            variant="subscription"
            subscriptionSource="Kevin's HKDW blueprint"
            count={{ steps: 12, freeMonths: 3, fleetSize: 63 }}
          />
        </Section>

        <Section title="Redeem landing">
          <View style={styles.variantRow}>
            <Pressable
              style={[styles.chip, variant === 'valid' && styles.chipActive]}
              onPress={() => setVariant('valid')}
            >
              <Text style={[styles.chipText, variant === 'valid' && styles.chipTextActive]}>Valid token</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, variant === 'invalid' && styles.chipActive]}
              onPress={() => setVariant('invalid')}
            >
              <Text style={[styles.chipText, variant === 'invalid' && styles.chipTextActive]}>Invalid token</Text>
            </Pressable>
          </View>
          <View style={styles.landingHost}>
            {variant === 'valid' ? (
              <RedeemLanding
                token="HKDW-WLDS-2026-SAMPLE"
                blueprintAuthor={SAMPLE_AUTHOR}
                blueprint={SAMPLE_BLUEPRINT}
                fleetCount={63}
                fleetSampleAvatars={[
                  { initials: 'HE', color: '#9333EA' },
                  { initials: 'PL', color: '#16A34A' },
                  { initials: 'BV', color: '#0EA5E9' },
                ]}
                freeMonths={3}
                postFreePrice="$9/mo"
                onAccept={async () => undefined}
                onSkip={() => undefined}
              />
            ) : (
              <View style={styles.invalidHost}>
                <Text style={styles.invalidTitle}>This invitation has expired or already been used</Text>
                <Text style={styles.invalidBody}>
                  Reach out to whoever shared it for a fresh link.
                </Text>
              </View>
            )}
          </View>
        </Section>

        <Section title="Install sheet (Do tab on web)">
          <Pressable style={styles.btn} onPress={() => setInstallVisible(true)}>
            <Text style={styles.btnText}>Open install sheet</Text>
          </Pressable>
        </Section>

        <Section title="Sample redeem deep link">
          <Pressable
            style={styles.btn}
            onPress={() => router.push('/r/HKDW-WLDS-2026-SAMPLE' as any)}
          >
            <Text style={styles.btnText}>Open /r/HKDW-WLDS-2026-SAMPLE</Text>
          </Pressable>
          <Text style={styles.note}>
            Sample token is mocked in dev — no real database side effects. Flag must be on
            (EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW=true).
          </Text>
        </Section>
      </ScrollView>

      <InstallSheet
        visible={installVisible}
        appName="BetterAt"
        page="debug/phase10"
        onInstall={() => setInstallVisible(false)}
        onNotNow={() => setInstallVisible(false)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
  },
  bannerHost: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  variantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  landingHost: {
    minHeight: 540,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  invalidHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
    gap: 8,
  },
  invalidTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  invalidBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
