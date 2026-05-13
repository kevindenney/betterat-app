/**
 * AI Race Analysis Dashboard - Complete AI-Powered Race Intelligence Hub
 * Combines strategy generation, voice notes, real-time analysis, and tactical insights
 * The core "OnX Maps for Sailing" AI experience
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import {
  raceStrategyEngine,
  type RaceStrategy,
  type RaceConditions,
  type VenueIntelligence
} from '@/services/ai/RaceStrategyEngine';
import {
  type TacticalInsight,
  type RaceContext
} from '@/services/ai/VoiceNoteService';

interface AnalysisDashboardState {
  activeStrategy: RaceStrategy | null;
  currentConditions: RaceConditions | null;
  venueIntelligence: VenueIntelligence | null;
  recentInsights: TacticalInsight[];
  isGeneratingStrategy: boolean;
  raceContext: RaceContext;
  analysisHistory: AnalysisEntry[];
}

interface AnalysisEntry {
  id: string;
  timestamp: Date;
  type: 'strategy_generated' | 'voice_insight' | 'condition_update' | 'document_analyzed';
  title: string;
  description: string;
  data?: any;
  confidence?: number;
}

interface AIRaceAnalysisDashboardProps {
  onStrategyGenerated?: (strategy: RaceStrategy) => void;
  onInsightGenerated?: (insight: TacticalInsight) => void;
  style?: object;
}

export const AIRaceAnalysisDashboard: React.FC<AIRaceAnalysisDashboardProps> = ({
  onStrategyGenerated,
  onInsightGenerated,
  style
}) => {
  const [state, setState] = useState<AnalysisDashboardState>({
    activeStrategy: null,
    currentConditions: null,
    venueIntelligence: null,
    recentInsights: [],
    isGeneratingStrategy: false,
    raceContext: {
      racePhase: 'pre_start',
      currentLeg: 'Start Line',
      markName: 'Committee Boat',
      fleetPosition: undefined
    },
    analysisHistory: []
  });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'strategy' | 'insights' | 'conditions' | 'history'>('strategy');

  useEffect(() => {
    initializeDemoData();
  }, []);

  const initializeDemoData = () => {
    // Demo conditions for testing
    const demoConditions: RaceConditions = {
      wind: {
        speed: 15,
        direction: 230,
        forecast: {
          nextHour: { speed: 18, direction: 225 },
          nextThreeHours: { speed: 20, direction: 220 }
        },
        confidence: 0.85
      },
      current: {
        speed: 1.2,
        direction: 45,
        tidePhase: 'flood'
      },
      waves: {
        height: 0.8,
        period: 4,
        direction: 240
      },
      visibility: 10,
      temperature: 22,
      weatherRisk: 'low'
    };

    // Demo venue intelligence
    const demoVenue: VenueIntelligence = {
      id: 'hong_kong_victoria_harbour',
      name: 'Hong Kong Victoria Harbour',
      region: 'asia-pacific',
      localKnowledge: {
        windPatterns: {
          typical: 'SW monsoon 10-20kt with building sea breeze',
          seasonal: 'Winter NE monsoon more consistent',
          localEffects: [
            'Harbor skyscrapers bend wind near Central district',
            'Thermal gradients create late-afternoon right shifts'
          ]
        },
        currentPatterns: {
          tidalRange: 2.1,
          currentStrength: 2,
          keyTimings: [
            'Ebb current favors eastern approaches',
            'Flood relieves along Kowloon shoreline'
          ]
        },
        tacticalConsiderations: [
          'Right side gains leverage in prevailing SW monsoon',
          'Manage wind shadows from Hong Kong Island skyline',
          'Watch airport exclusion zone laylines on downwind'
        ],
        commonMistakes: [
          'Overcommitting left during strong flood tide',
          'Ignoring shipping channel traffic separation schemes'
        ],
        expertTips: [
          'Time current relief along Kowloon shoreline during flood',
          'Protect lanes of breeze that funnel between skyscraper corridors'
        ]
      },
      culturalContext: {
        racingStyle: 'Aggressive championship-level starts with professional boathandling',
        protocols: [
          'Respect Royal Hong Kong Yacht Club signals and sequencing',
          'Monitor VHF 72 for race committee adjustments'
        ],
        language: 'English',
        socialCustoms: [
          'Post-race debrief at the main clubhouse',
          'Congratulate race committee upon return to dock'
        ]
      },
      safetyConsiderations: [
        'Heavy commercial traffic transiting main fairway',
        'Frequent helicopter operations near Central waterfront',
        'Strong cross-harbour ferry wakes affecting small boats'
      ]
    };

    setState(prev => ({
      ...prev,
      currentConditions: demoConditions,
      venueIntelligence: demoVenue
    }));
  };

  const generateRaceStrategy = async () => {
    if (!state.currentConditions) {
      showAlert('Missing Data', 'Weather conditions required for strategy generation');
      return;
    }

    setState(prev => ({ ...prev, isGeneratingStrategy: true }));

    try {
      const venueId = state.venueIntelligence?.id ?? 'hong_kong_victoria_harbour';

      const strategy = await raceStrategyEngine.generateVenueBasedStrategy(
        venueId,
        state.currentConditions,
        {
          raceName: 'Victoria Harbour Sprint',
          raceDate: new Date(),
          raceTime: '10:00',
          boatType: 'J/80',
          fleetSize: 24
        }
      );

      const historyEntry: AnalysisEntry = {
        id: `analysis_${Date.now()}`,
        timestamp: new Date(),
        type: 'strategy_generated',
        title: 'Strategy Generated',
        description: `Strategy generated for ${strategy.venue.name}`,
        data: strategy,
        confidence: strategy.confidence
      };

      setState(prev => ({
        ...prev,
        activeStrategy: strategy,
        isGeneratingStrategy: false,
        analysisHistory: [historyEntry, ...prev.analysisHistory]
      }));

      onStrategyGenerated?.(strategy);

    } catch (error) {

      showAlert('Strategy Error', 'Failed to generate race strategy. Please try again.');
    } finally {
      setState(prev => ({ ...prev, isGeneratingStrategy: false }));
    }
  };

  const handleVoiceInsight = (insights: TacticalInsight[]) => {
    const historyEntry: AnalysisEntry = {
      id: `voice_${Date.now()}`,
      timestamp: new Date(),
      type: 'voice_insight',
      title: 'Voice Insight Captured',
      description: insights.map(i => i.description).join(', '),
      data: insights,
      confidence: insights[0]?.confidence
    };

    setState(prev => ({
      ...prev,
      recentInsights: [...insights, ...prev.recentInsights].slice(0, 10),
      analysisHistory: [historyEntry, ...prev.analysisHistory].slice(0, 50)
    }));

    insights.forEach(insight => {
      onInsightGenerated?.(insight);
    });
  };

  const updateRaceContext = (phase: RaceContext['racePhase']) => {
    setState(prev => ({
      ...prev,
      raceContext: {
        ...prev.raceContext,
        racePhase: phase
      }
    }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In real app, would refresh conditions and analysis
    setRefreshing(false);
  };

  const renderStrategyTab = () => {
    const activeStrategy = state.activeStrategy;
    const strategyPlan = activeStrategy?.strategy;

    return (
      <View style={styles.tabContent}>
        {activeStrategy && strategyPlan ? (
          <View style={styles.strategyContainer}>
            <View style={styles.strategyHeader}>
              <View style={styles.strategyTitleContainer}>
                <Text style={styles.strategyTitle}>Active Race Strategy</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(activeStrategy.confidence * 100)}% confidence
                  </Text>
                </View>
              </View>
              <Text style={styles.strategyVenue}>{activeStrategy.venue.name}</Text>
            </View>

            <ScrollView style={styles.strategyContent} showsVerticalScrollIndicator={false}>
              <View style={styles.strategySection}>
                <Text style={styles.sectionTitle}>🏁 Start Strategy</Text>
                <Text style={styles.sectionContent}>{strategyPlan.startStrategy.action}</Text>
                {strategyPlan.startStrategy.execution && (
                  <Text style={styles.sectionDetails}>{strategyPlan.startStrategy.execution}</Text>
                )}
              </View>

              {!!strategyPlan.beatStrategy?.length && (
                <View style={styles.strategySection}>
                  <Text style={styles.sectionTitle}>⛵ Upwind Plan</Text>
                  {strategyPlan.beatStrategy.map((recommendation, index) => (
                    <Text key={`${recommendation.phase}-${index}`} style={styles.sectionContent}>
                      {index + 1}. {recommendation.action}
                    </Text>
                  ))}
                </View>
              )}

              {!!strategyPlan.runStrategy?.length && (
                <View style={styles.strategySection}>
                  <Text style={styles.sectionTitle}>🌬 Downwind Plan</Text>
                  {strategyPlan.runStrategy.map((recommendation, index) => (
                    <Text key={`${recommendation.phase}-${index}`} style={styles.sectionContent}>
                      {index + 1}. {recommendation.action}
                    </Text>
                  ))}
                </View>
              )}

              {!!activeStrategy.contingencies && (
                <View style={styles.strategySection}>
                  <Text style={styles.sectionTitle}>⚠️ Contingencies</Text>
                  {Object.entries(activeStrategy.contingencies).map(([scenario, recommendations]) => (
                    <View key={scenario} style={styles.contingencyGroup}>
                      <Text style={styles.sectionDetails}>
                        {scenario
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, (char) => char.toUpperCase())}
                      </Text>
                      {recommendations.map((recommendation, index) => (
                        <Text key={`${scenario}-${index}`} style={styles.sectionContent}>
                          • {recommendation.action}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {!!activeStrategy.insights?.length && (
                <View style={styles.strategySection}>
                  <Text style={styles.sectionTitle}>📚 Key Insights</Text>
                  {activeStrategy.insights.map((insight, index) => (
                    <View key={`${insight.title}-${index}`} style={styles.insightSummary}>
                      <Text style={styles.sectionContent}>• {insight.title}</Text>
                      <Text style={styles.sectionDetails}>{insight.description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bulb" size={64} color="#CCC" />
            <Text style={styles.emptyStateTitle}>No Strategy Generated</Text>
            <Text style={styles.emptyStateText}>
              Generate a race strategy based on current conditions
            </Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateRaceStrategy}
              disabled={state.isGeneratingStrategy}
            >
              <LinearGradient
                colors={['#0066CC', '#4A90E2']}
                style={styles.generateButtonGradient}
              >
                {state.isGeneratingStrategy ? (
                  <Ionicons name="refresh" size={20} color="white" />
                ) : (
                  <Ionicons name="bulb" size={20} color="white" />
                )}
                <Text style={styles.generateButtonText}>
                  {state.isGeneratingStrategy ? 'Generating...' : 'Generate Strategy'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderInsightsTab = () => (
    <View style={styles.tabContent}>
      <VoiceNoteRecorder
        raceContext={state.raceContext}
        onInsightGenerated={handleVoiceInsight}
        style={styles.voiceRecorder}
      />

      {state.recentInsights.length > 0 && (
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Recent Insights</Text>
          {state.recentInsights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={[
                  styles.insightTypeBadge,
                  { backgroundColor: getInsightColor(insight.type) }
                ]}>
                  <Text style={styles.insightTypeText}>
                    {insight.type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.insightTime}>
                  {insight.timestamp.toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.insightDescription}>{insight.description}</Text>
              {insight.recommendation && (
                <Text style={styles.insightRecommendation}>
                  💡 {insight.recommendation}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderConditionsTab = () => {
    if (!state.currentConditions) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline" size={56} color="#9CA3AF" />
            <Text style={styles.emptyStateTitle}>No Conditions Loaded</Text>
            <Text style={styles.emptyStateText}>
              Pull weather and current data to power strategy recommendations.
            </Text>
          </View>
        </View>
      );
    }

    const { wind, current, waves } = state.currentConditions;
    return (
      <View style={styles.tabContent}>
        <View style={styles.insightCard}>
          <Text style={styles.sectionTitle}>Live Conditions</Text>
          <Text style={styles.sectionContent}>
            Wind: {wind.speed}kt @ {wind.direction}°
          </Text>
          <Text style={styles.sectionContent}>
            Current: {current.speed}kt {current.tidePhase}
          </Text>
          <Text style={styles.sectionContent}>
            Waves: {waves.height}m @ {waves.period}s
          </Text>
          <Text style={styles.sectionDetails}>
            Risk: {state.currentConditions.weatherRisk.toUpperCase()} | Visibility {state.currentConditions.visibility}nm
          </Text>
        </View>
      </View>
    );
  };

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {state.analysisHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyStateTitle}>No Analysis History Yet</Text>
          <Text style={styles.emptyStateText}>
            Strategy generations and insights will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Recent Analysis Activity</Text>
          {state.analysisHistory.slice(0, 20).map((entry) => (
            <View key={entry.id} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.sectionContent}>{entry.title}</Text>
                <Text style={styles.insightTime}>
                  {entry.timestamp.toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.sectionDetails}>{entry.description}</Text>
              {typeof entry.confidence === 'number' && (
                <Text style={styles.insightRecommendation}>
                  Confidence: {Math.round(entry.confidence * 100)}%
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const getInsightColor = (type: TacticalInsight['type']): string => {
    const colors: Record<TacticalInsight['type'], string> = {
      wind_shift: '#FF9500',
      current_observation: '#007AFF',
      fleet_position: '#34C759',
      mark_approach: '#FF3B30',
      equipment_change: '#AF52DE',
      weather_change: '#FF2D92'
    };
    return colors[type] ?? '#8E8E93';
  };

  const renderTabButton = (
    tab: typeof selectedTab,
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    count?: number
  ) => (
    <TouchableOpacity
      style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
      onPress={() => setSelectedTab(tab)}
    >
      <Ionicons
        name={icon}
        size={20}
        color={selectedTab === tab ? '#0066CC' : '#8E8E93'}
      />
      <Text style={[
        styles.tabButtonText,
        selectedTab === tab && styles.tabButtonTextActive
      ]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Race Analysis</Text>
        <View style={styles.racePhaseSelector}>
          {(['pre_start', 'start_sequence', 'upwind', 'downwind'] as const).map(phase => (
            <TouchableOpacity
              key={phase}
              style={[
                styles.phaseButton,
                state.raceContext.racePhase === phase && styles.phaseButtonActive
              ]}
              onPress={() => updateRaceContext(phase)}
            >
              <Text style={[
                styles.phaseButtonText,
                state.raceContext.racePhase === phase && styles.phaseButtonTextActive
              ]}>
                {phase.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tabBar}>
        {renderTabButton('strategy', 'bulb', 'Strategy')}
        {renderTabButton('insights', 'mic', 'Voice Insights', state.recentInsights.length)}
        {renderTabButton('conditions', 'cloudy', 'Conditions')}
        {renderTabButton('history', 'time', 'History', state.analysisHistory.length)}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedTab === 'strategy' && renderStrategyTab()}
        {selectedTab === 'insights' && renderInsightsTab()}
        {selectedTab === 'conditions' && renderConditionsTab()}
        {selectedTab === 'history' && renderHistoryTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  racePhaseSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  phaseButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  phaseButtonActive: {
    backgroundColor: 'white',
    boxShadow: '0px 1px',
    elevation: 2,
  },
  phaseButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  phaseButtonTextActive: {
    color: '#0066CC',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#0066CC',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabButtonTextActive: {
    color: '#0066CC',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  strategyContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    boxShadow: '0px 2px',
  },
  strategyHeader: {
    padding: 20,
    backgroundColor: '#0066CC',
  },
  strategyTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strategyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  strategyVenue: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  strategyContent: {
    maxHeight: 400,
  },
  strategySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 4,
  },
  sectionDetails: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  keyFactor: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 20,
  },
  generateButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    boxShadow: '0px 2px',
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  voiceRecorder: {
    marginBottom: 20,
  },
  insightsContainer: {
    gap: 12,
  },
  contingencyGroup: {
    marginTop: 8,
  },
  insightSummary: {
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  insightTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  insightTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  insightDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  insightRecommendation: {
    fontSize: 13,
    color: '#059669',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  comingSoon: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
  },
});
