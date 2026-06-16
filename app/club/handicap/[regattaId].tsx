/**
 * Handicap Calculator Dashboard
 * Manage ratings and view corrected time results
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Calculator,
  Clock,
  Trophy,
  X,
  Check,
  ChevronDown,
  Search,
  RefreshCw,
  Ship,
  Target,
  Trash2,
} from 'lucide-react-native';
import {
  handicapService,
  HandicapSystem,
  BoatRating,
  RaceResultWithHandicap,
  HandicapStanding,
} from '@/services/HandicapService';

type TabType = 'results' | 'ratings' | 'standings';

export default function HandicapCalculatorDashboard() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();

  // State
  const [systems, setSystems] = useState<HandicapSystem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<HandicapSystem | null>(null);
  const [ratings, setRatings] = useState<BoatRating[]>([]);
  const [results, setResults] = useState<RaceResultWithHandicap[]>([]);
  const [standings, setStandings] = useState<HandicapStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('results');

  // Race selection
  const [selectedRace, setSelectedRace] = useState<number>(1);
  const [availableRaces] = useState<number[]>([1, 2, 3]);

  // Modals
  const [showSystemPicker, setShowSystemPicker] = useState(false);
  const [showAddRatingModal, setShowAddRatingModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);

  // Add rating form
  const [newSailNumber, setNewSailNumber] = useState('');
  const [newBoatName, setNewBoatName] = useState('');
  const [newRating, setNewRating] = useState('');

  // Calculate form
  const [courseDistance, setCourseDistance] = useState('');

  // Load data
  useEffect(() => {
    loadSystems();
  }, []);

  useEffect(() => {
    if (selectedSystem && regattaId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystem, regattaId, selectedRace]);

  const loadSystems = async () => {
    try {
      const systemsData = await handicapService.getSystems();
      setSystems(systemsData);
      // Default to PHRF
      const phrf = systemsData.find(s => s.code === 'PHRF');
      setSelectedSystem(phrf || systemsData[0]);
    } catch (error) {
      console.error('Error loading systems:', error);
    }
  };

  const loadData = async () => {
    if (!selectedSystem) return;

    setLoading(true);
    try {
      const [ratingsData, resultsData, standingsData] = await Promise.all([
        handicapService.getRatingsBySystem(selectedSystem.id),
        handicapService.getRaceResultsWithHandicap(regattaId!, selectedRace, selectedSystem.code),
        handicapService.getStandings(regattaId!, selectedSystem.code),
      ]);

      setRatings(ratingsData);
      setResults(resultsData);
      setStandings(standingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Add rating
  const handleAddRating = async () => {
    if (!selectedSystem || !newSailNumber || !newRating) {
      showAlert('Required', 'Please enter sail number and rating');
      return;
    }

    try {
      await handicapService.upsertRating({
        system_id: selectedSystem.id,
        sail_number: newSailNumber.toUpperCase(),
        boat_name: newBoatName || undefined,
        rating: parseFloat(newRating),
      });

      setShowAddRatingModal(false);
      setNewSailNumber('');
      setNewBoatName('');
      setNewRating('');
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to add rating');
    }
  };

  // Calculate corrected times
  const handleCalculate = async () => {
    if (!selectedSystem) return;

    try {
      const distance = courseDistance ? parseFloat(courseDistance) : undefined;
      const result = await handicapService.calculateRaceResults(
        regattaId!,
        selectedRace,
        selectedSystem.code,
        distance
      );

      showAlert(
        'Calculated',
        `Corrected times calculated for ${result.length} boats`
      );

      setShowCalculateModal(false);
      setCourseDistance('');
      loadData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to calculate');
    }
  };

  // Calculate all races
  const handleCalculateAll = async () => {
    if (!selectedSystem) return;

    showConfirm(
      'Calculate All Races',
      `This will calculate corrected times for all races using ${selectedSystem.name}`,
      async () => {
        try {
          const distance = courseDistance ? parseFloat(courseDistance) : undefined;
          const result = await handicapService.calculateRegattaResults(
            regattaId!,
            selectedSystem.code,
            distance
          );

          showAlert(
            'Calculated',
            `${result.results} results calculated across ${result.races} races`
          );

          loadData();
        } catch (error: any) {
          showAlert('Error', error.message || 'Failed to calculate');
        }
      },
      { confirmLabel: 'Calculate' }
    );
  };

  // Delete rating
  const handleDeleteRating = (rating: BoatRating) => {
    showConfirm(
      'Delete Rating',
      `Remove rating for ${rating.sail_number}?`,
      async () => {
        try {
          await handicapService.deactivateRating(rating.id);
          loadData();
        } catch (error) {
          showAlert('Error', 'Failed to delete rating');
        }
      },
      { destructive: true }
    );
  };

  // Render results tab
  const renderResultsTab = () => (
    <View style={styles.tabContent}>
      {/* Race Selector */}
      <View style={styles.raceSelector}>
        <Text style={styles.raceSelectorLabel}>Race</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.raceChips}>
          {availableRaces.map(race => (
            <TouchableOpacity
              key={race}
              style={[styles.raceChip, selectedRace === race && styles.raceChipActive]}
              onPress={() => setSelectedRace(race)}
            >
              <Text style={[
                styles.raceChipText,
                selectedRace === race && styles.raceChipTextActive,
              ]}>
                {race}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.calculateButton}
          onPress={() => setShowCalculateModal(true)}
        >
          <Calculator size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Results Table */}
      {results.length > 0 ? (
        <View style={styles.resultsTable}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.posCell]}>Pos</Text>
            <Text style={[styles.tableHeaderCell, styles.sailCell]}>Sail</Text>
            <Text style={[styles.tableHeaderCell, styles.timeCell]}>Elapsed</Text>
            <Text style={[styles.tableHeaderCell, styles.ratingCell]}>Rating</Text>
            <Text style={[styles.tableHeaderCell, styles.timeCell]}>Corrected</Text>
            <Text style={[styles.tableHeaderCell, styles.deltaCell]}>+/-</Text>
          </View>

          {/* Rows */}
          {results.map((result, index) => (
            <View
              key={result.result_id}
              style={[styles.tableRow, index === 0 && styles.winnerRow]}
            >
              <View style={[styles.tableCell, styles.posCell]}>
                <Text style={[styles.position, index === 0 && styles.positionWinner]}>
                  {result.corrected_position || '-'}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.sailCell]}>
                <Text style={styles.sailNumber}>{result.sail_number}</Text>
                {result.boat_name && (
                  <Text style={styles.boatName} numberOfLines={1}>
                    {result.boat_name}
                  </Text>
                )}
              </View>
              <View style={[styles.tableCell, styles.timeCell]}>
                <Text style={styles.timeText}>
                  {handicapService.formatTime(result.elapsed_seconds)}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.ratingCell]}>
                <Text style={styles.ratingText}>
                  {result.rating_value?.toFixed(selectedSystem?.rating_precision || 0)}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.timeCell]}>
                <Text style={[styles.timeText, styles.correctedTime]}>
                  {result.corrected_seconds
                    ? handicapService.formatTime(result.corrected_seconds)
                    : '-'
                  }
                </Text>
              </View>
              <View style={[styles.tableCell, styles.deltaCell]}>
                <Text style={[
                  styles.deltaText,
                  index === 0 ? styles.deltaWinner : styles.deltaBehind,
                ]}>
                  {index === 0
                    ? 'WIN'
                    : result.time_behind_seconds
                      ? handicapService.formatDelta(result.time_behind_seconds)
                      : '-'
                  }
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Clock size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Results Yet</Text>
          <Text style={styles.emptyText}>
            Calculate corrected times after races are finished
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setShowCalculateModal(true)}
          >
            <Calculator size={18} color="#0EA5E9" />
            <Text style={styles.emptyButtonText}>Calculate Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render ratings tab
  const renderRatingsTab = () => (
    <View style={styles.tabContent}>
      {/* Search and Add */}
      <View style={styles.ratingsHeader}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sail number..."
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity
          style={styles.addRatingButton}
          onPress={() => setShowAddRatingModal(true)}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Ratings List */}
      {ratings.length > 0 ? (
        <View style={styles.ratingsList}>
          {ratings.map(rating => (
            <View key={rating.id} style={styles.ratingCard}>
              <View style={styles.ratingInfo}>
                <View style={styles.ratingMain}>
                  <Text style={styles.ratingSailNumber}>{rating.sail_number}</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingValue}>
                      {rating.rating.toFixed(selectedSystem?.rating_precision || 0)}
                    </Text>
                  </View>
                </View>
                {rating.boat_name && (
                  <Text style={styles.ratingBoatName}>{rating.boat_name}</Text>
                )}
                {rating.tcf && (
                  <Text style={styles.ratingTcf}>
                    TCF: {rating.tcf.toFixed(4)}
                  </Text>
                )}
              </View>
              <View style={styles.ratingActions}>
                <TouchableOpacity
                  style={styles.ratingAction}
                  onPress={() => handleDeleteRating(rating)}
                >
                  <Trash2 size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ship size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Ratings</Text>
          <Text style={styles.emptyText}>
            Add boat ratings for {selectedSystem?.name}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setShowAddRatingModal(true)}
          >
            <Plus size={18} color="#0EA5E9" />
            <Text style={styles.emptyButtonText}>Add Rating</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render standings tab
  const renderStandingsTab = () => (
    <View style={styles.tabContent}>
      {standings.length > 0 ? (
        <View style={styles.standingsList}>
          {standings.map((standing, index) => (
            <View key={standing.entry_id} style={styles.standingCard}>
              <View style={[
                styles.standingPosition,
                index === 0 && styles.positionGold,
                index === 1 && styles.positionSilver,
                index === 2 && styles.positionBronze,
              ]}>
                <Text style={[
                  styles.standingPosText,
                  index < 3 && styles.standingPosTextTop,
                ]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.standingInfo}>
                <Text style={styles.standingSail}>{standing.sail_number}</Text>
                {standing.boat_name && (
                  <Text style={styles.standingBoat}>{standing.boat_name}</Text>
                )}
              </View>
              <View style={styles.standingStats}>
                <View style={styles.standingStat}>
                  <Text style={styles.standingStatValue}>{standing.total_points || 0}</Text>
                  <Text style={styles.standingStatLabel}>Points</Text>
                </View>
                <View style={styles.standingStat}>
                  <Text style={styles.standingStatValue}>{standing.wins}</Text>
                  <Text style={styles.standingStatLabel}>Wins</Text>
                </View>
                <View style={styles.standingStat}>
                  <Text style={styles.standingStatValue}>{standing.races_sailed}</Text>
                  <Text style={styles.standingStatLabel}>Races</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Trophy size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Standings Yet</Text>
          <Text style={styles.emptyText}>
            Calculate race results to see series standings
          </Text>
        </View>
      )}
    </View>
  );

  if (loading && systems.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Calculator size={48} color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const systemInfo = selectedSystem
    ? handicapService.getSystemInfo(selectedSystem.code)
    : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.systemSelector}
          onPress={() => setShowSystemPicker(true)}
        >
          <View style={[styles.systemBadge, { backgroundColor: systemInfo?.color + '20' }]}>
            <Text style={[styles.systemCode, { color: systemInfo?.color }]}>
              {selectedSystem?.code}
            </Text>
          </View>
          <Text style={styles.headerTitle}>Handicap Calculator</Text>
          <ChevronDown size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={handleCalculateAll}>
          <RefreshCw size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'results' && styles.tabActive]}
          onPress={() => setActiveTab('results')}
        >
          <Clock size={18} color={activeTab === 'results' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[styles.tabLabel, activeTab === 'results' && styles.tabLabelActive]}>
            Results
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ratings' && styles.tabActive]}
          onPress={() => setActiveTab('ratings')}
        >
          <Target size={18} color={activeTab === 'ratings' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[styles.tabLabel, activeTab === 'ratings' && styles.tabLabelActive]}>
            Ratings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standings' && styles.tabActive]}
          onPress={() => setActiveTab('standings')}
        >
          <Trophy size={18} color={activeTab === 'standings' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[styles.tabLabel, activeTab === 'standings' && styles.tabLabelActive]}>
            Standings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'results' && renderResultsTab()}
        {activeTab === 'ratings' && renderRatingsTab()}
        {activeTab === 'standings' && renderStandingsTab()}
      </ScrollView>

      {/* System Picker Modal */}
      <Modal
        visible={showSystemPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSystemPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSystemPicker(false)}
        >
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Rating System</Text>
            {systems.map(system => {
              const info = handicapService.getSystemInfo(system.code);
              return (
                <TouchableOpacity
                  key={system.id}
                  style={[
                    styles.pickerOption,
                    selectedSystem?.id === system.id && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedSystem(system);
                    setShowSystemPicker(false);
                  }}
                >
                  <View style={[styles.pickerBadge, { backgroundColor: info.color + '20' }]}>
                    <Text style={[styles.pickerCode, { color: info.color }]}>
                      {system.code}
                    </Text>
                  </View>
                  <View style={styles.pickerInfo}>
                    <Text style={styles.pickerName}>{system.name}</Text>
                    <Text style={styles.pickerDesc}>{info.description}</Text>
                  </View>
                  {selectedSystem?.id === system.id && (
                    <Check size={20} color="#0EA5E9" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Rating Modal */}
      <Modal
        visible={showAddRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Rating</Text>
              <TouchableOpacity onPress={() => setShowAddRatingModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Sail Number *</Text>
              <TextInput
                style={styles.input}
                value={newSailNumber}
                onChangeText={setNewSailNumber}
                placeholder="e.g., USA 12345"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Boat Name</Text>
              <TextInput
                style={styles.input}
                value={newBoatName}
                onChangeText={setNewBoatName}
                placeholder="e.g., Sea Breeze"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>
                {selectedSystem?.code} Rating *
              </Text>
              <TextInput
                style={styles.input}
                value={newRating}
                onChangeText={setNewRating}
                placeholder={selectedSystem?.code === 'IRC' ? '1.050' : '120'}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity style={styles.modalButton} onPress={handleAddRating}>
              <Text style={styles.modalButtonText}>Add Rating</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calculate Modal */}
      <Modal
        visible={showCalculateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalculateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calculate Corrected Times</Text>
              <TouchableOpacity onPress={() => setShowCalculateModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.calcInfo}>
                System: {selectedSystem?.name}
              </Text>
              <Text style={styles.calcInfo}>
                Race: {selectedRace}
              </Text>

              {selectedSystem?.calculation_type === 'time_on_distance' && (
                <>
                  <Text style={styles.inputLabel}>Course Distance (nm) *</Text>
                  <TextInput
                    style={styles.input}
                    value={courseDistance}
                    onChangeText={setCourseDistance}
                    placeholder="e.g., 5.2"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </>
              )}
            </View>

            <TouchableOpacity style={styles.modalButton} onPress={handleCalculate}>
              <Calculator size={20} color="#FFFFFF" />
              <Text style={styles.modalButtonText}>Calculate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  systemSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  systemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  systemCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  tabBar: {
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
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  // Results tab
  raceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  raceSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  raceChips: {
    flex: 1,
  },
  raceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  raceChipActive: {
    backgroundColor: '#0EA5E9',
  },
  raceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  raceChipTextActive: {
    color: '#FFFFFF',
  },
  calculateButton: {
    backgroundColor: '#10B981',
    padding: 10,
    borderRadius: 10,
  },
  resultsTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  winnerRow: {
    backgroundColor: '#F0FDF4',
  },
  tableCell: {
    justifyContent: 'center',
  },
  posCell: {
    width: 40,
  },
  sailCell: {
    flex: 1,
  },
  timeCell: {
    width: 70,
    alignItems: 'flex-end',
  },
  ratingCell: {
    width: 50,
    alignItems: 'center',
  },
  deltaCell: {
    width: 60,
    alignItems: 'flex-end',
  },
  position: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  positionWinner: {
    color: '#059669',
  },
  sailNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  boatName: {
    fontSize: 11,
    color: '#6B7280',
  },
  timeText: {
    fontSize: 13,
    color: '#374151',
    fontVariant: ['tabular-nums'],
  },
  correctedTime: {
    fontWeight: '600',
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deltaWinner: {
    color: '#059669',
  },
  deltaBehind: {
    color: '#DC2626',
  },
  // Ratings tab
  ratingsHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#1F2937',
  },
  addRatingButton: {
    backgroundColor: '#0EA5E9',
    padding: 12,
    borderRadius: 10,
  },
  ratingsList: {
    gap: 12,
  },
  ratingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  ratingInfo: {
    flex: 1,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingSailNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  ratingBoatName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  ratingTcf: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ratingActions: {
    justifyContent: 'center',
  },
  ratingAction: {
    padding: 8,
  },
  // Standings tab
  standingsList: {
    gap: 12,
  },
  standingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  standingPosition: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionGold: {
    backgroundColor: '#FEF3C7',
  },
  positionSilver: {
    backgroundColor: '#E5E7EB',
  },
  positionBronze: {
    backgroundColor: '#FED7AA',
  },
  standingPosText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  standingPosTextTop: {
    color: '#1F2937',
  },
  standingInfo: {
    flex: 1,
  },
  standingSail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  standingBoat: {
    fontSize: 13,
    color: '#6B7280',
  },
  standingStats: {
    flexDirection: 'row',
    gap: 16,
  },
  standingStat: {
    alignItems: 'center',
  },
  standingStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  standingStatLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  // Empty states
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    margin: 16,
    padding: 16,
    borderRadius: 10,
    gap: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  calcInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  // System picker
  pickerContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
  },
  pickerCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickerInfo: {
    flex: 1,
  },
  pickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
});

