/**
 * Quick Paste Options
 * Collapsible structured paste fields for power users
 * Inspired by the screenshot pattern
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, BarChart3, FileText, Image } from 'lucide-react-native';

interface QuickPasteOptionsProps {
  onPasteCalendar?: (csvData: string) => void;
  onPasteSINOR?: (text: string) => void;
  onPasteImageURL?: (url: string) => void;
  collapsed?: boolean;
}

export function QuickPasteOptions({
  onPasteCalendar,
  onPasteSINOR,
  onPasteImageURL,
  collapsed: initialCollapsed = true,
}: QuickPasteOptionsProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [calendarData, setCalendarData] = useState('');
  const [sinorText, setSinorText] = useState('');
  const [imageURL, setImageURL] = useState('');

  const handlePasteCalendar = () => {
    if (calendarData.trim()) {
      onPasteCalendar?.(calendarData);
      setCalendarData('');
    }
  };

  const handlePasteSINOR = () => {
    if (sinorText.trim()) {
      onPasteSINOR?.(sinorText);
      setSinorText('');
    }
  };

  const handlePasteImageURL = () => {
    if (imageURL.trim()) {
      onPasteImageURL?.(imageURL);
      setImageURL('');
    }
  };

  return (
    <View className="border border-purple-200 bg-purple-50 rounded-lg overflow-hidden">
      {/* Header */}
      <TouchableOpacity
        onPress={() => setIsCollapsed(!isCollapsed)}
        className="flex-row items-center justify-between p-4"
      >
        <View>
          <Text className="text-base font-semibold text-purple-900">
            📋 Quick Paste Options
          </Text>
          <Text className="text-xs text-purple-700 mt-1">
            Paste calendar data, SI/NOR text, or upload race area images directly
          </Text>
        </View>
        {isCollapsed ? (
          <ChevronDown size={20} color="#6b21a8" />
        ) : (
          <ChevronUp size={20} color="#6b21a8" />
        )}
      </TouchableOpacity>

      {/* Content */}
      {!isCollapsed && (
        <View className="p-4 pt-0 space-y-4">
          {/* Racing Calendar Paste */}
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <BarChart3 size={16} color="#7c3aed" />
              <Text className="text-sm font-semibold text-purple-900">
                📊 Paste Racing Calendar (CSV/Table)
              </Text>
            </View>
            <Text className="text-xs text-purple-700 mb-2">
              Copy/paste from Excel, Google Sheets, or CSV racing calendar
            </Text>
            <TextInput
              value={calendarData}
              onChangeText={setCalendarData}
              placeholder="Croucher 1 & 2    27/09/2025 Port Shelter TRUE   FALSE
Race Management 04/10/2025    TRUE  FALSE
Race Management 05/10/2025    TRUE  FALSE"
              multiline
              numberOfLines={4}
              className="bg-white border border-purple-300 rounded-lg p-3 text-sm text-gray-900 min-h-[100px]"
              placeholderTextColor="#9ca3af"
              textAlignVertical="top"
            />
            {calendarData.trim().length > 0 && (
              <TouchableOpacity
                onPress={handlePasteCalendar}
                className="mt-2 bg-purple-600 rounded-lg p-2"
              >
                <Text className="text-center text-sm font-medium text-white">
                  Extract Calendar
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SIs/NORs Text Paste */}
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <FileText size={16} color="#7c3aed" />
              <Text className="text-sm font-semibold text-purple-900">
                📄 Paste SIs/NORs Text
              </Text>
            </View>
            <Text className="text-xs text-purple-700 mb-2">
              Copy/paste Sailing Instructions or Notice of Race text for analysis
            </Text>
            <TextInput
              value={sinorText}
              onChangeText={setSinorText}
              placeholder="liability for material
damage or personal injury or death sustained in conjunction with or prior to, during, or after the event.
21. INSURANCE
All boats taking part in the event shall be insured with valid third-party liability insurance of at least the minimum
cover required by HKSAR law."
              multiline
              numberOfLines={6}
              className="bg-white border border-purple-300 rounded-lg p-3 text-sm text-gray-900 min-h-[140px]"
              placeholderTextColor="#9ca3af"
              textAlignVertical="top"
            />
            {sinorText.trim().length > 0 && (
              <TouchableOpacity
                onPress={handlePasteSINOR}
                className="mt-2 bg-purple-600 rounded-lg p-2"
              >
                <Text className="text-center text-sm font-medium text-white">
                  Analyze Document
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Race Area Image URL */}
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <Image size={16} color="#7c3aed" />
              <Text className="text-sm font-semibold text-purple-900">
                🗺️ Race Area Image URL
              </Text>
            </View>
            <Text className="text-xs text-purple-700 mb-2">
              Paste link to course map, race area diagram, or aerial photo
            </Text>
            <TextInput
              value={imageURL}
              onChangeText={setImageURL}
              placeholder="https://www.rhkyc.org.hk/storage/app/media/Sailing/race-management/Standard%20Sailing%20Instructions.pdf"
              className="bg-white border border-purple-300 rounded-lg p-3 text-sm text-gray-900"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {imageURL.trim().length > 0 && (
              <TouchableOpacity
                onPress={handlePasteImageURL}
                className="mt-2 bg-purple-600 rounded-lg p-2"
              >
                <Text className="text-center text-sm font-medium text-white">
                  Process Image/Document
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default QuickPasteOptions;
