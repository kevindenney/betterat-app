/**
 * DocumentUploader - Upload PDFs or add video/URL links
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { useUploadDocument } from '@/hooks/useVenueDocuments';
import { DocumentType } from '@/services/venue/VenueDocumentService';
import { useVenueRacingAreasAndRoutes } from '@/hooks/useVenueRacingAreas';
import * as DocumentPicker from 'expo-document-picker';

interface DocumentUploaderProps {
  venueId: string;
  venueName: string;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRacingAreaId?: string | null;
  defaultRaceRouteId?: string | null;
}

export function DocumentUploader({
  venueId,
  venueName,
  visible,
  onClose,
  onSuccess,
  defaultRacingAreaId,
  defaultRaceRouteId,
}: DocumentUploaderProps) {
  const [documentType, setDocumentType] = useState<DocumentType>('pdf');
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedRacingAreaId, setSelectedRacingAreaId] = useState<string | null>(defaultRacingAreaId ?? null);
  const [selectedRaceRouteId, setSelectedRaceRouteId] = useState<string | null>(defaultRaceRouteId ?? null);

  const uploadMutation = useUploadDocument();
  const { items: racingItems } = useVenueRacingAreasAndRoutes(venueId);

  // Sync with defaults when they change
  useEffect(() => {
    setSelectedRacingAreaId(defaultRacingAreaId ?? null);
    setSelectedRaceRouteId(defaultRaceRouteId ?? null);
  }, [defaultRacingAreaId, defaultRaceRouteId]);

  const documentTypes: { type: DocumentType; label: string; icon: string; description: string }[] = [
    {
      type: 'pdf',
      label: 'PDF Document',
      icon: 'document-text',
      description: 'Upload a PDF guide, article, or presentation',
    },
    {
      type: 'video_link',
      label: 'Video Link',
      icon: 'videocam',
      description: 'Link to a YouTube, Vimeo, or other video',
    },
    {
      type: 'external_url',
      label: 'External URL',
      icon: 'link',
      description: 'Link to an article or webpage',
    },
  ];

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        // Auto-fill title from filename if empty
        if (!title) {
          const fileName = result.assets[0].name.replace('.pdf', '');
          setTitle(fileName);
        }
      }
    } catch (error) {
      console.error('[DocumentUploader] Pick error:', error);
      showAlert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert('Title required', 'Please enter a title for this document');
      return;
    }

    if (documentType === 'pdf' && !selectedFile) {
      showAlert('File required', 'Please select a PDF file to upload');
      return;
    }

    if ((documentType === 'video_link' || documentType === 'external_url') && !externalUrl.trim()) {
      showAlert('URL required', 'Please enter a URL');
      return;
    }

    try {
      // For PDF, we need to convert the DocumentPicker result to a File object
      // This is platform-specific and may need adjustment
      let file: File | undefined;
      if (documentType === 'pdf' && selectedFile) {
        // On web, we can directly use the file
        if (Platform.OS === 'web' && selectedFile.file) {
          file = selectedFile.file as File;
        } else {
          // On native, we'll pass the URI and let the service handle it
          // For now, we'll use fetch to get the blob
          const response = await fetch(selectedFile.uri);
          const blob = await response.blob();
          file = new File([blob], selectedFile.name, { type: selectedFile.mimeType || 'application/pdf' });
        }
      }

      await uploadMutation.mutateAsync({
        venue_id: venueId,
        title: title.trim(),
        author_name: authorName.trim() || undefined,
        description: description.trim() || undefined,
        document_type: documentType,
        external_url: externalUrl.trim() || undefined,
        racing_area_id: selectedRacingAreaId || undefined,
        race_route_id: selectedRaceRouteId || undefined,
        file,
      });

      // Reset form
      setTitle('');
      setAuthorName('');
      setDescription('');
      setExternalUrl('');
      setSelectedFile(null);
      setDocumentType('pdf');
      setSelectedRacingAreaId(defaultRacingAreaId ?? null);
      setSelectedRaceRouteId(defaultRaceRouteId ?? null);

      onSuccess?.();
      onClose();
    } catch (error) {
      showAlert('Error', 'Failed to upload document. Please try again.');
      console.error('[DocumentUploader] Upload error:', error);
    }
  };

  const handleClose = () => {
    if (title.trim() || selectedFile || externalUrl.trim()) {
      showConfirm(
        'Discard draft?',
        'You have unsaved changes. Are you sure you want to close?',
        () => {
          setTitle('');
          setAuthorName('');
          setDescription('');
          setExternalUrl('');
          setSelectedFile(null);
          setDocumentType('pdf');
          setSelectedRacingAreaId(defaultRacingAreaId ?? null);
          setSelectedRaceRouteId(defaultRaceRouteId ?? null);
          onClose();
        },
        { destructive: true }
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Upload Document</ThemedText>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.headerButton, styles.uploadButton]}
            disabled={!title.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <ThemedText style={styles.uploadText}>Upload</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Venue Label */}
          <View style={styles.venueLabel}>
            <Ionicons name="location" size={16} color="#2563EB" />
            <ThemedText style={styles.venueName}>{venueName}</ThemedText>
          </View>

          {/* Racing Area Selector */}
          {racingItems.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionLabel}>Racing Area</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.locationScroll}
              >
                {/* All Areas Option */}
                <TouchableOpacity
                  style={[
                    styles.locationChip,
                    !selectedRacingAreaId && !selectedRaceRouteId && styles.locationChipActive,
                  ]}
                  onPress={() => {
                    setSelectedRacingAreaId(null);
                    setSelectedRaceRouteId(null);
                  }}
                >
                  <Ionicons
                    name="globe-outline"
                    size={16}
                    color={!selectedRacingAreaId && !selectedRaceRouteId ? '#2563EB' : '#6B7280'}
                  />
                  <ThemedText
                    style={[
                      styles.locationChipText,
                      !selectedRacingAreaId && !selectedRaceRouteId && styles.locationChipTextActive,
                    ]}
                  >
                    All {venueName}
                  </ThemedText>
                </TouchableOpacity>

                {/* Racing Areas and Routes */}
                {racingItems.map((item) => {
                  const isSelected = item.type === 'racing_area'
                    ? selectedRacingAreaId === item.id
                    : selectedRaceRouteId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.locationChip,
                        isSelected && styles.locationChipActive,
                      ]}
                      onPress={() => {
                        if (item.type === 'racing_area') {
                          setSelectedRacingAreaId(item.id);
                          setSelectedRaceRouteId(null);
                        } else {
                          setSelectedRaceRouteId(item.id);
                          setSelectedRacingAreaId(null);
                        }
                      }}
                    >
                      <Ionicons
                        name={item.type === 'racing_area' ? 'navigate-outline' : 'trail-sign-outline'}
                        size={16}
                        color={isSelected ? '#2563EB' : '#6B7280'}
                      />
                      <ThemedText
                        style={[
                          styles.locationChipText,
                          isSelected && styles.locationChipTextActive,
                        ]}
                      >
                        {item.name}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Document Type Selector */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Document Type</ThemedText>
            <View style={styles.typeSelector}>
              {documentTypes.map((type) => (
                <TouchableOpacity
                  key={type.type}
                  style={[
                    styles.typeOption,
                    documentType === type.type && styles.typeOptionActive,
                  ]}
                  onPress={() => setDocumentType(type.type)}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      documentType === type.type && styles.typeIconActive,
                    ]}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={documentType === type.type ? '#2563EB' : '#6B7280'}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.typeLabel,
                      documentType === type.type && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </ThemedText>
                  <ThemedText style={styles.typeDescription} numberOfLines={2}>
                    {type.description}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* File Picker (for PDF) */}
          {documentType === 'pdf' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionLabel}>Select File</ThemedText>
              <TouchableOpacity
                style={styles.filePicker}
                onPress={handlePickDocument}
              >
                {selectedFile ? (
                  <View style={styles.selectedFile}>
                    <Ionicons name="document-text" size={24} color="#2563EB" />
                    <View style={styles.fileInfo}>
                      <ThemedText style={styles.fileName} numberOfLines={1}>
                        {selectedFile.name}
                      </ThemedText>
                      <ThemedText style={styles.fileSize}>
                        {selectedFile.size ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedFile(null)}>
                      <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.filePickerEmpty}>
                    <Ionicons name="cloud-upload-outline" size={40} color="#9CA3AF" />
                    <ThemedText style={styles.filePickerText}>
                      Tap to select a PDF file
                    </ThemedText>
                    <ThemedText style={styles.filePickerHint}>
                      Max file size: 25MB
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* URL Input (for video/external) */}
          {(documentType === 'video_link' || documentType === 'external_url') && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionLabel}>
                {documentType === 'video_link' ? 'Video URL' : 'URL'}
              </ThemedText>
              <TextInput
                style={styles.urlInput}
                placeholder={
                  documentType === 'video_link'
                    ? 'https://youtube.com/watch?v=...'
                    : 'https://example.com/article'
                }
                placeholderTextColor="#9CA3AF"
                value={externalUrl}
                onChangeText={setExternalUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          )}

          {/* Title Input */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Title</ThemedText>
            <TextInput
              style={styles.titleInput}
              placeholder="E.g., Secrets of the Harbour"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          {/* Author Input */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Author (optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="E.g., Jamie McWilliam"
              placeholderTextColor="#9CA3AF"
              value={authorName}
              onChangeText={setAuthorName}
            />
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Description (optional)</ThemedText>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Brief description of what this document covers..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* AI Extraction Notice */}
          <View style={styles.aiNotice}>
            <Ionicons name="sparkles" size={20} color="#7C3AED" />
            <View style={styles.aiNoticeContent}>
              <ThemedText style={styles.aiNoticeTitle}>Extraction</ThemedText>
              <ThemedText style={styles.aiNoticeText}>
                After uploading, AI will automatically extract key insights like wind patterns, tide strategies, and local tips.
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  uploadButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    gap: 20,
  },
  venueLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  venueName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  locationScroll: {
    gap: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  locationChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  locationChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationChipTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  typeOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeIconActive: {
    backgroundColor: '#DBEAFE',
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  typeLabelActive: {
    color: '#2563EB',
  },
  typeDescription: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 14,
  },
  filePicker: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  filePickerEmpty: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  filePickerText: {
    fontSize: 15,
    color: '#6B7280',
  },
  filePickerHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  fileSize: {
    fontSize: 13,
    color: '#6B7280',
  },
  urlInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    fontWeight: '500',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 100,
    lineHeight: 22,
  },
  aiNotice: {
    flexDirection: 'row',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  aiNoticeContent: {
    flex: 1,
  },
  aiNoticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 4,
  },
  aiNoticeText: {
    fontSize: 13,
    color: '#6B21A8',
    lineHeight: 18,
  },
});
