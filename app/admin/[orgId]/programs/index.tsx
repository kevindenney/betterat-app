/**
 * Org Admin · Programs list
 *
 * Lists the org's programs (JHSON has 8 — Adult Health, Pediatrics, etc.)
 * with their enrolled-participant counts. Each row drills into the program
 * detail where an admin can bulk-enroll a cohort. Data is real from the
 * programs + program_participants tables via useAdminPrograms.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminPrograms, AdminProgram } from '@/hooks/useAdminPrograms';
import { useAdminOrgVocab } from '@/hooks/useAdminOrgVocab';
import { StudioHeader, STUDIO_COMPACT_BREAKPOINT } from '@/components/studio/StudioShell';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'rgba(48, 209, 88, 0.14)', fg: '#1B873F' },
  planned: { bg: 'rgba(0, 122, 255, 0.12)', fg: '#0A6FE0' },
  draft: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.7)' },
  completed: { bg: 'rgba(40, 64, 107, 0.12)', fg: '#28406B' },
  cancelled: { bg: 'rgba(255, 59, 48, 0.10)', fg: '#C8392E' },
  archived: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.7)' },
};

export default function AdminProgramsListPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const data = useAdminPrograms(orgId as string);
  const av = useAdminOrgVocab(orgId as string);
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;
  const [search, setSearch] = useState('');

  const filtered = search
    ? data.programs.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : data.programs;

  const totalEnrolled = data.programs.reduce((sum, p) => sum + p.participantCount, 0);

  return (
    <AdminShell activeKey="programs">
      <StudioHeader
        compact={compact}
        crumbs={['Admin', av.Programs]}
        title={av.Programs}
        subtitleParts={[
          <View key="count" style={s.pillWrap}>
            <View style={s.pill}>
              <Text style={s.pillText}>
                {data.totalCount} {data.totalCount === 1 ? av.Program : av.Programs}
              </Text>
            </View>
          </View>,
          <Text key="meta" style={s.subText}>
            {totalEnrolled} {av.members} enrolled · enroll a {av.Cohort.toLowerCase()} from any{' '}
            {av.Program.toLowerCase()}
          </Text>,
        ]}
      />

      <View style={s.filterRow}>
        <View style={s.searchInput}>
          <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search programs by name or description…"
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
            style={s.searchField}
          />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
        {data.loading ? (
          <Text style={s.loading}>Loading programs…</Text>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="layers-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>
              {search ? 'No matches' : `No ${av.Programs.toLowerCase()} yet`}
            </Text>
            <Text style={s.emptyBody}>
              {search
                ? `Nothing matches "${search}".`
                : `${av.Programs} are the curricula your ${av.members} move through. Each can enroll a whole ${av.Cohort.toLowerCase()} at once.`}
            </Text>
          </View>
        ) : (
          filtered.map((p) => (
            <ProgramRow
              key={p.id}
              program={p}
              onPress={() => router.push(`/admin/${orgId}/programs/${p.id}` as any)}
            />
          ))
        )}
      </ScrollView>
    </AdminShell>
  );
}

function ProgramRow({ program, onPress }: { program: AdminProgram; onPress: () => void }) {
  const tone = STATUS_TONE[program.status] ?? STATUS_TONE.draft;
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.rowIcon}>
        <Ionicons name="layers" size={18} color="#FFFFFF" />
      </View>
      <View style={s.rowCol}>
        <View style={s.rowNameRow}>
          <Text style={s.rowName}>{program.title}</Text>
          <View style={[s.statusTag, { backgroundColor: tone.bg }]}>
            <Text style={[s.statusTagText, { color: tone.fg }]}>
              {program.status.toUpperCase()}
            </Text>
          </View>
        </View>
        {program.description ? (
          <Text style={s.rowDesc} numberOfLines={2}>
            {program.description}
          </Text>
        ) : null}
        <View style={s.rowMetaRow}>
          <Text style={s.rowMeta}>
            <Text style={s.rowMetaStrong}>{program.participantCount}</Text>{' '}
            {program.participantCount === 1 ? 'enrolled' : 'enrolled'}
          </Text>
          {program.startLabel ? (
            <>
              <View style={s.rowMetaDot} />
              <Text style={s.rowMeta}>Starts {program.startLabel}</Text>
            </>
          ) : null}
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
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  rowDesc: { marginTop: 3, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  rowMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  rowMetaStrong: { fontWeight: '600', color: 'rgba(60, 60, 67, 0.85)' },
  rowMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(60, 60, 67, 0.3)' },
  rowAction: { padding: 4 },
  statusTag: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  statusTagText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },

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
