/**
 * Document Viewer Component
 * Displays and manages uploaded documents with AI insights
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { documentStorageService, StoredDocument } from '@/services/storage/DocumentStorageService';
import { DocumentProcessingService } from '@/services/ai/DocumentProcessingService';
import { useAuth } from '@/providers/AuthProvider';
import type { StrategyInsight } from '@/lib/types/ai-knowledge';

const { width: _screenWidth, height: _screenHeight } = Dimensions.get('window');

interface DocumentViewerProps {
  onInsightSelect?: (insight: StrategyInsight) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ onInsightSelect }) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<StoredDocument | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<any>(null);
  const [queryResult, setQueryResult] = useState<StrategyInsight[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [searchQuery, _setSearchQuery] = useState('');

  const documentProcessor = new DocumentProcessingService();

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDocuments = async () => {

    // Debug mode - use dummy user ID if no user (for testing database connection)
    const debugUserId = '51241049-02ed-4e31-b8c6-39af7c9d4d50';
    const userIdToUse = user?.id || debugUserId;

    if (!userIdToUse) {
      return;
    }

    setLoading(true);
    try {
      const docs = await documentStorageService.getUserDocuments(userIdToUse);
      setDocuments(docs);
    } catch (error) {
      console.error('📄 DocumentViewer: Failed to load documents:', error);
      showAlert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = async (document: StoredDocument) => {
    setSelectedDocument(document);
    setDocumentAnalysis(null);

    // Load analysis if available
    const analysis = await documentStorageService.getDocumentAnalysis(document.id);
    if (analysis) {
      setDocumentAnalysis(analysis.analysis_data);
    }
  };

  const handleQueryKnowledgeBase = async () => {
    if (!searchQuery.trim()) {
      showAlert('Query Required', 'Please enter a question or search term');
      return;
    }

    setQueryLoading(true);
    try {
      const insights = await documentProcessor.queryKnowledgeBase(searchQuery, {
        venue: 'San Francisco Bay', // Could be dynamic based on user selection
      });

      setQueryResult(insights);
    } catch (error) {
      console.error('Query failed:', error);
      showAlert('Query Failed', 'Unable to search knowledge base');
    } finally {
      setQueryLoading(false);
    }
  };

  const renderDocumentModal = () => {
    if (!selectedDocument) return null;

    return (
      <Modal
        visible={!!selectedDocument}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDocument(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedDocument.filename}</Text>
            <TouchableOpacity
              onPress={() => setSelectedDocument(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Document Info */}
            <View style={styles.documentInfoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type:</Text>
                <Text style={styles.infoValue}>{selectedDocument.file_type}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Size:</Text>
                <Text style={styles.infoValue}>
                  {(selectedDocument.file_size / 1024).toFixed(1)} KB
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Uploaded:</Text>
                <Text style={styles.infoValue}>
                  {new Date(selectedDocument.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {/* Document Analysis */}
            {documentAnalysis && (
              <View style={styles.analysisSection}>
                <Text style={styles.sectionTitle}>Analysis</Text>

                <View style={styles.analysisCard}>
                  <Text style={styles.analysisType}>
                    Document Class: {documentAnalysis.documentClass}
                  </Text>
                  <Text style={styles.analysisSummary}>{documentAnalysis.summary}</Text>

                  {documentAnalysis.keyTopics && (
                    <View style={styles.topicsContainer}>
                      <Text style={styles.topicsTitle}>Key Topics:</Text>
                      <View style={styles.topicsList}>
                        {documentAnalysis.keyTopics.map((topic: string, index: number) => (
                          <View key={index} style={styles.topicChip}>
                            <Text style={styles.topicText}>{topic}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {documentAnalysis.insights && documentAnalysis.insights.length > 0 && (
                    <View style={styles.insightsSection}>
                      <Text style={styles.insightsTitle}>Strategic Insights:</Text>
                      {documentAnalysis.insights.map((insight: StrategyInsight, index: number) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.insightCard}
                          onPress={() => {
                            onInsightSelect?.(insight);
                            setSelectedDocument(null);
                          }}
                        >
                          <View style={styles.insightHeader}>
                            <Text style={styles.insightTitle}>{insight.title}</Text>
                            <View style={styles.confidenceBadge}>
                              <Text style={styles.confidenceText}>
                                {Math.round((insight.confidence || 0) * 100)}%
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.insightDescription}>{insight.description}</Text>
                          {insight.tacticalAdvice && (
                            <Text style={styles.tacticalAdvice}>
                              Tactical: {insight.tacticalAdvice}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Document Preview */}
            {Platform.OS === 'web' && selectedDocument.public_url && (
              <View style={styles.previewSection}>
                <Text style={styles.sectionTitle}>Document Preview</Text>
                <View style={styles.previewContainer}>
                  {selectedDocument.file_type.includes('pdf') ? (
                    <Text style={styles.previewText}>
                      PDF preview not available. Click to download.
                    </Text>
                  ) : (
                    <Text style={styles.previewText}>
                      Image preview would be shown here
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Knowledge Base Query */}
      <View style={styles.querySection}>
        <Text style={styles.queryTitle}>Ask Strategy Assistant</Text>
        <View style={styles.queryInputContainer}>
          <TouchableOpacity
            style={styles.queryButton}
            onPress={handleQueryKnowledgeBase}
            disabled={queryLoading}
          >
            {queryLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.queryButtonText}>Search Knowledge Base</Text>
            )}
          </TouchableOpacity>
        </View>

        {queryResult.length > 0 && (
          <ScrollView style={styles.queryResults}>
            {queryResult.map((insight, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resultCard}
                onPress={() => onInsightSelect?.(insight)}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>{insight.title}</Text>
                  <Text style={styles.resultConfidence}>
                    {Math.round((insight.confidence || 0) * 100)}% confidence
                  </Text>
                </View>
                <Text style={styles.resultDescription}>{insight.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Documents List */}
      <View style={styles.documentsSection}>
        <Text style={styles.sectionTitle}>Your Documents</Text>

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#C0C0C0" />
            <Text style={styles.emptyText}>No documents uploaded yet</Text>
            <Text style={styles.emptySubtext}>
              Upload sailing instructions, strategy guides, or race documents to get AI insights
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.documentsList}>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.documentCard}
                onPress={() => handleSelectDocument(doc)}
              >
                <View style={styles.documentIcon}>
                  <Ionicons
                    name={doc.file_type.includes('pdf') ? 'document' : 'image'}
                    size={32}
                    color="#007AFF"
                  />
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.filename}</Text>
                  <Text style={styles.documentMeta}>
                    {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C0C0C0" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {renderDocumentModal()}
    </View>
  );
};

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
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  querySection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  queryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  queryInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  queryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  queryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  queryResults: {
    marginTop: 16,
    maxHeight: 200,
  },
  resultCard: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultTitle: {
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  resultConfidence: {
    fontSize: 12,
    color: '#007AFF',
  },
  resultDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  documentsSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  documentsList: {
    flex: 1,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    boxShadow: '0px 1px',
    elevation: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  documentMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  documentInfoCard: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    flex: 1,
    color: '#333',
  },
  analysisSection: {
    padding: 16,
  },
  analysisCard: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
  },
  analysisType: {
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  analysisSummary: {
    color: '#333',
    lineHeight: 20,
  },
  topicsContainer: {
    marginTop: 16,
  },
  topicsTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  topicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  topicText: {
    color: '#fff',
    fontSize: 13,
  },
  insightsSection: {
    marginTop: 20,
  },
  insightsTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  insightTitle: {
    fontWeight: '600',
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  insightDescription: {
    color: '#666',
    fontSize: 14,
    lineHeight: 18,
  },
  tacticalAdvice: {
    color: '#007AFF',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  previewSection: {
    padding: 16,
  },
  previewContainer: {
    backgroundColor: '#F9F9F9',
    padding: 20,
    borderRadius: 8,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: '#999',
  },
});