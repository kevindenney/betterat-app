/**
 * Regulatory Digest Card
 *
 * Displays Notice of Race digest information with acknowledgement checkboxes.
 * Used in the races screen to show regulatory compliance items.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RegulatoryDigestData, RegulatoryAcknowledgements } from '@/lib/races';

export interface RegulatoryDigestCardProps {
  /** Regulatory digest data from NOR extraction */
  digest: RegulatoryDigestData;
  /** User acknowledgements state */
  acknowledgements: RegulatoryAcknowledgements;
  /** Callback when an acknowledgement is toggled */
  onToggle: (key: keyof RegulatoryAcknowledgements) => void;
}

/**
 * Acknowledgement Row Sub-component
 */
function AcknowledgementRow({
  label,
  description,
  checked,
  onPress,
}: {
  label: string;
  description: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-start gap-3 mt-3"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <MaterialCommunityIcons
        name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
        size={20}
        color={checked ? '#007AFF' : '#CBD5F5'}
      />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-slate-800">{label}</Text>
        <Text className="text-[11px] text-slate-500 mt-1">{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Regulatory Digest Card Component
 */
export function RegulatoryDigestCard({
  digest,
  acknowledgements,
  onToggle,
}: RegulatoryDigestCardProps) {
  const ackItems: {
    key: keyof RegulatoryAcknowledgements;
    label: string;
    description: string;
  }[] = [
    {
      key: 'cleanRegatta',
      label: 'Clean Regatta commitments noted',
      description: digest.cleanRegatta
        ? 'Event flagged as Sailors for the Sea Clean Regatta.'
        : 'Not designated Clean Regatta.',
    },
    {
      key: 'signOn',
      label: 'Sign-on window understood',
      description: digest.signOnWindow,
    },
    {
      key: 'safetyBriefing',
      label: 'Safety briefing complete',
      description: 'Required video briefing and quiz submitted in SailSys.',
    },
  ];

  return (
    <View className="bg-white border border-purple-200 rounded-2xl p-4 mb-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-base font-semibold text-purple-900">
            Notice of Race Digest
          </Text>
          <Text className="text-xs text-purple-600 mt-1">
            {digest.seriesName} • {digest.venueArea}
          </Text>
        </View>
        <Text className="text-[10px] font-semibold text-purple-500">
          {digest.reference}
        </Text>
      </View>

      <View className="mt-3">
        <Text className="text-sm font-semibold text-slate-900">
          Entry &amp; Compliance
        </Text>
        {digest.entryNotes.map((note, index) => (
          <View
            key={`${note}-${index}`}
            className="flex-row items-start gap-2 mt-2"
          >
            <View className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1" />
            <Text className="text-xs text-slate-700 flex-1">{note}</Text>
          </View>
        ))}
      </View>

      <View className="mt-3">
        <Text className="text-sm font-semibold text-slate-900">
          Acknowledgements
        </Text>
        {ackItems.map((item) => (
          <AcknowledgementRow
            key={item.key}
            label={item.label}
            description={item.description}
            checked={acknowledgements[item.key]}
            onPress={() => onToggle(item.key)}
          />
        ))}
      </View>

      <View className="mt-4">
        <Text className="text-sm font-semibold text-slate-900">
          Course Selection
        </Text>
        <Text className="text-xs text-slate-600 mt-1">
          {digest.courseSelection}
        </Text>
      </View>

      <View className="mt-4">
        <Text className="text-sm font-semibold text-slate-900">Safety Notes</Text>
        {digest.safetyNotes.map((note, index) => (
          <View
            key={`${note}-${index}`}
            className="flex-row items-start gap-2 mt-2"
          >
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={16}
              color="#F97316"
            />
            <Text className="text-xs text-slate-700 flex-1">{note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default RegulatoryDigestCard;
