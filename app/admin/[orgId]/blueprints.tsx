/**
 * Org Admin · Blueprints — list of every blueprint authored under this org.
 *
 * Cards show title + author + version + status + subscriber count + cohort
 * assignment chips. Click a row → /studio/blueprints/[id] (the editor).
 *
 * Demo data — blueprints table doesn't exist yet. Visual layer matches
 * the rest of the admin chrome so the surface isn't a dead end during
 * walkthroughs.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';

interface BlueprintCard {
  id: string;
  title: string;
  category: 'rsn' | 'proc' | 'asmt' | 'comm';
  author: string;
  authorInitials: string;
  authorTone: 'navy' | 'brown' | 'green' | 'warm';
  version: string;
  status: 'live' | 'draft' | 'review';
  stepCount: number;
  subscribers: number;
  cohorts: string[];
  lastEditedRel: string;
}

const BLUEPRINTS: BlueprintCard[] = [
  {
    id: 'sepsis-bundle',
    title: 'Sepsis bundle recognition',
    category: 'rsn',
    author: 'Dr. R. Murphy',
    authorInitials: 'RM',
    authorTone: 'brown',
    version: 'v0.4 draft',
    status: 'draft',
    stepCount: 6,
    subscribers: 30,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Wed 11:42a',
  },
  {
    id: 'iv-supervised',
    title: 'IV insertion · supervised',
    category: 'proc',
    author: 'Dr. R. Murphy',
    authorInitials: 'RM',
    authorTone: 'brown',
    version: 'v2.1 live',
    status: 'live',
    stepCount: 4,
    subscribers: 28,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Mar 14',
  },
  {
    id: 'med-admin',
    title: 'Medication administration',
    category: 'proc',
    author: 'Dean S. Park',
    authorInitials: 'SP',
    authorTone: 'navy',
    version: 'v1.3 live',
    status: 'live',
    stepCount: 5,
    subscribers: 30,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Feb 22',
  },
  {
    id: 'h2t',
    title: 'Head-to-toe assessment',
    category: 'asmt',
    author: 'J. Kim, RN',
    authorInitials: 'JK',
    authorTone: 'green',
    version: 'v3.0 live',
    status: 'live',
    stepCount: 8,
    subscribers: 30,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Jan 19',
  },
  {
    id: 'isbar',
    title: 'ISBAR handoff communication',
    category: 'comm',
    author: 'Dean S. Park',
    authorInitials: 'SP',
    authorTone: 'navy',
    version: 'v1.4 live',
    status: 'live',
    stepCount: 3,
    subscribers: 30,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Jan 04',
  },
  {
    id: 'teach-back',
    title: 'Discharge teach-back',
    category: 'comm',
    author: 'Noor Aziz',
    authorInitials: 'NA',
    authorTone: 'warm',
    version: 'v1.0 review',
    status: 'review',
    stepCount: 5,
    subscribers: 0,
    cohorts: [],
    lastEditedRel: 'Apr 02',
  },
  {
    id: 'foley',
    title: 'Foley catheter placement',
    category: 'proc',
    author: 'Dr. R. Murphy',
    authorInitials: 'RM',
    authorTone: 'brown',
    version: 'v2.0 live',
    status: 'live',
    stepCount: 4,
    subscribers: 22,
    cohorts: ['BSN Class of 2027 — Cohort A'],
    lastEditedRel: 'Mar 28',
  },
];

const CAT_TONES = {
  rsn: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Clinical reasoning' },
  proc: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  asmt: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  comm: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
} as const;

const STATUS_TONES = {
  live: { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', label: 'Live' },
  draft: { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'Draft' },
  review: { bg: 'rgba(40, 64, 107, 0.10)', fg: '#28406B', label: 'In review' },
} as const;

const AVI_BG: Record<BlueprintCard['authorTone'], string> = {
  navy: '#28406B',
  brown: '#8B5A3C',
  green: '#6E8B5A',
  warm: '#B8855A',
};

export default function AdminBlueprintsPage() {
  const { orgId: _orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const liveCount = BLUEPRINTS.filter((b) => b.status === 'live').length;
  const draftCount = BLUEPRINTS.filter((b) => b.status === 'draft').length;
  const reviewCount = BLUEPRINTS.filter((b) => b.status === 'review').length;
  const totalSubscribers = BLUEPRINTS.reduce((sum, b) => sum + b.subscribers, 0);

  return (
    <AdminShell activeKey="blueprints">
      <StudioHeader
        crumbs={['Admin', 'Blueprints']}
        title="Blueprints"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              {BLUEPRINTS.length} blueprints
            </Text>
            {' · '}
            {liveCount} live · {draftCount} draft · {reviewCount} in review ·{' '}
            {totalSubscribers} total subscriber-seats
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="add"
              label="New blueprint"
              onPress={() => router.push('/studio')}
            />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Stat strip */}
        <View style={s.statRow}>
          <StatCard k="Live" v={String(liveCount)} d="published to a cohort" />
          <StatCard k="Draft" v={String(draftCount)} d="in active editing" />
          <StatCard k="In review" v={String(reviewCount)} d="awaiting publish sign-off" />
          <StatCard
            k="Top author"
            v="4"
            d="Dr. R. Murphy · 4 blueprints"
            short
          />
        </View>

        {/* Blueprint list */}
        <View style={s.list}>
          {BLUEPRINTS.map((b) => {
            const cat = CAT_TONES[b.category];
            const status = STATUS_TONES[b.status];
            return (
              <Pressable
                key={b.id}
                style={s.row}
                onPress={() => router.push(`/studio/blueprints/${b.id}` as any)}
              >
                <View style={[s.avi, { backgroundColor: AVI_BG[b.authorTone] }]}>
                  <Text style={s.aviText}>{b.authorInitials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.rowTitleLine}>
                    <Text style={s.rowTitle}>{b.title}</Text>
                    <View style={[s.chip, { backgroundColor: cat.bg }]}>
                      <Text style={[s.chipText, { color: cat.fg }]}>{cat.label}</Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: status.bg }]}>
                      <Text style={[s.chipText, { color: status.fg }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={s.rowMeta}>
                    {b.author} · {b.version} · {b.stepCount} steps · last edited{' '}
                    {b.lastEditedRel}
                  </Text>
                  {b.cohorts.length > 0 ? (
                    <View style={s.cohortRow}>
                      <Ionicons name="people-outline" size={11} color="rgba(60, 60, 67, 0.6)" />
                      {b.cohorts.map((c) => (
                        <Text key={c} style={s.cohortChip}>
                          {c}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.cohortNone}>Not yet assigned to a cohort</Text>
                  )}
                </View>
                <View style={s.subscriberBlock}>
                  <Text style={s.subscriberN}>{b.subscribers}</Text>
                  <Text style={s.subscriberLabel}>subscribers</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function StatCard({
  k,
  v,
  d,
  short,
}: {
  k: string;
  v: string;
  d: string;
  short?: boolean;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statK}>{k}</Text>
      <Text style={[s.statV, short && { fontSize: 18 }]}>{v}</Text>
      <Text style={s.statD}>{d}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statK: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  statV: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statD: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  avi: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.15 },
  rowMeta: { marginTop: 4, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  chip: { paddingHorizontal: 7, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  cohortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  cohortChip: { fontSize: 11, color: '#28406B', fontWeight: '600' },
  cohortNone: { marginTop: 6, fontSize: 11, color: 'rgba(60, 60, 67, 0.4)', fontStyle: 'italic' },

  subscriberBlock: { alignItems: 'flex-end' },
  subscriberN: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  subscriberLabel: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: '600' },
});
