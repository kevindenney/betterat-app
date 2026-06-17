/**
 * SuggestStepSheet — Modal for suggesting a step to another user.
 * Sends a notification only (does not modify the step).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { SailorProfileService } from '@/services/SailorProfileService';
import { CrewFinderService } from '@/services/CrewFinderService';
import { SuggestStepService } from '@/services/SuggestStepService';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

interface SuggestStepSheetProps {
  visible: boolean;
  onClose: () => void;
  stepId: string;
  stepTitle: string;
}

interface UserRow {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
}

export function SuggestStepSheet({
  visible,
  onClose,
  stepId,
  stepTitle,
}: SuggestStepSheetProps) {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const [query, setQuery] = useState('');
  const [orgMembers, setOrgMembers] = useState<UserRow[]>([]);
  const [following, setFollowing] = useState<UserRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [hasFollows, setHasFollows] = useState(false);
  const [hasOrgMembers, setHasOrgMembers] = useState(false);

  useEffect(() => {
    if (!visible || !user?.id) return;
    setLoadingPeople(true);

    const loadOrgMembers = async (): Promise<UserRow[]> => {
      if (!activeOrganizationId) return [];
      try {
        const { data: memberships } = await supabase
          .from('organization_memberships')
          .select('user_id, role')
          .eq('organization_id', activeOrganizationId)
          .in('status', ['active', 'verified'])
          .neq('user_id', user.id)
          .limit(100);
        if (!memberships || memberships.length === 0) return [];
        const memberIds = memberships.map((m) => m.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', memberIds);
        const { data: sailorProfiles } = await supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji, avatar_color')
          .in('user_id', memberIds);
        const spMap: Record<string, any> = {};
        if (sailorProfiles) for (const sp of sailorProfiles) spMap[sp.user_id] = sp;
        const usersMap: Record<string, any> = {};
        if (usersData) for (const u of usersData) usersMap[u.id] = u;
        return memberIds.map((uid) => ({
          userId: uid,
          displayName: usersMap[uid]?.full_name || usersMap[uid]?.email || 'Unknown',
          email: usersMap[uid]?.email,
          avatarEmoji: spMap[uid]?.avatar_emoji,
          avatarColor: spMap[uid]?.avatar_color,
        }));
      } catch {
        return [];
      }
    };

    const loadPeople = async () => {
      const orgResults = await loadOrgMembers();
      if (orgResults.length > 0) {
        setHasOrgMembers(true);
        setOrgMembers(orgResults);
      } else {
        setHasOrgMembers(false);
      }

      try {
        const { users } = await SailorProfileService.getFollowing(user.id, user.id, { limit: 50, offset: 0 });
        if (users.length > 0) {
          setHasFollows(true);
          setFollowing(
            users.map((u) => ({
              userId: u.userId,
              displayName: u.displayName,
              email: u.email,
              avatarUrl: u.avatarUrl,
              avatarEmoji: u.avatarEmoji,
              avatarColor: u.avatarColor,
            }))
          );
        } else {
          setHasFollows(false);
          const results = await CrewFinderService.getAllUsers(50, 0);
          setAllUsers(
            results
              .filter((r) => r.userId !== user?.id)
              .map((r) => ({
                userId: r.userId,
                displayName: r.fullName,
                email: r.email,
                avatarEmoji: r.avatarEmoji,
                avatarColor: r.avatarColor,
              }))
          );
        }
      } catch {
        // Silently fail
      }
      setLoadingPeople(false);
    };

    loadPeople();
  }, [visible, user?.id, activeOrganizationId]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    const timeout = setTimeout(() => {
      CrewFinderService.searchUsers(query.trim(), 20)
        .then((results) => {
          setSearchResults(
            results
              .filter((r) => r.userId !== user?.id)
              .map((r) => ({
                userId: r.userId,
                displayName: r.fullName,
                email: r.email,
                avatarEmoji: r.avatarEmoji,
                avatarColor: r.avatarColor,
              }))
          );
        })
        .catch(() => setSearchResults([]))
        .finally(() => setLoadingSearch(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, user?.id]);

  const handleSuggest = useCallback(
    async (row: UserRow) => {
      if (!user) return;
      setSendingTo(row.userId);
      try {
        await SuggestStepService.suggest({
          sourceUserId: user.id,
          targetUserId: row.userId,
          sourceStepId: stepId,
        });
        setSentTo((prev) => new Set(prev).add(row.userId));
        showAlert('Sent', `Suggested "${stepTitle}" to ${row.displayName}`);
      } catch (e) {
        showAlert('Error', e instanceof Error ? e.message : 'Failed to send suggestion. Please try again.');
      } finally {
        setSendingTo(null);
      }
    },
    [user, stepId, stepTitle],
  );

  const handleClose = useCallback(() => {
    setQuery('');
    setSearchResults([]);
    setSentTo(new Set());
    onClose();
  }, [onClose]);

  const otherPeopleList = hasFollows ? following : allUsers;
  const displayList = query.trim() ? searchResults : otherPeopleList;
  const isSearching = query.trim().length > 0;

  const renderUserRow = ({ item }: { item: UserRow }) => {
    const alreadySent = sentTo.has(item.userId);
    const isSending = sendingTo === item.userId;
    return (
      <Pressable
        style={[styles.userRow, alreadySent && styles.userRowDisabled]}
        onPress={() => !alreadySent && !isSending && handleSuggest(item)}
        disabled={alreadySent || isSending}
      >
        <View style={[styles.avatar, { backgroundColor: item.avatarColor || IOS_COLORS.systemGray5 }]}>
          {item.avatarEmoji ? (
            <Text style={styles.avatarEmoji}>{item.avatarEmoji}</Text>
          ) : (
            <Ionicons name="person" size={18} color={IOS_COLORS.systemGray2} />
          )}
        </View>
        <View style={styles.userTextWrap}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.email && item.email !== item.displayName ? (
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          ) : null}
        </View>
        {isSending ? (
          <ActivityIndicator size="small" color={STEP_COLORS.accent} />
        ) : alreadySent ? (
          <Ionicons name="checkmark-circle" size={22} color={IOS_COLORS.systemGreen} />
        ) : (
          <Ionicons name="paper-plane-outline" size={20} color={STEP_COLORS.accent} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Suggest to...</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>"{stepTitle}"</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={28} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={IOS_COLORS.tertiaryLabel} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people..."
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
            </Pressable>
          )}
        </View>

        {/* Section header */}
        {!isSearching && hasOrgMembers && orgMembers.length > 0 && (
          <Text style={styles.sectionLabel}>YOUR ORGANIZATION</Text>
        )}

        {/* List */}
        {(loadingPeople && !isSearching) || (loadingSearch && isSearching) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={STEP_COLORS.accent} />
          </View>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.userId}
                renderItem={renderUserRow}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            </>
          )
        ) : (
          <FlatList
            data={[
              ...(hasOrgMembers ? orgMembers : []),
              ...(displayList.length > 0
                ? [{ userId: '__section__', displayName: hasFollows ? 'PEOPLE YOU FOLLOW' : 'PEOPLE ON BETTERAT' } as UserRow, ...displayList]
                : []),
            ]}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => {
              if (item.userId === '__section__') {
                return <Text style={styles.sectionLabelInline}>{item.displayName}</Text>;
              }
              return renderUserRow({ item });
            }}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No people found — try searching above</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    marginHorizontal: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xs,
  },
  sectionLabelInline: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xs,
  },
  loadingContainer: {
    paddingVertical: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.tertiaryLabel,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: IOS_SPACING.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  userRowDisabled: {
    opacity: 0.5,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  userTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  userEmail: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
  },
});
