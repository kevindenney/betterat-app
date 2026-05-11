/**
 * Club Operations HQ - Events Dashboard
 * Premium yacht club administration experience
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from 'date-fns';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import EventService, { ClubEvent, EventRegistrationStats } from '@/services/eventService';
import { useClubWorkspace } from '@/hooks/useClubWorkspace';
import { Toast, ToastTitle, ToastDescription, useToast } from '@/components/ui/toast';
import { useAuth } from '@/providers/AuthProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWideScreen = SCREEN_WIDTH > 768;

// =====================================================
// Types
// =====================================================

type Metric = {
  key: string;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type QuickAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
  disabled?: boolean;
  badge?: string;
};

// =====================================================
// Component
// =====================================================

export default function EventsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { clubProfile } = useClubWorkspace();
  const { userType, loading: authLoading } = useAuth();

  // /events is the club admin dashboard. Sailors/learners shouldn't see it —
  // bounce them to /races. We wait for auth to settle so we don't redirect
  // during the brief window before userType hydrates.
  useEffect(() => {
    if (authLoading) return;
    if (userType && userType !== 'club') {
      router.replace('/(tabs)/races' as any);
    }
  }, [authLoading, userType, router]);
  
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventStats, setEventStats] = useState<Record<string, EventRegistrationStats>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const effectiveClubProfile = clubProfile as
    | {
        name?: string | null;
        club_name?: string | null;
        organization_name?: string | null;
        member_count?: number | null;
        active_boats?: number | null;
      }
    | null;

  const clubDisplayName =
    effectiveClubProfile?.club_name ||
    effectiveClubProfile?.organization_name ||
    effectiveClubProfile?.name ||
    'Club Operations HQ';

  const clubInitials = clubDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'CL';

  // Toast helper function
  const showToast = useCallback((title: string, description: string, action: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: () => (
        <Toast action={action} variant="solid" className="mx-4 mt-2">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons 
              name={action === 'success' ? 'checkmark-circle' : action === 'error' ? 'alert-circle' : action === 'warning' ? 'warning' : 'information-circle'} 
              size={20} 
              color="#fff" 
            />
            <View style={{ flex: 1 }}>
              <ToastTitle>{title}</ToastTitle>
              <ToastDescription>{description}</ToastDescription>
            </View>
          </View>
        </Toast>
      ),
    });
  }, [toast]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await EventService.getUpcomingEvents(20);
      setEvents(data);

      const statsPromises = data.map(async (event) => {
        try {
          const stats = await EventService.getRegistrationStats(event.id);
          return { id: event.id, stats };
        } catch (error) {
          return { id: event.id, stats: null };
        }
      });

      const statsResults = await Promise.all(statsPromises);
      const statsMap: Record<string, EventRegistrationStats> = {};
      statsResults.forEach(({ id, stats }) => {
        if (stats) statsMap[id] = stats;
      });
      setEventStats(statsMap);
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
      setEventStats({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'registration_open':
        return { color: '#10B981', bg: '#D1FAE5', label: 'Registration Open', icon: 'checkmark-circle' };
      case 'registration_closed':
        return { color: '#F59E0B', bg: '#FEF3C7', label: 'Reg. Closed', icon: 'lock-closed' };
      case 'in_progress':
        return { color: '#3B82F6', bg: '#DBEAFE', label: 'In Progress', icon: 'play-circle' };
      case 'completed':
        return { color: '#6B7280', bg: '#F3F4F6', label: 'Completed', icon: 'checkmark-done' };
      case 'cancelled':
        return { color: '#EF4444', bg: '#FEE2E2', label: 'Cancelled', icon: 'close-circle' };
      case 'published':
        return { color: '#8B5CF6', bg: '#EDE9FE', label: 'Published', icon: 'globe' };
      default:
        return { color: '#9CA3AF', bg: '#F9FAFB', label: 'Draft', icon: 'create' };
    }
  };

  const getEventTypeConfig = (type: string) => {
    switch (type) {
      case 'regatta':
        return { icon: 'trophy', color: '#F59E0B', label: 'Regatta' };
      case 'race_series':
        return { icon: 'flag', color: '#3B82F6', label: 'Race Series' };
      case 'training':
        return { icon: 'school', color: '#10B981', label: 'Training' };
      case 'social':
        return { icon: 'wine', color: '#EC4899', label: 'Social' };
      case 'meeting':
        return { icon: 'people', color: '#6366F1', label: 'Meeting' };
      default:
        return { icon: 'calendar', color: '#6B7280', label: 'Event' };
    }
  };

  const formatEventDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'EEE, MMM d');
    }

    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  };

  const upcomingEvents = useMemo(
    () => {
      const now = new Date();
      return (
      events
        .filter((event) => new Date(event.start_date) >= now)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      );
    },
    [events]
  );

  const highlightEvent = upcomingEvents[0];

  // Calculate metrics
  const metrics = useMemo<Metric[]>(() => {
    const totalRegistrations = Object.values(eventStats).reduce((sum, s) => sum + (s?.approved_count ?? 0), 0);
    const pendingApprovals = Object.values(eventStats).reduce((sum, s) => sum + (s?.pending_count ?? 0), 0);
    const totalRevenue = Object.values(eventStats).reduce((sum, s) => sum + (s?.total_paid ?? 0), 0);
    const openRegistration = events.filter((e) => e.status === 'registration_open').length;

    return [
      {
        key: 'events',
        label: 'Active Events',
        value: `${upcomingEvents.length}`,
        subValue: `${openRegistration} accepting entries`,
        icon: 'calendar',
        color: '#3B82F6',
      },
      {
        key: 'entries',
        label: 'Total Entries',
        value: `${totalRegistrations}`,
        subValue: `${pendingApprovals} pending approval`,
        trend: pendingApprovals > 0 ? 'neutral' : undefined,
        trendValue: pendingApprovals > 0 ? 'Action needed' : undefined,
        icon: 'people',
        color: '#10B981',
      },
      {
        key: 'revenue',
        label: 'Revenue',
        value: `$${totalRevenue.toLocaleString()}`,
        subValue: 'This season',
        icon: 'trending-up',
        color: '#8B5CF6',
      },
    ];
  }, [eventStats, events, upcomingEvents.length]);

  const quickActions: QuickAction[] = [
    { key: 'regatta', icon: 'trophy', label: 'New Regatta', route: '/club/event/create?type=regatta', color: '#F59E0B' },
    { key: 'series', icon: 'flag', label: 'Race Series', route: '/club/event/create?type=race_series', color: '#3B82F6' },
    { key: 'training', icon: 'school', label: 'Training', route: '/club/event/create?type=training', color: '#10B981' },
    { key: 'social', icon: 'wine', label: 'Social Event', route: '/club/event/create?type=social', color: '#EC4899' },
  ];

  // Onboarding banner is hidden until we wire real club setup tracking.
  const onboardingProgress = 100;
  const onboardingSteps: { id: string; label: string; completed: boolean }[] = [];

  // Calendar logic
  const calendarDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Pad start to align with week
    const startDay = start.getDay();
    const paddedStart = Array(startDay).fill(null);
    
    return [...paddedStart, ...days];
  }, [selectedMonth]);

  const eventsOnDay = useCallback((day: Date | null) => {
    if (!day) return [];
    return events.filter(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      return day >= new Date(eventStart.setHours(0,0,0,0)) && 
             day <= new Date(eventEnd.setHours(23,59,59,999));
    });
  }, [events]);

  const renderOnboardingBanner = () => {
    if (!showOnboarding || onboardingProgress === 100) return null;

  return (
      <View style={styles.onboardingBanner}>
        <LinearGradient
          colors={['#0EA5E9', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.onboardingGradient}
        >
          <View style={styles.onboardingContent}>
            <View style={styles.onboardingHeader}>
              <View style={styles.onboardingTitleRow}>
                <Ionicons name="sparkles" size={20} color="#FFF" />
                <ThemedText style={styles.onboardingTitle}>Complete Your Setup</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setShowOnboarding(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${onboardingProgress}%` }]} />
              </View>
              <ThemedText style={styles.progressText}>{onboardingProgress}% complete</ThemedText>
            </View>

            <View style={styles.onboardingSteps}>
              {onboardingSteps.slice(0, 3).map((step) => (
                <View key={step.id} style={styles.onboardingStep}>
                  <View style={[styles.stepIcon, step.completed && styles.stepIconComplete]}>
                    <Ionicons 
                      name={step.completed ? 'checkmark' : 'ellipse-outline'} 
                      size={14} 
                      color={step.completed ? '#FFF' : 'rgba(255,255,255,0.5)'} 
                    />
                  </View>
                  <ThemedText style={[styles.stepLabel, step.completed && styles.stepLabelComplete]}>
                    {step.label}
                  </ThemedText>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.onboardingCta}>
              <ThemedText style={styles.onboardingCtaText}>Continue Setup</ThemedText>
              <Ionicons name="arrow-forward" size={16} color="#0EA5E9" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderHeroSection = () => (
    <View style={styles.heroSection}>
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.heroGradient}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroLeft}>
            <View style={styles.clubBadge}>
              <ThemedText style={styles.clubInitials}>{clubInitials}</ThemedText>
            </View>
            <View style={styles.heroText}>
              <ThemedText style={styles.heroTitle}>{clubDisplayName}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {highlightEvent
                  ? `Next up: ${highlightEvent.title} ${formatDistanceToNow(new Date(highlightEvent.start_date), { addSuffix: true })}`
                  : 'Manage events, entries, and race operations'}
            </ThemedText>
            </View>
          </View>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => router.push('/club/event/create')}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.heroButtonGradient}
            >
              <Ionicons name="add" size={20} color="#FFF" />
            <ThemedText style={styles.heroButtonText}>Create Event</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{effectiveClubProfile?.member_count ?? 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Members</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{effectiveClubProfile?.active_boats ?? 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Active Boats</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{upcomingEvents.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderMetrics = () => (
        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
        <TouchableOpacity key={metric.key} style={styles.metricCard} activeOpacity={0.7}>
          <View style={[styles.metricIconContainer, { backgroundColor: `${metric.color}15` }]}>
            <Ionicons name={metric.icon as any} size={20} color={metric.color} />
              </View>
          <View style={styles.metricContent}>
              <ThemedText style={styles.metricLabel}>{metric.label}</ThemedText>
              <ThemedText style={styles.metricValue}>{metric.value}</ThemedText>
            {metric.subValue && (
              <ThemedText style={styles.metricSubValue}>{metric.subValue}</ThemedText>
            )}
            </View>
          {metric.trend && (
            <View style={[styles.trendBadge, { backgroundColor: metric.trend === 'up' ? '#D1FAE5' : metric.trend === 'down' ? '#FEE2E2' : '#FEF3C7' }]}>
              <Ionicons 
                name={metric.trend === 'up' ? 'trending-up' : metric.trend === 'down' ? 'trending-down' : 'time'} 
                size={12} 
                color={metric.trend === 'up' ? '#10B981' : metric.trend === 'down' ? '#EF4444' : '#F59E0B'} 
              />
              <ThemedText style={[styles.trendText, { color: metric.trend === 'up' ? '#10B981' : metric.trend === 'down' ? '#EF4444' : '#F59E0B' }]}>
                {metric.trendValue}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
          ))}
        </View>
  );

  const renderQuickActions = () => (
    <View style={styles.section}>
          <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
        <TouchableOpacity style={styles.seeAllButton}>
          <ThemedText style={styles.seeAllText}>All templates</ThemedText>
          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
        </TouchableOpacity>
          </View>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
            style={styles.quickActionCard}
                onPress={() => router.push(action.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <ThemedText style={styles.quickActionLabel}>{action.label}</ThemedText>
            {action.badge && (
              <View style={styles.quickActionBadge}>
                <ThemedText style={styles.quickActionBadgeText}>{action.badge}</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);

  const handleEventPress = (event: ClubEvent) => {
    router.push(`/event/${event.id}`);
  };

  const closeEventPreview = () => setSelectedEvent(null);

  const renderEventCard = (event: ClubEvent) => {
    const stats = eventStats[event.id];
    const statusConfig = getStatusConfig(event.status);
    const typeConfig = getEventTypeConfig(event.event_type);
    const fillPercentage = event.max_participants 
      ? Math.min(((stats?.approved_count ?? 0) / event.max_participants) * 100, 100)
      : 0;

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => handleEventPress(event)}
        activeOpacity={0.7}
      >
        <View style={styles.eventCardHeader}>
          <View style={[styles.eventTypeBadge, { backgroundColor: `${typeConfig.color}15` }]}>
            <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
            <ThemedText style={[styles.eventTypeText, { color: typeConfig.color }]}>
              {typeConfig.label}
                </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
        
        <View style={styles.eventDateRow}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <ThemedText style={styles.eventDate}>
            {formatEventDateRange(event.start_date, event.end_date)}
          </ThemedText>
        </View>

        <View style={styles.eventStats}>
          <View style={styles.eventStatItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <ThemedText style={styles.eventStatValue}>
              {stats?.approved_count ?? 0}
              {event.max_participants ? ` / ${event.max_participants}` : ''}
            </ThemedText>
          </View>
          {event.registration_fee && (
            <View style={styles.eventStatItem}>
              <Ionicons name="pricetag-outline" size={16} color="#6B7280" />
              <ThemedText style={styles.eventStatValue}>
                ${event.registration_fee}
              </ThemedText>
            </View>
          )}
          {stats && stats.total_paid > 0 && (
            <View style={styles.eventStatItem}>
              <Ionicons name="cash-outline" size={16} color="#10B981" />
              <ThemedText style={[styles.eventStatValue, { color: '#10B981' }]}>
                ${stats.total_paid.toLocaleString()}
              </ThemedText>
            </View>
          )}
        </View>

        {event.max_participants && (
          <View style={styles.capacityBar}>
            <View style={[styles.capacityFill, { width: `${fillPercentage}%`, backgroundColor: fillPercentage >= 90 ? '#EF4444' : fillPercentage >= 70 ? '#F59E0B' : '#10B981' }]} />
          </View>
        )}

        {event.boat_classes && event.boat_classes.length > 0 && (
          <View style={styles.classesRow}>
            {event.boat_classes.slice(0, 3).map((cls, idx) => (
              <View key={idx} style={styles.classBadge}>
                <ThemedText style={styles.classText}>{cls}</ThemedText>
              </View>
            ))}
            {event.boat_classes.length > 3 && (
              <View style={styles.classBadge}>
                <ThemedText style={styles.classText}>+{event.boat_classes.length - 3}</ThemedText>
          </View>
            )}
        </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderUpcomingEvents = () => (
    <View style={styles.section}>
          <View style={styles.sectionHeader}>
        <View>
          <ThemedText style={styles.sectionTitle}>Upcoming Events</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>{upcomingEvents.length} events scheduled</ThemedText>
        </View>
        <TouchableOpacity onPress={loadEvents} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <ThemedText style={styles.loadingText}>Loading events...</ThemedText>
            </View>
          ) : upcomingEvents.length === 0 ? (
        <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
              </View>
          <ThemedText style={styles.emptyTitle}>No upcoming events</ThemedText>
          <ThemedText style={styles.emptyText}>
            Create your first event to start managing registrations
              </ThemedText>
              <TouchableOpacity
            style={styles.emptyButton}
                onPress={() => router.push('/club/event/create')}
              >
            <ThemedText style={styles.emptyButtonText}>Create Event</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
        <View style={styles.eventsGrid}>
          {upcomingEvents.slice(0, 6).map(renderEventCard)}
        </View>
      )}

      {upcomingEvents.length > 6 && (
        <TouchableOpacity style={styles.viewAllButton}>
          <ThemedText style={styles.viewAllText}>View all {upcomingEvents.length} events</ThemedText>
          <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
        </TouchableOpacity>
      )}
                      </View>
  );

  const renderActivityFeed = () => (
    <View style={styles.activitySection}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
        <TouchableOpacity onPress={() => showToast('Activity Log', 'Full activity history and notifications would be available here.', 'info')}>
          <ThemedText style={styles.seeAllText}>View all</ThemedText>
        </TouchableOpacity>
                    </View>
      <View style={styles.activityList}>
        <View style={styles.activityItem}>
          <View style={[styles.activityIcon, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
          </View>
          <View style={styles.activityContent}>
            <ThemedText style={styles.activityMessage}>No recent activity yet</ThemedText>
            <ThemedText style={styles.activityTime}>Registrations and payments will appear here</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTeamSection = () => (
    <View style={styles.teamSection}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Race Team</ThemedText>
        <TouchableOpacity style={styles.addTeamButton} onPress={() => showToast('Invite Team Member', 'Invite race officers, scorers, and safety coordinators to collaborate on your events.', 'info')}>
          <Ionicons name="person-add-outline" size={16} color="#3B82F6" />
          <ThemedText style={styles.addTeamText}>Invite</ThemedText>
        </TouchableOpacity>
      </View>
      <View style={styles.teamGrid}>
        <View style={styles.teamMember}>
          <View style={[styles.memberAvatar, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="people-outline" size={20} color="#9CA3AF" />
          </View>
          <View style={styles.memberInfo}>
            <ThemedText style={styles.memberName}>No team members yet</ThemedText>
            <ThemedText style={styles.memberRole}>Invite race officers and scorers</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFinancialSummary = () => {
    const totalCollected = Object.values(eventStats).reduce((sum, s) => sum + (s?.total_paid ?? 0), 0);
    return (
    <View style={styles.financialSection}>
            <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Financial Summary</ThemedText>
        <TouchableOpacity onPress={() => router.push('/club/earnings')}>
          <ThemedText style={styles.seeAllText}>Details</ThemedText>
        </TouchableOpacity>
            </View>
      <View style={styles.financialCards}>
        <View style={styles.financialCard}>
          <ThemedText style={styles.financialLabel}>Collected to date</ThemedText>
          <ThemedText style={styles.financialValue}>
            ${totalCollected.toLocaleString()}
                  </ThemedText>
          <View style={styles.financialMeta}>
            <ThemedText style={styles.financialPending}>
              Across {events.length} event{events.length === 1 ? '' : 's'}
            </ThemedText>
          </View>
        </View>
        <View style={styles.financialCard}>
          <ThemedText style={styles.financialLabel}>Payouts</ThemedText>
          <ThemedText style={styles.financialValue}>—</ThemedText>
          <View style={styles.financialMeta}>
            <ThemedText style={styles.financialPending}>
              Connect Stripe to track payouts
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
    );
  };

  const renderCalendar = () => {
    const monthName = format(selectedMonth, 'MMMM yyyy');
    
    return (
      <View style={styles.calendarSection}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setSelectedMonth(prev => addDays(startOfMonth(prev), -1))}>
            <Ionicons name="chevron-back" size={20} color="#6B7280" />
          </TouchableOpacity>
          <ThemedText style={styles.calendarMonth}>{monthName}</ThemedText>
          <TouchableOpacity onPress={() => setSelectedMonth(prev => addDays(endOfMonth(prev), 1))}>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.calendarWeekdays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <ThemedText key={idx} style={styles.calendarWeekday}>{day}</ThemedText>
                ))}
              </View>

              <View style={styles.calendarGrid}>
          {calendarDays.map((day, idx) => {
            if (!day) return <View key={`empty-${idx}`} style={styles.calendarDay} />;
            
            const dayEvents = eventsOnDay(day);
            const hasEvents = dayEvents.length > 0;
            const isCurrentDay = isToday(day);
            
                  return (
              <TouchableOpacity 
                key={day.toISOString()} 
                style={[
                  styles.calendarDay,
                  isCurrentDay && styles.calendarDayToday,
                  hasEvents && styles.calendarDayWithEvents,
                  selectedCalendarDate && isSameDay(day, selectedCalendarDate) && styles.calendarDaySelected,
                ]}
                onPress={() => {
                  if (hasEvents) {
                    setSelectedCalendarDate(day);
                    // Show toast with event count
                    const eventList = dayEvents.map(e => e.title).join(', ');
                    showToast(
                      `${format(day, 'MMM d')} - ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`,
                      eventList.length > 80 ? eventList.substring(0, 80) + '...' : eventList,
                      'info'
                    );
                  } else {
                    setSelectedCalendarDate(day);
                    showToast(format(day, 'EEEE, MMMM d'), 'No events scheduled', 'info');
                  }
                }}
                activeOpacity={0.7}
              >
                <ThemedText style={[
                  styles.calendarDayText,
                  isCurrentDay && styles.calendarDayTextToday,
                  !isSameMonth(day, selectedMonth) && styles.calendarDayTextMuted,
                  selectedCalendarDate && isSameDay(day, selectedCalendarDate) && styles.calendarDayTextSelected,
                ]}>
                  {format(day, 'd')}
                      </ThemedText>
                {hasEvents && (
                  <View style={styles.calendarEventDots}>
                    {dayEvents.slice(0, 3).map((evt, i) => (
                      <View 
                        key={i} 
                        style={[styles.calendarEventDot, { backgroundColor: getStatusConfig(evt.status).color }]} 
                      />
                    ))}
                    </View>
                )}
              </TouchableOpacity>
                  );
                })}
              </View>

        <TouchableOpacity style={styles.calendarFullLink} onPress={() => router.push('/calendar')}>
          <ThemedText style={styles.calendarFullLinkText}>Open full calendar</ThemedText>
          <Ionicons name="open-outline" size={14} color="#3B82F6" />
              </TouchableOpacity>
            </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderOnboardingBanner()}
        {renderHeroSection()}
        {renderMetrics()}
        {renderQuickActions()}
        
        <View style={styles.mainContent}>
          <View style={styles.leftColumn}>
            {renderUpcomingEvents()}
          </View>

          {isWideScreen && (
            <View style={styles.rightColumn}>
              {renderCalendar()}
              {renderActivityFeed()}
              {renderTeamSection()}
              {renderFinancialSummary()}
        </View>
          )}
        </View>

        {!isWideScreen && (
          <>
            {renderCalendar()}
            {renderActivityFeed()}
            {renderTeamSection()}
            {renderFinancialSummary()}
          </>
        )}
      </ScrollView>

      {/* Event Preview Modal */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEventPreview}
      >
        <Pressable style={styles.modalOverlay} onPress={closeEventPreview}>
          <View style={styles.modalContent}>
            {selectedEvent && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalTypeBadge, { backgroundColor: `${getEventTypeConfig(selectedEvent.event_type).color}15` }]}>
                    <Ionicons 
                      name={getEventTypeConfig(selectedEvent.event_type).icon as any} 
                      size={16} 
                      color={getEventTypeConfig(selectedEvent.event_type).color} 
                    />
                    <ThemedText style={[styles.modalTypeText, { color: getEventTypeConfig(selectedEvent.event_type).color }]}>
                      {getEventTypeConfig(selectedEvent.event_type).label}
              </ThemedText>
            </View>
                  <TouchableOpacity onPress={closeEventPreview}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ThemedText style={styles.modalTitle}>{selectedEvent.title}</ThemedText>
                <ThemedText style={styles.modalDescription}>
                  {selectedEvent.description || 'No description available'}
                </ThemedText>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                    <ThemedText style={styles.modalDetailText}>
                      {formatEventDateRange(selectedEvent.start_date, selectedEvent.end_date)}
                    </ThemedText>
              </View>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="people-outline" size={18} color="#6B7280" />
                    <ThemedText style={styles.modalDetailText}>
                      {eventStats[selectedEvent.id]?.approved_count ?? 0} registered
                      {selectedEvent.max_participants ? ` of ${selectedEvent.max_participants}` : ''}
                    </ThemedText>
                  </View>
                  {selectedEvent.registration_fee && (
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="pricetag-outline" size={18} color="#6B7280" />
                      <ThemedText style={styles.modalDetailText}>
                        ${selectedEvent.registration_fee} entry fee
                      </ThemedText>
                    </View>
                  )}
                  {eventStats[selectedEvent.id]?.total_paid > 0 && (
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="cash-outline" size={18} color="#10B981" />
                      <ThemedText style={[styles.modalDetailText, { color: '#10B981' }]}>
                        ${eventStats[selectedEvent.id]?.total_paid.toLocaleString()} collected
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.modalDemoBanner}>
                  <Ionicons name="information-circle" size={18} color="#3B82F6" />
                  <ThemedText style={styles.modalDemoText}>
                    This is demo data. In production, you'd see full event management tools here.
                  </ThemedText>
                </View>

                <View style={styles.modalActions}>
            <TouchableOpacity
                    style={styles.modalActionButton}
                    onPress={() => {
                      closeEventPreview();
                      router.push(`/club/event/${selectedEvent.id}/entries` as any);
                    }}
                  >
                    <Ionicons name="list-outline" size={18} color="#3B82F6" />
                    <ThemedText style={styles.modalActionText}>Manage Entries</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalActionButton, styles.modalActionPrimary]}
                    onPress={() => {
                      closeEventPreview();
                      router.push(`/club/event/${selectedEvent.id}` as any);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFF" />
                    <ThemedText style={styles.modalActionTextPrimary}>Edit Event</ThemedText>
            </TouchableOpacity>
          </View>
              </>
            )}
        </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Onboarding Banner
  onboardingBanner: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  onboardingGradient: {
    padding: 20,
  },
  onboardingContent: {},
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  onboardingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onboardingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  onboardingSteps: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  onboardingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconComplete: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  stepLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  stepLabelComplete: {
    color: '#FFF',
    fontWeight: '500',
  },
  onboardingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  onboardingCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },

  // Hero Section
  heroSection: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: 24,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  clubBadge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  heroButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricContent: {},
  metricLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  metricSubValue: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Sections
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  quickActionBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },

  // Main Content Layout
  mainContent: {
    flexDirection: isWideScreen ? 'row' : 'column',
    gap: 16,
    paddingHorizontal: 16,
  },
  leftColumn: {
    flex: isWideScreen ? 2 : 1,
  },
  rightColumn: {
    flex: 1,
    gap: 16,
  },

  // Events Grid
  eventsGrid: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  eventDate: {
    fontSize: 13,
    color: '#64748B',
  },
  eventStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  eventStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventStatValue: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  capacityBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 2,
  },
  classesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  classBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  classText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  // Loading & Empty States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Activity Feed
  activitySection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Team Section
  teamSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addTeamText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  teamGrid: {
    gap: 12,
  },
  teamMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarPending: {
    backgroundColor: '#94A3B8',
  },
  memberInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberRole: {
    fontSize: 12,
    color: '#64748B',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },

  // Financial Section
  financialSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  financialCards: {
    gap: 12,
  },
  financialCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  financialLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  financialMeta: {
    marginTop: 8,
  },
  financialPending: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  financialTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  financialTrendText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },

  // Calendar
  calendarSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: isWideScreen ? 0 : 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  calendarDayToday: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  calendarDayWithEvents: {},
  calendarDayText: {
    fontSize: 14,
    color: '#1F2937',
  },
  calendarDayTextToday: {
    color: '#FFF',
    fontWeight: '600',
  },
  calendarDayTextMuted: {
    color: '#CBD5E1',
  },
  calendarDaySelected: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
  },
  calendarDayTextSelected: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  calendarEventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  calendarEventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calendarFullLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 12,
  },
  calendarFullLinkText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        transform: [{ translateY: 0 }],
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalTypeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalDetails: {
    gap: 12,
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalDetailText: {
    fontSize: 15,
    color: '#374151',
  },
  modalDemoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  modalDemoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  modalActionPrimary: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  modalActionTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
