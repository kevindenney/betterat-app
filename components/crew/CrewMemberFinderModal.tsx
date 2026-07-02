/**
 * CrewMemberFinderModal
 *
 * Modal for discovering and adding existing BetterAt users as crew members.
 * Features:
 * - Suggested users (fleet mates, past race collaborators)
 * - Discover tab to browse all users and follow them
 * - Search for any BetterAt user by name
 * - Add user with proper user_id linking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Search, UserPlus, Users, Sailboat, UserCheck, Globe } from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import { CrewFinderService, SailorProfileSummary, DiscoverableUser, SimilarSailor } from '@/services/CrewFinderService';
import { crewManagementService, CrewRole } from '@/services/crewManagementService';
import { useCrewFinder } from '@/hooks/useCrewFinder';
// @ts-ignore - lodash/debounce has no bundled types
import debounce from 'lodash/debounce';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'suggestions' | 'discover';

interface CrewMemberFinderModalProps {
  visible: boolean;
  onClose: () => void;
  sailorId: string;
  classId: string;
  currentUserId: string;
  /** Optional race context for fleet-specific suggestions */
  regattaId?: string;
  /** Race name for display in suggestion sources */
  regattaName?: string;
  onCrewAdded?: () => void;
}

interface SuggestedUser extends SailorProfileSummary {
  source?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ROLES: CrewRole[] = [
  'helmsman',
  'tactician',
  'trimmer',
  'bowman',
  'pit',
  'grinder',
  'other',
];

const ROLE_LABELS: Record<CrewRole, string> = {
  helmsman: 'Helmsman',
  tactician: 'Tactician',
  trimmer: 'Trimmer',
  bowman: 'Bowman',
  pit: 'Pit',
  grinder: 'Grinder',
  other: 'Other',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CrewMemberFinderModal({
  visible,
  onClose,
  sailorId,
  classId,
  currentUserId,
  regattaId,
  regattaName,
  onCrewAdded,
}: CrewMemberFinderModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('suggestions');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SailorProfileSummary[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [similarSailors, setSimilarSailors] = useState<SimilarSailor[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<CrewRole>('trimmer');
  const [showRolePicker, setShowRolePicker] = useState<string | null>(null);

  // Use the crew finder hook for discovery and following
  // Pass currentUserId to ensure the hook has the user ID even if useAuth() hasn't resolved yet
  const {
    discoverUsers,
    isLoadingDiscoverUsers,
    hasMoreDiscoverUsers,
    loadMoreDiscoverUsers,
    followUser,
    unfollowUser,
    isFollowingUser,
    isFollowLoading,
    refetchDiscoverUsers,
  } = useCrewFinder({ userId: currentUserId });

  // Track which user is currently being followed/unfollowed
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // LOAD SUGGESTIONS
  // ---------------------------------------------------------------------------

  const loadSuggestions = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      setLoading(true);
      // Use race-specific suggestions if regattaId is provided
      const suggestedCrew = regattaId
        ? await CrewFinderService.getSuggestedCrewForRace(currentUserId, regattaId, regattaName)
        : await CrewFinderService.getSuggestedCrew(currentUserId);
      setSuggestions(suggestedCrew as SuggestedUser[]);
    } catch (error) {
      console.error('[CrewMemberFinderModal] Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, regattaId, regattaName]);

  // Load similar sailors for discovery
  const loadSimilarSailors = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      setLoadingSimilar(true);
      const similar = await CrewFinderService.getSimilarSailors(currentUserId, { limit: 15 });
      setSimilarSailors(similar);
    } catch (error) {
      console.error('[CrewMemberFinderModal] Error loading similar sailors:', error);
    } finally {
      setLoadingSimilar(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (visible) {
      loadSuggestions();
      loadSimilarSailors();
      setSearchQuery('');
      setSearchResults([]);
      setShowRolePicker(null);
      setActiveTab('suggestions');
      refetchDiscoverUsers();
    }
  }, [visible, loadSuggestions, loadSimilarSailors, refetchDiscoverUsers]);

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      try {
        setSearchLoading(true);
        const results = await CrewFinderService.searchUsers(query);
        // Filter out current user
        setSearchResults(results.filter((u) => u.userId !== currentUserId));
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    [currentUserId]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      setSearchLoading(true);
    }
    performSearch(text);
  };

  // ---------------------------------------------------------------------------
  // ADD CREW MEMBER
  // ---------------------------------------------------------------------------

  const handleAddCrewMember = async (user: SailorProfileSummary, role: CrewRole) => {
    try {
      setAddingUserId(user.userId);
      await crewManagementService.addCrewMemberFromUser(
        sailorId,
        classId,
        user.userId,
        user.fullName,
        user.email || `${user.userId}@noemail.local`,
        role
      );

      showAlert('Success', `${user.fullName} added as ${ROLE_LABELS[role]}`);
      setShowRolePicker(null);
      onCrewAdded?.();

      // Remove from suggestions/search results
      setSuggestions((prev) => prev.filter((s) => s.userId !== user.userId));
      setSearchResults((prev) => prev.filter((s) => s.userId !== user.userId));
    } catch (error: any) {
      console.error('Error adding crew member:', error);
      showAlert('Error', error.message || 'Failed to add crew member');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleAddClick = (userId: string) => {
    if (showRolePicker === userId) {
      setShowRolePicker(null);
    } else {
      setShowRolePicker(userId);
      setSelectedRole('trimmer');
    }
  };

  // ---------------------------------------------------------------------------
  // FOLLOW / UNFOLLOW
  // ---------------------------------------------------------------------------

  const handleFollowToggle = async (user: DiscoverableUser) => {
    try {
      setFollowingUserId(user.userId);
      if (user.isFollowing) {
        await unfollowUser(user.userId);
      } else {
        await followUser(user.userId);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showAlert('Error', 'Failed to update follow status');
    } finally {
      setFollowingUserId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: USER ROW
  // ---------------------------------------------------------------------------

  const renderUserRow = (user: SailorProfileSummary & { source?: string }) => {
    const isAdding = addingUserId === user.userId;
    const showingRolePicker = showRolePicker === user.userId;

    return (
      <View key={user.userId} style={styles.userRow}>
        <View style={styles.userInfo}>
          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: user.avatarColor || IOS_COLORS.gray5 },
            ]}
          >
            <Text style={styles.avatarEmoji}>
              {user.avatarEmoji || '⛵'}
            </Text>
          </View>

          {/* Name & Source */}
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.fullName}
            </Text>
            {user.source && (
              <Text style={styles.userSource} numberOfLines={1}>
                {user.source}
              </Text>
            )}
            {!user.source && user.sailingExperience && (
              <Text style={styles.userSource} numberOfLines={1}>
                {user.sailingExperience}
              </Text>
            )}
          </View>
        </View>

        {/* Add Button / Role Picker */}
        {showingRolePicker ? (
          <View style={styles.rolePickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rolePickerScroll}
            >
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    selectedRole === role && styles.roleOptionSelected,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === role && styles.roleOptionTextSelected,
                    ]}
                  >
                    {ROLE_LABELS[role]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.rolePickerActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRolePicker(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleAddCrewMember(user, selectedRole)}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddClick(user.userId)}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={IOS_COLORS.blue} />
            ) : (
              <>
                <UserPlus size={14} color={IOS_COLORS.blue} />
                <Text style={styles.addButtonText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: DISCOVER USER ROW
  // ---------------------------------------------------------------------------

  const renderDiscoverUserRow = (user: DiscoverableUser) => {
    const isFollowingThisUser = user.isFollowing || isFollowingUser(user.userId);
    const isLoading = followingUserId === user.userId;
    const showingRolePicker = showRolePicker === user.userId;
    const isAdding = addingUserId === user.userId;
    const raceCount = user.raceCount || 0;

    // Build subtitle from available info
    const subtitleParts: string[] = [];
    if (user.sailingExperience) subtitleParts.push(user.sailingExperience);
    if (user.boatClassName) subtitleParts.push(user.boatClassName);
    if (user.clubName) subtitleParts.push(user.clubName);
    const subtitle = subtitleParts.join(' · ') || 'BetterAt user';

    return (
      <View key={user.userId} style={styles.userRow}>
        <View style={styles.userInfo}>
          {/* Avatar with race count badge */}
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: user.avatarColor || IOS_COLORS.gray5 },
              ]}
            >
              <Text style={styles.avatarEmoji}>
                {user.avatarEmoji || '⛵'}
              </Text>
            </View>
            {/* Race count badge */}
            {raceCount > 0 && (
              <View style={styles.raceCountBadge}>
                <Text style={styles.raceCountBadgeText}>{raceCount}</Text>
              </View>
            )}
          </View>

          {/* Name & Info */}
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.fullName}
              </Text>
              {raceCount > 0 && (
                <Text style={styles.raceCountText}>
                  {raceCount} race{raceCount !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Text style={styles.userSource} numberOfLines={1}>
              {subtitle}
            </Text>
            {/* Recent races preview */}
            {user.recentRaces && user.recentRaces.length > 0 && (
              <Text style={styles.recentRacesPreview} numberOfLines={1}>
                📍 {user.recentRaces.slice(0, 2).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Actions: Follow button + Add button */}
        {showingRolePicker ? (
          <View style={styles.rolePickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rolePickerScroll}
            >
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    selectedRole === role && styles.roleOptionSelected,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === role && styles.roleOptionTextSelected,
                    ]}
                  >
                    {ROLE_LABELS[role]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.rolePickerActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRolePicker(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleAddCrewMember(user, selectedRole)}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.discoverActions}>
            {/* Follow/Following Button */}
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowingThisUser && styles.followButtonFollowing,
              ]}
              onPress={() => handleFollowToggle(user)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowingThisUser ? IOS_COLORS.gray : IOS_COLORS.blue}
                />
              ) : isFollowingThisUser ? (
                <>
                  <UserCheck size={14} color={IOS_COLORS.gray} />
                  <Text style={styles.followButtonTextFollowing}>Following</Text>
                </>
              ) : (
                <Text style={styles.followButtonText}>Follow</Text>
              )}
            </TouchableOpacity>

            {/* Add to Crew Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddClick(user.userId)}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={IOS_COLORS.blue} />
              ) : (
                <>
                  <UserPlus size={14} color={IOS_COLORS.blue} />
                  <Text style={styles.addButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: EMPTY STATES
  // ---------------------------------------------------------------------------

  const renderEmptySuggestions = () => (
    <View style={styles.emptyState}>
      <Users size={32} color={IOS_COLORS.gray3} />
      <Text style={styles.emptyText}>No suggestions available</Text>
      <Text style={styles.emptySubtext}>
        Join a fleet or collaborate on races to see suggestions
      </Text>
    </View>
  );

  const renderEmptySearch = () => (
    <View style={styles.emptyState}>
      <Search size={32} color={IOS_COLORS.gray3} />
      <Text style={styles.emptyText}>No users found</Text>
      <Text style={styles.emptySubtext}>
        Try a different search term
      </Text>
    </View>
  );

  const renderEmptyDiscover = () => (
    <View style={styles.emptyState}>
      <Globe size={32} color={IOS_COLORS.gray3} />
      <Text style={styles.emptyText}>No users to discover</Text>
      <Text style={styles.emptySubtext}>
        Be the first to join BetterAt!
      </Text>
    </View>
  );

  // ---------------------------------------------------------------------------
  // RENDER: TABS
  // ---------------------------------------------------------------------------

  const renderTabs = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'suggestions' && styles.tabActive]}
        onPress={() => setActiveTab('suggestions')}
      >
        <Users size={16} color={activeTab === 'suggestions' ? IOS_COLORS.blue : IOS_COLORS.gray} />
        <Text style={[styles.tabText, activeTab === 'suggestions' && styles.tabTextActive]}>
          Suggestions
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
        onPress={() => setActiveTab('discover')}
      >
        <Globe size={16} color={activeTab === 'discover' ? IOS_COLORS.blue : IOS_COLORS.gray} />
        <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
          Discover
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  const isSearching = searchQuery.trim().length >= 2;
  const displayUsers = isSearching ? searchResults : suggestions;
  const isLoadingUsers = isSearching ? searchLoading : loading;

  // Render content based on active tab and search state
  const renderContent = () => {
    // Debug: Log what we're rendering
    console.log('[CrewMemberFinderModal] renderContent - activeTab:', activeTab, 'discoverUsers:', discoverUsers.length, 'isLoadingDiscoverUsers:', isLoadingDiscoverUsers);

    // If searching, always show search results
    if (isSearching) {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SEARCH RESULTS</Text>
            {searchResults.length > 0 && (
              <Text style={styles.sectionCount}>{searchResults.length}</Text>
            )}
          </View>
          <ScrollView
            style={styles.userList}
            contentContainerStyle={styles.userListContent}
            showsVerticalScrollIndicator={false}
          >
            {searchLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={IOS_COLORS.blue} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              renderEmptySearch()
            ) : (
              searchResults.map((user) => renderUserRow(user))
            )}
          </ScrollView>
        </>
      );
    }

    // Show tab content
    if (activeTab === 'discover') {
      return (
        <ScrollView
          style={styles.userList}
          contentContainerStyle={styles.userListContent}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
            if (isCloseToBottom && hasMoreDiscoverUsers && !isLoadingDiscoverUsers) {
              loadMoreDiscoverUsers();
            }
          }}
          scrollEventThrottle={400}
        >
          {/* Similar Sailors Section - based on discovery algorithm */}
          {/* Falls back to Active Sailors when no similarity matches found */}
          {(loadingSimilar || similarSailors.length > 0) && (() => {
            // Detect if showing Active Sailors fallback vs actual Similar Sailors
            // Fallback reasons look like "X races" while similar reasons are "Same club", "Same boat class", etc.
            const isActiveSailorsFallback = similarSailors.length > 0 &&
              similarSailors.every(s => s.similarityReasons.some(r => /^\d+ races?$/.test(r)));
            const sectionTitle = isActiveSailorsFallback ? 'ACTIVE SAILORS' : 'SIMILAR SAILORS';
            const loadingText = isActiveSailorsFallback ? 'Finding active sailors...' : 'Finding similar sailors...';

            return (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                {similarSailors.length > 0 && (
                  <Text style={styles.sectionCount}>{similarSailors.length}</Text>
                )}
              </View>
              {loadingSimilar ? (
                <View style={styles.loadingContainerSmall}>
                  <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                  <Text style={styles.loadingTextSmall}>{loadingText}</Text>
                </View>
              ) : (
                similarSailors.map((user) => (
                  <View key={user.userId}>
                    {renderDiscoverUserRow({
                      userId: user.userId,
                      fullName: user.fullName,
                      avatarEmoji: user.avatarEmoji,
                      avatarColor: user.avatarColor,
                      isFollowing: user.isFollowing,
                    } as DiscoverableUser)}
                    {/* Show similarity reasons */}
                    <View style={styles.similarityReasons}>
                      {user.similarityReasons.slice(0, 2).map((reason, idx) => (
                        <View key={idx} style={styles.similarityBadge}>
                          <Text style={styles.similarityBadgeText}>{reason}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </>
          );})()}

          {/* All Users Section */}
          <View style={[styles.sectionHeader, similarSailors.length > 0 && { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>ALL USERS</Text>
            {discoverUsers.length > 0 && (
              <Text style={styles.sectionCount}>{discoverUsers.length}</Text>
            )}
          </View>
          {isLoadingDiscoverUsers && discoverUsers.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={IOS_COLORS.blue} />
              <Text style={styles.loadingText}>Loading users...</Text>
            </View>
          ) : discoverUsers.length === 0 ? (
            renderEmptyDiscover()
          ) : (
            <>
              {discoverUsers.map((user) => renderDiscoverUserRow(user))}
              {isLoadingDiscoverUsers && (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                </View>
              )}
            </>
          )}
        </ScrollView>
      );
    }

    // Suggestions tab
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SUGGESTED</Text>
          {suggestions.length > 0 && (
            <Text style={styles.sectionCount}>{suggestions.length}</Text>
          )}
        </View>
        <ScrollView
          style={styles.userList}
          contentContainerStyle={styles.userListContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={IOS_COLORS.blue} />
              <Text style={styles.loadingText}>Loading suggestions...</Text>
            </View>
          ) : suggestions.length === 0 ? (
            renderEmptySuggestions()
          ) : (
            suggestions.map((user) => renderUserRow(user))
          )}
        </ScrollView>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Find Crew</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={IOS_COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          {renderTabs()}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color={IOS_COLORS.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search BetterAt users..."
              placeholderTextColor={IOS_COLORS.gray}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color={IOS_COLORS.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.gray6,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  userList: {
    flex: 1,
  },
  userListContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: IOS_COLORS.gray,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },
  userRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  raceCountBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.systemBackground,
  },
  raceCountBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    flexShrink: 1,
  },
  raceCountText: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.blue,
    backgroundColor: `${IOS_COLORS.blue}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userSource: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  recentRacesPreview: {
    fontSize: 11,
    color: IOS_COLORS.gray2,
    marginTop: 3,
    fontStyle: 'italic',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  rolePickerContainer: {
    marginTop: 12,
    gap: 12,
  },
  rolePickerScroll: {
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 8,
  },
  roleOptionSelected: {
    backgroundColor: IOS_COLORS.blue,
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  roleOptionTextSelected: {
    color: '#fff',
  },
  rolePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Tab styles
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: IOS_COLORS.gray6,
  },
  tabActive: {
    backgroundColor: `${IOS_COLORS.blue}15`,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  tabTextActive: {
    color: IOS_COLORS.blue,
    fontWeight: '600',
  },
  // Discover actions (follow + add)
  discoverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Follow button styles
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
    minWidth: 80,
  },
  followButtonFollowing: {
    borderColor: IOS_COLORS.gray4,
    backgroundColor: IOS_COLORS.gray6,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  followButtonTextFollowing: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  // Load more container
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  // Similar sailors styles
  loadingContainerSmall: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTextSmall: {
    fontSize: 13,
    color: IOS_COLORS.gray,
  },
  similarityReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginTop: -8,
    gap: 6,
  },
  similarityBadge: {
    backgroundColor: IOS_COLORS.gray6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarityBadgeText: {
    fontSize: 11,
    color: IOS_COLORS.gray,
    fontWeight: '500',
  },
});

export default CrewMemberFinderModal;
