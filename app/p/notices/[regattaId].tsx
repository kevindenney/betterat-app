/**
 * Public Notices Page
 * Accessible without authentication - shareable link for non-RegattaFlow users
 * 
 * URL: /p/notices/[regattaId]
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    Clock,
    ExternalLink,
    FileText,
    Share2,
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

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'urgent' | 'important' | 'normal';
  published_at: string;
  expires_at: string | null;
  attachments: {
    name: string;
    url: string;
    type: string;
  }[];
  author: string | null;
}

interface NoticesData {
  regatta: {
    id: string;
    name: string;
  };
  notices: Notice[];
  metadata: {
    total_count: number;
    has_more: boolean;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function PublicNoticesPage() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();
  const [data, setData] = useState<NoticesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  const fetchNotices = useCallback(async (isRefresh = false) => {
    if (!regattaId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}?include=notices`);
      
      if (!response.ok) {
        throw new Error('Failed to load notices');
      }
      
      const result = await response.json();
      setData({
        regatta: {
          id: result.regatta.id,
          name: result.regatta.name,
        },
        notices: result.notices?.items ?? [],
        metadata: result.notices?.metadata ?? {
          total_count: 0,
          has_more: false,
        },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [regattaId]);

  useEffect(() => {
    void fetchNotices();
  }, [fetchNotices]);

  const handleShare = async () => {
    const url = `${API_BASE}/p/notices/${regattaId}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: `${data?.regatta.name} - Notices`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await Share.share({
        message: `Check out notices for ${data?.regatta.name}: ${url}`,
        url,
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return {
          bg: '#FEE2E2',
          border: '#EF4444',
          text: '#991B1B',
          badge: '#EF4444',
          badgeText: '#FFFFFF',
        };
      case 'important':
        return {
          bg: '#FEF3C7',
          border: '#F59E0B',
          text: '#92400E',
          badge: '#F59E0B',
          badgeText: '#FFFFFF',
        };
      default:
        return {
          bg: '#FFFFFF',
          border: '#E5E7EB',
          text: '#374151',
          badge: '#6B7280',
          badgeText: '#FFFFFF',
        };
    }
  };

  const toggleNotice = (id: string) => {
    setExpandedNotice(expandedNotice === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading notices...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <Bell size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Notices Not Available</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotices()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(`/p/${regattaId}`)}>
          <Text style={styles.secondaryButtonText}>View Regatta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            Linking.openURL(
              `mailto:support@regattaflow.com?subject=${encodeURIComponent('Public Notices Unavailable')}&body=${encodeURIComponent(`Regatta: ${regattaId}\nError: ${error || 'Notices unavailable'}`)}`
            )
          }
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group notices by priority
  const urgentNotices = data.notices.filter((n) => n.priority === 'urgent');
  const importantNotices = data.notices.filter((n) => n.priority === 'important');
  const normalNotices = data.notices.filter((n) => n.priority === 'normal');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.regattaName}>{data.regatta.name}</Text>
          <Text style={styles.subtitle}>Official Notices</Text>
        </View>
        
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share2 size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotices(true)}
            colors={['#0EA5E9']}
          />
        }
      >
        {data.notices.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Notices Yet</Text>
            <Text style={styles.emptyText}>
              Official race committee notices will appear here when posted.
            </Text>
          </View>
        ) : (
          <>
            {/* Urgent Notices */}
            {urgentNotices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={18} color="#EF4444" />
                  <Text style={styles.sectionTitle}>Urgent</Text>
                </View>
                {urgentNotices.map((notice) => renderNotice(notice))}
              </View>
            )}

            {/* Important Notices */}
            {importantNotices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Bell size={18} color="#F59E0B" />
                  <Text style={styles.sectionTitle}>Important</Text>
                </View>
                {importantNotices.map((notice) => renderNotice(notice))}
              </View>
            )}

            {/* Regular Notices */}
            {normalNotices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <FileText size={18} color="#6B7280" />
                  <Text style={styles.sectionTitle}>General Notices</Text>
                </View>
                {normalNotices.map((notice) => renderNotice(notice))}
              </View>
            )}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Pull down to refresh</Text>
          <Text style={styles.footerBrand}>Powered by RegattaFlow</Text>
        </View>
      </ScrollView>
    </View>
  );

  function renderNotice(notice: Notice) {
    const style = getPriorityStyle(notice.priority);
    const isExpanded = expandedNotice === notice.id;

    return (
      <TouchableOpacity
        key={notice.id}
        style={[styles.noticeCard, { backgroundColor: style.bg, borderColor: style.border }]}
        onPress={() => toggleNotice(notice.id)}
        activeOpacity={0.7}
      >
        <View style={styles.noticeHeader}>
          <View style={styles.noticeTitle}>
            {notice.priority !== 'normal' && (
              <View style={[styles.priorityBadge, { backgroundColor: style.badge }]}>
                <Text style={[styles.priorityText, { color: style.badgeText }]}>
                  {notice.priority.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.noticeTitleText, { color: style.text }]} numberOfLines={isExpanded ? undefined : 2}>
              {notice.title}
            </Text>
          </View>
          <View style={styles.noticeMeta}>
            <Clock size={12} color="#9CA3AF" />
            <Text style={styles.noticeTime}>{formatTime(notice.published_at)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.noticeBody}>
            <Text style={styles.noticeContent}>{notice.content}</Text>
            
            {notice.author && (
              <Text style={styles.noticeAuthor}>— {notice.author}</Text>
            )}
            
            <Text style={styles.noticeFullDate}>{formatFullDate(notice.published_at)}</Text>

            {notice.attachments.length > 0 && (
              <View style={styles.attachments}>
                <Text style={styles.attachmentsTitle}>Attachments</Text>
                {notice.attachments.map((attachment, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.attachmentRow}
                    onPress={() => Linking.openURL(attachment.url)}
                  >
                    <FileText size={16} color="#6B7280" />
                    <Text style={styles.attachmentName}>{attachment.name}</Text>
                    <ExternalLink size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }
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
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  noticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  noticeHeader: {
    padding: 16,
  },
  noticeTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noticeTitleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  noticeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  noticeTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noticeBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  noticeContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  noticeAuthor: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 12,
  },
  noticeFullDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  attachments: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  attachmentsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
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
