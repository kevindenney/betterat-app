/**
 * Org Admin · Overview
 *
 * Headline dashboard for the dean's landing surface. Real data pulled
 * from the existing admin hooks (no new schema needed):
 *   - useAdminCohorts → cohort + member count
 *   - useAdminPeople → student/mentor split + pending
 *   - useAdminCompetencyEvidence → competency coverage + site activity
 *   - useAdminOrgRecentPractice → recent-activity feed (org-wide)
 *
 * Cards: stats row, coverage spotlight (strongest + thinnest competency),
 * site spotlight (busiest + thinnest), recent practice timeline.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { useAdminCohorts } from '@/hooks/useAdminCohorts';
import { useAdminPeople } from '@/hooks/useAdminPeople';
import { useAdminCompetencyEvidence } from '@/hooks/useAdminCompetencyEvidence';
import { useAdminOrgVocab } from '@/hooks/useAdminOrgVocab';
import {
  useAdminOrgRecentPractice,
  OrgRecentPracticeStep,
} from '@/hooks/useAdminOrgRecentPractice';

export default function AdminOverviewPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const av = useAdminOrgVocab(orgId as string);
  const cohorts = useAdminCohorts(orgId as string);
  const people = useAdminPeople(orgId as string);
  const evidence = useAdminCompetencyEvidence(orgId as string);
  const recent = useAdminOrgRecentPractice(orgId as string, 8);

  const coverageHi = useMemo(() => {
    let best: { id: string; label: string; pct: number; count: number } | null = null;
    for (const c of evidence.competencies) {
      const r = evidence.rowTotals.get(c.id);
      if (!r) continue;
      if (!best || r.pct > best.pct) {
        best = { id: c.id, label: c.shortLabel, pct: r.pct, count: r.count };
      }
    }
    return best;
  }, [evidence.competencies, evidence.rowTotals]);

  const coverageLo = useMemo(() => {
    let worst: { id: string; label: string; pct: number; count: number } | null = null;
    for (const c of evidence.competencies) {
      const r = evidence.rowTotals.get(c.id);
      if (!r) continue;
      if (!worst || r.pct < worst.pct) {
        worst = { id: c.id, label: c.shortLabel, pct: r.pct, count: r.count };
      }
    }
    return worst;
  }, [evidence.competencies, evidence.rowTotals]);

  const siteHi = useMemo(() => {
    let best: { id: string; label: string; count: number } | null = null;
    for (const s of evidence.sites) {
      const c = evidence.colTotals.get(s.id);
      if (!c) continue;
      if (!best || c.count > best.count) {
        best = { id: s.id, label: s.short, count: c.count };
      }
    }
    return best;
  }, [evidence.sites, evidence.colTotals]);

  const siteLo = useMemo(() => {
    let worst: { id: string; label: string; count: number } | null = null;
    for (const s of evidence.sites) {
      const c = evidence.colTotals.get(s.id);
      if (!c) continue;
      if (!worst || c.count < worst.count) {
        worst = { id: s.id, label: s.short, count: c.count };
      }
    }
    return worst;
  }, [evidence.sites, evidence.colTotals]);

  const totalEvidenceCount = useMemo(() => {
    let sum = 0;
    for (const r of evidence.rowTotals.values()) sum += r.count;
    return sum;
  }, [evidence.rowTotals]);

  return (
    <AdminShell activeKey="overview">
      <StudioHeader
        crumbs={['Admin', 'Overview']}
        title={`${av.Program} at a glance`}
        subtitleParts={
          evidence.cohortName !== 'No cohort'
            ? [
                <Text key="sub" style={s.sub}>
                  {evidence.cohortName} · {evidence.cohortSize} {av.members} ·{' '}
                  {evidence.competencies.length} competencies · {evidence.sites.length}{' '}
                  {av.Sites.toLowerCase()}
                </Text>,
              ]
            : undefined
        }
        actions={
          <>
            <StudioButton
              variant="ghost"
              icon="analytics-outline"
              label="Insights"
              onPress={() => router.push(`/admin/${orgId}/insights`)}
            />
            <StudioButton
              variant="ghost"
              icon="people-outline"
              label="People"
              onPress={() => router.push(`/admin/${orgId}/people`)}
            />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard
            label={av.Members}
            value={people.loading ? '—' : String(people.counts.students)}
            sub={
              people.loading
                ? 'loading'
                : `${people.counts.mentors} mentors · ${people.counts.admins} admins`
            }
            tone="navy"
          />
          <StatCard
            label={av.Cohorts}
            value={cohorts.loading ? '—' : String(cohorts.cohorts.length)}
            sub={cohorts.cohorts[0]?.name ?? `no ${av.Cohort.toLowerCase()} yet`}
            tone="navy"
          />
          <StatCard
            label="Competencies tracked"
            value={evidence.loading ? '—' : String(evidence.competencies.length)}
            sub={`across ${evidence.sites.length} ${av.Sites.toLowerCase()}`}
            tone="navy"
          />
          <StatCard
            label="Evidence rows"
            value={evidence.loading ? '—' : String(totalEvidenceCount)}
            sub={
              totalEvidenceCount > 0
                ? `${Math.round(
                    totalEvidenceCount / Math.max(1, evidence.cohortSize),
                  )} per ${av.member}`
                : 'none yet'
            }
            tone="green"
          />
        </View>

        {/* Spotlight row */}
        <View style={s.spotlightRow}>
          <SpotlightCard
            tone="ok"
            eyebrow="Strongest competency"
            title={coverageHi?.label ?? '—'}
            statLine={
              coverageHi
                ? `${coverageHi.count}/${evidence.cohortSize} ${av.members} (${Math.round(
                    coverageHi.pct * 100,
                  )}%)`
                : 'no coverage data yet'
            }
            footer={`The thing your ${av.members} are getting reps on.`}
            actionLabel="View on heatmap"
            onAction={() => router.push(`/admin/${orgId}/insights`)}
          />
          <SpotlightCard
            tone="warn"
            eyebrow="Coverage gap"
            title={coverageLo?.label ?? '—'}
            statLine={
              coverageLo
                ? `${coverageLo.count}/${evidence.cohortSize} ${av.members} (${Math.round(
                    coverageLo.pct * 100,
                  )}%)`
                : 'no coverage data yet'
            }
            footer="Where coverage is thin — worth focusing next."
            actionLabel="See gap"
            onAction={() => router.push(`/admin/${orgId}/insights`)}
          />
        </View>

        <View style={s.spotlightRow}>
          <SpotlightCard
            tone="ok"
            eyebrow={`Busiest ${av.Site.toLowerCase()}`}
            title={siteHi?.label ?? '—'}
            statLine={siteHi ? `${siteHi.count} steps logged` : 'no site data yet'}
            footer={`Where the ${av.Program.toLowerCase()} is physically active.`}
            actionLabel="Open Sites"
            onAction={() => router.push(`/admin/${orgId}/sites`)}
          />
          <SpotlightCard
            tone="warn"
            eyebrow={`Thinnest ${av.Site.toLowerCase()}`}
            title={siteLo?.label ?? '—'}
            statLine={siteLo ? `${siteLo.count} steps logged` : 'no site data yet'}
            footer="Either under-used or low-bandwidth — worth a look."
            actionLabel="Open Sites"
            onAction={() => router.push(`/admin/${orgId}/sites`)}
          />
        </View>

        {/* Recent activity feed */}
        <View style={s.feedCard}>
          <View style={s.feedHead}>
            <Text style={s.sectionTitle}>Recent practice</Text>
            <Text style={s.sectionLede}>
              The latest steps logged across the {av.Cohort.toLowerCase()}. Click
              any row to open that {av.member}'s practice timeline.
            </Text>
          </View>
          {recent.loading ? (
            <Text style={s.emptyText}>Loading…</Text>
          ) : recent.steps.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="footsteps-outline" size={18} color="rgba(60, 60, 67, 0.4)" />
              <Text style={s.emptyText}>
                No steps yet. Activity will appear here as {av.Cohort.toLowerCase()}{' '}
                {av.members} log practice and reflect on competency evidence.
              </Text>
            </View>
          ) : (
            <View style={s.feedList}>
              {recent.steps.map((step) => (
                <RecentRow
                  key={step.stepId}
                  step={step}
                  onPress={() => router.push(`/admin/${orgId}/person/${step.userId}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'navy' | 'green';
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, tone === 'green' && { color: '#1E8F47' }]}>{value}</Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  );
}

function SpotlightCard({
  tone,
  eyebrow,
  title,
  statLine,
  footer,
  actionLabel,
  onAction,
}: {
  tone: 'ok' | 'warn';
  eyebrow: string;
  title: string;
  statLine: string;
  footer: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={[s.spotCard, tone === 'warn' && s.spotCardWarn]}>
      <View style={s.spotHead}>
        <Text style={[s.spotEyebrow, tone === 'warn' && s.spotEyebrowWarn]}>{eyebrow}</Text>
        <Ionicons
          name={tone === 'ok' ? 'trending-up-outline' : 'alert-circle-outline'}
          size={16}
          color={tone === 'ok' ? '#1E8F47' : '#C99632'}
        />
      </View>
      <Text style={s.spotTitle}>{title}</Text>
      <Text style={s.spotStat}>{statLine}</Text>
      <Text style={s.spotFooter}>{footer}</Text>
      <Pressable style={s.spotAction} onPress={onAction}>
        <Text style={s.spotActionText}>{actionLabel}</Text>
        <Ionicons name="arrow-forward" size={12} color="#28406B" />
      </Pressable>
    </View>
  );
}

function RecentRow({
  step,
  onPress,
}: {
  step: OrgRecentPracticeStep;
  onPress: () => void;
}) {
  const when = step.completedAt ?? step.createdAt;
  const whenLabel = when ? formatRelative(when) : 'undated';
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.rowAvi}>
        <Text style={s.rowAviText}>{step.userInitials || '··'}</Text>
      </View>
      <View style={s.rowCol}>
        <View style={s.rowHead}>
          <Text style={s.rowName}>{step.userName}</Text>
          <Text style={s.rowMetaDot}>·</Text>
          <Text style={s.rowMeta}>{whenLabel}</Text>
        </View>
        <Text style={s.rowTitle}>{step.title}</Text>
        <View style={s.rowChips}>
          {step.poiName ? (
            <View style={s.siteChip}>
              <Ionicons name="location-outline" size={10} color="#28406B" />
              <Text style={s.siteChipText}>{step.poiName}</Text>
            </View>
          ) : null}
          {step.competencyShortLabels.map((label) => (
            <View key={label} style={s.compChip}>
              <Text style={s.compChipText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
    </Pressable>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, (now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 22 },

  sub: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  spotlightRow: { flexDirection: 'row', gap: 12 },
  spotCard: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(30, 143, 71, 0.18)',
  },
  spotCardWarn: { borderColor: 'rgba(201, 150, 50, 0.22)' },
  spotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spotEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E8F47',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  spotEyebrowWarn: { color: '#C99632' },
  spotTitle: { marginTop: 6, fontSize: 18, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3 },
  spotStat: { marginTop: 4, fontSize: 13, color: 'rgba(60, 60, 67, 0.85)', fontVariant: ['tabular-nums'] },
  spotFooter: { marginTop: 8, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },
  spotAction: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 999,
  },
  spotActionText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },

  feedCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  feedHead: { marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.1 },
  sectionLede: { marginTop: 3, fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },

  emptyCard: {
    paddingHorizontal: 18,
    paddingVertical: 24,
    backgroundColor: '#FAFAF7',
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },

  feedList: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAF7',
    borderRadius: 10,
  },
  rowAvi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAviText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  rowCol: { flex: 1, minWidth: 0, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  rowName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  rowMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  rowMetaDot: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.3)' },
  rowTitle: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' },
  rowChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  siteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 4,
  },
  siteChipText: { fontSize: 10.5, fontWeight: '600', color: '#28406B' },
  compChip: {
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
    borderRadius: 4,
  },
  compChipText: { fontSize: 10.5, fontWeight: '700', color: '#28406B', letterSpacing: 0.3 },
});
