/**
 * Org Admin · Site detail (Frame 25 of the JHSON Admin Suite)
 *
 * Drilled into from the Sites list. Hero with site name + kind + address
 * + claim badges + a map mini-view; 4-stat strip; two-column row with
 * top-competencies bars + roster; recent practice feed below.
 *
 * Demo data hardcoded against the East Baltimore JH Hospital — real
 * wiring lands when site_member_assignments + site rotations tables ship.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { StatRow } from '@/components/studio/StatRow';

interface CompetencyBar {
  label: string;
  evCount: number;
  barPct: number;
  scaleNum: number;
}

const TOP_COMPETENCIES: CompetencyBar[] = [
  { label: 'Sepsis bundle recognition', evCount: 52, barPct: 92, scaleNum: 92 },
  { label: 'Medication administration', evCount: 48, barPct: 84, scaleNum: 84 },
  { label: 'Head-to-toe assessment', evCount: 39, barPct: 68, scaleNum: 68 },
  { label: 'ISBAR handoff communication', evCount: 31, barPct: 54, scaleNum: 54 },
  { label: 'Cardiac telemetry interpretation', evCount: 22, barPct: 38, scaleNum: 38 },
];

interface RosterRow {
  initials: string;
  aviTone: 'navy' | 'green' | 'steel' | 'purple' | 'warm';
  name: string;
  meta: string;
  status: { label: string; tone: 'ok' | 'warn' };
}

const ROSTER: RosterRow[] = [
  { initials: 'ET', aviTone: 'navy', name: 'Emily Tran', meta: 'BSN 27A · Wk 6 of 8 here', status: { label: 'On track', tone: 'ok' } },
  { initials: 'DA', aviTone: 'green', name: 'Devon Aldridge', meta: 'BSN 27A · Wk 5 of 8 here', status: { label: 'On track', tone: 'ok' } },
  { initials: 'NH', aviTone: 'steel', name: 'Nora Helms', meta: 'BSN 27A · Wk 6 of 8 here', status: { label: 'Wants follow-up', tone: 'warn' } },
  { initials: 'CO', aviTone: 'purple', name: 'Camille Otieno', meta: 'BSN 27A · Wk 4 of 8 here', status: { label: 'On track', tone: 'ok' } },
  { initials: 'MS', aviTone: 'warm', name: 'Mei Sato', meta: 'MSN · acute care · Wk 2 of 6', status: { label: 'On track', tone: 'ok' } },
];

interface RecentRow {
  initials: string;
  aviTone: 'navy' | 'steel' | 'brown';
  bodyParts: { kind: 'strong' | 'text' | 'em'; v: string }[];
  when: string;
  shortRight: string;
  chips: { tone: 'plain' | 'cat-comm' | 'cat-asmt' | 'warn'; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
}

const RECENT: RecentRow[] = [
  {
    initials: 'ET',
    aviTone: 'navy',
    bodyParts: [
      { kind: 'strong', v: 'Emily Tran' },
      { kind: 'text', v: ' settled ' },
      { kind: 'strong', v: 'ISBAR handoff to rapid response' },
      { kind: 'text', v: ' on ' },
      { kind: 'em', v: 'Sepsis bundle recognition' },
      { kind: 'text', v: '.' },
    ],
    when: '2 min ago',
    shortRight: '2:14p',
    chips: [
      { tone: 'cat-comm', label: 'Communication' },
      { tone: 'plain', label: 'ISBAR handoff' },
    ],
  },
  {
    initials: 'NH',
    aviTone: 'steel',
    bodyParts: [
      { kind: 'strong', v: 'Nora Helms' },
      { kind: 'text', v: ' reflected on a missed fluid bolus volume and flagged for mentor follow-up.' },
    ],
    when: 'Fri 4:42p',
    shortRight: 'Fri',
    chips: [
      { tone: 'warn', label: 'Wants follow-up', icon: 'flag-outline' },
      { tone: 'plain', label: 'Sepsis bundle recognition' },
    ],
  },
  {
    initials: 'JK',
    aviTone: 'brown',
    bodyParts: [
      { kind: 'strong', v: 'J. Kim, RN' },
      { kind: 'text', v: ' marked ' },
      { kind: 'strong', v: 'Devon Aldridge' },
      { kind: 'text', v: '’s Head-to-toe assessment as settled.' },
    ],
    when: 'Fri 11:08a',
    shortRight: 'Fri',
    chips: [{ tone: 'cat-asmt', label: 'Assessment' }],
  },
];

function aviToneStyle(tone: 'navy' | 'green' | 'steel' | 'purple' | 'warm' | 'brown') {
  switch (tone) {
    case 'navy':
      return { backgroundColor: '#28406B' };
    case 'green':
      return { backgroundColor: '#6E8B5A' };
    case 'steel':
      return { backgroundColor: '#5A6B8B' };
    case 'purple':
      return { backgroundColor: '#7A5A8B' };
    case 'warm':
      return { backgroundColor: '#B8855A' };
    case 'brown':
      return { backgroundColor: '#8B5A3C' };
  }
}

function chipToneStyle(tone: 'plain' | 'cat-comm' | 'cat-asmt' | 'warn') {
  switch (tone) {
    case 'plain':
      return { bg: 'rgba(40, 64, 107, 0.10)', fg: '#28406B' };
    case 'cat-comm':
      return { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A' };
    case 'cat-asmt':
      return { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B' };
    case 'warn':
      return { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632' };
  }
}

export default function AdminSiteDetailPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string; poiId: string }>();
  const router = useRouter();

  return (
    <AdminShell activeKey="sites">
      <StudioHeader
        crumbs={['Admin', 'Sites', 'Johns Hopkins Hospital — East Baltimore']}
        title="Johns Hopkins Hospital — East Baltimore"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              Teaching hospital
            </Text>
            {' · '}1800 Orleans St, Baltimore MD 21287 · Claimed by JHSON · Sep 2024
          </Text>,
        ]}
        actions={
          <>
            <StudioButton
              variant="ghost"
              icon="arrow-back-outline"
              label="Back to Sites"
              onPress={() => router.push(`/admin/${orgId}/sites`)}
            />
            <StudioButton variant="ghost" icon="time-outline" label="Hours & access" />
            <StudioButton variant="primary" accent="navy" icon="person-add-outline" label="Add preceptor" />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroMain}>
            <View style={s.heroRow1}>
              <View style={s.heroShield}>
                <Ionicons name="medical-outline" size={22} color="#28406B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroH2}>Johns Hopkins Hospital — East Baltimore</Text>
                <Text style={s.heroKind}>Teaching hospital · 1,162 beds · Level I trauma</Text>
              </View>
            </View>
            <Text style={s.heroAddr}>
              1800 Orleans St, Baltimore MD 21287
              {'\n'}
              Charge:{' '}
              <Text style={s.heroAddrBold}>(410) 555-0182</Text>
              {' · Parking validated for clinical rotations'}
            </Text>
            <View style={s.heroBadges}>
              <View style={[s.chip, { backgroundColor: 'rgba(30, 143, 71, 0.12)' }]}>
                <Ionicons name="shield-checkmark" size={11} color="#1E8F47" />
                <Text style={[s.chipText, { color: '#1E8F47' }]}>Verified site</Text>
              </View>
              <View style={[s.chip, { backgroundColor: 'rgba(40, 64, 107, 0.10)' }]}>
                <Text style={[s.chipText, { color: '#28406B' }]}>Claimed by JHSON</Text>
              </View>
              <View style={[s.chip, { backgroundColor: '#EDEBE2' }]}>
                <Text style={[s.chipText, { color: '#1C1C1E' }]}>Teaching · Level I</Text>
              </View>
              <View style={[s.chip, { backgroundColor: '#EDEBE2' }]}>
                <Text style={[s.chipText, { color: '#1C1C1E' }]}>Validated parking</Text>
              </View>
            </View>
          </View>
          <View style={s.heroMap}>
            <View style={[s.ring, { width: 140, height: 140 }]} />
            <View style={[s.ring, { width: 90, height: 90 }]} />
            <View style={[s.ring, { width: 50, height: 50 }]} />
            <View style={s.pin} />
          </View>
        </View>

        {/* Stat strip */}
        <StatRow>
          <StatCard k="Students rotating" v="18" d="12 BSN · 6 MSN this week" />
          <StatCard k="Preceptors" v="7" d="2 added this term" />
          <StatCard k="Steps evidenced · 30d" v="214" d="+34 vs prior 30d" />
          <StatCard k="Settled rate" v="82" vSuffix="%" d="of steps marked settled" />
        </StatRow>

        {/* Two-col row · top competencies + roster */}
        <View style={s.twoCol}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>Top 5 evidenced</Text>
                <Text style={s.cardH3}>Competencies most practiced here</Text>
              </View>
              <Text style={s.cardHeadMeta}>trailing 90d</Text>
            </View>
            <View style={s.cardBody}>
              {TOP_COMPETENCIES.map((c, i) => (
                <View key={c.label} style={[s.cellRow, i > 0 && s.cellRowBorder]}>
                  <Text style={s.cellLbl}>{c.label}</Text>
                  <Text style={s.cellNumLabel}>{c.evCount} ev.</Text>
                  <View style={s.cellBar}>
                    <View style={[s.cellBarFill, { width: `${c.barPct}%` }]} />
                  </View>
                  <Text style={s.cellNum}>{c.scaleNum}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>Roster · rotating this week</Text>
                <Text style={s.cardH3}>18 students currently here</Text>
              </View>
              <Pressable style={s.btnSm}>
                <Text style={s.btnSmText}>View all ›</Text>
              </Pressable>
            </View>
            <View style={[s.cardBody, { paddingTop: 6 }]}>
              {ROSTER.map((r) => (
                <View key={r.initials + r.name} style={s.rosterRow}>
                  <View style={[s.avi, aviToneStyle(r.aviTone)]}>
                    <Text style={s.aviText}>{r.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rosterName}>{r.name}</Text>
                    <Text style={s.rosterMeta}>{r.meta}</Text>
                  </View>
                  <View
                    style={[
                      s.chip,
                      { backgroundColor: r.status.tone === 'warn' ? 'rgba(201, 150, 50, 0.14)' : 'rgba(30, 143, 71, 0.12)' },
                    ]}
                  >
                    <Text
                      style={[s.chipText, { color: r.status.tone === 'warn' ? '#C99632' : '#1E8F47' }]}
                    >
                      {r.status.label}
                    </Text>
                  </View>
                </View>
              ))}
              <Text style={s.rosterMore}>+ 13 more</Text>
            </View>
          </View>
        </View>

        {/* Recent practice */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardEyebrow}>Recent practice at this site</Text>
              <Text style={s.cardH3}>Last 24 hours</Text>
            </View>
            <View style={s.segControl}>
              <View style={[s.segOpt, s.segOptOn]}>
                <Text style={s.segOptTextOn}>24h</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>7d</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>30d</Text>
              </View>
            </View>
          </View>
          <View style={[s.cardBody, { paddingTop: 6 }]}>
            {RECENT.map((entry, i) => (
              <View key={i} style={s.recentRow}>
                <View style={[s.avi, aviToneStyle(entry.aviTone)]}>
                  <Text style={s.aviText}>{entry.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentText}>
                    {entry.bodyParts.map((p, j) => {
                      if (p.kind === 'strong') {
                        return (
                          <Text key={j} style={s.recentStrong}>
                            {p.v}
                          </Text>
                        );
                      }
                      if (p.kind === 'em') {
                        return (
                          <Text key={j} style={s.recentEm}>
                            {p.v}
                          </Text>
                        );
                      }
                      return p.v;
                    })}
                  </Text>
                  <View style={s.recentMeta}>
                    <Text style={s.recentWhen}>{entry.when}</Text>
                    <Text style={s.recentDot}>·</Text>
                    {entry.chips.map((c) => {
                      const tone = chipToneStyle(c.tone);
                      return (
                        <View
                          key={c.label}
                          style={[s.chip, { backgroundColor: tone.bg }]}
                        >
                          {c.icon ? (
                            <Ionicons name={c.icon} size={11} color={tone.fg} />
                          ) : null}
                          <Text style={[s.chipText, { color: tone.fg }]}>{c.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={s.recentRight}>{entry.shortRight}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function StatCard({
  k,
  v,
  vSuffix,
  d,
}: {
  k: string;
  v: string;
  vSuffix?: string;
  d: string;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statK}>{k}</Text>
      <Text style={s.statV}>
        {v}
        {vSuffix ? <Text style={s.statVSuffix}>{vSuffix}</Text> : null}
      </Text>
      <Text style={s.statD}>{d}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  // Hero
  hero: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  heroMain: { flex: 1, padding: 22, gap: 10 },
  heroRow1: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroShield: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroH2: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3 },
  heroKind: { marginTop: 2, fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  heroAddr: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  heroAddrBold: { color: '#1C1C1E', fontWeight: '600' },
  heroBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },

  heroMap: {
    width: 200,
    backgroundColor: '#EDEBE2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.18)',
    borderRadius: 999,
  },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#28406B',
    shadowColor: '#28406B',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '600' },

  // Stat strip
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
  statVSuffix: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  statD: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Two-col row
  twoCol: { flexDirection: 'row', gap: 18 },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cardH3: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  cardHeadMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  cardBody: { padding: 18 },

  btnSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  btnSmText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },

  // Competency bars
  cellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  cellRowBorder: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  cellLbl: { flex: 1, fontSize: 12.5, color: '#1C1C1E' },
  cellNumLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', minWidth: 50, textAlign: 'right' },
  cellBar: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDEBE2',
    overflow: 'hidden',
  },
  cellBarFill: { height: '100%', backgroundColor: '#28406B', borderRadius: 3 },
  cellNum: {
    minWidth: 24,
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  // Roster
  avi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  rosterName: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  rosterMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  rosterMore: { paddingTop: 10, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Recent
  segControl: {
    flexDirection: 'row',
    backgroundColor: '#F5F4EE',
    borderRadius: 7,
    padding: 2,
    gap: 1,
  },
  segOpt: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
  segOptOn: { backgroundColor: '#FFFFFF' },
  segOptText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  segOptTextOn: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  recentText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  recentStrong: { color: '#1C1C1E', fontWeight: '500' },
  recentEm: { color: 'rgba(60, 60, 67, 0.85)', fontStyle: 'italic' },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  recentWhen: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  recentDot: { fontSize: 11, color: 'rgba(60, 60, 67, 0.4)' },
  recentRight: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
});
