/**
 * Org Admin · Billing & invoices (Frame 30 of the JHSON Admin Suite)
 *
 * Unified surface for the Billing + Invoices sidebar items. Both routes
 * render this same body — activeKey on the parent sets which sidebar
 * row gets the navy tint.
 *
 * Visual: navy-gradient plan hero (left) + warm-cream side card with
 * seats bar + renewal (right). Payment-method card + account-notices
 * card share a row. Invoice table at the bottom.
 *
 * Demo data only — Stripe billing tables aren't shipped yet, so the
 * numbers are hardcoded to match the design (BSN Class of 2027 — Cohort A,
 * 30 of 50 seats, $1,490/mo institutional pilot).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface InvoiceRow {
  id: string;
  period: string;
  seats: number;
  amount: string;
  status: { label: string; tone: 'ok' | 'warn'; icon: keyof typeof Ionicons.glyphMap };
}

const INVOICES: InvoiceRow[] = [
  { id: 'INV-2026-05', period: 'May 1 – May 31, 2026', seats: 30, amount: '$1,490.00', status: { label: 'Due Jun 1', tone: 'warn', icon: 'time-outline' } },
  { id: 'INV-2026-04', period: 'Apr 1 – Apr 30, 2026', seats: 28, amount: '$1,490.00', status: { label: 'Paid · Apr 28', tone: 'ok', icon: 'checkmark' } },
  { id: 'INV-2026-03', period: 'Mar 1 – Mar 31, 2026', seats: 22, amount: '$1,490.00', status: { label: 'Paid · Mar 28', tone: 'ok', icon: 'checkmark' } },
  { id: 'INV-2026-02', period: 'Feb 1 – Feb 28, 2026', seats: 14, amount: '$1,490.00', status: { label: 'Paid · Feb 26', tone: 'ok', icon: 'checkmark' } },
  { id: 'INV-2026-01', period: 'Jan 1 – Jan 31, 2026', seats: 8, amount: '$1,490.00', status: { label: 'Paid · Jan 24', tone: 'ok', icon: 'checkmark' } },
  { id: 'INV-2025-12', period: 'Dec 1 – Dec 31, 2025', seats: 4, amount: '$0.00', status: { label: 'Pilot · waived', tone: 'ok', icon: 'gift-outline' } },
];

const PLAN_FEATURES: string[] = [
  'Up to 50 student seats',
  'Unlimited mentor seats',
  'SSO + domain claim',
  'Audit log · 7-year retention',
  'Accreditation reports',
  'SOC 2 + HIPAA BAA',
];

export function AdminBillingSurface() {
  const seatsUsed = 30;
  const seatsTotal = 50;
  const pct = (seatsUsed / seatsTotal) * 100;

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      {/* Plan hero — navy gradient left, warm-cream side right */}
      <View style={s.planCard}>
        <LinearGradient
          colors={['#2A3F66', '#1E335A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.planMain}
        >
          <Text style={s.planMainEyebrow}>Current plan</Text>
          <Text style={s.planTitle}>
            Institutional · BSN <Text style={s.planTitleSub}>/ pilot</Text>
          </Text>
          <View style={s.priceRow}>
            <Text style={s.priceBig}>$1,490</Text>
            <Text style={s.pricePer}>/ month · billed monthly · net-30</Text>
          </View>
          <View style={s.featGrid}>
            {PLAN_FEATURES.map((f) => (
              <View key={f} style={s.featRow}>
                <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.featText}>{f}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={s.planSide}>
          <View style={s.seatsBlock}>
            <View style={s.seatsTop}>
              <Text style={s.seatsN}>{seatsUsed}</Text>
              <Text style={s.seatsTotal}>/ {seatsTotal} seats</Text>
              <Text style={s.seatsSpare}>{seatsTotal - seatsUsed} spare</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.seatsBreakdown}>
              28 students · 2 mentors · 0 faculty (faculty seats are free)
            </Text>
          </View>
          <View style={s.renewalCard}>
            <Text style={s.renewalLabel}>Next renewal</Text>
            <Text style={s.renewalDate}>Jun 1, 2026 · charge $1,490.00</Text>
            <Text style={s.renewalNote}>
              Auto-renew is <Text style={s.renewalStrong}>on</Text>. Card on file will be charged.
            </Text>
          </View>
          <Pressable style={s.ghostBtn}>
            <Ionicons name="arrow-down" size={13} color="#28406B" />
            <Text style={s.ghostBtnText}>Downgrade plan</Text>
          </Pressable>
        </View>
      </View>

      {/* Payment + alerts row */}
      <View style={s.twoColRow}>
        <View style={[s.card, s.cardWide]}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardEyebrow}>Payment method</Text>
              <Text style={s.cardH3}>Card on file</Text>
            </View>
            <Pressable style={s.btnSm}>
              <Ionicons name="create-outline" size={12} color="#28406B" />
              <Text style={s.btnSmText}>Update</Text>
            </Pressable>
          </View>
          <View style={s.cardBody}>
            <View style={s.payRow}>
              <View style={s.cardGlyph}>
                <Text style={s.cardGlyphText}>VISA</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payName}>Visa ending 4242</Text>
                <Text style={s.payMeta}>
                  Expires 09 / 28 · billed to Susanna Park · billing@nursing.jhu.edu
                </Text>
              </View>
              <Pressable style={s.btnSmGhost}>
                <Ionicons name="mail-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
                <Text style={s.btnSmGhostText}>Change receipt email</Text>
              </Pressable>
            </View>
            <View style={s.payFooter}>
              <Text style={s.payFooterText}>
                Alternative billing:{' '}
                <Text style={s.payFooterStrong}>
                  Net-30 ACH invoicing available for orgs &gt; 100 seats
                </Text>
                . Ask your account rep.
              </Text>
            </View>
          </View>
        </View>

        <View style={[s.card, s.cardNarrow]}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardEyebrow}>Account notices</Text>
              <Text style={s.cardH3}>Nothing urgent</Text>
            </View>
          </View>
          <View style={[s.cardBody, { gap: 8 }]}>
            <View style={s.noticeRow}>
              <Ionicons name="information-circle" size={15} color="#28406B" />
              <Text style={s.noticeText}>
                You're at <Text style={s.noticeBold}>60%</Text> of plan seats. We'll email
                Susanna if you cross 90%.
              </Text>
            </View>
            <View style={s.noticeRow}>
              <Ionicons name="information-circle" size={15} color="#28406B" />
              <Text style={s.noticeText}>
                Pilot pricing locked until <Text style={s.noticeBold}>Sep 30, 2026</Text>. List
                rate after that is $2,250 / mo.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Invoice table */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.cardEyebrow}>Invoices</Text>
            <Text style={s.cardH3}>Last {INVOICES.length} invoices</Text>
          </View>
          <View style={s.cardHeadActions}>
            <View style={s.segControl}>
              <View style={[s.segOpt, s.segOptOn]}>
                <Text style={s.segOptTextOn}>All</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>Paid</Text>
              </View>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>Open</Text>
              </View>
            </View>
            <Pressable style={s.btnSm}>
              <Ionicons name="download-outline" size={12} color="#28406B" />
              <Text style={s.btnSmText}>Export CSV</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.tableWrap}>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 1.3 }]}>Invoice</Text>
            <Text style={[s.th, { flex: 1.6 }]}>Period</Text>
            <Text style={[s.th, s.thRight, { width: 60 }]}>Seats</Text>
            <Text style={[s.th, s.thRight, { width: 110 }]}>Amount</Text>
            <Text style={[s.th, { flex: 1.3 }]}>Status</Text>
            <View style={{ width: 70 }} />
          </View>
          {INVOICES.map((inv, idx) => (
            <View key={inv.id} style={[s.tr, idx === INVOICES.length - 1 && s.trLast]}>
              <Text style={[s.td, { flex: 1.3 }]}>{inv.id}</Text>
              <Text style={[s.td, s.tdMuted, { flex: 1.6 }]}>{inv.period}</Text>
              <Text style={[s.td, s.tdRight, s.tdNum, { width: 60 }]}>{inv.seats}</Text>
              <Text style={[s.td, s.tdRight, s.tdNum, { width: 110 }]}>{inv.amount}</Text>
              <View style={[s.td, { flex: 1.3 }]}>
                <View style={[s.statusChip, inv.status.tone === 'warn' ? s.statusWarn : s.statusOk]}>
                  <Ionicons
                    name={inv.status.icon}
                    size={11}
                    color={inv.status.tone === 'warn' ? '#C99632' : '#1E8F47'}
                  />
                  <Text
                    style={[
                      s.statusText,
                      { color: inv.status.tone === 'warn' ? '#C99632' : '#1E8F47' },
                    ]}
                  >
                    {inv.status.label}
                  </Text>
                </View>
              </View>
              <View style={[s.td, s.tdRight, { width: 70, flexDirection: 'row', gap: 4 }]}>
                <Pressable style={s.iconBtn}>
                  <Ionicons name="eye-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
                </Pressable>
                <Pressable style={s.iconBtn}>
                  <Ionicons name="download-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  // Plan card
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  planMain: { flex: 1.4, padding: 22, gap: 14 },
  planMainEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  planTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  planTitleSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  priceBig: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  pricePer: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  featText: { fontSize: 12.5, color: 'rgba(255,255,255,0.86)' },

  planSide: { flex: 1, padding: 20, gap: 14, backgroundColor: '#FFFFFF' },
  seatsBlock: { gap: 8 },
  seatsTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  seatsN: { fontSize: 26, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  seatsTotal: { fontSize: 14, color: 'rgba(60, 60, 67, 0.6)', marginLeft: 4 },
  seatsSpare: { marginLeft: 'auto', fontSize: 11.5, color: '#1E8F47', fontWeight: '600' },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#EDEBE2', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#28406B' },
  seatsBreakdown: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  renewalCard: { backgroundColor: '#F5F4EE', padding: 14, borderRadius: 10, gap: 4 },
  renewalLabel: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  renewalDate: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  renewalNote: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },
  renewalStrong: { color: '#1E8F47', fontWeight: '700' },

  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  ghostBtnText: { fontSize: 12, fontWeight: '600', color: '#28406B' },

  // Two-col row
  twoColRow: { flexDirection: 'row', gap: 18 },
  cardWide: { flex: 1.4 },
  cardNarrow: { flex: 1 },

  // Card
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
  cardBody: { padding: 18 },

  // Buttons
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
  btnSmGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'transparent',
  },
  btnSmGhostText: { fontSize: 11.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },

  // Payment
  payRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardGlyph: {
    width: 56,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlyphText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  payName: { fontSize: 13.5, color: '#1C1C1E', fontWeight: '600' },
  payMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  payFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  payFooterText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },
  payFooterStrong: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },

  // Notices
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 18 },
  noticeBold: { color: '#1C1C1E', fontWeight: '600' },

  // Segmented control
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

  // Table
  tableWrap: { paddingHorizontal: 0, paddingTop: 6, paddingBottom: 0 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F4EE',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
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
  tdMuted: { color: 'rgba(60, 60, 67, 0.85)' },
  tdRight: { textAlign: 'right' },
  tdNum: { fontWeight: '600', fontVariant: ['tabular-nums'] },

  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusOk: { backgroundColor: 'rgba(30, 143, 71, 0.12)' },
  statusWarn: { backgroundColor: 'rgba(201, 150, 50, 0.14)' },
  statusText: { fontSize: 11.5, fontWeight: '600' },

  iconBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
});
