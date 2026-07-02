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
  type AffinityGroupMemberRole,
  type AffinityGroupRosterEntry,
} from '@/services/AffinityGroupService';
import type { AffinityGroupKind } from '@/hooks/useUserAffinityGroups';
import { useAffinityGroupRoster } from '@/hooks/useAffinityGroupRoster';
import { useGroupPlanSteps } from '@/hooks/useGroupPlanSteps';
import { AddPeoplePicker } from '@/components/step/plan-tab/AddPeoplePicker';
import type { StepCollaborator } from '@/types/step-detail';
import {
  getAuthoredStudioBlueprints,
  getStudioBlueprintById,
} from '@/services/StudioBlueprintService';
import { telegramBotDeepLink } from '@/hooks/useTelegramLink';

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
  created_by: string | null;
  blueprint_id: string | null;
  goal_at: string | null;
  goal_label: string | null;
  affiliations: AffinityGroupAffiliation[] | null;
  whatsapp_invite_url: string | null;
  telegram_invite_url: string | null;
  telegram_bot_chat_id: number | null;
  telegram_bot_chat_title: string | null;
  telegram_bot_connected_at: string | null;
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

function withHttps(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function extractWhatsappGroupCode(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  try {
    const url = new URL(withHttps(trimmed));
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'chat.whatsapp.com') {
      return url.pathname.split('/').filter(Boolean)[0] ?? null;
    }
    if (host === 'web.whatsapp.com' && url.pathname === '/accept') {
      return url.searchParams.get('code')?.trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeWhatsappGroupInviteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const code = extractWhatsappGroupCode(trimmed);
  return code ? `https://chat.whatsapp.com/${code}` : trimmed;
}

function whatsappGroupOpenUrl(value: string): string {
  const code = extractWhatsappGroupCode(value);
  if (code && Platform.OS === 'web') {
    return `https://web.whatsapp.com/accept?code=${encodeURIComponent(code)}`;
  }
  return normalizeWhatsappGroupInviteUrl(value);
}

function normalizeTelegramGroupInviteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return `https://t.me/${trimmed.slice(1)}`;
  try {
    const url = new URL(withHttps(trimmed));
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 't.me' || host === 'telegram.me') return url.toString();
  } catch {
    // Fall through so Supabase validation returns the user-facing error.
  }
  return trimmed;
}

function telegramShareUrl(text: string, url?: string): string {
  const params = new URLSearchParams();
  if (url) params.set('url', url);
  params.set('text', text);
  return `https://t.me/share/url?${params.toString()}`;
}

async function openWhatsappShare(text: string): Promise<void> {
  const encoded = encodeURIComponent(text);
  if (Platform.OS === 'web') {
    await Linking.openURL(`https://web.whatsapp.com/send?text=${encoded}`);
    return;
  }
  const appUrl = `whatsapp://send?text=${encoded}`;
  const canOpenApp = await Linking.canOpenURL(appUrl).catch(() => false);
  await Linking.openURL(canOpenApp ? appUrl : `https://wa.me/?text=${encoded}`);
}

// Collapse the step status enum into the three states the shared timeline
// cares about: done (filled node), active (ringed node), and upcoming (hollow
// node). settled/completed both read as done.
type PrepState = 'done' | 'active' | 'upcoming';
function prepState(status: string | null | undefined): PrepState {
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

function memberRoleLabel(role: AffinityGroupMemberRole): string {
  switch (role) {
    case 'coach':
    case 'leader':
      return 'Admin';
    case 'member':
    default:
      return 'Member';
  }
}

function isGroupAdminRole(role: AffinityGroupMemberRole | null | undefined): boolean {
  switch (role) {
    case 'coach':
    case 'leader':
      return true;
    case 'member':
    default:
      return false;
  }
}

const MANAGEABLE_MEMBER_ROLES: AffinityGroupMemberRole[] = ['member', 'leader'];

function memberRoleActionLabel(role: AffinityGroupMemberRole): string {
  switch (role) {
    case 'leader':
    case 'coach':
      return 'Admin';
    case 'member':
    default:
      return 'Member';
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
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addPeopleVisible, setAddPeopleVisible] = useState(false);
  const [addingPeople, setAddingPeople] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [resettingPlan, setResettingPlan] = useState(false);
  const [myPlans, setMyPlans] = useState<MyPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [attachedPlan, setAttachedPlan] = useState<MyPlan | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editGoalDate, setEditGoalDate] = useState('');
  const [editGoalLabel, setEditGoalLabel] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editTelegram, setEditTelegram] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [addStepVisible, setAddStepVisible] = useState(false);
  const [addStepTitle, setAddStepTitle] = useState('');
  const [addStepDescription, setAddStepDescription] = useState('');
  const [addingStep, setAddingStep] = useState(false);
  // null = the compose modal is in "add" mode; a step id = editing that step.
  const [editStepId, setEditStepId] = useState<string | null>(null);
  // Reorder mode swaps the timeline rows from tap-to-edit to up/down controls.
  const [reorderMode, setReorderMode] = useState(false);
  const [memberActionTarget, setMemberActionTarget] = useState<AffinityGroupRosterEntry | null>(null);
  const [memberUpdating, setMemberUpdating] = useState(false);

  const { membership, refetch: refetchMembership } = useGroupViewerMembership(group?.id);
  const isMember = Boolean(membership?.isMember);
  const { data: roster = [] } = useAffinityGroupRoster(group?.id, isMember);
  const { data: planSteps = [], isLoading: planStepsLoading } = useGroupPlanSteps(
    group?.id,
    isMember,
  );
  const isSelfServeGroup = Boolean(
    group && ['crew_pod', 'practice_group'].includes(group.kind),
  );
  const canManageGroup = Boolean(
    membership?.isMember &&
      isSelfServeGroup &&
      (isGroupAdminRole(membership.role) || group?.created_by === authUser?.id),
  );
  const canManageMembers = canManageGroup;
  const canDeleteGroup = canManageMembers;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/atlas' as never);
  }, []);

  // Membership changes ripple to: the viewer's own group list (Atlas
  // sub-chips), this group's membership query, the roster, and Atlas search's
  // per-group "Member" tag.
  const invalidateMembership = useCallback(() => {
    refetchMembership();
    queryClient.invalidateQueries({ queryKey: ['user-affinity-groups'] });
    queryClient.invalidateQueries({ queryKey: ['group-viewer-membership', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['affinity-group-roster', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['atlas-search'] });
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

  // Group admins can bring people in. The picker returns the full desired
  // set; we only act on platform users (external invites have no account to
  // add) and skip the viewer.
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

  const runDelete = useCallback(async () => {
    if (!group?.id || deleting) return;
    setDeleting(true);
    try {
      await AffinityGroupService.deleteSelfServeGroup(group.id);
      queryClient.invalidateQueries({ queryKey: ['user-affinity-groups'] });
      queryClient.invalidateQueries({ queryKey: ['discoverable-affinity-groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-viewer-membership', group.id] });
      queryClient.invalidateQueries({ queryKey: ['affinity-group-roster', group.id] });
      queryClient.invalidateQueries({ queryKey: ['atlas-search'] });
      toast.show('Group deleted', 'success');
      router.replace('/(tabs)/library?zone=groups' as never);
    } catch (err) {
      toast.show((err as Error)?.message || 'Could not delete this group', 'error');
    } finally {
      setDeleting(false);
    }
  }, [group?.id, deleting, queryClient, toast]);

  const handleDeletePress = useCallback(() => {
    if (!group?.name) return;
    setEditVisible(false);
    showConfirm(
      `Delete ${group.name}?`,
      'This removes the group for everyone. The shared blueprint itself is not deleted.',
      () => void runDelete(),
      { destructive: true, confirmText: 'Delete' },
    );
  }, [group?.name, runDelete]);

  const runResetPlan = useCallback(async () => {
    if (!group?.id || resettingPlan) return;
    setResettingPlan(true);
    try {
      await AffinityGroupService.resetMyGroupPlan(group.id);
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
      queryClient.invalidateQueries({ queryKey: ['group-plan-steps', group.id] });
      toast.show('Your timeline has been reset to the group blueprint order', 'success');
    } catch (err) {
      toast.show((err as Error)?.message || 'Could not reset your timeline', 'error');
    } finally {
      setResettingPlan(false);
    }
  }, [group?.id, resettingPlan, queryClient, toast]);

  const handleResetPlanPress = useCallback(() => {
    showConfirm(
      'Reset your timeline from this blueprint?',
      'This rebuilds your personal timeline from the group blueprint, puts the steps before race day, and resets them to planned. Notes stay attached.',
      () => void runResetPlan(),
      { destructive: true, confirmText: 'Reset' },
    );
  }, [runResetPlan]);

  const handleSetMemberRole = useCallback(
    async (role: AffinityGroupMemberRole) => {
      if (!group?.id || !memberActionTarget || memberUpdating || !canManageMembers) return;
      setMemberUpdating(true);
      try {
        await AffinityGroupService.updateMemberRole({
          groupId: group.id,
          userId: memberActionTarget.userId,
          role,
        });
        invalidateMembership();
        setMemberActionTarget((prev) => (prev ? { ...prev, role } : prev));
        toast.show(`${memberActionTarget.name} is now ${memberRoleLabel(role).toLowerCase()}`, 'success');
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not update this member', 'error');
      } finally {
        setMemberUpdating(false);
      }
    },
    [group?.id, memberActionTarget, memberUpdating, canManageMembers, invalidateMembership, toast],
  );

  const runRemoveMember = useCallback(async () => {
    if (!group?.id || !memberActionTarget || memberUpdating || !canManageMembers) return;
    setMemberUpdating(true);
    try {
      await AffinityGroupService.removeMember({
        groupId: group.id,
        userId: memberActionTarget.userId,
      });
      invalidateMembership();
      toast.show(`${memberActionTarget.name} removed`, 'success');
      setMemberActionTarget(null);
    } catch (err) {
      toast.show((err as Error)?.message || 'Could not remove this member', 'error');
    } finally {
      setMemberUpdating(false);
    }
  }, [group?.id, memberActionTarget, memberUpdating, canManageMembers, invalidateMembership, toast]);

  const handleRemoveMemberPress = useCallback(() => {
    if (!memberActionTarget) return;
    showConfirm(
      `Remove ${memberActionTarget.name}?`,
      'They will lose access to this group. You can add them again later.',
      () => void runRemoveMember(),
      { destructive: true, confirmText: 'Remove' },
    );
  }, [memberActionTarget, runRemoveMember]);

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
          .select('id, kind, name, short_name, description, interest_slug, parent_org_id, created_by, blueprint_id, goal_at, goal_label, affiliations, whatsapp_invite_url, telegram_invite_url, telegram_bot_chat_id, telegram_bot_chat_title, telegram_bot_connected_at')
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

  // Resolve the attached blueprint's title for the shared blueprint card.
  useEffect(() => {
    let cancelled = false;
    if (!group?.blueprint_id) {
      setAttachedPlan(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const bp = await getStudioBlueprintById(group.blueprint_id as string);
      if (!cancelled) {
        setAttachedPlan(bp ? { id: bp.id, title: bp.title } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.blueprint_id]);

  // Open the attach sheet and load the viewer's authored blueprints to pick from.
  const openAttach = useCallback(() => {
    if (!authUser?.id || !canManageGroup) return;
    setAttachVisible(true);
    setLoadingPlans(true);
    void (async () => {
      try {
        const plans = await getAuthoredStudioBlueprints(authUser.id);
        setMyPlans(plans);
      } catch {
        setMyPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [authUser?.id, canManageGroup]);

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
          toast.show('Blueprint attached — members get the first steps', 'success');
        } catch (err) {
          toast.show((err as Error)?.message || 'Could not attach blueprint', 'error');
        } finally {
          setAttaching(false);
        }
      })();
    },
    [group?.id, attaching, invalidateMembership, toast],
  );

  // Append a step to the shared plan. Group admins maintain the shared
  // blueprint; members work through or reset their own timeline copy.
  const openAddStep = useCallback(() => {
    if (!canManageGroup) return;
    setEditStepId(null);
    setAddStepTitle('');
    setAddStepDescription('');
    setAddStepVisible(true);
  }, [canManageGroup]);

  const openEditStep = useCallback((step: { id: string; title: string | null; description: string | null }) => {
    if (!canManageGroup) return;
    setEditStepId(step.id);
    setAddStepTitle(step.title ?? '');
    setAddStepDescription(step.description ?? '');
    setAddStepVisible(true);
  }, [canManageGroup]);

  const handleAddStep = useCallback(() => {
    if (!group?.id || addingStep || !canManageGroup) return;
    const title = addStepTitle.trim();
    if (title.length < 2) {
      toast.show('Give the step a title of at least 2 characters', 'error');
      return;
    }
    setAddingStep(true);
    void (async () => {
      try {
        if (editStepId) {
          await AffinityGroupService.updatePlanStep({
            groupId: group.id,
            stepId: editStepId,
            title,
            description: addStepDescription,
          });
        } else {
          await AffinityGroupService.addPlanStep({
            groupId: group.id,
            title,
            description: addStepDescription,
          });
        }
        setAddStepVisible(false);
        setEditStepId(null);
        setAddStepTitle('');
        setAddStepDescription('');
        queryClient.invalidateQueries({ queryKey: ['group-plan-steps', group.id] });
        toast.show(editStepId ? 'Step updated' : 'Step added to the group blueprint', 'success');
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not save the step', 'error');
      } finally {
        setAddingStep(false);
      }
    })();
  }, [
    group?.id,
    addingStep,
    editStepId,
    addStepTitle,
    addStepDescription,
    queryClient,
    toast,
    canManageGroup,
  ]);

  const handleRemoveStep = useCallback(() => {
    if (!group?.id || !editStepId || !canManageGroup) return;
    const stepId = editStepId;
    // Close the compose modal before confirming: on web the confirm dialog
    // would otherwise render behind the still-open RN Modal (invisible and
    // unclickable). We keep stepId in a local so the async still has it.
    setAddStepVisible(false);
    setEditStepId(null);
    setAddStepTitle('');
    setAddStepDescription('');
    showConfirm(
      'Remove step',
      'Remove this step from the group blueprint for everyone in the group?',
      () => {
        void (async () => {
          try {
            await AffinityGroupService.removePlanStep({ groupId: group.id, stepId });
            queryClient.invalidateQueries({ queryKey: ['group-plan-steps', group.id] });
            toast.show('Step removed', 'success');
          } catch (err) {
            toast.show((err as Error)?.message || 'Could not remove the step', 'error');
          }
        })();
      },
      { destructive: true, confirmText: 'Remove' },
    );
  }, [group?.id, editStepId, canManageGroup, queryClient, toast]);

  // Move a step up/down in the shared plan. Optimistically reorders the cached
  // list, then persists the full new order via the member-gated RPC; on failure
  // we refetch to snap back to the server truth.
  const handleMoveStep = useCallback(
    (index: number, dir: -1 | 1) => {
      if (!group?.id || !group.blueprint_id || !canManageGroup) return;
      const target = index + dir;
      if (target < 0 || target >= planSteps.length) return;
      const reordered = [...planSteps];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      const key = ['group-plan-steps', group.id];
      queryClient.setQueryData(key, reordered);
      void (async () => {
        try {
          await AffinityGroupService.reorderPlanSteps({
            groupId: group.id,
            stepIds: reordered.map((s) => s.id),
          });
        } catch (err) {
          queryClient.invalidateQueries({ queryKey: key });
          toast.show((err as Error)?.message || 'Could not reorder', 'error');
        }
      })();
    },
    [group?.id, group?.blueprint_id, canManageGroup, planSteps, queryClient, toast],
  );

  // Invite by link: ensure the token, build the URL, then share (native) or
  // copy (web). The link IS the access grant — private + unlisted, no queue.
  const handleInvite = useCallback(() => {
    if (!group?.id || inviteBusy || !canManageGroup) return;
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
  }, [group?.id, group?.name, inviteBusy, canManageGroup, toast]);

  // Share the BetterAt invite link via WhatsApp. On web, go straight to
  // WhatsApp Web because wa.me often hands off to the desktop app and shows a
  // "Could not load" modal.
  const handleShareInviteWhatsapp = useCallback(() => {
    if (!group?.id || inviteBusy || !canManageGroup) return;
    setInviteBusy(true);
    void (async () => {
      try {
        const token = await AffinityGroupService.ensureInviteToken(group.id);
        const url = buildInviteUrl(token);
        const text = `Join “${group.name}” on BetterAt: ${url}`;
        await openWhatsappShare(text);
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not open WhatsApp', 'error');
      } finally {
        setInviteBusy(false);
      }
    })();
  }, [group?.id, group?.name, inviteBusy, canManageGroup, toast]);

  // Seed the editor from the current values and open it.
  const openEdit = useCallback(() => {
    if (!group || !canManageGroup) return;
    setEditGoalDate(group.goal_at ? group.goal_at.slice(0, 10) : '');
    setEditGoalLabel(group.goal_label ?? '');
    setEditTags((group.affiliations ?? []).map((a) => a.label).filter(Boolean));
    setEditWhatsapp(group.whatsapp_invite_url ?? '');
    setEditTelegram(group.telegram_invite_url ?? '');
    setEditVisible(true);
  }, [group, canManageGroup]);

  const handleSaveMeta = useCallback(() => {
    if (!group?.id || savingMeta || !canManageGroup) return;
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
        const whatsappUrl = normalizeWhatsappGroupInviteUrl(editWhatsapp);
        const telegramUrl = normalizeTelegramGroupInviteUrl(editTelegram);
        await AffinityGroupService.setMeta({
          groupId: group.id,
          goalAt,
          goalLabel: editGoalLabel.trim() || (goalAt ? 'Goal day' : null),
          affiliations,
          whatsappUrl,
          telegramUrl,
        });
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                goal_at: goalAt,
                goal_label: editGoalLabel.trim() || (goalAt ? 'Goal day' : prev.goal_label),
                affiliations,
                whatsapp_invite_url: whatsappUrl || null,
                telegram_invite_url: telegramUrl || null,
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
  }, [group?.id, savingMeta, canManageGroup, editGoalDate, editGoalLabel, editTags, editWhatsapp, editTelegram, toast]);

  // Link-out to the group's WhatsApp chat — BetterAt owns the prep plan, the
  // real conversation stays in WhatsApp. Works on web and native via Linking.
  const handleOpenWhatsapp = useCallback(() => {
    const url = group?.whatsapp_invite_url;
    if (!url) return;
    void Linking.openURL(whatsappGroupOpenUrl(url)).catch(() => {
      toast.show('Could not open WhatsApp', 'error');
    });
  }, [group?.whatsapp_invite_url, toast]);

  const handleOpenTelegram = useCallback(() => {
    const url = group?.telegram_invite_url;
    if (!url) return;
    void Linking.openURL(normalizeTelegramGroupInviteUrl(url)).catch(() => {
      toast.show('Could not open Telegram', 'error');
    });
  }, [group?.telegram_invite_url, toast]);

  const handleOpenTelegramBot = useCallback(() => {
    void Linking.openURL(telegramBotDeepLink()).catch(() => {
      toast.show('Could not open the Telegram bot', 'error');
    });
  }, [toast]);

  const handleShareInviteTelegram = useCallback(() => {
    if (!group?.id || inviteBusy || !canManageGroup) return;
    setInviteBusy(true);
    void (async () => {
      try {
        const token = await AffinityGroupService.ensureInviteToken(group.id);
        const url = buildInviteUrl(token);
        const text = `Join "${group.name}" on BetterAt`;
        await Linking.openURL(telegramShareUrl(text, url));
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not open Telegram', 'error');
      } finally {
        setInviteBusy(false);
      }
    })();
  }, [group?.id, group?.name, inviteBusy, canManageGroup, toast]);

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
                {canManageGroup ? (
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
              ) : canManageGroup ? (
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

              {group.description ? (
                <View style={styles.heroAbout}>
                  <Text style={styles.heroAboutLabel}>About</Text>
                  <Text style={styles.heroAboutText}>{group.description}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              {membership?.isMember ? (
                <>
                  {/* Admins manage the roster elsewhere; plain members
                      self-leave from here. */}
                  {!canManageGroup ? (
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

            {canManageGroup ? (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Invite people</Text>
                    <Text style={styles.sectionSub}>Bring people into this BetterAt group.</Text>
                  </View>
                </View>
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
                      <Text style={styles.inviteText}>Copy invite link</Text>
                    </>
                  )}
                </Pressable>
                <View style={styles.messagingGrid}>
                  <Pressable
                    style={[styles.messagingButton, styles.whatsappOutline, inviteBusy && { opacity: 0.6 }]}
                    disabled={inviteBusy}
                    onPress={handleShareInviteWhatsapp}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#128C3E" />
                    <Text style={styles.whatsappOutlineText}>Share via WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.messagingButton, styles.telegramOutline, inviteBusy && { opacity: 0.6 }]}
                    disabled={inviteBusy}
                    onPress={handleShareInviteTelegram}
                  >
                    <Ionicons name="paper-plane-outline" size={18} color="#1D8ACB" />
                    <Text style={styles.telegramOutlineText}>Share via Telegram</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isMember ? (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Group chats</Text>
                    <Text style={styles.sectionSub}>External chat rooms and personal bot access.</Text>
                  </View>
                  {canManageGroup ? (
                    <Pressable style={styles.headerLink} onPress={openEdit}>
                      <Ionicons name="settings-outline" size={14} color={accent.base} />
                      <Text style={[styles.headerLinkText, { color: accent.base }]}>Edit links</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.channelLabel}>External group chats</Text>
                <View style={styles.messagingGrid}>
                  {group.whatsapp_invite_url ? (
                    <Pressable style={[styles.messagingButton, styles.whatsappFilled]} onPress={handleOpenWhatsapp}>
                      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      <Text style={styles.messagingFilledText}>Open WhatsApp</Text>
                    </Pressable>
                  ) : canManageGroup ? (
                    <Pressable style={styles.messagingButton} onPress={openEdit}>
                      <Ionicons name="link-outline" size={18} color={C.muted} />
                      <Text style={styles.messagingMutedText}>Add WhatsApp link</Text>
                    </Pressable>
                  ) : null}
                  {group.telegram_invite_url ? (
                    <Pressable style={[styles.messagingButton, styles.telegramFilled]} onPress={handleOpenTelegram}>
                      <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                      <Text style={styles.messagingFilledText}>Open Telegram</Text>
                    </Pressable>
                  ) : canManageGroup ? (
                    <Pressable style={styles.messagingButton} onPress={openEdit}>
                      <Ionicons name="link-outline" size={18} color={C.muted} />
                      <Text style={styles.messagingMutedText}>Add Telegram link</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.channelLabel}>Personal assistant</Text>
                <Pressable style={styles.botRow} onPress={handleOpenTelegramBot}>
                  <Ionicons name="sparkles-outline" size={17} color={accent.base} />
                  <Text style={[styles.botRowText, { color: accent.base }]}>Open BetterAt bot on Telegram</Text>
                  <Text style={styles.botRowMeta}>1:1</Text>
                </Pressable>
              </View>
            ) : null}

            {isMember ? (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Members</Text>
                    <Text style={styles.sectionSub}>
                      {roster.length} {roster.length === 1 ? 'person' : 'people'} in this group.
                    </Text>
                  </View>
                  <View style={styles.memberHeaderActions}>
                    {canManageMembers ? (
                      <Pressable
                        style={styles.memberAddButton}
                        onPress={() => setAddPeopleVisible(true)}
                        disabled={addingPeople}
                      >
                        <Ionicons name="person-add-outline" size={15} color={accent.base} />
                        <Text style={[styles.memberAddText, { color: accent.base }]}>Add</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {roster.length > 0 ? (
                  <View style={styles.memberList}>
                    {roster.map((m, i) => (
                      <View key={m.userId} style={styles.memberRow}>
                        <View
                          style={[
                            styles.memberAvatar,
                            { backgroundColor: m.avatarColor || tintFor(m.userId, i) },
                          ]}
                        >
                          <Text style={styles.avText}>{initialsFor(m.name)}</Text>
                        </View>
                        <View style={styles.memberText}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text style={styles.memberRole}>{memberRoleLabel(m.role)}</Text>
                        </View>
                        {canManageMembers ? (
                          <Pressable
                            style={styles.memberManageButton}
                            onPress={() => setMemberActionTarget(m)}
                            hitSlop={8}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color={C.muted} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.body}>No members to show yet.</Text>
                )}
              </View>
            ) : null}

            {isMember && group.blueprint_id ? (
              <View style={styles.planSection}>
                <View style={styles.planHeader}>
                  <View style={[styles.planIcon, { backgroundColor: accent.base }]}>
                    <Ionicons name="map" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.planText}>
                    <Text style={styles.planEyebrow}>Group blueprint</Text>
                    <Text style={styles.planTitle} numberOfLines={2}>
                      {attachedPlan?.title ?? 'Group blueprint'}
                    </Text>
                  </View>
                </View>

                <View style={styles.planActionRow}>
                  {canManageGroup ? (
                    <Pressable
                      style={[styles.reorderToggle, attaching && { opacity: 0.5 }]}
                      onPress={openAttach}
                      disabled={attaching}
                    >
                      <Ionicons name="map-outline" size={14} color={accent.base} />
                      <Text style={[styles.reorderToggleText, { color: accent.base }]}>
                        Change blueprint
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.reorderToggle, resettingPlan && { opacity: 0.5 }]}
                    onPress={handleResetPlanPress}
                    disabled={resettingPlan}
                  >
                    {resettingPlan ? (
                      <ActivityIndicator size="small" color={accent.base} />
                    ) : (
                      <Ionicons name="refresh" size={14} color={accent.base} />
                    )}
                    <Text style={[styles.reorderToggleText, { color: accent.base }]}>
                      Reset my timeline
                    </Text>
                  </Pressable>

                  {canManageGroup && !planStepsLoading && planSteps.length > 1 ? (
                    <Pressable
                      style={styles.reorderToggle}
                      onPress={() => setReorderMode((v) => !v)}
                    >
                      <Ionicons
                        name={reorderMode ? 'checkmark' : 'swap-vertical'}
                        size={14}
                        color={accent.base}
                      />
                      <Text style={[styles.reorderToggleText, { color: accent.base }]}>
                        {reorderMode ? 'Done reordering' : 'Reorder'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

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
                        <Pressable
                          key={step.id}
                          style={styles.tlRow}
                          onPress={
                            canManageGroup && !reorderMode ? () => openEditStep(step) : undefined
                          }
                          disabled={!canManageGroup || reorderMode}
                        >
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
                          {reorderMode ? (
                            <View style={styles.tlMoveControls}>
                              <Pressable
                                style={styles.tlMoveBtn}
                                disabled={i === 0}
                                onPress={() => handleMoveStep(i, -1)}
                                hitSlop={6}
                              >
                                <Ionicons
                                  name="chevron-up"
                                  size={18}
                                  color={i === 0 ? C.line : accent.base}
                                />
                              </Pressable>
                              <Pressable
                                style={styles.tlMoveBtn}
                                disabled={i === planSteps.length - 1}
                                onPress={() => handleMoveStep(i, 1)}
                                hitSlop={6}
                              >
                                <Ionicons
                                  name="chevron-down"
                                  size={18}
                                  color={i === planSteps.length - 1 ? C.line : accent.base}
                                />
                              </Pressable>
                            </View>
                          ) : st === 'active' ? (
                            <Text style={[styles.tlTag, { color: accent.ink, backgroundColor: `${accent.base}1A` }]}>
                              In progress
                            </Text>
                          ) : canManageGroup ? (
                            <Ionicons name="pencil" size={14} color={C.muted} style={styles.tlEdit} />
                          ) : null}
                        </Pressable>
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

                {canManageGroup && !planStepsLoading ? (
                  <Pressable
                    style={styles.addStepRow}
                    onPress={openAddStep}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={accent.base} />
                    <Text style={[styles.addStepText, { color: accent.base }]}>
                      Add a prep step
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : canManageGroup ? (
              <Pressable style={styles.planEmptyCard} onPress={openAttach}>
                <Ionicons name="map-outline" size={20} color={accent.base} />
                <Text style={styles.planEmptyCardText}>
                  Attach a group blueprint — the prep steps everyone works toward together.
                </Text>
              </Pressable>
            ) : null}

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
              <Text style={styles.modalTitle}>Attach a blueprint</Text>
              <View style={{ minWidth: 56 }} />
            </View>
            <Text style={styles.modalSub}>
              Pick one of your blueprints. Everyone in the group starts from the
              first step and can reset their timeline to the shared order.
            </Text>
            {loadingPlans ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={accent.base} />
              </View>
            ) : myPlans.length === 0 ? (
              <Text style={styles.modalEmpty}>
                You don’t have any blueprints yet. Create one from Get Inspired or
                Creator Studio, then attach it here.
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
                Paste the group’s WhatsApp invite link. This is separate from the personal WhatsApp assistant.
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

              <Text style={[styles.editLabel, { marginTop: 20 }]}>Telegram group chat</Text>
              <Text style={styles.editHint}>
                Paste the group’s Telegram invite link. The Telegram bot can be added separately for group automation.
              </Text>
              <TextInput
                style={styles.input}
                value={editTelegram}
                onChangeText={setEditTelegram}
                placeholder="https://t.me/…"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={Platform.OS === 'web' ? 'default' : 'url'}
              />

              {canDeleteGroup ? (
                <View style={styles.dangerZone}>
                  <Text style={styles.dangerTitle}>Delete group</Text>
                  <Text style={styles.editHint}>
                    Removes this group for everyone. The attached blueprint stays in your Library.
                  </Text>
                  <Pressable
                    style={[styles.deleteGroupButton, deleting && { opacity: 0.5 }]}
                    onPress={handleDeletePress}
                    disabled={deleting || savingMeta}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.deleteGroupText}>
                      {deleting ? 'Deleting…' : 'Delete group'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(memberActionTarget)}
        animationType="fade"
        transparent
        onRequestClose={() => setMemberActionTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.memberActionSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setMemberActionTarget(null)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Manage member</Text>
              <View style={{ minWidth: 56 }} />
            </View>

            {memberActionTarget ? (
              <View style={styles.memberActionBody}>
                <View style={styles.memberActionIdentity}>
                  <View
                    style={[
                      styles.memberAvatar,
                      {
                        backgroundColor:
                          memberActionTarget.avatarColor ||
                          tintFor(memberActionTarget.userId, 0),
                      },
                    ]}
                  >
                    <Text style={styles.avText}>{initialsFor(memberActionTarget.name)}</Text>
                  </View>
                  <View style={styles.memberText}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {memberActionTarget.name}
                    </Text>
                    <Text style={styles.memberRole}>
                      {memberRoleLabel(memberActionTarget.role)}
                    </Text>
                  </View>
                </View>

                <View style={styles.roleChoiceList}>
                  {MANAGEABLE_MEMBER_ROLES.map((role) => {
                    const selected =
                      role === 'leader'
                        ? isGroupAdminRole(memberActionTarget.role)
                        : memberActionTarget.role === role;
                    return (
                      <Pressable
                        key={role}
                        style={[styles.roleChoice, selected && styles.roleChoiceSelected]}
                        disabled={memberUpdating || selected}
                        onPress={() => void handleSetMemberRole(role)}
                      >
                        <Text style={styles.roleChoiceText}>{memberRoleActionLabel(role)}</Text>
                        {selected ? (
                          <Ionicons name="checkmark" size={18} color={accent.base} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {memberActionTarget.userId !== authUser?.id ? (
                  <Pressable
                    style={[styles.removeMemberButton, memberUpdating && { opacity: 0.5 }]}
                    disabled={memberUpdating}
                    onPress={handleRemoveMemberPress}
                  >
                    <Ionicons name="person-remove-outline" size={16} color="#DC2626" />
                    <Text style={styles.removeMemberText}>Remove from group</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
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
              <Text style={styles.modalTitle}>{editStepId ? 'Edit prep step' : 'Add a prep step'}</Text>
              <Pressable onPress={handleAddStep} hitSlop={8} disabled={addingStep}>
                <Text style={[styles.modalSave, addingStep && { opacity: 0.5 }]}>
                  {editStepId ? 'Save' : 'Add'}
                </Text>
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
              {editStepId ? (
                <Pressable style={styles.removeStepRow} onPress={handleRemoveStep} disabled={addingStep}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.removeStepText}>Remove from plan</Text>
                </Pressable>
              ) : null}
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
  heroAbout: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 12,
    gap: 4,
  },
  heroAboutLabel: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroAboutText: { color: C.muted, fontSize: 14, lineHeight: 20 },
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
  shareWa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#25D366',
    backgroundColor: '#FFFFFF',
  },
  shareWaText: { color: '#128C3E', fontSize: 15, fontWeight: '700' },
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionSub: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  body: { color: C.muted, fontSize: 15, lineHeight: 22 },
  headerLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  headerLinkText: { fontSize: 13, fontWeight: '800' },
  messagingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  messagingButton: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  whatsappFilled: { backgroundColor: '#25D366', borderColor: '#25D366' },
  telegramFilled: { backgroundColor: '#229ED9', borderColor: '#229ED9' },
  whatsappOutline: { borderColor: '#25D366', backgroundColor: '#F7FFF9' },
  telegramOutline: { borderColor: '#229ED9', backgroundColor: '#F6FBFF' },
  whatsappOutlineText: { color: '#128C3E', fontSize: 14, fontWeight: '800' },
  telegramOutlineText: { color: '#1D8ACB', fontSize: 14, fontWeight: '800' },
  messagingFilledText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  messagingMutedText: { color: C.muted, fontSize: 14, fontWeight: '700' },
  channelLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  botRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
  },
  botRowText: { fontSize: 14, fontWeight: '800' },
  botRowMeta: { marginLeft: 'auto', color: C.muted, fontSize: 12, fontWeight: '700' },
  memberHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberCountLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
  memberAddButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  memberAddText: { fontSize: 13, fontWeight: '800' },
  memberList: { gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberText: { flex: 1 },
  memberName: { color: C.ink, fontSize: 15, fontWeight: '700' },
  memberRole: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  memberManageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  memberActionSheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  memberActionBody: { padding: 16, gap: 16 },
  memberActionIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleChoiceList: { borderWidth: 1, borderColor: C.line, borderRadius: 10, overflow: 'hidden' },
  roleChoice: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  roleChoiceSelected: { backgroundColor: '#F0FDF4' },
  roleChoiceText: { color: C.ink, fontSize: 15, fontWeight: '700' },
  removeMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 12,
  },
  removeMemberText: { color: '#DC2626', fontSize: 14, fontWeight: '800' },
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
  tlEdit: { marginTop: 2 },
  tlMoveControls: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 },
  tlMoveBtn: { padding: 4 },
  planActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  reorderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  reorderToggleText: { fontSize: 13, fontWeight: '700' },
  removeStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 10,
  },
  removeStepText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  dangerZone: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 18,
    gap: 8,
  },
  dangerTitle: { color: '#991B1B', fontSize: 15, fontWeight: '800' },
  deleteGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 6,
  },
  deleteGroupText: { color: '#DC2626', fontSize: 14, fontWeight: '800' },
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
