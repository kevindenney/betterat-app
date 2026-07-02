/**
 * Public Regatta Landing Page
 * Accessible without authentication - shareable link for non-BetterAt users
 * 
 * URL: /p/[regattaId]
 */

import { Text } from '@/components/ui/text';
import { useLocalSearchParams } from 'expo-router';
import {
    Anchor,
    Bell,
    Calendar,
    ChevronRight,
    Clock,
    ExternalLink,
    FileText,
    MapPin,
    Share2,
    Trophy,
    Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Share,
} from 'react-native';

interface RegattaData {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    website: string | null;
  } | null;
  classes: string[];
  entry_fee: number | null;
  currency: string | null;
  registration_status: 'not_open' | 'open' | 'closed' | 'full';
  registration_deadline: string | null;
  entry_count: number;
  max_entries: number | null;
  status: string;
  contact_email: string | null;
  documents: {
    id: string;
    title: string;
    type: string;
    url: string;
  }[];
  links: {
    results: string;
    schedule: string;
    notices: string;
    entries: string;
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export default function PublicRegattaLanding() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const [data, setData] = useState<RegattaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegattaData = useCallback(async () => {
    if (!regattaId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/public/regattas/${regattaId}`);
      
      if (!response.ok) {
        throw new Error('Regatta not found');
      }
      
      const result = await response.json();
      setData(result.regatta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regatta');
    } finally {
      setLoading(false);
    }
  }, [regattaId]);

  useEffect(() => {
    fetchRegattaData();
  }, [fetchRegattaData]);

  const handleShare = async () => {
    const url = `${API_BASE}/p/${regattaId}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: data?.name || 'Regatta',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await Share.share({
        message: `Check out ${data?.name}: ${url}`,
        url,
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = (start: string, end: string | null) => {
    const startDate = new Date(start);
    if (!end) return formatDate(start);
    
    const endDate = new Date(end);
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    
    if (sameMonth && sameYear) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const getRegistrationBadge = () => {
    if (!data) return null;
    
    const colors = {
      open: { bg: '#D1FAE5', text: '#065F46' },
      closed: { bg: '#FEE2E2', text: '#991B1B' },
      full: { bg: '#FEF3C7', text: '#92400E' },
      not_open: { bg: '#E5E7EB', text: '#374151' },
    };
    
    const labels = {
      open: 'Registration Open',
      closed: 'Registration Closed',
      full: 'Full',
      not_open: 'Registration Not Open Yet',
    };
    
    const style = colors[data.registration_status];
    
    return (
      <View style={[styles.badge, { backgroundColor: style.bg }]}>
        <Text style={[styles.badgeText, { color: style.text }]}>
          {labels[data.registration_status]}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading regatta...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <Anchor size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Regatta Not Found</Text>
        <Text style={styles.errorText}>{error || 'This regatta may have been removed or is not publicly available.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {data.club && (
            <Text style={styles.clubName}>{data.club.name}</Text>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Share2 size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.regattaName}>{data.name}</Text>
        
        <View style={styles.headerMeta}>
          <View style={styles.metaRow}>
            <Calendar size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatDateRange(data.start_date, data.end_date)}
            </Text>
          </View>
          
          {data.venue && (
            <View style={styles.metaRow}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.metaText}>{data.venue}</Text>
            </View>
          )}
        </View>
        
        {getRegistrationBadge()}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Users size={20} color="#0EA5E9" />
          <Text style={styles.statValue}>{data.entry_count}</Text>
          <Text style={styles.statLabel}>
            {data.max_entries ? `of ${data.max_entries}` : 'Entries'}
          </Text>
        </View>
        
        {data.classes.length > 0 && (
          <View style={styles.statCard}>
            <Anchor size={20} color="#0EA5E9" />
            <Text style={styles.statValue}>{data.classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
        )}
        
        {data.entry_fee && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {data.currency || '$'}{data.entry_fee}
            </Text>
            <Text style={styles.statLabel}>Entry Fee</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {data.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{data.description}</Text>
        </View>
      )}

      {/* Classes */}
      {data.classes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Racing Classes</Text>
          <View style={styles.classesRow}>
            {data.classes.map((cls, index) => (
              <View key={index} style={styles.classChip}>
                <Text style={styles.classChipText}>{cls}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Race Information</Text>
        
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => Linking.openURL(data.links.schedule)}
        >
          <Clock size={24} color="#0EA5E9" />
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>Race Schedule</Text>
            <Text style={styles.linkSubtitle}>View daily racing schedule</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => Linking.openURL(data.links.results)}
        >
          <Trophy size={24} color="#F59E0B" />
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>Results & Standings</Text>
            <Text style={styles.linkSubtitle}>Live results and series standings</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => Linking.openURL(data.links.notices)}
        >
          <Bell size={24} color="#EF4444" />
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>Official Notices</Text>
            <Text style={styles.linkSubtitle}>Race committee announcements</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Documents */}
      {data.documents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {data.documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentRow}
              onPress={() => Linking.openURL(doc.url)}
            >
              <FileText size={20} color="#6B7280" />
              <Text style={styles.documentTitle}>{doc.title}</Text>
              <ExternalLink size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Contact */}
      {data.contact_email && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${data.contact_email}`)}
          >
            <Text style={styles.contactEmail}>{data.contact_email}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by BetterAt</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://better.at')}>
          <Text style={styles.footerLink}>Get the app →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clubName: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500',
  },
  shareButton: {
    padding: 8,
  },
  regattaName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  headerMeta: {
    gap: 8,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
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
        elevation: 1,
      },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  classesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  classChipText: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  linkSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  documentTitle: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  contactRow: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  contactEmail: {
    fontSize: 14,
    color: '#0EA5E9',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerLink: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500',
    marginTop: 4,
  },
});
