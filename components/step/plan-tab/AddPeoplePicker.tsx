/**
 * <AddPeoplePicker> — canonical §11 Add-people sheet for the Plan tab's
 * With section. Differs from the legacy CollaboratorPicker by being
 * multi-select with inline role assignment per row and a green selected-strip
 * at the top showing live count + chips.
 *
 * Three grouped sources surface in this order:
 *   • RECENT CREW       — peers you've added to recent steps (last 30 days)
 *   • PEOPLE YOU FOLLOW — your sailor follows
 *   • FLEET SUBSCRIBERS — everyone on the same plan, when this step has one
 *
 * Invite-by-email row at the bottom is reserved for v1.5; for now it's a
 * disabled placeholder so the canonical layout is honoured.
 *
 * Canonical: docs/redesign/ios-register/library-tab-canonical.html §11
 *            (lines 4659–4810)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { SailorProfileService } from '@/services/SailorProfileService';
import { CrewFinderService } from '@/services/CrewFinderService';
import type { FleetWithMembers } from '@/services/CrewFinderService';
import { supabase } from '@/services/supabase';
import type { StepCollaborator } from '@/types/step-detail';
import { DEFAULT_ROLE_OPTIONS } from './CollaboratorRolePicker';

interface PersonRow {
  userId: string;
  displayName: string;
  email?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  /** Source group — drives section grouping in the picker. */
  source: 'recent' | 'follow' | 'fleet';
  /** Optional subtitle metadata, e.g. "RHKYC · sailed 4 times together · last Saturday". */
  subtitle?: string;
  /** Capability tags rendered as small inline pills (e.g. COACH, MENTOR). */
  tags?: string[];
  /** ISO timestamp of the last collaboration (recent crew only). */
  lastCollabAt?: string;
  /** Times we've collaborated in the last 30 days. */
  collabCount?: number;
  /** Resolved home-club name for this person, when known. */
  homeClubName?: string;
  /** Primary boat name (e.g. "Moonraker"), when known. */
  boatName?: string;
  /** Count of plans we share — blueprint subscriptions both of us have. */
  sharedPlans?: number;
}

// Per-capability pill colors. COACH leans iOS blue, MENTOR a warmer purple so
// a sailor with both flags reads as two distinct badges, not "two coaches".
const TAG_TONES: Record<string, { bg: string; fg: string }> = {
  COACH: { bg: 'rgba(0,122,255,0.14)', fg: IOS_COLORS.systemBlue },
  MENTOR: { bg: 'rgba(175,82,222,0.16)', fg: '#AF52DE' },
  DEFAULT: { bg: 'rgba(0,122,255,0.14)', fg: IOS_COLORS.systemBlue },
};

/**
 * Compose the row subtitle from whatever metadata we have. Returns undefined
 * if there's nothing meaningful to show (caller falls back to the email line).
 */
function composeSubtitle(row: {
  source: PersonRow['source'];
  homeClubName?: string;
  boatName?: string;
  collabCount?: number;
  lastCollabAt?: string;
  sharedPlans?: number;
}): string | undefined {
  const parts: string[] = [];
  if (row.homeClubName) parts.push(row.homeClubName);
  if (row.boatName) parts.push(row.boatName);
  if (row.source === 'recent' && row.collabCount) {
    const times = row.collabCount === 1 ? '1 time' : `${row.collabCount} times`;
    parts.push(`sailed ${times} together`);
    if (row.lastCollabAt) parts.push(lastPrefixed(row.lastCollabAt));
  } else if (row.sharedPlans && row.sharedPlans > 0) {
    parts.push(`${row.sharedPlans} shared plan${row.sharedPlans === 1 ? '' : 's'}`);
  } else if (row.source === 'follow' && row.sharedPlans === 0 && parts.length > 0) {
    // Only tack on "no shared plan" when there's other context to anchor it —
    // a bare "no shared plan" subtitle reads negative without club/boat.
    parts.push('no shared plan');
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Short, human relative date — "today", "yesterday", "Saturday", "Apr 12".
 * Designed for subtitles where compactness matters more than precision.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: 'long' });
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * "today" reads weird after a "last" prefix; only prefix "last" for prior dates.
 */
function lastPrefixed(iso: string): string {
  const rel = formatRelative(iso);
  if (rel === 'today' || rel === 'yesterday') return rel;
  return `last ${rel}`;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeExternalLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

interface SelectedRow {
  userId: string;
  type?: StepCollaborator['type'];
  displayName: string;
  avatarEmoji?: string;
  avatarColor?: string;
  email?: string;
  role?: string;
  connectionSpace?: string;
}

interface AddPeoplePickerProps {
  visible: boolean;
  /** user_ids already on the step — pre-selected on open so the user can edit roles inline. */
  existingUserIds: string[];
  /** Map existing user_id → role so pre-selected rows show their current role. */
  existingRoles?: Record<string, string | undefined>;
  onClose: () => void;
  /**
   * Called when the user hits Done. Returns the full desired set (additions +
   * unchanged) — the caller diffs against the prior state to compute adds /
   * removes / role-updates.
   */
  onConfirm: (selections: StepCollaborator[]) => void;
  /** Role options shown on the inline role picker. Defaults to sailing roles. */
  roleOptions?: string[];
}

export function AddPeoplePicker({
  visible,
  existingUserIds,
  existingRoles,
  onClose,
  onConfirm,
  roleOptions = DEFAULT_ROLE_OPTIONS,
}: AddPeoplePickerProps) {
  const { user } = useAuth();
  const { vocab } = useVocabulary();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PersonRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedRow[]>([]);
  const [roleEditingId, setRoleEditingId] = useState<string | null>(null);
  const [fleets, setFleets] = useState<FleetWithMembers[]>([]);

  // Seed selected state when the picker opens. Dep is `visible` only —
  // existingUserIds / existingRoles are new array/object identities on every
  // parent render, so depending on them re-fires the effect and wipes any
  // selection the user just made.
  useEffect(() => {
    if (!visible) return;
    setSelected(
      existingUserIds.map((uid) => ({
        userId: uid,
        type: 'platform' as const,
        displayName: 'Loading…',
        role: existingRoles?.[uid],
      })),
    );
    setQuery('');
    setSearchResults([]);
    setRoleEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Load follow + recent crew on open.
  useEffect(() => {
    if (!visible || !user?.id) return;
    setLoading(true);

    const run = async () => {
      const aggregated: PersonRow[] = [];
      const seen = new Set<string>();

      // 1. People you follow
      try {
        const { users } = await SailorProfileService.getFollowing(user.id, user.id, {
          limit: 50,
          offset: 0,
        });
        for (const u of users) {
          if (seen.has(u.userId)) continue;
          seen.add(u.userId);
          aggregated.push({
            userId: u.userId,
            displayName: u.displayName,
            email: u.email,
            avatarEmoji: u.avatarEmoji,
            avatarColor: u.avatarColor,
            source: 'follow',
          });
        }
      } catch {
        /* swallow — empty group ok */
      }

      // 2. Recent crew — distinct user_ids from step_collaborators within the
      //    last 30 days where I was the owner. Falls back silently if the
      //    table is empty (Phase 11 schema, new feature).
      //
      //    We also aggregate count + most-recent timestamp per user so the
      //    row subtitle can render "sailed N times · last Saturday".
      const collabAgg = new Map<string, { count: number; lastAt: string }>();
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from('step_collaborators')
          .select('user_id, role, added_at')
          .eq('added_by', user.id)
          .gte('added_at', since)
          .order('added_at', { ascending: false })
          .limit(100);
        if (recent && recent.length > 0) {
          for (const row of recent as { user_id: string; added_at: string }[]) {
            if (row.user_id === user.id) continue;
            const prior = collabAgg.get(row.user_id);
            if (!prior) {
              collabAgg.set(row.user_id, { count: 1, lastAt: row.added_at });
            } else {
              prior.count += 1;
              if (row.added_at > prior.lastAt) prior.lastAt = row.added_at;
            }
          }
          const recentIds = Array.from(collabAgg.keys());
          if (recentIds.length > 0) {
            const { data: profs } = await supabase
              .from('users')
              .select('id, full_name, email')
              .in('id', recentIds);
            const { data: sailors } = await supabase
              .from('sailor_profiles')
              .select('user_id, avatar_emoji, avatar_color')
              .in('user_id', recentIds);
            const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
            const sailorMap = new Map((sailors ?? []).map((s: any) => [s.user_id, s]));
            for (const id of recentIds) {
              if (seen.has(id)) continue;
              const p = profMap.get(id) as any;
              const s = sailorMap.get(id) as any;
              const agg = collabAgg.get(id)!;
              seen.add(id);
              aggregated.unshift({
                userId: id,
                displayName: p?.full_name || p?.email || 'Unknown',
                email: p?.email,
                avatarEmoji: s?.avatar_emoji,
                avatarColor: s?.avatar_color,
                source: 'recent',
                collabCount: agg.count,
                lastCollabAt: agg.lastAt,
              });
            }
          }
        }
      } catch {
        /* swallow */
      }

      // 3. Enrichment pass — for every person we just collected, fetch home
      //    club, primary boat, coach + mentor capabilities, and the count
      //    of plans we share (blueprint subscriptions in common) so the
      //    row subtitle and tag pills can render real data. Each query is
      //    independent and tolerates missing tables/policies silently.
      if (aggregated.length > 0) {
        const allIds = aggregated.map((p) => p.userId);
        const [clubsRes, coachesRes, boatsRes, mySubsRes, theirSubsRes, capsRes] = await Promise.all([
          supabase
            .from('sailor_profiles')
            .select('user_id, home_club_id')
            .in('user_id', allIds),
          supabase
            .from('coach_profiles')
            .select('user_id, is_active')
            .in('user_id', allIds)
            .eq('is_active', true),
          supabase
            .from('sailor_boats')
            .select('sailor_id, name, is_primary')
            .in('sailor_id', allIds)
            .eq('is_primary', true),
          supabase
            .from('blueprint_subscriptions')
            .select('blueprint_id')
            .eq('subscriber_id', user.id),
          supabase
            .from('blueprint_subscriptions')
            .select('subscriber_id, blueprint_id')
            .in('subscriber_id', allIds),
          supabase
            .from('user_capabilities')
            .select('user_id, capability_type')
            .in('user_id', allIds)
            .eq('is_active', true),
        ]);

        const clubIdByUser = new Map<string, string>();
        for (const row of (clubsRes.data ?? []) as { user_id: string; home_club_id: string | null }[]) {
          if (row.home_club_id) clubIdByUser.set(row.user_id, row.home_club_id);
        }
        const coachSet = new Set<string>(
          ((coachesRes.data ?? []) as { user_id: string }[]).map((c) => c.user_id),
        );
        const mentorSet = new Set<string>();
        for (const row of (capsRes.data ?? []) as { user_id: string; capability_type: string }[]) {
          if (row.capability_type === 'mentoring') mentorSet.add(row.user_id);
          // Also accept 'coaching' capability as a COACH signal — coach_profiles
          // is the legacy source; capabilities is the additive successor.
          if (row.capability_type === 'coaching') coachSet.add(row.user_id);
        }
        const boatNameByUser = new Map<string, string>();
        for (const b of (boatsRes.data ?? []) as { sailor_id: string; name: string }[]) {
          if (b.name && !boatNameByUser.has(b.sailor_id)) {
            boatNameByUser.set(b.sailor_id, b.name);
          }
        }

        const mySubs = new Set<string>(
          ((mySubsRes.data ?? []) as { blueprint_id: string }[]).map((s) => s.blueprint_id),
        );
        const sharedPlanCount = new Map<string, number>();
        for (const row of (theirSubsRes.data ?? []) as { subscriber_id: string; blueprint_id: string }[]) {
          if (!mySubs.has(row.blueprint_id)) continue;
          sharedPlanCount.set(row.subscriber_id, (sharedPlanCount.get(row.subscriber_id) ?? 0) + 1);
        }

        let clubNameById = new Map<string, string>();
        const clubIds = Array.from(new Set(Array.from(clubIdByUser.values())));
        if (clubIds.length > 0) {
          const { data: clubs } = await supabase
            .from('clubs')
            .select('id, name')
            .in('id', clubIds);
          clubNameById = new Map(
            ((clubs ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
          );
        }

        for (const row of aggregated) {
          const clubId = clubIdByUser.get(row.userId);
          row.homeClubName = clubId ? clubNameById.get(clubId) : undefined;
          row.boatName = boatNameByUser.get(row.userId);
          row.sharedPlans = sharedPlanCount.get(row.userId) ?? 0;
          const tags: string[] = [];
          if (coachSet.has(row.userId)) tags.push('COACH');
          if (mentorSet.has(row.userId)) tags.push('MENTOR');
          row.tags = tags.length > 0 ? tags : undefined;
          row.subtitle = composeSubtitle(row);
        }
      }

      setPeople(aggregated);

      // Fleets the user belongs to — surfaced as "add everyone" rows so a whole
      // crew can be attached in one tap. Drop empty fleets (only the current
      // user) since there's nothing to add.
      try {
        const fleetData = await CrewFinderService.getFleetMatesForUser(user.id);
        setFleets(fleetData.filter((f) => f.members.length > 0));
      } catch {
        setFleets([]);
      }

      // Hydrate the placeholder display names for any pre-selected rows we now
      // have full data for.
      setSelected((prev) =>
        prev.map((row) => {
          if (row.displayName !== 'Loading…') return row;
          const match = aggregated.find((p) => p.userId === row.userId);
          if (!match) return row;
          return {
            ...row,
            displayName: match.displayName,
            email: match.email,
            avatarEmoji: match.avatarEmoji,
            avatarColor: match.avatarColor,
          };
        }),
      );

      setLoading(false);
    };

    run();
  }, [visible, user?.id]);

  // Live search (debounced).
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await CrewFinderService.searchUsers(query.trim(), 20);
        setSearchResults(
          results
            .filter((r) => r.userId !== user?.id)
            .map((r) => ({
              userId: r.userId,
              displayName: r.fullName,
              email: r.email,
              avatarEmoji: r.avatarEmoji,
              avatarColor: r.avatarColor,
              source: 'follow' as const,
            })),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, user?.id]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.userId)), [selected]);

  const toggleSelect = (row: PersonRow) => {
    setSelected((prev) => {
      if (prev.some((s) => s.userId === row.userId)) {
        return prev.filter((s) => s.userId !== row.userId);
      }
      return [
        ...prev,
        {
          userId: row.userId,
          type: 'platform',
          displayName: row.displayName,
          email: row.email,
          avatarEmoji: row.avatarEmoji,
          avatarColor: row.avatarColor,
          role: undefined,
        },
      ];
    });
  };

  // Add or remove every member of a fleet in one tap. If all members are
  // already selected, the row acts as a "remove all" toggle.
  const toggleFleet = (fleet: FleetWithMembers) => {
    const memberIds = new Set(fleet.members.map((m) => m.userId));
    const allIn = fleet.members.every((m) => selectedIds.has(m.userId));
    setSelected((prev) => {
      if (allIn) {
        return prev.filter((s) => !memberIds.has(s.userId));
      }
      const have = new Set(prev.map((s) => s.userId));
      const additions = fleet.members
        .filter((m) => !have.has(m.userId))
        .map((m) => ({
          userId: m.userId,
          type: 'platform' as const,
          displayName: m.fullName,
          email: m.email,
          avatarEmoji: m.avatarEmoji,
          avatarColor: m.avatarColor,
          role: undefined,
        }));
      return [...prev, ...additions];
    });
  };

  const setRole = (userId: string, role: string | undefined) => {
    setSelected((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, role: role || undefined } : s)),
    );
  };

  const addExternal = (rawLabel: string, connectionSpace?: string) => {
    const displayName = normalizeExternalLabel(rawLabel);
    if (!displayName) return;
    const key = `external:${displayName.toLowerCase()}:${connectionSpace ?? 'name'}`;
    setSelected((prev) => {
      if (prev.some((s) => s.userId === key)) return prev;
      return [
        ...prev,
        {
          userId: key,
          type: 'external',
          displayName,
          email: isLikelyEmail(displayName) ? displayName : undefined,
          connectionSpace,
        },
      ];
    });
    setQuery('');
  };

  const handleDone = () => {
    const out: StepCollaborator[] = selected.map((s) => {
      if (s.type === 'external') {
        return {
          id: s.userId,
          type: 'external',
          display_name: s.displayName,
          connection_space: s.connectionSpace,
          role: s.role,
        };
      }
      return {
        id: s.userId,
        type: 'platform',
        user_id: s.userId,
        display_name: s.displayName,
        avatar_emoji: s.avatarEmoji,
        avatar_color: s.avatarColor,
        role: s.role,
      };
    });
    onConfirm(out);
    onClose();
  };

  // Group the listing.
  const grouped = useMemo(() => {
    const list = query.trim() ? searchResults : people;
    return {
      recent: list.filter((p) => p.source === 'recent'),
      follow: list.filter((p) => p.source === 'follow'),
      fleet: list.filter((p) => p.source === 'fleet'),
    };
  }, [people, searchResults, query]);
  const externalQuery = normalizeExternalLabel(query);
  const canAddExternal = externalQuery.length >= 2;
  const externalAlreadySelected = selected.some(
    (s) => s.type === 'external' && s.displayName.toLowerCase() === externalQuery.toLowerCase(),
  );

  const renderRow = (row: PersonRow) => {
    const isSelected = selectedIds.has(row.userId);
    const selectedRow = selected.find((s) => s.userId === row.userId);
    const expanded = roleEditingId === row.userId && isSelected;
    return (
      <View key={row.userId}>
        <Pressable
          style={[styles.pkRow, isSelected && styles.pkRowOn]}
          onPress={() => toggleSelect(row)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: row.avatarColor || IOS_COLORS.systemGray5 },
            ]}
          >
            {row.avatarEmoji ? (
              <Text style={styles.avatarEmoji}>{row.avatarEmoji}</Text>
            ) : (
              <Ionicons name="person" size={16} color={IOS_COLORS.systemGray2} />
            )}
          </View>
          <View style={styles.pkRowText}>
            <View style={styles.nameLine}>
              <Text style={styles.pkRowName} numberOfLines={1}>
                {row.displayName}
              </Text>
              {isSelected && selectedRow?.role ? (
                <View style={styles.rolePillInline}>
                  <Text style={styles.rolePillInlineText}>
                    {selectedRow.role.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            {row.tags && row.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {row.tags.map((t) => {
                  const tone = TAG_TONES[t] ?? TAG_TONES.DEFAULT;
                  return (
                    <View key={t} style={[styles.tagPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.tagPillText, { color: tone.fg }]}>{t}</Text>
                    </View>
                  );
                })}
                {row.subtitle ? (
                  <Text style={styles.pkRowSub} numberOfLines={1}>
                    {row.subtitle}
                  </Text>
                ) : null}
              </View>
            ) : row.subtitle ? (
              <Text style={styles.pkRowSub} numberOfLines={1}>
                {row.subtitle}
              </Text>
            ) : row.email && row.email !== row.displayName ? (
              <Text style={styles.pkRowSub} numberOfLines={1}>
                {row.email}
              </Text>
            ) : null}
          </View>
          <View style={[styles.chk, isSelected && styles.chkOn]}>
            {isSelected ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : null}
          </View>
        </Pressable>
        {isSelected ? (
          <View style={styles.roleStrip}>
            {(expanded ? roleOptions : roleOptions.slice(0, 3)).map((opt) => {
              const active = selectedRow?.role === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setRole(row.userId, active ? undefined : opt)}
                  style={[styles.roleOpt, active && styles.roleOptActive]}
                >
                  <Text style={[styles.roleOptText, active && styles.roleOptTextActive]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
            {!expanded && roleOptions.length > 3 ? (
              <Pressable
                onPress={() => setRoleEditingId(row.userId)}
                style={styles.roleOpt}
              >
                <Text style={styles.roleOptText}>more…</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.headBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.headTitle}>Who will you do this with?</Text>
          <Pressable onPress={handleDone} hitSlop={8}>
            <Text style={[styles.headBtn, styles.headDone]}>Done · {selected.length}</Text>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={16} color={IOS_COLORS.tertiaryLabel} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search crew, followees, fleet…"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
            </Pressable>
          ) : null}
        </View>

        {selected.length > 0 ? (
          <View style={styles.selectedStrip}>
            <Text style={styles.selectedEye}>
              {selected.length} selected · Tap a chip to change role
            </Text>
            <View style={styles.chipsRow}>
              {selected.map((s) => (
                <Pressable
                  key={s.userId}
                  onPress={() => setRoleEditingId(s.userId)}
                  style={styles.pkChip}
                >
                  <View
                    style={[
                      styles.chipAvatar,
                      { backgroundColor: s.avatarColor || IOS_COLORS.systemGray5 },
                    ]}
                  >
                    {s.avatarEmoji ? (
                      <Text style={styles.chipEmoji}>{s.avatarEmoji}</Text>
                    ) : (
                      <Ionicons name="person" size={10} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.chipName} numberOfLines={1}>
                    {s.displayName}
                  </Text>
                  {s.role ? <Text style={styles.chipRole}> · {s.role}</Text> : null}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelected((prev) => prev.filter((p) => p.userId !== s.userId));
                    }}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={12} color={IOS_COLORS.systemGray2} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={IOS_COLORS.systemBlue} />
            </View>
          ) : (
            <>
              {query && searching ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={IOS_COLORS.systemBlue} />
                </View>
              ) : null}

              {grouped.recent.length > 0 ? (
                <>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupHeadText}>Recent crew</Text>
                    <Text style={styles.groupCount}>Last 30 days</Text>
                  </View>
                  {grouped.recent.map(renderRow)}
                </>
              ) : null}

              {grouped.follow.length > 0 ? (
                <>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupHeadText}>People you follow</Text>
                    <Text style={styles.groupCount}>
                      {grouped.follow.length} followed
                    </Text>
                  </View>
                  {grouped.follow.map(renderRow)}
                </>
              ) : null}

              {grouped.fleet.length > 0 ? (
                <>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupHeadText}>Fleet</Text>
                  </View>
                  {grouped.fleet.map(renderRow)}
                </>
              ) : null}

              {!query.trim() && fleets.length > 0 ? (
                <>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupHeadText}>Fleets & groups</Text>
                    <Text style={styles.groupCount}>Tap to add everyone</Text>
                  </View>
                  {fleets.map((fleet) => {
                    const allIn =
                      fleet.members.length > 0 &&
                      fleet.members.every((m) => selectedIds.has(m.userId));
                    const inCount = fleet.members.filter((m) =>
                      selectedIds.has(m.userId),
                    ).length;
                    return (
                      <Pressable
                        key={fleet.id}
                        style={[styles.pkRow, allIn && styles.pkRowOn]}
                        onPress={() => toggleFleet(fleet)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: allIn }}
                        accessibilityLabel={`${allIn ? 'Remove' : 'Add'} all ${fleet.members.length} members of ${fleet.name}`}
                      >
                        <View style={[styles.avatar, styles.fleetGlyph]}>
                          <Ionicons name="people" size={16} color={IOS_COLORS.systemBlue} />
                        </View>
                        <View style={styles.pkRowText}>
                          <Text style={styles.pkRowName} numberOfLines={1}>
                            {fleet.name}
                          </Text>
                          <Text style={styles.pkRowSub} numberOfLines={1}>
                            {fleet.members.length} sailor{fleet.members.length === 1 ? '' : 's'}
                            {inCount > 0 && !allIn ? ` · ${inCount} added` : ''}
                          </Text>
                        </View>
                        <View style={[styles.addAllPill, allIn && styles.removeAllPill]}>
                          <Text style={[styles.addAllPillText, allIn && styles.removeAllPillText]}>
                            {allIn ? 'Remove all' : 'Add all'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}

              {query && canAddExternal && !externalAlreadySelected ? (
                <>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupHeadText}>Add outside BetterAt</Text>
                  </View>
                  <Pressable
                    style={styles.inviteRow}
                    onPress={() => addExternal(externalQuery)}
                  >
                    <View style={styles.inviteIcon}>
                      <Ionicons name="person-add-outline" size={18} color={IOS_COLORS.systemBlue} />
                    </View>
                    <View style={styles.pkRowText}>
                      <Text style={styles.pkRowName}>Add "{externalQuery}"</Text>
                      <Text style={styles.pkRowSub}>Add a collaborator who is not in BetterAt</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.inviteRow}
                    onPress={() => addExternal(externalQuery, isLikelyEmail(externalQuery) ? 'email' : 'share link')}
                  >
                    <View style={styles.inviteIcon}>
                      <Ionicons name="mail-outline" size={18} color={IOS_COLORS.systemBlue} />
                    </View>
                    <View style={styles.pkRowText}>
                      <Text style={styles.pkRowName}>Invite by email or link</Text>
                      <Text style={styles.pkRowSub}>
                        {isLikelyEmail(externalQuery) ? externalQuery : 'Use the step share link'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.inviteRow}
                    onPress={() => addExternal(externalQuery, 'WhatsApp / SMS')}
                  >
                    <View style={styles.inviteIcon}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={IOS_COLORS.systemGreen} />
                    </View>
                    <View style={styles.pkRowText}>
                      <Text style={styles.pkRowName}>Invite by WhatsApp or SMS</Text>
                      <Text style={styles.pkRowSub}>Save them here, then share from the collaborator chip</Text>
                    </View>
                  </Pressable>
                </>
              ) : null}

              {!loading &&
              grouped.recent.length === 0 &&
              grouped.follow.length === 0 &&
              grouped.fleet.length === 0 &&
              (query.trim() || fleets.length === 0) ? (
                <Text style={styles.empty}>
                  {query ? 'No BetterAt matches.' : `Follow some ${vocab('Peers')} to see them here.`}
                </Text>
              ) : null}

              <Pressable style={styles.inviteRow} onPress={() => addExternal(query || 'Shared by link', 'share link')}>
                <View style={styles.inviteIcon}>
                  <Ionicons name="link-outline" size={18} color={IOS_COLORS.tertiaryLabel} />
                </View>
                <View style={styles.pkRowText}>
                  <Text style={styles.pkRowName}>Add invite by link</Text>
                  <Text style={styles.pkRowSub}>Creates an external collaborator chip you can share with</Text>
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  headTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    flex: 1,
    textAlign: 'center',
  },
  headBtn: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    minWidth: 70,
  },
  headDone: {
    fontWeight: '700',
    textAlign: 'right',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemGray6,
    marginHorizontal: IOS_SPACING.md,
    marginTop: IOS_SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
  },
  selectedStrip: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
    backgroundColor: 'rgba(52,199,89,0.06)',
  },
  selectedEye: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 6,
  },
  pkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.5)',
  },
  chipAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipEmoji: {
    fontSize: 10,
  },
  chipName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    maxWidth: 180,
  },
  chipRole: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'lowercase',
  },
  body: {
    flex: 1,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: 14,
    paddingBottom: 6,
  },
  groupHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  groupCount: {
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  pkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  pkRowOn: {
    backgroundColor: 'rgba(52,199,89,0.05)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 16,
  },
  fleetGlyph: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  addAllPill: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  addAllPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeAllPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray3,
  },
  removeAllPillText: {
    color: IOS_COLORS.secondaryLabel,
  },
  pkRowText: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pkRowName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    flexShrink: 1,
  },
  pkRowSub: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
    flexShrink: 1,
  },
  rolePillInline: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(52,199,89,0.18)',
  },
  rolePillInlineText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1B7F3A',
    letterSpacing: 0.4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  tagPill: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tagPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chk: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.systemGray3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chkOn: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  roleStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: 10,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
    backgroundColor: 'rgba(52,199,89,0.05)',
  },
  roleOpt: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray4,
  },
  roleOptActive: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  roleOptText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textTransform: 'lowercase',
  },
  roleOptTextActive: {
    color: '#FFFFFF',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray5,
  },
  inviteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    color: IOS_COLORS.tertiaryLabel,
    fontSize: 13,
    paddingVertical: 32,
  },
});
