/**
 * PDF Text Preview Component
 * Shows extracted text before AI processing
 * Allows user to verify extraction quality
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { CheckCircle, Edit, AlertCircle } from 'lucide-react-native';

interface PDFTextPreviewProps {
  text: string;
  fileName?: string;
  pages?: number;
  onApprove: () => void;
  onEdit?: (editedText: string) => void;
  onCancel: () => void;
}

export const PDFTextPreview: React.FC<PDFTextPreviewProps> = ({
  text,
  fileName,
  pages,
  onApprove,
  onEdit,
  onCancel,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate text statistics
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  const previewLength = 500;
  const previewText = text.substring(0, previewLength);
  const hasMore = text.length > previewLength;

  return (
    <View className="bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header */}
      <View className="border-b border-gray-200 p-4">
        <View className="flex-row items-center mb-2">
          <View className="bg-green-100 p-2 rounded-full">
            <CheckCircle color="#10B981" size={20} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-800 font-bold text-lg">Text Extracted Successfully</Text>
            {fileName && (
              <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
                {fileName}
              </Text>
            )}
          </View>
        </View>

        {/* Statistics */}
        <View className="flex-row mt-3 space-x-4">
          {pages && (
            <View className="bg-blue-50 px-3 py-2 rounded-lg">
              <Text className="text-blue-600 text-xs font-bold">{pages} Pages</Text>
            </View>
          )}
          <View className="bg-blue-50 px-3 py-2 rounded-lg">
            <Text className="text-blue-600 text-xs font-bold">{wordCount.toLocaleString()} Words</Text>
          </View>
          <View className="bg-blue-50 px-3 py-2 rounded-lg">
            <Text className="text-blue-600 text-xs font-bold">{charCount.toLocaleString()} Chars</Text>
          </View>
        </View>
      </View>

      {/* Text Preview */}
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-gray-700 font-bold">Extracted Text:</Text>
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Text className="text-blue-600 text-sm font-bold">
              {isExpanded ? 'Show Less' : 'Show All'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          style={{ maxHeight: isExpanded ? 400 : 200 }}
          nestedScrollEnabled={true}
        >
          <Text className="text-gray-700 text-sm leading-6">
            {isExpanded ? text : previewText}
            {!isExpanded && hasMore && (
              <Text className="text-gray-400">... (tap "Show All" to see more)</Text>
            )}
          </Text>
        </ScrollView>

        {/* Quality Check Info */}
        <View className="flex-row items-start mt-3 bg-blue-50 p-3 rounded-lg">
          <AlertCircle color="#007AFF" size={18} />
          <Text className="text-blue-900 text-xs ml-2 flex-1">
            Please review the extracted text to ensure accuracy. You can edit it before AI processing if needed.
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="border-t border-gray-200 p-4">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
            onPress={onCancel}
          >
            <Text className="text-gray-700 font-bold">Cancel</Text>
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity
              className="flex-1 bg-blue-100 rounded-xl py-3 items-center flex-row justify-center"
              onPress={() => {
                // In a real implementation, this would open an editing modal
                onEdit(text);
              }}
            >
              <Edit color="#007AFF" size={18} />
              <Text className="text-blue-600 font-bold ml-2">Edit Text</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="flex-1 bg-blue-600 rounded-xl py-3 items-center flex-row justify-center"
            onPress={onApprove}
          >
            <CheckCircle color="white" size={18} />
            <Text className="text-white font-bold ml-2">Process</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
