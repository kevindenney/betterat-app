/**
 * SSI Upload Section Component
 *
 * Reusable component for uploading Sailing Instructions documents
 * with AI extraction support. Includes privacy toggle and extraction progress.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSSIUpload } from '@/hooks/useSSIUpload';
import { SSIExtractionPreview } from './SSIExtractionPreview';
import type { SSIExtraction } from '@/types/ssi';

interface SSIUploadSectionProps {
  /** Club ID to associate with the document */
  clubId?: string;
  /** Race ID to associate with the document */
  raceId?: string;
  /** Title for the section */
  title?: string;
  /** Description text */
  description?: string;
  /** Whether to show the section header */
  showHeader?: boolean;
  /** Whether to show privacy toggle */
  showPrivacyToggle?: boolean;
  /** Default privacy setting */
  defaultIsShared?: boolean;
  /** Callback when extraction completes */
  onExtractionComplete?: (extraction: SSIExtraction) => void;
  /** Callback when document is uploaded */
  onDocumentUploaded?: (documentId: string) => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function SSIUploadSection({
  clubId,
  raceId,
  title = 'Sailing Instructions',
  description = 'Upload the SSI document to extract VHF channels, marks, and emergency contacts.',
  showHeader = true,
  showPrivacyToggle = true,
  defaultIsShared = false,
  onExtractionComplete,
  onDocumentUploaded,
  compact = false,
}: SSIUploadSectionProps) {
  const [isShared, setIsShared] = useState(defaultIsShared);

  const {
    upload,
    isUploading,
    documentId,
    extractionStatus,
    extractedData,
    error,
    reset,
  } = useSSIUpload({ clubId, raceId });

  // Handle extraction completion
  React.useEffect(() => {
    if (extractedData && onExtractionComplete) {
      onExtractionComplete(extractedData);
    }
  }, [extractedData, onExtractionComplete]);

  // Handle document upload completion
  React.useEffect(() => {
    if (documentId && onDocumentUploaded) {
      onDocumentUploaded(documentId);
    }
  }, [documentId, onDocumentUploaded]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      // For web, we need to fetch the file as a blob
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await upload(blob, asset.name, { isShared });
      } else {
        // For native, create a file object
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await upload(blob, asset.name, { isShared });
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  }, [upload, isShared]);

  const getStatusText = () => {
    switch (extractionStatus) {
      case 'pending':
        return 'Preparing extraction...';
      case 'processing':
        return 'Analyzing document...';
      case 'completed':
        return 'Extraction complete';
      case 'failed':
        return 'Extraction failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (extractionStatus) {
      case 'pending':
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Render extraction preview if completed
  if (extractedData) {
    return (
      <View className={compact ? '' : 'bg-white rounded-xl p-4'}>
        {showHeader && (
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              <Text className="text-base font-semibold text-gray-900">SSI Extracted</Text>
            </View>
            <TouchableOpacity
              onPress={reset}
              className="px-3 py-1 bg-gray-100 rounded-lg"
            >
              <Text className="text-sm text-gray-600">Upload New</Text>
            </TouchableOpacity>
          </View>
        )}
        <SSIExtractionPreview extraction={extractedData} compact={compact} />
      </View>
    );
  }

  // Render upload/progress state
  return (
    <View className={compact ? '' : 'bg-white rounded-xl p-4'}>
      {showHeader && (
        <View className="mb-3">
          <Text className="text-base font-semibold text-gray-900">{title}</Text>
          {description && !compact && (
            <Text className="text-sm text-gray-500 mt-1">{description}</Text>
          )}
        </View>
      )}

      {/* Upload button or progress */}
      {isUploading || extractionStatus ? (
        <View className="bg-blue-50 rounded-xl p-4 items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className={`mt-3 font-medium ${getStatusColor()}`}>
            {isUploading ? 'Uploading...' : getStatusText()}
          </Text>
          {extractionStatus === 'processing' && (
            <Text className="text-sm text-gray-500 mt-1 text-center">
              Extracting VHF channels, marks, and contacts...
            </Text>
          )}
        </View>
      ) : (
        <View>
          <TouchableOpacity
            onPress={handlePickDocument}
            className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl p-6 items-center active:bg-blue-100"
          >
            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mb-3">
              <Ionicons name="document-text" size={24} color="#3b82f6" />
            </View>
            <Text className="text-blue-600 font-semibold text-base">
              Upload SSI Document
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              PDF files only
            </Text>
          </TouchableOpacity>

          {/* Privacy toggle */}
          {showPrivacyToggle && clubId && (
            <TouchableOpacity
              onPress={() => setIsShared(!isShared)}
              className="flex-row items-center justify-between mt-4 py-3 px-4 bg-gray-50 rounded-lg"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name={isShared ? 'people' : 'lock-closed'}
                  size={20}
                  color={isShared ? '#3b82f6' : '#6b7280'}
                />
                <View>
                  <Text className="font-medium text-gray-900">
                    {isShared ? 'Shared with Club' : 'Private'}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {isShared
                      ? 'Other sailors at this club can use this SSI'
                      : 'Only you can see this document'}
                  </Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center ${
                  isShared ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white mx-1 ${
                    isShared ? 'self-end' : 'self-start'
                  }`}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error display */}
      {error && (
        <View className="bg-red-50 rounded-lg p-3 mt-3 flex-row items-start gap-2">
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <View className="flex-1">
            <Text className="text-red-700 font-medium">Upload Failed</Text>
            <Text className="text-red-600 text-sm mt-1">{error}</Text>
          </View>
          <TouchableOpacity onPress={reset}>
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
