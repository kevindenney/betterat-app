import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RelationshipButton } from '@/components/discover/detail';
import {
  YachtClubClaimService,
  type YachtClubOrganization,
} from '@/services/YachtClubClaimService';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  blue: '#0B63CE',
  green: '#0F766E',
  amber: '#B45309',
  red: '#B42318',
} as const;

function statusLabel(org: YachtClubOrganization): string {
  if (org.claim_status === 'claimed' && org.official) return 'Official BetterAt organization';
  if (org.claim_status === 'claim_pending') return 'Claim pending review';
  if (org.claim_status === 'rejected') return 'Claim rejected';
  return 'Unclaimed placeholder';
}

function tierLabel(tier: string | null): string {
  switch (tier) {
    case 'club_free':
      return 'Free club tier';
    case 'club_plus':
      return 'Club Plus';
    case 'club_pro':
      return 'Regatta / Club Pro';
    case 'enterprise':
      return 'Enterprise';
    default:
      return 'Club tier';
  }
}

export default function OrganizationPlaceholderPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<YachtClubOrganization | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const handleOpenAtlas = React.useCallback(() => {
    if (!slug) return;
    router.push({ pathname: '/(tabs)/atlas', params: { orgSlug: slug } } as any);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const nextOrg = await YachtClubClaimService.getOrganizationBySlug(slug);
        if (!nextOrg) throw new Error('Organization not found.');
        if (cancelled) return;
        setOrg(nextOrg);
      } catch (error: any) {
        if (!cancelled) setErrorText(error?.message || 'Could not load this organization.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isPlaceholder = org?.status === 'placeholder' || org?.official === false;
  const visibleAliases = Array.from(new Set(org?.aliases ?? []));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: org?.name || 'Organization' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : errorText || !org ? (
        <View style={styles.card}>
          <Ionicons name="business-outline" size={36} color={C.muted} />
          <Text style={styles.title}>Organization not found</Text>
          <Text style={styles.body}>{errorText || 'This organization may not exist yet.'}</Text>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.mark}>
              <Text style={styles.markText}>{org.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>BetterAt Yacht Clubs</Text>
            <Text style={styles.h1}>{org.name}</Text>
            <View style={[styles.badge, org.official ? styles.badgeOfficial : styles.badgePlaceholder]}>
              <Ionicons
                  name={org.official ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={15}
                  color={org.official ? C.green : C.amber}
                />
              <Text style={[styles.badgeText, org.official ? styles.officialText : styles.placeholderText]}>
                {statusLabel(org)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.mapActionRow}>
          <RelationshipButton
            label="Open map"
            icon="map-outline"
            secondary
            fullWidth={false}
            onPress={handleOpenAtlas}
          />
        </View>

          {isPlaceholder ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>This is not an official club account yet.</Text>
              <Text style={styles.noticeBody}>
                BetterAt created this placeholder from public Dragon Worlds ClubSpot entrant club strings.
                No sailors or entrants have been attached to this club automatically.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push(`/organizations/${org.slug || slug}/claim` as never)}
              >
                <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Claim this organization</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.grid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{org.total_entry_refs}</Text>
              <Text style={styles.statLabel}>Dragon Worlds/APAC entry references</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{org.confidence || 'review'}</Text>
              <Text style={styles.statLabel}>Import confidence</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{tierLabel(org.pricing_tier)}</Text>
              <Text style={styles.statLabel}>Yacht-club pricing</Text>
            </View>
          </View>

          {visibleAliases.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Known ClubSpot Aliases</Text>
              <View style={styles.chips}>
                {visibleAliases.map((alias) => (
                  <View key={alias} style={styles.chip}>
                    <Text style={styles.chipText}>{alias}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, gap: 16 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 16 },
  mark: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  heroText: { flex: 1, gap: 8 },
  mapActionRow: { paddingBottom: 8 },
  eyebrow: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  h1: { color: C.ink, fontSize: 34, lineHeight: 40, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeOfficial: { backgroundColor: '#E6F4F1' },
  badgePlaceholder: { backgroundColor: '#FFF7ED' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  officialText: { color: C.green },
  placeholderText: { color: C.amber },
  notice: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 8, padding: 16, gap: 10 },
  noticeTitle: { color: C.ink, fontSize: 18, fontWeight: '800' },
  noticeBody: { color: C.ink, fontSize: 15, lineHeight: 22 },
  primaryButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 220, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 14 },
  statValue: { color: C.ink, fontSize: 20, fontWeight: '800', textTransform: 'capitalize' },
  statLabel: { color: C.muted, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { color: C.ink, fontSize: 24, fontWeight: '800' },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: '800' },
  body: { color: C.muted, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: '#EEF4FF', paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: C.blue, fontSize: 13, fontWeight: '700' },
});
