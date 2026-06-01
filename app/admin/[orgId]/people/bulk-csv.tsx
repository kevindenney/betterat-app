/**
 * Org Admin · People · Bulk CSV (Frame 26 of the JHSON Admin Suite)
 *
 * Full-page extension of the Add Person sheet's Bulk CSV tab. Drop zone
 * + file card + 4-stat validation summary + column-mapping preview table
 * with per-row Ready/Error/Warning/Already-on-BetterAt status.
 *
 * Demo data — real CSV parsing + validation lands when the bulk-invite
 * pipeline ships.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';

type RowStatus = 'ok' | 'err' | 'warn' | 'exists';

interface PreviewRow {
  n: number;
  email: string;
  name: string;
  role: string;
  cohort: string;
  start: string;
  status: RowStatus;
  message: string;
  roleErr?: boolean;
  emailErr?: boolean;
}

const ROWS: PreviewRow[] = [
  { n: 1, email: 'emily.tran@jh.edu', name: 'Emily Tran', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'ok', message: 'Ready' },
  { n: 2, email: 'd.aldridge@jh.edu', name: 'Devon Aldridge', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'ok', message: 'Ready' },
  { n: 3, email: 'n.helms@jh.edu', name: 'Nora Helms', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'ok', message: 'Ready' },
  { n: 4, email: '—', name: 'C. Otieno', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'err', message: 'Missing email', emailErr: true },
  { n: 5, email: 'mei.sato@jh.edu', name: 'Mei Sato', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'exists', message: 'Already on BetterAt' },
  { n: 6, email: 'r.vasquez@jh.edu', name: 'Rafael Vasquez', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'ok', message: 'Ready' },
  { n: 7, email: 'j.kim@jhmi.org', name: 'J. Kim, RN', role: 'preceptor-rn', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'err', message: 'Invalid role · use "Mentor"', roleErr: true },
  { n: 8, email: 's.park@jhmi.edu', name: 'S. Park', role: 'Faculty', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'warn', message: 'jhmi.edu not yet verified' },
  { n: 9, email: 'l.bryan@jh.edu', name: 'Liam Bryan', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'ok', message: 'Ready' },
  { n: 10, email: 'emily.tran@jh.edu', name: 'Emily Tran (dup)', role: 'Student', cohort: 'BSN 2027 A', start: 'Apr 5', status: 'err', message: 'Duplicate of row 1' },
];

function statusStyles(s: RowStatus) {
  switch (s) {
    case 'ok':
      return { fg: '#1E8F47', icon: 'checkmark-circle' as const };
    case 'err':
      return { fg: '#FF3B30', icon: 'alert-circle' as const };
    case 'warn':
      return { fg: '#C99632', icon: 'warning' as const };
    case 'exists':
      return { fg: 'rgba(60, 60, 67, 0.6)', icon: 'person-circle-outline' as const };
  }
}

export default function AdminBulkCsvPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();

  return (
    <AdminShell activeKey="people">
      <StudioHeader
        crumbs={['Admin', 'People', 'Add people · Bulk CSV']}
        title="Add people · Bulk CSV"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            Map columns, fix what we caught, then send.{' '}
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>32 rows</Text>
            {' · '}
            <Text style={{ color: '#1E8F47', fontWeight: '600' }}>28 valid</Text>
            {' · '}
            <Text style={{ color: '#FF3B30', fontWeight: '600' }}>4 errors</Text>
          </Text>,
        ]}
        actions={
          <>
            <StudioButton
              variant="ghost"
              icon="arrow-back-outline"
              label="Back to People"
              onPress={() => router.push(`/admin/${orgId}/people`)}
            />
            <StudioButton variant="ghost" icon="download-outline" label="Download template" />
            <StudioButton
              variant="primary"
              accent="blue"
              icon="mail"
              label="Send 28 invites · skip 4 errors"
            />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Method tabs */}
        <View style={s.tabs}>
          <View style={s.tab}>
            <Ionicons name="mail-outline" size={14} color="rgba(60, 60, 67, 0.6)" />
            <Text style={s.tabText}>Email</Text>
            <Text style={s.tabBadge}>manual</Text>
          </View>
          <View style={[s.tab, s.tabOn]}>
            <Ionicons name="grid-outline" size={14} color="#28406B" />
            <Text style={s.tabTextOn}>Bulk CSV</Text>
            <View style={s.tabBadgeOn}>
              <Text style={s.tabBadgeOnText}>32</Text>
            </View>
          </View>
          <View style={s.tab}>
            <Ionicons name="key-outline" size={14} color="rgba(60, 60, 67, 0.6)" />
            <Text style={s.tabText}>From SSO</Text>
          </View>
          <View style={s.tab}>
            <Ionicons name="link-outline" size={14} color="rgba(60, 60, 67, 0.6)" />
            <Text style={s.tabText}>Invite link</Text>
          </View>
        </View>

        {/* Drop zone */}
        <View style={s.dropZone}>
          <View style={s.dropIco}>
            <Ionicons name="grid" size={22} color="#28406B" />
          </View>
          <View style={s.fileCard}>
            <View style={s.fileCardIco}>
              <Ionicons name="document-outline" size={18} color="rgba(60, 60, 67, 0.85)" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fileCardName}>bsn-2027-cohort-a.csv</Text>
              <Text style={s.fileCardMeta}>32 rows · 5 columns · uploaded 14s ago</Text>
            </View>
            <Pressable style={s.btnSmGhost}>
              <Ionicons name="refresh-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
              <Text style={s.btnSmGhostText}>Replace</Text>
            </Pressable>
            <Pressable style={s.iconBtnDanger}>
              <Ionicons name="close" size={13} color="#FF3B30" />
            </Pressable>
          </View>
        </View>

        {/* Validation summary */}
        <View style={s.statRow}>
          <SummaryCard tone="ok" k="Valid & ready" v="28" d="rows will receive an invite" />
          <SummaryCard tone="err" k="Errors" v="4" d="will be skipped unless you fix them" />
          <SummaryCard tone="warn" k="Warnings" v="2" d="e.g. domain not yet verified" />
          <SummaryCard tone="muted" k="Already on BetterAt" v="3" d="will be added to cohort, no invite sent" />
        </View>

        {/* Preview table */}
        <View style={s.tableCard}>
          <View style={s.tableHead}>
            <Text style={[s.th, { width: 36 }]}>#</Text>
            <View style={[{ flex: 1.5 }, s.thCol]}>
              <Text style={s.th}>Email</Text>
              <View style={s.mapper}>
                <Text style={s.mapperText}>email</Text>
                <Ionicons name="chevron-down" size={11} color="rgba(60, 60, 67, 0.6)" />
              </View>
            </View>
            <View style={[{ flex: 1.2 }, s.thCol]}>
              <Text style={s.th}>Full name</Text>
              <View style={s.mapper}>
                <Text style={s.mapperText}>name</Text>
                <Ionicons name="chevron-down" size={11} color="rgba(60, 60, 67, 0.6)" />
              </View>
            </View>
            <View style={[{ flex: 1 }, s.thCol]}>
              <Text style={s.th}>Role</Text>
              <View style={s.mapper}>
                <Text style={s.mapperText}>role</Text>
                <Ionicons name="chevron-down" size={11} color="rgba(60, 60, 67, 0.6)" />
              </View>
            </View>
            <View style={[{ flex: 1.2 }, s.thCol]}>
              <Text style={s.th}>Cohort</Text>
              <View style={s.mapper}>
                <Text style={s.mapperText}>cohort</Text>
                <Ionicons name="chevron-down" size={11} color="rgba(60, 60, 67, 0.6)" />
              </View>
            </View>
            <View style={[{ width: 70 }, s.thCol]}>
              <Text style={s.th}>Start</Text>
              <View style={s.mapper}>
                <Text style={s.mapperText}>start_date</Text>
                <Ionicons name="chevron-down" size={11} color="rgba(60, 60, 67, 0.6)" />
              </View>
            </View>
            <Text style={[s.th, { width: 210 }]}>Validation</Text>
          </View>
          {ROWS.map((row, idx) => {
            const ss = statusStyles(row.status);
            return (
              <View
                key={row.n}
                style={[
                  s.tr,
                  row.status === 'err' && s.trErr,
                  row.status === 'warn' && s.trWarn,
                  idx === ROWS.length - 1 && s.trLast,
                ]}
              >
                <Text style={[s.td, { width: 36 }]}>{row.n}</Text>
                <Text style={[s.td, { flex: 1.5 }, row.emailErr && s.tdEmpty]}>{row.email}</Text>
                <Text style={[s.td, { flex: 1.2 }]}>{row.name}</Text>
                <Text style={[s.td, { flex: 1 }, row.roleErr && s.tdErr]}>{row.role}</Text>
                <Text style={[s.td, { flex: 1.2 }]}>{row.cohort}</Text>
                <Text style={[s.td, { width: 70 }]}>{row.start}</Text>
                <View style={[s.td, { width: 210, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <Ionicons name={ss.icon} size={13} color={ss.fg} />
                  <Text style={[s.tdValidation, { color: ss.fg }]}>{row.message}</Text>
                </View>
              </View>
            );
          })}
          <Text style={s.tableFooter}>Showing 10 of 32 rows · scroll for the rest</Text>
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function SummaryCard({
  tone,
  k,
  v,
  d,
}: {
  tone: 'ok' | 'err' | 'warn' | 'muted';
  k: string;
  v: string;
  d: string;
}) {
  const color =
    tone === 'ok' ? '#1E8F47' : tone === 'err' ? '#FF3B30' : tone === 'warn' ? '#C99632' : 'rgba(60, 60, 67, 0.6)';
  return (
    <View style={s.statCard}>
      <Text style={[s.statK, { color }]}>{k}</Text>
      <Text style={s.statV}>{v}</Text>
      <Text style={s.statD}>{d}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    gap: 0,
    paddingHorizontal: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -0.5,
  },
  tabOn: { borderBottomColor: '#28406B' },
  tabText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)' },
  tabTextOn: { fontSize: 13, color: '#28406B', fontWeight: '600' },
  tabBadge: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
    borderRadius: 4,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
  },
  tabBadgeOn: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderRadius: 4,
  },
  tabBadgeOnText: { fontSize: 10.5, color: '#28406B', fontWeight: '700' },

  // Drop zone
  dropZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.10)',
  },
  dropIco: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  fileCardIco: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCardName: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  fileCardMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  btnSmGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  btnSmGhostText: { fontSize: 11.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  iconBtnDanger: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statK: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.0, textTransform: 'uppercase' },
  statV: { marginTop: 6, fontSize: 22, fontWeight: '700', color: '#1C1C1E', fontVariant: ['tabular-nums'] },
  statD: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Table
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F4EE',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    gap: 8,
    alignItems: 'flex-start',
  },
  thCol: { gap: 4 },
  th: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  mapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 4,
  },
  mapperText: { fontSize: 10.5, color: '#28406B', fontWeight: '600' },

  tr: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    gap: 8,
  },
  trErr: { backgroundColor: 'rgba(255, 59, 48, 0.03)' },
  trWarn: { backgroundColor: 'rgba(201, 150, 50, 0.04)' },
  trLast: { borderBottomWidth: 0 },
  td: { fontSize: 12.5, color: '#1C1C1E' },
  tdEmpty: { color: 'rgba(60, 60, 67, 0.3)', fontStyle: 'italic' },
  tdErr: { color: '#FF3B30', fontStyle: 'italic' },
  tdValidation: { fontSize: 11.5, fontWeight: '500', flex: 1 },

  tableFooter: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
