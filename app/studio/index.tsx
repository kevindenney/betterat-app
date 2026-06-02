/**
 * Creator Studio · Home (Frame 4 of the institutions pass)
 *
 * iPad/desktop class — institutional author variant (Hopkins-managed,
 * no payouts). Composition:
 *
 *   StudioShell
 *     ├── sidebar (org card, ctx switch, Studio/Money/Co-authors nav,
 *     │             user card pinned bottom)
 *     └── main
 *           ├── StudioHeader (crumbs, greeting, sub-h1, actions)
 *           ├── KPI strip (4 cards)
 *           └── two-column grid
 *                 ├── Your blueprints panel
 *                 └── Threads awaiting you panel
 *
 * Data is sourced from useStudioHomeData() — currently stubbed empty so
 * the surface renders in empty-state copy until the backing queries land.
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import {
  useStudioHomeData,
  StudioBlueprint,
  StudioThread,
} from '@/hooks/useStudioHomeData';
import {
  StudioShell,
  StudioHeader,
  StudioPanel,
  StudioButton,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { Gradient } from '@/components/studio/Gradient';
import { StatRow } from '@/components/studio/StatRow';

export default function StudioHomePage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const menu = useProfileMenuData();
  const data = useStudioHomeData();
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  // Identity for sidebar user-card and org-card.
  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const activeOrg = menu.activeOrg;
  const isInstitutional = !!activeOrg;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Studio',
      items: [
        { key: 'home', icon: 'grid-outline', label: 'Home', active: true },
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          count: data.blueprintCount || undefined,
        },
        {
          key: 'subscribers',
          icon: 'people-outline',
          label: 'Subscribers',
          count: data.kpis.activeSubscribers || undefined,
        },
        {
          key: 'threads',
          icon: 'chatbubbles-outline',
          label: 'Threads',
          count: data.threadAwaitingCount || undefined,
          countTone: data.threadAwaitingCount > 0 ? 'coral' : 'neutral',
        },
        { key: 'insights', icon: 'trending-up-outline', label: 'Insights' },
      ],
    },
    {
      eyebrow: 'Money',
      items: [
        {
          key: 'payouts',
          icon: 'cash-outline',
          label: 'Payouts',
          count: isInstitutional ? '—' : undefined,
        },
        {
          key: 'earnings',
          icon: 'receipt-outline',
          label: 'Earnings',
          onPress: () => router.push('/studio/earnings'),
        },
      ],
      footer: isInstitutional ? (
        <Text style={styles.institutionalNote}>
          <Text style={styles.institutionalNoteStrong}>Institutional</Text> — your blueprints
          are part of the {activeOrg!.org_name.split(' · ')[0]} plan. No personal payouts.
        </Text>
      ) : null,
    },
    {
      eyebrow: 'Co-authors',
      items: [
        { key: 'co-you', icon: 'person-circle-outline', label: 'You' },
        { key: 'co-invite', icon: 'add', label: 'Invite co-author', cta: true },
      ],
    },
  ];

  const totalSubscribers = data.kpis.activeSubscribers;
  const subtitleParts: React.ReactNode[] = [
    <Text style={styles.subText} key="counts">
      {data.blueprintCount === 0
        ? 'No blueprints yet'
        : `${data.blueprintCount} ${data.blueprintCount === 1 ? 'blueprint' : 'blueprints'} · ${totalSubscribers} active subscribers · ${data.threadAwaitingCount} threads awaiting reply`}
    </Text>,
  ];

  return (
    <View style={styles.root}>
      <StudioShell
        accent="purple"
        org={{
          name: activeOrg ? activeOrg.org_name : 'Personal',
          role: `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}`,
          mono: activeOrg ? activeOrg.org_short_name : initials,
          monoColor: activeOrg ? 'navy' : 'solo',
        }}
        ctxLens="studio"
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        user={{ name: displayName, email: user?.email ?? '', initials }}
      >
        <StudioHeader
          crumbs={['Creator Studio', 'Home']}
          title={`Good ${greeting()}, ${firstName(displayName)}.`}
          subtitleParts={subtitleParts}
          pill={
            isInstitutional
              ? { label: `${activeOrg!.org_name.split(' · ')[0]}-managed`, tone: 'purple' }
              : undefined
          }
          actions={
            <>
              <StudioButton variant="ghost" icon="eye-outline" label="Preview as student" />
              <StudioButton
                variant="primary"
                accent="purple"
                icon="add"
                label="New blueprint"
                onPress={() => router.push('/studio/blueprints/new')}
              />
            </>
          }
        />

        <StatRow style={styles.kpiStrip}>
          <KpiCard
            label="Active subscribers"
            value={String(data.kpis.activeSubscribers)}
            footnote={
              data.kpis.activeSubscribersDelta !== null
                ? `+${data.kpis.activeSubscribersDelta} this week`
                : 'No new this week'
            }
            footnoteTone={data.kpis.activeSubscribersDelta ? 'positive' : 'neutral'}
          />
          <KpiCard
            label="Steps reflected"
            value={data.kpis.stepsReflectedPct !== null ? `${data.kpis.stepsReflectedPct}%` : '—'}
            footnote="Across this week's cohort"
          />
          <KpiCard
            label="Need attention"
            value={
              data.kpis.needAttention !== null ? String(data.kpis.needAttention) : '—'
            }
            valueTone={(data.kpis.needAttention ?? 0) > 0 ? 'coral' : 'neutral'}
            footnote="Students flagged this week"
          />
          <KpiCard
            label="Avg. session"
            value={
              data.kpis.avgSessionMinutes !== null ? `${data.kpis.avgSessionMinutes} m` : '—'
            }
            footnote="Per active day"
          />
        </StatRow>

        <View style={[styles.twoCol, compact && styles.twoColStacked]}>
          <StudioPanel
            title="Your blueprints"
            meta={
              <Text style={styles.panelMeta}>
                {isInstitutional ? 'Hopkins-managed · no payouts' : 'Independent · payouts via Stripe'}
              </Text>
            }
            flex={1}
          >
            <ScrollView>
              {data.blueprints.length === 0 ? (
                <BlueprintsEmptyState onCreate={() => router.push('/studio/blueprints/new')} />
              ) : (
                <>
                  {data.blueprints.map((bp) => (
                    <BlueprintRow
                      key={bp.id}
                      bp={bp}
                      onPress={() => router.push(`/studio/blueprints/${bp.id}`)}
                    />
                  ))}
                  <Pressable
                    style={styles.newBlueprintRow}
                    onPress={() => router.push('/studio/blueprints/new')}
                  >
                    <Ionicons name="add" size={14} color="#007AFF" />
                    <Text style={styles.newBlueprintText}>Create a new blueprint</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </StudioPanel>

          <StudioPanel
            title="Threads awaiting you"
            meta={
              <Text
                style={[
                  styles.panelMeta,
                  data.threadAwaitingCount > 0 && styles.panelMetaCoral,
                ]}
              >
                {data.threadAwaitingCount > 0 ? data.threadAwaitingCount : '0'}
              </Text>
            }
            width={compact ? undefined : 360}
          >
            <ScrollView>
              {data.threads.length === 0 ? (
                <ThreadsEmptyState />
              ) : (
                <>
                  {data.threads.map((t) => (
                    <ThreadRow key={t.id} t={t} />
                  ))}
                  <Pressable style={styles.viewAllRow}>
                    <Text style={styles.viewAllText}>
                      View all {data.threads.length} threads →
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </StudioPanel>
        </View>
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  footnote,
  footnoteTone = 'neutral',
  valueTone = 'neutral',
}: {
  label: string;
  value: string;
  footnote: string;
  footnoteTone?: 'neutral' | 'positive';
  valueTone?: 'neutral' | 'coral';
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[styles.kpiValue, valueTone === 'coral' && styles.kpiValueCoral]}
      >
        {value}
      </Text>
      <View style={styles.kpiFootRow}>
        {footnoteTone === 'positive' ? (
          <Ionicons name="trending-up" size={13} color="#1E8F47" />
        ) : null}
        <Text
          style={[
            styles.kpiFootnote,
            footnoteTone === 'positive' && styles.kpiFootnotePositive,
          ]}
        >
          {footnote}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blueprint row + empty state
// ---------------------------------------------------------------------------

function BlueprintRow({ bp, onPress }: { bp: StudioBlueprint; onPress?: () => void }) {
  const isDraft = bp.status === 'draft';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.blueprintRow, isDraft && styles.blueprintRowDraft]}
    >
      <BlueprintCover bp={bp} />
      <View style={styles.bpContent}>
        <Text style={[styles.bpTitle, isDraft && styles.bpTitleDraft]} numberOfLines={1}>
          {bp.title}
          {isDraft ? <Text style={styles.bpDraftLabel}>{'  '}— draft</Text> : null}
        </Text>
        <Text style={styles.bpSubtitle} numberOfLines={2}>
          {bp.subtitle}
        </Text>
        <View style={styles.bpPillRow}>
          {isDraft ? (
            <View style={[styles.bpPill, styles.bpPillAmber]}>
              <Text style={[styles.bpPillText, styles.bpPillTextAmber]}>
                Draft · {bp.totalSteps ? `${bp.stepCount} of ${bp.totalSteps}` : bp.stepCount} steps
              </Text>
            </View>
          ) : (
            <View style={[styles.bpPill, styles.bpPillGreen]}>
              <Text style={[styles.bpPillText, styles.bpPillTextGreen]}>
                Live{bp.version ? ` · ${bp.version}` : ''}
              </Text>
            </View>
          )}
          {!isDraft && (
            <View style={styles.bpPill}>
              <Text style={styles.bpPillText}>{bp.subscriberCount} subscribers</Text>
            </View>
          )}
          {!isDraft && (
            <View style={styles.bpPill}>
              <Text style={styles.bpPillText}>{bp.stepCount} steps</Text>
            </View>
          )}
          {isDraft && (
            <View style={styles.bpPill}>
              <Text style={styles.bpPillText}>Not yet published</Text>
            </View>
          )}
          {bp.coAuthors.length > 0 && (
            <View style={styles.bpPill}>
              <Text style={styles.bpPillText}>
                Co-authored · {bp.coAuthors.join(', ')}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.bpActions}>
        {isDraft ? (
          <StudioButton variant="primary" accent="purple" label="Continue" small />
        ) : (
          <StudioButton variant="ghost" icon="create-outline" label="Edit" small />
        )}
        <Text style={styles.bpLastEdit}>Last edit · {bp.lastEditLabel}</Text>
      </View>
    </Pressable>
  );
}

function BlueprintCover({ bp }: { bp: StudioBlueprint }) {
  if (bp.status === 'draft') {
    return (
      <View style={styles.coverDraft}>
        <Ionicons name="image-outline" size={22} color="rgba(60, 60, 67, 0.3)" />
      </View>
    );
  }
  return (
    <Gradient colors={bp.coverGradient} style={styles.cover}>
      {bp.orgShort ? (
        <View style={styles.coverOrgBadge}>
          <Text style={styles.coverOrgBadgeText}>{bp.orgShort}</Text>
        </View>
      ) : null}
      <Text style={styles.coverLabel} numberOfLines={2}>
        {bp.title.split(' ').slice(0, 2).join(' ').toUpperCase()}
      </Text>
    </Gradient>
  );
}

function BlueprintsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="git-branch-outline" size={28} color="rgba(107, 91, 191, 0.6)" />
      </View>
      <Text style={styles.emptyTitle}>No blueprints yet</Text>
      <Text style={styles.emptyBody}>
        A blueprint is a structured path your subscribers practice through. Start
        with a cover, three steps, and pricing — you can iterate from there.
      </Text>
      <StudioButton
        variant="primary"
        accent="purple"
        icon="add"
        label="Create your first blueprint"
        onPress={onCreate}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thread row + empty state
// ---------------------------------------------------------------------------

function ThreadRow({ t }: { t: StudioThread }) {
  return (
    <Pressable style={styles.threadRow}>
      <View style={[styles.threadAvi, { backgroundColor: t.gradient[0] }]}>
        <Text style={styles.threadAviText}>{t.fromInitials}</Text>
      </View>
      <View style={styles.threadBody}>
        <View style={styles.threadHeadRow}>
          <Text style={styles.threadName}>{t.fromName}</Text>
          <Text style={styles.threadCtx}> · {t.blueprintLabel}</Text>
        </View>
        <Text style={styles.threadPreview} numberOfLines={2}>
          {t.preview}
        </Text>
        <View style={styles.threadAgeRow}>
          {t.awaiting ? (
            <Ionicons name="ellipse" size={6} color="#FF6B6B" />
          ) : null}
          <Text style={[styles.threadAge, t.awaiting && styles.threadAgeAwaiting]}>
            {t.ageLabel}
            {t.awaiting ? ' · awaiting' : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ThreadsEmptyState() {
  return (
    <View style={styles.emptyStateThin}>
      <Ionicons name="chatbubbles-outline" size={22} color="rgba(60, 60, 67, 0.3)" />
      <Text style={styles.emptyThinTitle}>No threads yet</Text>
      <Text style={styles.emptyThinBody}>
        Subscriber questions and reflections will surface here.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'evening';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function firstName(displayName: string): string {
  const tokens = displayName.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return displayName;
  // Strip leading "Dr." / "Mr." / "Ms." titles for a friendlier greeting.
  const first = tokens[0].replace(/\.$/, '');
  if (/^(dr|mr|ms|mrs|prof)$/i.test(first) && tokens.length > 1) {
    return tokens[1];
  }
  return tokens[0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',  // stage warmth bleeds in around the iPad on web
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },

  // Sidebar institutional footer
  institutionalNote: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  institutionalNoteStrong: {
    color: '#28406B',
    fontWeight: '700',
  },

  // Header subtitle
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  // KPI strip
  kpiStrip: {
    marginTop: 18,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    ...({
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    } as any),
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  kpiValueCoral: { color: '#FF6B6B' },
  kpiFootRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiFootnote: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  kpiFootnotePositive: { color: '#1E8F47' },

  // Two-column grid
  twoCol: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 0,
  },
  // <600pt — stack the two panels vertically so neither is squeezed to ~190pt.
  twoColStacked: { flexDirection: 'column' },

  // Panel meta
  panelMeta: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  panelMetaCoral: { color: '#FF6B6B', fontWeight: '600' },

  // Blueprint row
  blueprintRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  blueprintRowDraft: { backgroundColor: 'rgba(201, 150, 50, 0.04)' },
  cover: {
    width: 80,
    height: 100,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  coverDraft: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOrgBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  coverOrgBadgeText: { fontSize: 8.5, fontWeight: '700', color: '#FFFFFF' },
  coverLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bpContent: { flex: 1, minWidth: 0 },
  bpTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  bpTitleDraft: { color: 'rgba(60, 60, 67, 0.85)' },
  bpDraftLabel: { fontStyle: 'italic', color: 'rgba(60, 60, 67, 0.6)', fontWeight: '400', fontSize: 13 },
  bpSubtitle: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 6,
  },
  bpPillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bpPill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  bpPillAmber: { backgroundColor: 'rgba(201, 150, 50, 0.12)' },
  bpPillGreen: { backgroundColor: 'rgba(52, 199, 89, 0.12)' },
  bpPillText: { fontSize: 10.5, fontWeight: '600', color: 'rgba(60, 60, 67, 0.85)' },
  bpPillTextAmber: { color: '#C99632' },
  bpPillTextGreen: { color: '#1E8F47' },
  bpActions: { alignItems: 'flex-end', gap: 6 },
  bpLastEdit: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)' },

  // New-blueprint row
  newBlueprintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  newBlueprintText: { color: '#007AFF', fontSize: 13.5, fontWeight: '500' },

  // Empty state — big
  emptyState: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(107, 91, 191, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  emptyBody: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 8,
  },

  // Empty state — thin (threads panel)
  emptyStateThin: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyThinTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  emptyThinBody: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Thread row
  threadRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  threadAvi: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  threadBody: { flex: 1, minWidth: 0 },
  threadHeadRow: { flexDirection: 'row', alignItems: 'baseline' },
  threadName: { fontSize: 12.5, fontWeight: '600', color: '#1C1C1E' },
  threadCtx: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)' },
  threadPreview: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 16,
    marginTop: 2,
  },
  threadAgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  threadAge: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)' },
  threadAgeAwaiting: { color: '#FF6B6B', fontWeight: '600' },

  // View-all
  viewAllRow: { paddingVertical: 12, alignItems: 'center' },
  viewAllText: { color: '#007AFF', fontSize: 12.5, fontWeight: '500' },
});
