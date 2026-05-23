/**
 * Org Admin · Cohort detail
 *
 * Drills into one cohort. Shows the roster of real members (30 BSN students
 * at JHSON's BSN Class of 2027), each with their cohort role, last-active
 * timestamp, and join date. Header carries cohort name + description +
 * mentor/student count split. Includes a teaser card pointing to Insights
 * for the competency-by-site coverage view.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminCohortDetail, CohortMember } from '@/hooks/useAdminCohortDetail';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { CohortEditSheet } from '@/components/admin/CohortEditSheet';

export default function AdminCohortDetailPage() {
  const { orgId, cohortId } = useLocalSearchParams<{ orgId: string; cohortId: string }>();
  const router = useRouter();
  const { cohort, loading } = useAdminCohortDetail(cohortId as string);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const filtered = cohort
    ? search
      ? cohort.members.filter(
          (m) =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()),
        )
      : cohort.members
    : [];

  return (
    <AdminShell activeKey="cohorts">
      <StudioHeader
        crumbs={['Admin', 'Cohorts', cohort?.name ?? 'Cohort']}
        title={cohort?.name ?? (loading ? 'Loading…' : 'Cohort not found')}
        subtitleParts={
          cohort
            ? [
                <View key="counts" style={s.pillWrap}>
                  <View style={s.pill}>
                    <Text style={s.pillText}>
                      {cohort.members.length} {cohort.members.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                </View>,
                <Text key="split" style={s.subText}>
                  {cohort.studentCount} students · {cohort.mentorCount} mentors · created{' '}
                  {cohort.createdAtLabel}
                </Text>,
              ]
            : undefined
        }
        actions={
          <>
            <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
            <StudioButton
              variant="ghost"
              icon="create-outline"
              label="Edit cohort"
              onPress={() => setEditOpen(true)}
            />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="add"
              label="Assign students"
            />
          </>
        }
      />

      <CohortEditSheet
        visible={editOpen}
        cohortId={cohortId as string}
        orgId={(cohort?.orgId ?? (orgId as string)) as string}
        cohortName={cohort?.name ?? 'Cohort'}
        description={cohort?.description ?? null}
        status={cohort?.status ?? null}
        startDate={cohort?.startDate ?? null}
        endDate={cohort?.endDate ?? null}
        maxSeats={cohort?.maxSeats ?? null}
        program={cohort?.program ?? null}
        onClose={() => setEditOpen(false)}
      />

      {cohort?.description ? (
        <View style={s.descCard}>
          <Text style={s.descText}>{cohort.description}</Text>
        </View>
      ) : null}

      {/* Insights teaser */}
      <Pressable
        style={s.insightsTeaser}
        onPress={() => router.push(`/admin/${orgId}/insights` as any)}
      >
        <View style={s.teaserIcon}>
          <Ionicons name="pie-chart" size={20} color="#28406B" />
        </View>
        <View style={s.teaserCol}>
          <Text style={s.teaserTitle}>
            Show me where competency-X is being evidenced
          </Text>
          <Text style={s.teaserBody}>
            See competency coverage across this cohort's clinical sites — the
            constellation of skills your students have built across the
            program's affiliated hospitals.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#28406B" />
      </Pressable>

      <View style={s.filterRow}>
        <View style={s.searchInput}>
          <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search members by name or email…"
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
            style={s.searchField}
          />
        </View>
        <Text style={s.filterMeta}>
          {filtered.length} of {cohort?.members.length ?? 0}
        </Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
        {loading ? (
          <Text style={s.loading}>Loading roster…</Text>
        ) : !cohort ? (
          <View style={s.empty}>
            <Ionicons name="alert-circle-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>Cohort not found</Text>
            <Text style={s.emptyBody}>
              It may have been removed, or you don't have permission to view it.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>No matches</Text>
            <Text style={s.emptyBody}>
              Nothing matches "{search}" in this cohort.
            </Text>
          </View>
        ) : (
          filtered.map((m) => <MemberRow key={m.membershipId} member={m} />)
        )}
      </ScrollView>
    </AdminShell>
  );
}

function MemberRow({ member }: { member: CohortMember }) {
  const isMentor = (member.cohortRole ?? '').toLowerCase().match(/mentor|preceptor|instructor/);
  return (
    <View style={s.row}>
      <View style={[s.avi, { backgroundColor: member.gradient[0] }]}>
        <Text style={s.aviText}>{member.initials}</Text>
      </View>
      <View style={s.rowCol}>
        <View style={s.rowNameRow}>
          <Text style={s.rowName}>{member.name}</Text>
          {member.cohortRole ? (
            <View style={[s.roleTag, isMentor && s.roleTagMentor]}>
              <Text style={[s.roleTagText, isMentor && s.roleTagTextMentor]}>
                {member.cohortRole.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={s.rowMeta}>
          {member.email} · joined {member.joinedLabel}
        </Text>
      </View>
      <Text style={s.rowLastActive}>{member.lastActiveLabel}</Text>
      <Pressable style={s.rowAction}>
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(60, 60, 67, 0.4)" />
      </Pressable>
    </View>
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

  descCard: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#28406B',
  },
  descText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },

  insightsTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.18)',
  },
  teaserIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserCol: { flex: 1, minWidth: 0 },
  teaserTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28406B',
    letterSpacing: -0.1,
  },
  teaserBody: {
    marginTop: 3,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 17,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
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
  filterMeta: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },

  scroll: { flex: 1 },
  scrollInner: { gap: 6, paddingBottom: 20 },

  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  avi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rowCol: { flex: 1, minWidth: 0 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  rowMeta: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  roleTag: {
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 4,
  },
  roleTagMentor: { backgroundColor: 'rgba(184, 90, 102, 0.16)' },
  roleTagText: { fontSize: 9.5, fontWeight: '700', color: '#007AFF', letterSpacing: 0.4 },
  roleTagTextMentor: { color: '#B85A66' },
  rowLastActive: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', minWidth: 110, textAlign: 'right' },
  rowAction: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 18,
  },
});
