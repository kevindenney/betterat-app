/**
 * Scoring Dashboard
 * Configure scoring system, calculate standings, and publish results
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Trophy,
  Calculator,
  Settings,
  Download,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  FileText,
  Share2,
} from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { 
  ScoringEngine, 
  DEFAULT_LOW_POINT_CONFIG,
  ScoringConfiguration,
  SeriesStanding,
  ScoreCode,
} from '@/services/scoring/ScoringEngine';

// Types
interface RegattaInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  results_published: boolean;
  results_published_at: string | null;
  results_status: 'draft' | 'provisional' | 'final';
  scoring_config: ScoringConfiguration | null;
}

interface RaceInfo {
  race_number: number;
  status: string;
  race_date: string | null;
  start_time: string | null;
}

type TabType = 'standings' | 'config' | 'publish';

// Preset scoring configurations
const SCORING_PRESETS = [
  {
    id: 'standard',
    name: 'Standard Low Point',
    description: '1 discard after 5 races, 2 after 10',
    config: DEFAULT_LOW_POINT_CONFIG,
  },
  {
    id: 'no_discards',
    name: 'No Discards',
    description: 'All races count',
    config: {
      ...DEFAULT_LOW_POINT_CONFIG,
      discards: [{ after_races: 0, discards: 0 }],
    },
  },
  {
    id: 'generous',
    name: 'Generous Discards',
    description: '1 discard after 3 races, 2 after 6, 3 after 9',
    config: {
      ...DEFAULT_LOW_POINT_CONFIG,
      discards: [
        { after_races: 0, discards: 0 },
        { after_races: 3, discards: 1 },
        { after_races: 6, discards: 2 },
        { after_races: 9, discards: 3 },
      ],
    },
  },
  {
    id: 'championship',
    name: 'Championship',
    description: 'No discards in qualifying, 1 discard in finals',
    config: {
      ...DEFAULT_LOW_POINT_CONFIG,
      discards: [
        { after_races: 0, discards: 0 },
        { after_races: 8, discards: 1 },
      ],
    },
  },
];

export default function ScoringDashboard() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();

  // State
  const [regatta, setRegatta] = useState<RegattaInfo | null>(null);
  const [races, setRaces] = useState<RaceInfo[]>([]);
  const [standings, setStandings] = useState<SeriesStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('standings');
  
  // Config state
  const [config, setConfig] = useState<ScoringConfiguration>(DEFAULT_LOW_POINT_CONFIG);
  const [expandedStanding, setExpandedStanding] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (regattaId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadRegatta(),
      loadRaces(),
      loadStandings(),
    ]);
    setLoading(false);
  };

  const loadRegatta = async () => {
    try {
      const { data, error } = await supabase
        .from('regattas')
        .select('*')
        .eq('id', regattaId)
        .single();

      if (error) throw error;
      setRegatta(data);
      
      // Load scoring config if saved
      if (data.scoring_config) {
        setConfig(data.scoring_config);
      }
    } catch (error) {
      console.error('Error loading regatta:', error);
    }
  };

  const loadRaces = async () => {
    try {
      const { data, error } = await supabase
        .from('regatta_races')
        .select('race_number, status, race_date, start_time')
        .eq('regatta_id', regattaId)
        .order('race_number');

      if (error) throw error;
      setRaces(data || []);
    } catch (error) {
      console.error('Error loading races:', error);
    }
  };

  const loadStandings = async () => {
    try {
      const { data, error } = await supabase
        .from('series_standings')
        .select(`
          *,
          race_entries (
            sail_number,
            entry_number,
            boat_name,
            skipper_name,
            entry_class
          )
        `)
        .eq('regatta_id', regattaId)
        .order('rank');

      if (error) throw error;

      const formattedStandings: SeriesStanding[] = (data || []).map((s: any) => ({
        rank: s.rank,
        entry: {
          entry_id: s.entry_id,
          entry_number: s.race_entries?.entry_number || '',
          sailor_name: s.race_entries?.skipper_name || '',
          sail_number: s.race_entries?.sail_number || '',
          boat_class: s.race_entries?.entry_class || '',
          division: s.division,
        },
        race_scores: s.race_scores || [],
        total_points: s.total_points,
        net_points: s.net_points,
        races_sailed: s.races_sailed,
        discards_used: s.discards_used,
        tied: s.tied,
        tie_breaker: s.tie_breaker,
      }));

      setStandings(formattedStandings);
    } catch (error) {
      console.error('Error loading standings:', error);
    }
  };

  const calculateStandings = async () => {
    if (!regattaId) return;

    setCalculating(true);
    try {
      // Save current config to regatta
      await supabase
        .from('regattas')
        .update({ scoring_config: config })
        .eq('id', regattaId);

      // Calculate using scoring engine
      const engine = new ScoringEngine(config);
      const newStandings = await engine.calculateSeriesStandings(regattaId);
      
      setStandings(newStandings);
      showAlert('Success', 'Standings calculated successfully');
    } catch (error) {
      console.error('Error calculating standings:', error);
      showAlert('Error', 'Failed to calculate standings');
    } finally {
      setCalculating(false);
    }
  };

  const publishResults = async (status: 'provisional' | 'final') => {
    if (!regattaId) return;

    const statusLabel = status === 'provisional' ? 'Provisional' : 'Final';
    
    showConfirm(
      `Publish ${statusLabel} Results`,
      status === 'final'
        ? 'Final results cannot be changed. Are you sure?'
        : 'Provisional results can still be updated. Continue?',
      async () => {
        try {
          // Calculate one more time to ensure current
          await calculateStandings();

          // Update regatta status
          await supabase
            .from('regattas')
            .update({
              results_published: true,
              results_published_at: new Date().toISOString(),
              results_status: status,
            })
            .eq('id', regattaId);

          await loadRegatta();
          showAlert('Published', `${statusLabel} results are now public`);
        } catch (error) {
          console.error('Error publishing results:', error);
          showAlert('Error', 'Failed to publish results');
        }
      },
      { confirmText: 'Publish' }
    );
  };

  const unpublishResults = async () => {
    if (!regattaId) return;

    showConfirm(
      'Unpublish Results',
      'Results will no longer be visible publicly. Continue?',
      async () => {
        try {
          await supabase
            .from('regattas')
            .update({
              results_published: false,
              results_status: 'draft',
            })
            .eq('id', regattaId);

          await loadRegatta();
          showAlert('Unpublished', 'Results are now hidden');
        } catch (error) {
          console.error('Error unpublishing results:', error);
        }
      },
      { destructive: true }
    );
  };

  const exportCSV = () => {
    const header = 'Rank,Sail Number,Boat,Skipper,Net Points,Total Points,Races Sailed\n';
    const rows = standings.map(s => 
      `${s.rank},"${s.entry.sail_number}","${s.entry.entry_number || ''}","${s.entry.sailor_name}",${s.net_points},${s.total_points},${s.races_sailed}`
    ).join('\n');

    const csv = header + rows;
    const filename = `${regatta?.name || 'regatta'}_standings.csv`.replace(/[^a-z0-9]/gi, '_');

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } else {
      showAlert('Export', 'CSV generated:\n\n' + csv.substring(0, 300) + '...');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get race stats
  const completedRaces = races.filter(r => r.status === 'completed').length;
  const totalRaces = races.length;
  const currentDiscards = config.discards
    .filter(d => d.after_races <= completedRaces)
    .sort((a, b) => b.after_races - a.after_races)[0]?.discards || 0;

  // Render standings tab
  const renderStandingsTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completedRaces}</Text>
          <Text style={styles.statLabel}>Races</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{standings.length}</Text>
          <Text style={styles.statLabel}>Entries</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentDiscards}</Text>
          <Text style={styles.statLabel}>Discards</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={calculateStandings}
          disabled={calculating}
        >
          <Calculator size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>
            {calculating ? 'Calculating...' : 'Calculate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={exportCSV}>
          <Download size={18} color="#374151" />
          <Text style={styles.actionButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Standings Table */}
      {standings.length > 0 ? (
        <View style={styles.standingsTable}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.rankCol]}>Pos</Text>
            <Text style={[styles.headerCell, styles.sailCol]}>Sail</Text>
            <Text style={[styles.headerCell, styles.nameCol]}>Boat / Skipper</Text>
            <Text style={[styles.headerCell, styles.pointsCol]}>Net</Text>
            <Text style={[styles.headerCell, styles.totalCol]}>Total</Text>
          </View>

          {/* Rows */}
          {standings.map((standing) => {
            const isExpanded = expandedStanding === standing.entry.entry_id;
            
            return (
              <View key={standing.entry.entry_id}>
                <TouchableOpacity
                  style={[
                    styles.tableRow,
                    standing.rank <= 3 && styles.podiumRow,
                  ]}
                  onPress={() => setExpandedStanding(
                    isExpanded ? null : standing.entry.entry_id
                  )}
                >
                  <View style={[
                    styles.rankBadge,
                    standing.rank === 1 && styles.goldBadge,
                    standing.rank === 2 && styles.silverBadge,
                    standing.rank === 3 && styles.bronzeBadge,
                  ]}>
                    <Text style={styles.rankText}>{standing.rank}</Text>
                  </View>
                  
                  <Text style={[styles.cell, styles.sailCol, styles.sailText]}>
                    {standing.entry.sail_number}
                  </Text>
                  
                  <View style={styles.nameCol}>
                    <Text style={styles.boatName} numberOfLines={1}>
                      {standing.entry.entry_number || standing.entry.sailor_name || '—'}
                    </Text>
                    {standing.entry.sailor_name && standing.entry.entry_number && (
                      <Text style={styles.skipperName} numberOfLines={1}>
                        {standing.entry.sailor_name}
                      </Text>
                    )}
                  </View>
                  
                  <Text style={[styles.cell, styles.pointsCol, styles.netPoints]}>
                    {standing.net_points}
                  </Text>
                  
                  <View style={[styles.totalCol, styles.totalWrapper]}>
                    <Text style={styles.totalPoints}>{standing.total_points}</Text>
                    {isExpanded ? (
                      <ChevronUp size={16} color="#9CA3AF" />
                    ) : (
                      <ChevronDown size={16} color="#9CA3AF" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded Race Details */}
                {isExpanded && (
                  <View style={styles.raceDetails}>
                    <Text style={styles.raceDetailsTitle}>Race by Race</Text>
                    <View style={styles.raceScoresRow}>
                      {standing.race_scores.map((score, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.raceScoreChip,
                            score.excluded && styles.discardedChip,
                          ]}
                        >
                          <Text style={styles.raceNum}>R{score.race_number}</Text>
                          <Text style={[
                            styles.racePoints,
                            score.excluded && styles.discardedPoints,
                            score.score_code && styles.penaltyPoints,
                          ]}>
                            {score.score_code || score.points}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {standing.tied && (
                      <Text style={styles.tieNote}>
                        ⚠️ Tied - broken by: {standing.tie_breaker || 'last race'}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Trophy size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Standings Yet</Text>
          <Text style={styles.emptyText}>
            Complete races and calculate standings to see results
          </Text>
        </View>
      )}
    </View>
  );

  // Render config tab
  const renderConfigTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Presets */}
      <Text style={styles.sectionTitle}>Scoring Presets</Text>
      <View style={styles.presetsGrid}>
        {SCORING_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.presetCard,
              JSON.stringify(config.discards) === JSON.stringify(preset.config.discards) && 
                styles.presetCardActive,
            ]}
            onPress={() => setConfig(preset.config)}
          >
            <Text style={styles.presetName}>{preset.name}</Text>
            <Text style={styles.presetDescription}>{preset.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Discard Rules */}
      <Text style={styles.sectionTitle}>Discard Rules</Text>
      <View style={styles.discardRules}>
        {config.discards.map((rule, index) => (
          <View key={index} style={styles.discardRule}>
            <Text style={styles.discardRuleText}>
              After <Text style={styles.bold}>{rule.after_races}</Text> races: 
              <Text style={styles.bold}> {rule.discards}</Text> discard{rule.discards !== 1 ? 's' : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* Current Status */}
      <Text style={styles.sectionTitle}>Current Status</Text>
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Races Completed</Text>
          <Text style={styles.statusValue}>{completedRaces} / {totalRaces}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Current Discards</Text>
          <Text style={styles.statusValue}>{currentDiscards}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Scoring System</Text>
          <Text style={styles.statusValue}>
            {config.system === 'low_point' ? 'Low Point' : config.system}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Use Corrected Time</Text>
          <Text style={styles.statusValue}>
            {config.use_corrected_time ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Penalty Points */}
      <Text style={styles.sectionTitle}>Penalty Points</Text>
      <View style={styles.penaltyGrid}>
        {(['DNS', 'DNF', 'DSQ', 'OCS', 'BFD', 'RET'] as ScoreCode[]).map(code => (
          <View key={code} style={styles.penaltyItem}>
            <Text style={styles.penaltyCode}>{code}</Text>
            <Text style={styles.penaltyValue}>
              {config.scoring_penalties[code] === 'races_sailed_plus_1' 
                ? 'Entries+1' 
                : config.scoring_penalties[code]}
            </Text>
          </View>
        ))}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveConfigButton}
        onPress={async () => {
          await supabase
            .from('regattas')
            .update({ scoring_config: config })
            .eq('id', regattaId);
          showAlert('Saved', 'Scoring configuration saved');
        }}
      >
        <Check size={20} color="#FFFFFF" />
        <Text style={styles.saveConfigButtonText}>Save Configuration</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render publish tab
  const renderPublishTab = () => (
    <View style={styles.tabContent}>
      {/* Current Status */}
      <View style={styles.publishStatus}>
        <View style={[
          styles.publishStatusBadge,
          regatta?.results_published && styles.publishedBadge,
        ]}>
          {regatta?.results_published ? (
            <Eye size={20} color="#10B981" />
          ) : (
            <EyeOff size={20} color="#6B7280" />
          )}
          <Text style={[
            styles.publishStatusText,
            regatta?.results_published && styles.publishedText,
          ]}>
            {regatta?.results_status === 'final' ? 'Final Results' :
             regatta?.results_status === 'provisional' ? 'Provisional Results' :
             'Draft (Not Published)'}
          </Text>
        </View>
        
        {regatta?.results_published_at && (
          <Text style={styles.publishedAt}>
            Published: {new Date(regatta.results_published_at).toLocaleString()}
          </Text>
        )}
      </View>

      {/* Publishing Workflow */}
      <View style={styles.publishWorkflow}>
        <View style={styles.workflowStep}>
          <View style={[styles.workflowDot, styles.workflowDotComplete]} />
          <View style={styles.workflowContent}>
            <Text style={styles.workflowTitle}>1. Calculate Standings</Text>
            <Text style={styles.workflowDescription}>
              Run scoring calculation to update standings
            </Text>
          </View>
        </View>
        
        <View style={styles.workflowLine} />
        
        <View style={styles.workflowStep}>
          <View style={[
            styles.workflowDot,
            regatta?.results_status !== 'draft' && styles.workflowDotComplete,
          ]} />
          <View style={styles.workflowContent}>
            <Text style={styles.workflowTitle}>2. Publish Provisional</Text>
            <Text style={styles.workflowDescription}>
              Make results visible during protest period
            </Text>
          </View>
        </View>
        
        <View style={styles.workflowLine} />
        
        <View style={styles.workflowStep}>
          <View style={[
            styles.workflowDot,
            regatta?.results_status === 'final' && styles.workflowDotComplete,
          ]} />
          <View style={styles.workflowContent}>
            <Text style={styles.workflowTitle}>3. Publish Final</Text>
            <Text style={styles.workflowDescription}>
              Lock results after protest deadline
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.publishActions}>
        {!regatta?.results_published && (
          <>
            <TouchableOpacity
              style={[styles.publishButton, styles.provisionalButton]}
              onPress={() => publishResults('provisional')}
            >
              <Clock size={20} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Publish Provisional</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.publishButton, styles.finalButton]}
              onPress={() => publishResults('final')}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Publish Final</Text>
            </TouchableOpacity>
          </>
        )}

        {regatta?.results_published && regatta?.results_status === 'provisional' && (
          <>
            <TouchableOpacity
              style={[styles.publishButton, styles.finalButton]}
              onPress={() => publishResults('final')}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Promote to Final</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.publishButton, styles.unpublishButton]}
              onPress={unpublishResults}
            >
              <EyeOff size={20} color="#991B1B" />
              <Text style={[styles.publishButtonText, styles.unpublishText]}>
                Unpublish
              </Text>
            </TouchableOpacity>
          </>
        )}

        {regatta?.results_status === 'final' && (
          <View style={styles.finalNotice}>
            <AlertTriangle size={20} color="#92400E" />
            <Text style={styles.finalNoticeText}>
              Final results are locked. Contact support to make changes.
            </Text>
          </View>
        )}
      </View>

      {/* Share Links */}
      {regatta?.results_published && (
        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share Results</Text>
          <TouchableOpacity
            style={styles.shareLink}
            onPress={() => {
              const url = `https://regattaflow.com/p/results/${regattaId}`;
              if (Platform.OS === 'web') {
                navigator.clipboard.writeText(url);
                showAlert('Copied', 'Link copied to clipboard');
              } else {
                showAlert('Public Link', url);
              }
            }}
          >
            <Share2 size={18} color="#0EA5E9" />
            <Text style={styles.shareLinkText}>Copy Public Results Link</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Trophy size={48} color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading Scoring...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {regatta?.name || 'Scoring'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {completedRaces} races • {standings.length} entries
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'standings', label: 'Standings', icon: Trophy },
          { key: 'config', label: 'Config', icon: Settings },
          { key: 'publish', label: 'Publish', icon: FileText },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabType)}
            >
              <Icon size={20} color={isActive ? '#0EA5E9' : '#6B7280'} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'standings' && renderStandingsTab()}
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'publish' && renderPublishTab()}
      </ScrollView>
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
    backgroundColor: '#0EA5E9',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#BAE6FD',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryAction: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  // Table
  standingsTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  podiumRow: {
    backgroundColor: '#FFFBEB',
  },
  cell: {
    fontSize: 14,
    color: '#374151',
  },
  rankCol: {
    width: 44,
  },
  sailCol: {
    width: 70,
  },
  nameCol: {
    flex: 1,
    paddingRight: 8,
  },
  pointsCol: {
    width: 50,
    textAlign: 'right',
  },
  totalCol: {
    width: 60,
    textAlign: 'right',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBadge: {
    backgroundColor: '#FEF3C7',
  },
  silverBadge: {
    backgroundColor: '#E5E7EB',
  },
  bronzeBadge: {
    backgroundColor: '#FED7AA',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  sailText: {
    fontWeight: '600',
  },
  boatName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  skipperName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  netPoints: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 16,
  },
  totalWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  totalPoints: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Race details
  raceDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  raceDetailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  raceScoresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  raceScoreChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 48,
  },
  discardedChip: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  raceNum: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  racePoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  discardedPoints: {
    textDecorationLine: 'line-through',
    color: '#EF4444',
  },
  penaltyPoints: {
    color: '#DC2626',
  },
  tieNote: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 8,
  },

  // Empty state
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
    textAlign: 'center',
    marginTop: 8,
  },

  // Config tab
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  presetCardActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EFF6FF',
  },
  presetName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  presetDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  discardRules: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  discardRule: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  discardRuleText: {
    fontSize: 14,
    color: '#374151',
  },
  bold: {
    fontWeight: '700',
    color: '#0EA5E9',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  penaltyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  penaltyItem: {
    width: '30%',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  penaltyCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  penaltyValue: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
  },
  saveConfigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  saveConfigButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Publish tab
  publishStatus: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  publishStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  publishedBadge: {
    backgroundColor: '#D1FAE5',
  },
  publishStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  publishedText: {
    color: '#059669',
  },
  publishedAt: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  publishWorkflow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  workflowDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  workflowDotComplete: {
    backgroundColor: '#10B981',
  },
  workflowLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 11,
    marginVertical: 4,
  },
  workflowContent: {
    flex: 1,
  },
  workflowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  workflowDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  publishActions: {
    marginTop: 24,
    gap: 12,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  provisionalButton: {
    backgroundColor: '#F59E0B',
  },
  finalButton: {
    backgroundColor: '#10B981',
  },
  unpublishButton: {
    backgroundColor: '#FEE2E2',
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unpublishText: {
    color: '#991B1B',
  },
  finalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
  },
  finalNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },
  shareSection: {
    marginTop: 24,
  },
  shareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
  },
  shareLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },
});

