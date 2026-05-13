/**
 * RaceDetailsStep Component
 *
 * Step 3 of AddRaceDialog: Fill in race details
 * Shows common fields + type-specific fields based on selected race type
 * Can be pre-filled with AI extracted data
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Calendar, Clock, MapPin, Radio, FileText, LucideIcon, Sparkles } from 'lucide-react-native';
import { Typography, Spacing, BorderRadius, colors } from '@/constants/designSystem';
import { RaceType, RACE_TYPE_COLORS, RaceTypeBadge } from '../RaceTypeSelector';
import { FleetRaceFields, FleetRaceData } from './FleetRaceFields';
import { DistanceRaceFields, DistanceRaceData } from './DistanceRaceFields';
import { MatchRaceFields, MatchRaceData } from './MatchRaceFields';
import { TeamRaceFields, TeamRaceData } from './TeamRaceFields';
import type { ExtractedRaceData, ExtractedField } from '../ExtractionResults';

// Common fields for all race types
export interface CommonRaceData {
  name: string;
  date: string;
  time: string;
  location: string;
  latitude?: number;
  longitude?: number;
  vhfChannel?: string;
  notes?: string;
}

// Combined form data with race type
export interface RaceFormData extends CommonRaceData {
  raceType: RaceType;
  // Type-specific fields (only one set will be present)
  fleet?: FleetRaceData;
  distance?: DistanceRaceData;
  match?: MatchRaceData;
  team?: TeamRaceData;
}

interface RaceDetailsStepProps {
  raceType: RaceType;
  onSave: (data: RaceFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  initialData?: ExtractedRaceData | null;
}

interface FormFieldConfig {
  key: keyof CommonRaceData;
  label: string;
  placeholder: string;
  icon: LucideIcon;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
}

const COMMON_FIELDS: FormFieldConfig[] = [
  {
    key: 'name',
    label: 'Race Name',
    placeholder: 'e.g., Croucher Series Race 3',
    icon: FileText,
    required: true,
  },
  {
    key: 'date',
    label: 'Date',
    placeholder: 'YYYY-MM-DD',
    icon: Calendar,
    required: true,
  },
  {
    key: 'time',
    label: 'Start Time',
    placeholder: 'HH:MM (24hr)',
    icon: Clock,
    required: true,
  },
  {
    key: 'location',
    label: 'Location',
    placeholder: 'e.g., Victoria Harbour',
    icon: MapPin,
    required: true,
  },
  {
    key: 'vhfChannel',
    label: 'VHF Channel',
    placeholder: 'e.g., 72',
    icon: Radio,
    keyboardType: 'numeric',
  },
];

// Helper to extract value from ExtractedField array by label
function getFieldValue(fields: ExtractedField[] | undefined, label: string): string {
  if (!fields) return '';
  const field = fields.find(f => f.label.toLowerCase().includes(label.toLowerCase()));
  return field?.value || '';
}

export function RaceDetailsStep({
  raceType,
  onSave,
  onCancel,
  isSaving,
  initialData,
}: RaceDetailsStepProps) {
  // Check if we have AI extracted data
  const hasAIData = Boolean(initialData);

  // Initialize state from AI data if available
  const initialCommonData = useMemo((): Partial<CommonRaceData> => {
    if (!initialData) return {};
    return {
      name: getFieldValue(initialData.basic, 'race name') || getFieldValue(initialData.basic, 'name'),
      date: getFieldValue(initialData.basic, 'date') || getFieldValue(initialData.timing, 'date'),
      time: getFieldValue(initialData.basic, 'start time') || getFieldValue(initialData.basic, 'time') || getFieldValue(initialData.timing, 'warning'),
      location: getFieldValue(initialData.basic, 'location') || getFieldValue(initialData.basic, 'venue'),
      vhfChannel: getFieldValue(initialData.basic, 'vhf'),
    };
  }, [initialData]);

  const initialTypeData = useMemo(() => {
    if (!initialData) return {};

    if (raceType === 'fleet') {
      return {
        courseType: getFieldValue(initialData.course, 'course type'),
        numberOfLaps: getFieldValue(initialData.course, 'laps'),
        expectedFleetSize: getFieldValue(initialData.course, 'fleet size'),
        boatClass: getFieldValue(initialData.course, 'boat class') || getFieldValue(initialData.course, 'class'),
      } as FleetRaceData;
    } else if (raceType === 'distance') {
      return {
        totalDistanceNm: getFieldValue(initialData.course, 'distance'),
        timeLimitHours: getFieldValue(initialData.course, 'time limit'),
        routeDescription: getFieldValue(initialData.course, 'route'),
        startFinishSameLocation: getFieldValue(initialData.course, 'start/finish').toLowerCase().includes('yes'),
      } as DistanceRaceData;
    } else if (raceType === 'match') {
      return {
        opponentName: getFieldValue(initialData.course, 'opponent'),
        matchRound: getFieldValue(initialData.course, 'round'),
        totalRounds: getFieldValue(initialData.course, 'total rounds'),
        seriesFormat: getFieldValue(initialData.course, 'series format') || getFieldValue(initialData.course, 'format'),
        hasUmpire: getFieldValue(initialData.course, 'umpire').toLowerCase().includes('yes'),
      } as MatchRaceData;
    } else if (raceType === 'team') {
      return {
        yourTeamName: getFieldValue(initialData.course, 'your team'),
        opponentTeamName: getFieldValue(initialData.course, 'opponent team'),
        heatNumber: getFieldValue(initialData.course, 'heat'),
        teamSize: getFieldValue(initialData.course, 'team size'),
        teamMembers: getFieldValue(initialData.course, 'members'),
      } as TeamRaceData;
    }

    return {};
  }, [initialData, raceType]);

  const [commonData, setCommonData] = useState<Partial<CommonRaceData>>(initialCommonData);
  const [typeSpecificData, setTypeSpecificData] = useState<
    FleetRaceData | DistanceRaceData | MatchRaceData | TeamRaceData
  >(initialTypeData);

  // Update state if initialData changes
  useEffect(() => {
    if (initialData) {
      setCommonData(initialCommonData);
      setTypeSpecificData(initialTypeData);
    }
  }, [initialData, initialCommonData, initialTypeData]);

  const typeColors = RACE_TYPE_COLORS[raceType];

  const updateCommonField = useCallback((key: keyof CommonRaceData, value: string) => {
    setCommonData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateTypeSpecificData = useCallback((data: Partial<FleetRaceData | DistanceRaceData | MatchRaceData | TeamRaceData>) => {
    setTypeSpecificData((prev) => ({ ...prev, ...data }));
  }, []);

  const isFormValid = useCallback(() => {
    const requiredFields = COMMON_FIELDS.filter((f) => f.required);
    const hasAllRequired = requiredFields.every((f) => commonData[f.key]?.trim());

    // Check type-specific required fields
    if (raceType === 'match') {
      const matchData = typeSpecificData as MatchRaceData;
      if (!matchData.opponentName?.trim()) return false;
    }
    if (raceType === 'team') {
      const teamData = typeSpecificData as TeamRaceData;
      if (!teamData.yourTeamName?.trim() || !teamData.opponentTeamName?.trim()) return false;
    }

    return hasAllRequired;
  }, [commonData, typeSpecificData, raceType]);

  const handleSave = useCallback(async () => {
    if (!isFormValid()) return;

    const formData: RaceFormData = {
      name: commonData.name || '',
      date: commonData.date || '',
      time: commonData.time || '',
      location: commonData.location || '',
      vhfChannel: commonData.vhfChannel,
      notes: commonData.notes,
      raceType,
      [raceType]: typeSpecificData,
    };

    await onSave(formData);
  }, [commonData, typeSpecificData, raceType, onSave, isFormValid]);

  const renderField = (field: FormFieldConfig) => {
    const IconComponent = field.icon;
    return (
      <View key={field.key} style={styles.field}>
        <View style={styles.fieldHeader}>
          <IconComponent size={16} color={colors.text.secondary} />
          <Text style={styles.fieldLabel}>
            {field.label}
            {field.required && <Text style={styles.requiredStar}> *</Text>}
          </Text>
        </View>
        <TextInput
          style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
          value={commonData[field.key] || ''}
          onChangeText={(value) => updateCommonField(field.key, value)}
          placeholder={field.placeholder}
          placeholderTextColor={colors.text.tertiary}
          multiline={field.multiline}
          numberOfLines={field.multiline ? 3 : 1}
          textAlignVertical={field.multiline ? 'top' : 'center'}
          keyboardType={field.keyboardType}
        />
      </View>
    );
  };

  const renderTypeSpecificFields = () => {
    switch (raceType) {
      case 'fleet':
        return (
          <FleetRaceFields
            data={typeSpecificData as FleetRaceData}
            onChange={updateTypeSpecificData}
          />
        );
      case 'distance':
        return (
          <DistanceRaceFields
            data={typeSpecificData as DistanceRaceData}
            onChange={updateTypeSpecificData}
          />
        );
      case 'match':
        return (
          <MatchRaceFields
            data={typeSpecificData as MatchRaceData}
            onChange={updateTypeSpecificData}
          />
        );
      case 'team':
        return (
          <TeamRaceFields
            data={typeSpecificData as TeamRaceData}
            onChange={updateTypeSpecificData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Race type badge and AI indicator */}
        <View style={styles.typeBadgeContainer}>
          <RaceTypeBadge type={raceType} />
          {hasAIData && (
            <View style={styles.aiExtractedBadge}>
              <Sparkles size={12} color={colors.ai[600]} />
              <Text style={styles.aiExtractedText}>Extracted</Text>
            </View>
          )}
        </View>

        {/* AI notice */}
        {hasAIData && (
          <View style={styles.aiNotice}>
            <Text style={styles.aiNoticeText}>
              Review the extracted data below and make any corrections before saving.
            </Text>
          </View>
        )}

        {/* Common fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Information</Text>
          <View style={styles.fieldsContainer}>
            {COMMON_FIELDS.map(renderField)}
          </View>
        </View>

        {/* Type-specific fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {raceType.charAt(0).toUpperCase() + raceType.slice(1)} Racing Details
          </Text>
          {renderTypeSpecificFields()}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={isSaving}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: typeColors.primary },
            (!isFormValid() || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isFormValid() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Race</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  typeBadgeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  aiExtractedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ai[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    borderColor: colors.ai[200],
  },
  aiExtractedText: {
    ...Typography.caption,
    color: colors.ai[700],
    fontWeight: '600',
    fontSize: 11,
  },
  aiNotice: {
    backgroundColor: colors.ai[50],
    borderRadius: BorderRadius.small,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.ai[500],
  },
  aiNoticeText: {
    ...Typography.caption,
    color: colors.ai[700],
    lineHeight: 18,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.captionBold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  fieldsContainer: {
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  requiredStar: {
    color: colors.danger[600],
  },
  fieldInput: {
    ...Typography.body,
    backgroundColor: colors.background.secondary,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: Spacing.sm,
    color: colors.text.primary,
  },
  fieldInputMultiline: {
    minHeight: 80,
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...Typography.bodyBold,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
});

export default RaceDetailsStep;
