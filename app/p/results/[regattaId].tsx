/**
 * Public Results Page
 * Accessible without authentication - shareable link for non-BetterAt users
 * 
 * URL: /p/results/[regattaId]
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Anchor,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Share2,
    Trophy,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Share,
} from 'react-native';

interface RaceResult {
  position: number;
  sail_number: string;
  boat_name: string | null;
  skipper_name: string | null;
  points: number;
  status: string;
}

interface Race {
  race_number: number;
  division: string | null;
  results: RaceResult[];
}

interface Standing {
  position: number;
  sail_number: string;
  boat_name: string | null;
  skipper_name: string | null;
  net_points: number;
  total_points: number;
  races_sailed: number;
  race_results: { race: number; points: number; discarded: boolean }[];
}

interface ResultsData {
  regatta: {
    id: string;
    name: string;
    venue: string | null;
    club_name: string | null;
    results_published_at: string | null;
  };
  races: Race[];
  standings: Standing[];
  metadata: {
    total_entries: number;
    races_completed: number;
    last_updated: string;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function PublicResultsPage() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRaces, setExpandedRaces] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'standings' | 'races'>('standings');

  const fetchResults = useCallback(async (isRefresh = false) => {
    if (!regattaId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}?include=results`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load results');
      }
      
      const result = await response.json();
      if (!result.results) {
        throw new Error('Results are not published yet');
      }
      setData({
        regatta: {
          id: result.regatta.id,
          name: result.regatta.name,
          venue: result.regatta.venue,
          club_name: result.regatta.club?.name ?? null,
          results_published_at: result.results.metadata.last_updated,
        },
        races: result.results.races,
        standings: result.results.standings,
        metadata: result.results.metadata,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [regattaId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const handleShare = async () => {
    const url = `${API_BASE}/p/results/${regattaId}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: `${data?.regatta.name} - Results`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await Share.share({
        message: `Check out results for ${data?.regatta.name}: ${url}`,
        url,
      });
    }
  };

  const handleDownloadCSV = () => {
    const csvUrl = `${API_BASE}/api/public/regattas/${regattaId}?include=results&format=csv`;
    if (Platform.OS === 'web') {
      window.open(csvUrl, '_blank');
    } else {
      // For mobile, we'd use a download library
      alert('Download available at: ' + csvUrl);
    }
  };

  const toggleRaceExpand = (raceNumber: number) => {
    const next = new Set(expandedRaces);
    if (next.has(raceNumber)) {
      next.delete(raceNumber);
    } else {
      next.add(raceNumber);
    }
    setExpandedRaces(next);
  };

  const formatLastUpdated = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) return { backgroundColor: '#FEF3C7', color: '#92400E' };
    if (position === 2) return { backgroundColor: '#E5E7EB', color: '#374151' };
    if (position === 3) return { backgroundColor: '#FED7AA', color: '#9A3412' };
    return { backgroundColor: '#F3F4F6', color: '#6B7280' };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Trophy size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Results Not Available</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchResults()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(`/p/${regattaId}`)}>
          <Text style={styles.secondaryButtonText}>View Regatta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            Linking.openURL(
              `mailto:info@better.at?subject=${encodeURIComponent('Public Results Unavailable')}&body=${encodeURIComponent(`Regatta: ${regattaId}\nError: ${error}`)}`
            )
          }
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.regattaName}>{data.regatta.name}</Text>
          {data.regatta.club_name && (
            <Text style={styles.clubName}>{data.regatta.club_name}</Text>
          )}
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Share2 size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadCSV} style={styles.actionButton}>
            <Download size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.metadata.total_entries}</Text>
          <Text style={styles.statLabel}>Entries</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.metadata.races_completed}</Text>
          <Text style={styles.statLabel}>Races</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Clock size={14} color="#6B7280" />
          <Text style={styles.statLabel}>
            {formatLastUpdated(data.metadata.last_updated)}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standings' && styles.activeTab]}
          onPress={() => setActiveTab('standings')}
        >
          <Trophy size={18} color={activeTab === 'standings' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'standings' && styles.activeTabText]}>
            Standings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'races' && styles.activeTab]}
          onPress={() => setActiveTab('races')}
        >
          <Anchor size={18} color={activeTab === 'races' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'races' && styles.activeTabText]}>
            Race by Race
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchResults(true)}
            colors={['#0EA5E9']}
          />
        }
      >
        {activeTab === 'standings' ? (
          <View style={styles.standingsTable}>
            {/* Header Row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.posCol]}>Pos</Text>
              <Text style={[styles.tableHeaderCell, styles.sailCol]}>Sail</Text>
              <Text style={[styles.tableHeaderCell, styles.nameCol]}>Boat / Skipper</Text>
              <Text style={[styles.tableHeaderCell, styles.pointsCol]}>Net</Text>
              <Text style={[styles.tableHeaderCell, styles.totalCol]}>Total</Text>
            </View>

            {/* Data Rows */}
            {data.standings.map((standing) => {
              const posStyle = getPositionStyle(standing.position);
              return (
                <View key={standing.sail_number} style={styles.tableRow}>
                  <View style={[styles.positionBadge, { backgroundColor: posStyle.backgroundColor }]}>
                    <Text style={[styles.positionText, { color: posStyle.color }]}>
                      {standing.position}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, styles.sailCol]}>{standing.sail_number}</Text>
                  <View style={styles.nameCol}>
                    <Text style={styles.boatName}>{standing.boat_name || '—'}</Text>
                    <Text style={styles.skipperName}>{standing.skipper_name || '—'}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.pointsCol, styles.pointsValue]}>
                    {standing.net_points}
                  </Text>
                  <Text style={[styles.tableCell, styles.totalCol]}>
                    {standing.total_points}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.racesContainer}>
            {data.races.map((race) => (
              <View key={race.race_number} style={styles.raceCard}>
                <TouchableOpacity
                  style={styles.raceHeader}
                  onPress={() => toggleRaceExpand(race.race_number)}
                >
                  <Text style={styles.raceTitle}>Race {race.race_number}</Text>
                  {race.division && (
                    <Text style={styles.raceDivision}>{race.division}</Text>
                  )}
                  {expandedRaces.has(race.race_number) ? (
                    <ChevronUp size={20} color="#6B7280" />
                  ) : (
                    <ChevronDown size={20} color="#6B7280" />
                  )}
                </TouchableOpacity>

                {expandedRaces.has(race.race_number) && (
                  <View style={styles.raceResults}>
                    {race.results.map((result) => (
                      <View key={result.sail_number} style={styles.raceResultRow}>
                        <View style={styles.raceResultPos}>
                          <Text style={styles.raceResultPosText}>{result.position}</Text>
                        </View>
                        <Text style={styles.raceResultSail}>{result.sail_number}</Text>
                        <Text style={styles.raceResultName}>
                          {result.boat_name || result.skipper_name || '—'}
                        </Text>
                        <Text style={[
                          styles.raceResultPoints,
                          result.status !== 'finished' && styles.raceResultPenalty
                        ]}>
                          {result.status !== 'finished' ? result.status.toUpperCase() : result.points}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by BetterAt</Text>
        </View>
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
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  regattaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  clubName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
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
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#0EA5E9',
  },
  content: {
    flex: 1,
  },
  standingsTable: {
    margin: 16,
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
  tableHeaderCell: {
    fontSize: 12,
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
  posCol: {
    width: 40,
  },
  sailCol: {
    width: 70,
  },
  nameCol: {
    flex: 1,
  },
  pointsCol: {
    width: 50,
    textAlign: 'right',
  },
  totalCol: {
    width: 50,
    textAlign: 'right',
  },
  tableCell: {
    fontSize: 14,
    color: '#374151',
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '700',
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
  pointsValue: {
    fontWeight: '700',
    color: '#1F2937',
  },
  racesContainer: {
    padding: 16,
    gap: 12,
  },
  raceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  raceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  raceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  raceDivision: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  raceResults: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  raceResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  raceResultPos: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  raceResultPosText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  raceResultSail: {
    width: 70,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  raceResultName: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  raceResultPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    width: 40,
    textAlign: 'right',
  },
  raceResultPenalty: {
    color: '#EF4444',
    fontSize: 12,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
