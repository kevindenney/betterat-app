/**
 * Org Admin · Cohorts list
 *
 * Real data from betterat_org_cohorts + betterat_org_cohort_members.
 * JHSON has 1 cohort (BSN Class of 2027 — Cohort A, 30 members).
 * Each row is clickable into the cohort detail.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminCohorts, AdminCohort } from '@/hooks/useAdminCohorts';
import { useAdminOrgVocab } from '@/hooks/useAdminOrgVocab';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';

export default function AdminCohortsListPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const data = useAdminCohorts(orgId as string);
  const av = useAdminOrgVocab(orgId as string);
  const [search, setSearch] = useState('');

  const filtered = search
    ? data.cohorts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : data.cohorts;

  return (
    <AdminShell activeKey="cohorts">
      <StudioHeader
        crumbs={['Admin', av.Cohorts]}
        title={av.Cohorts}
        subtitleParts={[
          <View key="count" style={s.pillWrap}>
            <View style={s.pill}>
              <Text style={s.pillText}>
                {data.totalCount} {data.totalCount === 1 ? av.Cohort : av.Cohorts}
              </Text>
            </View>
          </View>,
          <Text key="meta" style={s.subText}>
            {data.cohorts.reduce((sum, c) => sum + c.memberCount, 0)} {av.members} assigned ·
            placements set per {av.Cohort.toLowerCase()}
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="add"
              label={`New ${av.Cohort.toLowerCase()}`}
            />
          </>
        }
      />

      <View style={s.filterRow}>
        <View style={s.searchInput}>
          <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${av.Cohorts.toLowerCase()} by name or description…`}
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
            style={s.searchField}
          />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
        {data.loading ? (
          <Text style={s.loading}>Loading {av.Cohorts.toLowerCase()}…</Text>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="school-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>
              {search ? 'No matches' : `No ${av.Cohorts.toLowerCase()} yet`}
            </Text>
            <Text style={s.emptyBody}>
              {search
                ? `Nothing matches "${search}".`
                : `${av.Cohorts} group the ${av.members} who move through a ${av.Program.toLowerCase()} together. Add your first to gate enrollment by ${av.Cohort.toLowerCase()}.`}
            </Text>
          </View>
        ) : (
          filtered.map((c) => (
            <CohortRow
              key={c.id}
              cohort={c}
              memberNoun={av.member}
              membersNoun={av.members}
              onPress={() => router.push(`/admin/${orgId}/cohorts/${c.id}` as any)}
            />
          ))
        )}
      </ScrollView>
    </AdminShell>
  );
}

function CohortRow({
  cohort,
  memberNoun,
  membersNoun,
  onPress,
}: {
  cohort: AdminCohort;
  memberNoun: string;
  membersNoun: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.rowIcon}>
        <Ionicons name="school" size={18} color="#FFFFFF" />
      </View>
      <View style={s.rowCol}>
        <Text style={s.rowName}>{cohort.name}</Text>
        {cohort.description ? (
          <Text style={s.rowDesc} numberOfLines={2}>
            {cohort.description}
          </Text>
        ) : null}
        <View style={s.rowMetaRow}>
          <Text style={s.rowMeta}>
            <Text style={s.rowMetaStrong}>{cohort.memberCount}</Text>{' '}
            {cohort.memberCount === 1 ? memberNoun : membersNoun}
          </Text>
          {cohort.interestSlug ? (
            <>
              <View style={s.rowMetaDot} />
              <Text style={s.rowMeta}>{cohort.interestSlug}</Text>
            </>
          ) : null}
          <View style={s.rowMetaDot} />
          <Text style={s.rowMeta}>Created {cohort.createdAtLabel}</Text>
        </View>
      </View>
      <View style={s.rowAction}>
        <Ionicons name="chevron-forward" size={16} color="rgba(60, 60, 67, 0.4)" />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pillWrap: {},
  pill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
  },
  pillText: { fontSize: 11, fontWeight: '600', color: '#28406B' },
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  scroll: { flex: 1 },
  scrollInner: { gap: 8, paddingBottom: 20 },

  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCol: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  rowDesc: { marginTop: 3, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  rowMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  rowMetaStrong: { fontWeight: '600', color: 'rgba(60, 60, 67, 0.85)' },
  rowMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(60, 60, 67, 0.3)' },
  rowAction: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 18,
  },
});
