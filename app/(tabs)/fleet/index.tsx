/**
 * Fleet Overview - Tufte Style
 *
 * Simplified, typography-driven design following Edward Tufte principles:
 * - High data-to-ink ratio
 * - Warm paper background
 * - Hairline rules instead of cards
 * - All information visible at once
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useFleetOverview, useFleetPlans, useUserFleets } from '@/hooks/useFleetData';
import { useFleetPosts } from '@/hooks/useFleetSocial';
import { fleetService, type FleetMembership } from '@/services/fleetService';
import { TUFTE_BACKGROUND } from '@/components/cards/constants';
import { GroupKnowledgeSection } from '@/components/venue/GroupKnowledgeSection';
import { InterestSwitcher } from '@/components/InterestSwitcher';

// Tufte color palette
const COLORS = {
  background: TUFTE_BACKGROUND,
  text: '#3D3832',
  secondaryText: '#6B7280',
  tertiaryText: '#9CA3AF',
  sectionLabel: '#8E8E93',
  hairline: '#E5E7EB',
  activeBlue: '#007AFF',
  leaveRed: '#DC2626',
  successGreen: '#16A34A',
};

export default function FleetOverviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFleetIndex, setSelectedFleetIndex] = useState(0);
  const [leavingFleetId, setLeavingFleetId] = useState<string | null>(null);

  const { fleets, loading: fleetsLoading, refresh: refreshFleets } = useUserFleets(user?.id);

  useEffect(() => {
    if (selectedFleetIndex >= fleets.length && fleets.length > 0) {
      setSelectedFleetIndex(Math.max(0, fleets.length - 1));
    }
  }, [fleets, selectedFleetIndex]);

  const activeFleetMembership = fleets[selectedFleetIndex];
  const activeFleet = activeFleetMembership?.fleet;

  const { overview } = useFleetOverview(activeFleet?.id);
  const { posts, loading: postsLoading } = useFleetPosts(activeFleet?.id, { limit: 10 });
  const { plans, loading: plansLoading, refresh: refreshPlans } = useFleetPlans(activeFleet?.id);

  const activeRole = activeFleetMembership?.role;
  const canManagePlans =
    activeRole === 'owner' || activeRole === 'captain' || activeRole === 'coach';
  const canManageMembers = activeRole === 'owner' || activeRole === 'captain';

  useFocusEffect(
    useCallback(() => {
      refreshFleets();
      refreshPlans();
    }, [refreshFleets, refreshPlans])
  );

  const handleLeaveFleet = useCallback(async (fleetId: string, fleetName?: string) => {
    showConfirm(
      `Leave ${fleetName ?? 'this fleet'}?`,
      'You will lose access to shared content.',
      async () => {
        if (!user?.id) return;
        setLeavingFleetId(fleetId);
        try {
          await fleetService.leaveFleet(user.id, fleetId);
          await refreshFleets();
        } catch (error: any) {
          showAlert('Error', error?.message ?? 'Could not leave fleet');
        } finally {
          setLeavingFleetId(null);
        }
      },
      { destructive: true }
    );
  }, [user?.id, refreshFleets]);

  const formatRole = (role: FleetMembership['role']): string => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'captain': return 'Captain';
      case 'coach': return 'Coach';
      default: return 'Member';
    }
  };

  const formatRelativeTime = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Empty state - no fleets
  if (!fleetsLoading && fleets.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
      >
        <View style={[styles.navbar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/library'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <InterestSwitcher />
        </View>
        <Text style={styles.sectionLabel}>FLEETS</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No fleets yet</Text>
          <Text style={styles.emptySubtitle}>
            Join a fleet to connect with sailors, share documents, and coordinate race days.
          </Text>
          <Link href="/(tabs)/fleet/create" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create a fleet</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/fleet/select" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>Find fleets to join →</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    );
  }

  // Loading state
  if (fleetsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.activeBlue} />
      </View>
    );
  }

  const summaryFleet = overview?.fleet ?? activeFleet;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
    >
      <View style={[styles.navbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/library'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.navbarSwitcher}>
          <InterestSwitcher />
        </View>
      </View>
      {/* Fleet Selector — only meaningful when you belong to more than one
          fleet. With a single fleet the list just repeats the header below, so
          we lead straight into the fleet itself and keep Join/New as a compact
          action row under the header. */}
      {fleets.length > 1 && (
        <>
          <Text style={styles.sectionLabel}>YOUR FLEETS</Text>
          <View style={styles.fleetList}>
            {fleets.map((membership, index) => (
              <TouchableOpacity
                key={membership.fleet.id}
                style={styles.fleetRow}
                onPress={() => setSelectedFleetIndex(index)}
              >
                <View style={styles.fleetRowLeft}>
                  {index === selectedFleetIndex && <View style={styles.activeDot} />}
                  <Text style={[
                    styles.fleetName,
                    index === selectedFleetIndex && styles.fleetNameActive
                  ]}>
                    {membership.fleet.name}
                  </Text>
                </View>
                <Text style={styles.fleetMeta}>
                  {formatRole(membership.role)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Active Fleet Header */}
      {summaryFleet && (
        <>
          {fleets.length > 1 && <View style={styles.divider} />}
          <View style={styles.fleetHeader}>
            <View style={styles.fleetHeaderLeft}>
              <Text style={styles.fleetTitle}>{summaryFleet.name}</Text>
              <Text style={styles.fleetSubtitle}>
                {[
                  summaryFleet.region,
                  summaryFleet.boat_classes?.name,
                ].filter(Boolean).join(' · ')}
              </Text>
              {activeFleet?.organization?.slug && (
                <TouchableOpacity
                  style={styles.fleetClubRow}
                  onPress={() =>
                    router.push(`/organizations/${activeFleet.organization!.slug}` as any)
                  }
                >
                  <Text style={styles.fleetClubLink}>
                    {activeFleet.organization.name} ›
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{formatRole(activeRole)}</Text>
            </View>
          </View>

          {/* Stat tiles */}
          <View style={styles.statTiles}>
            <View style={styles.statTile}>
              <Text style={styles.statTileNumber}>{overview?.metrics?.members ?? 0}</Text>
              <Text style={styles.statTileLabel}>Members</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statTileNumber}>{overview?.metrics?.invited ?? 0}</Text>
              <Text style={styles.statTileLabel}>Invited</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statTileNumber}>{overview?.metrics?.documents ?? 0}</Text>
              <Text style={styles.statTileLabel}>Resources</Text>
            </View>
          </View>

          {/* Visibility badge */}
          <View style={styles.visBadge}>
            <Text style={styles.visBadgeIcon}>
              {summaryFleet.visibility === 'public' ? '🔓' : '🔒'}
            </Text>
            <Text style={styles.visBadgeText}>
              {summaryFleet.visibility === 'public'
                ? 'Public fleet · anyone can find it'
                : 'Private fleet · invite only'}
            </Text>
          </View>

          {/* Manage / view members */}
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/fleet/members',
                params: { fleetId: summaryFleet.id },
              } as any)
            }
          >
            <Text style={styles.linkText}>
              {canManageMembers ? 'Manage members →' : 'View members →'}
            </Text>
          </TouchableOpacity>

          {/* Quick Actions */}
          {summaryFleet.whatsappLink && (
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => Linking.openURL(summaryFleet.whatsappLink!)}
            >
              <Text style={styles.linkText}>Open WhatsApp chat →</Text>
            </TouchableOpacity>
          )}

          {/* Join / create more fleets — kept visible since the selector list
              above only renders when you belong to more than one fleet. */}
          <View style={styles.fleetListActions}>
            <Link href="/(tabs)/fleet/select" asChild>
              <TouchableOpacity style={styles.joinRow}>
                <Text style={styles.linkText}>+ Join fleet</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/(tabs)/fleet/create" asChild>
              <TouchableOpacity style={styles.joinRow}>
                <Text style={styles.linkText}>+ New fleet</Text>
              </TouchableOpacity>
            </Link>
            {/* Owners can't leave (it would orphan the fleet); they manage it
                via the roster. Members/captains/coaches may leave. */}
            {activeRole !== 'owner' && (
              <TouchableOpacity
                style={styles.joinRow}
                onPress={() => handleLeaveFleet(summaryFleet.id, summaryFleet.name)}
                disabled={leavingFleetId === summaryFleet.id}
              >
                {leavingFleetId === summaryFleet.id ? (
                  <ActivityIndicator size="small" color={COLORS.leaveRed} />
                ) : (
                  <Text style={styles.leaveText}>Leave</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Season Plan */}
      {summaryFleet && (
        <>
          <View style={styles.divider} />
          <View style={styles.planHeader}>
            <Text style={styles.sectionLabel}>SEASON PLAN</Text>
            {canManagePlans && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/fleet/plan/builder',
                    params: { fleetId: summaryFleet.id, fleetName: summaryFleet.name },
                  } as any)
                }
              >
                <Text style={styles.linkText}>+ New plan</Text>
              </TouchableOpacity>
            )}
          </View>

          {plansLoading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : plans.length === 0 ? (
            <Text style={styles.emptyText}>
              {canManagePlans
                ? 'No plans yet. Author a season of races and prep steps for the fleet.'
                : 'No season plan published yet.'}
            </Text>
          ) : (
            <View style={styles.planList}>
              {plans.map((plan, index) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planRow, index < plans.length - 1 && styles.planRowBorder]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/fleet/plan/[blueprintId]',
                      params: {
                        blueprintId: plan.id,
                        fleetName: summaryFleet.name,
                        title: plan.title,
                        isAuthor: plan.viewer_is_author ? 'true' : 'false',
                        canEdit: canManagePlans ? 'true' : 'false',
                      },
                    } as any)
                  }
                >
                  <View style={styles.planRowLeft}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planMeta}>
                      {[
                        `${plan.step_count} step${plan.step_count === 1 ? '' : 's'}`,
                        plan.is_published
                          ? `${plan.subscriber_count} subscribed`
                          : 'Draft',
                      ].join(' · ')}
                    </Text>
                  </View>
                  {!plan.is_published && plan.viewer_is_author && (
                    <View style={styles.draftPill}>
                      <Text style={styles.draftPillText}>Draft</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Local knowledge — fleet-scoped notes bucketed by racing area.
          Collapses to null when the fleet has none (or viewer isn't a
          member, since RLS hides the rows). */}
      {summaryFleet && (
        <GroupKnowledgeSection
          scopeType="fleet"
          scopeId={summaryFleet.id}
          interestSlug="sail-racing"
          style={styles.knowledgeSection}
        />
      )}

      {/* Activity Feed */}
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

      {postsLoading && (
        <Text style={styles.loadingText}>Loading...</Text>
      )}

      {!postsLoading && posts.length === 0 && (
        <Text style={styles.emptyText}>No activity yet</Text>
      )}

      {!postsLoading && posts.length > 0 && (
        <View style={styles.activityList}>
          {posts.slice(0, 8).map((post, index) => (
            <View
              key={post.id}
              style={[
                styles.activityRow,
                index < posts.length - 1 && styles.activityRowBorder,
              ]}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityAuthor}>
                  {post.author?.name ?? 'Unknown'}
                </Text>
                {post.content && (
                  <Text style={styles.activityExcerpt} numberOfLines={1}>
                    {post.content}
                  </Text>
                )}
              </View>
              <Text style={styles.activityTime}>
                {formatRelativeTime(post.createdAt)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  navbarSwitcher: {
    alignItems: 'flex-end',
  },
  backRow: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    color: COLORS.activeBlue,
    fontWeight: '500',
  },

  // Role chip
  roleChip: {
    backgroundColor: '#FFF4E1',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B26B00',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Stat tiles
  statTiles: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  statTileNumber: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
  },
  statTileLabel: {
    fontSize: 11,
    color: COLORS.tertiaryText,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Visibility badge
  visBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 13,
    marginBottom: 4,
  },
  visBadgeIcon: {
    fontSize: 12,
  },
  visBadgeText: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },

  // Section labels (Tufte style)
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 8,
  },

  // Fleet list
  fleetList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  fleetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  fleetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.activeBlue,
  },
  fleetName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  fleetNameActive: {
    fontWeight: '600',
    color: COLORS.activeBlue,
  },
  fleetMeta: {
    fontSize: 13,
    color: COLORS.tertiaryText,
  },
  fleetListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 4,
  },
  joinRow: {
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.activeBlue,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.hairline,
    marginVertical: 20,
  },
  knowledgeSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
    marginTop: 20,
    paddingTop: 20,
  },

  // Fleet header
  fleetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  fleetHeaderLeft: {
    flex: 1,
  },
  fleetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  fleetSubtitle: {
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  fleetClubRow: {
    marginTop: 4,
  },
  fleetClubLink: {
    fontSize: 13,
    color: COLORS.activeBlue,
    fontWeight: '500',
  },
  leaveText: {
    fontSize: 13,
    color: COLORS.leaveRed,
    fontWeight: '500',
  },

  // Stats line
  statsLine: {
    fontSize: 12,
    color: COLORS.tertiaryText,
    marginBottom: 12,
  },

  // Quick actions
  quickAction: {
    marginBottom: 8,
  },

  // Link text
  linkText: {
    fontSize: 13,
    color: COLORS.activeBlue,
    fontWeight: '500',
  },

  // Season plan
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  planRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  planRowLeft: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  planMeta: {
    fontSize: 12,
    color: COLORS.tertiaryText,
  },
  draftPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  draftPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryText,
  },

  // Activity feed
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityAuthor: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  activityExcerpt: {
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.tertiaryText,
  },

  // Empty states
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.tertiaryText,
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.tertiaryText,
  },
});
