/**
 * DocumentDetail - View a single document with its extracted insights
 */

import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import {
  VenueKnowledgeDocument,
  DocumentType,
  ExtractionStatus,
} from '@/services/venue/VenueDocumentService';
import { useVenueInsights } from '@/hooks/useVenueDocuments';
import { InsightCard } from './InsightCard';
import { formatDistanceToNow, format } from 'date-fns';

interface DocumentDetailProps {
  document: VenueKnowledgeDocument;
  venueId: string;
  onBack: () => void;
  onShowOnMap?: (coords: { lat: number; lng: number }, name?: string) => void;
}

export function DocumentDetail({
  document,
  venueId,
  onBack,
  onShowOnMap,
}: DocumentDetailProps) {
  const { data: insightsData, isLoading: loadingInsights } = useVenueInsights(venueId, {
    documentId: document.id,
  });

  const insights = insightsData?.data || [];
  const timeAgo = formatDistanceToNow(new Date(document.created_at), { addSuffix: true });

  const getDocumentTypeIcon = (type: DocumentType): string => {
    switch (type) {
      case 'pdf':
        return 'document-text';
      case 'video_link':
        return 'videocam';
      case 'external_url':
        return 'link';
      case 'presentation':
        return 'easel';
      default:
        return 'document';
    }
  };

  const getDocumentTypeColor = (type: DocumentType): string => {
    switch (type) {
      case 'pdf':
        return '#DC2626';
      case 'video_link':
        return '#7C3AED';
      case 'external_url':
        return '#2563EB';
      case 'presentation':
        return '#D97706';
      default:
        return '#6B7280';
    }
  };

  const getExtractionStatusInfo = (status: ExtractionStatus) => {
    switch (status) {
      case 'pending':
        return {
          icon: 'time-outline',
          label: 'Awaiting extraction',
          color: '#D97706',
          bg: '#FEF3C7',
        };
      case 'processing':
        return {
          icon: 'sparkles',
          label: 'Extracting insights...',
          color: '#2563EB',
          bg: '#DBEAFE',
        };
      case 'completed':
        return {
          icon: 'checkmark-circle',
          label: 'Insights extracted',
          color: '#059669',
          bg: '#D1FAE5',
        };
      case 'failed':
        return {
          icon: 'alert-circle',
          label: 'Extraction failed',
          color: '#DC2626',
          bg: '#FEE2E2',
        };
      default:
        return null;
    }
  };

  const handleOpenDocument = () => {
    if (document.document_url) {
      Linking.openURL(document.document_url);
    } else if (document.original_source_url) {
      Linking.openURL(document.original_source_url);
    }
  };

  const extractionStatus = getExtractionStatusInfo(document.extraction_status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            Document
          </ThemedText>
          <ThemedText style={styles.insightCount}>
            {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Card */}
        <View style={styles.documentCard}>
          {/* Icon and Type */}
          <View style={styles.documentHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: getDocumentTypeColor(document.document_type) + '15' },
              ]}
            >
              <Ionicons
                name={getDocumentTypeIcon(document.document_type) as any}
                size={28}
                color={getDocumentTypeColor(document.document_type)}
              />
            </View>

            {(document.document_url || document.original_source_url) && (
              <TouchableOpacity
                style={styles.openButton}
                onPress={handleOpenDocument}
              >
                <Ionicons name="open-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.openButtonText}>Open</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <ThemedText style={styles.documentTitle}>{document.title}</ThemedText>

          {/* Author */}
          {document.author_name && (
            <ThemedText style={styles.author}>by {document.author_name}</ThemedText>
          )}

          {/* Description */}
          {document.description && (
            <ThemedText style={styles.description}>{document.description}</ThemedText>
          )}

          {/* Meta */}
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaText}>Uploaded {timeAgo}</ThemedText>
            {document.published_date && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <ThemedText style={styles.metaText}>
                  Published {format(new Date(document.published_date), 'MMM d, yyyy')}
                </ThemedText>
              </>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={16} color="#6B7280" />
              <ThemedText style={styles.statText}>{document.view_count} views</ThemedText>
            </View>
            <View style={styles.stat}>
              <Ionicons name="arrow-up" size={16} color="#059669" />
              <ThemedText style={[styles.statText, { color: '#059669' }]}>
                {document.upvotes} upvotes
              </ThemedText>
            </View>
          </View>

          {/* Extraction Status */}
          {extractionStatus && (
            <View style={[styles.extractionStatus, { backgroundColor: extractionStatus.bg }]}>
              {document.extraction_status === 'processing' ? (
                <ActivityIndicator size={14} color={extractionStatus.color} />
              ) : (
                <Ionicons
                  name={extractionStatus.icon as any}
                  size={16}
                  color={extractionStatus.color}
                />
              )}
              <ThemedText style={[styles.extractionText, { color: extractionStatus.color }]}>
                {extractionStatus.label}
              </ThemedText>
            </View>
          )}

          {/* Extraction Error */}
          {document.extraction_status === 'failed' && document.extraction_error && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>
                Error: {document.extraction_error}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Insights Section */}
        <View style={styles.insightsSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Extracted Insights ({insights.length})
            </ThemedText>
          </View>

          {loadingInsights ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : insights.length > 0 ? (
            <View style={styles.insightsList}>
              {insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  venueId={venueId}
                  onShowOnMap={onShowOnMap}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noInsights}>
              {document.extraction_status === 'pending' ? (
                <>
                  <Ionicons name="time-outline" size={32} color="#D97706" />
                  <ThemedText style={styles.noInsightsTitle}>Extraction Pending</ThemedText>
                  <ThemedText style={styles.noInsightsText}>
                    This document will be analyzed and key insights extracted soon.
                  </ThemedText>
                </>
              ) : document.extraction_status === 'processing' ? (
                <>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <ThemedText style={styles.noInsightsTitle}>Analyzing Document</ThemedText>
                  <ThemedText style={styles.noInsightsText}>
                    Extracting wind patterns, tide strategies, and local tips...
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="bulb-outline" size={32} color="#D1D5DB" />
                  <ThemedText style={styles.noInsightsTitle}>No insights yet</ThemedText>
                  <ThemedText style={styles.noInsightsText}>
                    No insights have been extracted from this document.
                  </ThemedText>
                </>
              )}
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  insightCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  menuButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 100,
  },
  documentCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 28,
    marginBottom: 4,
  },
  author: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  metaDot: {
    fontSize: 13,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
  },
  extractionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  extractionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  insightsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  insightsList: {
    gap: 12,
  },
  noInsights: {
    alignItems: 'center',
    padding: 32,
  },
  noInsightsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  noInsightsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});
