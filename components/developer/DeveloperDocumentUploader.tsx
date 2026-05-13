/**
 * Developer Document Uploader
 * Bulk upload and training document management for developers
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { developerDocumentService, DeveloperTrainingUtils, type TrainingDocumentBatch } from '@/services/storage/DeveloperDocumentService';
import { useAuth } from '@/providers/AuthProvider';

export const DeveloperDocumentUploader: React.FC = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [batches, setBatches] = useState<TrainingDocumentBatch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Quick training scenarios
  const handleQuickTraining = useCallback(async (scenario: string) => {
    if (!user) return;

    setIsProcessing(true);
    try {
      let batch: TrainingDocumentBatch;

      switch (scenario) {
        case 'rhkyc':
          batch = await DeveloperTrainingUtils.uploadYachtClubBundle(
            'Royal Hong Kong Yacht Club',
            'hong-kong'
          );
          break;
        case 'tides':
          batch = await DeveloperTrainingUtils.uploadTidesCurrentsBundle('san-francisco-bay');
          break;
        case 'custom':
          batch = await developerDocumentService.createTrainingBatch(
            'Custom Training Batch',
            'Developer created custom training documents',
            []
          );
          break;
        default:
          return;
      }

      setBatches(prev => [batch, ...prev]);
      showAlert('Success', `Training batch "${batch.batchName}" created with ${batch.documentCount} documents`);

    } catch (error: any) {
      console.error('Training batch creation failed:', error);
      showAlert('Error', `Failed to create training batch: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const handleBulkUploadDocuments = useCallback(async () => {
    if (!user) return;

    showAlertWithButtons(
      'Bulk Upload',
      'Select training scenario:',
      [
        {
          text: 'Yacht Club Resources (RHKYC Style)',
          onPress: () => handleQuickTraining('rhkyc')
        },
        {
          text: 'Tides & Currents Bundle',
          onPress: () => handleQuickTraining('tides')
        },
        {
          text: 'Custom Batch',
          onPress: () => handleQuickTraining('custom')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [handleQuickTraining, user]);

  const handleUploadFromFileSystem = useCallback(async () => {
    showAlertWithButtons(
      'File System Upload',
      'This would open a file picker to select multiple documents from your filesystem for bulk training upload.',
      [
        {
          text: 'Simulate Upload',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // Simulate file paths for demo
              const mockFilePaths = [
                '/Users/developer/sailing-docs/rhkyc-harbour-secrets.pdf',
                '/Users/developer/sailing-docs/tides-strategy-guide.pdf',
                '/Users/developer/sailing-docs/dragon-racing-tactics.pdf',
                '/Users/developer/sailing-docs/safety-preparation.pdf'
              ];

              const batch = await developerDocumentService.bulkUploadFromFilesystem(
                mockFilePaths,
                {
                  source: 'developer_upload',
                  venue: 'hong-kong',
                  priority: 'high'
                }
              );

              setBatches(prev => [batch, ...prev]);
              showAlert('Success', `Uploaded ${batch.documentCount} documents for training`);

            } catch (error: any) {
              showAlert('Error', error.message);
            } finally {
              setIsProcessing(false);
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  const toggleBatchDetails = (batchId: string) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Developer access required</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Developer Document Training</Text>
        <Text style={styles.subtitle}>
          Bulk upload and manage training documents for AI enhancement
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Training Actions</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleBulkUploadDocuments}
          disabled={isProcessing}
        >
          <Ionicons name="cloud-upload" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Create Training Batch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleUploadFromFileSystem}
          disabled={isProcessing}
        >
          <Ionicons name="folder" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Upload from File System</Text>
        </TouchableOpacity>
      </View>

      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.processingText}>Processing training documents...</Text>
        </View>
      )}

      {/* Training Batches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Batches ({batches.length})</Text>

        {batches.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document" size={48} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No training batches yet</Text>
            <Text style={styles.emptyStateText}>
              Create training batches to expand the sailing knowledge base
            </Text>
          </View>
        ) : (
          batches.map((batch) => (
            <View key={batch.id} style={styles.batchCard}>
              <TouchableOpacity
                style={styles.batchHeader}
                onPress={() => toggleBatchDetails(batch.id)}
              >
                <View style={styles.batchInfo}>
                  <Text style={styles.batchName}>{batch.batchName}</Text>
                  <Text style={styles.batchDescription}>{batch.description}</Text>
                  <Text style={styles.batchStats}>
                    {batch.processedCount}/{batch.documentCount} processed
                    {batch.failedCount > 0 && ` • ${batch.failedCount} failed`}
                  </Text>
                </View>

                <View style={styles.batchStatus}>
                  <View style={[styles.statusBadge, styles[`status_${batch.status}`]]}>
                    <Text style={styles.statusText}>{batch.status.toUpperCase()}</Text>
                  </View>
                  <Ionicons
                    name={expandedBatch === batch.id ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {expandedBatch === batch.id && (
                <View style={styles.batchDetails}>
                  <Text style={styles.detailsTitle}>Documents ({batch.documents.length})</Text>
                  {batch.documents.map((doc) => (
                    <View key={doc.id} style={styles.documentItem}>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentName}>{doc.filename}</Text>
                        <Text style={styles.documentMeta}>
                          {doc.type} • {doc.category} • {doc.priority} priority
                        </Text>
                        {doc.venue && (
                          <Text style={styles.documentVenue}>📍 {doc.venue}</Text>
                        )}
                      </View>
                      <View style={[styles.documentStatus, styles[`doc_status_${doc.status}`]]}>
                        <Text style={styles.documentStatusText}>
                          {doc.status === 'completed' ? '✅' :
                           doc.status === 'failed' ? '❌' :
                           doc.status === 'processing' ? '⚙️' : '⏳'}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <Text style={styles.batchTimestamp}>
                    Created: {batch.createdAt.toLocaleString()}
                    {batch.completedAt && ` • Completed: ${batch.completedAt.toLocaleString()}`}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Developer Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Developer Notes</Text>
        <View style={styles.notesContainer}>
          <Text style={styles.noteItem}>
            🏆 <Text style={styles.noteBold}>Yacht Club Resources:</Text> High-value training documents
            from professional sailing organizations (RHKYC, NYYC, etc.)
          </Text>
          <Text style={styles.noteItem}>
            📚 <Text style={styles.noteBold}>Document Categories:</Text> Tides/currents, tactics, weather,
            rules, boat handling, navigation, safety
          </Text>
          <Text style={styles.noteItem}>
            🧠 <Text style={styles.noteBold}>AI Enhancement:</Text> Each document extracts strategic insights
            and boosts confidence for similar queries
          </Text>
          <Text style={styles.noteItem}>
            🔒 <Text style={styles.noteBold}>Training Data:</Text> Documents are processed and stored
            securely for AI model enhancement
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px',
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
  },
  processingContainer: {
    backgroundColor: '#E3F2FD',
    margin: 10,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  batchCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  batchHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  batchInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  batchDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  batchStats: {
    fontSize: 12,
    color: '#999',
  },
  batchStatus: {
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  status_pending: {
    backgroundColor: '#FFF3E0',
  },
  status_processing: {
    backgroundColor: '#E3F2FD',
  },
  status_completed: {
    backgroundColor: '#E8F5E8',
  },
  status_failed: {
    backgroundColor: '#FFE5E5',
  },
  batchDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 16,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  documentMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  documentVenue: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 2,
  },
  documentStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentStatusText: {
    fontSize: 12,
  },
  doc_status_pending: {
    backgroundColor: '#FFF3E0',
  },
  doc_status_processing: {
    backgroundColor: '#E3F2FD',
  },
  doc_status_completed: {
    backgroundColor: '#E8F5E8',
  },
  doc_status_failed: {
    backgroundColor: '#FFE5E5',
  },
  batchTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    margin: 20,
  },
  notesContainer: {
    gap: 12,
  },
  noteItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noteBold: {
    fontWeight: '600',
    color: '#333',
  },
});