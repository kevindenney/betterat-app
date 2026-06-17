import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSDetailNavBar, RelationshipButton } from '@/components/discover/detail';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useGroupViewerMembership } from '@/hooks/useGroupViewerMembership';
import { AffinityGroupService } from '@/services/AffinityGroupService';
import type { AffinityGroupKind } from '@/hooks/useUserAffinityGroups';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  green: '#0F766E',
} as const;

interface GroupRow {
  id: string;
  kind: AffinityGroupKind;
  name: string;
  short_name: string | null;
  description: string | null;
  interest_slug: string | null;
  parent_org_id: string | null;
}

// The whole page tints from one accent derived from the group kind, so a
// fleet reads orange (matching its Atlas pin tone) while a cohort reads
// purple — no per-row color column needed.
function kindAccent(kind: AffinityGroupKind): { base: string; ink: string } {
  switch (kind) {
    case 'crew_pod':
      return { base: '#1E9E63', ink: '#0F5C39' };
    case 'cohort':
      return { base: '#7C3AED', ink: '#4C1D95' };
    case 'class_fleet':
    case 'practice_group':
    default:
      return { base: '#C2410C', ink: '#7C2D12' };
  }
}

function kindLabel(kind: AffinityGroupKind): string {
  switch (kind) {
    case 'class_fleet':
      return 'Class fleet';
    case 'cohort':
      return 'Cohort';
    case 'crew_pod':
      return 'Crew pod';
    case 'practice_group':
      return 'Practice group';
    default:
      return 'Group';
  }
}

export default function GroupDetailPage(): React.ReactElement {
  const params = useLocalSearchParams<{ id?: string }>();
  const groupId = typeof params.id === 'string' ? params.id.trim() : '';
  const { user: authUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { membership, refetch: refetchMembership } = useGroupViewerMembership(group?.id);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/atlas' as never);
  }, []);

  // Membership changes ripple to: the viewer's own group list (Atlas
  // sub-chips), this group's membership query, and Atlas search's
  // per-group "Member" tag. Refetch the local count too.
  const invalidateMembership = useCallback(() => {
    refetchMembership();
    queryClient.invalidateQueries({ queryKey: ['user-affinity-groups'] });
    queryClient.invalidateQueries({ queryKey: ['group-viewer-membership', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['atlas-search'] });
  }, [refetchMembership, queryClient, group?.id]);

  const runJoin = useCallback(async () => {
    if (!authUser?.id || !group?.id || joining) return;
    setJoining(true);
    try {
      await AffinityGroupService.join({ groupId: group.id, userId: authUser.id });
      invalidateMembership();
      toast.show('You’re in — welcome!', 'success');
    } catch (err) {
      toast.show((err as Error)?.message || 'Could not join this group', 'error');
    } finally {
      setJoining(false);
    }
  }, [authUser?.id, group?.id, joining, invalidateMembership, toast]);

  const runLeave = useCallback(async () => {
    if (!authUser?.id || !group?.id || leaving) return;
    setLeaving(true);
    try {
      await AffinityGroupService.leave({ groupId: group.id, userId: authUser.id });
      invalidateMembership();
      toast.show('You’ve left this group', 'success');
    } catch (err) {
      toast.show((err as Error)?.message || 'Could not leave this group', 'error');
    } finally {
      setLeaving(false);
    }
  }, [authUser?.id, group?.id, leaving, invalidateMembership, toast]);

  const handleJoinPress = useCallback(() => {
    showConfirm(
      `Join ${group?.name ?? 'this group'}?`,
      'You’ll get access to this group’s shared surfaces right away.',
      () => void runJoin(),
      { confirmText: 'Join' },
    );
  }, [group?.name, runJoin]);

  const handleLeavePress = useCallback(() => {
    showConfirm(
      `Leave ${group?.name ?? 'this group'}?`,
      'You’ll lose access to this group’s shared surfaces. You can rejoin later.',
      () => void runLeave(),
      { destructive: true, confirmText: 'Leave' },
    );
  }, [group?.name, runLeave]);

  // Load the group itself. affinity_groups SELECT is open to any authed
  // user, so this resolves for members and non-members alike.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        if (!groupId) throw new Error('Group not found.');
        const { data, error } = await supabase
          .from('affinity_groups')
          .select('id, kind, name, short_name, description, interest_slug, parent_org_id')
          .eq('id', groupId)
          .eq('is_active', true)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Group not found.');
        if (cancelled) return;
        setGroup(data as GroupRow);
      } catch (error) {
        if (!cancelled) setErrorText((error as Error)?.message || 'Could not load this group.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Parent org name (if any) — cheap follow-up read. organizations SELECT
  // is public for discovery.
  useEffect(() => {
    let cancelled = false;
    if (!group?.parent_org_id) {
      setOrgName(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.parent_org_id as string)
        .maybeSingle();
      if (!cancelled) setOrgName(data ? String((data as { name?: string }).name ?? '') || null : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.parent_org_id]);

  // Active member count — only readable once the viewer is a member (the
  // affinity_group_members SELECT policy gates non-members out), so this
  // stays null for non-members and the stat card hides.
  useEffect(() => {
    let cancelled = false;
    if (!group?.id || !membership?.isMember) {
      setMemberCount(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const { count } = await supabase
        .from('affinity_group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .eq('status', 'active');
      if (!cancelled) setMemberCount(typeof count === 'number' ? count : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.id, membership?.isMember]);

  const accent = group ? kindAccent(group.kind) : { base: C.muted, ink: C.ink };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: group?.name || 'Group' }} />
      <IOSDetailNavBar
        backLabel="Back"
        contextLabel={group ? kindLabel(group.kind) : 'Group'}
        dockedName={group?.name}
        docked={false}
        onBack={handleBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={accent.base} />
          </View>
        ) : errorText || !group ? (
          <View style={styles.card}>
            <Ionicons name="people-outline" size={36} color={C.muted} />
            <Text style={styles.title}>Group not found</Text>
            <Text style={styles.body}>{errorText || 'This group may no longer exist.'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <LinearGradient
                colors={[accent.base, accent.ink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cover}
              />
              <View style={styles.identity}>
                <View style={[styles.mark, { backgroundColor: accent.base }]}>
                  <Text style={styles.markText}>{group.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.identityText}>
                  <Text style={[styles.eyebrow, { color: accent.ink }]}>
                    {kindLabel(group.kind)}
                  </Text>
                  <Text style={styles.name}>{group.name}</Text>
                  <View style={styles.metaRow}>
                    {orgName ? (
                      <Text style={styles.metaText} numberOfLines={1}>
                        {orgName}
                      </Text>
                    ) : null}
                    {group.interest_slug ? (
                      <Text style={styles.metaText} numberOfLines={1}>
                        {group.interest_slug}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {membership?.isMember ? (
                <View style={styles.memberBadge}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={C.green} />
                  <Text style={styles.memberBadgeText}>
                    {membership.role !== 'member' ? `You're a ${membership.role}` : "You're a member"}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              {membership?.isMember ? (
                // Leaders/coaches manage the roster elsewhere; only plain
                // members self-leave from here.
                membership.role === 'member' ? (
                  <RelationshipButton
                    label="Leave"
                    icon="exit-outline"
                    secondary
                    fullWidth={false}
                    loading={leaving}
                    onPress={handleLeavePress}
                  />
                ) : null
              ) : (
                <RelationshipButton
                  label="Join group"
                  icon="add-circle-outline"
                  fullWidth={false}
                  loading={joining}
                  onPress={handleJoinPress}
                />
              )}
            </View>

            {group.description ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.body}>{group.description}</Text>
              </View>
            ) : null}

            <View style={styles.grid}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{kindLabel(group.kind)}</Text>
                <Text style={styles.statLabel}>Group type</Text>
              </View>
              {memberCount !== null ? (
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{memberCount}</Text>
                  <Text style={styles.statLabel}>
                    {memberCount === 1 ? 'Member' : 'Members'}
                  </Text>
                </View>
              ) : null}
            </View>

            {!membership?.isMember ? (
              <View style={styles.notice}>
                <Text style={styles.noticeBody}>
                  Join to see this group on your Atlas, scope peers to its roster, and share
                  group-only surfaces.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, gap: 16 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 12 },
  cover: { height: 120, borderRadius: 16 },
  identity: { flexDirection: 'row', gap: 14, paddingHorizontal: 4, alignItems: 'flex-start' },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.bg,
    marginTop: -48,
  },
  markText: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  identityText: { flex: 1, gap: 4, paddingTop: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  name: { color: C.ink, fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { color: C.muted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 175, 122, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56, 175, 122, 0.35)',
  },
  memberBadgeText: { fontSize: 12, fontWeight: '700', color: C.ink, letterSpacing: -0.1 },
  actionRow: { paddingBottom: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
  },
  statValue: { color: C.ink, fontSize: 20, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { color: C.ink, fontSize: 24, fontWeight: '800' },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: '800' },
  body: { color: C.muted, fontSize: 15, lineHeight: 22 },
  notice: {
    backgroundColor: '#F7FAFF',
    borderColor: 'rgba(11, 99, 206, 0.16)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  noticeBody: { color: C.ink, fontSize: 15, lineHeight: 22 },
});
