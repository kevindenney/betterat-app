/**
 * Org Admin · Program detail
 *
 * Drills into one program: shows its enrolled participants and lets an admin
 * bulk-enroll a whole cohort in one tap (cohort members → program_participants
 * via programService.enrollCohortIntoProgram). This is the surface that takes
 * a program from 0 → a full cohort enrolled.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader } from '@/components/studio/StudioShell';
import {
  useAdminProgramDetail,
  AdminProgramParticipant,
  adminProgramDetailKey,
} from '@/hooks/useAdminProgramDetail';
import { useAdminCohorts, AdminCohort } from '@/hooks/useAdminCohorts';
import { useAdminOrgVocab } from '@/hooks/useAdminOrgVocab';
import { adminProgramsKey } from '@/hooks/useAdminPrograms';
import { programService } from '@/services/ProgramService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'rgba(48, 209, 88, 0.14)', fg: '#1B873F' },
  invited: { bg: 'rgba(0, 122, 255, 0.12)', fg: '#0A6FE0' },
  completed: { bg: 'rgba(40, 64, 107, 0.12)', fg: '#28406B' },
  withdrawn: { bg: 'rgba(255, 59, 48, 0.10)', fg: '#C8392E' },
  inactive: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.7)' },
};

export default function AdminProgramDetailPage() {
  const { orgId, programId } = useLocalSearchParams<{ orgId: string; programId: string }>();
  const qc = useQueryClient();
  const { program, participants, loading } = useAdminProgramDetail(programId as string);
  const cohorts = useAdminCohorts(orgId as string);
  const av = useAdminOrgVocab(orgId as string);
  const [search, setSearch] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);

  const enroll = useMutation({
    mutationFn: (cohortId: string) =>
      programService.enrollCohortIntoProgram({
        organizationId: orgId as string,
        programId: programId as string,
        cohortId,
      }),
    onSuccess: (count, cohortId) => {
      const cohort = cohorts.cohorts.find((c) => c.id === cohortId);
      qc.invalidateQueries({ queryKey: adminProgramDetailKey(programId as string) });
      qc.invalidateQueries({ queryKey: adminProgramsKey(orgId as string) });
      setEnrollOpen(false);
      showAlert(
        `${av.Cohort} enrolled`,
        count === 0
          ? `${cohort?.name ?? `That ${av.Cohort.toLowerCase()}`} has no ${av.members} to enroll.`
          : `Enrolled ${count} ${count === 1 ? av.member : av.members} from ${cohort?.name ?? `the ${av.Cohort.toLowerCase()}`}.`,
      );
    },
    onError: (err) => {
      showAlert(
        `Could not enroll ${av.Cohort.toLowerCase()}`,
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const filtered = search
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.email ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : participants;

  return (
    <AdminShell activeKey="programs">
      <StudioHeader
        crumbs={['Admin', av.Programs, program?.title ?? av.Program]}
        title={program?.title ?? (loading ? 'Loading…' : `${av.Program} not found`)}
        subtitleParts={
          program
            ? [
                <View key="count" style={s.pillWrap}>
                  <View style={s.pill}>
                    <Text style={s.pillText}>
                      {participants.length} {participants.length === 1 ? 'enrolled' : 'enrolled'}
                    </Text>
                  </View>
                </View>,
                <Text key="meta" style={s.subText}>
                  {program.status.toUpperCase()} · enroll a {av.Cohort.toLowerCase()} to add a whole
                  group at once
                </Text>,
              ]
            : undefined
        }
      />

      {program?.description ? (
        <View style={s.descCard}>
          <Text style={s.descText}>{program.description}</Text>
        </View>
      ) : null}

      {/* Enroll a cohort */}
      <View style={s.enrollCard}>
        <Pressable style={s.enrollHeader} onPress={() => setEnrollOpen((v) => !v)}>
          <View style={s.enrollIcon}>
            <Ionicons name="people" size={18} color="#28406B" />
          </View>
          <View style={s.enrollCol}>
            <Text style={s.enrollTitle}>Enroll a {av.Cohort.toLowerCase()}</Text>
            <Text style={s.enrollBody}>
              Add every member of a {av.Cohort.toLowerCase()} to this{' '}
              {av.Program.toLowerCase()} in one tap.
            </Text>
          </View>
          <Ionicons
            name={enrollOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="rgba(60, 60, 67, 0.5)"
          />
        </Pressable>

        {enrollOpen ? (
          <View style={s.cohortList}>
            {cohorts.loading ? (
              <Text style={s.cohortLoading}>Loading {av.Cohorts.toLowerCase()}…</Text>
            ) : cohorts.cohorts.length === 0 ? (
              <Text style={s.cohortLoading}>No {av.Cohorts.toLowerCase()} at this org yet.</Text>
            ) : (
              cohorts.cohorts.map((c) => (
                <CohortPickRow
                  key={c.id}
                  cohort={c}
                  memberNoun={av.member}
                  membersNoun={av.members}
                  busy={enroll.isPending && enroll.variables === c.id}
                  disabled={enroll.isPending}
                  onPress={() => enroll.mutate(c.id)}
                />
              ))
            )}
          </View>
        ) : null}
      </View>

      <View style={s.filterRow}>
        <View style={s.searchInput}>
          <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search enrolled by name or email…"
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
            style={s.searchField}
          />
        </View>
        <Text style={s.filterMeta}>
          {filtered.length} of {participants.length}
        </Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
        {loading ? (
          <Text style={s.loading}>Loading participants…</Text>
        ) : !program ? (
          <View style={s.empty}>
            <Ionicons name="alert-circle-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>{av.Program} not found</Text>
            <Text style={s.emptyBody}>
              It may have been removed, or you don't have permission to view it.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="person-add-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>{search ? 'No matches' : 'No one enrolled yet'}</Text>
            <Text style={s.emptyBody}>
              {search
                ? `Nothing matches "${search}".`
                : `Use "Enroll a ${av.Cohort.toLowerCase()}" above to add a whole group at once.`}
            </Text>
          </View>
        ) : (
          filtered.map((p) => <ParticipantRow key={p.id} participant={p} />)
        )}
      </ScrollView>
    </AdminShell>
  );
}

function CohortPickRow({
  cohort,
  memberNoun,
  membersNoun,
  busy,
  disabled,
  onPress,
}: {
  cohort: AdminCohort;
  memberNoun: string;
  membersNoun: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={s.cohortRow}>
      <View style={s.cohortRowCol}>
        <Text style={s.cohortName}>{cohort.name}</Text>
        <Text style={s.cohortMeta}>
          {cohort.memberCount} {cohort.memberCount === 1 ? memberNoun : membersNoun}
        </Text>
      </View>
      <Pressable
        style={[s.enrollBtn, disabled && s.enrollBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={s.enrollBtnText}>
          {busy ? 'Enrolling…' : `Enroll ${cohort.memberCount}`}
        </Text>
      </Pressable>
    </View>
  );
}

function ParticipantRow({ participant }: { participant: AdminProgramParticipant }) {
  const tone = STATUS_TONE[participant.status] ?? STATUS_TONE.inactive;
  return (
    <View style={s.row}>
      <View style={s.avi}>
        <Text style={s.aviText}>{initials(participant.name)}</Text>
      </View>
      <View style={s.rowCol}>
        <View style={s.rowNameRow}>
          <Text style={s.rowName}>{participant.name}</Text>
          <View style={[s.statusTag, { backgroundColor: tone.bg }]}>
            <Text style={[s.statusTagText, { color: tone.fg }]}>
              {participant.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={s.rowMeta}>
          {participant.email ? `${participant.email} · ` : ''}
          {participant.role} · joined {participant.joinedLabel}
        </Text>
      </View>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  enrollCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.18)',
    overflow: 'hidden',
  },
  enrollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  enrollIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrollCol: { flex: 1, minWidth: 0 },
  enrollTitle: { fontSize: 14, fontWeight: '600', color: '#28406B', letterSpacing: -0.1 },
  enrollBody: { marginTop: 3, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 17 },

  cohortList: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(40, 64, 107, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  cohortLoading: { paddingVertical: 10, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  cohortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cohortRowCol: { flex: 1, minWidth: 0 },
  cohortName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  cohortMeta: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  enrollBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#28406B',
  },
  enrollBtnDisabled: { opacity: 0.5 },
  enrollBtnText: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },

  filterRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
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
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rowCol: { flex: 1, minWidth: 0 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  rowMeta: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  statusTag: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  statusTagText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },

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
