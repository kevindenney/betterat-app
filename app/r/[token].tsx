/**
 * /r/[token] · Partner redeem landing (stub)
 *
 * Minimal welcome page rendered when a sailor opens a partner-minted
 * redeem URL (e.g. from the DragonWorlds HK 2027 app). The full Phase 10
 * RedeemLanding lives on the `feat/phase-10-hkdw-onboarding` branch and
 * pulls in component/service/hook/auth machinery that isn't on main yet.
 *
 * Until that branch merges, this stub gives partner-minted tokens a
 * landing page instead of the 404 Expo Router used to serve. Three
 * states:
 *
 *   - loading       — looking up the token
 *   - valid         — Dragon Worlds welcome card + "Continue in app" CTA
 *   - invalid/used  — graceful fallback that points to BetterAt home
 *
 * No auth, no consume, no telemetry. Sailors land here, see the offer,
 * and tap through to the App Store / Play Store. Full Phase 10 flow
 * replaces this file on merge.
 */
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

const APP_STORE_URL = 'https://apps.apple.com/app/betterat/id6448077833';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.betterat.app';

const CAPABILITY_CHIPS = [
  'heavy-air helm',
  'starts',
  'wind reading',
  'tactical',
  'crew comms',
];

interface ResolvedToken {
  token: string;
  blueprint_id: string;
  valid_to: string;
  source: string;
  already_used: boolean;
}

async function resolveRedeemToken(token: string): Promise<ResolvedToken | null> {
  const { data, error } = await supabase.rpc('resolve_redeem_token', { p_token: token });
  if (error) {
    console.warn('[redeem/stub] resolve failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

async function loadBlueprintTitle(blueprintId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('timeline_blueprints')
    .select('title')
    .eq('id', blueprintId)
    .maybeSingle();
  if (error) return null;
  return (data as { title: string } | null)?.title ?? null;
}

function openAppStore() {
  const url = Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
  Linking.openURL(url).catch(() => {});
}

export default function RedeemStubRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const { data: resolved, isLoading } = useQuery({
    queryKey: ['stub-redeem-token', token],
    queryFn: () => resolveRedeemToken(token!),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });

  const { data: blueprintTitle } = useQuery({
    queryKey: ['stub-redeem-blueprint', resolved?.blueprint_id],
    queryFn: () => loadBlueprintTitle(resolved!.blueprint_id),
    enabled: !!resolved?.blueprint_id,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#4630EB" />
      </View>
    );
  }

  if (!resolved) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.invalidTitle}>This invitation has expired</Text>
        <Text style={styles.invalidBody}>
          Reach out to whoever shared it for a fresh link, or explore BetterAt directly.
        </Text>
        <Pressable
          style={styles.secondaryCta}
          onPress={() => Linking.openURL('https://www.better.at').catch(() => {})}
        >
          <Text style={styles.secondaryCtaText}>Explore BetterAt</Text>
        </Pressable>
      </View>
    );
  }

  const isAlreadyUsed = resolved.already_used;
  // Surface the live blueprint title when known; otherwise fall back to the
  // canonical Worlds copy. Read-only — UI hardcodes the "Prepare for the
  // Dragon Worlds 2027" italic-serif title since that's the welcome moment.
  void blueprintTitle;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.brandRow}>
        <View style={styles.logoDot} />
        <Text style={styles.brandName}>BetterAt</Text>
      </View>

      <View style={styles.welcomePill}>
        <Text style={styles.welcomePillText}>WELCOMING YOU · 90 DAYS FREE</Text>
      </View>

      <Text style={styles.coachByline}>
        Kevin Denney, your Worlds coach, is welcoming you to
      </Text>
      <Text style={styles.headline}>"Prepare for the Dragon Worlds 2027."</Text>
      <Text style={styles.subhead}>
        A path through the conditions you'll race in November — boat speed, heavy-air
        helm work, starts, fleet tactics.
      </Text>

      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>STEPS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>6</Text>
          <Text style={styles.statLabel}>MONTHS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>CAPABILITIES</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {CAPABILITY_CHIPS.map((label) => (
          <View key={label} style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>
        ))}
      </View>

      {isAlreadyUsed ? (
        <View style={styles.alreadyUsedNote}>
          <Text style={styles.alreadyUsedTitle}>You've already claimed this</Text>
          <Text style={styles.alreadyUsedBody}>
            Open BetterAt to pick up where you left off.
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.primaryCta} onPress={openAppStore}>
        <Text style={styles.primaryCtaText}>
          {isAlreadyUsed ? 'Open BetterAt' : 'Accept & start preparing'}
        </Text>
      </Pressable>

      <Text style={styles.fineprint}>
        Free for 90 days · then $9/mo · cancel anytime · no card now
      </Text>

      <Text style={styles.tokenLabel}>
        Invitation: {resolved.token}
      </Text>
    </ScrollView>
  );
}

const BRAND_PRIMARY = '#4630EB';
const BG = '#FAFAF7';
const TEXT_PRIMARY = '#1A1A1A';
const TEXT_SECONDARY = '#5C5C5C';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E5E0';

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  logoDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TEXT_PRIMARY,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  welcomePill: {
    alignSelf: 'center',
    backgroundColor: BRAND_PRIMARY + '15',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  welcomePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: BRAND_PRIMARY,
  },
  coachByline: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    fontStyle: 'italic',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  subhead: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: BORDER,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 28,
  },
  chip: {
    backgroundColor: CARD_BG,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
  },
  alreadyUsedNote: {
    backgroundColor: '#FFF7E5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  alreadyUsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  alreadyUsedBody: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  primaryCta: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fineprint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  tokenLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    opacity: 0.5,
    textAlign: 'center',
  },
  invalidTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  invalidBody: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  secondaryCta: {
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryCtaText: {
    color: BRAND_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
});
