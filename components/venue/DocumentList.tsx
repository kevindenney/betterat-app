/**
 * DocumentList - List of knowledge documents for a venue
 * Shows uploaded PDFs, guides, and videos with their insights
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { useVenueDocuments } from '@/hooks/useVenueDocuments';
import { VenueKnowledgeDocument, DocumentType, ExtractionStatus } from '@/services/venue/VenueDocumentService';
import { formatDistanceToNow } from 'date-fns';

interface DocumentListProps {
  venueId: string;
  racingAreaId?: string | null;
  raceRouteId?: string | null;
  onSelectDocument: (document: VenueKnowledgeDocument) => void;
  onUploadDocument: () => void;
}

export function DocumentList({
  venueId,
  racingAreaId,
  raceRouteId,
  onSelectDocument,
  onUploadDocument,
}: DocumentListProps) {
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const { data, isLoading, isRefetching, refetch } = useVenueDocuments(venueId, {
    racingAreaId,
    raceRouteId,
    sortBy,
  });

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

  const getExtractionStatusBadge = (status: ExtractionStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: '#D97706', bg: '#FEF3C7' };
      case 'processing':
        return { label: 'Extracting...', color: '#2563EB', bg: '#DBEAFE' };
      case 'completed':
        return { label: 'Extracted', color: '#059669', bg: '#D1FAE5' };
      case 'failed':
        return { label: 'Failed', color: '#DC2626', bg: '#FEE2E2' };
      default:
        return null;
    }
  };

  const renderDocument = ({ item }: { item: VenueKnowledgeDocument }) => {
    const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
    const extractionStatus = getExtractionStatusBadge(item.extraction_status);

    return (
      <TouchableOpacity
        style={styles.documentCard}
        onPress={() => onSelectDocument(item)}
        activeOpacity={0.7}
      >
        {/* Document Type Icon */}
        <View style={[styles.iconContainer, { backgroundColor: getDocumentTypeColor(item.document_type) + '15' }]}>
          <Ionicons
            name={getDocumentTypeIcon(item.document_type) as any}
            size={24}
            color={getDocumentTypeColor(item.document_type)}
          />
        </View>

        {/* Content */}
        <View style={styles.contentColumn}>
          {/* Title */}
          <ThemedText style={styles.title} numberOfLines={2}>
            {item.title}
          </ThemedText>

          {/* Author */}
          {item.author_name && (
            <ThemedText style={styles.author}>
              by {item.author_name}
            </ThemedText>
          )}

          {/* Description */}
          {item.description && (
            <ThemedText style={styles.description} numberOfLines={2}>
              {item.description}
            </ThemedText>
          )}

          {/* Meta Row */}
          <View style={styles.metaRow}>
            {extractionStatus && (
              <View style={[styles.statusBadge, { backgroundColor: extractionStatus.bg }]}>
                {item.extraction_status === 'processing' && (
                  <ActivityIndicator size={10} color={extractionStatus.color} style={{ marginRight: 4 }} />
                )}
                <ThemedText style={[styles.statusText, { color: extractionStatus.color }]}>
                  {extractionStatus.label}
                </ThemedText>
              </View>
            )}

            <ThemedText style={styles.metaText}>{timeAgo}</ThemedText>

            {item.upvotes > 0 && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <View style={styles.upvoteCount}>
                  <Ionicons name="arrow-up" size={12} color="#059669" />
                  <ThemedText style={styles.upvoteText}>{item.upvotes}</ThemedText>
                </View>
              </>
            )}

            {item.view_count > 0 && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <View style={styles.viewCount}>
                  <Ionicons name="eye-outline" size={12} color="#6B7280" />
                  <ThemedText style={styles.metaText}>{item.view_count}</ThemedText>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Sort Options */}
      <View style={styles.sortRow}>
        {(['recent', 'popular'] as const).map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
            onPress={() => setSortBy(option)}
          >
            <ThemedText
              style={[styles.sortText, sortBy === option && styles.sortTextActive]}
            >
              {option === 'recent' ? 'Most Recent' : 'Most Popular'}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
      <ThemedText style={styles.emptyTitle}>No documents yet</ThemedText>
      <ThemedText style={styles.emptyText}>
        Upload PDFs, guides, or link to videos about this venue. AI will extract key insights automatically.
      </ThemedText>
      <TouchableOpacity style={styles.uploadButton} onPress={onUploadDocument}>
        <Ionicons name="cloud-upload-outline" size={20} color="white" />
        <ThemedText style={styles.uploadButtonText}>Upload Document</ThemedText>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.data || []}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      />

      {/* Floating Upload Button */}
      {(data?.data?.length || 0) > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={onUploadDocument}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="white" />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  sortOption: {
    paddingVertical: 4,
  },
  sortOptionActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  sortText: {
    fontSize: 14,
    color: '#6B7280',
  },
  sortTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    padding: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentColumn: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 2,
  },
  author: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaDot: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 4,
  },
  upvoteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  upvoteText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
      },
      default: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
});
