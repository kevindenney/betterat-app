/**
 * Race Leaderboard Component
 * Real-time leaderboard display for race control and public viewing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/RealtimeService';

type RaceResultsIdColumn = 'regatta_id' | 'race_id';

interface RaceResult {
  id: string;
  entry_id: string;
  finish_position?: number;
  corrected_position?: number;
  finish_time?: string;
  elapsed_time?: string;
  corrected_time?: string;
  status: string;
  sail_number?: string;
  entry_number?: string;
  entry_class?: string;
}

interface RaceLeaderboardProps {
  regattaId: string;
  raceNumber: number;
  showCorrected?: boolean;
  compact?: boolean;
}

export default function RaceLeaderboard({
  regattaId,
  raceNumber,
  showCorrected = false,
  compact = false,
}: RaceLeaderboardProps) {
  const [results, setResults] = useState<RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'elapsed' | 'corrected'>('elapsed');
  const [idColumn, setIdColumn] = useState<RaceResultsIdColumn>('regatta_id');

  const isMissingColumn = (error: any, column: RaceResultsIdColumn) =>
    error?.code === '42703' && typeof error?.message === 'string' && error.message.includes(column);

  useEffect(() => {
    loadResults();

    // Subscribe to real-time updates
    const channelName = `leaderboard-${regattaId}-${raceNumber}`;
    const handler = () => {
      loadResults();
    };
    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'race_results',
        filter: `regatta_id=eq.${regattaId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId, raceNumber, sortBy]);

  const loadResults = async () => {
    try {
      const buildQuery = (column: RaceResultsIdColumn) => supabase
        .from('race_results')
        .select(`
          *,
          race_entries!inner(
            sail_number,
            entry_number,
            entry_class
          )
        `)
        .eq(column, regattaId)
        .eq('race_number', raceNumber)
        .eq('status', 'finished')
        .order(
          sortBy === 'corrected' ? 'corrected_position' : 'finish_position',
          { ascending: true, nullsLast: true }
        );

      let { data, error } = await buildQuery(idColumn);
      if (error && idColumn === 'regatta_id' && isMissingColumn(error, 'regatta_id')) {
        const fallbackColumn: RaceResultsIdColumn = 'race_id';
        const fallback = await buildQuery(fallbackColumn);
        data = fallback.data;
        error = fallback.error;
        if (!error) {
          setIdColumn(fallbackColumn);
        }
      }

      if (error) throw error;

      const formattedResults: RaceResult[] = (data || []).map((r: any) => ({
        ...r,
        sail_number: r.race_entries?.sail_number,
        entry_number: r.race_entries?.entry_number,
        entry_class: r.race_entries?.entry_class,
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadResults();
  };

  const formatTime = (elapsed?: string) => {
    if (!elapsed) return '--:--:--';

    try {
      // Parse PostgreSQL interval format (e.g., "01:23:45")
      const parts = elapsed.split(':');
      if (parts.length === 3) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        const seconds = parts[2].split('.')[0].padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
      }
      return elapsed;
    } catch {
      return elapsed;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'finished':
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'dnf':
        return <MaterialCommunityIcons name="close-circle" size={20} color="#FF4444" />;
      case 'dns':
        return <MaterialCommunityIcons name="minus-circle" size={20} color="#999" />;
      case 'dsq':
        return <MaterialCommunityIcons name="alert-circle" size={20} color="#FF4444" />;
      case 'ocs':
        return <MaterialCommunityIcons name="flag-triangle" size={20} color="#FFA500" />;
      default:
        return <Ionicons name="ellipse" size={20} color="#2196F3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.toUpperCase();
  };

  const renderLeaderboardItem = ({ item, index }: { item: RaceResult; index: number }) => {
    const position = sortBy === 'corrected' ? item.corrected_position : item.finish_position;
    const time = sortBy === 'corrected' ? item.corrected_time : item.elapsed_time;

    if (compact) {
      return (
        <View style={styles.compactRow}>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{position || '-'}</Text>
          </View>
          <Text style={styles.compactSailNumber}>{item.sail_number}</Text>
          <Text style={styles.compactTime}>{formatTime(time)}</Text>
          {item.status !== 'finished' && (
            <Text style={styles.compactStatus}>{getStatusLabel(item.status)}</Text>
          )}
        </View>
      );
    }

    return (
      <View style={[
        styles.resultRow,
        index < 3 && styles.topThreeRow,
      ]}>
        <View style={styles.positionContainer}>
          {position && position <= 3 ? (
            <View style={[
              styles.medalBadge,
              position === 1 && styles.goldMedal,
              position === 2 && styles.silverMedal,
              position === 3 && styles.bronzeMedal,
            ]}>
              <Text style={styles.medalText}>{position}</Text>
            </View>
          ) : (
            <Text style={styles.position}>{position || '-'}</Text>
          )}
        </View>

        <View style={styles.boatInfo}>
          <View style={styles.boatHeader}>
            <Text style={styles.sailNumber}>{item.sail_number}</Text>
            {getStatusIcon(item.status)}
          </View>
          <Text style={styles.entryNumber}>#{item.entry_number}</Text>
          {item.entry_class && (
            <Text style={styles.entryClass}>{item.entry_class}</Text>
          )}
        </View>

        <View style={styles.timeInfo}>
          {item.status === 'finished' ? (
            <>
              <Text style={styles.time}>{formatTime(time)}</Text>
              {item.finish_time && (
                <Text style={styles.finishTime}>
                  {new Date(item.finish_time).toLocaleTimeString()}
                </Text>
              )}
            </>
          ) : (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="trophy-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No finishers yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCorrected && (
        <View style={styles.sortToggle}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'elapsed' && styles.sortButtonActive]}
            onPress={() => setSortBy('elapsed')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'elapsed' && styles.sortButtonTextActive]}>
              Elapsed Time
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'corrected' && styles.sortButtonActive]}
            onPress={() => setSortBy('corrected')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'corrected' && styles.sortButtonTextActive]}>
              Corrected Time
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderLeaderboardItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          !compact ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerText}>Pos</Text>
              <Text style={[styles.headerText, { flex: 1 }]}>Boat</Text>
              <Text style={styles.headerText}>Time</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
  sortToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 5,
    borderRadius: 8,
    marginBottom: 15,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#2196F3',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topThreeRow: {
    backgroundColor: '#FFFEF7',
  },
  positionContainer: {
    width: 50,
    alignItems: 'center',
  },
  position: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  medalBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldMedal: {
    backgroundColor: '#FFD700',
  },
  silverMedal: {
    backgroundColor: '#C0C0C0',
  },
  bronzeMedal: {
    backgroundColor: '#CD7F32',
  },
  medalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  boatInfo: {
    flex: 1,
    marginLeft: 10,
  },
  boatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sailNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  entryNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  entryClass: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timeInfo: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  finishTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },

  // Compact styles
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  positionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  compactSailNumber: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  compactTime: {
    fontSize: 14,
    color: '#666',
  },
  compactStatus: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
});
