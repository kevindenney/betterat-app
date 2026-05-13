/**
 * Create Race Event Screen
 *
 * Document upload and race creation flow
 * Vertical slice: Upload → AI Processing → Validation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import RaceEventService from '../../services/RaceEventService';
import { DocumentType, SourceDocument } from '../../types/raceEvents';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('CreateRaceEventScreen');

export default function CreateRaceEventScreen() {
  const [raceName, setRaceName] = useState('');
  const [raceSeries, setRaceSeries] = useState('');
  const [boatClass, setBoatClass] = useState('');
  const [startTime, setStartTime] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle document picker
   */
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv'],
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // Determine document type from filename
      let docType = DocumentType.OTHER;
      const filename = file.name.toLowerCase();

      if (filename.includes('nor') || filename.includes('notice')) {
        docType = DocumentType.NOR;
      } else if (filename.includes('ssi') || filename.includes('sailing') && filename.includes('instruction')) {
        docType = DocumentType.SSI;
      } else if (filename.includes('appendix') || filename.includes('attachment')) {
        docType = DocumentType.APPENDIX;
      } else if (filename.includes('calendar') || filename.includes('.csv')) {
        docType = DocumentType.CALENDAR;
      }

      // Read file content (for small files)
      // In production, would upload to Supabase Storage
      const doc: SourceDocument = {
        type: docType,
        filename: file.name,
        url: file.uri
      };

      setDocuments([...documents, doc]);
    } catch (err) {
      logger.error('Error picking document', err);
      setError('Failed to pick document');
    }
  };

  /**
   * Handle URL input for web scraping
   */
  const handleAddUrl = () => {
    if (!sourceUrl) return;

    const doc: SourceDocument = {
      type: DocumentType.OTHER,
      url: sourceUrl
    };

    setDocuments([...documents, doc]);
    setSourceUrl('');
  };

  /**
   * Create race event and start processing
   */
  const handleCreateRace = async () => {
    if (!raceName || !startTime) {
      setError('Race name and start time are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create race event
      const { data: raceEvent, error: createError } = await RaceEventService.createRaceEvent({
        race_name: raceName,
        race_series: raceSeries || undefined,
        boat_class: boatClass || undefined,
        start_time: startTime,
        source_documents: documents
      });

      if (createError || !raceEvent) {
        throw createError || new Error('Failed to create race event');
      }

      // Start document processing
      if (documents.length > 0) {
        const { error: processError } = await RaceEventService.processDocuments({
          race_event_id: raceEvent.id,
          documents
        });

        if (processError) {
          logger.warn('Document processing error', processError);
        }
      }

      // Navigate to validation screen
      router.push(`/race/validate/${raceEvent.id}`);
    } catch (err) {
      logger.error('Error creating race', err);
      setError(err instanceof Error ? err.message : 'Failed to create race');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quick fill for RHKYC Dragon example
   */
  const handleQuickFillRHKYC = () => {
    setRaceName('Croucher Series 3 & 4');
    setRaceSeries('Croucher Series');
    setBoatClass('Dragon');
    setStartTime('2025-10-19T11:36:00+08:00');

    // Add example documents
    setDocuments([
      {
        type: DocumentType.NOR,
        url: 'https://www.rhkyc.org.hk/storage/app/media/Classes/Dragon/DragonStandardNOR.pdf',
        filename: 'DragonStandardNOR.pdf'
      },
      {
        type: DocumentType.SSI,
        url: 'https://www.rhkyc.org.hk/sailing/race-management/ssi',
        filename: 'Standard Sailing Instructions'
      },
      {
        type: DocumentType.APPENDIX,
        url: 'https://www.rhkyc.org.hk/storage/app/media/Sailing/race-management/Standard%20Sailing%20Instructions/2025%20SSI%20Attachment%20B.pdf',
        filename: '2025 SSI Attachment B.pdf'
      },
      {
        type: DocumentType.CALENDAR,
        url: 'https://www.rhkyc.org.hk/storage/app/media/Sailing/sailing%20calendar/Dragon2526.csv',
        filename: 'Dragon2526.csv'
      }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Race Event</Text>
        <Text style={styles.subtitle}>
          Upload documents or provide race details
        </Text>
      </View>

      {/* Quick fill button for testing */}
      <TouchableOpacity
        style={styles.quickFillButton}
        onPress={handleQuickFillRHKYC}
      >
        <Text style={styles.quickFillText}>
          🚀 Quick Fill: RHKYC Dragon Croucher Series
        </Text>
      </TouchableOpacity>

      {/* Race Details Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Race Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Race Name *</Text>
          <TextInput
            style={styles.input}
            value={raceName}
            onChangeText={setRaceName}
            placeholder="e.g., Croucher Series 3 & 4"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Race Series</Text>
          <TextInput
            style={styles.input}
            value={raceSeries}
            onChangeText={setRaceSeries}
            placeholder="e.g., Croucher Series"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Boat Class</Text>
          <TextInput
            style={styles.input}
            value={boatClass}
            onChangeText={setBoatClass}
            placeholder="e.g., Dragon"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Time *</Text>
          <TextInput
            style={styles.input}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="2025-10-19T11:36:00+08:00"
            placeholderTextColor="#999"
          />
          <Text style={styles.hint}>ISO 8601 format</Text>
        </View>
      </View>

      {/* Document Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents (Optional)</Text>
        <Text style={styles.sectionSubtitle}>
          AI will extract course and race details
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickDocument}
        >
          <Text style={styles.uploadButtonText}>
            📄 Upload Document (NOR, SSI, Appendix)
          </Text>
        </TouchableOpacity>

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.urlInputContainer}>
          <TextInput
            style={styles.urlInput}
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="Paste document URL"
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={styles.addUrlButton}
            onPress={handleAddUrl}
          >
            <Text style={styles.addUrlButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Document List */}
        {documents.length > 0 && (
          <View style={styles.documentList}>
            <Text style={styles.documentListTitle}>
              Documents ({documents.length})
            </Text>
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentType}>{doc.type}</Text>
                  <Text style={styles.documentName} numberOfLines={1}>
                    {doc.filename || doc.url}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setDocuments(documents.filter((_, i) => i !== index));
                  }}
                >
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, loading && styles.createButtonDisabled]}
        onPress={handleCreateRace}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>
            {documents.length > 0 ? 'Create & Process Documents' : 'Create Race Event'}
          </Text>
        )}
      </TouchableOpacity>

      {documents.length > 0 && (
        <Text style={styles.processingNote}>
          We'll extract race course, marks, and strategy from your documents
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  quickFillButton: {
    margin: 20,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0080ff'
  },
  quickFillText: {
    color: '#0080ff',
    fontWeight: '600',
    textAlign: 'center'
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000'
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#0080ff',
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16
  },
  uploadButtonText: {
    color: '#0080ff',
    fontSize: 16,
    fontWeight: '500'
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd'
  },
  orText: {
    marginHorizontal: 12,
    color: '#999',
    fontSize: 14
  },
  urlInputContainer: {
    flexDirection: 'row',
    gap: 8
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000'
  },
  addUrlButton: {
    backgroundColor: '#0080ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center'
  },
  addUrlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
  documentList: {
    marginTop: 16
  },
  documentListTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8
  },
  documentInfo: {
    flex: 1
  },
  documentType: {
    fontSize: 12,
    color: '#0080ff',
    fontWeight: '600',
    marginBottom: 2
  },
  documentName: {
    fontSize: 14,
    color: '#000'
  },
  removeButton: {
    fontSize: 20,
    color: '#999',
    padding: 4
  },
  errorContainer: {
    margin: 20,
    padding: 12,
    backgroundColor: '#fee',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcc'
  },
  errorText: {
    color: '#c00',
    fontSize: 14
  },
  createButton: {
    margin: 20,
    padding: 16,
    backgroundColor: '#0080ff',
    borderRadius: 8,
    alignItems: 'center'
  },
  createButtonDisabled: {
    opacity: 0.5
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  processingNote: {
    marginHorizontal: 20,
    marginBottom: 20,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic'
  }
});
