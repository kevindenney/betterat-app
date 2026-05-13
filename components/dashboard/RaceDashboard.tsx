/**
 * Race Dashboard - Complete AI-Powered Sailing Intelligence Hub
 * Integration point for all "OnX Maps for Sailing" features
 * Combines AI strategy, 3D visualization, venue detection, and race day interface
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { raceStrategyEngine, type RaceStrategy, type RaceConditions } from '@/services/ai/RaceStrategyEngine';
import { venueDetectionService, type SailingVenue, type LocationUpdate } from '@/services/location/VenueDetectionService';
import { DocumentProcessingService as _DocumentProcessingService } from '@/services/ai/DocumentProcessingService';
import RaceCourseVisualization3D from '@/components/strategy/RaceCourseVisualization3D';
import RaceDayInterface from '@/components/racing/RaceDayInterface';
import { AIRaceAnalysisDashboard } from '@/components/ai/AIRaceAnalysisDashboard';
import type { DocumentAnalysis, RaceCourseExtraction as _RaceCourseExtraction } from '@/lib/types/ai-knowledge';
import { createLogger } from '@/lib/utils/logger';

interface DashboardState {
  currentVenue: SailingVenue | null;
  activeStrategy: RaceStrategy | null;
  isGeneratingStrategy: boolean;
  recentDocuments: DocumentAnalysis[];
  raceMode: 'preparation' | 'racing' | 'analysis';
  showRaceDayInterface: boolean;
  show3DVisualization: boolean;
  showAIAnalysis: boolean;
}

const logger = createLogger('RaceDashboard');
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export const RaceDashboard: React.FC = () => {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    currentVenue: null,
    activeStrategy: null,
    isGeneratingStrategy: false,
    recentDocuments: [],
    raceMode: 'preparation',
    showRaceDayInterface: false,
    show3DVisualization: false,
    showAIAnalysis: true // Start with AI analysis visible
  });

  const [demoConditions] = useState<RaceConditions>({
    wind: {
      speed: 15,
      direction: 225,
      forecast: {
        nextHour: { speed: 16, direction: 230 },
        nextThreeHours: { speed: 18, direction: 240 }
      },
      confidence: 0.85
    },
    current: {
      speed: 1.2,
      direction: 90,
      tidePhase: 'flood'
    },
    waves: {
      height: 0.8,
      period: 4,
      direction: 220
    },
    visibility: 10,
    temperature: 24,
    weatherRisk: 'low'
  });

  useEffect(() => {
    initializeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeDashboard = async () => {

    try {
      // Initialize venue detection
      const venueInitialized = await venueDetectionService.initialize();
      if (venueInitialized) {
        const currentVenue = venueDetectionService.getCurrentVenue();
        setDashboardState(prev => ({ ...prev, currentVenue }));

        // Listen for venue changes
        venueDetectionService.addLocationListener(handleLocationUpdate);

        if (currentVenue) {
        }
      }

      // Load any cached strategies or documents
      await loadCachedData();

    } catch (error) {

    }
  };

  const handleLocationUpdate = (update: LocationUpdate) => {
    if (update.changed && update.venue) {
      setDashboardState(prev => ({ ...prev, currentVenue: update.venue }));

      showConfirm(
        'Venue Changed',
        `Now at ${update.venue.name}. Would you like to load local sailing intelligence?`,
        () => loadVenueIntelligence(update.venue!)
      );
    }
  };

  const loadVenueIntelligence = async (venue: SailingVenue) => {

    showAlert(
      'Local Intelligence Loaded',
      `Loaded sailing intelligence for ${venue.name}:\n\n` +
      `• ${venue.localKnowledge.bestRacingWinds}\n` +
      `• ${venue.localKnowledge.commonConditions}\n` +
      `• Expert tip: ${venue.localKnowledge.expertTips[0] || 'Local knowledge available'}`
    );
  };

  const loadCachedData = async () => {
    // In a real implementation, this would load cached strategies and documents
  };

  const generateFullStrategy = async () => {
    if (!dashboardState.currentVenue) {
      showConfirm(
        'Venue Required',
        'Please set your venue location to generate a strategy.',
        () => showVenueSelector()
      );
      return;
    }

    setDashboardState(prev => ({ ...prev, isGeneratingStrategy: true }));

    try {
      // Sample sailing instructions for demo
      const sailingInstructions = `
        ${dashboardState.currentVenue.name} Race Series
        Course: Windward-Leeward
        Start Time: ${new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString()}

        The course will be set to windward with marks approximately 1 nautical mile apart.
        Start line between committee boat and pin buoy.
        Round all marks to port.

        Wind forecast: ${demoConditions.wind.speed}-${demoConditions.wind.speed + 5} knots
        Tidal conditions: ${demoConditions.current.tidePhase} tide ${demoConditions.current.speed} knots

        Safety: All crew must wear PFDs
        VHF Channel 72 for race communication
      `;

      const strategy = await raceStrategyEngine.generateRaceStrategy(
        sailingInstructions,
        demoConditions,
        dashboardState.currentVenue.id,
        {
          raceName: `${dashboardState.currentVenue.name} Championship`,
          fleetSize: 25,
          boatType: 'One-Design',
          importance: 'championship'
        }
      );

      setDashboardState(prev => ({ ...prev, activeStrategy: strategy }));

      showAlert(
        'Strategy Complete!',
        `AI has generated a comprehensive racing strategy for ${dashboardState.currentVenue.name}:\n\n` +
        `• Strategy confidence: ${Math.round(strategy.confidence * 100)}%\n` +
        `• ${strategy.insights.length} tactical insights\n` +
        `• ${strategy.strategy.beatStrategy.length} beat recommendations\n` +
        `• ${Object.keys(strategy.contingencies).length} contingency plans\n\n` +
        `${strategy.simulationResults ?
          `Expected finish: ${strategy.simulationResults.averageFinish} (${Math.round(strategy.simulationResults.winProbability * 100)}% win probability)` :
          'Strategy ready for race day execution'}`
      );

    } catch (error) {
      console.error('Strategy generation error:', error);
      showAlert('Strategy Error', 'Failed to generate strategy. Please try again.');
    } finally {
      setDashboardState(prev => ({ ...prev, isGeneratingStrategy: false }));
    }
  };

  const showVenueSelector = () => {
    const venues = venueDetectionService.getAllVenues();
    const venueOptions = venues.slice(0, 6).map(venue => ({
      text: venue.name,
      onPress: () => venueDetectionService.setManualVenue(venue.id)
    }));

    showAlertWithButtons(
      'Select Venue',
      'Choose your sailing venue:',
      [
        ...venueOptions,
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const enterRaceMode = () => {
    if (!dashboardState.activeStrategy) {
      showConfirm(
        'Strategy Required',
        'Generate a race strategy first to enter race mode.',
        generateFullStrategy
      );
      return;
    }

    setDashboardState(prev => ({
      ...prev,
      raceMode: 'racing',
      showRaceDayInterface: true
    }));
  };

  const exitRaceMode = () => {
    setDashboardState(prev => ({
      ...prev,
      raceMode: 'preparation',
      showRaceDayInterface: false
    }));
  };

  const toggleVisualization = () => {
    setDashboardState(prev => ({
      ...prev,
      show3DVisualization: !prev.show3DVisualization
    }));
  };

  const toggleAIAnalysis = () => {
    setDashboardState(prev => ({
      ...prev,
      showAIAnalysis: !prev.showAIAnalysis
    }));
  };

  const renderStatusCard = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <Text style={styles.statusTitle}>🎯 RegattaFlow Intelligence Hub</Text>
        <View style={[styles.statusBadge, styles[`${dashboardState.raceMode}Badge`]]}>
          <Text style={styles.statusBadgeText}>
            {dashboardState.raceMode.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.statusContent}>
        <View style={styles.statusItem}>
          <Ionicons name="location" size={20} color="#0066CC" />
          <Text style={styles.statusText}>
            {dashboardState.currentVenue?.name || 'No venue detected'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="brain" size={20} color="#00CC44" />
          <Text style={styles.statusText}>
            {dashboardState.activeStrategy
              ? `Strategy: ${Math.round(dashboardState.activeStrategy.confidence * 100)}% confidence`
              : 'No strategy loaded'
            }
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="time" size={20} color="#FF8000" />
          <Text style={styles.statusText}>
            Last update: {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionGrid}>
      <TouchableOpacity
        style={[styles.actionButton, styles.primaryAction]}
        onPress={generateFullStrategy}
        disabled={dashboardState.isGeneratingStrategy}
      >
        <Ionicons name="brain" size={32} color="white" />
        <Text style={styles.actionButtonText}>
          {dashboardState.isGeneratingStrategy ? 'Generating...' : 'Generate Strategy'}
        </Text>
        {dashboardState.currentVenue && (
          <Text style={styles.actionButtonSubtext}>
            for {dashboardState.currentVenue.name}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.secondaryAction]}
        onPress={toggleVisualization}
      >
        <Ionicons name="cube" size={32} color="white" />
        <Text style={styles.actionButtonText}>3D Course</Text>
        <Text style={styles.actionButtonSubtext}>Visualize race course</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.aiAction]}
        onPress={toggleAIAnalysis}
      >
        <Ionicons name="mic" size={32} color="white" />
        <Text style={styles.actionButtonText}>Analysis</Text>
        <Text style={styles.actionButtonSubtext}>Voice notes & insights</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.raceAction]}
        onPress={dashboardState.raceMode === 'racing' ? exitRaceMode : enterRaceMode}
      >
        <Ionicons name={dashboardState.raceMode === 'racing' ? "stop" : "play"} size={32} color="white" />
        <Text style={styles.actionButtonText}>
          {dashboardState.raceMode === 'racing' ? 'Exit Race Mode' : 'Start Racing'}
        </Text>
        <Text style={styles.actionButtonSubtext}>
          {dashboardState.raceMode === 'racing' ? 'Return to preparation' : 'Enter race day mode'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.venueAction]}
        onPress={showVenueSelector}
      >
        <Ionicons name="location" size={32} color="white" />
        <Text style={styles.actionButtonText}>Set Venue</Text>
        <Text style={styles.actionButtonSubtext}>Choose sailing location</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStrategyOverview = () => {
    if (!dashboardState.activeStrategy) return null;

    const strategy = dashboardState.activeStrategy;

    return (
      <View style={styles.strategyOverview}>
        <Text style={styles.sectionTitle}>🏆 Active Strategy</Text>

        <View style={styles.strategyCard}>
          <Text style={styles.strategyTitle}>{strategy.raceName}</Text>
          <Text style={styles.strategyVenue}>{strategy.venue.name}</Text>

          <View style={styles.strategyMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Confidence</Text>
              <Text style={styles.metricValue}>{Math.round(strategy.confidence * 100)}%</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Insights</Text>
              <Text style={styles.metricValue}>{strategy.insights.length}</Text>
            </View>

            {strategy.simulationResults && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Expected Finish</Text>
                <Text style={styles.metricValue}>{strategy.simulationResults.averageFinish}</Text>
              </View>
            )}
          </View>

          <Text style={styles.strategyApproach}>
            {strategy.strategy.overallApproach.slice(0, 120)}...
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderStatusCard()}
        {renderActionButtons()}
        {renderStrategyOverview()}

        {/* Race Calendar */}
        <View style={styles.raceCalendar}>
          <Text style={styles.sectionTitle}>📅 Upcoming Races</Text>
          <View style={styles.raceList}>
            <View style={styles.raceCard}>
              <View style={styles.raceHeader}>
                <Text style={styles.raceTitle}>Dragon World Championship</Text>
                <Text style={styles.raceDate}>Oct 15-18</Text>
              </View>
              <Text style={styles.raceVenue}>
                {dashboardState.currentVenue?.name || 'Hong Kong Yacht Club'}
              </Text>
              <Text style={styles.raceStatus}>📝 Preparing strategy</Text>
            </View>

            <View style={styles.raceCard}>
              <View style={styles.raceHeader}>
                <Text style={styles.raceTitle}>Regional Championship</Text>
                <Text style={styles.raceDate}>Nov 2-3</Text>
              </View>
              <Text style={styles.raceVenue}>Royal Victoria Yacht Club</Text>
              <Text style={styles.raceStatus}>⏰ Registration open</Text>
            </View>
          </View>
        </View>

        {/* Equipment Tracking */}
        <View style={styles.equipmentTracking}>
          <Text style={styles.sectionTitle}>⚙️ Equipment Setup</Text>
          <View style={styles.equipmentList}>
            <View style={styles.equipmentCard}>
              <View style={styles.equipmentHeader}>
                <Ionicons name="boat" size={24} color="#0066CC" />
                <Text style={styles.equipmentTitle}>Dragon #HKG 123</Text>
              </View>
              <Text style={styles.equipmentConfig}>
                Main: North Sails 3DL • Jib: North Sails Dacron • Spinnaker: North Sails AP
              </Text>
              <Text style={styles.equipmentCondition}>
                Optimized for {demoConditions.wind.speed}kt winds at {dashboardState.currentVenue?.name || 'current venue'}
              </Text>
            </View>

            <View style={styles.equipmentCard}>
              <View style={styles.equipmentHeader}>
                <Ionicons name="settings" size={24} color="#00CC44" />
                <Text style={styles.equipmentTitle}>Tuning Setup</Text>
              </View>
              <Text style={styles.equipmentConfig}>
                Mast rake: 32" • Shroud tension: 450lbs • Forestay: 650lbs
              </Text>
              <Text style={styles.equipmentCondition}>
                Last updated: Race day at {dashboardState.currentVenue?.name || 'venue'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <Text style={styles.sectionTitle}>📊 Quick Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {dashboardState.currentVenue?.characteristics.tidalRange.toFixed(1) || '--'}m
              </Text>
              <Text style={styles.statLabel}>Tidal Range</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {demoConditions.wind.speed}kt
              </Text>
              <Text style={styles.statLabel}>Wind Speed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {demoConditions.current.speed}kt
              </Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {dashboardState.currentVenue?.classification || 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Venue Type</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Race Day Interface Modal */}
      <Modal
        visible={dashboardState.showRaceDayInterface}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <RaceDayInterface
          strategy={dashboardState.activeStrategy}
          onStrategyUpdate={(strategy) =>
            setDashboardState(prev => ({ ...prev, activeStrategy: strategy }))
          }
          onEmergencyAlert={() => showAlert('Emergency', 'Emergency protocols activated')}
        />

        <TouchableOpacity
          style={styles.exitRaceButton}
          onPress={exitRaceMode}
        >
          <Ionicons name="close" size={24} color="white" />
          <Text style={styles.exitRaceButtonText}>Exit Race Mode</Text>
        </TouchableOpacity>
      </Modal>

      {/* AI Race Analysis Dashboard Modal */}
      <Modal
        visible={dashboardState.showAIAnalysis}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Race Analysis</Text>
            <TouchableOpacity onPress={toggleAIAnalysis}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <AIRaceAnalysisDashboard
            onStrategyGenerated={(strategy) => {
              setDashboardState(prev => ({ ...prev, activeStrategy: strategy }));
            }}
            onInsightGenerated={(insight) => {
              logger.debug('New tactical insight:', insight);
            }}
          />
        </View>
      </Modal>

      {/* 3D Visualization Modal */}
      <Modal
        visible={dashboardState.show3DVisualization}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>3D Race Course</Text>
            <TouchableOpacity onPress={toggleVisualization}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {dashboardState.activeStrategy && (
            <RaceCourseVisualization3D
              courseExtraction={dashboardState.activeStrategy.courseExtraction}
              strategy={dashboardState.activeStrategy}
              conditions={demoConditions}
              venue={dashboardState.currentVenue?.id}
              onMarkSelected={(markName) =>
                showAlert('Mark Selected', `Selected: ${markName}`)
              }
              onTacticalLayerToggle={(layer, enabled) =>
                logger.debug(`Layer ${layer}: ${enabled ? 'enabled' : 'disabled'}`)
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },

  // Status Card
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 4px',
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  preparationBadge: {
    backgroundColor: '#E3F2FD',
  },
  racingBadge: {
    backgroundColor: '#E8F5E8',
  },
  analysisBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066CC',
  },
  statusContent: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },

  // Action Grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    minWidth: isTablet ? 200 : 160,
    aspectRatio: isTablet ? 1.2 : 1,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px',
    elevation: 6,
  },
  primaryAction: {
    backgroundColor: '#0066CC',
  },
  secondaryAction: {
    backgroundColor: '#00CC44',
  },
  raceAction: {
    backgroundColor: '#FF8000',
  },
  venueAction: {
    backgroundColor: '#8000FF',
  },
  aiAction: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: isTablet ? 14 : 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // Strategy Overview
  strategyOverview: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: isTablet ? 22 : 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  strategyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 6,
    borderLeftColor: '#00CC44',
    boxShadow: '0px 2px',
    elevation: 3,
  },
  strategyTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  strategyVenue: {
    fontSize: 16,
    color: '#0066CC',
    marginBottom: 16,
  },
  strategyMetrics: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00CC44',
  },
  strategyApproach: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Race Calendar
  raceCalendar: {
    marginBottom: 24,
  },
  raceList: {
    gap: 16,
  },
  raceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  raceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  raceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  raceDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  raceVenue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  raceStatus: {
    fontSize: 14,
    color: '#00CC44',
    fontWeight: '600',
  },

  // Equipment Tracking
  equipmentTracking: {
    marginBottom: 24,
  },
  equipmentList: {
    gap: 16,
  },
  equipmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00CC44',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  equipmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  equipmentConfig: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  equipmentCondition: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },

  // Quick Stats
  quickStats: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: isTablet ? 120 : 100,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  statValue: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '800',
    color: '#0066CC',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  exitRaceButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 1000,
  },
  exitRaceButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RaceDashboard;