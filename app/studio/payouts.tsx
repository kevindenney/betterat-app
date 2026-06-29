/**
 * Creator Studio · Payouts (Frame 6 — independent author)
 *
 * Renders the Stripe Connect payout dashboard for an independent author.
 * Drawing-accent shell (warm cream); Studio + Money + Bank sidebar
 * groups; main has hero next-payout card, two stat cards, weekly bar
 * chart, earnings-by-blueprint breakdown, and a recent transactions feed.
 *
 * Institutional authors (Hopkins faculty etc.) see a different state —
 * a banner explaining payouts are handled by the institution. That gate
 * triggers when the user has an active org membership.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import {
  useStudioPayouts,
  BlueprintEarning,
  PayoutTransaction,
} from '@/hooks/useStudioPayouts';
import {
  StudioShell,
  StudioHeader,
  StudioPanel,
  StudioButton,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';

export default function StudioPayoutsPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const menu = useProfileMenuData();
  const data = useStudioPayouts();
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const isInstitutional = !!menu.activeOrg;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Studio',
      items: [
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          onPress: () => router.push('/studio'),
        },
        {
          key: 'subscribers',
          icon: 'people-outline',
          label: 'Subscribers',
          onPress: () => router.push('/studio/subscribers'),
        },
        {
          key: 'threads',
          icon: 'chatbubbles-outline',
          label: 'Threads',
          countTone: 'coral',
          onPress: () => router.push('/studio/threads'),
        },
      ],
    },
    {
      eyebrow: 'Money',
      items: [
        {
          key: 'payouts',
          icon: 'cash-outline',
          label: 'Payouts',
          count: data.currencySymbol,
          active: true,
        },
        {
          key: 'earnings',
          icon: 'receipt-outline',
          label: 'Earnings',
          onPress: () => router.push('/studio/earnings'),
        },
        { key: 'pricing', icon: 'pricetag-outline', label: 'Pricing' },
        { key: 'legal', icon: 'document-text-outline', label: 'Tax & legal' },
      ],
    },
    {
      eyebrow: 'Bank',
      items: [],
      footer: (
        <View style={styles.bankRow}>
          <View
            style={[
              styles.bankFlag,
              {
                backgroundColor: data.bank.flagGradient[0],
              },
            ]}
          >
            <Text style={styles.bankFlagText}>{data.bank.flag}</Text>
          </View>
          <View style={styles.bankCol}>
            <Text style={styles.bankLabel}>
              {data.bank.typeLabel} · {data.bank.accountMasked}
            </Text>
            <Text style={styles.bankSub}>
              {data.bank.bankName} · {data.bank.connectLabel}
            </Text>
          </View>
        </View>
      ),
    },
  ];

  const bodyContent = (
    <>
      {isInstitutional ? (
        <InstitutionalBanner
          orgName={menu.activeOrg!.org_name}
          orgShort={shortNameLabel(menu.activeOrg!.org_name)}
        />
      ) : !data.isIndependent ? (
        <NotConnectedBanner userId={user.id} />
      ) : null}

      <View style={[styles.heroRow, compact && styles.stackCompact]}>
        <View style={[styles.heroCard, compact && styles.cardCompact]}>
          <Text style={styles.heroEyebrow}>Next payout · {data.nextPayout.dateLabel}</Text>
          <Text style={styles.heroAmount}>
            {data.currencySymbol}
            {data.nextPayout.amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Text style={styles.heroBody}>
            From {data.nextPayout.renewalsCount} subscription renewals,{' '}
            {data.nextPayout.firstTimeCount} first-time purchases.
          </Text>
          {data.nextPayout.deltaWeekPct !== null ? (
            <Text style={styles.heroDelta}>
              <Text style={styles.heroDeltaPositive}>+{data.nextPayout.deltaWeekPct}%</Text> vs.
              last week
            </Text>
          ) : null}
        </View>
        <View style={[compact ? styles.statPairCompact : styles.statPair]}>
          <StatCard
            compact={compact}
            label="Lifetime earnings"
            value={`${data.currencySymbol}${data.lifetime.amount.toLocaleString('en-US')}`}
            footnote={`since ${data.lifetime.sinceLabel}`}
          />
          <StatCard
            compact={compact}
            label="Active subscribers"
            value={data.activeSubscribers.count.toLocaleString('en-US')}
            footnote={`+${data.activeSubscribers.weeklyDelta} this week`}
            footnoteTone="positive"
          />
        </View>
      </View>

      <View style={[styles.twoCol, compact && styles.stackCompact]}>
        <View style={[styles.leftCol, compact && styles.cardCompact]}>
          <StudioPanel
            title="Weekly earnings · last 12 weeks"
            meta={<Text style={styles.panelMeta}>Net of fees · {data.currencySymbol}</Text>}
          >
            <View style={styles.chartWrap}>
              <WeeklyChart series={data.weeklySeries} currencySymbol={data.currencySymbol} />
            </View>
          </StudioPanel>

          <StudioPanel
            title="Earnings by blueprint"
            meta={<Text style={styles.panelMeta}>This payout</Text>}
          >
            <View>
              {data.blueprintEarnings.map((bp, i) => (
                <BlueprintEarningRow
                  key={bp.id}
                  bp={bp}
                  last={i === data.blueprintEarnings.length - 1}
                />
              ))}
            </View>
          </StudioPanel>
        </View>

        <StudioPanel
          title="Recent"
          meta={<Text style={styles.panelMeta}>Last 24 hours</Text>}
          width={compact ? undefined : 360}
        >
          <View>
            {data.recentTransactions.map((t) => (
              <TransactionRow key={t.id} t={t} currencySymbol={data.currencySymbol} />
            ))}
            <Pressable style={styles.viewAllRow}>
              <Text style={styles.viewAllText}>
                View all {data.totalTransactionCount} transactions →
              </Text>
            </Pressable>
          </View>
        </StudioPanel>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <StudioShell
        accent="drawing"
        org={{
          name: isInstitutional ? (menu.activeOrg!.org_name) : `${displayName} · Studio`,
          role: isInstitutional ? `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}` : 'Independent · payouts',
          mono: isInstitutional ? menu.activeOrg!.org_short_name : '·',
          monoColor: isInstitutional ? 'navy' : 'drawing',
        }}
        ctxLens="studio"
        ctxLensOptions={['practice', 'studio']}
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        compactBottomTabs={[
          {
            key: 'blueprints',
            icon: 'git-branch-outline',
            label: 'Blueprints',
            onPress: () => router.push('/studio'),
          },
          {
            key: 'subscribers',
            icon: 'people-outline',
            label: 'Subscribers',
            onPress: () => router.push('/studio/subscribers'),
          },
          {
            key: 'threads',
            icon: 'chatbubbles-outline',
            label: 'Threads',
            onPress: () => router.push('/studio/threads'),
          },
          {
            key: 'payouts',
            icon: 'cash-outline',
            label: 'Payouts',
            active: true,
          },
        ]}
        user={{ name: displayName, email: user?.email ?? '', initials }}
      >
        <StudioHeader
          compact={compact}
          crumbs={['Creator Studio', 'Payouts']}
          title="Payouts"
          subtitleParts={[
            <Text key="schedule" style={styles.subText}>
              {data.scheduleLabel}
            </Text>,
          ]}
          pill={{ label: 'Independent · Stripe Connect', tone: 'amber' }}
          actions={
            <>
              <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
              <StudioButton
                variant="ghost"
                icon="settings-outline"
                label="Payout settings"
              />
            </>
          }
        />

        {compact ? (
          <ScrollView
            style={styles.compactScroll}
            contentContainerStyle={styles.compactScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {bodyContent}
          </ScrollView>
        ) : (
          bodyContent
        )}
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  footnote,
  footnoteTone = 'neutral',
  compact = false,
}: {
  label: string;
  value: string;
  footnote: string;
  footnoteTone?: 'neutral' | 'positive';
  compact?: boolean;
}) {
  return (
    <View style={[styles.statCard, compact && styles.statCardCompact]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statFootRow}>
        {footnoteTone === 'positive' ? (
          <Ionicons name="trending-up" size={13} color="#1E8F47" />
        ) : null}
        <Text
          style={[
            styles.statFootnote,
            footnoteTone === 'positive' && styles.statFootnotePositive,
          ]}
        >
          {footnote}
        </Text>
      </View>
    </View>
  );
}

function NotConnectedBanner({ userId }: { userId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const onOnboard = async () => {
    setPending(true);
    setError(null);
    try {
      const { StripeConnectService } = await import('@/services/StripeConnectService');
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://betterat.app';
      const result = await StripeConnectService.startOnboarding(
        userId,
        `${origin}/studio/payouts?connect=success`,
        `${origin}/studio/payouts?connect=refresh`,
      );
      if (!result.success || !result.url) {
        setError(result.error ?? 'Failed to start onboarding');
        setPending(false);
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
      setPending(false);
    }
  };
  return (
    <View style={styles.instBanner}>
      <Ionicons name="card-outline" size={20} color="#28406B" />
      <View style={styles.instCol}>
        <Text style={styles.instTitle}>Connect a Stripe account to receive payouts</Text>
        <Text style={styles.instBody}>
          Your blueprints can be sold on the marketplace, but you don't have a Stripe
          Connect account yet — buyers can subscribe, but payouts will be held by the
          platform until you onboard. The flow is hosted by Stripe and takes about three
          minutes (legal name, address, bank account).
        </Text>
        {error ? (
          <Text style={[styles.instBody, { color: '#C0392B', marginTop: 6 }]}>{error}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <StudioButton
            variant="primary"
            accent="navy"
            icon={pending ? 'sync' : 'arrow-forward'}
            label={pending ? 'Opening Stripe…' : 'Onboard to Stripe Connect'}
            onPress={onOnboard}
          />
        </View>
      </View>
    </View>
  );
}

function InstitutionalBanner({
  orgName,
  orgShort,
}: {
  orgName: string;
  orgShort: string;
}) {
  return (
    <View style={styles.instBanner}>
      <Ionicons name="information-circle" size={20} color="#28406B" />
      <View style={styles.instCol}>
        <Text style={styles.instTitle}>
          Payouts are handled by {orgShort}
        </Text>
        <Text style={styles.instBody}>
          Your blueprints are part of the {orgName} institutional plan. The
          institution pays the fee under your faculty agreement; you don't
          receive personal payouts. The figures below are sample data shown
          to design against — switch to an independent author account to see
          your live Stripe Connect numbers.
        </Text>
      </View>
    </View>
  );
}

function WeeklyChart({
  series,
  currencySymbol,
}: {
  series: ReturnType<typeof useStudioPayouts>['weeklySeries'];
  currencySymbol: string;
}) {
  // Layout
  const W = 460;
  const H = 180;
  const padL = 20;
  const padR = 10;
  const baseY = 170;
  const topY = 22;
  const max = Math.max(...series.map((s) => s.amount), 1);

  const barWidth = 26;
  const usable = W - padL - padR;
  const step = usable / series.length;

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <Line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#E5E5EA" strokeWidth={1} />
      {[0.25, 0.5, 0.75, 1].map((p) => {
        const y = baseY - p * (baseY - topY);
        return (
          <Line
            key={p}
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke="#F2F2F7"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        );
      })}
      <SvgText x={3} y={172} fontSize={9} fill="#8E8E93">
        0
      </SvgText>
      <SvgText x={3} y={132} fontSize={9} fill="#8E8E93">
        .5k
      </SvgText>
      <SvgText x={3} y={92} fontSize={9} fill="#8E8E93">
        1k
      </SvgText>
      <SvgText x={3} y={52} fontSize={9} fill="#8E8E93">
        1.5k
      </SvgText>
      <SvgText x={3} y={14} fontSize={9} fill="#8E8E93">
        2k
      </SvgText>

      {series.map((week, i) => {
        const isLast = i === series.length - 1;
        const x = padL + 5 + i * step;
        const height = ((baseY - topY) * week.amount) / max;
        const y = baseY - height;
        const opacity = isLast ? 1 : 0.68 + (i / series.length) * 0.25;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={3}
            fill="#B8855A"
            opacity={opacity}
          />
        );
      })}

      {/* highlight last bar amount */}
      {series.length > 0 ? (
        <>
          <Line
            x1={padL + 5 + (series.length - 1) * step + barWidth / 2}
            y1={baseY - ((baseY - topY) * series[series.length - 1].amount) / max}
            x2={padL + 5 + (series.length - 1) * step + barWidth / 2}
            y2={topY - 4}
            stroke="#8E5F36"
            strokeWidth={1.5}
          />
          <SvgText
            x={padL + 5 + (series.length - 1) * step + barWidth / 2}
            y={topY - 8}
            fontSize={10}
            fill="#5C3F22"
            fontWeight="700"
            textAnchor="middle"
          >
            {currencySymbol}
            {series[series.length - 1].amount.toLocaleString('en-US')}
          </SvgText>
        </>
      ) : null}

      {/* x-axis labels — every 3rd week + last */}
      {series.map((week, i) => {
        const isLast = i === series.length - 1;
        if (i % 3 !== 0 && !isLast) return null;
        const x = padL + 5 + i * step + barWidth / 2;
        return (
          <SvgText
            key={`l-${i}`}
            x={x}
            y={H}
            fontSize={8.5}
            fill={isLast ? '#5C3F22' : '#8E8E93'}
            fontWeight={isLast ? '700' : '400'}
            textAnchor="middle"
          >
            {week.weekStart}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function BlueprintEarningRow({ bp, last }: { bp: BlueprintEarning; last: boolean }) {
  const currencySymbol = bp.currency === 'EUR' ? '€' : '$';
  return (
    <View style={[styles.bpEarnRow, !last && styles.bpEarnRowBorder]}>
      <View style={[styles.bpEarnCover, { backgroundColor: bp.gradient[0] }]}>
        <View style={[styles.bpEarnCoverOverlay, { backgroundColor: bp.gradient[1] }]} />
      </View>
      <View style={styles.bpEarnInfo}>
        <Text style={styles.bpEarnTitle}>{bp.title}</Text>
        <Text style={styles.bpEarnSub}>{bp.subtitle}</Text>
      </View>
      <Text style={styles.bpEarnRen}>{bp.renewalsLabel}</Text>
      <Text style={styles.bpEarnRen}>{bp.newCountLabel}</Text>
      <Text style={styles.bpEarnAmt}>
        {currencySymbol}
        {bp.amount.toLocaleString('en-US')}
      </Text>
    </View>
  );
}

function TransactionRow({
  t,
  currencySymbol,
}: {
  t: PayoutTransaction;
  currencySymbol: string;
}) {
  const isNegative = t.amount < 0;
  return (
    <View style={styles.txnRow}>
      <View style={[styles.txnAvi, { backgroundColor: t.gradient[0] }]}>
        <Text style={styles.txnAviText}>{t.fromInitials}</Text>
      </View>
      <View style={styles.txnBody}>
        <View style={styles.txnHeadRow}>
          <Text style={styles.txnName}>{t.fromName}</Text>
          {t.fromOrgChip ? (
            <View style={styles.txnOrgChip}>
              <Text style={styles.txnOrgChipText}>{t.fromOrgChip}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.txnBlueprint}>{t.blueprintLabel} · {t.ageLabel}</Text>
      </View>
      <Text style={[styles.txnAmount, isNegative ? styles.txnAmountNegative : styles.txnAmountPositive]}>
        {isNegative ? '−' : '+'}
        {currencySymbol}
        {Math.abs(t.amount).toFixed(2)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortNameLabel(orgName: string): string {
  if (orgName.includes(' · ')) return orgName.split(' · ').slice(0, 2).join(' ');
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return orgName;
  return tokens.map((t) => t[0]).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },
  panelMeta: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },

  // Compact (phone) — vertical scroll + stacked sections
  compactScroll: { flex: 1 },
  compactScrollInner: { paddingBottom: 24 },
  // Turn a side-by-side row into a vertical stack; children that used `flex`
  // to share horizontal space get `cardCompact` to grow full-width instead.
  stackCompact: { flexDirection: 'column' },
  cardCompact: { flex: 0, width: '100%', minWidth: 0 },
  // Lifetime + Active subscribers: side by side on desktop (within heroRow),
  // a 2-up row on phone so neither label wraps mid-word.
  statPair: { flex: 2, flexDirection: 'row', gap: 12, minWidth: 0 },
  statPairCompact: { flexDirection: 'row', gap: 12, width: '100%' },

  // Sidebar bank
  bankRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bankFlag: {
    width: 26,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankFlagText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  bankCol: { flex: 1, minWidth: 0 },
  bankLabel: { fontSize: 11.5, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.05 },
  bankSub: { fontSize: 10, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  // Institutional banner
  instBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginVertical: 16,
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    borderRadius: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#28406B',
  },
  instCol: { flex: 1 },
  instTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  instBody: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 17, marginTop: 4 },

  // Hero strip
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    marginBottom: 18,
  },
  heroCard: {
    flex: 1.2,
    padding: 18,
    paddingHorizontal: 18,
    backgroundColor: '#F6EBDD',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    ...({ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any),
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -1,
    marginTop: 8,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  heroBody: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 17,
  },
  heroDelta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 8 },
  heroDeltaPositive: { color: '#1E8F47', fontWeight: '600' },

  // Stat cards
  statCard: {
    flex: 1,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    ...({ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any),
  },
  statCardCompact: { minWidth: 0 },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  statFootRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statFootnote: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  statFootnotePositive: { color: '#1E8F47' },

  // Two-column body
  twoCol: { flex: 1, flexDirection: 'row', gap: 16, minHeight: 0 },
  leftCol: { flex: 1.4, gap: 14, minWidth: 0 },

  // Chart wrapper
  chartWrap: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    height: 220,
  },

  // Blueprint earnings row
  bpEarnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bpEarnRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  bpEarnCover: {
    width: 28,
    height: 36,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bpEarnCoverOverlay: { flex: 1, opacity: 0.5 },
  bpEarnInfo: { flex: 1, minWidth: 0 },
  bpEarnTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  bpEarnSub: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  bpEarnRen: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  bpEarnAmt: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },

  // Transaction row
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  txnAvi: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnAviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  txnBody: { flex: 1, minWidth: 0 },
  txnHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txnName: { fontSize: 12.5, fontWeight: '600', color: '#1C1C1E' },
  txnOrgChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderRadius: 3,
  },
  txnOrgChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  txnBlueprint: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  txnAmountPositive: { color: '#1E8F47' },
  txnAmountNegative: { color: '#FF3B30', fontWeight: '500' },

  // View all
  viewAllRow: { paddingVertical: 12, alignItems: 'center' },
  viewAllText: { color: '#007AFF', fontSize: 12.5, fontWeight: '500' },
});
