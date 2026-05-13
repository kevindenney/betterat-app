/**
 * Enhanced Race Overview Card
 * Quick summary of race details, conditions, and AI strategy confidence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StrategyCard } from './StrategyCard';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

interface RaceOverviewCardProps {
  raceId: string;
  raceName: string;
  startTime?: string;
  venue?: {
    name?: string;
  };
  weather?: {
    wind?: {
      speed: number;
      direction: string;
      speedMin?: number;
      speedMax?: number;
    };
    current?: {
      speed: number;
      direction: number;
    };
  };
  boatClass?: string;
  onRegenerateStrategy?: () => void;
}

export function RaceOverviewCard({
  raceId,
  raceName,
  startTime,
  venue,
  weather,
  boatClass,
  onRegenerateStrategy
}: RaceOverviewCardProps) {
  const { user } = useAuth();
  const [confidence, setConfidence] = useState<number | null>(null);
  const [strategyAge, setStrategyAge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>('');

  const loadStrategyInfo = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const primary = await supabase
        .from('race_strategies')
        .select('confidence_score, created_at')
        .eq('regatta_id', raceId)
        .eq('user_id', user.id)
        .maybeSingle();
      let data = primary.data;
      let error = primary.error;
      if (error && isMissingIdColumn(error, 'race_strategies', 'regatta_id')) {
        const fallback = await supabase
          .from('race_strategies')
          .select('confidence_score, created_at')
          .eq('race_id', raceId)
          .eq('user_id', user.id)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      if (data) {
        setConfidence(data.confidence_score || 75);

        // Calculate strategy age
        const created = new Date(data.created_at);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));

        if (diffHours < 1) {
          setStrategyAge('Just now');
        } else if (diffHours < 24) {
          setStrategyAge(`${diffHours}h ago`);
        } else {
          const days = Math.floor(diffHours / 24);
          setStrategyAge(`${days}d ago`);
        }
      }
    } catch (err) {
      console.error('[RaceOverviewCard] Error loading strategy info:', err);
    } finally {
      setLoading(false);
    }
  }, [user, raceId]);

  useEffect(() => {
    loadStrategyInfo();
  }, [loadStrategyInfo]);

  // Update countdown every minute
  useEffect(() => {
    if (!startTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diff = start.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Race started');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setCountdown(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [startTime]);

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return '#10B981'; // Green
    if (conf >= 60) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  return (
    <StrategyCard
      icon="chart-box"
      title="Race Overview"
      expandable={false}
    >
      <View style={styles.container}>
        {/* Race Info */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Race</Text>
              <Text style={styles.value} numberOfLines={1}>{raceName}</Text>
            </View>
            {startTime && countdown && (
              <View style={styles.infoItem}>
                <Text style={styles.label}>Starts In</Text>
                <Text style={[styles.value, styles.countdown]}>{countdown}</Text>
              </View>
            )}
          </View>

          {(venue?.name || boatClass) && (
            <View style={styles.row}>
              {venue?.name && (
                <View style={styles.infoItem}>
                  <Text style={styles.label}>Venue</Text>
                  <Text style={styles.value} numberOfLines={1}>{venue.name}</Text>
                </View>
              )}
              {boatClass && (
                <View style={styles.infoItem}>
                  <Text style={styles.label}>Class</Text>
                  <Text style={styles.value}>{boatClass}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Conditions */}
        {weather && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONDITIONS</Text>
            <View style={styles.conditionsGrid}>
              {weather.wind && (
                <View style={styles.conditionItem}>
                  <MaterialCommunityIcons name="weather-windy" size={20} color="#3B82F6" />
                  <View style={styles.conditionText}>
                    <Text style={styles.conditionLabel}>Wind</Text>
                    <Text style={styles.conditionValue}>
                      {weather.wind.speedMin && weather.wind.speedMax
                        ? `${Math.round(weather.wind.speedMin)}-${Math.round(weather.wind.speedMax)} kts`
                        : `${Math.round(weather.wind.speed)} kts`
                      }{weather.wind.direction ? ` ${weather.wind.direction}` : ''}
                    </Text>
                  </View>
                </View>
              )}
              {weather.current && (
                <View style={styles.conditionItem}>
                  <MaterialCommunityIcons name="waves" size={20} color="#06B6D4" />
                  <View style={styles.conditionText}>
                    <Text style={styles.conditionLabel}>Current</Text>
                    <Text style={styles.conditionValue}>
                      {weather.current.speed != null ? weather.current.speed.toFixed(1) : '0.0'} kts
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* AI Strategy Confidence */}
        {!loading && confidence !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STRATEGY CONFIDENCE</Text>
            <View style={styles.confidenceContainer}>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${confidence}%`,
                      backgroundColor: getConfidenceColor(confidence)
                    }
                  ]}
                />
              </View>
              <Text style={[styles.confidencePercent, { color: getConfidenceColor(confidence) }]}>
                {confidence}%
              </Text>
            </View>
            {strategyAge && (
              <Text style={styles.strategyAge}>Strategy generated {strategyAge}</Text>
            )}
          </View>
        )}

        {/* Regenerate Button */}
        {onRegenerateStrategy && (
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={onRegenerateStrategy}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#3B82F6" />
            <Text style={styles.regenerateText}>Regenerate Strategy</Text>
          </TouchableOpacity>
        )}
      </View>
    </StrategyCard>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  countdown: {
    color: '#3B82F6',
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    minWidth: '45%',
  },
  conditionText: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidencePercent: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  strategyAge: {
    fontSize: 12,
    color: '#64748B',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  regenerateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
