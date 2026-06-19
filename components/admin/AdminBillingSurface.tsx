/**
 * Org Admin · Billing & invoices (Frame 30 of the JHSON Admin Suite)
 *
 * Unified surface for the Billing + Invoices sidebar items. Both routes
 * render this same body — activeKey on the parent sets which sidebar
 * row gets the navy tint.
 *
 * Real data via useAdminOrgBilling → admin_org_billing RPC. Stripe
 * webhooks (not yet wired) will update org_billing + org_invoices when
 * subscriptions change and invoices issue/pay.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  useAdminOrgBilling,
  OrgInvoiceRow,
  formatMoney,
  formatMoneyShort,
  formatPeriod,
  formatDate,
} from '@/hooks/useAdminOrgBilling';
import { ORG_PLANS, type OrgPlanId } from '@/lib/subscriptions/orgTiers';

type InvoiceFilter = 'all' | 'paid' | 'open';

/** Open a Stripe-hosted invoice PDF, or explain when one isn't available yet. */
function openInvoicePdf(inv: OrgInvoiceRow) {
  if (!inv.pdf_url) {
    showAlert('PDF not ready', 'This invoice does not have a downloadable PDF yet.');
    return;
  }
  WebBrowser.openBrowserAsync(inv.pdf_url).catch(() => {
    showAlert('Could not open invoice', 'The invoice PDF failed to open. Try again shortly.');
  });
}

/** Build a CSV from the loaded invoices and download (web) / share (native). */
async function exportInvoicesCsv(invoices: OrgInvoiceRow[]) {
  if (invoices.length === 0) {
    showAlert('Nothing to export', 'There are no invoices to export yet.');
    return;
  }
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Invoice', 'Period start', 'Period end', 'Seats', 'Amount (USD)', 'Status', 'Paid', 'Due'];
  const rows = invoices.map((inv) =>
    [
      esc(inv.invoice_number),
      inv.period_start,
      inv.period_end,
      String(inv.seats_billed),
      (inv.amount_cents / 100).toFixed(2),
      inv.status,
      inv.paid_at ?? '',
      inv.due_at ?? '',
    ].join(','),
  );
  const csv = [header.join(','), ...rows].join('\n');
  const fileName = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
  } else {
    showAlert('Export complete', `Invoices saved to:\n${fileUri}`);
  }
}

// Fallback feature list for demo/manually-seeded billing rows that don't map to
// a known Club plan. Real subscriptions surface their own plan's features.
const PLAN_FEATURES: string[] = [
  'Up to 50 student seats',
  'Unlimited mentor seats',
  'SSO + domain claim',
  'Audit log · 7-year retention',
  'Accreditation reports',
  'SOC 2 + HIPAA BAA',
];

export function AdminBillingSurface() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { billing, invoices, loading } = useAdminOrgBilling(orgId as string);
  const [filter, setFilter] = React.useState<InvoiceFilter>('all');

  if (loading || !billing) {
    return (
      <View style={s.body}>
        <View style={s.loadingCard}>
          <Text style={s.loadingText}>
            {loading ? 'Loading billing…' : 'No billing record for this organization.'}
          </Text>
        </View>
      </View>
    );
  }

  const seatsPct = billing.seats_total > 0
    ? Math.round((billing.seats_used / billing.seats_total) * 100)
    : 0;
  const seatsUtilPct = billing.seats_total > 0
    ? (billing.seats_used / billing.seats_total) * 100
    : 0;
  const sparseSeats = billing.seats_total - billing.seats_used;

  const planFeatures = ORG_PLANS[billing.plan_tier as OrgPlanId]?.features ?? PLAN_FEATURES;
  const hasSeatBreakdown =
    billing.seats_students + billing.seats_mentors + billing.seats_faculty > 0;

  const visibleInvoices = invoices.filter((inv) => {
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'open') return inv.status === 'open' || inv.status === 'past_due';
    return true;
  });

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      {/* Plan hero */}
      <View style={s.planCard}>
        <LinearGradient
          colors={['#2A3F66', '#1E335A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.planMain}
        >
          <Text style={s.planMainEyebrow}>Current plan</Text>
          <Text style={s.planTitle}>{billing.plan_label}</Text>
          <View style={s.priceRow}>
            <Text style={s.priceBig}>{formatMoneyShort(billing.price_monthly_cents)}</Text>
            <Text style={s.pricePer}>
              / {billing.billing_cadence === 'monthly' ? 'month · billed monthly' : 'year · billed annually'}
              {billing.net_terms > 0 ? ` · net-${billing.net_terms}` : ''}
            </Text>
          </View>
          <View style={s.featGrid}>
            {planFeatures.map((f) => (
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
              <Text style={s.seatsN}>{billing.seats_used}</Text>
              <Text style={s.seatsTotal}>/ {billing.seats_total} seats</Text>
              {sparseSeats > 0 ? (
                <Text style={s.seatsSpare}>{sparseSeats} spare</Text>
              ) : (
                <Text style={s.seatsFull}>full</Text>
              )}
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${seatsUtilPct}%` }]} />
            </View>
            {hasSeatBreakdown ? (
              <Text style={s.seatsBreakdown}>
                {billing.seats_students} students · {billing.seats_mentors} mentors ·{' '}
                {billing.seats_faculty} faculty (faculty seats are free)
              </Text>
            ) : (
              <Text style={s.seatsBreakdown}>
                {billing.seats_used} active member{billing.seats_used === 1 ? '' : 's'} on this plan
              </Text>
            )}
          </View>
          {billing.next_renewal_date ? (
            <View style={s.renewalCard}>
              <Text style={s.renewalLabel}>Next renewal</Text>
              <Text style={s.renewalDate}>
                {formatDate(billing.next_renewal_date)} · charge {formatMoney(billing.price_monthly_cents)}
              </Text>
              <Text style={s.renewalNote}>
                Auto-renew is{' '}
                <Text style={billing.auto_renew ? s.renewalStrongOk : s.renewalStrongOff}>
                  {billing.auto_renew ? 'on' : 'off'}
                </Text>
                {billing.auto_renew ? '. Card on file will be charged.' : '. Send an invoice manually.'}
              </Text>
            </View>
          ) : null}
          <Pressable style={s.ghostBtn} onPress={() => router.push('/organization/billing')}>
            <Ionicons name="arrow-down" size={13} color="#28406B" />
            <Text style={s.ghostBtnText}>Change plan</Text>
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
            {billing.payment_method_brand ? (
              <View style={s.payRow}>
                <View style={s.cardGlyph}>
                  <Text style={s.cardGlyphText}>{billing.payment_method_brand.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.payName}>
                    {billing.payment_method_brand.replace(/^./, (c) => c.toUpperCase())} ending{' '}
                    {billing.payment_method_last4}
                  </Text>
                  <Text style={s.payMeta}>
                    {billing.payment_method_exp_month && billing.payment_method_exp_year
                      ? `Expires ${String(billing.payment_method_exp_month).padStart(2, '0')} / ${String(billing.payment_method_exp_year).slice(-2)} · `
                      : ''}
                    billed to {billing.billing_contact_name} · {billing.billing_contact_email}
                  </Text>
                </View>
                <Pressable style={s.btnSmGhost}>
                  <Ionicons name="mail-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
                  <Text style={s.btnSmGhostText}>Change receipt email</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={s.payMeta}>No payment method on file yet.</Text>
            )}
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
              <Text style={s.cardH3}>{seatsPct >= 90 ? 'Heads up' : 'Nothing urgent'}</Text>
            </View>
          </View>
          <View style={[s.cardBody, { gap: 8 }]}>
            <View style={s.noticeRow}>
              <Ionicons name="information-circle" size={15} color="#28406B" />
              <Text style={s.noticeText}>
                You're at <Text style={s.noticeBold}>{seatsPct}%</Text> of plan seats. We'll email{' '}
                {billing.billing_contact_name?.split(' ')[0] ?? 'you'} if you cross 90%.
              </Text>
            </View>
            {billing.pilot_locked_until && billing.list_rate_monthly_cents ? (
              <View style={s.noticeRow}>
                <Ionicons name="information-circle" size={15} color="#28406B" />
                <Text style={s.noticeText}>
                  Pilot pricing locked until{' '}
                  <Text style={s.noticeBold}>{formatDate(billing.pilot_locked_until)}</Text>. List
                  rate after that is {formatMoneyShort(billing.list_rate_monthly_cents)} / mo.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Invoice table */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.cardEyebrow}>Invoices</Text>
            <Text style={s.cardH3}>
              {invoices.length === 0
                ? 'No invoices yet'
                : `Last ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          <View style={s.cardHeadActions}>
            <View style={s.segControl}>
              {(['all', 'paid', 'open'] as InvoiceFilter[]).map((opt) => {
                const on = filter === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[s.segOpt, on && s.segOptOn]}
                    onPress={() => setFilter(opt)}
                  >
                    <Text style={on ? s.segOptTextOn : s.segOptText}>
                      {opt === 'all' ? 'All' : opt === 'paid' ? 'Paid' : 'Open'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={s.btnSm} onPress={() => exportInvoicesCsv(visibleInvoices)}>
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
          {visibleInvoices.length === 0 ? (
            <View style={s.emptyRow}>
              <Text style={s.payMeta}>
                {invoices.length === 0 ? 'No invoices issued yet.' : 'No invoices match this filter.'}
              </Text>
            </View>
          ) : (
            visibleInvoices.map((inv, idx) => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                isLast={idx === visibleInvoices.length - 1}
                onOpen={() => openInvoicePdf(inv)}
              />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function InvoiceRow({
  inv,
  isLast,
  onOpen,
}: {
  inv: OrgInvoiceRow;
  isLast: boolean;
  onOpen: () => void;
}) {
  const status = invoiceStatusDisplay(inv);
  const hasPdf = !!inv.pdf_url;
  return (
    <View style={[s.tr, isLast && s.trLast]}>
      <Text style={[s.td, { flex: 1.3 }]}>{inv.invoice_number}</Text>
      <Text style={[s.td, s.tdMuted, { flex: 1.6 }]}>
        {formatPeriod(inv.period_start, inv.period_end)}
      </Text>
      <Text style={[s.td, s.tdRight, s.tdNum, { width: 60 }]}>{inv.seats_billed}</Text>
      <Text style={[s.td, s.tdRight, s.tdNum, { width: 110 }]}>{formatMoney(inv.amount_cents)}</Text>
      <View style={[s.td, { flex: 1.3 }]}>
        <View style={[s.statusChip, statusToneBg(status.tone)]}>
          <Ionicons name={status.icon} size={11} color={statusToneFg(status.tone)} />
          <Text style={[s.statusText, { color: statusToneFg(status.tone) }]}>{status.label}</Text>
        </View>
      </View>
      <View style={[s.td, s.tdRight, { width: 70, flexDirection: 'row', gap: 4 }]}>
        <Pressable
          style={[s.iconBtn, !hasPdf && s.iconBtnDisabled]}
          onPress={onOpen}
          disabled={!hasPdf}
        >
          <Ionicons
            name="eye-outline"
            size={13}
            color={hasPdf ? 'rgba(60, 60, 67, 0.6)' : 'rgba(60, 60, 67, 0.25)'}
          />
        </Pressable>
        <Pressable
          style={[s.iconBtn, !hasPdf && s.iconBtnDisabled]}
          onPress={onOpen}
          disabled={!hasPdf}
        >
          <Ionicons
            name="download-outline"
            size={13}
            color={hasPdf ? 'rgba(60, 60, 67, 0.6)' : 'rgba(60, 60, 67, 0.25)'}
          />
        </Pressable>
      </View>
    </View>
  );
}

type InvoiceTone = 'ok' | 'warn' | 'danger' | 'neutral';

function invoiceStatusDisplay(inv: OrgInvoiceRow): {
  label: string;
  tone: InvoiceTone;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (inv.status) {
    case 'paid':
      return {
        label: inv.paid_at ? `Paid · ${formatDateShort(inv.paid_at)}` : 'Paid',
        tone: 'ok',
        icon: 'checkmark',
      };
    case 'open':
      return {
        label: inv.due_at ? `Due ${formatDateShort(inv.due_at)}` : 'Open',
        tone: 'warn',
        icon: 'time-outline',
      };
    case 'past_due':
      return {
        label: inv.due_at ? `Past due · ${formatDateShort(inv.due_at)}` : 'Past due',
        tone: 'danger',
        icon: 'warning',
      };
    case 'waived':
      return { label: 'Pilot · waived', tone: 'ok', icon: 'gift-outline' };
    case 'void':
      return { label: 'Voided', tone: 'neutral', icon: 'close-circle-outline' };
  }
}

function statusToneBg(tone: InvoiceTone) {
  switch (tone) {
    case 'ok':
      return { backgroundColor: 'rgba(30, 143, 71, 0.12)' };
    case 'warn':
      return { backgroundColor: 'rgba(201, 150, 50, 0.14)' };
    case 'danger':
      return { backgroundColor: 'rgba(255, 59, 48, 0.10)' };
    case 'neutral':
      return { backgroundColor: 'rgba(60, 60, 67, 0.08)' };
  }
}
function statusToneFg(tone: InvoiceTone): string {
  switch (tone) {
    case 'ok':
      return '#1E8F47';
    case 'warn':
      return '#C99632';
    case 'danger':
      return '#FF3B30';
    case 'neutral':
      return 'rgba(60, 60, 67, 0.85)';
  }
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  loadingCard: {
    margin: 32,
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)' },

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
  seatsFull: { marginLeft: 'auto', fontSize: 11.5, color: '#C99632', fontWeight: '600' },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#EDEBE2', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#28406B' },
  seatsBreakdown: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  renewalCard: { backgroundColor: '#F5F4EE', padding: 14, borderRadius: 10, gap: 4 },
  renewalLabel: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  renewalDate: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  renewalNote: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },
  renewalStrongOk: { color: '#1E8F47', fontWeight: '700' },
  renewalStrongOff: { color: '#C99632', fontWeight: '700' },

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

  twoColRow: { flexDirection: 'row', gap: 18 },
  cardWide: { flex: 1.4 },
  cardNarrow: { flex: 1 },

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

  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 18 },
  noticeBold: { color: '#1C1C1E', fontWeight: '600' },

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
  statusText: { fontSize: 11.5, fontWeight: '600' },

  iconBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  iconBtnDisabled: { opacity: 0.5 },
  emptyRow: { paddingHorizontal: 14, paddingVertical: 18 },
});
