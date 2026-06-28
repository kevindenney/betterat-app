import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSDetailNavBar, RelationshipButton } from '@/components/discover/detail';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useGroupViewerMembership } from '@/hooks/useGroupViewerMembership';
import {
  AffinityGroupService,
  type AffinityGroupAffiliation,
} from '@/services/AffinityGroupService';
import type { AffinityGroupKind } from '@/hooks/useUserAffinityGroups';
import { useAffinityGroupRoster } from '@/hooks/useAffinityGroupRoster';
import { useGroupPlanSteps } from '@/hooks/useGroupPlanSteps';
import { AddPeoplePicker } from '@/components/step/plan-tab/AddPeoplePicker';
import type { StepCollaborator } from '@/types/step-detail';
import { getUserBlueprints, getBlueprintById } from '@/services/BlueprintService';
import type { TimelineStepRecord } from '@/types/timeline-steps';

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
  blueprint_id: string | null;
  goal_at: string | null;
  goal_label: string | null;
  affiliations: AffinityGroupAffiliation[] | null;
  whatsapp_invite_url: string | null;
}

interface MyPlan {
  id: string;
  title: string;
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
    case 'practice_group':
    default:
      return 'Group';
  }
}

// The prep-pill noun is the persona's word for "a peer crew prepping for one
// dated event" — a sailor reads "Prep crew", a nursing student "Study group".
// Generic "Prep group" is the safe default for any other interest.
function prepLabel(interestSlug: string | null): { label: string; icon: string } {
  const slug = (interestSlug || '').toLowerCase();
  if (slug.includes('sail') || slug.includes('race') || slug.includes('peaks')) {
    return { label: 'Prep crew', icon: 'boat-outline' };
  }
  if (slug.includes('nurs') || slug.includes('nclex') || slug.includes('exam')) {
    return { label: 'Study group', icon: 'school-outline' };
  }
  if (slug.includes('run') || slug.includes('marathon')) {
    return { label: 'Training group', icon: 'walk-outline' };
  }
  return { label: 'Prep group', icon: 'flag-outline' };
}

function formatGoalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Coarse, human countdown for the anchor chip ("in ~6 mo" / "in 3 weeks" /
// "this week" / "today" / "passed"). Deliberately fuzzy — the exact date is
// already shown next to it; this is the at-a-glance "how far out".
function countdownLabel(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const days = Math.round((target - Date.now()) / 86_400_000);
  if (days < 0) return 'passed';
  if (days === 0) return 'today';
  if (days < 7) return days === 1 ? 'tomorrow' : `in ${days} days`;
  if (days < 31) {
    const w = Math.round(days / 7);
    return w <= 1 ? 'this week' : `in ${w} weeks`;
  }
  const months = Math.round(days / 30);
  if (months < 12) return `in ~${months} mo`;
  return `in ~${Math.round(months / 12)} yr`;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable per-user fallback tint when sailor_profiles has no avatar_color, so
// the roster never collapses to a wall of grey circles.
const ROSTER_TINTS = ['#FF9500', '#34C759', '#5856D6', '#FF2D55', '#30B0C7', '#C2410C'] as const;
function tintFor(userId: string, fallbackIndex: number): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return ROSTER_TINTS[(hash + fallbackIndex) % ROSTER_TINTS.length];
}

function buildInviteUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://better.at';
  return `${origin}/group/join/${token}`;
}

// Collapse the step status enum into the three states the shared timeline
// cares about: done (filled node), active (ringed node), and upcoming (hollow
// node). settled/completed both read as done.
type PrepState = 'done' | 'active' | 'upcoming';
function prepState(status: TimelineStepRecord['status']): PrepState {
  if (status === 'completed' || status === 'settled') return 'done';
  if (status === 'in_progress') return 'active';
  return 'upcoming';
}

// Humanize the step category for the timeline subtitle. 'general' carries no
// signal, so it reads as no subtitle rather than a meaningless "General".
function prettyCategory(category: string | null | undefined): string {
  const c = (category || '').trim();
  if (!c || c === 'general') return '';
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');
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
  const [countNonce, setCountNonce] = useState(0);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [addPeopleVisible, setAddPeopleVisible] = useState(false);
  const [addingPeople, setAddingPeople] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [myPlans, setMyPlans] = useState<MyPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [attachedPlan, setAttachedPlan] = useState<MyPlan | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editGoalDate, setEditGoalDate] = useState('');
  const [editGoalLabel, setEditGoalLabel] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [addStepVisible, setAddStepVisible] = useState(false);
  const [addStepTitle, setAddStepTitle] = useState('');
  const [addStepDescription, setAddStepDescription] = useState('');
  const [addingStep, setAddingStep] = useState(false);

  const { membership, refetch: refetchMembership } = useGroupViewerMembership(group?.id);
  const isMember = Boolean(membership?.isMember);
  const { data: roster = [] } = useAffinityGroupRoster(group?.id, isMember);
  const { data: planSteps = [], isLoading: planStepsLoading } = useGroupPlanSteps(
    group?.blueprint_id,
    isMember,
  );

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
    // Force the member-count effect to re-run: add/leave doesn't flip
    // membership.isMember, so its deps wouldn't otherwise change.
    setCountNonce((n) => n + 1);
  }, [refetchMembership, queryClient, group?.id]);

  const runJoin = useCallback(async () => {
    if (!authUser?.id || !group?.id || joining) return;
    setJoining(true);
    try {
      await AffinityGroupService.join({ groupId: group.id, userId: authUser.id });
      // Self-join inserts the membership row directly (not via the add RPC),
      // so seed this joiner from the group's plan to match added members.
      await AffinityGroupService.seedFromBlueprint({ groupId: group.id, userId: authUser.id });
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

  // Any active member can bring people in (peer model — there's no
  // owner/leader gate, matching the add_affinity_group_member RPC). The
  // picker returns the full desired set; we only act on platform users
  // (external invites have no account to add) and skip the viewer.
  const handleAddPeople = useCallback(
    (selections: StepCollaborator[]) => {
      setAddPeopleVisible(false);
      if (!group?.id || addingPeople) return;
      const userIds = selections
        .filter((s) => s.type === 'platform' && s.user_id && s.user_id !== authUser?.id)
        .map((s) => s.user_id as string);
      if (userIds.length === 0) return;
      setAddingPeople(true);
      void (async () => {
        try {
          await Promise.all(
            userIds.map((userId) =>
              AffinityGroupService.addMember({ groupId: group.id, userId }),
            ),
          );
          invalidateMembership();
          toast.show(
            userIds.length === 1 ? 'Added to the group' : `Added ${userIds.length} people`,
            'success',
          );
        } catch (err) {
          toast.show((err as Error)?.message || 'Could not add people', 'error');
        } finally {
          setAddingPeople(false);
        }
      })();
    },
    [group?.id, addingPeople, authUser?.id, invalidateMembership, toast],
  );

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
          .select('id, kind, name, short_name, description, interest_slug, parent_org_id, blueprint_id, goal_at, goal_label, affiliations, whatsapp_invite_url')
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
  }, [group?.id, membership?.isMember, countNonce]);

  // Resolve the attached plan's title for the About card. getBlueprintById
  // works for any published blueprint (and the owner's drafts), so this
  // resolves for members once a plan is attached.
  useEffect(() => {
    let cancelled = false;
    if (!group?.blueprint_id) {
      setAttachedPlan(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const bp = await getBlueprintById(group.blueprint_id as string);
      if (!cancelled) {
        setAttachedPlan(bp ? { id: bp.id, title: bp.title } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.blueprint_id]);

  // Open the attach sheet and load the viewer's own plans to pick from.
  const openAttach = useCallback(() => {
    if (!authUser?.id) return;
    setAttachVisible(true);
    setLoadingPlans(true);
    void (async () => {
      try {
        const plans = await getUserBlueprints(authUser.id);
        setMyPlans(plans.map((p) => ({ id: p.id, title: p.title })));
      } catch {
        setMyPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [authUser?.id]);

  const handleAttach = useCallback(
    (blueprintId: string) => {
      if (!group?.id || attaching) return;
      setAttaching(true);
      void (async () => {
        try {
          await AffinityGroupService.attachBlueprint({ groupId: group.id, blueprintId });
          setAttachVisible(false);
          setGroup((prev) => (prev ? { ...prev, blueprint_id: blueprintId } : prev));
          invalidateMembership();
          toast.show('Plan attached — members get the first steps', 'success');
        } catch (err) {
          toast.show((err as Error)?.message || 'Could not attach plan', 'error');
        } finally {
          setAttaching(false);
        }
      })();
    },
    [group?.id, attaching, invalidateMembership, toast],
  );

  // Append a step to the shared plan. Any member can add (peer model); the
  // RPC writes it as the plan author's step so every member reads it back.
  const handleAddStep = useCallback(() => {
    if (!group?.id || addingStep) return;
    const title = addStepTitle.trim();
    if (title.length < 2) {
      toast.show('Give the step a title of at least 2 characters', 'error');
      return;
    }
    setAddingStep(true);
    void (async () => {
      try {
        await AffinityGroupService.addPlanStep({
          groupId: group.id,
          title,
          description: addStepDescription,
        });
        setAddStepVisible(false);
        setAddStepTitle('');
        setAddStepDescription('');
        queryClient.invalidateQueries({ queryKey: ['group-plan-steps', group.blueprint_id] });
        toast.show('Step added to the shared plan', 'success');
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not add the step', 'error');
      } finally {
        setAddingStep(false);
      }
    })();
  }, [
    group?.id,
    group?.blueprint_id,
    addingStep,
    addStepTitle,
    addStepDescription,
    queryClient,
    toast,
  ]);

  // Invite by link: ensure the token, build the URL, then share (native) or
  // copy (web). The link IS the access grant — private + unlisted, no queue.
  const handleInvite = useCallback(() => {
    if (!group?.id || inviteBusy) return;
    setInviteBusy(true);
    void (async () => {
      try {
        const token = await AffinityGroupService.ensureInviteToken(group.id);
        const url = buildInviteUrl(token);
        const message = `Join “${group.name}” on BetterAt: ${url}`;
        if (Platform.OS === 'web') {
          await Clipboard.setStringAsync(url);
          toast.show('Invite link copied — paste it anywhere', 'success');
        } else {
          await Share.share({ message });
        }
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not create an invite link', 'error');
      } finally {
        setInviteBusy(false);
      }
    })();
  }, [group?.id, group?.name, inviteBusy, toast]);

  // Seed the editor from the current values and open it.
  const openEdit = useCallback(() => {
    if (!group) return;
    setEditGoalDate(group.goal_at ? group.goal_at.slice(0, 10) : '');
    setEditGoalLabel(group.goal_label ?? '');
    setEditTags((group.affiliations ?? []).map((a) => a.label).filter(Boolean));
    setEditWhatsapp(group.whatsapp_invite_url ?? '');
    setEditVisible(true);
  }, [group]);

  const handleSaveMeta = useCallback(() => {
    if (!group?.id || savingMeta) return;
    const trimmedDate = editGoalDate.trim();
    let goalAt: string | null = null;
    if (trimmedDate) {
      // Anchor at local noon, not the bare-date UTC-midnight `new Date()` gives:
      // formatGoalDate renders in local time, so UTC midnight drifts a day back
      // in behind-UTC zones. Noon keeps the calendar date stable across zones.
      const parsed = new Date(`${trimmedDate}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        toast.show('Enter the date as YYYY-MM-DD', 'error');
        return;
      }
      goalAt = parsed.toISOString();
    }
    const affiliations: AffinityGroupAffiliation[] = editTags
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => ({ label }));
    setSavingMeta(true);
    void (async () => {
      try {
        // '' clears the link, a value sets it (validated server-side).
        const whatsappUrl = editWhatsapp.trim();
        await AffinityGroupService.setMeta({
          groupId: group.id,
          goalAt,
          goalLabel: editGoalLabel.trim() || (goalAt ? 'Goal day' : null),
          affiliations,
          whatsappUrl,
        });
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                goal_at: goalAt,
                goal_label: editGoalLabel.trim() || (goalAt ? 'Goal day' : prev.goal_label),
                affiliations,
                whatsapp_invite_url: whatsappUrl || null,
              }
            : prev,
        );
        setEditVisible(false);
        toast.show('Group updated', 'success');
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not save changes', 'error');
      } finally {
        setSavingMeta(false);
      }
    })();
  }, [group?.id, savingMeta, editGoalDate, editGoalLabel, editTags, editWhatsapp, toast]);

  // Link-out to the group's WhatsApp chat — BetterAt owns the prep plan, the
  // real conversation stays in WhatsApp. Works on web and native via Linking.
  const handleOpenWhatsapp = useCallback(() => {
    const url = group?.whatsapp_invite_url;
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      toast.show('Could not open WhatsApp', 'error');
    });
  }, [group?.whatsapp_invite_url, toast]);

  const accent = group ? kindAccent(group.kind) : { base: C.muted, ink: C.ink };
  const prep = group ? prepLabel(group.interest_slug) : { label: 'Group', icon: 'people-outline' };
  const affiliations = group?.affiliations ?? [];
  const rosterShown = roster.slice(0, 5);
  const rosterExtra = Math.max(0, roster.length - rosterShown.length);

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
            <View style={styles.hero}>
              <View style={styles.heroTopRow}>
                <View style={[styles.prepPill, { backgroundColor: `${accent.base}1A` }]}>
                  <Ionicons name={prep.icon as never} size={12} color={accent.ink} />
                  <Text style={[styles.prepPillText, { color: accent.ink }]}>{prep.label}</Text>
                </View>
                {isMember ? (
                  <Pressable onPress={openEdit} hitSlop={8} style={styles.editLink}>
                    <Ionicons name="create-outline" size={15} color={accent.base} />
                    <Text style={[styles.editLinkText, { color: accent.base }]}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.heroTitle}>{group.name}</Text>

              {group.goal_at ? (
                <View style={[styles.anchor, { backgroundColor: `${accent.base}14` }]}>
                  <Ionicons name="flag" size={18} color={accent.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.anchorMain, { color: accent.ink }]}>
                      {(group.goal_label || 'Goal day')} · {formatGoalDate(group.goal_at)}
                    </Text>
                    <Text style={styles.anchorSub}>Everything in here builds toward this</Text>
                  </View>
                  <Text style={[styles.anchorCount, { color: accent.ink }]}>
                    {countdownLabel(group.goal_at)}
                  </Text>
                </View>
              ) : isMember ? (
                <Pressable
                  onPress={openEdit}
                  style={[styles.anchor, styles.anchorEmpty]}
                >
                  <Ionicons name="flag-outline" size={18} color={C.muted} />
                  <Text style={styles.anchorEmptyText}>
                    Set the goal — the one dated event this group builds toward
                  </Text>
                </Pressable>
              ) : null}

              {affiliations.length > 0 ? (
                <View style={styles.tags}>
                  {affiliations.map((a, i) => (
                    <View key={`${a.label}-${i}`} style={styles.tag}>
                      {a.icon ? (
                        <Ionicons name={a.icon as never} size={12} color={C.muted} />
                      ) : null}
                      <Text style={styles.tagText}>{a.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {isMember && rosterShown.length > 0 ? (
                <View style={styles.roster}>
                  {rosterShown.map((m, i) => (
                    <View
                      key={m.userId}
                      style={[
                        styles.av,
                        { backgroundColor: m.avatarColor || tintFor(m.userId, i), marginLeft: i === 0 ? 0 : -8 },
                      ]}
                    >
                      <Text style={styles.avText}>{initialsFor(m.name)}</Text>
                    </View>
                  ))}
                  {rosterExtra > 0 ? (
                    <View style={[styles.av, styles.avExtra, { marginLeft: -8 }]}>
                      <Text style={styles.avText}>+{rosterExtra}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.rosterWho}>
                    {roster.length} {roster.length === 1 ? 'of us' : 'of us'}{' '}
                    {prep.label === 'Study group' ? 'studying this' : 'on this'}
                  </Text>
                </View>
              ) : null}

              {(orgName || group.interest_slug) && !isMember ? (
                <View style={styles.metaRow}>
                  {orgName ? (
                    <Text style={styles.metaText} numberOfLines={1}>
                      {orgName}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              {membership?.isMember ? (
                <>
                  <RelationshipButton
                    label="Add people"
                    icon="person-add-outline"
                    fullWidth={false}
                    loading={addingPeople}
                    onPress={() => setAddPeopleVisible(true)}
                  />
                  <RelationshipButton
                    label={group.blueprint_id ? 'Change plan' : 'Attach a plan'}
                    icon="map-outline"
                    secondary
                    fullWidth={false}
                    loading={attaching}
                    onPress={openAttach}
                  />
                  {/* Leaders/coaches manage the roster elsewhere; only plain
                      members self-leave from here. */}
                  {membership.role === 'member' ? (
                    <RelationshipButton
                      label="Leave"
                      icon="exit-outline"
                      secondary
                      fullWidth={false}
                      loading={leaving}
                      onPress={handleLeavePress}
                    />
                  ) : null}
                </>
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

            {isMember ? (
              <Pressable
                style={[styles.invite, { backgroundColor: accent.base }, inviteBusy && { opacity: 0.6 }]}
                disabled={inviteBusy}
                onPress={handleInvite}
              >
                {inviteBusy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="link" size={17} color="#FFFFFF" />
                    <Text style={styles.inviteText}>Invite by link</Text>
                  </>
                )}
              </Pressable>
            ) : null}

            {isMember && group.whatsapp_invite_url ? (
              <Pressable style={styles.whatsapp} onPress={handleOpenWhatsapp}>
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.whatsappText}>Open group chat in WhatsApp</Text>
              </Pressable>
            ) : null}

            {group.description ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.body}>{group.description}</Text>
              </View>
            ) : null}

            {isMember && group.blueprint_id ? (
              <View style={styles.planSection}>
                <Pressable
                  style={styles.planHeader}
                  disabled={!attachedPlan}
                  onPress={() =>
                    attachedPlan &&
                    router.push(`/library/blueprints/${attachedPlan.id}` as never)
                  }
                >
                  <View style={[styles.planIcon, { backgroundColor: accent.base }]}>
                    <Ionicons name="map" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.planText}>
                    <Text style={styles.planEyebrow}>Shared prep</Text>
                    <Text style={styles.planTitle} numberOfLines={2}>
                      {attachedPlan?.title ?? 'Group plan'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </Pressable>

                {planStepsLoading ? (
                  <View style={styles.planLoading}>
                    <ActivityIndicator color={accent.base} />
                  </View>
                ) : planSteps.length > 0 ? (
                  <View style={styles.timeline}>
                    {planSteps.map((step, i) => {
                      const st = prepState(step.status);
                      const showLine = i < planSteps.length - 1 || Boolean(group.goal_at);
                      const category = prettyCategory(step.category);
                      return (
                        <View key={step.id} style={styles.tlRow}>
                          <View style={styles.tlRail}>
                            <View
                              style={[
                                styles.tlNode,
                                st === 'done'
                                  ? { backgroundColor: accent.base, borderColor: accent.base }
                                  : st === 'active'
                                    ? { backgroundColor: '#FFFFFF', borderColor: accent.base }
                                    : { backgroundColor: '#FFFFFF', borderColor: C.line },
                              ]}
                            >
                              {st === 'done' ? (
                                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                              ) : null}
                            </View>
                            {showLine ? <View style={styles.tlLine} /> : null}
                          </View>
                          <View style={styles.tlBody}>
                            <Text
                              style={[styles.tlTitle, st === 'done' && styles.tlTitleDone]}
                              numberOfLines={2}
                            >
                              {step.title || 'Untitled step'}
                            </Text>
                            {category ? <Text style={styles.tlSub}>{category}</Text> : null}
                          </View>
                          {st === 'active' ? (
                            <Text style={[styles.tlTag, { color: accent.ink, backgroundColor: `${accent.base}1A` }]}>
                              In progress
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}

                    {group.goal_at ? (
                      <View style={styles.tlRow}>
                        <View style={styles.tlRail}>
                          <View style={[styles.tlNode, styles.tlAnchorNode, { backgroundColor: accent.base, borderColor: accent.base }]}>
                            <Ionicons name="flag" size={11} color="#FFFFFF" />
                          </View>
                        </View>
                        <View style={styles.tlBody}>
                          <Text style={[styles.tlAnchorTitle, { color: accent.ink }]}>
                            {(group.goal_label || 'Goal day')} · {formatGoalDate(group.goal_at)}
                          </Text>
                          <Text style={styles.tlSub}>Everything above converges here</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.planEmpty}>This plan has no steps yet.</Text>
                )}

                {!planStepsLoading ? (
                  <Pressable
                    style={styles.addStepRow}
                    onPress={() => setAddStepVisible(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={accent.base} />
                    <Text style={[styles.addStepText, { color: accent.base }]}>
                      Add a prep step
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : isMember ? (
              <Pressable style={styles.planEmptyCard} onPress={openAttach}>
                <Ionicons name="map-outline" size={20} color={accent.base} />
                <Text style={styles.planEmptyCardText}>
                  Attach a shared plan — the prep steps everyone works toward together.
                </Text>
              </Pressable>
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

      <AddPeoplePicker
        visible={addPeopleVisible}
        existingUserIds={[]}
        onClose={() => setAddPeopleVisible(false)}
        onConfirm={handleAddPeople}
      />

      <Modal
        visible={attachVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAttachVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAttachVisible(false)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Attach a plan</Text>
              <View style={{ minWidth: 56 }} />
            </View>
            <Text style={styles.modalSub}>
              Pick one of your plans. Everyone in the group gets subscribed and starts with
              the first step (and any dated steps); they pull the rest themselves.
            </Text>
            {loadingPlans ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={accent.base} />
              </View>
            ) : myPlans.length === 0 ? (
              <Text style={styles.modalEmpty}>
                You don’t have any plans yet. Build one with “Get inspired” in your Library,
                then attach it here.
              </Text>
            ) : (
              <ScrollView style={styles.modalList}>
                {myPlans.map((plan) => {
                  const isCurrent = plan.id === group?.blueprint_id;
                  return (
                    <Pressable
                      key={plan.id}
                      style={styles.planRow}
                      disabled={attaching || isCurrent}
                      onPress={() => handleAttach(plan.id)}
                    >
                      <Ionicons
                        name={isCurrent ? 'checkmark-circle' : 'map-outline'}
                        size={20}
                        color={isCurrent ? C.green : accent.base}
                      />
                      <Text style={styles.planRowText} numberOfLines={2}>
                        {plan.title}
                      </Text>
                      {isCurrent ? (
                        <Text style={styles.planRowTag}>Attached</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEditVisible(false)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Edit group</Text>
              <Pressable onPress={handleSaveMeta} hitSlop={8} disabled={savingMeta}>
                <Text style={[styles.modalSave, savingMeta && { opacity: 0.5 }]}>Save</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.editBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.editLabel}>The goal</Text>
              <Text style={styles.editHint}>
                The one dated event this group builds toward.
              </Text>
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editGoalLabel}
                  onChangeText={setEditGoalLabel}
                  placeholder="Race day"
                  placeholderTextColor={C.muted}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editGoalDate}
                  onChangeText={setEditGoalDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                />
              </View>

              <Text style={[styles.editLabel, { marginTop: 20 }]}>Affiliation tags</Text>
              <Text style={styles.editHint}>
                Informational context — “Mostly RHKYC”. The group is owned by no club or org.
              </Text>
              {editTags.map((tag, i) => (
                <View key={`tag-${i}`} style={styles.editRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={tag}
                    onChangeText={(t) =>
                      setEditTags((prev) => prev.map((p, idx) => (idx === i ? t : p)))
                    }
                    placeholder="Mostly RHKYC"
                    placeholderTextColor={C.muted}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => setEditTags((prev) => prev.filter((_, idx) => idx !== i))}
                    style={styles.tagRemove}
                  >
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.addTagRow}
                onPress={() => setEditTags((prev) => [...prev, ''])}
              >
                <Ionicons name="add-circle-outline" size={18} color={accent.base} />
                <Text style={[styles.addTagText, { color: accent.base }]}>Add a tag</Text>
              </Pressable>

              <Text style={[styles.editLabel, { marginTop: 20 }]}>WhatsApp group chat</Text>
              <Text style={styles.editHint}>
                Paste the group’s WhatsApp invite link — the chat stays in WhatsApp,
                BetterAt just opens it. In WhatsApp: Group info → Invite via link.
              </Text>
              <TextInput
                style={styles.input}
                value={editWhatsapp}
                onChangeText={setEditWhatsapp}
                placeholder="https://chat.whatsapp.com/…"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={Platform.OS === 'web' ? 'default' : 'url'}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addStepVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddStepVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAddStepVisible(false)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Add a prep step</Text>
              <Pressable onPress={handleAddStep} hitSlop={8} disabled={addingStep}>
                <Text style={[styles.modalSave, addingStep && { opacity: 0.5 }]}>Add</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.editBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.editLabel}>Step</Text>
              <Text style={styles.editHint}>
                A prep step everyone in the group works toward together.
              </Text>
              <TextInput
                style={styles.input}
                value={addStepTitle}
                onChangeText={setAddStepTitle}
                placeholder="Tune the rig for heavy air"
                placeholderTextColor={C.muted}
                autoFocus
              />
              <Text style={[styles.editLabel, { marginTop: 20 }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={addStepDescription}
                onChangeText={setAddStepDescription}
                placeholder="What does “done” look like?"
                placeholderTextColor={C.muted}
                multiline
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, gap: 16 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { color: C.muted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  hero: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 12,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  prepPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editLinkText: { fontSize: 14, fontWeight: '600' },
  heroTitle: { color: C.ink, fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  anchorMain: { fontSize: 14, fontWeight: '700' },
  anchorSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  anchorCount: {
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  anchorEmpty: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  anchorEmptyText: { flex: 1, fontSize: 13, color: C.muted, fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.bg,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: '#555' },
  roster: { flexDirection: 'row', alignItems: 'center' },
  av: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  avExtra: { backgroundColor: C.muted },
  rosterWho: { marginLeft: 10, fontSize: 13, color: C.muted, fontWeight: '600' },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
  },
  inviteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
    backgroundColor: '#25D366',
  },
  whatsappText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  actionRow: { paddingBottom: 0, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  planSection: {
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 6,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planLoading: { paddingVertical: 24, alignItems: 'center' },
  planEmpty: { color: C.muted, fontSize: 14, paddingTop: 8, paddingLeft: 52 },
  timeline: { marginTop: 8 },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tlRail: { width: 18, alignItems: 'center' },
  tlNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlAnchorNode: { width: 22, height: 22, borderRadius: 11, marginTop: -1 },
  tlLine: { flex: 1, width: 2, minHeight: 18, backgroundColor: C.line, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlTitle: { color: C.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  tlTitleDone: { color: C.muted, textDecorationLine: 'line-through' },
  tlSub: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  tlAnchorTitle: { fontSize: 15, fontWeight: '800' },
  tlTag: {
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  planEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: 'dashed',
    padding: 16,
  },
  planEmptyCardText: { flex: 1, color: C.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planText: { flex: 1, gap: 2 },
  planEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.muted,
  },
  planTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  modalCancel: { fontSize: 16, color: '#007AFF', minWidth: 56 },
  modalSave: { fontSize: 16, fontWeight: '700', color: '#007AFF', minWidth: 56, textAlign: 'right' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  editBody: { paddingHorizontal: 16, paddingTop: 16 },
  editLabel: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  editHint: { fontSize: 13, lineHeight: 18, color: C.muted, marginBottom: 10 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: C.ink,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  tagRemove: { padding: 2 },
  addTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addTagText: { fontSize: 14, fontWeight: '600' },
  addStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  addStepText: { fontSize: 14, fontWeight: '700' },
  modalSub: {
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modalLoading: { paddingVertical: 40, alignItems: 'center' },
  modalEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    padding: 16,
  },
  modalList: { paddingHorizontal: 8 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  planRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.ink },
  planRowTag: { fontSize: 12, fontWeight: '700', color: C.green },
});
