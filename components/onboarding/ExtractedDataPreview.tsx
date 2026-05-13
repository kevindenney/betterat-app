/**
 * Extracted Data Preview
 * Shows AI-extracted entities with inline verification and editing
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Edit2, Anchor, MapPin, Users, Calendar, FileText } from 'lucide-react-native';

export interface ExtractedEntity {
  type: 'boat' | 'club' | 'venue' | 'race' | 'document';
  label: string;
  value: string;
  confidence?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

interface ExtractedDataPreviewProps {
  entities: ExtractedEntity[];
  onConfirm: (entities: ExtractedEntity[]) => void;
  onReject: () => void;
  onEdit?: (index: number, newValue: string) => void;
}

export function ExtractedDataPreview({
  entities,
  onConfirm,
  onReject,
  onEdit,
}: ExtractedDataPreviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedEntities, setEditedEntities] = useState<ExtractedEntity[]>(entities);

  const getIcon = (type: ExtractedEntity['type']) => {
    switch (type) {
      case 'boat':
        return <Anchor size={16} color="#0284c7" />;
      case 'club':
        return <Users size={16} color="#0284c7" />;
      case 'venue':
        return <MapPin size={16} color="#0284c7" />;
      case 'race':
        return <Calendar size={16} color="#0284c7" />;
      case 'document':
        return <FileText size={16} color="#0284c7" />;
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;

    const colors = {
      high: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-red-100 text-red-700',
    };

    return (
      <View className={`px-2 py-0.5 rounded-full ${colors[confidence as keyof typeof colors]}`}>
        <Text className={`text-xs font-medium ${colors[confidence as keyof typeof colors]}`}>
          {confidence}
        </Text>
      </View>
    );
  };

  const handleEdit = (index: number, newValue: string) => {
    const updated = [...editedEntities];
    updated[index].value = newValue;
    setEditedEntities(updated);
    onEdit?.(index, newValue);
  };

  const handleConfirm = () => {
    onConfirm(editedEntities);
  };

  if (entities.length === 0) return null;

  return (
    <View className="mt-4 bg-sky-50 border border-sky-200 rounded-lg p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-sky-900">Detected:</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onReject}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-md"
          >
            <Text className="text-xs font-medium text-gray-700">Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirm}
            className="px-3 py-1.5 bg-sky-600 rounded-md"
          >
            <Text className="text-xs font-medium text-white">✓ Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Entities List */}
      <View className="space-y-2">
        {editedEntities.map((entity, index) => (
          <View
            key={index}
            className="flex-row items-center justify-between bg-white rounded-md p-3 border border-gray-200"
          >
            {/* Icon & Label */}
            <View className="flex-row items-center gap-2 flex-1">
              {getIcon(entity.type)}
              <View className="flex-1">
                <Text className="text-xs text-gray-500">{entity.label}</Text>
                {editingIndex === index ? (
                  <TextInput
                    value={entity.value}
                    onChangeText={(text) => handleEdit(index, text)}
                    onBlur={() => setEditingIndex(null)}
                    autoFocus
                    className="text-sm font-medium text-gray-900 border-b border-sky-600 mt-1"
                  />
                ) : (
                  <Text className="text-sm font-medium text-gray-900">{entity.value}</Text>
                )}
              </View>
            </View>

            {/* Confidence & Edit */}
            <View className="flex-row items-center gap-2">
              {getConfidenceBadge(entity.confidence)}
              <TouchableOpacity onPress={() => setEditingIndex(index)}>
                <Edit2 size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Metadata Display (if any) */}
      {entities.some(e => e.metadata && Object.keys(e.metadata).length > 0) && (
        <View className="mt-3 pt-3 border-t border-sky-200">
          <Text className="text-xs text-gray-600">
            Additional info: {JSON.stringify(entities[0].metadata, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default ExtractedDataPreview;
