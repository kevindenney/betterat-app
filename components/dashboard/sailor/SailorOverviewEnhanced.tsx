import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import type { FleetActivityEntry, FleetOverview } from '@/services/fleetService';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClassSelector, ClubsAssociationsSection, CrewManagement, TuningGuidesSection } from '../../sailor';
import { CardMenu, CardMenuItem } from '../../shared';
import { DashboardSection } from '../shared';
import { NextRaceCard } from './NextRaceCard';
import { useRaceTuningRecommendation } from '@/hooks/useRaceTuningRecommendation';

interface UpcomingRace {
  id: string;
  title: string;
  venue: string;
  country: string;
  startDate: string;
  daysUntil: number;
  strategyStatus: 'ready' | 'in_progress' | 'pending';
  weatherConfidence: number;
  hasDocuments: boolean;
  hasTuningGuides?: boolean;
  hasCrewAssigned?: boolean;
  classId?: string;
}

interface SailorStats {
  totalRegattas: number;
  venuesVisited: number;
  avgPosition: number;
  globalRanking: number;
  recentRaces: number;
  strategyWinRate: number;
}

interface SailorClass {
  id: string;
  name: string;
  sailNumber?: string;
  boatName?: string;
  isPrimary?: boolean;
}

interface SailorOverviewProps {
  upcomingRaces: UpcomingRace[];
  stats: SailorStats;
  currentVenue?: {
    name: string;
    country: string;
    confidence: number;
  };
  classes?: SailorClass[];
  activeClassId?: string | null;
  sailorId?: string;
  fleetOverview?: FleetOverview | null;
  fleetActivity?: FleetActivityEntry[];
  onRacePress: (raceId: string) => void;
  onPlanStrategy: (raceId: string) => void;
  onUploadDocuments: () => void;
  onCheckWeather: () => void;
  onViewVenues: () => void;
  onClassChange?: (classId: string) => void;
  onAddBoat?: () => void;
  onOpenFleet?: () => void;
}

export function SailorOverviewEnhanced({
  upcomingRaces,
  stats: _stats,
  currentVenue,
  classes = [],
  activeClassId,
  sailorId,
  onRacePress,
  onPlanStrategy,
  onUploadDocuments,
  onCheckWeather,
  onViewVenues,
  onClassChange,
  onAddBoat,
  fleetOverview,
  fleetActivity,
  onOpenFleet,
}: SailorOverviewProps) {
  const [selectedClassId, setSelectedClassId] = useState(activeClassId || classes[0]?.id);
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    onClassChange?.(classId);
  };

  const handleAddBoat = () => {
    if (onAddBoat) {
      onAddBoat();
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const filteredRaces = selectedClassId
    ? upcomingRaces.filter(race => race.classId === selectedClassId || !race.classId)
    : upcomingRaces;
  const nextRace = filteredRaces[0];

  const nextRaceClassId = useMemo(() => {
    if (!nextRace) return selectedClassId ?? null;
    return (
      (nextRace.classId as string | undefined) ||
      (nextRace.class_id as string | undefined) ||
      selectedClassId ||
      null
    );
  }, [nextRace, selectedClassId]);

  const nextRaceClassName = useMemo(() => {
    if (nextRace?.classId) {
      const match = classes.find(cls => cls.id === nextRace.classId);
      if (match?.name) return match.name;
    }
    if (nextRace?.class_id) {
      const match = classes.find(cls => cls.id === nextRace.class_id);
      if (match?.name) return match.name;
    }
    return selectedClass?.name;
  }, [classes, nextRace?.classId, nextRace?.class_id, selectedClass?.name]);

  const nextRaceAverageWind = useMemo(() => {
    const wind: any = nextRace?.wind;
    if (!wind) return undefined;
    if (typeof wind.speed === 'number') return wind.speed;
    const speedMin = typeof wind.speedMin === 'number' ? wind.speedMin : undefined;
    const speedMax = typeof wind.speedMax === 'number' ? wind.speedMax : undefined;
    if (speedMin != null && speedMax != null) return (speedMin + speedMax) / 2;
    return speedMin ?? speedMax ?? undefined;
  }, [nextRace?.wind]);

  const {
    recommendation: nextRaceRecommendation,
    settings: nextRaceSettings,
    loading: nextRaceTuningLoading,
  } = useRaceTuningRecommendation({
    classId: nextRaceClassId,
    className: nextRaceClassName,
    averageWindSpeed: nextRaceAverageWind,
    pointsOfSail: 'upwind',
    enabled: !!(nextRaceClassId || nextRaceClassName),
  });

  const nextRaceTuning = useMemo(() => {
    if (!nextRaceClassId) return null;
    if (nextRaceTuningLoading) {
      return { items: [], loading: true } as const;
    }
    const className = nextRaceClassName || 'this class';

    if (!nextRaceRecommendation) {
      return {
        items: [],
        message: `Add tuning guides for ${className} to unlock race-day rig presets.`,
      } as const;
    }

    if (nextRaceSettings.length === 0) {
      return {
        items: [],
        message: `Extract rig settings from your ${className} tuning guides to prepare this race.`,
        sourceTitle: nextRaceRecommendation.guideTitle,
      } as const;
    }

    return {
      items: nextRaceSettings.map(setting => ({ label: setting.label, value: setting.value })),
      sourceTitle: nextRaceRecommendation.guideTitle,
      windSummary: nextRaceRecommendation.conditionSummary
        ? `Wind window: ${nextRaceRecommendation.conditionSummary}`
        : undefined,
    } as const;
  }, [
    nextRaceClassId,
    nextRaceTuningLoading,
    nextRaceRecommendation,
    nextRaceSettings,
    nextRaceClassName,
  ]);

  const handleOpenFleet = () => {
    if (onOpenFleet) {
      onOpenFleet();
    } else {
      router.push('/(tabs)/fleet');
    }
  };

  const recentFleetActivity = useMemo(() => (fleetActivity || []).slice(0, 3), [fleetActivity]);

  const getFleetActivityIcon = (type: FleetActivityEntry['activityType']) => {
    switch (type) {
      case 'document_uploaded':
        return 'file-arrow-up-down';
      case 'announcement':
        return 'bullhorn';
      case 'event_created':
        return 'calendar-star';
      case 'member_joined':
        return 'account-plus';
      case 'member_left':
        return 'account-minus';
      case 'resource_shared':
        return 'bookshelf';
      default:
        return 'information-outline';
    }
  };

  const getFleetActivityLabel = (entry: FleetActivityEntry) => {
    if (entry.payload?.title) {
      return String(entry.payload.title);
    }
    switch (entry.activityType) {
      case 'document_uploaded':
        return 'New document uploaded to your fleet';
      case 'announcement':
        return 'Fleet announcement shared';
      case 'event_created':
        return 'New fleet event created';
      case 'member_joined':
        return 'A new member joined the fleet';
      case 'member_left':
        return 'A member left the fleet';
      case 'resource_shared':
        return 'Resource shared with your fleet';
      default:
        return 'Fleet update';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Boat Selector - Primary Navigation */}
      {classes.length > 0 && (
        <View style={styles.boatSelectorSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>My Boats</Text>
              <TouchableOpacity
                style={styles.addBoatButton}
                onPress={handleAddBoat}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#3B82F6" />
                <Text style={styles.addBoatButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Select a boat to view its calendar, crew, and resources
            </Text>
          </View>
          <ClassSelector
            classes={classes.map(cls => ({
              id: cls.id,
              name: cls.name,
              sailNumber: cls.sailNumber || '',
              boatName: cls.boatName,
              isPrimary: cls.isPrimary || false
            }))}
            selectedClassId={selectedClassId}
            onClassSelect={handleClassChange}
            onAddBoat={handleAddBoat}
          />
        </View>
      )}

      {/* Active Boat Context Bar */}
      {selectedClass && (
        <View style={styles.contextBar}>
          <View style={styles.contextBarContent}>
            <MaterialCommunityIcons name="sail-boat" size={20} color="#1D4ED8" />
            <View style={styles.contextBarText}>
              <Text style={styles.contextBarTitle}>
                {selectedClass.name}
                {selectedClass.sailNumber && ` #${selectedClass.sailNumber}`}
              </Text>
              <Text style={styles.contextBarSubtitle}>
                All content below is for this boat
              </Text>
            </View>
          </View>
          <View style={styles.activeIndicator} />
        </View>
      )}

      {/* Current Venue Context */}
      {currentVenue && (
        <DashboardSection
          title="📍 Current Location"
          subtitle="Auto-detected venue with global intelligence"
          showBorder={false}
          padding={16}
          backgroundColor="#F5F3FF"
          borderColor="#EDE9FE"
          shadowColor="#8B5CF6"
        >
          <LinearGradient
            colors={['#4C63D2', '#667eea']}
            style={styles.venueCard}
          >
            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>{currentVenue.name}</Text>
              <Text style={styles.venueLocation}>{currentVenue.country}</Text>
              <Text style={styles.venueConfidence}>
                Confidence: {Math.round(currentVenue.confidence * 100)}%
              </Text>
            </View>
            <TouchableOpacity
              style={styles.venueAction}
              onPress={onViewVenues}
            >
              <MaterialCommunityIcons name="map-search" size={20} color="#FFFFFF" />
              <Text style={styles.venueActionText}>View Details</Text>
            </TouchableOpacity>
          </LinearGradient>
        </DashboardSection>
      )}

      {/* Fleet Overview */}
      <DashboardSection
        title="🛥️ Your Fleet"
        subtitle={fleetOverview ? `Updates from ${fleetOverview.fleet.name}` : 'Join or open your fleet to collaborate with other sailors'}
        headerAction={{
          label: fleetOverview ? 'Open Fleet' : 'Find Fleets',
          onPress: handleOpenFleet,
          icon: fleetOverview ? 'people-circle-outline' : 'add-circle-outline'
        }}
      >
        {fleetOverview ? (
          <View style={styles.fleetCard}>
            <View style={styles.fleetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fleetName}>{fleetOverview.fleet.name}</Text>
                {fleetOverview.fleet.region && (
                  <Text style={styles.fleetSubtitle}>{fleetOverview.fleet.region}</Text>
                )}
              </View>
              <MaterialCommunityIcons name="account-group" size={28} color="#007AFF" />
            </View>

            <View style={styles.fleetMetricsRow}>
              <View style={styles.fleetMetricItem}>
                <Text style={styles.fleetMetricValue}>{fleetOverview.metrics.members}</Text>
                <Text style={styles.fleetMetricLabel}>Members</Text>
              </View>
              <View style={styles.fleetMetricItem}>
                <Text style={styles.fleetMetricValue}>{fleetOverview.metrics.followers}</Text>
                <Text style={styles.fleetMetricLabel}>Followers</Text>
              </View>
              <View style={styles.fleetMetricItem}>
                <Text style={styles.fleetMetricValue}>{fleetOverview.metrics.documents}</Text>
                <Text style={styles.fleetMetricLabel}>Resources</Text>
              </View>
            </View>

            <View style={styles.fleetMetaRow}>
              <View style={styles.fleetPill}>
                <MaterialCommunityIcons name="shield-account" size={14} color="#1D4ED8" />
                <Text style={styles.fleetPillText}>{fleetOverview.fleet.visibility === 'public' ? 'Public fleet' : fleetOverview.fleet.visibility === 'club' ? 'Club fleet' : 'Private fleet'}</Text>
              </View>
              {fleetOverview.fleet.whatsappLink && (
                <View style={[styles.fleetPill, styles.fleetPillHighlight]}>
                  <MaterialCommunityIcons name="whatsapp" size={14} color="#047857" />
                  <Text style={[styles.fleetPillText, styles.fleetPillHighlightText]}>WhatsApp linked</Text>
                </View>
              )}
            </View>

            {recentFleetActivity.length > 0 ? (
              <View style={styles.fleetActivityList}>
                {recentFleetActivity.map(entry => (
                  <View key={entry.id} style={styles.fleetActivityRow}>
                    <View style={styles.fleetActivityIcon}>
                      <MaterialCommunityIcons name={getFleetActivityIcon(entry.activityType) as any} size={18} color="#007AFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fleetActivityTitle}>{getFleetActivityLabel(entry)}</Text>
                      <Text style={styles.fleetActivityMeta}>{new Date(entry.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.placeholderText}>No fleet updates yet—share a tuning guide or announcement to kick things off.</Text>
            )}
          </View>
        ) : (
          <View style={styles.fleetEmptyCard}>
            <MaterialCommunityIcons name="account-group-outline" size={32} color="#94A3B8" />
            <Text style={styles.fleetEmptyTitle}>You haven't joined a fleet yet</Text>
            <Text style={styles.fleetEmptyText}>Select a home venue or open the Fleet tab to discover fleets for your class.</Text>
          </View>
        )}
      </DashboardSection>

      {/* Upcoming Races - Class Filtered */}
      <DashboardSection
        title={selectedClass ? `📅 ${selectedClass.name} Calendar` : "📅 Race Calendar"}
        subtitle={selectedClass ? `Races for ${selectedClass.name}${selectedClass.sailNumber ? ` #${selectedClass.sailNumber}` : ''}` : undefined}
        backgroundColor="#F0F9FF"
        borderColor="#E0F2FE"
        shadowColor="#0EA5E9"
      >
        {filteredRaces.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-multiselect" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {selectedClass ? `No ${selectedClass.name} Races` : 'No Upcoming Races'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedClass
                ? `Add races for your ${selectedClass.name}${selectedClass.sailNumber ? ` #${selectedClass.sailNumber}` : ''} to see them here`
                : 'Add races to your calendar to see them here'}
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {}}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#FFFFFF" />
              <Text style={styles.emptyStateButtonText}>Add Race</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.racesScroll}
          >
            {/* Next Race Card - Special double-width card for the next race */}
            {nextRace && (
              <NextRaceCard
                raceId={nextRace.id}
                raceTitle={nextRace.title}
                venue={nextRace.venue}
                raceTime="14:00"
                numberOfStarts={3}
                startOrder={['Optimist', 'Laser', '420']}
                vhfChannel="72"
                windSpeed="12-15 kts"
                windDirection="SW"
                waveHeight="1-2 ft"
                tideInfo="High 13:45"
                rigTuning={nextRaceTuning ?? undefined}
                onPress={() => router.push(`/(tabs)/race/scrollable/${nextRace.id}`)}
              />
            )}

            {filteredRaces.slice(0, 5).map((race) => {
              const raceMenuItems: CardMenuItem[] = [
                {
                  label: 'View Details',
                  icon: 'information-circle-outline',
                  onPress: () => onRacePress(race.id),
                },
                {
                  label: 'Plan Strategy',
                  icon: 'compass-outline',
                  onPress: () => onPlanStrategy(race.id),
                },
                {
                  label: 'Upload Documents',
                  icon: 'cloud-upload-outline',
                  onPress: () => onUploadDocuments(),
                },
                {
                  label: 'Check Weather',
                  icon: 'cloudy-outline',
                  onPress: () => onCheckWeather(),
                },
                {
                  label: 'Edit Race',
                  icon: 'create-outline',
                  onPress: () => {},
                },
                {
                  label: 'Remove Race',
                  icon: 'trash-outline',
                  onPress: () => {},
                  variant: 'destructive' as const,
                },
              ];

              return (
                <TouchableOpacity
                  key={race.id}
                  style={styles.raceCard}
                  onPress={() => router.push(`/(tabs)/race/scrollable/${race.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[
                      styles.raceCountdown,
                      race.daysUntil > 180 ? styles.countdownOrange : styles.countdownYellow
                    ]}>
                      <Text style={[
                        styles.countdownNumber,
                        race.daysUntil > 180 ? styles.countdownNumberOrange : styles.countdownNumberYellow
                      ]}>
                        {race.daysUntil}
                      </Text>
                      <Text style={styles.countdownLabel}>days</Text>
                    </View>
                    <CardMenu items={raceMenuItems} />
                  </View>

                  <View style={styles.raceInfo}>
                    <Text style={styles.raceTitle} numberOfLines={2}>{race.title}</Text>
                    <Text style={styles.raceVenue} numberOfLines={1}>{race.venue}</Text>
                    <Text style={styles.raceDate}>{race.startDate}</Text>
                  </View>

                  {/* Status Indicators */}
                  <View style={styles.statusIndicators}>
                    <View style={styles.statusRow}>
                      <MaterialCommunityIcons
                        name={race.strategyStatus === 'ready' ? 'compass-outline' : 'compass-off-outline'}
                        size={16}
                        color={race.strategyStatus === 'ready' ? '#10B981' : '#EF4444'}
                      />
                      <Text style={[
                        styles.statusLabel,
                        { color: race.strategyStatus === 'ready' ? '#10B981' : '#EF4444' }
                      ]}>
                        {race.strategyStatus === 'ready' ? 'Strategy' : 'No Strategy'}
                      </Text>
                    </View>

                    <View style={styles.statusRow}>
                      <MaterialCommunityIcons
                        name={race.hasDocuments ? 'file-check-outline' : 'file-alert-outline'}
                        size={16}
                        color={race.hasDocuments ? '#10B981' : '#F59E0B'}
                      />
                      <Text style={[
                        styles.statusLabel,
                        { color: race.hasDocuments ? '#10B981' : '#F59E0B' }
                      ]}>
                        {race.hasDocuments ? 'Docs' : 'Need Docs'}
                      </Text>
                    </View>

                    <View style={styles.statusRow}>
                      <MaterialCommunityIcons
                        name={race.hasCrewAssigned ? 'account-group' : 'account-group-outline'}
                        size={16}
                        color={race.hasCrewAssigned ? '#10B981' : '#94A3B8'}
                      />
                      <Text style={[
                        styles.statusLabel,
                        { color: race.hasCrewAssigned ? '#10B981' : '#94A3B8' }
                      ]}>
                        {race.hasCrewAssigned ? 'Crew' : 'No Crew'}
                      </Text>
                    </View>
                  </View>

                  {/* Missing Items Alert */}
                  {(!race.strategyStatus || race.strategyStatus === 'pending' || !race.hasDocuments || !race.hasCrewAssigned) && (
                    <View style={styles.missingAlert}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#F59E0B" />
                      <Text style={styles.missingText} numberOfLines={1}>
                        Missing: {[
                          (!race.strategyStatus || race.strategyStatus === 'pending') && 'Strategy',
                          !race.hasDocuments && 'Docs',
                          !race.hasCrewAssigned && 'Crew'
                        ].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Add Race Card */}
            <TouchableOpacity
              style={styles.addRaceCard}
              onPress={() => router.push('/(tabs)/race/add-tufte')}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={32} color="#3B82F6" />
              <Text style={styles.addRaceText}>Add Race</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </DashboardSection>

      {/* Content Message when no boat selected */}
      {!selectedClass && classes.length > 0 && (
        <View style={styles.selectBoatPrompt}>
          <MaterialCommunityIcons name="arrow-up-thin" size={32} color="#94A3B8" />
          <Text style={styles.selectBoatPromptTitle}>Select a Boat</Text>
          <Text style={styles.selectBoatPromptText}>
            Choose a boat above to view your races, crew, tuning guides, and more
          </Text>
        </View>
      )}

      {/* Class-Specific Content - Only shown when a boat is selected */}
      {selectedClass && (
        <>
          {/* Tuning Guides Section */}
          <TuningGuidesSection
            classId={selectedClass.id}
            className={selectedClass.name}
            sailorId={sailorId}
            onUpload={() => {
              onUploadDocuments();
            }}
            onViewAll={() => {
              router.push('/(tabs)/fleet/resources');
            }}
          />

          {/* Crew Management Section */}
          {sailorId ? (
            <CrewManagement
              sailorId={sailorId}
              classId={selectedClass.id}
              className={selectedClass.name}
              sailNumber={selectedClass.sailNumber}
            />
          ) : (
            <DashboardSection
              title={`👥 Crew - ${selectedClass.name}${selectedClass.sailNumber ? ` #${selectedClass.sailNumber}` : ''}`}
              subtitle="Sign in again to manage crew members"
              showBorder={false}
            >
              <View style={styles.crewPlaceholder}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.crewPlaceholderText}>
                  We couldn't find your sailor ID. Please refresh your session to load crew data.
                </Text>
              </View>
            </DashboardSection>
          )}
        </>
      )}

      {/* Global Sections - Always visible */}
      <ClubsAssociationsSection
        sailorId={sailorId}
        classId={selectedClassId}
        className={selectedClass?.name}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  boatSelectorSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 4px',
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  addBoatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  addBoatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  contextBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    boxShadow: '0px 2px',
    elevation: 3,
  },
  contextBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  contextBarText: {
    flex: 1,
  },
  contextBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  contextBarSubtitle: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  contextBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectBoatPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    boxShadow: '0px 4px',
    elevation: 3,
  },
  selectBoatPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  selectBoatPromptText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  crewPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  crewPlaceholderText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
  },
  venueCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    boxShadow: '0px 4px',
    elevation: 5,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  venueConfidence: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  venueAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  venueActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  raceCountdown: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  countdownYellow: {
    backgroundColor: '#FEF3C7',
  },
  countdownOrange: {
    backgroundColor: '#FFEDD5',
  },
  countdownNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  countdownNumberYellow: {
    color: '#D97706',
  },
  countdownNumberOrange: {
    color: '#EA580C',
  },
  countdownLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  raceStatus: {
    marginBottom: 12,
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#64748B',
  },
  strategyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  strategyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginHorizontal: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  racesScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  raceCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 6px',
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  raceInfo: {
    gap: 4,
  },
  raceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 18,
  },
  raceVenue: {
    fontSize: 12,
    color: '#64748B',
  },
  raceDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  raceStatusBadges: {
    marginTop: 12,
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  missingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  missingText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: '#92400E',
  },
  addRaceCard: {
    width: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addRaceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  fleetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    boxShadow: '0px 6px',
    elevation: 3,
  },
  fleetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fleetName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  fleetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  fleetMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fleetMetricItem: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  fleetMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3730A3',
  },
  fleetMetricLabel: {
    fontSize: 12,
    color: '#6366F1',
  },
  fleetMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fleetPillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  fleetPillHighlight: {
    backgroundColor: '#DCFCE7',
  },
  fleetPillHighlightText: {
    color: '#047857',
  },
  fleetActivityList: {
    gap: 10,
  },
  fleetActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fleetActivityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetActivityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  fleetActivityMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  fleetEmptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fleetEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  fleetEmptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: -4,
  },
});
