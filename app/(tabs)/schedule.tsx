import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, isSameDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCoachWorkspace } from '@/hooks/useCoachWorkspace';
import {
  useCoachingSessions,
  useBookingRequests,
  type CoachingSession as LiveCoachingSession,
  type BookingRequest,
} from '@/hooks/useCoachingSessions';
import { coachingService } from '@/services/CoachingService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

type ScheduleWindow = 'today' | 'week' | 'month' | 'all';

type AvailabilitySlot = {
  id: string;
  coach_id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string | null;
  recurring_pattern?: string | null;
};

type DashboardSession = LiveCoachingSession & {
  focus_areas?: string[];
  location_notes?: string | null;
};

const WINDOW_OPTIONS: { id: ScheduleWindow; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'month', label: 'Next 30 days' },
  { id: 'all', label: 'All' },
];

const SESSION_TYPE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }
> = {
  on_water: { icon: 'boat-outline', color: '#0EA5E9', label: 'On-water' },
  video_review: { icon: 'videocam-outline', color: '#A855F7', label: 'Video' },
  strategy: { icon: 'analytics-outline', color: '#F97316', label: 'Strategy' },
  boat_setup: { icon: 'cog-outline', color: '#22C55E', label: 'Boat setup' },
  fitness: { icon: 'barbell-outline', color: '#EC4899', label: 'Fitness' },
  mental_coaching: { icon: 'sparkles-outline', color: '#FACC15', label: 'Mindset' },
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#10B981',
  scheduled: '#3B82F6',
  pending: '#F59E0B',
  in_progress: '#6366F1',
  needs_prep: '#F97316',
  cancelled: '#EF4444',
};

const SESSION_STATUSES = new Set(['confirmed', 'scheduled', 'pending', 'in_progress']);

function getSessionStart(session: LiveCoachingSession) {
  if (session.scheduled_at) return new Date(session.scheduled_at);
  if (session.start_time) return new Date(session.start_time);
  if (session.session_date) {
    return new Date(`${session.session_date}T${session.session_time || '08:00:00'}`);
  }
  return null;
}

function formatTimeRange(start?: Date | null, durationMinutes?: number, endTime?: string | null) {
  if (!start) return 'TBD';
  const startLabel = format(start, 'h:mm a');
  if (durationMinutes) {
    const computedEnd = new Date(start.getTime() + durationMinutes * 60000);
    return `${startLabel} • ${format(computedEnd, 'h:mm a')}`;
  }
  if (endTime) {
    const parsedEnd = new Date(endTime);
    return `${startLabel} • ${format(parsedEnd, 'h:mm a')}`;
  }
  return startLabel;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const {
    coachId,
    loading: personaLoading,
    refresh: refreshPersonaContext,
  } = useCoachWorkspace();
  const [selectedWindow, setSelectedWindow] = useState<ScheduleWindow>('week');
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    sessions,
    loading: sessionsLoading,
    refresh: refreshSessions,
  } = useCoachingSessions(coachId || undefined);
  const {
    requests,
    loading: requestsLoading,
    unreadCount,
    acceptRequest,
    declineRequest,
    refresh: refreshRequests,
  } = useBookingRequests(coachId || undefined);

  const loadAvailability = useCallback(async () => {
    if (!coachId) return;
    try {
      setAvailabilityLoading(true);
      const now = new Date();
      const endDate = addDays(now, 14);
      const slots = await coachingService.getAvailabilitySlots(coachId, now, endDate, true);
      setAvailabilitySlots(
        (slots || []).sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      );
    } catch (error) {
      console.error('Error loading availability slots:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId) {
      loadAvailability();
    }
  }, [coachId, loadAvailability]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshSessions(), refreshRequests(), loadAvailability()]);
    } catch (error) {
      console.error('Error refreshing schedule data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSessions, refreshRequests, loadAvailability]);

  const handleAddAvailability = () => {
    router.push('/coach/availability');
  };

  const handleManageAvailability = () => {
    router.push('/coach/availability');
  };

  const handlePlanSession = () => {
    router.push('/(tabs)/coaching');
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
      showAlert('Request accepted', 'The sailor will be notified and can confirm payment.');
    } catch (error: any) {
      showAlert('Unable to accept request', error?.message || 'Try again shortly.');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineRequest(requestId);
      showAlert('Request updated', 'The sailor will see that this slot is unavailable.');
    } catch (error: any) {
      showAlert('Unable to update request', error?.message || 'Try again shortly.');
    }
  };

  const handleCompleteSession = (session: LiveCoachingSession) => {
    router.push({
      pathname: '/coach/complete-session',
      params: {
        sessionId: session.id,
        sailorName: session.sailor?.full_name || session.sailor?.email || 'Sailor',
        scheduledDuration: String(session.duration_minutes || 60),
      },
    });
  };

  const handleCancelSession = (session: LiveCoachingSession) => {
    router.push({
      pathname: '/coach/cancel-session',
      params: {
        sessionId: session.id,
        sailorName: session.sailor?.full_name || session.sailor?.email || 'Sailor',
      },
    });
  };

  // Determine if session can be completed (today or past, not already completed/cancelled)
  const canCompleteSession = (session: LiveCoachingSession) => {
    const start = getSessionStart(session);
    if (!start) return false;
    const now = new Date();
    // Can complete if session time has passed (or is today)
    const isPastOrToday = start <= addDays(now, 1);
    const validStatus = ['confirmed', 'scheduled', 'in_progress'].includes(session.status || '');
    return isPastOrToday && validStatus;
  };

  // Determine if session can be cancelled
  const canCancelSession = (session: LiveCoachingSession) => {
    const validStatus = ['confirmed', 'scheduled', 'pending'].includes(session.status || '');
    return validStatus;
  };

  const filteredSessions = useMemo<DashboardSession[]>(() => {
    const now = new Date();
    const windowEnd =
      selectedWindow === 'today'
        ? addDays(now, 1)
        : selectedWindow === 'week'
          ? addDays(now, 7)
          : selectedWindow === 'month'
            ? addDays(now, 30)
            : addDays(now, 120);

    return (sessions as DashboardSession[])
      .filter((session) => {
        const start = getSessionStart(session);
        if (!start) return false;
        if (start < addDays(now, -1)) return false;
        if (start > windowEnd) return false;
        if (session.status && !SESSION_STATUSES.has(session.status)) return false;
        return true;
      })
      .sort((a, b) => {
        const aStart = getSessionStart(a)?.getTime() || 0;
        const bStart = getSessionStart(b)?.getTime() || 0;
        return aStart - bStart;
      });
  }, [sessions, selectedWindow]);

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, LiveCoachingSession[]>();
    filteredSessions.forEach((session) => {
      const start = getSessionStart(session);
      if (!start) return;
      const key = format(start, 'yyyy-MM-dd');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(session);
    });

    return Array.from(groups.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([key, daySessions]) => {
        const dayDate = new Date(key);
        const label = isSameDay(dayDate, new Date()) ? 'Today' : format(dayDate, 'EEEE, MMM d');
        return {
          key,
          label,
          sessions: daySessions.sort(
            (a, b) => (getSessionStart(a)?.getTime() || 0) - (getSessionStart(b)?.getTime() || 0)
          ),
        };
      });
  }, [filteredSessions]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, LiveCoachingSession>();
    sessions.forEach((session) => {
      if (session.id) {
        map.set(session.id, session);
      }
    });
    return map;
  }, [sessions]);

  const pendingRequests = useMemo(() => {
    return (requests || [])
      .filter((request) => request.status === 'pending')
      .map((request) => {
        if (request.session || !request.session_id) {
          return request;
        }
        const matchingSession = sessionMap.get(request.session_id);
        return matchingSession ? { ...request, session: matchingSession } : request;
      });
  }, [requests, sessionMap]);

  const showInitialLoading =
    personaLoading || (sessionsLoading && sessions.length === 0) || (!coachId && personaLoading);

  if (showInitialLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading your schedule...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!coachId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <Ionicons name="time-outline" size={48} color="#94A3B8" />
          <ThemedText style={styles.missingTitle}>Connect Your Coach Workspace</ThemedText>
          <ThemedText style={styles.missingDescription}>
            Schedule tools unlock once coach onboarding is complete. Refresh your account or finish onboarding to continue.
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={refreshPersonaContext}>
            <ThemedText style={styles.retryButtonText}>Retry Connection</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Schedule</ThemedText>
            <ThemedText style={styles.subtitle}>
              Track upcoming sessions, open slots, and booking requests in one place.
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handlePlanSession}>
            <Ionicons name="add-circle" size={24} color="#EEF2FF" />
            <ThemedText style={styles.primaryButtonText}>Plan Session</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="calendar-outline"
            color="#007AFF"
            label="Upcoming"
            value={filteredSessions.length}
          />
          <StatCard
            icon="time-outline"
            color="#059669"
            label="Open Slots"
            value={availabilitySlots.length}
            loading={availabilityLoading}
          />
          <StatCard
            icon="mail-unread-outline"
            color="#F97316"
            label="Requests"
            value={pendingRequests.length}
            badgeValue={unreadCount}
            loading={requestsLoading}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={handleManageAvailability}
          >
            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
            <ThemedText style={styles.quickActionText}>Manage Availability</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/coach/pricing')}
          >
            <Ionicons name="pricetag-outline" size={18} color="#007AFF" />
            <ThemedText style={styles.quickActionText}>Manage Pricing</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.windowFilters}
        >
          {WINDOW_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.filterChip,
                selectedWindow === option.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedWindow(option.id)}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  selectedWindow === option.id && styles.filterChipTextActive,
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <SectionHeader title="Agenda" icon="calendar" />
          {groupedSessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No sessions in this window"
              description="Add availability or accept a booking request to fill your calendar."
              ctaLabel="Add Availability"
              onCtaPress={handleAddAvailability}
            />
          ) : (
            groupedSessions.map((group) => (
              <View key={group.key} style={styles.dayBlock}>
                <ThemedText style={styles.dayLabel}>{group.label.replace(/'/g, '')}</ThemedText>
                {group.sessions.map((session) => {
                  const start = getSessionStart(session);
                  const sessionMeta =
                    SESSION_TYPE_META[session.session_type || ''] ||
                    SESSION_TYPE_META.strategy;
                  const statusColor =
                    (session.status && STATUS_COLORS[session.status]) || '#CBD5E1';
                  return (
                    <View key={session.id} style={styles.sessionCard}>
                      <View style={styles.sessionHeaderRow}>
                        <View style={styles.sessionTypeBadge}>
                          <Ionicons
                            name={sessionMeta.icon}
                            size={16}
                            color={sessionMeta.color}
                          />
                          <ThemedText style={styles.sessionTypeText}>
                            {sessionMeta.label}
                          </ThemedText>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                          <ThemedText style={styles.statusBadgeText}>
                            {session.status ? session.status.replace(/_/g, ' ') : 'scheduled'}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.sessionTime}>
                        {start ? format(start, 'EEE, MMM d') : 'TBD'} ·{' '}
                        {formatTimeRange(start, session.duration_minutes, session.end_time)}
                      </ThemedText>
                      <ThemedText style={styles.sessionTitle}>
                        {session.sailor?.full_name ||
                          session.sailor?.email ||
                          (session.sailor_id ? session.sailor_id.slice(0, 8) : 'Unassigned sailor')}
                      </ThemedText>
                      {session.location_notes && (
                        <ThemedText style={styles.sessionMetaText}>
                          📍 {session.location_notes}
                        </ThemedText>
                      )}
                      {session.focus_areas && session.focus_areas.length > 0 && (
                        <View style={styles.pillRow}>
                          {session.focus_areas.slice(0, 3).map((tag) => (
                            <View key={tag} style={styles.focusPill}>
                              <ThemedText style={styles.focusPillText}>
                                {tag.replace('_', ' ')}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      )}
                      {/* Session Action Buttons */}
                      <View style={styles.sessionActions}>
                        {canCompleteSession(session) && (
                          <TouchableOpacity
                            style={styles.completeButton}
                            onPress={() => handleCompleteSession(session)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                            <ThemedText style={styles.completeButtonText}>Complete</ThemedText>
                          </TouchableOpacity>
                        )}
                        {canCancelSession(session) && (
                          <TouchableOpacity
                            style={styles.cancelSessionButton}
                            onPress={() => handleCancelSession(session)}
                          >
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                            <ThemedText style={styles.cancelSessionButtonText}>Cancel</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Booking Requests" icon="mail" />
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon="mail-outline"
              title="No pending requests"
              description="We’ll notify you as soon as a sailor requests time on your calendar."
            />
          ) : (
            pendingRequests.slice(0, 3).map((request) => (
              <BookingRequestCard
                key={request.id}
                request={request}
                onAccept={() => handleAcceptRequest(request.id)}
                onDecline={() => handleDeclineRequest(request.id)}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Open Availability" icon="time" />
          {availabilitySlots.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="No open slots"
              description="Add a few availability blocks so sailors can request time."
              ctaLabel="Add Availability"
              onCtaPress={handleAddAvailability}
            />
          ) : (
            availabilitySlots.slice(0, 4).map((slot) => (
              <View key={slot.id} style={styles.availabilityCard}>
                <View>
                  <ThemedText style={styles.availabilityDate}>
                    {format(new Date(slot.start_time), 'EEEE, MMM d')}
                  </ThemedText>
                  <ThemedText style={styles.availabilityTime}>
                    {formatTimeRange(new Date(slot.start_time), undefined, slot.end_time)}
                  </ThemedText>
                  {slot.notes && (
                    <ThemedText style={styles.availabilityNotes}>{slot.notes}</ThemedText>
                  )}
                </View>
                <View style={styles.availabilityBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <ThemedText style={styles.availabilityBadgeText}>Open</ThemedText>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Ionicons name={`${icon}-outline` as any} size={18} color="#64748B" />
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  badgeValue,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  badgeValue?: number;
  loading?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
        )}
        {!!badgeValue && badgeValue !== value && (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{badgeValue}</ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function BookingRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: BookingRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const requestDate = request.requested_start_time
    ? new Date(request.requested_start_time)
    : request.session?.scheduled_at
      ? new Date(request.session.scheduled_at)
      : null;
  const requestMessage = request.sailor_message || request.message;

  // Get expiration info
  const expiresAt = (request as any).expires_at;
  const expiration = coachingService.getBookingRequestExpiration(expiresAt);

  const getExpirationStyle = () => {
    if (expiration.urgencyLevel === 'critical') {
      return { backgroundColor: '#FEE2E2', color: '#DC2626' };
    } else if (expiration.urgencyLevel === 'warning') {
      return { backgroundColor: '#FEF3C7', color: '#D97706' };
    }
    return { backgroundColor: '#E0E7FF', color: '#4F46E5' };
  };

  const expirationStyle = getExpirationStyle();

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <ThemedText style={styles.requestTitle}>
          {request.session?.sailor?.full_name || request.sailor_id.slice(0, 8)}
        </ThemedText>
        {requestDate && (
          <ThemedText style={styles.requestDate}>{format(requestDate, 'MMM d · h:mm a')}</ThemedText>
        )}
      </View>

      {/* Expiration countdown */}
      {!expiration.isExpired && (
        <View style={[styles.expirationBadge, { backgroundColor: expirationStyle.backgroundColor }]}>
          <Ionicons
            name={expiration.urgencyLevel === 'critical' ? 'alarm-outline' : 'time-outline'}
            size={14}
            color={expirationStyle.color}
          />
          <ThemedText style={[styles.expirationText, { color: expirationStyle.color }]}>
            {expiration.displayText}
          </ThemedText>
        </View>
      )}

      {requestMessage && <ThemedText style={styles.requestMessage}>{requestMessage}</ThemedText>}
      <View style={styles.requestButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDecline}>
          <ThemedText style={styles.secondaryButtonText}>Decline</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmButton} onPress={onAccept}>
          <ThemedText style={styles.confirmButtonText}>Accept</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCtaPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={42} color="#CBD5E1" />
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText style={styles.emptyDescription}>{description}</ThemedText>
      {ctaLabel && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onCtaPress}>
          <ThemedText style={styles.secondaryButtonText}>{ctaLabel}</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  primaryButtonText: {
    color: '#EEF2FF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  badge: {
    backgroundColor: '#F87171',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  windowFilters: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  filterChipText: {
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayBlock: {
    marginBottom: 20,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sessionTime: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  sessionMetaText: {
    fontSize: 13,
    color: '#64748B',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  focusPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  focusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
    textTransform: 'capitalize',
  },
  availabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  availabilityDate: {
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  availabilityTime: {
    color: '#475569',
    fontSize: 13,
  },
  availabilityNotes: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  availabilityBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityBadgeText: {
    color: '#047857',
    fontWeight: '600',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  requestDate: {
    fontSize: 13,
    color: '#475569',
  },
  requestMessage: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyDescription: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
  },
  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  missingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  missingDescription: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5F1FF',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  // Session action buttons
  sessionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  cancelSessionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelSessionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Expiration badge
  expirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  expirationText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
