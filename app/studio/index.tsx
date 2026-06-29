/**
 * Creator Studio · Blueprints (the Studio landing)
 *
 * Minimization pass (studio-consolidation-mock.html): Studio no longer has a
 * Home greeting + KPI dashboard. It lands directly on Blueprints — the list is
 * the page. The four KPI cards collapse into one muted stat line under the
 * title, and there is a single create action (the list footer). Subscribers /
 * Threads / Payouts are their own tabs; Threads stays the reply surface.
 *
 *   StudioShell
 *     ├── sidebar (org card, ctx switch, Studio/Money/Co-authors nav,
 *     │             user card pinned bottom)
 *     └── main
 *           ├── StudioHeader (crumbs, "Blueprints", one stat line)
 *           └── blueprint list (full width) + one "New blueprint" footer
 *
 * Data is sourced from useStudioHomeData().
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
import { useStudioHomeData, StudioBlueprint } from '@/hooks/useStudioHomeData';
import {
  StudioShell,
  StudioHeader,
  StudioButton,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Gradient } from '@/components/studio/Gradient';
import { fontFamily } from '@/lib/design-tokens-editorial';

export default function StudioBlueprintsPage() {
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();
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
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          count: data.blueprintCount || undefined,
          active: true,
        },
        {
          key: 'subscribers',
          icon: 'people-outline',
          label: 'Subscribers',
          count: data.kpis.activeSubscribers || undefined,
          onPress: () => router.push('/studio/subscribers'),
        },
        {
          key: 'threads',
          icon: 'chatbubbles-outline',
          label: 'Threads',
          count: data.threadAwaitingCount || undefined,
          countTone: data.threadAwaitingCount > 0 ? 'coral' : 'neutral',
          onPress: () => router.push('/studio/threads'),
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
          onPress: () => router.push('/studio/payouts'),
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

  // One muted stat line replaces the greeting + the 4-up KPI grid.
  const liveCount = data.blueprints.filter((b) => b.status === 'live').length;
  const totalSubscribers = data.kpis.activeSubscribers;
  const statLine =
    data.blueprintCount === 0
      ? 'No blueprints yet'
      : `${liveCount} live${data.draftCount ? ` · ${data.draftCount} draft` : ''} · ` +
        `${totalSubscribers} subscriber${totalSubscribers === 1 ? '' : 's'} · ` +
        `${data.threadAwaitingCount} awaiting`;
  const subtitleParts: React.ReactNode[] = [
    <Text style={styles.subText} key="stat">
      {statLine}
    </Text>,
  ];

  const blueprintsBody =
    data.blueprints.length === 0 ? (
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
          <Ionicons name="add" size={15} color="#007AFF" />
          <Text style={styles.newBlueprintText}>New blueprint</Text>
        </Pressable>
      </>
    );

  // The blueprint list IS the page — no card chrome, no second column. On
  // desktop the main area is fixed-height so the list scrolls internally; on
  // phone the whole surface scrolls (handled by the compact wrapper below).
  const body = (
    <>
      <StudioHeader
        compact={compact}
        crumbs={['Creator Studio', 'Blueprints']}
        title="Blueprints"
        subtitleParts={subtitleParts}
        pill={
          isInstitutional
            ? { label: `${activeOrg!.org_name.split(' · ')[0]}-managed`, tone: 'purple' }
            : undefined
        }
      />

      <View style={styles.listWrap}>
        {compact ? blueprintsBody : <ScrollView showsVerticalScrollIndicator={false}>{blueprintsBody}</ScrollView>}
      </View>
    </>
  );

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
        compactBottomTabs={[
          {
            key: 'blueprints',
            icon: 'git-branch-outline',
            label: 'Blueprints',
            count: data.blueprintCount || undefined,
            active: true,
          },
          {
            key: 'subscribers',
            icon: 'people-outline',
            label: 'Subscribers',
            count: data.kpis.activeSubscribers || undefined,
            onPress: () => router.push('/studio/subscribers'),
          },
          {
            key: 'threads',
            icon: 'chatbubbles-outline',
            label: 'Threads',
            count: data.threadAwaitingCount || undefined,
            onPress: () => router.push('/studio/threads'),
          },
          {
            key: 'payouts',
            icon: 'cash-outline',
            label: 'Payouts',
            onPress: () => router.push('/studio/payouts'),
          },
        ]}
        user={{ name: displayName, email: user?.email ?? '', initials }}
        onUserCardPress={() =>
          showConfirm('Sign out', `Sign out of ${displayName}?`, () => {
            void signOut();
          })
        }
      >
        {compact ? (
          <ScrollView
            style={styles.compactScroll}
            contentContainerStyle={styles.compactScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </StudioShell>
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
          <StudioButton variant="primary" accent="purple" label="Continue" small onPress={onPress} />
        ) : (
          <StudioButton variant="ghost" icon="create-outline" label="Edit" small onPress={onPress} />
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
// Helpers
// ---------------------------------------------------------------------------

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

  // Header subtitle — the single muted stat line.
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Phone page scroll.
  compactScroll: { flex: 1 },
  compactScrollInner: { paddingBottom: 24 },

  // Blueprint list — the page itself, no card chrome.
  listWrap: { flex: 1, marginTop: 10 },

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
  coverOrgBadgeText: { fontSize: 8.5, fontFamily: fontFamily.mono, fontWeight: '500', color: '#FFFFFF' },
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
  bpPillText: { fontSize: 10.5, fontFamily: fontFamily.mono, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  bpPillTextAmber: { color: '#C99632' },
  bpPillTextGreen: { color: '#1E8F47' },
  bpActions: { alignItems: 'flex-end', gap: 6 },
  bpLastEdit: { fontSize: 10.5, fontFamily: fontFamily.mono, fontWeight: '500', color: 'rgba(60, 60, 67, 0.6)' },

  // New-blueprint row — the single create action.
  newBlueprintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  newBlueprintText: { color: '#007AFF', fontSize: 13.5, fontWeight: '600' },

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
  emptyTitle: { fontSize: 16, fontFamily: fontFamily.serif, fontWeight: '500', color: '#1C1C1E', letterSpacing: -0.3 },
  emptyBody: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 8,
  },
});
