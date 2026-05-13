/**
 * AddRaceModal Component
 * Simple race upload via text paste or document upload
 * AI extracts race details and saves to database
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { X, Upload, FileText, Sparkles } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { computeNextRegattaSortOrder } from '@/lib/utils/regattaSortOrder';
import { BoatSelector } from './BoatSelector';
import { createLogger } from '@/lib/utils/logger';

interface AddRaceModalProps {
  visible: boolean;
  onClose: () => void;
  onRaceAdded: () => void;
}

const logger = createLogger('AddRaceModal');
export function AddRaceModal({ visible, onClose, onRaceAdded }: AddRaceModalProps) {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState<'text' | 'document'>('text');
  const [selectedBoatId, setSelectedBoatId] = useState<string | undefined>();

  const handleTextExtraction = async () => {
    if (!inputText.trim() || !user) return;

    setIsProcessing(true);

    try {
      logger.debug('[AddRaceModal] Starting AI extraction...');

      const { data: extraction, error: extractionError } = await supabase.functions.invoke(
        'extract-race-details',
        { body: { text: inputText.trim() } }
      );

      if (extractionError) {
        throw new Error(extractionError.message || 'Failed to extract race details');
      }

      const extracted =
        (Array.isArray(extraction?.races) && extraction.races[0]) ||
        extraction?.data ||
        null;

      logger.debug('[AddRaceModal] Extraction result:', {
        hasExtracted: Boolean(extracted),
        overallConfidence: extraction?.overallConfidence,
      });

      if (!extracted) {
        showAlert(
          'Could Not Extract Race Details',
          'Please include race name, venue, and date in your text.',
        );
        setIsProcessing(false);
        return;
      }
      const extractedName = extracted.raceName || extracted.name || 'Untitled Race';
      const extractedVenue = extracted.venue || extracted.racingAreaName || 'Venue unavailable';
      const extractedDate = extracted.raceDate || extracted.date || new Date().toISOString().split('T')[0];

      // Save to Supabase - match actual schema with created_by field
      // sort_order = max + 1 so new regattas land at the end of the user's
      // manual order instead of jumping to the top via the default value of 0.
      const sortOrder = await computeNextRegattaSortOrder(user.id);
      const { data: _data, error } = await supabase.from('regattas').insert({
        created_by: user.id,
        name: extractedName,
        boat_id: selectedBoatId || null,
        location: null, // PostGIS geography type - set to null for now
        metadata: {
          venue_name: extractedVenue,
          wind: extracted.wind,
          tide: extracted.tide,
          strategy: extracted.strategy,
          critical_details: extracted.criticalDetails || extracted.critical_details,
          startTime: extracted.warningSignalTime || extracted.startTime || '10:00',
        },
        start_date: extractedDate,
        end_date: extractedDate, // Single day race by default
        status: 'planned', // Valid enum value: planned, active, completed, cancelled
        sort_order: sortOrder,
      });

      if (error) throw error;

      logger.debug('[AddRaceModal] Race saved successfully');

      // Clear input and close modal
      setInputText('');
      onRaceAdded();
      onClose();

      // Show success message (works better on web than Alert)
      setTimeout(() => {
        showAlert('Success', `Added: ${extractedName} at ${extractedVenue}`);
      }, 300);
    } catch (error: any) {
      logger.error('Error during text extraction flow', error);
      showAlert('Error', error.message || 'Failed to add race. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!user) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsProcessing(true);
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error('Selected document is missing a readable URI.');
      }

      const fileName = asset.name || 'race-document';
      const lowerName = fileName.toLowerCase();
      const mimeType =
        asset.mimeType ||
        (lowerName.endsWith('.pdf')
          ? 'application/pdf'
          : lowerName.endsWith('.txt')
            ? 'text/plain'
            : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
              ? 'image/jpeg'
              : lowerName.endsWith('.png')
                ? 'image/png'
                : 'application/pdf');

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data: extraction, error: extractionError } = await supabase.functions.invoke(
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
        throw new Error(extractionError.message || 'Failed to process document');
      }

      const extractedName =
        extraction?.courseName ||
        fileName.replace(/\.[^.]+$/, '') ||
        'Untitled Race';
      const extractedVenue =
        extraction?.courseDescription ||
        extraction?.venueName ||
        extraction?.venue ||
        'Venue unavailable';
      const inferredStartDate = new Date();
      inferredStartDate.setHours(inferredStartDate.getHours() + 24);
      const startDateIso = inferredStartDate.toISOString().split('T')[0];

      const sortOrder = await computeNextRegattaSortOrder(user.id);
      const { error: saveError } = await supabase.from('regattas').insert({
        created_by: user.id,
        name: extractedName,
        boat_id: selectedBoatId || null,
        location: null,
        metadata: {
          venue_name: extractedVenue,
          source_document: {
            name: fileName,
            mimeType,
          },
          extracted_waypoints: extraction?.waypoints || [],
          extracted_constraints: extraction?.constraints || [],
        },
        start_date: startDateIso,
        end_date: startDateIso,
        status: 'planned',
        sort_order: sortOrder,
      });

      if (saveError) throw saveError;

      onRaceAdded();
      onClose();
      setTimeout(() => {
        showAlert('Success', `Added: ${extractedName} (${extractedVenue})`);
      }, 250);
    } catch (error) {
      logger.error('Error picking document', error);
      showAlert(
        'Upload failed',
        error instanceof Error ? error.message : 'Failed to upload document.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-sky-600 pt-12 pb-4 px-4 flex-row items-center justify-between">
          <Text className="text-white text-2xl font-bold">Add Race</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        <View className="flex-row p-4 gap-2">
          <TouchableOpacity
            onPress={() => setUploadMode('text')}
            className={`flex-1 py-3 rounded-lg border-2 ${
              uploadMode === 'text'
                ? 'bg-sky-100 border-sky-600'
                : 'bg-gray-50 border-gray-300'
            }`}
          >
            <View className="flex-row items-center justify-center gap-2">
              <FileText
                size={20}
                color={uploadMode === 'text' ? '#0284c7' : '#6b7280'}
              />
              <Text
                className={`font-semibold ${
                  uploadMode === 'text' ? 'text-sky-900' : 'text-gray-600'
                }`}
              >
                Paste Text
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setUploadMode('document')}
            className={`flex-1 py-3 rounded-lg border-2 ${
              uploadMode === 'document'
                ? 'bg-sky-100 border-sky-600'
                : 'bg-gray-50 border-gray-300'
            }`}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Upload
                size={20}
                color={uploadMode === 'document' ? '#0284c7' : '#6b7280'}
              />
              <Text
                className={`font-semibold ${
                  uploadMode === 'document' ? 'text-sky-900' : 'text-gray-600'
                }`}
              >
                Upload File
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4">
          {uploadMode === 'text' ? (
            <>
              {/* Text Input Mode */}
              <View className="bg-sky-50 rounded-lg p-4 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={16} color="#0284c7" />
                  <Text className="text-sm font-semibold text-sky-900">
                    Race details extracted automatically
                  </Text>
                </View>
                <Text className="text-xs text-sky-700">
                  Paste race information, sailing instructions, or any text with race
                  details. Name, venue, date, and more are extracted automatically.
                </Text>
              </View>

              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Paste race details here... (e.g., Hong Kong Dragon Championship at RHKYC, October 15, 2025, First start 10:00)"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={12}
                className="bg-gray-100 rounded-lg p-4 text-base min-h-[300px]"
                textAlignVertical="top"
              />

              <Text className="text-xs text-gray-500 mt-2 mb-4">
                💡 Tip: Include race name, venue, date, and start time for best results
              </Text>

              {/* Boat Selection */}
              <View className="mb-4">
                <BoatSelector
                  selectedBoatId={selectedBoatId}
                  onSelect={setSelectedBoatId}
                  showQuickAdd={false}
                />
              </View>

              <TouchableOpacity
                onPress={handleTextExtraction}
                disabled={!inputText.trim() || isProcessing}
                className={`py-4 rounded-lg ${
                  inputText.trim() && !isProcessing
                    ? 'bg-sky-600'
                    : 'bg-gray-300'
                }`}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-base font-bold text-white">
                    Extract & Add Race
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Document Upload Mode */}
              <View className="bg-sky-50 rounded-lg p-4 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={16} color="#0284c7" />
                  <Text className="text-sm font-semibold text-sky-900">
                    Document Parsing
                  </Text>
                </View>
                <Text className="text-xs text-sky-700">
                  Upload sailing instructions (PDF), race documents, or photos. All race
                  details are parsed and extracted automatically.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleDocumentUpload}
                disabled={isProcessing}
                className="bg-sky-600 py-16 rounded-lg items-center justify-center border-2 border-dashed border-sky-400"
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" size="large" />
                ) : (
                  <>
                    <Upload size={48} color="white" />
                    <Text className="text-white font-bold text-lg mt-4">
                      Upload Document
                    </Text>
                    <Text className="text-sky-100 text-sm mt-2">
                      PDF, text file, or image
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text className="text-xs text-gray-500 mt-4 text-center">
                📄 Supported: PDF, TXT, JPG, PNG
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
