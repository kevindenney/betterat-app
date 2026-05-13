import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type QueueRow = {
  id: string;
  artifact_id: string;
  requester_user_id: string;
  status: 'requested' | 'in_review' | 'completed' | 'cancelled';
  created_at: string;
  artifact: {
    module_id: string;
  } | null;
};

export default function ArtifactQueueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesterNameById, setRequesterNameById] = useState<Record<string,string>>({});
  const [errorText, setErrorText] = useState<string | null>(null);
  const signedOut = !user?.id;

  const loadQueue = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setErrorText(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorText(null);
      const { data, error } = await supabase
        .from('betterat_artifact_review_requests')
        .select(`
          id,
          artifact_id,
          requester_user_id,
          status,
          created_at,
          artifact:betterat_module_artifacts(module_id)
        `)
        .eq('coach_user_id', user.id)
        .in('status', ['requested', 'in_review'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as QueueRow[];
      setItems(rows);

      const requesterIds = [...new Set(rows.map((row) => row.requester_user_id))];
      if (requesterIds.length === 0) {
        setRequesterNameById({});
      } else {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id,full_name,email')
          .in('id', requesterIds);
        if (!usersError) {
          const nameMap: Record<string,string> = {};
          for (const row of (usersData || []) as {id: string; full_name?: string | null; email?: string | null}[]) {
            nameMap[row.id] = row.full_name || row.email || row.id;
          }
          setRequesterNameById(nameMap);
        } else {
          setRequesterNameById({});
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load review queue.';
      setErrorText(message);
      setItems([]);
      setRequesterNameById({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadQueue();
  }, [loadQueue]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Coach Review Queue</Text>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {signedOut ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sign in to view assigned artifact reviews.</Text>
          </View>
        ) : errorText ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reviews requested yet.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {items.filter((row) => row.status === 'requested').length} requested
              </Text>
              <Text style={styles.summaryText}>
                {items.filter((row) => row.status === 'in_review').length} in review
              </Text>
            </View>
            {items.map((item) => {
            const requesterLabel = requesterNameById[item.requester_user_id] || item.requester_user_id;
            const moduleId = item.artifact?.module_id || 'unknown_module';
            const createdLabel = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
            const isInReview = item.status === 'in_review';
            const statusLabel = isInReview ? 'In review' : 'Requested';
            const buttonLabel = isInReview ? 'Continue' : 'Review';

            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.requester}>{requesterLabel}</Text>
                <Text style={styles.meta}>Module: {moduleId}</Text>
                <Text style={styles.meta}>Requested {createdLabel}</Text>
                <View style={[styles.statusPill, isInReview ? styles.statusPillInReview : styles.statusPillRequested]}>
                  <Text style={[styles.statusPillText, isInReview ? styles.statusPillTextInReview : styles.statusPillTextRequested]}>
                    {statusLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.reviewButton}
                  onPress={() => router.push(`/coach/artifact-review/${item.artifact_id}` as any)}
                >
                  <Text style={styles.reviewButtonText}>{buttonLabel}</Text>
                </TouchableOpacity>
              </View>
            );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F6',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
  },
  errorState: {
    marginTop: 18,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#B42318',
  },
  summaryRow: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 8,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#344054',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  requester: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  reviewButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#0A66C2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  statusPillRequested: {
    backgroundColor: '#EFF8FF',
    borderWidth: 1,
    borderColor: '#B2DDFF',
  },
  statusPillInReview: {
    backgroundColor: '#F9F5FF',
    borderWidth: 1,
    borderColor: '#D9D6FE',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPillTextRequested: {
    color: '#175CD3',
  },
  statusPillTextInReview: {
    color: '#5925DC',
  },
});
