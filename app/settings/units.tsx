import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserSettings, UnitSystem } from '@/hooks/useUserSettings';
import { useInterest } from '@/providers/InterestProvider';

interface UnitOptionProps {
  value: UnitSystem;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

const UnitOption: React.FC<UnitOptionProps> = ({
  label,
  description,
  selected,
  onSelect
}) => (
  <TouchableOpacity
    style={[styles.optionItem, selected && styles.optionItemSelected]}
    onPress={onSelect}
  >
    <View style={styles.optionContent}>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
      {selected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

const NAUTICAL_OPTION = {
  value: 'nautical' as UnitSystem,
  label: 'Nautical',
  description: 'Distance in nautical miles (nm), speed in knots (kts). Used in sailing and aviation.',
};

const BASE_UNIT_OPTIONS: { value: UnitSystem; label: string; description: string }[] = [
  {
    value: 'metric',
    label: 'Metric',
    description: 'Distance in kilometers (km), speed in km/h. Common in Europe and Asia.',
  },
  {
    value: 'imperial',
    label: 'Imperial',
    description: 'Distance in miles (mi), speed in mph. Common in the US and UK.',
  },
];

export default function UnitsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useUserSettings();
  const { currentInterest } = useInterest();

  // Nautical units are only meaningful for sailing/maritime interests. Show the
  // option when the active interest is sailing, or when it's the user's current
  // selection (so a prior choice stays visible/changeable from any interest).
  const interestSlug = String(currentInterest?.slug || '').toLowerCase();
  const isSailingInterest = interestSlug.includes('sail');
  const showNautical = isSailingInterest || settings.units === 'nautical';

  const unitOptions = showNautical
    ? [NAUTICAL_OPTION, ...BASE_UNIT_OPTIONS]
    : BASE_UNIT_OPTIONS;

  const handleSelect = async (value: UnitSystem) => {
    await updateSetting('units', value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Units of Measurement</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>SELECT UNIT SYSTEM</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {unitOptions.map((option) => (
            <UnitOption
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              selected={settings.units === option.value}
              onSelect={() => handleSelect(option.value)}
            />
          ))}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
          <Text style={styles.infoText}>
            This setting affects how distances and speeds are displayed throughout the app,
            including race data, weather forecasts, and venue information.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#EBF5FF',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#2563EB',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioOuterSelected: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  infoBox: {
    backgroundColor: '#EBF5FF',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
});
