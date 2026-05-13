/**
 * DocumentList Component
 * Enhanced document list with extraction status and viewer integration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { ExtractionStatusBadge } from './ExtractionStatusBadge';
import { DocumentViewer } from './DocumentViewer';
import type { RaceCourseExtraction } from '@/lib/types/ai-knowledge';

export interface Document {
  id: string;
  name: string;
  type: string;
  document_type?: 'si' | 'nor' | 'course_map' | 'results' | 'other';
  uploadedAt: Date;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extraction?: RaceCourseExtraction;
  fileSize?: number;
  url?: string;
}

interface DocumentListProps {
  documents: Document[];
  onReExtract?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  onViewInStrategy?: (documentId: string) => void;
}

export function DocumentList({
  documents,
  onReExtract,
  onDelete,
  onViewInStrategy,
}: DocumentListProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setViewerVisible(true);
  };

  const handleDeleteDocument = (document: Document) => {
    showConfirm(
      'Delete Document',
      `Are you sure you want to delete "${document.name}"?`,
      () => onDelete?.(document.id),
      { destructive: true },
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getDocumentTypeLabel = (type?: string) => {
    switch (type) {
      case 'si':
        return 'Sailing Instructions';
      case 'nor':
        return 'Notice of Race';
      case 'course_map':
        return 'Course Map';
      case 'results':
        return 'Results';
      default:
        return 'Document';
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    if (type.includes('pdf')) return 'file-pdf-box';
    if (type.includes('image')) return 'file-image';
    return 'file-document';
  };

  const renderDocument = ({ item: doc }: { item: Document }) => (
    <View style={styles.documentCard}>
      {/* Header */}
      <View style={styles.documentHeader}>
        <View style={styles.documentIcon}>
          <MaterialCommunityIcons
            name={getDocumentTypeIcon(doc.type) as any}
            size={40}
            color="#3B82F6"
          />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {doc.name}
          </Text>
          <View style={styles.documentMeta}>
            {doc.document_type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {getDocumentTypeLabel(doc.document_type)}
                </Text>
              </View>
            )}
            <Text style={styles.documentDate}>
              {doc.uploadedAt.toLocaleDateString()}
            </Text>
            {doc.fileSize && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.fileSizeText}>{formatFileSize(doc.fileSize)}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Extraction Status */}
      <View style={styles.statusSection}>
        <ExtractionStatusBadge status={doc.extractionStatus} size="medium" />

        {doc.extractionStatus === 'completed' && doc.extraction && (
          <Text style={styles.extractionSummary}>
            {doc.extraction.courseLayout.type} • {doc.extraction.marks.length} marks
          </Text>
        )}

        {doc.extractionStatus === 'failed' && (
          <TouchableOpacity
            style={styles.reExtractButton}
            onPress={() => onReExtract?.(doc.id)}
          >
            <MaterialCommunityIcons name="refresh" size={16} color="#3B82F6" />
            <Text style={styles.reExtractText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Extraction Details (Collapsed) */}
      {doc.extraction && (
        <View style={styles.extractionDetails}>
          <Text style={styles.extractionDetailsTitle}>Extracted Information:</Text>
          {doc.extraction.communication.vhfChannel && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="radio" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                VHF: Ch {doc.extraction.communication.vhfChannel}
              </Text>
            </View>
          )}
          {doc.extraction.marks.length > 0 && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {doc.extraction.marks.length} course marks
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleViewDocument(doc)}
        >
          <MaterialCommunityIcons name="eye-outline" size={18} color="#3B82F6" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>

        {doc.extraction && onViewInStrategy && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onViewInStrategy(doc.id)}
          >
            <MaterialCommunityIcons name="compass-outline" size={18} color="#3B82F6" />
            <Text style={styles.actionButtonText}>View in Strategy</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteDocument(doc)}
        >
          <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={64}
              color="#CBD5E1"
            />
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptyText}>
              Upload sailing instructions, NORs, and course diagrams.{'\n'}
              Course information is extracted automatically.
            </Text>
          </View>
        }
      />

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          visible={viewerVisible}
          documentName={selectedDocument.name}
          documentType={selectedDocument.type}
          documentUrl={selectedDocument.url}
          onClose={() => {
            setViewerVisible(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentIcon: {
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  documentDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  separator: {
    marginHorizontal: 6,
    fontSize: 12,
    color: '#D1D5DB',
    height: 16,
  },
  fileSizeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  extractionSummary: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 12,
    flex: 1,
  },
  reExtractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginLeft: 12,
  },
  reExtractText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  extractionDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  extractionDetailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 6,
  },
  deleteButton: {
    borderColor: '#EF4444',
    marginLeft: 'auto',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
