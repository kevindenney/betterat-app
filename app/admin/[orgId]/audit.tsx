/**
 * Org Admin · Audit log (Frame 29 of the JHSON Admin Suite)
 *
 * Filterable feed of admin actions with a sticky right-side detail
 * drawer showing the full event payload. Verbs are tone-tinted chips:
 * add/publish (green), edit (navy), del (danger), role (warn).
 *
 * Demo data — audit_events table isn't shipped yet. Wires up when the
 * SOC 2-style event log lands.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';

type Verb = 'add' | 'edit' | 'del' | 'publish' | 'role' | 'edit-sso';

interface AuditEntry {
  id: string;
  initials: string;
  aviTone: 'warm' | 'navy' | 'brown';
  verb: Verb;
  verbLabel: string;
  text: string[];
  time: string;
  shortRight: string;
}

interface DayGroup {
  label: string;
  count: number;
  entries: AuditEntry[];
}

const DAYS: DayGroup[] = [
  {
    label: 'Today · Sat May 23',
    count: 14,
    entries: [
      {
        id: 'evt 01h…f8c',
        initials: 'JA',
        aviTone: 'warm',
        verb: 'role',
        verbLabel: 'Role changed',
        text: [
          'J. Akello',
          ' changed ',
          'R. Vasquez',
          "'s role from ",
          'Student',
          ' to ',
          'Peer mentor',
          ' in ',
          'BSN Class of 2027 — Cohort A',
          '.',
        ],
        time: '2:14p',
        shortRight: '2:14p',
      },
      {
        id: 'evt 01h…e7b',
        initials: 'SP',
        aviTone: 'navy',
        verb: 'publish',
        verbLabel: 'Published',
        text: [
          'Dean S. Park',
          ' published ',
          'Sepsis bundle recognition v0.4',
          ' to ',
          'BSN Class of 2027 — Cohort A',
          '.',
        ],
        time: '1:08p',
        shortRight: '1:08p',
      },
      {
        id: 'evt 01h…d3a',
        initials: 'SP',
        aviTone: 'navy',
        verb: 'add',
        verbLabel: 'Invited',
        text: [
          'Dean S. Park',
          ' invited ',
          '14 people',
          ' via Bulk CSV to ',
          'BSN Class of 2027 — Cohort A',
          '.',
        ],
        time: '11:42a',
        shortRight: '11:42a',
      },
      {
        id: 'evt 01h…c08',
        initials: 'JA',
        aviTone: 'warm',
        verb: 'edit',
        verbLabel: 'Edited',
        text: [
          'J. Akello',
          ' updated cohort ',
          'BSN Class of 2027 — Cohort A',
          ' · max seats 30 → 32.',
        ],
        time: '11:14a',
        shortRight: '11:14a',
      },
      {
        id: 'evt 01h…a8b',
        initials: 'RM',
        aviTone: 'brown',
        verb: 'edit',
        verbLabel: 'Edited',
        text: [
          'Dr. R. Murphy',
          ' changed coverage strength on ',
          'ISBAR handoff',
          ' from ',
          'secondary',
          ' to ',
          'primary',
          ' for blueprint ',
          'Sepsis bundle recognition',
          '.',
        ],
        time: '9:02a',
        shortRight: '9:02a',
      },
    ],
  },
  {
    label: 'Yesterday · Fri May 22',
    count: 38,
    entries: [
      {
        id: 'evt 01h…916',
        initials: 'SP',
        aviTone: 'navy',
        verb: 'add',
        verbLabel: 'Claimed',
        text: [
          'Dean S. Park',
          ' claimed site ',
          'Howard County General Hospital',
          ' for JHSON.',
        ],
        time: 'Fri 4:42p',
        shortRight: 'Fri',
      },
      {
        id: 'evt 01h…82e',
        initials: 'JA',
        aviTone: 'warm',
        verb: 'del',
        verbLabel: 'Removed',
        text: [
          'J. Akello',
          ' removed ',
          'T. Reynolds',
          ' from ',
          'BSN Class of 2027 — Cohort A',
          ' (withdrew from program).',
        ],
        time: 'Fri 2:30p',
        shortRight: 'Fri',
      },
      {
        id: 'evt 01h…71d',
        initials: 'SP',
        aviTone: 'navy',
        verb: 'edit-sso',
        verbLabel: 'SSO config',
        text: [
          'Dean S. Park',
          ' updated SAML attribute mapping: ',
          'NameID → email',
          ', ',
          'eduPersonAffiliation → role',
          '.',
        ],
        time: 'Fri 10:18a',
        shortRight: 'Fri',
      },
    ],
  },
];

function aviToneStyle(tone: 'warm' | 'navy' | 'brown') {
  switch (tone) {
    case 'warm':
      return { backgroundColor: '#B8855A' };
    case 'navy':
      return { backgroundColor: '#28406B' };
    case 'brown':
      return { backgroundColor: '#8B5A3C' };
  }
}

function verbToneStyle(v: Verb) {
  switch (v) {
    case 'add':
    case 'publish':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47' };
    case 'edit':
    case 'edit-sso':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B' };
    case 'del':
      return { bg: 'rgba(255, 59, 48, 0.10)', fg: '#FF3B30' };
    case 'role':
      return { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632' };
  }
}

function renderRichText(parts: string[]): React.ReactNode[] {
  // Even-indexed parts are role names / strong; odd are connective text. Use heuristic:
  // first part is always the actor (strong), then alternates.
  return parts.map((p, i) => {
    const isStrong = i % 2 === 0;
    if (isStrong) {
      return (
        <Text key={i} style={s.entryStrong}>
          {p}
        </Text>
      );
    }
    return (
      <Text key={i} style={s.entryConnector}>
        {p}
      </Text>
    );
  });
}

const MONO: any = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Menlo';

export default function AdminAuditPage() {
  const { orgId: _ } = useLocalSearchParams<{ orgId: string }>();
  const [selectedId, setSelectedId] = useState<string>('evt 01h…f8c');
  const [search, setSearch] = useState('');

  return (
    <AdminShell activeKey="audit">
      <StudioHeader
        crumbs={['Admin', 'Security', 'Audit log']}
        title="Audit log"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              1,402 events
            </Text>
            {' · '}14 actors · retention: 7 years for SOC 2
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="calendar-outline" label="Last 90 days" />
            <StudioButton variant="ghost" icon="download-outline" label="Export" />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Filter row */}
        <View style={s.filterRow}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by target, actor, or event id…"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.searchInput}
            />
          </View>
          <View style={[s.filterChip, s.filterChipOn]}>
            <Ionicons name="pricetag-outline" size={13} color="#28406B" />
            <Text style={s.filterChipTextOn}>All events</Text>
            <Ionicons name="chevron-down" size={13} color="#28406B" />
          </View>
          <View style={s.filterChip}>
            <Ionicons name="person-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
            <Text style={s.filterChipText}>Any actor</Text>
            <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.6)" />
          </View>
          <View style={s.filterChip}>
            <Ionicons name="calendar-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
            <Text style={s.filterChipText}>Apr 1 – May 23</Text>
            <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.6)" />
          </View>
        </View>

        {/* Feed + Detail */}
        <View style={s.split}>
          <View style={s.feed}>
            {DAYS.map((day, di) => (
              <View key={day.label} style={[di > 0 && { marginTop: 18 }]}>
                <View style={s.dayHead}>
                  <Text style={s.dayDate}>{day.label}</Text>
                  <Text style={s.dayMeta}>{day.count} events</Text>
                </View>
                {day.entries.map((entry) => {
                  const tone = verbToneStyle(entry.verb);
                  const isSelected = entry.id === selectedId;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => setSelectedId(entry.id)}
                      style={[s.auditRow, isSelected && s.auditRowSel]}
                    >
                      <View style={[s.entryAv, aviToneStyle(entry.aviTone)]}>
                        <Text style={s.entryAvText}>{entry.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.entryText}>
                          <Text
                            style={[
                              s.verbChip,
                              { backgroundColor: tone.bg, color: tone.fg },
                            ]}
                          >
                            {' '}
                            {entry.verbLabel}{' '}
                          </Text>
                          {'  '}
                          {renderRichText(entry.text)}
                        </Text>
                        <View style={s.entryMeta}>
                          <Text style={s.entryMetaText}>{entry.time}</Text>
                          <Text style={s.entryMetaDot}>·</Text>
                          <Text style={s.entryMetaText}>{entry.id}</Text>
                        </View>
                      </View>
                      <Text style={s.rowRight}>{entry.shortRight}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Detail drawer (sticky) */}
          <View style={s.detail}>
            <View style={s.detailHead}>
              <View style={s.detailIco}>
                <Ionicons name="construct-outline" size={16} color="#C99632" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailVerb}>Role changed</Text>
                <Text style={s.detailH3}>evt 01h7n2q…f8c</Text>
              </View>
            </View>
            <View style={s.detailBody}>
              <DetailRow k="Actor" v="J. Akello · org_admin" />
              <DetailRow k="Target" v="R. Vasquez · membership_id mb_8c2" />
              <DetailRow k="Resource" v="cohort/bsn-2027-a" />
              <DetailRow k="When" v="2026-05-23 14:14:08 EDT" />
              <DetailRow k="IP" v="76.124.18.42 · Baltimore, MD" />
              <DetailRow k="Client" v="Web · Safari 18.4 · macOS 15.4" />
              <Text style={s.payloadLabel}>Payload</Text>
              <View style={s.payloadBox}>
                <Text style={s.payloadText}>
                  <Text style={s.payloadKey}>"action"</Text>:{' '}
                  <Text style={s.payloadStr}>"membership.role.change"</Text>,{'\n'}
                  <Text style={s.payloadKey}>"membership_id"</Text>:{' '}
                  <Text style={s.payloadStr}>"mb_8c2"</Text>,{'\n'}
                  <Text style={s.payloadKey}>"cohort"</Text>:{' '}
                  <Text style={s.payloadStr}>"bsn-2027-a"</Text>,{'\n'}
                  <Text style={s.payloadKey}>"before"</Text>: {'{ '}
                  <Text style={s.payloadKey}>"role"</Text>:{' '}
                  <Text style={s.payloadStr}>"student"</Text> {'}'},{'\n'}
                  <Text style={s.payloadKey}>"after"</Text>: {'{ '}
                  <Text style={s.payloadKey}>"role"</Text>:{' '}
                  <Text style={s.payloadStr}>"peer_mentor"</Text> {'}'},{'\n'}
                  <Text style={s.payloadKey}>"reason"</Text>:{' '}
                  <Text style={s.payloadStr}>"manual"</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailK}>{k}</Text>
      <Text style={s.detailV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F4EE',
  },
  searchInput: { flex: 1, fontSize: 12.5, color: '#1C1C1E', height: 32, padding: 0 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F4EE',
  },
  filterChipOn: { backgroundColor: 'rgba(40, 64, 107, 0.08)' },
  filterChipText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  filterChipTextOn: { fontSize: 12, color: '#28406B', fontWeight: '600' },

  // Split
  split: { flexDirection: 'row', gap: 18 },
  feed: { flex: 1 },
  detail: {
    width: 380,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },

  // Day head
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  dayDate: { fontSize: 12, color: '#1C1C1E', fontWeight: '600' },
  dayMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  // Audit row
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
  },
  auditRowSel: {
    borderColor: '#28406B',
    shadowColor: '#28406B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    ...({ boxShadow: '0 0 0 3px rgba(40, 64, 107, 0.08)' } as any),
  },
  entryAv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryAvText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  entryText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  entryStrong: { color: '#1C1C1E', fontWeight: '500' },
  entryConnector: { color: 'rgba(60, 60, 67, 0.85)' },
  verbChip: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderRadius: 4,
    overflow: 'hidden',
  },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  entryMetaText: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  entryMetaDot: { fontSize: 11, color: 'rgba(60, 60, 67, 0.4)' },
  rowRight: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', alignSelf: 'flex-start' },

  // Detail drawer
  detailHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIco: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(201, 150, 50, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailVerb: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C99632',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailH3: { marginTop: 2, fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.15 },

  detailBody: { padding: 18, gap: 14 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  detailK: {
    width: 100,
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  detailV: { flex: 1, fontSize: 12.5, color: '#1C1C1E' },

  payloadLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  payloadBox: {
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
    padding: 14,
  },
  payloadText: {
    fontFamily: MONO,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 18,
  },
  payloadKey: { color: '#28406B', fontWeight: '600' },
  payloadStr: { color: '#6E8B5A' },
});
