/**
 * Interest Landing Page
 *
 * Dynamic route for interest slugs (e.g., /self-mastery, /nursing, /sail-racing).
 * Shows published blueprints grouped by organization and self-published,
 * with a CTA to switch to this interest and view the timeline.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { discoverBlueprints, type DiscoveredBlueprint } from '@/services/BlueprintService';

const C = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  accent: '#4630EB',
  accentBg: 'rgba(70,48,235,0.06)',
  border: '#E2E8F0',
  labelDark: '#0F172A',
  labelMid: '#64748B',
  labelLight: '#94A3B8',
  green: '#059669',
  gold: '#D97706',
};

export default function InterestLandingPage() {
  const { interest: slug } = useLocalSearchParams<{ interest: string }>();
  const router = useRouter();
  const { allInterests, switchInterest, currentInterest, userInterests, addInterest } = useInterest();

  const [loading, setLoading] = useState(true);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [blueprints, setBlueprints] = useState<DiscoveredBlueprint[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const found = allInterests.find(i => i.slug === slug);
    setInterest(found ?? null);

    if (found) {
      discoverBlueprints(found.id)
        .then(setBlueprints)
        .catch(() => setBlueprints([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [slug, allInterests]);

  const isCurrentInterest = currentInterest?.slug === slug;
  const hasInterest = userInterests.some(i => i.slug === slug);

  const handleSwitchToInterest = useCallback(async () => {
    if (!slug) return;
    setSwitching(true);
    try {
      if (!hasInterest) await addInterest(slug);
      await switchInterest(slug);
      router.replace('/(tabs)/practice');
    } finally {
      setSwitching(false);
    }
  }, [slug, hasInterest, addInterest, switchInterest, router]);

  // Group blueprints: org-associated vs self-published
  const orgBlueprints = blueprints.filter(b => b.organization_id);
  const selfBlueprints = blueprints.filter(b => !b.organization_id);

  // Group org blueprints by org name
  const orgGroups = new Map<string, DiscoveredBlueprint[]>();
  for (const b of orgBlueprints) {
    const orgName = b.organization_name ?? 'Organization';
    const existing = orgGroups.get(orgName) ?? [];
    existing.push(b);
    orgGroups.set(orgName, existing);
  }

  if (!slug) return null;

  if (!interest && !loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="search-outline" size={48} color={C.labelLight} />
          <Text style={s.emptyTitle}>Interest not found</Text>
          <Text style={s.emptyText}>"{slug}" doesn't match any interest.</Text>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.headerBack}>
          <Ionicons name="arrow-back" size={20} color={C.labelDark} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{interest?.name ?? slug}</Text>
          {interest?.description ? (
            <Text style={s.headerSubtitle} numberOfLines={1}>{interest.description}</Text>
          ) : null}
        </View>
        {isCurrentInterest ? (
          <View style={s.activeBadge}>
            <Ionicons name="checkmark-circle" size={14} color={C.green} />
            <Text style={s.activeBadgeText}>Active</Text>
          </View>
        ) : (
          <Pressable
            style={[s.switchBtn, switching && { opacity: 0.6 }]}
            onPress={handleSwitchToInterest}
            disabled={switching}
          >
            {switching ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={s.switchBtnText}>{hasInterest ? 'Switch' : 'Add & Start'}</Text>
            )}
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          {blueprints.length === 0 ? (
            <View style={s.emptySection}>
              <Ionicons name="document-text-outline" size={40} color={C.labelLight} />
              <Text style={s.emptyTitle}>No blueprints yet</Text>
              <Text style={s.emptyText}>
                Be the first to publish a learning path for {interest?.name ?? slug}.
              </Text>
            </View>
          ) : (
            <>
              {/* Org-associated blueprints */}
              {Array.from(orgGroups.entries()).map(([orgName, bps]) => (
                <View key={orgName} style={s.groupSection}>
                  <View style={s.groupHeader}>
                    <Ionicons name="business-outline" size={16} color={C.accent} />
                    <Text style={s.groupLabel}>{orgName}</Text>
                  </View>
                  {bps.map(bp => (
                    <BlueprintCard
                      key={bp.id}
                      blueprint={bp}
                      onPress={() => router.push(`/blueprint/${bp.slug}`)}
                    />
                  ))}
                </View>
              ))}

              {/* Self-published blueprints */}
              {selfBlueprints.length > 0 && (
                <View style={s.groupSection}>
                  <View style={s.groupHeader}>
                    <Ionicons name="people-outline" size={16} color={C.gold} />
                    <Text style={s.groupLabel}>Community</Text>
                  </View>
                  {selfBlueprints.map(bp => (
                    <BlueprintCard
                      key={bp.id}
                      blueprint={bp}
                      onPress={() => router.push(`/blueprint/${bp.slug}`)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Interest info */}
          {interest?.description ? (
            <View style={s.aboutSection}>
              <Text style={s.aboutLabel}>ABOUT THIS INTEREST</Text>
              <Text style={s.aboutText}>{interest.description}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Blueprint Card
// ---------------------------------------------------------------------------

function BlueprintCard({
  blueprint,
  onPress,
}: {
  blueprint: DiscoveredBlueprint;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      {blueprint.cover_image_url ? (
        <Image source={{ uri: blueprint.cover_image_url }} style={s.cardCover} />
      ) : (
        <View style={[s.cardCover, s.cardCoverPlaceholder]}>
          <Ionicons name="map-outline" size={24} color={C.labelLight} />
        </View>
      )}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{blueprint.title}</Text>
        {blueprint.description ? (
          <Text style={s.cardDesc} numberOfLines={2}>{blueprint.description}</Text>
        ) : null}
        <View style={s.cardMeta}>
          {blueprint.author_name ? (
            <View style={s.metaRow}>
              {blueprint.author_avatar_url ? (
                <Image source={{ uri: blueprint.author_avatar_url }} style={s.avatar} />
              ) : (
                <Ionicons name="person-circle-outline" size={16} color={C.labelMid} />
              )}
              <Text style={s.metaText}>{blueprint.author_name}</Text>
            </View>
          ) : null}
          <View style={s.metaRow}>
            <Ionicons name="people-outline" size={14} color={C.labelMid} />
            <Text style={s.metaText}>
              {blueprint.subscriber_count} {blueprint.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
            </Text>
          </View>
          {blueprint.access_level !== 'public' && (
            <View style={[s.accessPill, blueprint.access_level === 'paid' ? s.paidPill : s.orgPill]}>
              <Text style={s.accessText}>
                {blueprint.access_level === 'paid' ? 'Paid' : 'Members'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.labelLight} style={s.cardChevron} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  headerBack: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.labelDark },
  headerSubtitle: { fontSize: 12, color: C.labelMid, marginTop: 1 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: C.green },
  switchBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  switchBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  emptySection: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.labelDark },
  emptyText: { fontSize: 13, color: C.labelMid, textAlign: 'center', maxWidth: 280 },
  backBtn: { backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  groupSection: { marginBottom: 24 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.labelMid,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: C.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 10,
    alignItems: 'center',
  },
  cardCover: {
    width: 72,
    height: 72,
    backgroundColor: C.accentBg,
  },
  cardCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.labelDark },
  cardDesc: { fontSize: 12, color: C.labelMid, marginTop: 2, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: C.labelMid },
  avatar: { width: 16, height: 16, borderRadius: 8 },
  accessPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  orgPill: { backgroundColor: '#DBEAFE' },
  paidPill: { backgroundColor: '#FEF3C7' },
  accessText: { fontSize: 10, fontWeight: '600', color: C.labelDark },
  cardChevron: { marginRight: 12 },
  aboutSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.labelLight,
    letterSpacing: 1,
    marginBottom: 6,
  },
  aboutText: { fontSize: 13, color: C.labelMid, lineHeight: 19 },
});
