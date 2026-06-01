/**
 * /studio/earnings — author-side marketplace earnings backed by real
 * marketplace_subscriptions. RLS gates rows to author_user_id =
 * auth.uid(), so the page only renders the signed-in author's data.
 *
 * Stats: active subscribers, trialing, monthly recurring revenue (MRR
 * with annual converted to monthly equivalent), per-blueprint breakdown.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useAuthorMarketplaceStats } from '@/hooks/useAuthorMarketplaceStats';
import {
  StudioShell,
  StudioHeader,
  StudioNavSection,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function cadenceLabel(c: 'monthly' | 'annual' | 'one_time'): string {
  if (c === 'monthly') return '/mo';
  if (c === 'annual') return '/yr';
  return ' one-time';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StudioEarningsPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const menu = useProfileMenuData();
  const { stats, loading } = useAuthorMarketplaceStats();

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const isInstitutional = menu.hasActiveOrg;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Studio',
      items: [
        { key: 'home', icon: 'grid-outline', label: 'Home', onPress: () => router.push('/studio') },
        { key: 'blueprints', icon: 'git-branch-outline', label: 'Blueprints' },
        { key: 'subscribers', icon: 'people-outline', label: 'Subscribers' },
        { key: 'threads', icon: 'chatbubbles-outline', label: 'Threads' },
      ],
    },
    {
      eyebrow: 'Money',
      items: [
        {
          key: 'payouts',
          icon: 'cash-outline',
          label: 'Payouts',
          onPress: () => router.push('/studio/payouts'),
        },
        {
          key: 'earnings',
          icon: 'receipt-outline',
          label: 'Earnings',
          active: true,
        },
        { key: 'pricing', icon: 'pricetag-outline', label: 'Pricing' },
        { key: 'legal', icon: 'document-text-outline', label: 'Tax & legal' },
      ],
    },
  ];

  return (
    <View style={s.root}>
      <StudioShell
        accent="drawing"
        org={{
          name: isInstitutional ? menu.activeOrg!.org_name : `${displayName} · Studio`,
          role: isInstitutional
            ? `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}`
            : 'Independent · marketplace',
          mono: isInstitutional ? menu.activeOrg!.org_short_name : '·',
          monoColor: isInstitutional ? 'navy' : 'drawing',
        }}
        ctxLens="studio"
        ctxLensOptions={['practice', 'studio']}
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        user={{ name: displayName, email: user?.email ?? '', initials }}
      >
        <StudioHeader
          crumbs={['Creator Studio', 'Earnings']}
          title="Earnings"
          subtitleParts={[
            <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
              Live from marketplace_subscriptions · updates via Stripe webhook
            </Text>,
          ]}
          pill={{ label: 'Independent · Marketplace', tone: 'amber' }}
        />
        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          <View style={s.header}>
            <Text style={s.eyebrow}>Marketplace earnings</Text>
            <Text style={s.h1}>Subscribers on your independent blueprints</Text>
            <Text style={s.lede}>
              Live from real Stripe subscriptions on the BetterAt marketplace. New
              subscriptions, trials, and cancellations land here automatically via
              webhook.
            </Text>
          </View>

      {loading || !stats ? (
        <View style={s.loadingCard}>
          <ActivityIndicator color="#28406B" />
          <Text style={s.loadingText}>Loading earnings…</Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <StatCard label="MRR · monthly equivalent" value={formatMoney(stats.mrrCents)} />
            <StatCard
              label="Active subscribers"
              value={String(stats.activeCount)}
              hint={stats.trialingCount > 0 ? `${stats.trialingCount} in trial` : null}
            />
            <StatCard
              label="Canceled · lifetime"
              value={String(stats.canceledCount)}
              hint="Stays subscribed through period end"
            />
          </View>

          {stats.byBlueprint.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="storefront-outline" size={28} color="rgba(60, 60, 67, 0.4)" />
              <Text style={s.emptyTitle}>No marketplace activity yet</Text>
              <Text style={s.emptyCopy}>
                Once your blueprint has a Stripe Product and recurring Price, this surface
                fills with real subscribers as they redeem.
              </Text>
            </View>
          ) : (
            <View style={s.tableCard}>
              <View style={[s.tr, s.trHead]}>
                <Text style={[s.th, { flex: 2 }]}>Blueprint</Text>
                <Text style={[s.th, s.tdRight, { width: 110 }]}>Price</Text>
                <Text style={[s.th, s.tdRight, { width: 110 }]}>Active</Text>
                <Text style={[s.th, s.tdRight, { width: 100 }]}>Trial</Text>
                <Text style={[s.th, s.tdRight, { width: 110 }]}>MRR</Text>
              </View>
              {stats.byBlueprint.map((bp) => (
                <View key={bp.blueprintId} style={s.tr}>
                  <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>
                    {bp.blueprintTitle}
                  </Text>
                  <Text style={[s.td, s.tdRight, s.tdMono, { width: 110 }]}>
                    {formatMoney(bp.unitAmountCents)}
                    <Text style={s.cadence}>{cadenceLabel(bp.cadence)}</Text>
                  </Text>
                  <Text style={[s.td, s.tdRight, s.tdNum, { width: 110 }]}>
                    {bp.activeCount}
                  </Text>
                  <Text style={[s.td, s.tdRight, s.tdNum, { width: 100 }]}>
                    {bp.trialingCount}
                  </Text>
                  <Text style={[s.td, s.tdRight, s.tdMono, { width: 110 }]}>
                    {formatMoney(bp.mrrCents)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.footnoteCard}>
            <Ionicons name="information-circle-outline" size={16} color="#28406B" />
            <Text style={s.footnoteText}>
              Earnings are credited to your Stripe Connect account on each invoice clear. Your
              configured author payout % (default 70%) applies — the platform takes the
              remainder as an application fee. Cancellations reflect immediately; access
              continues through the end of the paid period.
            </Text>
          </View>
        </>
      )}
        </ScrollView>
      </StudioShell>
    </View>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {hint ? <Text style={s.statHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F4EE' },
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
    gap: 24,
  },
  header: { gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  h1: { fontSize: 28, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.4, marginTop: 4 },
  lede: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.75)', lineHeight: 19, marginTop: 4 },

  loadingCard: {
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.7)' },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  emptyCopy: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 460,
  },

  statRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 220,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 4,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: { fontSize: 30, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5 },
  statHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    gap: 12,
  },
  trHead: { backgroundColor: '#F5F4EE' },
  th: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  td: { fontSize: 13, color: '#1C1C1E' },
  tdRight: { textAlign: 'right' },
  tdNum: { fontVariant: ['tabular-nums'] },
  tdMono: { fontFamily: 'Menlo', fontVariant: ['tabular-nums'] },
  cadence: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  footnoteCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    alignItems: 'flex-start',
  },
  footnoteText: { flex: 1, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 17 },
});
