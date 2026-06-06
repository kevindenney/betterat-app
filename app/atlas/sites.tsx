/**
 * /atlas/sites — Atlas Phase A1 seed verification page.
 *
 * Lists every atlas_pois row visible to the signed-in viewer, grouped by
 * the claiming organization. Confirms the seed migration landed and that
 * the row-level-security read policy is correct ("anyone authenticated
 * can SELECT — they're places, not people").
 *
 * This is a stop-gap. Once the Atlas map UI ships from the design pass,
 * the data here will render as pins on a map instead of as a list.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useRouter } from 'expo-router';
import { useAtlasPois, AtlasPoi } from '@/hooks/useAtlasPois';

export default function AtlasSitesPage() {
  const router = useRouter();
  const data = useAtlasPois();

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Top breadcrumb */}
        <View style={s.topBar}>
          <Ionicons name="chevron-back" size={20} color="#007AFF" onPress={() => router.back()} />
          <Text style={s.topBarText}>Back</Text>
          <Text style={s.topBarTitle}>Atlas · Seeded sites</Text>
        </View>

        <View style={s.heading}>
          <Text style={s.eyebrow}>Phase A1 · verification</Text>
          <Text style={s.title}>Curated sites across all orgs</Text>
          <Text style={s.sub}>
            Live atlas_pois rows seeded by the Phase A1 migration. Anyone
            authenticated can read these — they're places, not people. When the
            map ships from the design pass, each row below renders as a pin
            colored by relationship + kind.
          </Text>

          <View style={s.statsRow}>
            <Stat label="Total POIs" value={String(data.totalCount)} />
            <Stat
              label="Healthcare-tagged"
              value={String(data.pois.filter((p) => p.is_healthcare_site).length)}
              tone="muted"
            />
            <Stat
              label="Orgs represented"
              value={String(data.byOrg.length)}
              tone="muted"
            />
          </View>
        </View>

        {data.loading ? (
          <Text style={s.loading}>Loading POIs…</Text>
        ) : data.pois.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="map-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>No POIs yet</Text>
            <Text style={s.emptyBody}>
              Run supabase/seeds/atlas_pois_phase_a1.sql on your dev project to
              populate this view.
            </Text>
          </View>
        ) : (
          data.byOrg.map((group) => (
            <View key={group.orgId ?? 'unclaimed'} style={s.orgBlock}>
              <View style={s.orgHead}>
                <Text style={s.orgName}>{group.orgName}</Text>
                <Text style={s.orgCount}>
                  {group.pois.length} {group.pois.length === 1 ? 'site' : 'sites'}
                </Text>
              </View>
              {group.pois.map((p) => (
                <PoiRow key={p.id} poi={p} />
              ))}
            </View>
          ))
        )}

        <View style={s.footer}>
          <Text style={s.footerText}>
            Phase A1 migration applied · 11 POIs · 4 institution layers active
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'muted';
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, tone === 'muted' && s.statValueMuted]}>{value}</Text>
    </View>
  );
}

function PoiRow({ poi }: { poi: AtlasPoi }) {
  return (
    <View style={s.poiRow}>
      <View style={[s.kindBadge, kindBadgeColor(poi.kind)]}>
        <Ionicons name={kindIcon(poi.kind)} size={14} color="#FFFFFF" />
      </View>
      <View style={s.poiCol}>
        <View style={s.poiNameRow}>
          <Text style={s.poiName}>{poi.name}</Text>
          {poi.is_healthcare_site ? (
            <View style={s.healthBadge}>
              <Text style={s.healthBadgeText}>HEALTHCARE</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.poiMeta}>
          {poi.kind} · {poi.interest_slug ?? 'universal'} ·{' '}
          {poi.lat.toFixed(4)}°, {poi.lng.toFixed(4)}°
        </Text>
        {poi.metadata && Object.keys(poi.metadata).length > 0 ? (
          <Text style={s.poiMetaJson} numberOfLines={1}>
            {JSON.stringify(poi.metadata)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function kindIcon(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'club':
      return 'boat-outline';
    case 'racing_area':
      return 'water-outline';
    case 'hospital':
      return 'medkit-outline';
    case 'sim_lab':
      return 'school-outline';
    case 'course':
      return 'golf-outline';
    case 'market':
      return 'storefront-outline';
    default:
      return 'location-outline';
  }
}

function kindBadgeColor(kind: string) {
  switch (kind) {
    case 'club':
    case 'racing_area':
      return { backgroundColor: '#5E7B8E' };
    case 'hospital':
      return { backgroundColor: '#B85A66' };
    case 'sim_lab':
      return { backgroundColor: '#7A6A8E' };
    default:
      return { backgroundColor: '#8E8E93' };
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  scroll: { paddingBottom: 32 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topBarText: { fontSize: 16, color: '#007AFF' },
  topBarTitle: { marginLeft: 'auto', fontSize: 14, color: 'rgba(60, 60, 67, 0.6)' },

  heading: {
    paddingHorizontal: 56,
    paddingTop: 32,
    paddingBottom: 24,
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: '#0E1117',
    letterSpacing: -0.5,
    marginBottom: 10,
    fontFamily: fontFamily.serif,
  },
  sub: { fontSize: 14, lineHeight: 21, color: 'rgba(60, 60, 67, 0.7)' },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  stat: {
    flex: 1,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statValueMuted: { color: 'rgba(60, 60, 67, 0.85)' },

  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8, paddingHorizontal: 56 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
  },

  orgBlock: {
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 56,
    marginBottom: 20,
  },
  orgHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orgName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  orgCount: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },

  poiRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  kindBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiCol: { flex: 1, minWidth: 0 },
  poiNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  poiName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  healthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(184, 90, 102, 0.16)',
    borderRadius: 4,
  },
  healthBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B85A66',
    letterSpacing: 0.4,
  },
  poiMeta: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  poiMetaJson: {
    marginTop: 4,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.4)',
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
  },

  footer: {
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 56,
    paddingTop: 16,
  },
  footerText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.45)', textAlign: 'center' },
});
