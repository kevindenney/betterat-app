/**
 * Embeddable Schedule Widget
 * Lightweight schedule display for iframe embedding
 * 
 * URL: /embed/schedule?club=xxx&regatta=xxx&theme=light|dark
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Calendar, Clock, ExternalLink } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface ScheduledRace {
  race_number: number;
  division: string | null;
  scheduled_start: string;
  status: string;
  postponement_reason: string | null;
  new_start_time: string | null;
}

interface ScheduleDay {
  date: string;
  day_name: string;
  races: ScheduledRace[];
}

interface ScheduleData {
  regatta: {
    id: string;
    name: string;
  };
  schedule: ScheduleDay[];
  metadata: {
    total_races: number;
    races_completed: number;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function EmbedScheduleWidget() {
  const params = useLocalSearchParams();
  const regattaId = params.regatta as string;
  const theme = (params.theme as string) || 'light';
  const accentColor = (params.accent as string) || '#0EA5E9';
  
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const fetchSchedule = useCallback(async () => {
    if (!regattaId) {
      setError('No regatta specified');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}?include=schedule`);
      
      if (!response.ok) {
        throw new Error('Failed to load schedule');
      }
      
      const result = await response.json();
      setData({
        regatta: {
          id: result.regatta.id,
          name: result.regatta.name,
        },
        schedule: result.schedule?.days ?? [],
        metadata: result.schedule?.metadata ?? {
          total_races: 0,
          races_completed: 0,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [regattaId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Send height to parent
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent) {
      const sendHeight = () => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage(
          JSON.stringify({ type: 'regattaflow:resize', widgetId: 'schedule', height }),
          '*'
        );
      };
      
      sendHeight();
      window.addEventListener('resize', sendHeight);
      return () => window.removeEventListener('resize', sendHeight);
    }
  }, [data]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    const time = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr.substring(0, 5);
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'postponed': return '#F59E0B';
      case 'abandoned': return '#EF4444';
      case 'in_progress': return accentColor;
      default: return isDark ? '#6B7280' : '#9CA3AF';
    }
  };

  const openFullSchedule = () => {
    Linking.openURL(`${API_BASE}/p/schedule/${regattaId}`);
  };

  const colors = {
    bg: isDark ? '#111827' : '#FFFFFF',
    text: isDark ? '#F9FAFB' : '#1F2937',
    textSecondary: isDark ? '#9CA3AF' : '#6B7280',
    border: isDark ? '#374151' : '#E5E7EB',
    cardBg: isDark ? '#1F2937' : '#F9FAFB',
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
        <Calendar size={24} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error || 'No schedule available'}
        </Text>
      </View>
    );
  }

  // Find today's or next upcoming day
  const today = new Date().toISOString().split('T')[0];
  const todayOrNextDay = data.schedule.find(d => d.date >= today) || data.schedule[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{data.regatta.name}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {data.metadata.races_completed}/{data.metadata.total_races} races completed
          </Text>
        </View>
        <TouchableOpacity onPress={openFullSchedule} style={styles.expandButton}>
          <ExternalLink size={16} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* Schedule */}
      <ScrollView style={styles.content}>
        {todayOrNextDay && (
          <View>
            <View style={[styles.dayHeader, { backgroundColor: colors.cardBg }]}>
              <Text style={[styles.dayName, { color: colors.text }]}>
                {formatDate(todayOrNextDay.date)}
              </Text>
              {todayOrNextDay.date === today && (
                <View style={[styles.todayBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.todayText}>Today</Text>
                </View>
              )}
            </View>

            {todayOrNextDay.races.map((race) => (
              <View 
                key={race.race_number}
                style={[styles.raceRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.raceTime}>
                  <Clock size={12} color={getStatusColor(race.status)} />
                  <Text style={[styles.timeText, { color: colors.text }]}>
                    {race.status === 'postponed' && race.new_start_time
                      ? formatTime(race.new_start_time)
                      : formatTime(race.scheduled_start)}
                  </Text>
                </View>
                <View style={styles.raceInfo}>
                  <Text style={[styles.raceName, { color: colors.text }]}>
                    Race {race.race_number}
                    {race.division && ` • ${race.division}`}
                  </Text>
                  {race.status === 'postponed' && (
                    <View style={styles.postponedRow}>
                      <AlertTriangle size={10} color="#F59E0B" />
                      <Text style={styles.postponedText}>
                        {race.postponement_reason || 'Postponed'}
                      </Text>
                    </View>
                  )}
                </View>
                <View 
                  style={[
                    styles.statusDot, 
                    { backgroundColor: getStatusColor(race.status) }
                  ]} 
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <TouchableOpacity 
        style={[styles.footer, { borderTopColor: colors.border }]}
        onPress={openFullSchedule}
      >
        <Text style={[styles.footerText, { color: accentColor }]}>
          View full schedule →
        </Text>
      </TouchableOpacity>
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
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  dayName: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  raceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  raceTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  raceInfo: {
    flex: 1,
  },
  raceName: {
    fontSize: 13,
  },
  postponedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  postponedText: {
    fontSize: 10,
    color: '#F59E0B',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
