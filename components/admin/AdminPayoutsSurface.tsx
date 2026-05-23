/**
 * Org Admin · Author payouts (Frame 31 of the JHSON Admin Suite)
 *
 * Mirror of the independent author earnings (Frame 6) from the org side:
 * total paid-out YTD, per-author table with blueprints + earned + Stripe
 * Connect status, upcoming-payout panel showing the next batch close.
 *
 * Demo data — Stripe Connect wiring uses the existing services/StripeConnectService
 * but per-author org rollup isn't a table yet.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Author {
  id: string;
  name: string;
  subtitle: string;
  initials: string;
  aviTone: 'brown' | 'purple' | 'warm';
  blueprintChips: string[];
  extraCount?: number;
  activeSeats: number;
  earnedYTD: string;
  lastPayout: string;
  stripeStatus: { label: string; tone: 'ok' | 'warn' };
}

const AUTHORS: Author[] = [
  {
    id: 'rm',
    name: 'Dr. R. Murphy',
    subtitle: 'JHSON faculty · 12 blueprints',
    initials: 'RM',
    aviTone: 'brown',
    blueprintChips: ['Sepsis bundle', 'IV insertion'],
    extraCount: 10,
    activeSeats: 22,
    earnedYTD: '$5,180.00',
    lastPayout: 'Apr 30 · $1,240',
    stripeStatus: { label: 'Stripe · verified', tone: 'ok' },
  },
  {
    id: 'jk',
    name: 'J. Kim, RN',
    subtitle: 'Preceptor · 4 blueprints',
    initials: 'JK',
    aviTone: 'purple',
    blueprintChips: ['Head-to-toe', 'Foley placement'],
    extraCount: 2,
    activeSeats: 18,
    earnedYTD: '$2,310.00',
    lastPayout: 'Apr 30 · $480',
    stripeStatus: { label: 'Stripe · verified', tone: 'ok' },
  },
  {
    id: 'na',
    name: 'Noor Aziz',
    subtitle: 'Independent · 1 blueprint',
    initials: 'NA',
    aviTone: 'warm',
    blueprintChips: ['Discharge teach-back'],
    activeSeats: 6,
    earnedYTD: '$930.00',
    lastPayout: 'Apr 30 · $170',
    stripeStatus: { label: 'Connect · action needed', tone: 'warn' },
  },
];

export function AdminPayoutsSurface() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      {/* Stat strip */}
      <View style={s.statRow}>
        <StatCard
          k="Paid YTD"
          v="$8,420"
          vSub=".00"
          d="across 3 authors, 5 blueprints"
        />
        <StatCard
          k="Pending · next batch"
          v="$1,240"
          vSub=".00"
          d="clears May 31, 2026"
          vTone="warn"
        />
        <StatCard
          k="Cohort seats producing payouts"
          v="30 / 30"
          d="BSN Class of 2027 — Cohort A"
        />
        <StatCard
          k="Last batch"
          v="$1,890"
          vSub=".00"
          d="cleared Apr 30 · 3 authors"
        />
      </View>

      {/* Author table */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.cardEyebrow}>Authors</Text>
            <Text style={s.cardH3}>By total earned this year</Text>
          </View>
          <View style={s.cardHeadActions}>
            <View style={s.segControl}>
              <View style={[s.segOpt, s.segOptOn]}>
                <Text style={s.segOptTextOn}>All</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>Active</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>Connect issues</Text>
              </View>
            </View>
            <Pressable style={s.btnSm}>
              <Ionicons name="add" size={12} color="#28406B" />
              <Text style={s.btnSmText}>Onboard author</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.th, { width: 240 }]}>Author</Text>
          <Text style={[s.th, { flex: 1.2 }]}>Blueprints</Text>
          <Text style={[s.th, s.thRight, { width: 90 }]}>Active seats</Text>
          <Text style={[s.th, s.thRight, { width: 110 }]}>Earned YTD</Text>
          <Text style={[s.th, { width: 140 }]}>Last payout</Text>
          <Text style={[s.th, { flex: 1 }]}>Connect status</Text>
          <View style={{ width: 40 }} />
        </View>
        {AUTHORS.map((a, idx) => (
          <View key={a.id} style={[s.tr, idx === AUTHORS.length - 1 && s.trLast]}>
            <View style={[s.td, { width: 240, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <View style={[s.avi, aviToneStyle(a.aviTone)]}>
                <Text style={s.aviText}>{a.initials}</Text>
              </View>
              <View>
                <Text style={s.authorName}>{a.name}</Text>
                <Text style={s.authorSubtitle}>{a.subtitle}</Text>
              </View>
            </View>
            <View style={[s.td, { flex: 1.2, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
              {a.blueprintChips.map((c) => (
                <View key={c} style={s.bpChip}>
                  <Text style={s.bpChipText}>{c}</Text>
                </View>
              ))}
              {a.extraCount ? (
                <View style={s.bpChipMuted}>
                  <Text style={s.bpChipMutedText}>+{a.extraCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.td, s.tdRight, s.tdNum, { width: 90 }]}>{a.activeSeats}</Text>
            <Text style={[s.td, s.tdRight, s.tdNum, { width: 110 }]}>{a.earnedYTD}</Text>
            <Text style={[s.td, { width: 140 }]}>{a.lastPayout}</Text>
            <View style={[s.td, { flex: 1 }]}>
              <View
                style={[
                  s.stripePill,
                  a.stripeStatus.tone === 'warn' ? s.stripePillWarn : null,
                ]}
              >
                <Ionicons
                  name={a.stripeStatus.tone === 'warn' ? 'warning-outline' : 'checkmark'}
                  size={11}
                  color={a.stripeStatus.tone === 'warn' ? '#C99632' : '#5851D6'}
                />
                <Text
                  style={[
                    s.stripePillText,
                    a.stripeStatus.tone === 'warn' && { color: '#C99632' },
                  ]}
                >
                  {a.stripeStatus.label}
                </Text>
              </View>
            </View>
            <View style={{ width: 40, alignItems: 'flex-end' }}>
              <Pressable style={s.iconBtn}>
                <Ionicons name="ellipsis-vertical" size={13} color="rgba(60, 60, 67, 0.6)" />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {/* Upcoming payout panel */}
      <View style={s.panel}>
        <View style={s.panelHead}>
          <Text style={s.panelEyebrow}>Upcoming payout · Sun May 31</Text>
          <Text style={s.panelHint}>Cleared 5 business days after period close</Text>
        </View>
        <View style={s.panelRow}>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Period</Text>
            <Text style={s.panelCellValue}>May 1 – May 31, 2026</Text>
            <Text style={s.panelCellSub}>30 active seats · 70/10/20 split</Text>
          </View>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Authors getting paid</Text>
            <Text style={s.panelCellValue}>3 of 3</Text>
            <Text style={[s.panelCellSub, { color: '#C99632' }]}>
              N. Aziz must complete Connect verification first
            </Text>
          </View>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Batch total</Text>
            <Text style={s.panelCellValue}>$1,240.00</Text>
            <Text style={s.panelCellSub}>Rebate back to JHSON: $248.00</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({
  k,
  v,
  vSub,
  d,
  vTone,
}: {
  k: string;
  v: string;
  vSub?: string;
  d: string;
  vTone?: 'warn';
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statK}>{k}</Text>
      <Text style={[s.statV, vTone === 'warn' && { color: '#C99632' }]}>
        {v}
        {vSub ? <Text style={s.statVSub}>{vSub}</Text> : null}
      </Text>
      <Text style={s.statD}>{d}</Text>
    </View>
  );
}

function aviToneStyle(tone: 'brown' | 'purple' | 'warm') {
  switch (tone) {
    case 'brown':
      return { backgroundColor: '#8B5A3C' };
    case 'purple':
      return { backgroundColor: '#7A5A8B' };
    case 'warm':
      return { backgroundColor: '#B8855A' };
  }
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 22 },

  statRow: { flexDirection: 'row', gap: 12 },
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statVSub: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  statD: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  card: {
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
  cardHeadActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cardH3: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },

  btnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  btnSmText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },

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

  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F4EE',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  th: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  thRight: { textAlign: 'right' },

  tr: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  trLast: { borderBottomWidth: 0 },
  td: { fontSize: 13, color: '#1C1C1E' },
  tdRight: { textAlign: 'right' },
  tdNum: { fontWeight: '600', fontVariant: ['tabular-nums'] },

  avi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  authorName: { fontWeight: '600', color: '#1C1C1E', fontSize: 13 },
  authorSubtitle: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  bpChip: {
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderRadius: 4,
  },
  bpChipText: { fontSize: 10.5, fontWeight: '700', color: '#28406B', letterSpacing: 0.3 },
  bpChipMuted: {
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: '#EDEBE2',
    borderRadius: 4,
  },
  bpChipMutedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.3,
  },

  stripePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 91, 255, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(99, 91, 255, 0.18)',
  },
  stripePillWarn: {
    backgroundColor: 'rgba(201, 150, 50, 0.14)',
    borderColor: 'rgba(201, 150, 50, 0.3)',
  },
  stripePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#5851D6',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  iconBtn: { padding: 5, borderRadius: 6, backgroundColor: 'rgba(60, 60, 67, 0.06)' },

  panel: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 14,
  },
  panelHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  panelEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  panelHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  panelRow: { flexDirection: 'row', gap: 14 },
  panelCell: {
    flex: 1,
    backgroundColor: '#F5F4EE',
    borderRadius: 10,
    padding: 14,
  },
  panelCellLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  panelCellValue: { marginTop: 4, fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  panelCellSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
});
