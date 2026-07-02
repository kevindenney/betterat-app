/**
 * Public Schedule Page
 * Accessible without authentication - shareable link for non-BetterAt users
 * 
 * URL: /p/schedule/[regattaId]
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    CheckCircle,
    Clock,
    Pause,
    Share2,
    Wind,
    XCircle,
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

interface ScheduledRace {
  id: string;
  race_number: number;
  division: string | null;
  scheduled_start: string;
  warning_signal: string | null;
  course_type: string | null;
  course_description: string | null;
  status: 'scheduled' | 'postponed' | 'abandoned' | 'completed' | 'in_progress';
  postponement_reason: string | null;
  new_start_time: string | null;
}

interface ScheduleDay {
  date: string;
  day_name: string;
  races: ScheduledRace[];
  weather_forecast: {
    wind_speed: number | null;
    wind_direction: string | null;
  } | null;
  special_notices: string[];
}

interface ScheduleData {
  regatta: {
    id: string;
    name: string;
    venue: string | null;
    club_name: string | null;
  };
  schedule: ScheduleDay[];
  metadata: {
    total_races: number;
    races_completed: number;
    last_updated: string;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function PublicSchedulePage() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchSchedule = useCallback(async (isRefresh = false) => {
    if (!regattaId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}?include=schedule`);
      
      if (!response.ok) {
        throw new Error('Failed to load schedule');
      }
      
      const result = await response.json();
      const schedule = result.schedule?.days ?? [];
      setData({
        regatta: {
          id: result.regatta.id,
          name: result.regatta.name,
          venue: result.regatta.venue,
          club_name: result.regatta.club?.name ?? null,
        },
        schedule,
        metadata: result.schedule?.metadata ?? {
          total_races: 0,
          races_completed: 0,
          last_updated: new Date().toISOString(),
        },
      });
      
      // Auto-select today or first day
      if (schedule.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todaySchedule = schedule.find((d: ScheduleDay) => d.date === today);
        setSelectedDate(todaySchedule ? today : schedule[0].date);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [regattaId]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  const handleShare = async () => {
    const url = `${API_BASE}/p/schedule/${regattaId}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: `${data?.regatta.name} - Schedule`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await Share.share({
        message: `Check out the schedule for ${data?.regatta.name}: ${url}`,
        url,
      });
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    // Handle both ISO datetime and time-only formats
    const time = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr.substring(0, 5);
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color="#10B981" />;
      case 'postponed':
        return <Pause size={16} color="#F59E0B" />;
      case 'abandoned':
        return <XCircle size={16} color="#EF4444" />;
      case 'in_progress':
        return <Wind size={16} color="#0EA5E9" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'postponed':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'abandoned':
        return { bg: '#FEE2E2', text: '#991B1B' };
      case 'in_progress':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const selectedDayData = data?.schedule.find((d) => d.date === selectedDate);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <Calendar size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Schedule Not Available</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchSchedule()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(`/p/${regattaId}`)}>
          <Text style={styles.secondaryButtonText}>View Regatta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            Linking.openURL(
              `mailto:info@better.at?subject=${encodeURIComponent('Public Schedule Unavailable')}&body=${encodeURIComponent(`Regatta: ${regattaId}\nError: ${error || 'Schedule unavailable'}`)}`
            )
          }
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.regattaName}>{data.regatta.name}</Text>
          <Text style={styles.subtitle}>Race Schedule</Text>
        </View>
        
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share2 size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.dateSelector}
        contentContainerStyle={styles.dateSelectorContent}
      >
        {data.schedule.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === new Date().toISOString().split('T')[0];
          
          return (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dateCard,
                isSelected && styles.dateCardSelected,
                isToday && !isSelected && styles.dateCardToday,
              ]}
              onPress={() => setSelectedDate(day.date)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {day.day_name.substring(0, 3)}
              </Text>
              <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                {formatDate(day.date)}
              </Text>
              <Text style={[styles.raceCount, isSelected && styles.raceCountSelected]}>
                {day.races.length} race{day.races.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSchedule(true)}
            colors={['#0EA5E9']}
          />
        }
      >
        {selectedDayData ? (
          <>
            {/* Weather (if available) */}
            {selectedDayData.weather_forecast?.wind_speed && (
              <View style={styles.weatherCard}>
                <Wind size={20} color="#0EA5E9" />
                <Text style={styles.weatherText}>
                  {selectedDayData.weather_forecast.wind_speed} kts 
                  {selectedDayData.weather_forecast.wind_direction && 
                    ` ${selectedDayData.weather_forecast.wind_direction}`}
                </Text>
              </View>
            )}

            {/* Races */}
            {selectedDayData.races.length > 0 ? (
              <View style={styles.racesContainer}>
                {selectedDayData.races.map((race) => {
                  const statusStyle = getStatusStyle(race.status);
                  
                  return (
                    <View key={race.id} style={styles.raceCard}>
                      <View style={styles.raceHeader}>
                        <View style={styles.raceInfo}>
                          <Text style={styles.raceNumber}>Race {race.race_number}</Text>
                          {race.division && (
                            <View style={styles.divisionBadge}>
                              <Text style={styles.divisionText}>{race.division}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                          {getStatusIcon(race.status)}
                          <Text style={[styles.statusText, { color: statusStyle.text }]}>
                            {race.status.charAt(0).toUpperCase() + race.status.slice(1).replace('_', ' ')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.raceDetails}>
                        <View style={styles.timeRow}>
                          <Clock size={16} color="#6B7280" />
                          <Text style={styles.timeLabel}>Warning Signal:</Text>
                          <Text style={styles.timeValue}>
                            {race.status === 'postponed' && race.new_start_time
                              ? formatTime(race.new_start_time)
                              : formatTime(race.warning_signal || race.scheduled_start)}
                          </Text>
                        </View>

                        {race.course_type && (
                          <View style={styles.courseRow}>
                            <Text style={styles.courseLabel}>Course:</Text>
                            <Text style={styles.courseValue}>
                              {race.course_type}
                              {race.course_description && ` - ${race.course_description}`}
                            </Text>
                          </View>
                        )}

                        {race.status === 'postponed' && race.postponement_reason && (
                          <View style={styles.postponementNotice}>
                            <AlertTriangle size={14} color="#92400E" />
                            <Text style={styles.postponementText}>{race.postponement_reason}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noRaces}>
                <Calendar size={40} color="#9CA3AF" />
                <Text style={styles.noRacesText}>No races scheduled for this day</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noRaces}>
            <Calendar size={40} color="#9CA3AF" />
            <Text style={styles.noRacesText}>Select a day to view schedule</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date(data.metadata.last_updated).toLocaleString()}
          </Text>
          <Text style={styles.footerBrand}>Powered by BetterAt</Text>
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
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
  },
  dateSelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateSelectorContent: {
    padding: 12,
    gap: 8,
  },
  dateCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  dateCardSelected: {
    backgroundColor: '#0EA5E9',
  },
  dateCardToday: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  dateTextSelected: {
    color: '#FFFFFF',
  },
  raceCount: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  raceCountSelected: {
    color: '#BAE6FD',
  },
  content: {
    flex: 1,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  weatherText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  raceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  raceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  divisionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  divisionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  raceDetails: {
    padding: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  courseRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  courseLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  courseValue: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  postponementNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  postponementText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  noRaces: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  noRacesText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerBrand: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
