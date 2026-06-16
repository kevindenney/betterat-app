import { coachingService } from '@/services/CoachingService';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';

export default function MyBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [completedSessions, setCompletedSessions] = useState<any[]>([]);

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const statusFilter = filter === 'all' ? undefined : filter;
      const [results, sessions] = await Promise.all([
        coachingService.getSailorBookingRequests(statusFilter),
        coachingService.getSailorSessions()
      ]);
      setBookings(results);
      const completed = sessions.filter((session: any) => session.status === 'completed');
      const upcoming = sessions.filter((session: any) =>
        session.status === 'scheduled' || session.status === 'confirmed' || session.status === 'pending'
      );
      setCompletedSessions(completed);
      setUpcomingSessions(upcoming);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleCancelBooking = async (bookingId: string) => {
    showConfirm(
      'Cancel Booking',
      'Are you sure you want to cancel this booking request?',
      async () => {
        try {
          await coachingService.cancelBookingRequest(bookingId, 'Cancelled by sailor');
          loadBookings();
        } catch (error) {
          console.error('Error cancelling booking:', error);
          showAlert('Error', 'Failed to cancel booking');
        }
      },
      { destructive: true, cancelText: 'No', confirmText: 'Yes, Cancel' }
    );
  };

  const renderStatusBadge = (status: string) => {
    const statusColors: any = {
      pending: '#F59E0B',
      accepted: '#10B981',
      rejected: '#EF4444',
      cancelled: '#6B7280',
    };

    return (
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: statusColors[status] || '#6B7280' },
        ]}
      >
        <Text style={styles.statusText}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>Track your coaching session requests</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {['all', 'pending', 'accepted', 'rejected'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              filter === status && styles.filterTabActive,
            ]}
            onPress={() => setFilter(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === status && styles.filterTabTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      <ScrollView
        style={styles.bookingsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No bookings found</Text>
            <TouchableOpacity
              style={styles.findCoachButton}
              onPress={() => router.push('/coach/discover')}
            >
              <Text style={styles.findCoachText}>Find a Coach</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.coachName}>
                  {booking.coach?.display_name || 'Coach'}
                </Text>
                {renderStatusBadge(booking.status)}
              </View>

              <View style={styles.bookingDetails}>
                <Text style={styles.sessionType}>
                  {booking.session_type?.replace('_', ' ') || 'Session'}
                </Text>
                <Text style={styles.datetime}>
                  {new Date(booking.requested_start_time).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }
                  )}
                </Text>
                <Text style={styles.amount}>
                  ${(booking.total_amount_cents / 100).toFixed(2)}
                </Text>
              </View>

              {booking.sailor_message && (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageLabel}>Your message:</Text>
                  <Text style={styles.messageText}>
                    {booking.sailor_message}
                  </Text>
                </View>
              )}

              {booking.coach_response && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseLabel}>Coach response:</Text>
                  <Text style={styles.responseText}>
                    {booking.coach_response}
                  </Text>
                </View>
              )}

              {booking.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelBooking(booking.id)}
                >
                  <Text style={styles.cancelButtonText}>Cancel Request</Text>
                </TouchableOpacity>
              )}

              {booking.status === 'accepted' && booking.session_id && (
                <TouchableOpacity
                  style={styles.viewSessionButton}
                  onPress={() =>
                    router.push(`/coach/session/${booking.session_id}`)
                  }
                >
                  <Text style={styles.viewSessionText}>View Session</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {upcomingSessions.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
            {upcomingSessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionHeaderRow}>
                  <Text style={styles.sessionCoach}>{session.coach?.display_name || 'Coach'}</Text>
                  {session.scheduled_at && (
                    <Text style={styles.sessionDate}>
                      {format(new Date(session.scheduled_at), 'MMM d, h:mm a')}
                    </Text>
                  )}
                </View>
                <Text style={styles.sessionTypeLabel}>
                  {session.session_type?.replace('_', ' ') || 'Session'}
                </Text>
                {session.location_notes && (
                  <Text style={styles.sessionNotes}>{session.location_notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {completedSessions.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Coach Feedback</Text>
            {completedSessions.map((session) => (
              <View key={session.id} style={styles.feedbackCard}>
                <View style={styles.sessionHeaderRow}>
                  <Text style={styles.sessionCoach}>{session.coach?.display_name || 'Coach'}</Text>
                  {session.completed_at && (
                    <Text style={styles.sessionDate}>
                      {formatDistanceToNow(new Date(session.completed_at), { addSuffix: true })}
                    </Text>
                  )}
                </View>
                <Text style={styles.sessionTypeLabel}>
                  {session.session_type?.replace('_', ' ') || 'Session'}
                </Text>
                {session.session_notes && (
                  <View style={styles.feedbackBlock}>
                    <Text style={styles.feedbackLabel}>Coach Notes</Text>
                    <Text style={styles.feedbackText}>{session.session_notes}</Text>
                  </View>
                )}
                {session.homework && (
                  <View style={styles.feedbackBlock}>
                    <Text style={styles.feedbackLabel}>Homework</Text>
                    <Text style={styles.feedbackText}>{session.homework}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  bookingsList: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 20,
  },
  findCoachButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  findCoachText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  coachName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  sessionType: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  datetime: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  messageContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  responseContainer: {
    backgroundColor: '#E8F4FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#333',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionCoach: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sessionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  sessionTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  sessionNotes: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
  },
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feedbackBlock: {
    marginTop: 10,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  viewSessionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewSessionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
