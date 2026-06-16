import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FleetCard } from '@/components/fleets/FleetCard';
import { FleetFeed } from '@/components/fleets/FleetFeed';
import { MembersList } from '@/components/fleets/MembersList';
import { FleetInviteSheet } from '@/components/fleets/FleetInviteSheet';
import { TuningLibrary } from '@/components/fleets/TuningLibrary';
import { Leaderboard } from '@/components/fleets/Leaderboard';
import { FleetDiscoveryService, Fleet as DiscoveredFleet } from '@/services/FleetDiscoveryService';
import { useAuth } from '@/providers/AuthProvider';

type TabType = 'feed' | 'members' | 'tuning' | 'events' | 'leaderboard';

interface Fleet {
  id: string;
  name: string;
  boat_class: string;
  member_count: number;
  recent_activity?: string;
  user_stats?: {
    rank: number;
    points: number;
    events_participated: number;
  };
}

export default function FleetsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);

  // Join Fleet Modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiscoveredFleet[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);

  // Create Fleet Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFleetName, setNewFleetName] = useState('');
  const [newFleetDescription, setNewFleetDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [fleets, setFleets] = useState<Fleet[]>([
    {
      id: '1',
      name: 'Dragon Hong Kong Fleet',
      boat_class: 'Dragon',
      member_count: 24,
      recent_activity: 'Race results posted 2 hours ago',
      user_stats: {
        rank: 5,
        points: 72,
        events_participated: 10,
      },
    },
    {
      id: '2',
      name: 'J/70 Asian Circuit',
      boat_class: 'J/70',
      member_count: 18,
      recent_activity: 'New tuning guide shared 1 day ago',
      user_stats: {
        rank: 8,
        points: 56,
        events_participated: 6,
      },
    },
  ]);

  const tabs: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'feed', label: 'Feed', icon: 'newspaper' },
    { id: 'members', label: 'Members', icon: 'people' },
    { id: 'tuning', label: 'Tuning', icon: 'construct' },
    { id: 'events', label: 'Events', icon: 'calendar' },
    { id: 'leaderboard', label: 'Standings', icon: 'trophy' },
  ];

  // Search for fleets
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await FleetDiscoveryService.searchFleets(query);
      // Filter out fleets user is already a member of
      const existingIds = new Set(fleets.map(f => f.id));
      setSearchResults(results.filter(f => !existingIds.has(f.id)));
    } catch (error) {
      console.error('Error searching fleets:', error);
    } finally {
      setIsSearching(false);
    }
  }, [fleets]);

  // Join a fleet
  const handleJoinFleet = useCallback(async (fleetToJoin: DiscoveredFleet) => {
    if (!user?.id) {
      showAlert('Error', 'Please sign in to join a fleet');
      return;
    }

    setIsJoining(fleetToJoin.id);
    try {
      const membership = await FleetDiscoveryService.joinFleet(user.id, fleetToJoin.id);
      if (membership) {
        // Add to local fleets list
        const newFleet: Fleet = {
          id: fleetToJoin.id,
          name: fleetToJoin.name,
          boat_class: fleetToJoin.boat_classes?.name || 'Unknown',
          member_count: (fleetToJoin.member_count || 0) + 1,
          recent_activity: 'Just joined',
        };
        setFleets(prev => [...prev, newFleet]);
        setShowJoinModal(false);
        setSearchQuery('');
        setSearchResults([]);
        showAlert('Success', `You've joined ${fleetToJoin.name}!`);
      }
    } catch (error) {
      console.error('Error joining fleet:', error);
      showAlert('Error', 'Failed to join fleet. Please try again.');
    } finally {
      setIsJoining(null);
    }
  }, [user]);

  // Create a new fleet
  const handleCreateFleet = useCallback(async () => {
    if (!user?.id) {
      showAlert('Error', 'Please sign in to create a fleet');
      return;
    }

    if (!newFleetName.trim()) {
      showAlert('Error', 'Please enter a fleet name');
      return;
    }

    setIsCreating(true);
    try {
      const newFleet = await FleetDiscoveryService.createFleet(user.id, {
        name: newFleetName.trim(),
        description: newFleetDescription.trim() || undefined,
        visibility: 'public',
      });

      if (newFleet) {
        // Add to local fleets list
        const fleetForList: Fleet = {
          id: newFleet.id,
          name: newFleet.name,
          boat_class: newFleet.boat_classes?.name || 'General',
          member_count: 1,
          recent_activity: 'Just created',
          user_stats: {
            rank: 1,
            points: 0,
            events_participated: 0,
          },
        };
        setFleets(prev => [...prev, fleetForList]);
        setShowCreateModal(false);
        setNewFleetName('');
        setNewFleetDescription('');
        showAlert('Success', `Fleet "${newFleet.name}" created!`);
      }
    } catch (error) {
      console.error('Error creating fleet:', error);
      showAlert('Error', 'Failed to create fleet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [user, newFleetName, newFleetDescription]);

  const renderFleetList = () => (
    <View style={styles.listContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Fleets</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton}>
            <Ionicons name="search" size={24} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={fleets}
        renderItem={({ item }) => (
          <FleetCard
            fleet={item}
            onPress={() => setSelectedFleet(item)}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.fleetsList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.actionButtons}>
            <Pressable style={styles.primaryButton} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Create Fleet</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowJoinModal(true)}>
              <Ionicons name="enter" size={20} color="#3B82F6" />
              <Text style={styles.secondaryButtonText}>Join Fleet</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );

  const renderDetailView = () => {
    if (!selectedFleet) return null;

    return (
      <Modal
        visible={!!selectedFleet}
        animationType="slide"
        onRequestClose={() => setSelectedFleet(null)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => setSelectedFleet(null)}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </Pressable>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>{selectedFleet.name}</Text>
              <Text style={styles.modalSubtitle}>{selectedFleet.boat_class}</Text>
            </View>
            <Pressable style={styles.iconButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.tabsContainer}>
            {tabs.map(tab => (
              <Pressable
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon}
                  size={20}
                  color={activeTab === tab.id ? '#3B82F6' : '#9CA3AF'}
                />
                <Text style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.tabLabelActive
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'feed' && <FleetFeed fleetId={selectedFleet.id} />}
            {activeTab === 'members' && (
              <>
                <View style={styles.membersHeader}>
                  <Pressable
                    style={styles.inviteButton}
                    onPress={() => setInviteSheetOpen(true)}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.inviteButtonText}>Invite members</Text>
                  </Pressable>
                </View>
                <MembersList fleetId={selectedFleet.id} />
              </>
            )}
            {activeTab === 'tuning' && <TuningLibrary fleetId={selectedFleet.id} />}
            {activeTab === 'events' && (
              <View style={styles.comingSoon}>
                <Ionicons name="calendar-outline" size={52} color="#3B82F6" />
                <Text style={styles.comingSoonText}>Fleet Events</Text>
                <Text style={styles.comingSoonSubtext}>
                  Open event operations and race management for this fleet.
                </Text>
                <View style={styles.eventsActions}>
                  <Pressable style={styles.eventsActionPrimary} onPress={() => router.push('/(tabs)/events')}>
                    <Text style={styles.eventsActionPrimaryText}>Open Events</Text>
                  </Pressable>
                  <Pressable style={styles.eventsActionSecondary} onPress={() => router.push('/(tabs)/programs')}>
                    <Text style={styles.eventsActionSecondaryText}>Race Ops</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {activeTab === 'leaderboard' && <Leaderboard fleetId={selectedFleet.id} />}
          </View>
          <FleetInviteSheet
            visible={inviteSheetOpen}
            onClose={() => setInviteSheetOpen(false)}
            fleetId={selectedFleet.id}
            fleetName={selectedFleet.name}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  // Join Fleet Modal
  const renderJoinModal = () => (
    <Modal
      visible={showJoinModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowJoinModal(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <View style={styles.modalHeader}>
          <Pressable style={styles.backButton} onPress={() => setShowJoinModal(false)}>
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle}>Join a Fleet</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fleets by name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          {isSearching && <ActivityIndicator size="small" color="#3B82F6" />}
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.searchResults}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              {searchQuery.length < 2 ? (
                <>
                  <Ionicons name="boat-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Search for fleets to join</Text>
                  <Text style={styles.emptySubtext}>Enter at least 2 characters</Text>
                </>
              ) : !isSearching ? (
                <>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No fleets found</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.searchResultItem}>
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{item.name}</Text>
                <Text style={styles.searchResultMeta}>
                  {item.boat_classes?.name || 'General'} • {item.member_count || 0} members
                </Text>
                {item.description && (
                  <Text style={styles.searchResultDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Pressable
                style={[styles.joinButton, isJoining === item.id && styles.joinButtonDisabled]}
                onPress={() => handleJoinFleet(item)}
                disabled={isJoining === item.id}
              >
                {isJoining === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.joinButtonText}>Join</Text>
                )}
              </Pressable>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );

  // Create Fleet Modal
  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <View style={styles.modalHeader}>
          <Pressable style={styles.backButton} onPress={() => setShowCreateModal(false)}>
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle}>Create Fleet</Text>
          </View>
          <Pressable
            style={[styles.createButton, (!newFleetName.trim() || isCreating) && styles.createButtonDisabled]}
            onPress={handleCreateFleet}
            disabled={!newFleetName.trim() || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Fleet Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., Dragon Hong Kong Fleet"
              placeholderTextColor="#9CA3AF"
              value={newFleetName}
              onChangeText={setNewFleetName}
              autoFocus
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="Tell others about your fleet..."
              placeholderTextColor="#9CA3AF"
              value={newFleetDescription}
              onChangeText={setNewFleetDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formNote}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.formNoteText}>
              You'll be the owner of this fleet and can invite others to join.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderFleetList()}
      {renderDetailView()}
      {renderJoinModal()}
      {renderCreateModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#007AFF',
  },
  inviteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetsList: {
    paddingVertical: 8,
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  comingSoonText: {
    fontSize: 18,
    color: '#1E3A8A',
    marginTop: 12,
    fontWeight: '600',
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  eventsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  eventsActionPrimary: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eventsActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  eventsActionSecondary: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eventsActionSecondaryText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  // Join Fleet Modal styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchResults: {
    paddingHorizontal: 16,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  searchResultMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  searchResultDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  joinButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Create Fleet Modal styles
  createButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formContainer: {
    padding: 16,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  formTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  formNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  formNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
