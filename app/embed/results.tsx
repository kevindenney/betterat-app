/**
 * Embeddable Results Widget
 * Lightweight results display for iframe embedding
 * 
 * URL: /embed/results?club=xxx&regatta=xxx&theme=light|dark
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams } from 'expo-router';
import { ExternalLink, Trophy } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface Standing {
  position: number;
  sail_number: string;
  boat_name: string | null;
  skipper_name: string | null;
  net_points: number;
  total_points: number;
}

interface ResultsData {
  regatta: {
    id: string;
    name: string;
    club_name: string | null;
  };
  standings: Standing[];
  metadata: {
    races_completed: number;
    last_updated: string;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function EmbedResultsWidget() {
  const params = useLocalSearchParams();
  const regattaId = params.regatta as string;
  const theme = (params.theme as string) || 'light';
  const accentColor = (params.accent as string) || '#0EA5E9';
  const limit = parseInt(params.filter_limit as string) || 10;
  
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const fetchResults = useCallback(async () => {
    if (!regattaId) {
      setError('No regatta specified');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}?include=results`);
      
      if (!response.ok) {
        throw new Error('Failed to load results');
      }
      
      const result = await response.json();
      if (!result.results) {
        throw new Error('No results available');
      }
      setData({
        regatta: {
          id: result.regatta.id,
          name: result.regatta.name,
          club_name: result.regatta.club?.name ?? null,
        },
        standings: result.results.standings,
        metadata: {
          races_completed: result.results.metadata.races_completed,
          last_updated: result.results.metadata.last_updated,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [regattaId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Send height to parent for dynamic sizing
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent) {
      const sendHeight = () => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage(
          JSON.stringify({ type: 'regattaflow:resize', widgetId: 'results', height }),
          '*'
        );
      };
      
      sendHeight();
      window.addEventListener('resize', sendHeight);
      return () => window.removeEventListener('resize', sendHeight);
    }
  }, [data]);

  const getPositionStyle = (position: number) => {
    if (position === 1) return { bg: '#FEF3C7', text: '#92400E' };
    if (position === 2) return { bg: isDark ? '#374151' : '#E5E7EB', text: isDark ? '#D1D5DB' : '#374151' };
    if (position === 3) return { bg: '#FED7AA', text: '#9A3412' };
    return { bg: isDark ? '#1F2937' : '#F3F4F6', text: isDark ? '#9CA3AF' : '#6B7280' };
  };

  const openFullResults = () => {
    Linking.openURL(`${API_BASE}/p/results/${regattaId}`);
  };

  const colors = {
    bg: isDark ? '#111827' : '#FFFFFF',
    text: isDark ? '#F9FAFB' : '#1F2937',
    textSecondary: isDark ? '#9CA3AF' : '#6B7280',
    border: isDark ? '#374151' : '#E5E7EB',
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, styles.error, { backgroundColor: colors.bg }]}>
        <Trophy size={24} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error || 'No results available'}
        </Text>
      </View>
    );
  }

  const displayStandings = data.standings.slice(0, limit);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{data.regatta.name}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {data.metadata.races_completed} race{data.metadata.races_completed !== 1 ? 's' : ''} completed
          </Text>
        </View>
        <TouchableOpacity onPress={openFullResults} style={styles.expandButton}>
          <ExternalLink size={16} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* Standings */}
      <ScrollView style={styles.content}>
        {displayStandings.map((standing) => {
          const posStyle = getPositionStyle(standing.position);
          return (
            <View 
              key={standing.sail_number} 
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.position, { backgroundColor: posStyle.bg }]}>
                <Text style={[styles.positionText, { color: posStyle.text }]}>
                  {standing.position}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.sailNumber, { color: colors.text }]}>
                  {standing.sail_number}
                </Text>
                <Text style={[styles.boatName, { color: colors.textSecondary }]}>
                  {standing.boat_name || standing.skipper_name || '—'}
                </Text>
              </View>
              <Text style={[styles.points, { color: colors.text }]}>
                {standing.net_points}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      {data.standings.length > limit && (
        <TouchableOpacity 
          style={[styles.footer, { borderTopColor: colors.border }]}
          onPress={openFullResults}
        >
          <Text style={[styles.footerText, { color: accentColor }]}>
            View all {data.standings.length} entries →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
  },
  error: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  expandButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  position: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  sailNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  boatName: {
    fontSize: 11,
    marginTop: 1,
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  footer: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
