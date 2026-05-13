/**
 * Client Detail Screen
 * Shows detailed information about a coaching client including:
 * - Session history
 * - Progress metrics and charts
 * - Notes and feedback
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCoachWorkspace } from '@/hooks/useCoachWorkspace';
import {
    ClientDetails,
    ClientProgressMetric,
    coachingService,
    CoachingSession
} from '@/services/CoachingService';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { LineChart } from 'react-native-chart-kit';
import { messagingService } from '@/services/MessagingService';

const screenWidth = Dimensions.get('window').width;

const isUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
};

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { coachId, loading: personaLoading, refresh: refreshPersonaContext } = useCoachWorkspace();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTab, setSelectedTab] = useState<'sessions' | 'progress' | 'notes'>('sessions');

  const isCreateRoute = typeof id === 'string' && id === 'new';
  const clientId = useMemo(() => (isUuid(id) ? id : null), [id]);

  useEffect(() => {
    if (isCreateRoute) {
      router.replace('/coach/client/new');
      return;
    }

    if (coachId && clientId) {
      loadClientDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, clientId, isCreateRoute, router]);

  const loadClientDetails = async () => {
    if (!coachId || !clientId) return;

    try {
      const details = await coachingService.getClientDetails(clientId);
      setClientDetails(details);
      setNotes(details?.coach_notes || '');
    } catch (error) {
      console.error('Error loading client details:', error);
      showAlert('Error', 'Failed to load client details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (clientId) {
      loadClientDetails();
    }
  };

  const handleSaveNotes = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      await coachingService.updateClient(id, { coach_notes: notes });
      setEditingNotes(false);
      showAlert('Success', 'Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      showAlert('Error', 'Failed to save notes');
    }
  };

  const handleSessionPress = (sessionId: string) => {
    router.push(`/coach/session/${sessionId}`);
  };

  const renderSessionCard = (session: CoachingSession) => {
    const isCompleted = session.status === 'completed';
    const isUpcoming = session.status === 'scheduled';

    return (
      <TouchableOpacity
        key={session.id}
        style={styles.sessionCard}
        onPress={() => handleSessionPress(session.id)}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTypeContainer}>
            <Ionicons
              name={getSessionIcon(session.session_type)}
              size={24}
              color={isCompleted ? '#10B981' : isUpcoming ? '#007AFF' : '#94A3B8'}
            />
            <View style={styles.sessionInfo}>
              <ThemedText style={styles.sessionType}>
                {formatSessionType(session.session_type)}
              </ThemedText>
              <ThemedText style={styles.sessionDate}>
                {session.completed_at
                  ? format(new Date(session.completed_at), 'MMM d, yyyy')
                  : session.scheduled_at
                  ? format(new Date(session.scheduled_at), 'MMM d, yyyy')
                  : 'Not scheduled'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sessionStatus}>
            <ThemedText style={[styles.statusBadge, getStatusStyle(session.status)]}>
              {session.status}
            </ThemedText>
          </View>
        </View>

        {session.goals && (
          <ThemedText style={styles.sessionGoals} numberOfLines={2}>
            {session.goals}
          </ThemedText>
        )}

        <View style={styles.sessionMeta}>
          <ThemedText style={styles.sessionMetaText}>
            {session.duration_minutes} min
          </ThemedText>
          {session.venue?.name && (
            <ThemedText style={styles.sessionMetaText}>
              📍 {session.venue.name}
            </ThemedText>
          )}
          {session.feedback && (
            <ThemedText style={styles.sessionMetaText}>
              ⭐ {session.feedback.rating}/5
            </ThemedText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderProgressChart = () => {
    if (!clientDetails?.progressMetrics || clientDetails.progressMetrics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color="#CBD5E1" />
          <ThemedText style={styles.emptyText}>No progress data yet</ThemedText>
        </View>
      );
    }

    // Group metrics by type
    const metricsByType = clientDetails.progressMetrics.reduce((acc, metric) => {
      if (!acc[metric.metric_type]) {
        acc[metric.metric_type] = [];
      }
      acc[metric.metric_type].push(metric);
      return acc;
    }, {} as Record<string, ClientProgressMetric[]>);

    return (
      <View>
        {Object.entries(metricsByType).map(([type, metrics]) => {
          const data = {
            labels: metrics.slice(-6).map((m, i) => `S${i + 1}`),
            datasets: [
              {
                data: metrics.slice(-6).map(m => m.score)
              }
            ]
          };

          return (
            <View key={type} style={styles.chartContainer}>
              <ThemedText style={styles.chartTitle}>
                {formatMetricType(type)}
              </ThemedText>
              <LineChart
                data={data}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#007AFF'
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          );
        })}
      </View>
    );
  };

  const renderRaceInsights = () => {
    const hasAnalysis = Boolean(clientDetails?.recentRaceAnalysis?.length);
    const hasStrategies = Boolean(clientDetails?.recentRaceStrategies?.length);

    if (!hasAnalysis && !hasStrategies) {
      return null;
    }

    return (
      <View>
        {hasAnalysis && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Recent Race Analysis</ThemedText>
            {clientDetails?.recentRaceAnalysis?.map((analysis) => (
              <View key={analysis.id} style={styles.analysisCard}>
                <View style={styles.analysisHeader}>
                  <ThemedText style={styles.analysisTitle}>
                    {analysis.race_name || 'Race Summary'}
                  </ThemedText>
                  <ThemedText style={styles.analysisDate}>
                    {format(new Date(analysis.created_at), 'MMM d, yyyy')}
                  </ThemedText>
                </View>
                {analysis.regatta_name && (
                  <ThemedText style={styles.analysisMeta}>{analysis.regatta_name}</ThemedText>
                )}
                {analysis.overall_satisfaction && (
                  <View style={styles.analysisRow}>
                    <Ionicons name="star" size={16} color="#F59E0B" />
                    <ThemedText style={styles.analysisText}>
                      Satisfaction: {'⭐'.repeat(analysis.overall_satisfaction)}
                    </ThemedText>
                  </View>
                )}
                {analysis.key_learnings && analysis.key_learnings.length > 0 && (
                  <View style={styles.analysisList}>
                    {analysis.key_learnings.slice(0, 3).map((learning, idx) => (
                      <ThemedText key={idx} style={styles.analysisBullet}>
                        • {learning}
                      </ThemedText>
                    ))}
                  </View>
                )}
                {analysis.ai_coaching_feedback && analysis.ai_coaching_feedback.length > 0 && (
                  <View style={styles.analysisCoachBlock}>
                    <ThemedText style={styles.analysisCoachTitle}>Coaching Highlights</ThemedText>
                    {analysis.ai_coaching_feedback.slice(0, 2).map((feedback, idx) => (
                      <View key={idx} style={styles.analysisFeedback}>
                        <ThemedText style={styles.analysisFeedbackPhase}>
                          {feedback.phase.toUpperCase()}
                        </ThemedText>
                        <ThemedText style={styles.analysisFeedbackSummary}>
                          {feedback.playbook_recommendation}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {hasStrategies && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Pre-Race Strategy Plans</ThemedText>
            {clientDetails?.recentRaceStrategies?.map((strategy) => (
              <View
                key={`${strategy.regatta_id}-${strategy.generated_at}`}
                style={styles.strategyCard}
              >
                <View style={styles.analysisHeader}>
                  <ThemedText style={styles.analysisTitle}>
                    {strategy.regatta_name || 'Race Strategy'}
                  </ThemedText>
                  {strategy.generated_at && (
                    <ThemedText style={styles.analysisDate}>
                      {format(new Date(strategy.generated_at), 'MMM d, yyyy')}
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={styles.strategyMeta}>
                  Favored Start: {strategy.favored_end ? strategy.favored_end.toUpperCase() : 'Unknown'}
                </ThemedText>
                {strategy.wind_strategy && (
                  <ThemedText style={styles.strategySummary}>{strategy.wind_strategy}</ThemedText>
                )}
                {strategy.confidence_score !== null && strategy.confidence_score !== undefined && (
                  <ThemedText style={styles.strategyConfidence}>
                    Confidence: {strategy.confidence_score}%
                  </ThemedText>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderNotes = () => {
    return (
      <View style={styles.notesContainer}>
        <View style={styles.notesHeader}>
          <ThemedText style={styles.notesTitle}>Private Coach Notes</ThemedText>
          {!editingNotes ? (
            <TouchableOpacity onPress={() => setEditingNotes(true)}>
              <Ionicons name="create-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.notesActions}>
              <TouchableOpacity onPress={() => setEditingNotes(false)} style={styles.notesButton}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNotes} style={styles.saveButton}>
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TextInput
          style={[styles.notesInput, !editingNotes && styles.notesInputReadonly]}
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={editingNotes}
          placeholder="Add private notes about this client..."
          placeholderTextColor="#94A3B8"
        />
      </View>
    );
  };

  if (isCreateRoute) {
    return null;
  }

  if (!clientId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <ThemedText style={styles.errorText}>Invalid client id</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (personaLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading client details...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!coachId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <Ionicons name="school-outline" size={48} color="#94A3B8" />
          <ThemedText style={styles.missingTitle}>Connect Your Coach Workspace</ThemedText>
          <ThemedText style={styles.missingDescription}>
            Client management requires an active coach workspace. Finish onboarding or refresh your connection to continue.
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={refreshPersonaContext}>
            <ThemedText style={styles.retryButtonText}>Retry Connection</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={() => router.push('/(tabs)/dashboard')}
          >
            <ThemedText style={styles.secondaryLinkText}>Back to Dashboard</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (!clientDetails) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <ThemedText style={styles.errorText}>Client not found</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const client = clientDetails;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Client Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={28} color="#1E293B" />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Client Details</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        {/* Client Info Card */}
        <View style={styles.clientCard}>
          <View style={styles.clientHeader}>
            {client.sailor?.avatar_url ? (
              <Image
                source={{ uri: client.sailor.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#94A3B8" />
              </View>
            )}
            <View style={styles.clientInfo}>
              <ThemedText style={styles.clientName}>
                {client.sailor?.full_name || client.sailor?.email || 'Unknown Client'}
              </ThemedText>
              <ThemedText style={styles.clientMeta}>
                {client.primary_boat_class || 'No boat class'} • {client.skill_level || 'Unknown level'}
              </ThemedText>
              {client.goals && (
                <ThemedText style={styles.clientGoals} numberOfLines={2}>
                  🎯 {client.goals}
                </ThemedText>
              )}
            </View>
          </View>

          {/* Message button */}
          <TouchableOpacity
            style={styles.messageButton}
            onPress={async () => {
              if (!coachId || !client.sailor_id) return;
              try {
                const convoId = await messagingService.getOrCreateConversation(coachId, client.sailor_id);
                router.push(`/coach/conversation/${convoId}` as any);
              } catch (err) {
                showAlert('Error', 'Could not open conversation');
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#007AFF" />
            <ThemedText style={styles.messageButtonText}>Message</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>{client.stats.totalSessions}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Sessions</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>{client.stats.completedSessions}</ThemedText>
            <ThemedText style={styles.statLabel}>Completed</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>{client.stats.upcomingSessions}</ThemedText>
            <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
          </View>
          {client.stats.averageRating && (
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{client.stats.averageRating.toFixed(1)} ⭐</ThemedText>
              <ThemedText style={styles.statLabel}>Avg Rating</ThemedText>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'sessions' && styles.tabActive]}
            onPress={() => setSelectedTab('sessions')}
          >
            <ThemedText style={[styles.tabText, selectedTab === 'sessions' && styles.tabTextActive]}>
              Sessions
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'progress' && styles.tabActive]}
            onPress={() => setSelectedTab('progress')}
          >
            <ThemedText style={[styles.tabText, selectedTab === 'progress' && styles.tabTextActive]}>
              Progress
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'notes' && styles.tabActive]}
            onPress={() => setSelectedTab('notes')}
          >
            <ThemedText style={[styles.tabText, selectedTab === 'notes' && styles.tabTextActive]}>
              Notes
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {selectedTab === 'sessions' && (
            <View>
              {client.sessions.length > 0 ? (
                client.sessions.map(renderSessionCard)
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
                  <ThemedText style={styles.emptyText}>No sessions yet</ThemedText>
                </View>
              )}
            </View>
          )}

          {selectedTab === 'progress' && (
            <View>
              {renderProgressChart()}
              {renderRaceInsights()}
            </View>
          )}

          {selectedTab === 'notes' && renderNotes()}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </ThemedView>
  );
}

// Helper functions
function getSessionIcon(type: string): any {
  const icons: Record<string, any> = {
    on_water: 'boat',
    video_review: 'videocam',
    strategy: 'map',
    boat_setup: 'construct',
    fitness: 'fitness',
    mental_coaching: 'head'
  };
  return icons[type] || 'calendar';
}

function formatSessionType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatMetricType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getStatusStyle(status: string) {
  const styles: Record<string, any> = {
    completed: { backgroundColor: '#D1FAE5', color: '#065F46' },
    scheduled: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
    in_progress: { backgroundColor: '#FEF3C7', color: '#92400E' },
    cancelled: { backgroundColor: '#FEE2E2', color: '#991B1B' },
    no_show: { backgroundColor: '#F3F4F6', color: '#374151' }
  };
  return styles[status] || {};
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
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 16,
  },
  missingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  missingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  missingDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryLink: {
    marginTop: 16,
  },
  secondaryLinkText: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#64748B',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  backIcon: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clientInfo: {
    flex: 1,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  clientName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  clientMeta: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  clientGoals: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sessionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  sessionDate: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  sessionStatus: {
    marginLeft: 8,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'capitalize',
  },
  sessionGoals: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionMetaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  notesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  notesActions: {
    flexDirection: 'row',
    gap: 12,
  },
  notesButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#1E293B',
    textAlignVertical: 'top',
  },
  notesInputReadonly: {
    backgroundColor: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
  analysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 6px rgba(15, 23, 42, 0.06)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 12,
  },
  analysisDate: {
    fontSize: 12,
    color: '#64748B',
  },
  analysisMeta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 13,
    color: '#334155',
  },
  analysisList: {
    marginBottom: 8,
    gap: 4,
  },
  analysisBullet: {
    fontSize: 13,
    color: '#475569',
  },
  analysisCoachBlock: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    gap: 8,
  },
  analysisCoachTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  analysisFeedback: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  analysisFeedbackPhase: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  analysisFeedbackSummary: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  strategyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 6px rgba(15, 23, 42, 0.06)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  strategyMeta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  strategySummary: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  strategyConfidence: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
});
