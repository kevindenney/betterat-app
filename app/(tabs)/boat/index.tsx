/**
 * Boats Screen
 *
 * Unified Tufte-style boats and tuning guides screen.
 * Segmented control switches between My Boats and Tuning Guides tabs.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useSailorDashboardData } from '@/hooks';
import { SailorBoatService, UserBoatWithDetails } from '@/services/SailorBoatService';
import {
  TuningGuide,
  FleetTuningGuide,
  tuningGuideService,
} from '@/services/tuningGuideService';
import { tuningGuideExtractionService } from '@/services/TuningGuideExtractionService';
import { createLogger } from '@/lib/utils/logger';
import { IOS_COLORS, TUFTE_BACKGROUND } from '@/components/cards/constants';

import { TufteBoatTabs } from '@/components/boats/TufteBoatTabs';
import { TufteTuningSection } from '@/components/boats/TufteTuningSection';
import { TufteTuningGuideRow } from '@/components/boats/TufteTuningGuideRow';

// Types
type TabValue = 'boats' | 'tuning';
type StatusFilter = 'all' | 'active' | 'stored' | 'sold' | 'retired';
type GuideFilter = 'all' | 'personal' | 'fleet';

const STATUS_THEMES: Record<StatusFilter, { bg: string; border: string; text: string; dot: string }> = {
  all: { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', dot: '#64748B' },
  active: { bg: '#DCFCE7', border: '#BBF7D0', text: '#166534', dot: IOS_COLORS.green },
  stored: { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', dot: IOS_COLORS.orange },
  sold: { bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: IOS_COLORS.red },
  retired: { bg: '#F3F4F6', border: '#E5E7EB', text: '#6B7280', dot: IOS_COLORS.gray },
};

export default function BoatsScreen() {
  const { user } = useAuth();
  const sailorData = useSailorDashboardData();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('boats');

  // Boats state
  const [boats, setBoats] = useState<UserBoatWithDetails[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(true);
  const [boatSearch, setBoatSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Tuning guides state
  const [personalGuides, setPersonalGuides] = useState<TuningGuide[]>([]);
  const [fleetGuides, setFleetGuides] = useState<FleetTuningGuide[]>([]);
  const [classGuides, setClassGuides] = useState<TuningGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [guideSearch, setGuideSearch] = useState('');
  const [guideFilter, setGuideFilter] = useState<GuideFilter>('all');
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});

  // Load boats
  useEffect(() => {
    if (user?.id) {
      loadBoats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load tuning guides
  useEffect(() => {
    if (user) {
      loadGuides();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sailorData.classes]);

  const loadBoats = useCallback(async () => {
    if (!user?.id) return;
    setBoatsLoading(true);
    try {
      const userBoats = await SailorBoatService.listBoatsForSailor(user.id);
      setBoats(userBoats);
    } catch (error) {
      logger.error('Failed to load boats:', error);
    } finally {
      setBoatsLoading(false);
    }
  }, [user?.id]);

  const loadGuides = useCallback(async () => {
    if (!user) return;
    setGuidesLoading(true);
    try {
      const { personal, fleet } = await tuningGuideService.getAllSailorGuides(user.id);
      setPersonalGuides(personal);
      setFleetGuides(fleet);

      // Load guides for user's boat classes
      const classGuidesPromises = sailorData.classes.map((cls) =>
        tuningGuideService.getGuidesForClass(cls.id)
      );
      const classGuidesArrays = await Promise.all(classGuidesPromises);
      const allClassGuides = classGuidesArrays.flat();

      // Filter out duplicates
      const personalGuideIds = new Set(personal.map((g) => g.id));
      const uniqueClassGuides = allClassGuides.filter((g) => !personalGuideIds.has(g.id));
      setClassGuides(uniqueClassGuides);
    } catch (error) {
      logger.error('Failed to load guides:', error);
    } finally {
      setGuidesLoading(false);
    }
  }, [user, sailorData.classes]);

  // Derived data
  const filteredBoats = useMemo(() => {
    let result = boats;
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (boatSearch.trim()) {
      const q = boatSearch.toLowerCase();
      result = result.filter(
        (b) =>
          b.boat_name?.toLowerCase().includes(q) ||
          b.boat_class_name.toLowerCase().includes(q) ||
          b.sail_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [boats, statusFilter, boatSearch]);

  const totalGuideCount = personalGuides.length + fleetGuides.length + classGuides.length;

  const filteredGuides = useMemo(() => {
    let guides: (TuningGuide | FleetTuningGuide)[] = [];
    if (guideFilter === 'personal') {
      guides = personalGuides;
    } else if (guideFilter === 'fleet') {
      guides = fleetGuides;
    } else {
      guides = [...personalGuides, ...fleetGuides, ...classGuides];
    }

    if (guideSearch.trim()) {
      const q = guideSearch.toLowerCase();
      guides = guides.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.source.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.extractedContent?.toLowerCase().includes(q) ||
          g.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return guides;
  }, [personalGuides, fleetGuides, classGuides, guideFilter, guideSearch]);

  // Group guides by boat class
  const guidesByClass = useMemo(() => {
    const grouped: Record<string, (TuningGuide | FleetTuningGuide)[]> = {};
    filteredGuides.forEach((guide) => {
      const className = guide.boatClassName || 'General';
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(guide);
    });
    return grouped;
  }, [filteredGuides]);

  // Handlers
  const handleAddBoat = useCallback(() => {
    router.push('/(tabs)/boat/add');
  }, []);

  const handleBoatPress = useCallback((boatId: string) => {
    router.push(`/(tabs)/boat/${boatId}`);
  }, []);

  const handleExtractContent = useCallback(
    async (guide: TuningGuide) => {
      if (!guide.fileUrl || guide.extractionStatus === 'completed') return;

      try {
        setExtracting((prev) => ({ ...prev, [guide.id]: true }));
        await tuningGuideExtractionService.extractContent(guide.id, guide.fileUrl, guide.fileType);
        showAlert('Success', 'Content extracted successfully!');
        await loadGuides();
      } catch (error) {
        logger.error('Error extracting content:', error);
        showAlert('Error', 'Failed to extract content from guide');
      } finally {
        setExtracting((prev) => ({ ...prev, [guide.id]: false }));
      }
    },
    [loadGuides]
  );

  const handleGuidePress = useCallback(
    async (guide: TuningGuide) => {
      if (user) {
        await tuningGuideService.recordView(guide.id, user.id);
      }
      const urlToOpen = guide.fileUrl || guide.sourceUrl;
      if (urlToOpen) {
        const canOpen = await Linking.canOpenURL(urlToOpen);
        if (canOpen) {
          await Linking.openURL(urlToOpen);
        }
      }
    },
    [user]
  );

  const handleAutoFetchGuides = useCallback(
    async (className: string, classId: string) => {
      showConfirm(
        `Fetch ${className} Guides`,
        `Search for tuning guides from North Sails, Quantum, and other sailmakers?`,
        async () => {
          await tuningGuideService.triggerAutoScrape(classId);
          showAlert('Searching...', `Looking for ${className} tuning guides...`);
          setTimeout(() => loadGuides(), 2000);
        },
        { confirmText: 'Fetch' }
      );
    },
    [loadGuides]
  );

  // Loading state
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Sign in to manage your boats</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLoading = activeTab === 'boats' ? boatsLoading : guidesLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Boats</Text>
        {activeTab === 'boats' && boats.length > 0 && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddBoat}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Segmented Control */}
      <TufteBoatTabs
        value={activeTab}
        onChange={setActiveTab}
        boatCount={boats.length}
        guideCount={totalGuideCount}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={IOS_COLORS.blue} />
          <Text style={styles.loadingText}>
            {activeTab === 'boats' ? 'Loading boats...' : 'Loading tuning guides...'}
          </Text>
        </View>
      ) : activeTab === 'boats' ? (
        /* ===== MY BOATS TAB ===== */
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {boats.length > 0 ? (
            <>
              {/* Search */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={IOS_COLORS.gray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search boats..."
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  value={boatSearch}
                  onChangeText={setBoatSearch}
                />
                {boatSearch !== '' && (
                  <TouchableOpacity onPress={() => setBoatSearch('')}>
                    <Ionicons name="close-circle" size={18} color={IOS_COLORS.gray} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContent}
              >
                {(['all', 'active', 'stored', 'sold', 'retired'] as StatusFilter[]).map((status) => {
                  const theme = STATUS_THEMES[status];
                  const isActive = statusFilter === status;
                  const count =
                    status === 'all' ? boats.length : boats.filter((b) => b.status === status).length;
                  if (status !== 'all' && count === 0) return null;

                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterChip,
                        isActive && { backgroundColor: theme.bg, borderColor: theme.border },
                      ]}
                      onPress={() => setStatusFilter(status)}
                    >
                      <View style={[styles.statusDot, { backgroundColor: theme.dot }]} />
                      <Text
                        style={[styles.filterChipText, isActive && { color: theme.text }]}
                      >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                        {' '}({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Boat List */}
              <View style={styles.boatList}>
                {filteredBoats.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No boats match your filters</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setBoatSearch('');
                        setStatusFilter('all');
                      }}
                    >
                      <Text style={styles.clearButton}>Clear filters</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredBoats.map((boat, index) => (
                    <TouchableOpacity
                      key={boat.id}
                      style={[styles.boatRow, index === filteredBoats.length - 1 && styles.boatRowLast]}
                      onPress={() => handleBoatPress(boat.id)}
                    >
                      <View style={styles.boatInfo}>
                        <View style={styles.boatTitleRow}>
                          <Text style={styles.boatName}>
                            {boat.boat_name || boat.boat_class_name}
                          </Text>
                          {boat.is_primary && (
                            <Text style={styles.primaryBadge}>Primary</Text>
                          )}
                        </View>
                        <Text style={styles.boatClass}>
                          {boat.boat_class_name}
                          {boat.sail_number && ` · ${boat.sail_number}`}
                        </Text>
                      </View>
                      <View style={styles.boatStatus}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_THEMES[boat.status || 'active'].dot },
                          ]}
                        />
                        <Text style={styles.boatStatusText}>{boat.status || 'active'}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </>
          ) : (
            /* Empty state for boats */
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="boat-outline" size={40} color={IOS_COLORS.blue} />
              </View>
              <Text style={styles.emptyTitle}>Build your fleet</Text>
              <Text style={styles.emptyText}>
                Add the boats you sail to track sails, maintenance, and race tuning.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddBoat}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Add your first boat</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        /* ===== TUNING GUIDES TAB ===== */
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={IOS_COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search guides, settings, conditions..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={guideSearch}
              onChangeText={setGuideSearch}
            />
            {guideSearch !== '' && (
              <TouchableOpacity onPress={() => setGuideSearch('')}>
                <Ionicons name="close-circle" size={18} color={IOS_COLORS.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Guide Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {(['all', 'personal', 'fleet'] as GuideFilter[]).map((filter) => {
              const isActive = guideFilter === filter;
              const count =
                filter === 'all'
                  ? totalGuideCount
                  : filter === 'personal'
                  ? personalGuides.length
                  : fleetGuides.length;

              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setGuideFilter(filter)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {filter === 'all' ? 'All' : filter === 'personal' ? 'My Guides' : 'Fleet'}
                    {' '}({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredGuides.length === 0 ? (
            /* Empty state for guides */
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="book-outline" size={40} color={IOS_COLORS.blue} />
              </View>
              <Text style={styles.emptyTitle}>
                {guideSearch ? 'No guides found' : 'No tuning guides yet'}
              </Text>
              <Text style={styles.emptyText}>
                {guideSearch
                  ? 'Try a different search term'
                  : sailorData.classes.length > 0
                  ? 'Fetch tuning guides for your boat classes'
                  : 'Add a boat to get tuning guides'}
              </Text>

              {/* Boat class quick-fetch */}
              {!guideSearch && sailorData.classes.length > 0 && (
                <View style={styles.classCards}>
                  {sailorData.classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={styles.classCard}
                      onPress={() => handleAutoFetchGuides(cls.name, cls.id)}
                    >
                      <View style={styles.classCardInfo}>
                        <Text style={styles.classCardName}>{cls.name}</Text>
                        {cls.sailNumber && (
                          <Text style={styles.classCardSail}>Sail #{cls.sailNumber}</Text>
                        )}
                      </View>
                      <Text style={styles.fetchLink}>Fetch Guides →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* Guides grouped by class */
            Object.entries(guidesByClass).map(([className, guides]) => (
              <TufteTuningSection
                key={className}
                title={className}
                action="Fetch Guides"
                onActionPress={() => {
                  const cls = sailorData.classes.find((c) => c.name === className);
                  if (cls) handleAutoFetchGuides(cls.name, cls.id);
                }}
              >
                {guides.map((guide, index) => {
                  const isFleet = fleetGuides.some((fg) => fg.id === guide.id);
                  const fleetGuide = isFleet ? (guide as FleetTuningGuide) : null;

                  return (
                    <TufteTuningGuideRow
                      key={guide.id}
                      title={guide.title}
                      source={guide.source}
                      year={guide.year}
                      extractionStatus={guide.extractionStatus}
                      tags={guide.tags}
                      isFleet={isFleet}
                      sharedBy={fleetGuide?.sharedByName}
                      isExtracting={extracting[guide.id]}
                      onPress={() => handleGuidePress(guide)}
                      onExtract={
                        guide.fileUrl && guide.fileType === 'pdf' && guide.extractionStatus !== 'completed'
                          ? () => handleExtractContent(guide)
                          : undefined
                      }
                      isLast={index === guides.length - 1}
                    />
                  );
                })}
              </TufteTuningSection>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const logger = createLogger('BoatsScreen');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TUFTE_BACKGROUND,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.5,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: IOS_COLORS.blue,
    borderColor: IOS_COLORS.blue,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  boatList: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  boatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  boatRowLast: {
    borderBottomWidth: 0,
  },
  boatInfo: {
    flex: 1,
    gap: 2,
  },
  boatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boatName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  primaryBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.blue,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  boatClass: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  boatStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boatStatusText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  chevron: {
    fontSize: 20,
    color: IOS_COLORS.tertiaryLabel,
    marginLeft: 4,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.blue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  classCards: {
    width: '100%',
    gap: 10,
    marginTop: 16,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  classCardInfo: {
    gap: 2,
  },
  classCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  classCardSail: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  fetchLink: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
});
