/**
 * MentorCohortDashboard — Section G / Frames 19–20.
 *
 * iPad-first cohort overview for a mentor / coach / faculty role.
 * Reuses the existing CohortCompetencyService data layer (KPIs +
 * student rows + at-risk + gaps) but re-presents in the iOS register
 * design language to match the timeline-zoom canvas.
 *
 * Layout:
 *   • Header: cohort title, member count, search.
 *   • Top strip: 3 KPI tiles (members, average mastery, at-risk).
 *   • Body: responsive grid of member cards (2 cols on iPhone, 3 cols
 *     ≥ 700pt, 4 cols ≥ 1024pt). Each card shows avatar + name,
 *     overall percent, domain mastery bars, last activity.
 *   • Tap a card → push to the existing /organization/student/[id]
 *     deep-dive (which has the same competency surface).
 *
 * Gap alerts + NCLEX readiness are intentionally not rendered here —
 * they live on a sibling "Gaps" tab that the existing
 * FacultyCohortDashboard already ships. This screen focuses on the
 * member-roster aspect of the design.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  getCohortCompetencyMatrix,
  getCohortSummary,
} from '@/services/CohortCompetencyService';
import type {
  CohortCompetencyMatrix,
  CohortStudentRow,
  CohortSummary,
} from '@/types/cohortCompetency';

interface MentorCohortDashboardProps {
  cohortId: string;
  orgId: string;
  cohortTitle?: string;
}

export function MentorCohortDashboard({
  cohortId,
  orgId,
  cohortTitle,
}: MentorCohortDashboardProps) {
  const [matrix, setMatrix] = useState<CohortCompetencyMatrix | null>(null);
  const [summary, setSummary] = useState<CohortSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getCohortCompetencyMatrix(cohortId, orgId),
      getCohortSummary(cohortId, orgId),
    ])
      .then(([m, s]) => {
        if (cancelled) return;
        setMatrix(m);
        setSummary(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load cohort');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cohortId, orgId]);

  const filteredStudents = useMemo(() => {
    if (!matrix) return [];
    const q = query.trim().toLowerCase();
    if (!q) return matrix.students;
    return matrix.students.filter((s) => s.userName.toLowerCase().includes(q));
  }, [matrix, query]);

  const { width } = Dimensions.get('window');
  const cols = width >= 1024 ? 4 : width >= 700 ? 3 : 2;

  if (loading) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
          <Text style={styles.loadingText}>Loading cohort…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !matrix || !summary) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={36} color="#FF3B30" />
          <Text style={styles.errorText}>{error ?? 'Cohort not available'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>{cohortTitle ?? 'Cohort'}</Text>
            <Text style={styles.subtitle}>
              {summary.totalStudents}{' '}
              {summary.totalStudents === 1 ? 'member' : 'members'} ·{' '}
              {summary.averageCompetencyPercent}% avg mastery
            </Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={IOS_REGISTER.labelTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members…"
            placeholderTextColor={IOS_REGISTER.labelTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons
                name="close-circle"
                size={16}
                color={IOS_REGISTER.labelTertiary}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.kpiRow}>
          <KpiTile
            label="Members"
            value={String(summary.totalStudents)}
            tint={IOS_REGISTER.accentUserAction}
          />
          <KpiTile
            label="On track"
            value={String(summary.studentsOnTrack + summary.studentsExcelling)}
            tint="#5BA46F"
          />
          <KpiTile
            label="At risk"
            value={String(summary.studentsAtRisk)}
            tint="#FF3B30"
          />
        </View>

        <View style={styles.grid}>
          {filteredStudents.map((student) => (
            <View
              key={student.userId}
              style={[styles.gridCell, { width: `${100 / cols}%` }]}
            >
              <MemberCard
                student={student}
                domains={matrix.domains}
                onPress={() =>
                  router.push({
                    pathname: '/organization/student/[studentId]',
                    params: { studentId: student.userId, orgId },
                  } as never)
                }
              />
            </View>
          ))}
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyCell}>
              <Text style={styles.emptyText}>
                {query
                  ? `No members match "${query}".`
                  : 'No members in this cohort yet.'}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={[styles.kpiTile, { borderColor: withAlpha(tint, 0.35) }]}>
      <Text style={[styles.kpiValue, { color: tint }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

interface MemberCardProps {
  student: CohortStudentRow;
  domains: CohortCompetencyMatrix['domains'];
  onPress: () => void;
}

function MemberCard({ student, domains, onPress }: MemberCardProps) {
  const initials = initialsFromName(student.userName);
  // Tint the percent badge by tier: <30% red, 30-70% blue, >70% green.
  const tier =
    student.overallPercent >= 70
      ? '#5BA46F'
      : student.overallPercent >= 30
        ? IOS_REGISTER.accentUserAction
        : '#FF3B30';
  // Top 3 domains by achievement to keep the card scannable.
  const topDomains = [...domains]
    .slice()
    .sort((a, b) => {
      const aPct = student.byDomain[a.id]?.percent ?? 0;
      const bPct = student.byDomain[b.id]?.percent ?? 0;
      return bPct - aPct;
    })
    .slice(0, 3);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {student.userName}
          </Text>
          <Text style={styles.cardSubline}>
            {student.overallPercent}% overall
          </Text>
        </View>
        <View style={[styles.percentBadge, { backgroundColor: withAlpha(tier, 0.15) }]}>
          <Text style={[styles.percentBadgeText, { color: tier }]}>
            {student.overallPercent}%
          </Text>
        </View>
      </View>

      <View style={styles.domainRows}>
        {topDomains.map((d) => {
          const pct = student.byDomain[d.id]?.percent ?? 0;
          return (
            <View key={d.id} style={styles.domainRow}>
              <Text style={styles.domainTitle} numberOfLines={1}>
                {d.title}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(2, Math.min(100, pct))}%`,
                      backgroundColor: pct >= 70 ? '#5BA46F' : pct >= 30 ? IOS_REGISTER.accentUserAction : '#FF3B30',
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

function initialsFromName(name: string): string {
  const parts = name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  errorText: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
  headerRow: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitleBlock: {},
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
  },
  searchBar: {
    height: 36,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: IOS_REGISTER.label,
    paddingVertical: 0,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridCell: {
    padding: 6,
  },
  emptyCell: {
    flex: 1,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    padding: 12,
    minHeight: 144,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderText: { flex: 1, minWidth: 0 },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  cardSubline: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  percentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  domainRows: {
    gap: 6,
    marginTop: 'auto',
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  domainTitle: {
    flex: 1,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
  },
  barTrack: {
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.fillPill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
