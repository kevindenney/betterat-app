/**
 * Org Admin · Blueprints — list of every blueprint authored under this org.
 *
 * Reads real rows from blueprints + blueprint_cohorts via admin_org_blueprints RPC.
 * Cards show title + author + version + status + subscriber count + cohort
 * assignment chips. Click a row → /studio/blueprints/[id] (the editor).
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { StatRow } from '@/components/studio/StatRow';
import {
  useAdminOrgBlueprints,
  AdminBlueprintRow,
  BlueprintCategory,
  BlueprintStatus,
  AuthorTone,
  formatLastEditedRelative,
} from '@/hooks/useAdminOrgBlueprints';

const CAT_TONES: Record<BlueprintCategory, { bg: string; fg: string; label: string }> = {
  reasoning: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Clinical reasoning' },
  procedural: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  assessment: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  communication: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
  other: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.85)', label: 'Other' },
};

const STATUS_TONES: Record<BlueprintStatus, { bg: string; fg: string; label: string }> = {
  live: { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', label: 'Live' },
  draft: { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'Draft' },
  review: { bg: 'rgba(40, 64, 107, 0.10)', fg: '#28406B', label: 'In review' },
  archived: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.85)', label: 'Archived' },
};

const AVI_BG: Record<AuthorTone, string> = {
  navy: '#28406B',
  brown: '#8B5A3C',
  warm: '#B8855A',
  green: '#6E8B5A',
};

export default function AdminBlueprintsPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const { blueprints, loading } = useAdminOrgBlueprints(orgId as string);

  const stats = useMemo(() => {
    const live = blueprints.filter((b) => b.status === 'live').length;
    const draft = blueprints.filter((b) => b.status === 'draft').length;
    const review = blueprints.filter((b) => b.status === 'review').length;
    const subs = blueprints.reduce((sum, b) => sum + b.subscribers, 0);
    const authorCounts = new Map<string, number>();
    for (const b of blueprints) {
      authorCounts.set(b.authorName, (authorCounts.get(b.authorName) ?? 0) + 1);
    }
    const topAuthor =
      Array.from(authorCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    return { live, draft, review, subs, topAuthor };
  }, [blueprints]);

  return (
    <AdminShell activeKey="blueprints">
      <StudioHeader
        crumbs={['Admin', 'Blueprints']}
        title="Blueprints"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              {loading ? '…' : `${blueprints.length} blueprints`}
            </Text>
            {!loading
              ? ` · ${stats.live} live · ${stats.draft} draft · ${stats.review} in review · ${stats.subs} total subscriber-seats`
              : ''}
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
        <StatRow>
          <StatCard k="Live" v={loading ? '—' : String(stats.live)} d="published to a cohort" />
          <StatCard k="Draft" v={loading ? '—' : String(stats.draft)} d="in active editing" />
          <StatCard k="In review" v={loading ? '—' : String(stats.review)} d="awaiting publish sign-off" />
          <StatCard
            k="Top author"
            v={loading ? '—' : stats.topAuthor ? String(stats.topAuthor[1]) : '—'}
            d={stats.topAuthor ? `${stats.topAuthor[0]} · ${stats.topAuthor[1]} blueprints` : 'no authors yet'}
            short
          />
        </StatRow>

        {/* Blueprint list */}
        {loading ? (
          <View style={s.loadingCard}>
            <Text style={s.loadingText}>Loading blueprints…</Text>
          </View>
        ) : blueprints.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="git-branch-outline" size={20} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyText}>
              No blueprints yet. Click <Text style={{ fontWeight: '600' }}>New blueprint</Text> to
              author one in Studio.
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {blueprints.map((b) => (
              <BlueprintCardRow
                key={b.id}
                bp={b}
                onPress={() => router.push(`/studio/blueprints/${b.id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </AdminShell>
  );
}

function BlueprintCardRow({ bp, onPress }: { bp: AdminBlueprintRow; onPress: () => void }) {
  const cat = CAT_TONES[bp.category] ?? CAT_TONES.other;
  const status = STATUS_TONES[bp.status];
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={[s.avi, { backgroundColor: AVI_BG[bp.authorTone] }]}>
        <Text style={s.aviText}>{bp.authorInitials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTitleLine}>
          <Text style={s.rowTitle}>{bp.title}</Text>
          <View style={[s.chip, { backgroundColor: cat.bg }]}>
            <Text style={[s.chipText, { color: cat.fg }]}>{cat.label}</Text>
          </View>
          <View style={[s.chip, { backgroundColor: status.bg }]}>
            <Text style={[s.chipText, { color: status.fg }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={s.rowMeta}>
          {bp.authorName} · {bp.version} · {bp.stepCount}{' '}
          {bp.stepCount === 1 ? 'step' : 'steps'} · last edited{' '}
          {formatLastEditedRelative(bp.lastEditedAt)}
        </Text>
        {bp.cohortLabels.length > 0 ? (
          <View style={s.cohortRow}>
            <Ionicons name="people-outline" size={11} color="rgba(60, 60, 67, 0.6)" />
            {bp.cohortLabels.map((c) => (
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
        <Text style={s.subscriberN}>{bp.subscribers}</Text>
        <Text style={s.subscriberLabel}>subscribers</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
    </Pressable>
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
  subscriberN: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  subscriberLabel: {
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  loadingCard: {
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)' },

  emptyCard: {
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', textAlign: 'center', maxWidth: 400 },
});
