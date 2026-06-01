/**
 * Org Admin · Person · Practice timeline
 *
 * Date-ordered list of every timeline_step a cohort member has logged
 * for the given org, with the step's competencies and clinical site.
 * Drilled into from the People list via the PersonDetailDrawer's
 * "Open practice timeline" action.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { StatRow } from '@/components/studio/StatRow';
import { useAdminPeople } from '@/hooks/useAdminPeople';
import { useAdminPersonPractice, PersonPracticeStep } from '@/hooks/useAdminPersonPractice';

export default function AdminPersonDetailPage() {
  const { orgId, userId } = useLocalSearchParams<{ orgId: string; userId: string }>();
  const router = useRouter();
  const people = useAdminPeople(orgId as string);
  // URL carries auth.users.id; AdminPersonRow.id is the membership row, so match on userId.
  const person = people.rows.find((r) => r.userId === userId);
  const { steps, loading } = useAdminPersonPractice(orgId as string, userId as string);

  const grouped = useMemo(() => groupByMonth(steps), [steps]);
  const competencyCoverage = useMemo(() => {
    const m = new Map<string, number>();
    for (const step of steps) {
      for (const label of step.competencyShortLabels) {
        m.set(label, (m.get(label) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [steps]);

  const siteCoverage = useMemo(() => {
    const m = new Map<string, number>();
    for (const step of steps) {
      if (!step.poiName) continue;
      m.set(step.poiName, (m.get(step.poiName) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [steps]);

  return (
    <AdminShell activeKey="people">
      <StudioHeader
        crumbs={['Admin', 'People', person?.name ?? 'Person']}
        title={person?.name ?? (people.loading ? 'Loading…' : 'Person not found')}
        subtitleParts={
          person
            ? [
                <Text key="email" style={s.subEmail}>
                  {person.email}
                </Text>,
                <Text key="cohort" style={s.subMeta}>
                  {person.cohortLabel ?? 'No cohort'} · {person.lastActiveLabel}
                </Text>,
              ]
            : undefined
        }
        actions={
          <>
            <StudioButton
              variant="ghost"
              icon="arrow-back-outline"
              label="Back to People"
              onPress={() => router.push(`/admin/${orgId}/people`)}
            />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Summary cards */}
        <StatRow>
          <SummaryCard
            label="Steps logged"
            value={loading ? '—' : String(steps.length)}
            sub={loading ? 'loading' : steps.length === 0 ? 'no data yet' : 'within this org'}
          />
          <SummaryCard
            label="Competencies evidenced"
            value={loading ? '—' : String(competencyCoverage.length)}
            sub={
              competencyCoverage.length > 0
                ? `top: ${competencyCoverage[0].label} (${competencyCoverage[0].count}×)`
                : 'none yet'
            }
          />
          <SummaryCard
            label="Sites in rotation"
            value={loading ? '—' : String(siteCoverage.length)}
            sub={siteCoverage.length > 0 ? siteCoverage[0].label : 'none yet'}
          />
        </StatRow>

        {/* Coverage chips */}
        {competencyCoverage.length > 0 ? (
          <View style={s.chipBlock}>
            <Text style={s.sectionEyebrow}>Competency coverage</Text>
            <View style={s.chipRow}>
              {competencyCoverage.map((c) => (
                <View key={c.label} style={s.chip}>
                  <Text style={s.chipLabel}>{c.label}</Text>
                  <Text style={s.chipCount}>{c.count}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Timeline list */}
        <View style={s.timelineBlock}>
          <Text style={s.sectionEyebrow}>Practice timeline</Text>
          {loading ? (
            <Text style={s.emptyText}>Loading…</Text>
          ) : steps.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="footsteps-outline" size={20} color="rgba(60, 60, 67, 0.4)" />
              <Text style={s.emptyText}>
                No steps logged for this org yet. They'll appear here as the student
                completes clinical rotations and reflects on competency evidence.
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label} style={s.group}>
                <Text style={s.groupLabel}>{group.label}</Text>
                {group.items.map((step) => (
                  <StepRow key={step.stepId} step={step} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summarySub}>{sub}</Text>
    </View>
  );
}

function StepRow({ step }: { step: PersonPracticeStep }) {
  const when = step.completedAt ?? step.createdAt;
  const whenLabel = when ? formatShortDate(when) : 'undated';
  return (
    <View style={s.stepRow}>
      <View style={s.stepDot} />
      <View style={s.stepCol}>
        <Text style={s.stepTitle}>{step.title}</Text>
        <View style={s.stepMetaRow}>
          <Text style={s.stepMeta}>{whenLabel}</Text>
          {step.poiName ? (
            <>
              <Text style={s.stepMetaDot}>·</Text>
              <Text style={s.stepMeta}>{step.poiName}</Text>
            </>
          ) : null}
          <Text style={s.stepMetaDot}>·</Text>
          <Text style={[s.stepMeta, statusTone(step.status)]}>
            {step.status === 'settled' ? 'Settled' : capitalize(step.status)}
          </Text>
        </View>
        {step.competencyShortLabels.length > 0 ? (
          <View style={s.stepChipRow}>
            {step.competencyShortLabels.map((label) => (
              <View key={label} style={s.stepChip}>
                <Text style={s.stepChipText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function groupByMonth(steps: PersonPracticeStep[]): { label: string; items: PersonPracticeStep[] }[] {
  const buckets = new Map<string, PersonPracticeStep[]>();
  for (const step of steps) {
    const when = step.completedAt ?? step.createdAt;
    if (!when) continue;
    const d = new Date(when);
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(step);
  }
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function statusTone(status: string): { color: string } | undefined {
  if (status === 'settled') return { color: '#1E8F47' };
  if (status === 'completed') return { color: '#28406B' };
  if (status === 'skipped') return { color: 'rgba(60, 60, 67, 0.5)' };
  return undefined;
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 22 },

  subEmail: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  subMeta: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' },

  summaryCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  summarySub: {
    marginTop: 2,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  chipBlock: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: '#FAFAF7',
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chipLabel: { fontSize: 11.5, fontWeight: '600', color: '#1C1C1E' },
  chipCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    fontVariant: ['tabular-nums'],
  },

  timelineBlock: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
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

  group: { marginBottom: 18 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  stepDot: {
    marginTop: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#28406B',
  },
  stepCol: { flex: 1, minWidth: 0, gap: 4 },
  stepTitle: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  stepMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  stepMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  stepMetaDot: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.3)' },
  stepChipRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  stepChip: {
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 4,
  },
  stepChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.3,
  },
});
