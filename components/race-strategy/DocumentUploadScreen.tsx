// @ts-nocheck

/**
 * Document Upload Screen
 *
 * Allows sailors to upload race documents (NOR, SSI, Appendices) or provide URLs
 * Triggers AI document processing workflow
 *
 * Part of vertical slice: Document Upload → AI Extraction → Visualization → Validation
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import RaceEventService from '@/services/RaceEventService';
import { DocumentType, SourceDocument } from '@/types/raceEvents';
import { supabase } from '@/services/supabase';

interface DocumentUploadScreenProps {
  onProcessingComplete: (raceEventId: string) => void;
}

export function DocumentUploadScreen({ onProcessingComplete }: DocumentUploadScreenProps) {
  const [raceName, setRaceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<SourceDocument[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

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
      } else if (filename.includes('calendar') || filename.endsWith('.csv')) {
        docType = DocumentType.CALENDAR;
      }

      const sourceDoc: SourceDocument = {
        type: docType,
        filename: file.name,
        url: file.uri
      };

      setUploadedFiles([...uploadedFiles, sourceDoc]);
      setError('');
    } catch (err) {
      console.error('Error picking document:', err);
      setError('Failed to pick document');
    }
  };

  /**
   * Process documents with AI
   */
  const handleProcessDocuments = async () => {
    if (!raceName.trim()) {
      setError('Please enter a race name');
      return;
    }

    if (uploadedFiles.length === 0 && !sourceUrl.trim()) {
      setError('Please upload documents or provide a URL');
      return;
    }

    setProcessing(true);
    setError('');
    setStatus('Creating race event...');

    try {
      // Step 1: Create race event
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 24); // Default to tomorrow

      const { data: raceEvent, error: createError } = await RaceEventService.createRaceEvent({
        race_name: raceName,
        start_time: startTime.toISOString(),
        source_url: sourceUrl || undefined,
        source_documents: uploadedFiles
      });

      if (createError || !raceEvent) {
        throw new Error(createError?.message || 'Failed to create race event');
      }

      setStatus('Processing documents...');

      let extractedCourseName: string | undefined;
      let extractedDescription: string | undefined;
      let extractedWaypoints: any[] = [];
      let extractedConfidence: number | undefined;

      // Step 2: Prefer direct document extraction when files are uploaded
      if (uploadedFiles.length > 0) {
        const primaryDocument = uploadedFiles[0];
        if (!primaryDocument?.url) {
          throw new Error('Selected document is missing a readable URL');
        }

        const fileName = primaryDocument.filename || 'race-document';
        const lowerName = fileName.toLowerCase();
        const mimeType = lowerName.endsWith('.pdf')
          ? 'application/pdf'
          : lowerName.endsWith('.csv')
            ? 'text/csv'
            : 'application/pdf';

        const base64 = await FileSystem.readAsStringAsync(primaryDocument.url, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { data: extractedData, error: extractionError } = await supabase.functions.invoke(
          'extract-course-from-document',
          {
            body: {
              fileContent: `data:${mimeType};base64,${base64}`,
              fileName,
              fileType: mimeType,
              raceType: 'fleet',
            },
          }
        );

        if (extractionError) {
          throw new Error(extractionError.message || 'Failed to parse uploaded document');
        }

        extractedCourseName = extractedData?.courseName;
        extractedDescription = extractedData?.courseDescription;
        extractedWaypoints = Array.isArray(extractedData?.waypoints) ? extractedData.waypoints : [];
        extractedConfidence = typeof extractedData?.confidence === 'number' ? extractedData.confidence : undefined;
      } else if (sourceUrl.trim()) {
        // Fallback path: URL extraction
        const { data: extractedData, error: extractionError } = await supabase.functions.invoke(
          'extract-race-details',
          {
            body: { url: sourceUrl.trim() },
          }
        );

        if (extractionError) {
          throw new Error(extractionError.message || 'Failed to parse source URL');
        }

        const firstRace = Array.isArray(extractedData?.races) ? extractedData.races[0] : null;
        extractedCourseName = firstRace?.raceName || extractedData?.data?.raceName;
        extractedDescription = firstRace?.description || extractedData?.data?.description;
        extractedConfidence = extractedData?.overallConfidence;
        extractedWaypoints = Array.isArray(firstRace?.marks)
          ? firstRace.marks.map((mark: any, index: number) => ({
              name: mark?.name || `Mark ${index + 1}`,
              latitude: mark?.latitude,
              longitude: mark?.longitude,
              type: mark?.type || 'mark',
              notes: mark?.description || '',
              passingSide: mark?.rounding || 'either',
            }))
          : [];
      }

      setStatus('Extraction complete!');

      // Step 3: Update race event with extracted data
      await RaceEventService.updateRaceEvent(raceEvent.id, {
        race_name: extractedCourseName || raceName,
        start_time: startTime.toISOString(),
        course_description: extractedDescription,
        confidence_score: extractedConfidence,
        extraction_status: 'completed'
      });

      if (extractedWaypoints.length > 0) {
        const marks = extractedWaypoints
          .filter((waypoint: any) => typeof waypoint?.latitude === 'number' && typeof waypoint?.longitude === 'number')
          .map((waypoint: any, index: number) => ({
            mark_name: waypoint.name || `Mark ${index + 1}`,
            mark_type: waypoint.type || 'mark',
            position: `POINT(${waypoint.longitude} ${waypoint.latitude})`,
            rounding_direction: waypoint.passingSide || 'either',
            sequence_number: index + 1,
            mark_color: null,
            mark_shape: null,
            extracted_from: 'ai_pdf',
            confidence_score: extractedConfidence || null
          }));

        if (marks.length > 0) {
          await RaceEventService.addCourseMarks(raceEvent.id, marks);
        }
      }

      // Navigate to validation screen
      setTimeout(() => {
        onProcessingComplete(raceEvent.id);
      }, 1000);

    } catch (err) {
      console.error('Error processing documents:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setProcessing(false);
      setStatus('');
    }
  };

  /**
   * Remove uploaded file
   */
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Race Documents</Text>
      <Text style={styles.subtitle}>
        Upload sailing instructions, notice of race, or provide club website URL
      </Text>

      {/* Race Name Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Race Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Croucher Series 3 & 4"
          value={raceName}
          onChangeText={setRaceName}
          editable={!processing}
        />
      </View>

      {/* URL Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Club Website URL (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://www.rhkyc.org.hk/sailing/classes/dragon"
          value={sourceUrl}
          onChangeText={setSourceUrl}
          editable={!processing}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          We'll crawl the website to find race documents
        </Text>
      </View>

      {/* Document Upload */}
      <View style={styles.section}>
        <Text style={styles.label}>Upload Documents (Optional)</Text>

        <TouchableOpacity
          style={[styles.uploadButton, processing && styles.uploadButtonDisabled]}
          onPress={handlePickDocument}
          disabled={processing}
        >
          <Text style={styles.uploadButtonText}>
            📄 Pick PDF/CSV
          </Text>
        </TouchableOpacity>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <View style={styles.filesList}>
            {uploadedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{file.filename}</Text>
                  <Text style={styles.fileType}>{file.type}</Text>
                </View>
                {!processing && (
                  <TouchableOpacity onPress={() => handleRemoveFile(index)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Status Display */}
      {processing && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#0080ff" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      {/* Process Button */}
      <TouchableOpacity
        style={[styles.processButton, processing && styles.processButtonDisabled]}
        onPress={handleProcessDocuments}
        disabled={processing}
      >
        <Text style={styles.processButtonText}>
          {processing ? 'Processing...' : '🚀 Process Documents'}
        </Text>
      </TouchableOpacity>

      {/* Example URLs */}
      <View style={styles.exampleSection}>
        <Text style={styles.exampleTitle}>Example (RHKYC Dragon Class):</Text>
        <TouchableOpacity
          onPress={() => {
            setSourceUrl('https://www.rhkyc.org.hk/sailing/classes/classes/dragon');
            setRaceName('Croucher Series 3 & 4');
          }}
        >
          <Text style={styles.exampleLink}>
            Load RHKYC Dragon Croucher Series
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000'
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24
  },
  section: {
    marginBottom: 24
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  uploadButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center'
  },
  uploadButtonDisabled: {
    opacity: 0.5
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#666'
  },
  filesList: {
    marginTop: 12
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8
  },
  fileInfo: {
    flex: 1
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2
  },
  fileType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase'
  },
  removeButton: {
    fontSize: 20,
    color: '#ff0000',
    padding: 4
  },
  errorContainer: {
    backgroundColor: '#fff0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff0000',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16
  },
  errorText: {
    color: '#cc0000',
    fontSize: 14
  },
  statusContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginBottom: 16
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0080ff',
    fontWeight: '500'
  },
  processButton: {
    backgroundColor: '#0080ff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  processButtonDisabled: {
    backgroundColor: '#ccc'
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  exampleSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8
  },
  exampleTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8
  },
  exampleLink: {
    fontSize: 14,
    color: '#0080ff',
    textDecorationLine: 'underline'
  }
});

export default DocumentUploadScreen;
