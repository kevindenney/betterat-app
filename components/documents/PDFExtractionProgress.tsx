/**
 * PDF Extraction Progress Component
 * Shows real-time progress during PDF text extraction
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { FileText } from 'lucide-react-native';

interface PDFExtractionProgressProps {
  progress: number;
  currentPage: number;
  totalPages: number;
  fileName?: string;
}

export const PDFExtractionProgress: React.FC<PDFExtractionProgressProps> = ({
  progress,
  currentPage,
  totalPages,
  fileName,
}) => {
  return (
    <View className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <View className="bg-blue-100 p-3 rounded-full">
          <FileText color="#007AFF" size={24} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-gray-800 font-bold text-lg">Extracting PDF Text</Text>
          {fileName && (
            <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
              {fileName}
            </Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View className="mb-4">
        <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-gray-600 text-sm">
            Page {currentPage} of {totalPages}
          </Text>
          <Text className="text-blue-600 text-sm font-bold">
            {Math.round(progress)}%
          </Text>
        </View>
      </View>

      {/* Loading Indicator */}
      <View className="flex-row items-center justify-center pt-2">
        <ActivityIndicator size="small" color="#007AFF" />
        <Text className="text-gray-600 text-sm ml-2">
          Processing page content...
        </Text>
      </View>
    </View>
  );
};
