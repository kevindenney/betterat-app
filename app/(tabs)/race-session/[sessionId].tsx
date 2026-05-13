/**
 * Race Session Detail Screen
 * Apple-inspired design for viewing completed race with GPS track and AI analysis
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  ChevronLeft,
  Navigation,
  Gauge,
  MapPin,
  Share2,
  Sparkles,
  TrendingUp,
  Flag,
  Target,
  Lightbulb,
  RefreshCw,
  Route,
} from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import { IOS_COLORS } from '@/components/cards/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RaceSession {
  id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  track_points: GPSPoint[];
  notes: string;
  start_marked_at?: number;
  regattas: {
    name: string;
    location: string | null;
  } | null;
}

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

interface AICoachAnalysis {
  id: string;
  overall_summary: string;
  start_analysis: string;
  upwind_analysis: string;
  downwind_analysis: string;
  tactical_decisions: string;
  boat_handling: string;
  recommendations: string[];
  confidence_score: number;
  created_at: string;
}

export default function RaceSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<RaceSession | null>(null);
  const [analysis, setAnalysis] = useState<AICoachAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
    // loadData reads sessionId via closure; keying on sessionId is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('race_timer_sessions')
        .select(`
          *,
          regattas(name, location)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Load analysis
      const { data: analysisData } = await supabase
        .from('ai_coach_analysis')
        .select('*')
        .eq('timer_session_id', sessionId)
        .single();

      if (analysisData) {
        setAnalysis(analysisData);
      }
    } catch (error: any) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    try {
      setGenerating(true);
      const result = await RaceAnalysisService.analyzeRaceSession(sessionId!);
      if (result) {
        loadData();
      } else {
        showAlert('Error', 'Failed to generate analysis');
      }
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to generate analysis');
    } finally {
      setGenerating(false);
    }
  };

  // Calculate stats from track points
  const stats = useMemo(() => {
    if (!session) return null;

    const points = session.track_points || [];
    const speeds = points.map(p => p.speed || 0).filter(s => s > 0);

    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const avgSpeed = speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0;

    // Calculate distance (simple haversine)
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      distance += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    }

    return {
      maxSpeed: maxSpeed * 1.94384, // m/s to knots
      avgSpeed: avgSpeed * 1.94384,
      distance: distance, // in nautical miles
      pointCount: points.length,
    };
  }, [session]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.blue} />
          <Text style={styles.loadingText}>Loading race data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Route size={48} color={IOS_COLORS.tertiaryLabel} />
          </View>
          <Text style={styles.emptyTitle}>Session Not Found</Text>
          <Text style={styles.emptySubtitle}>
            This race session may have been deleted
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const durationMinutes = Math.floor((session.duration_seconds || 0) / 60);
  const durationSeconds = (session.duration_seconds || 0) % 60;
  const raceName = session.regattas?.name || 'Race Session';
  const raceDate = new Date(session.start_time);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonSmall}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={28} color={IOS_COLORS.blue} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{raceName}</Text>
          <Text style={styles.headerSubtitle}>
            {raceDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </Text>
        </View>
        <TouchableOpacity style={styles.shareButton}>
          <Share2 size={22} color={IOS_COLORS.blue} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Map Placeholder */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Route size={40} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.mapPlaceholderText}>GPS Track</Text>
            {stats && stats.pointCount > 0 ? (
              <Text style={styles.mapPlaceholderSubtext}>
                {stats.pointCount} points recorded
              </Text>
            ) : (
              <Text style={styles.mapPlaceholderSubtext}>
                No track data available
              </Text>
            )}
          </View>
        </View>

        {/* Key Metrics Ring */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricRing}>
            <View style={[styles.ringOuter, { borderColor: IOS_COLORS.blue }]}>
              <View style={styles.ringInner}>
                <Text style={styles.metricValue}>
                  {durationMinutes}:{String(durationSeconds).padStart(2, '0')}
                </Text>
                <Text style={styles.metricLabel}>Duration</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Gauge size={20} color={IOS_COLORS.green} />}
            value={stats?.maxSpeed.toFixed(1) || '—'}
            unit="kts"
            label="Max Speed"
            color={IOS_COLORS.green}
          />
          <StatCard
            icon={<TrendingUp size={20} color={IOS_COLORS.blue} />}
            value={stats?.avgSpeed.toFixed(1) || '—'}
            unit="kts"
            label="Avg Speed"
            color={IOS_COLORS.blue}
          />
          <StatCard
            icon={<Navigation size={20} color={IOS_COLORS.teal} />}
            value={stats?.distance.toFixed(2) || '—'}
            unit="nm"
            label="Distance"
            color={IOS_COLORS.teal}
          />
          <StatCard
            icon={<MapPin size={20} color={IOS_COLORS.orange} />}
            value={String(stats?.pointCount || 0)}
            unit="pts"
            label="GPS Points"
            color={IOS_COLORS.orange}
          />
        </View>

        {/* AI Analysis Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color={IOS_COLORS.purple} />
            <Text style={styles.sectionTitle}>Race Analysis</Text>
          </View>

          {analysis ? (
            <View style={styles.analysisContent}>
              {/* Overall Summary */}
              <AnalysisCard
                icon={<TrendingUp size={20} color={IOS_COLORS.blue} />}
                title="Performance Summary"
                content={analysis.overall_summary}
              />

              {/* Start Analysis */}
              {analysis.start_analysis && (
                <AnalysisCard
                  icon={<Flag size={20} color={IOS_COLORS.green} />}
                  title="Start"
                  content={analysis.start_analysis}
                />
              )}

              {/* Tactical Decisions */}
              {analysis.tactical_decisions && (
                <AnalysisCard
                  icon={<Target size={20} color={IOS_COLORS.purple} />}
                  title="Tactical Decisions"
                  content={analysis.tactical_decisions}
                />
              )}

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <View style={styles.recommendationsCard}>
                  <View style={styles.recommendationsHeader}>
                    <Lightbulb size={20} color={IOS_COLORS.orange} />
                    <Text style={styles.recommendationsTitle}>Key Takeaways</Text>
                  </View>
                  {analysis.recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.recommendationBullet} />
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Regenerate Button */}
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleGenerateAnalysis}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                ) : (
                  <RefreshCw size={16} color={IOS_COLORS.blue} />
                )}
                <Text style={styles.regenerateText}>Regenerate Analysis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noAnalysisContainer}>
              <View style={styles.noAnalysisIcon}>
                <Sparkles size={32} color={IOS_COLORS.tertiaryLabel} />
              </View>
              <Text style={styles.noAnalysisTitle}>No Analysis Yet</Text>
              <Text style={styles.noAnalysisSubtitle}>
                Generate AI-powered insights about your race performance
              </Text>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateAnalysis}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.generateButtonText}>Analyzing...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} color="white" />
                    <Text style={styles.generateButtonText}>Generate Analysis</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  unit,
  label,
  color
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Analysis Card Component
function AnalysisCard({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <View style={styles.analysisCard}>
      <View style={styles.analysisCardHeader}>
        {icon}
        <Text style={styles.analysisCardTitle}>{title}</Text>
      </View>
      <Text style={styles.analysisCardContent}>{content}</Text>
    </View>
  );
}

// Haversine distance calculation
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOS_COLORS.gray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: IOS_COLORS.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backButtonSmall: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Map
  mapContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: IOS_COLORS.gray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 4,
  },

  // Metrics Ring
  metricsContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  metricRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '700',
    color: IOS_COLORS.label,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 12,
    marginTop: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },

  // Section
  sectionContainer: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginLeft: 8,
  },

  // Analysis Content
  analysisContent: {
    gap: 12,
  },
  analysisCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  analysisCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  analysisCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginLeft: 8,
  },
  analysisCardContent: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
  },

  // Recommendations
  recommendationsCard: {
    backgroundColor: IOS_COLORS.orange + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: IOS_COLORS.orange + '30',
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginLeft: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.orange,
    marginTop: 7,
    marginRight: 10,
  },
  recommendationText: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    lineHeight: 22,
  },

  // Regenerate
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  regenerateText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },

  // No Analysis
  noAnalysisContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  noAnalysisIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IOS_COLORS.gray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noAnalysisTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  noAnalysisSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.blue,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});
