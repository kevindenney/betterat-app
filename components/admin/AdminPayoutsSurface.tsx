/**
 * Org Admin · Author payouts (Frame 31 of the JHSON Admin Suite)
 *
 * Mirror of the independent author earnings (Frame 6) from the org side:
 * total paid-out YTD, per-author table with blueprints + earned + Stripe
 * Connect status, upcoming-payout panel showing the next batch close.
 *
 * Real data via useAdminOrgPayouts → admin_org_payouts RPC. Stripe Connect
 * webhooks (not yet wired) update author rows when payouts clear and
 * connect-account state changes.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  useAdminOrgPayouts,
  AdminPayoutAuthor,
  AuthorTone,
  ConnectStatus,
  formatMoneyDollars,
  formatMoneyShort,
  formatShortDate,
  formatLongPeriod,
  formatScheduledFor,
} from '@/hooks/useAdminOrgPayouts';
import { StatRow } from '@/components/studio/StatRow';

export function AdminPayoutsSurface() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const data = useAdminOrgPayouts(orgId as string);

  if (data.loading) {
    return (
      <ScrollView style={s.body}>
        <View style={s.loadingCard}>
          <Text style={s.loadingText}>Loading payouts…</Text>
        </View>
      </ScrollView>
    );
  }

  const paidDollars = (data.paidYtdCents / 100).toFixed(2).split('.');
  const pendingDollars = (data.pendingCents / 100).toFixed(2).split('.');
  const lastBatchDollars = (data.lastBatchCents / 100).toFixed(2).split('.');

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      {/* Stat strip */}
      <StatRow>
        <StatCard
          k="Paid YTD"
          v={`$${Math.round(data.paidYtdCents / 100).toLocaleString()}`}
          vSub={`.${paidDollars[1]}`}
          d={`across ${data.authors.length} ${data.authors.length === 1 ? 'author' : 'authors'}, ${data.authors.reduce((sum, a) => sum + a.blueprintCount, 0)} blueprints`}
        />
        <StatCard
          k="Pending · next batch"
          v={`$${Math.round(data.pendingCents / 100).toLocaleString()}`}
          vSub={`.${pendingDollars[1]}`}
          vTone="warn"
          d={
            data.pendingClears
              ? `clears ${new Date(data.pendingClears + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'no scheduled batch'
          }
        />
        <StatCard
          k="Cohort seats producing payouts"
          v={`${data.cohortSeats} / ${data.cohortSeats}`}
          d={data.cohortLabel ?? 'No active cohort'}
        />
        <StatCard
          k="Last batch"
          v={`$${Math.round(data.lastBatchCents / 100).toLocaleString()}`}
          vSub={`.${lastBatchDollars[1]}`}
          d={
            data.lastBatchDate
              ? `cleared ${formatShortDate(data.lastBatchDate)} · ${data.lastBatchAuthors} ${data.lastBatchAuthors === 1 ? 'author' : 'authors'}`
              : 'no prior batches'
          }
        />
      </StatRow>

      {/* Author table */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.cardEyebrow}>Authors</Text>
            <Text style={s.cardH3}>By total earned this year</Text>
            {data.stripeStatusSyncedAt ? (
              <Text style={s.syncedHint}>
                Stripe Connect last synced{' '}
                {new Date(data.stripeStatusSyncedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
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
            <Pressable
              style={[s.btnSm, data.refreshStripe.isPending && { opacity: 0.6 }]}
              disabled={data.refreshStripe.isPending}
              onPress={() => data.refreshStripe.mutate()}
            >
              <Ionicons
                name={data.refreshStripe.isPending ? 'sync' : 'sync-outline'}
                size={12}
                color="#28406B"
              />
              <Text style={s.btnSmText}>
                {data.refreshStripe.isPending ? 'Syncing…' : 'Sync from Stripe'}
              </Text>
            </Pressable>
            <Pressable style={s.btnSm}>
              <Ionicons name="add" size={12} color="#28406B" />
              <Text style={s.btnSmText}>Onboard author</Text>
            </Pressable>
          </View>
        </View>

        {data.authors.length === 0 ? (
          <View style={s.emptyAuthors}>
            <Text style={s.emptyText}>
              No authors with payout history yet. Once a blueprint is published and accrues
              seats, payouts will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.tableHead}>
              <Text style={[s.th, { width: 240 }]}>Author</Text>
              <Text style={[s.th, { flex: 1.2 }]}>Blueprints</Text>
              <Text style={[s.th, s.thRight, { width: 90 }]}>Active seats</Text>
              <Text style={[s.th, s.thRight, { width: 110 }]}>Earned YTD</Text>
              <Text style={[s.th, { width: 140 }]}>Last payout</Text>
              <Text style={[s.th, { flex: 1 }]}>Connect status</Text>
              <View style={{ width: 40 }} />
            </View>
            {data.authors.map((a, idx) => (
              <AuthorRow key={a.id} a={a} isLast={idx === data.authors.length - 1} />
            ))}
          </>
        )}
      </View>

      {/* Upcoming payout panel */}
      <View style={s.panel}>
        <View style={s.panelHead}>
          <Text style={s.panelEyebrow}>{formatScheduledFor(data.pendingClears)}</Text>
          <Text style={s.panelHint}>Cleared 5 business days after period close</Text>
        </View>
        <View style={s.panelRow}>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Period</Text>
            <Text style={s.panelCellValue}>
              {formatLongPeriod(data.upcomingPeriodStart, data.upcomingPeriodEnd)}
            </Text>
            <Text style={s.panelCellSub}>
              {data.cohortSeats} active seats · 70/10/20 split
            </Text>
          </View>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Authors getting paid</Text>
            <Text style={s.panelCellValue}>
              {data.upcomingAuthorsPaid} of {data.upcomingAuthorsTotal}
            </Text>
            {(() => {
              const blocked = data.authors.filter(
                (a) => a.stripeConnectStatus !== 'verified',
              );
              if (blocked.length === 0) {
                return (
                  <Text style={s.panelCellSub}>All Connect accounts in good standing</Text>
                );
              }
              const names = blocked
                .map((a) => a.authorName.split(' ').slice(-1)[0])
                .join(' / ');
              const allAction = blocked.every(
                (a) => a.stripeConnectStatus === 'action_needed',
              );
              const allPending = blocked.every(
                (a) => a.stripeConnectStatus === 'pending',
              );
              const tail = allAction
                ? 'must complete Connect verification first'
                : allPending
                  ? 'haven’t connected a Stripe account yet'
                  : 'need Connect attention';
              return (
                <Text style={[s.panelCellSub, { color: '#C99632' }]}>
                  {names} {tail}
                </Text>
              );
            })()}
          </View>
          <View style={s.panelCell}>
            <Text style={s.panelCellLabel}>Batch total</Text>
            <Text style={s.panelCellValue}>{formatMoneyDollars(data.pendingCents)}</Text>
            <Text style={s.panelCellSub}>
              Rebate back to {data.cohortLabel?.split(' ')[0] ?? 'org'}:{' '}
              {formatMoneyDollars(data.upcomingRebateCents)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function AuthorRow({ a, isLast }: { a: AdminPayoutAuthor; isLast: boolean }) {
  const extra = a.blueprintCount - Math.min(2, a.blueprintTitles.length);
  return (
    <View style={[s.tr, isLast && s.trLast]}>
      <View style={[s.td, { width: 240, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <View style={[s.avi, aviToneStyle(a.authorTone)]}>
          <Text style={s.aviText}>{a.authorInitials}</Text>
        </View>
        <View>
          <Text style={s.authorName}>{a.authorName}</Text>
          <Text style={s.authorSubtitle}>
            {authorKindLabel(a.authorKind)} · {a.blueprintCount}{' '}
            {a.blueprintCount === 1 ? 'blueprint' : 'blueprints'}
          </Text>
        </View>
      </View>
      <View style={[s.td, { flex: 1.2, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
        {a.blueprintTitles.slice(0, 2).map((title) => (
          <View key={title} style={s.bpChip}>
            <Text style={s.bpChipText}>{shortenBpTitle(title)}</Text>
          </View>
        ))}
        {extra > 0 ? (
          <View style={s.bpChipMuted}>
            <Text style={s.bpChipMutedText}>+{extra}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.td, s.tdRight, s.tdNum, { width: 90 }]}>{a.activeSeats}</Text>
      <Text style={[s.td, s.tdRight, s.tdNum, { width: 110 }]}>
        {formatMoneyDollars(a.earnedYtdCents)}
      </Text>
      <Text style={[s.td, { width: 140 }]}>
        {a.lastPayoutDate ? formatShortDate(a.lastPayoutDate) : '—'}
        {a.lastPayoutAmountCents != null
          ? ` · ${formatMoneyShort(a.lastPayoutAmountCents)}`
          : ''}
      </Text>
      <View style={[s.td, { flex: 1 }]}>
        <ConnectStatusPill status={a.stripeConnectStatus} />
      </View>
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        <Pressable style={s.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={13} color="rgba(60, 60, 67, 0.6)" />
        </Pressable>
      </View>
    </View>
  );
}

function ConnectStatusPill({ status }: { status: ConnectStatus }) {
  const def = connectDef(status);
  return (
    <View style={[s.stripePill, { backgroundColor: def.bg, borderColor: def.border }]}>
      <Ionicons name={def.icon} size={11} color={def.fg} />
      <Text style={[s.stripePillText, { color: def.fg }]}>{def.label}</Text>
    </View>
  );
}

function connectDef(s: ConnectStatus): {
  bg: string;
  border: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  switch (s) {
    case 'verified':
      return {
        bg: 'rgba(99, 91, 255, 0.08)',
        border: 'rgba(99, 91, 255, 0.18)',
        fg: '#5851D6',
        icon: 'checkmark',
        label: 'Stripe · verified',
      };
    case 'action_needed':
      return {
        bg: 'rgba(201, 150, 50, 0.14)',
        border: 'rgba(201, 150, 50, 0.3)',
        fg: '#C99632',
        icon: 'warning-outline',
        label: 'Connect · action needed',
      };
    case 'pending':
      return {
        bg: 'rgba(60, 60, 67, 0.08)',
        border: 'rgba(60, 60, 67, 0.15)',
        fg: 'rgba(60, 60, 67, 0.85)',
        icon: 'time-outline',
        label: 'Stripe · pending',
      };
    case 'rejected':
      return {
        bg: 'rgba(255, 59, 48, 0.10)',
        border: 'rgba(255, 59, 48, 0.25)',
        fg: '#FF3B30',
        icon: 'close-circle-outline',
        label: 'Connect · rejected',
      };
    case 'disabled':
      return {
        bg: 'rgba(60, 60, 67, 0.08)',
        border: 'rgba(60, 60, 67, 0.15)',
        fg: 'rgba(60, 60, 67, 0.85)',
        icon: 'remove-circle-outline',
        label: 'Stripe · disabled',
      };
  }
}

function aviToneStyle(tone: AuthorTone) {
  switch (tone) {
    case 'navy':
      return { backgroundColor: '#28406B' };
    case 'brown':
      return { backgroundColor: '#8B5A3C' };
    case 'purple':
      return { backgroundColor: '#7A5A8B' };
    case 'warm':
      return { backgroundColor: '#B8855A' };
    case 'green':
      return { backgroundColor: '#6E8B5A' };
  }
}

function authorKindLabel(k: 'institutional' | 'independent' | 'contractor'): string {
  switch (k) {
    case 'institutional':
      return 'Faculty';
    case 'independent':
      return 'Independent';
    case 'contractor':
      return 'Preceptor';
  }
}

function shortenBpTitle(title: string): string {
  // "Sepsis bundle recognition" → "Sepsis bundle"
  // "Discharge teach-back" → "Discharge teach-back" (already short)
  const cleaned = title.replace(/ · supervised$/, '');
  return cleaned.length > 22 ? cleaned.slice(0, 22) + '…' : cleaned;
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

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 22 },

  loadingCard: { padding: 32, alignItems: 'center' },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)' },

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
  syncedHint: { marginTop: 4, fontSize: 11, color: 'rgba(60, 60, 67, 0.55)' },
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
    borderWidth: 0.5,
  },
  stripePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  iconBtn: { padding: 5, borderRadius: 6, backgroundColor: 'rgba(60, 60, 67, 0.06)' },

  emptyAuthors: { padding: 24, alignItems: 'center' },
  emptyText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },

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
