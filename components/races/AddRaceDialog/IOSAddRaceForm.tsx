/**
 * IOSAddRaceForm Component
 *
 * Apple Human Interface Guidelines compliant Add Race form.
 * Features:
 * - iOS-style modal header with Cancel/Save
 * - Inset grouped list sections
 * - Native-feeling form controls
 * - System colors and typography
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  MapPin,
  Calendar,
  Sailboat,
  Route,
  Trophy,
  Users,
  Sparkles,
  Check,
} from 'lucide-react-native';
import { format, addDays } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerHaptic } from '@/lib/haptics';

import { LocationMapPicker } from '../LocationMapPicker';
import { ExtractedDetailsSummary } from './ExtractedDetailsSummary';
import { UnifiedDocumentInput } from '@/components/documents/UnifiedDocumentInput';
import { SeasonSettingsModal } from '@/components/seasons/SeasonSettingsModal';
import { useCurrentSeason } from '@/hooks/useSeason';
import type { RaceType } from '../RaceTypeSelector';
import type { RaceFormData } from './RaceDetailsStep';
import type { FleetRaceData } from './FleetRaceFields';
import type { DistanceRaceData } from './DistanceRaceFields';
import type { MatchRaceData } from './MatchRaceFields';
import type { TeamRaceData } from './TeamRaceFields';
import type { MultiRaceExtractedData } from '../AIValidationScreen';
import { MultiRaceSelectionScreen } from '../MultiRaceSelectionScreen';
import { createLogger } from '@/lib/utils/logger';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// IOS DESIGN TOKENS
// =============================================================================

const IOS = {
  colors: {
    // System colors
    blue: '#007AFF',
    green: '#34C759',
    orange: '#FF9500',
    red: '#FF3B30',
    purple: '#AF52DE',
    teal: '#5AC8FA',

    // Labels
    label: '#000000',
    secondaryLabel: 'rgba(60, 60, 67, 0.6)',
    tertiaryLabel: 'rgba(60, 60, 67, 0.3)',

    // Backgrounds
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    tertiarySystemBackground: '#FFFFFF',
    systemGroupedBackground: '#F2F2F7',
    secondarySystemGroupedBackground: '#FFFFFF',

    // Separators
    separator: 'rgba(60, 60, 67, 0.29)',
    opaqueSeparator: '#C6C6C8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 12,
  },
  typography: {
    largeTitle: { fontSize: 34, fontWeight: '700' as const },
    title1: { fontSize: 28, fontWeight: '700' as const },
    title2: { fontSize: 22, fontWeight: '700' as const },
    title3: { fontSize: 20, fontWeight: '600' as const },
    headline: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 17, fontWeight: '400' as const },
    callout: { fontSize: 16, fontWeight: '400' as const },
    subhead: { fontSize: 15, fontWeight: '400' as const },
    footnote: { fontSize: 13, fontWeight: '400' as const },
    caption1: { fontSize: 12, fontWeight: '400' as const },
    caption2: { fontSize: 11, fontWeight: '400' as const },
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface IOSAddRaceFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: RaceFormData) => Promise<void>;
}

interface FormState {
  raceType: RaceType;
  name: string;
  date: string;
  time: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  vhfChannel: string;
  notes: string;
  marks: any[];
  routeWaypoints: any[];
  racingAreaPolygon: any[];
  fleet: FleetRaceData;
  distance: DistanceRaceData;
  match: MatchRaceData;
  team: TeamRaceData;
}

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY_LAST_LOCATION = '@regattaflow/lastRaceLocation';
const logger = createLogger('IOSAddRaceForm');

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/** iOS-style section header */
const SectionHeader: React.FC<{ children: string; first?: boolean }> = ({ children, first }) => (
  <Text style={[styles.sectionHeader, first && styles.sectionHeaderFirst]}>
    {children.toUpperCase()}
  </Text>
);

/** iOS-style inset grouped container */
const GroupedSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.groupedSection}>
    {children}
  </View>
);

/** iOS-style list row */
const ListRow: React.FC<{
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  showChevron?: boolean;
  required?: boolean;
  isLast?: boolean;
  trailing?: React.ReactNode;
}> = ({ label, value, placeholder, onPress, icon, showChevron = true, required, isLast, trailing }) => (
  <Pressable
    style={({ pressed }) => [
      styles.listRow,
      !isLast && styles.listRowBorder,
      pressed && onPress && styles.listRowPressed,
    ]}
    onPress={onPress}
    disabled={!onPress}
  >
    {icon && <View style={styles.listRowIcon}>{icon}</View>}
    <View style={styles.listRowContent}>
      <Text style={styles.listRowLabel}>
        {label}
        {required && <Text style={styles.requiredStar}> *</Text>}
      </Text>
      {value ? (
        <Text style={styles.listRowValue} numberOfLines={1}>{value}</Text>
      ) : placeholder ? (
        <Text style={styles.listRowPlaceholder} numberOfLines={1}>{placeholder}</Text>
      ) : null}
    </View>
    {trailing}
    {showChevron && onPress && (
      <ChevronRight size={20} color={IOS.colors.tertiaryLabel} />
    )}
  </Pressable>
);

/** iOS-style text input row */
const InputRow: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  isLast?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoFocus?: boolean;
  error?: string;
  aiExtracted?: boolean;
}> = ({ label, value, onChangeText, placeholder, required, isLast, keyboardType, autoFocus, error, aiExtracted }) => {
  return (
    <View style={[styles.inputRow, !isLast && styles.listRowBorder]}>
      <Text style={styles.inputLabel}>
        {label}
        {required && <Text style={styles.requiredStar}> *</Text>}
      </Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={IOS.colors.tertiaryLabel}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
        />
        {aiExtracted && (
          <View style={styles.aiIndicator}>
            <Sparkles size={12} color={IOS.colors.purple} />
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

/** iOS-style race type selector */
const RaceTypeSelector: React.FC<{
  selected: RaceType;
  onSelect: (type: RaceType) => void;
}> = ({ selected, onSelect }) => {
  const types: { type: RaceType; label: string; icon: React.ReactNode }[] = [
    { type: 'fleet', label: 'Fleet', icon: <Sailboat size={24} color={selected === 'fleet' ? IOS.colors.blue : IOS.colors.secondaryLabel} /> },
    { type: 'distance', label: 'Distance', icon: <Route size={24} color={selected === 'distance' ? IOS.colors.purple : IOS.colors.secondaryLabel} /> },
    { type: 'match', label: 'Match', icon: <Trophy size={24} color={selected === 'match' ? IOS.colors.orange : IOS.colors.secondaryLabel} /> },
    { type: 'team', label: 'Team', icon: <Users size={24} color={selected === 'team' ? IOS.colors.green : IOS.colors.secondaryLabel} /> },
  ];

  return (
    <View style={styles.raceTypeContainer}>
      {types.map(({ type, label, icon }) => {
        const isSelected = selected === type;
        const color = type === 'fleet' ? IOS.colors.blue
          : type === 'distance' ? IOS.colors.purple
          : type === 'match' ? IOS.colors.orange
          : IOS.colors.green;

        return (
          <Pressable
            key={type}
            style={[
              styles.raceTypeButton,
              isSelected && [styles.raceTypeButtonSelected, { borderColor: color }],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              onSelect(type);
            }}
          >
            {icon}
            <Text style={[
              styles.raceTypeLabel,
              isSelected && { color, fontWeight: '600' },
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function IOSAddRaceForm({ visible, onClose, onSave }: IOSAddRaceFormProps) {
  // Form state
  const [formState, setFormState] = useState<FormState>(() => ({
    raceType: 'fleet',
    name: '',
    date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    time: '14:00',
    location: '',
    latitude: null,
    longitude: null,
    vhfChannel: '',
    notes: '',
    marks: [],
    routeWaypoints: [],
    racingAreaPolygon: [],
    fleet: {},
    distance: {},
    match: {},
    team: {},
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiExtractedFields, setAiExtractedFields] = useState<Set<string>>(new Set());
  const [extractedDetailsData, setExtractedDetailsData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [documentInputKey, setDocumentInputKey] = useState(0);
  const [showMultiRaceModal, setShowMultiRaceModal] = useState(false);
  const [multiRaceData, _setMultiRaceData] = useState<MultiRaceExtractedData | null>(null);
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([]);
  const [showAISection, setShowAISection] = useState(true);
  const [showSeasonModal, setShowSeasonModal] = useState(false);

  // Current season
  const { data: currentSeason } = useCurrentSeason();

  // Validation
  const isFormValid = useMemo(() => {
    return formState.name.trim() !== '' &&
           formState.date.trim() !== '' &&
           formState.time.trim() !== '' &&
           formState.location.trim() !== '';
  }, [formState]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setFormState({
        raceType: 'fleet',
        name: '',
        date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        time: '14:00',
        location: '',
        latitude: null,
        longitude: null,
        vhfChannel: '',
        notes: '',
        marks: [],
        routeWaypoints: [],
        racingAreaPolygon: [],
        fleet: {},
        distance: {},
        match: {},
        team: {},
      });
      setErrors({});
      setAiExtractedFields(new Set());
      setExtractedDetailsData(null);
      setDocumentInputKey(prev => prev + 1);
      setShowAISection(true);
    }
  }, [visible]);

  // Handlers
  const handleFieldChange = useCallback((field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  const handleAIExtracted = useCallback((data: any, rawData?: any) => {
    const extractedFields = new Set<string>();

    if (data.name) {
      setFormState(prev => ({ ...prev, name: data.name }));
      extractedFields.add('name');
    }
    if (data.date) {
      setFormState(prev => ({ ...prev, date: data.date }));
      extractedFields.add('date');
    }
    if (data.startTime) {
      setFormState(prev => ({ ...prev, time: data.startTime }));
      extractedFields.add('time');
    }
    if (data.venue || data.location) {
      setFormState(prev => ({ ...prev, location: data.venue || data.location }));
      extractedFields.add('location');
    }
    if (data.vhfChannel) {
      setFormState(prev => ({ ...prev, vhfChannel: data.vhfChannel }));
      extractedFields.add('vhfChannel');
    }

    setAiExtractedFields(extractedFields);
    setExtractedDetailsData(rawData || data);

    // Collapse AI section after successful extraction
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAISection(false);

    triggerHaptic('success');
  }, []);

  const handleSave = useCallback(async () => {
    // Validate
    const newErrors: Record<string, string> = {};
    if (!formState.name.trim()) newErrors.name = 'Race name is required';
    if (!formState.date.trim()) newErrors.date = 'Date is required';
    if (!formState.time.trim()) newErrors.time = 'Start time is required';
    if (!formState.location.trim()) newErrors.location = 'Location is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      triggerHaptic('error');
      return;
    }

    setIsSaving(true);
    try {
      // Save last location
      if (formState.location) {
        await AsyncStorage.setItem(
          STORAGE_KEY_LAST_LOCATION,
          JSON.stringify({
            name: formState.location,
            lat: formState.latitude,
            lng: formState.longitude,
          })
        );
      }

      // Build form data
      const formData: RaceFormData = {
        raceType: formState.raceType,
        name: formState.name,
        date: formState.date,
        time: formState.time,
        venue: formState.location,
        latitude: formState.latitude,
        longitude: formState.longitude,
        vhfChannel: formState.vhfChannel,
        notes: formState.notes,
        marks: formState.marks,
        routeWaypoints: formState.routeWaypoints,
        racingAreaPolygon: formState.racingAreaPolygon,
        ...formState[formState.raceType],
        sourceDocumentIds,
      };

      await onSave(formData);
      triggerHaptic('success');
      onClose();
    } catch (error) {
      triggerHaptic('error');
      logger.error('Failed to save race', error);
    } finally {
      setIsSaving(false);
    }
  }, [formState, onSave, onClose, sourceDocumentIds]);

  const handleLocationSelected = useCallback((location: { name: string; lat: number; lng: number }) => {
    setFormState(prev => ({
      ...prev,
      location: location.name,
      latitude: location.lat,
      longitude: location.lng,
    }));
    setShowLocationPicker(false);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* iOS-style Header */}
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={onClose}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Add Race</Text>
            <Pressable
              style={[styles.headerButton, styles.headerButtonRight]}
              onPress={handleSave}
              disabled={!isFormValid || isSaving}
            >
              <Text style={[
                styles.headerButtonText,
                styles.headerSaveText,
                (!isFormValid || isSaving) && styles.headerButtonDisabled,
              ]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Race Type */}
            <SectionHeader first>Race Type</SectionHeader>
            <RaceTypeSelector
              selected={formState.raceType}
              onSelect={(type) => handleFieldChange('raceType', type)}
            />

            {/* Season */}
            <SectionHeader>Season</SectionHeader>
            <GroupedSection>
              <ListRow
                icon={
                  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={22} color={IOS.colors.orange} />
                  </View>
                }
                label={currentSeason ? currentSeason.name : 'No active season'}
                value={currentSeason ? undefined : undefined}
                placeholder={currentSeason ? undefined : 'Start Season'}
                onPress={() => setShowSeasonModal(true)}
                isLast
              />
            </GroupedSection>

            {/* AI Document Extraction */}
            <SectionHeader>Race Documents</SectionHeader>
            <GroupedSection>
              <Pressable
                style={styles.aiSectionHeader}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAISection(!showAISection);
                }}
              >
                <View style={styles.aiSectionHeaderLeft}>
                  <View style={styles.aiIconBadge}>
                    <Sparkles size={16} color={IOS.colors.blue} />
                  </View>
                  <View>
                    <Text style={styles.aiSectionTitle}>Extraction</Text>
                    <Text style={styles.aiSectionSubtitle}>
                      {aiExtractedFields.size > 0 ? 'Details extracted' : 'Add NOR/SI to auto-fill'}
                    </Text>
                  </View>
                </View>
                {aiExtractedFields.size > 0 && (
                  <View style={styles.aiSuccessBadge}>
                    <Check size={14} color={IOS.colors.green} />
                  </View>
                )}
                <ChevronRight
                  size={20}
                  color={IOS.colors.tertiaryLabel}
                  style={{ transform: [{ rotate: showAISection ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {showAISection && (
                <View style={styles.aiContent}>
                  <UnifiedDocumentInput
                    key={documentInputKey}
                    mode="race_creation"
                    defaultDocumentType="nor"
                    onExtractionComplete={(data, rawData, documentId) => {
                      handleAIExtracted(data, rawData);
                      if (documentId) {
                        setSourceDocumentIds(prev => [...prev, documentId]);
                      }
                    }}
                    compact
                    raceType={formState.raceType}
                    iosStyle
                  />
                </View>
              )}
            </GroupedSection>

            {/* Extracted Details Summary */}
            {extractedDetailsData && (
              <ExtractedDetailsSummary
                data={extractedDetailsData}
                onChange={setExtractedDetailsData}
              />
            )}

            {/* Essential Details */}
            <SectionHeader>Essentials</SectionHeader>
            <GroupedSection>
              <InputRow
                label="Race Name"
                value={formState.name}
                onChangeText={(v) => handleFieldChange('name', v)}
                placeholder="e.g., Club Championship Race 1"
                required
                error={errors.name}
                aiExtracted={aiExtractedFields.has('name')}
              />
              <View style={styles.dateTimeRow}>
                <View style={styles.dateField}>
                  <InputRow
                    label="Date"
                    value={formState.date}
                    onChangeText={(v) => handleFieldChange('date', v)}
                    placeholder="YYYY-MM-DD"
                    required
                    isLast
                    error={errors.date}
                    aiExtracted={aiExtractedFields.has('date')}
                  />
                </View>
                <View style={styles.timeField}>
                  <InputRow
                    label="Start Time"
                    value={formState.time}
                    onChangeText={(v) => handleFieldChange('time', v)}
                    placeholder="HH:MM"
                    required
                    isLast
                    error={errors.time}
                    aiExtracted={aiExtractedFields.has('time')}
                  />
                </View>
              </View>
            </GroupedSection>

            {/* Location */}
            <GroupedSection>
              <ListRow
                icon={<MapPin size={22} color={IOS.colors.blue} />}
                label="Location"
                value={formState.location}
                placeholder="Tap to select on map"
                onPress={() => setShowLocationPicker(true)}
                required
                isLast
                trailing={
                  formState.latitude && formState.longitude ? (
                    <View style={styles.coordsBadge}>
                      <Text style={styles.coordsText}>
                        {formState.latitude.toFixed(2)}, {formState.longitude.toFixed(2)}
                      </Text>
                    </View>
                  ) : undefined
                }
              />
            </GroupedSection>
            {errors.location && (
              <Text style={styles.sectionError}>{errors.location}</Text>
            )}

            {/* Optional Details */}
            <SectionHeader>Optional</SectionHeader>
            <GroupedSection>
              <InputRow
                label="VHF Channel"
                value={formState.vhfChannel}
                onChangeText={(v) => handleFieldChange('vhfChannel', v)}
                placeholder="e.g., 72"
                keyboardType="numeric"
                aiExtracted={aiExtractedFields.has('vhfChannel')}
              />
              <InputRow
                label="Notes"
                value={formState.notes}
                onChangeText={(v) => handleFieldChange('notes', v)}
                placeholder="Any additional notes..."
                isLast
              />
            </GroupedSection>

            {/* Bottom spacing */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <LocationMapPicker
          initialLocation={formState.latitude && formState.longitude ? {
            latitude: formState.latitude,
            longitude: formState.longitude,
            name: formState.location,
          } : undefined}
          onLocationSelected={handleLocationSelected}
          onClose={() => setShowLocationPicker(false)}
        />
      </Modal>

      {/* Multi-Race Selection Modal */}
      {showMultiRaceModal && multiRaceData && (
        <MultiRaceSelectionScreen
          visible={showMultiRaceModal}
          data={multiRaceData}
          onClose={() => setShowMultiRaceModal(false)}
          onConfirm={async (_selectedRaces) => {
            setShowMultiRaceModal(false);
            // Handle multi-race creation
          }}
        />
      )}

      {/* Season Settings Modal */}
      <SeasonSettingsModal
        visible={showSeasonModal}
        season={currentSeason ?? null}
        onClose={() => setShowSeasonModal(false)}
        onSeasonCreated={() => setShowSeasonModal(false)}
        onSeasonUpdated={() => setShowSeasonModal(false)}
      />
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS.colors.systemGroupedBackground,
  },
  keyboardView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS.spacing.lg,
    paddingVertical: IOS.spacing.md,
    backgroundColor: IOS.colors.secondarySystemGroupedBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS.colors.separator,
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonRight: {
    alignItems: 'flex-end',
  },
  headerButtonText: {
    fontSize: 17,
    color: IOS.colors.blue,
  },
  headerSaveText: {
    fontWeight: '600',
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS.colors.label,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Section Header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS.colors.secondaryLabel,
    marginTop: IOS.spacing.xxl,
    marginBottom: IOS.spacing.sm,
    marginHorizontal: IOS.spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderFirst: {
    marginTop: IOS.spacing.lg,
  },
  sectionError: {
    fontSize: 13,
    color: IOS.colors.red,
    marginHorizontal: IOS.spacing.lg,
    marginTop: IOS.spacing.xs,
  },

  // Grouped Section
  groupedSection: {
    backgroundColor: IOS.colors.secondarySystemGroupedBackground,
    marginHorizontal: IOS.spacing.lg,
    borderRadius: IOS.radius.md,
    overflow: 'hidden',
  },

  // List Row
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: IOS.spacing.md,
    paddingHorizontal: IOS.spacing.lg,
    minHeight: 44,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS.colors.separator,
  },
  listRowPressed: {
    backgroundColor: IOS.colors.systemGroupedBackground,
  },
  listRowIcon: {
    marginRight: IOS.spacing.md,
  },
  listRowContent: {
    flex: 1,
  },
  listRowLabel: {
    fontSize: 17,
    color: IOS.colors.label,
  },
  listRowValue: {
    fontSize: 15,
    color: IOS.colors.secondaryLabel,
    marginTop: 2,
  },
  listRowPlaceholder: {
    fontSize: 15,
    color: IOS.colors.tertiaryLabel,
    marginTop: 2,
  },
  requiredStar: {
    color: IOS.colors.red,
  },

  // Input Row
  inputRow: {
    paddingVertical: IOS.spacing.md,
    paddingHorizontal: IOS.spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS.colors.secondaryLabel,
    marginBottom: IOS.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: IOS.colors.label,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  inputError: {
    color: IOS.colors.red,
  },
  aiIndicator: {
    marginLeft: IOS.spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: IOS.colors.red,
    marginTop: IOS.spacing.xs,
  },

  // Date/Time Row
  dateTimeRow: {
    flexDirection: 'row',
  },
  dateField: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: IOS.colors.separator,
  },
  timeField: {
    flex: 1,
  },

  // Coords Badge
  coordsBadge: {
    backgroundColor: IOS.colors.systemGroupedBackground,
    paddingHorizontal: IOS.spacing.sm,
    paddingVertical: IOS.spacing.xs,
    borderRadius: IOS.radius.sm,
    marginRight: IOS.spacing.sm,
  },
  coordsText: {
    fontSize: 11,
    color: IOS.colors.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Race Type Selector
  raceTypeContainer: {
    flexDirection: 'row',
    marginHorizontal: IOS.spacing.lg,
    gap: IOS.spacing.sm,
  },
  raceTypeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS.spacing.md,
    backgroundColor: IOS.colors.secondarySystemGroupedBackground,
    borderRadius: IOS.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  raceTypeButtonSelected: {
    backgroundColor: IOS.colors.systemBackground,
  },
  raceTypeLabel: {
    fontSize: 13,
    color: IOS.colors.secondaryLabel,
    marginTop: IOS.spacing.xs,
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: IOS.colors.systemGroupedBackground,
    borderRadius: IOS.radius.sm,
    padding: 2,
    marginHorizontal: IOS.spacing.lg,
    marginBottom: IOS.spacing.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS.spacing.sm,
    borderRadius: IOS.radius.sm - 1,
    gap: IOS.spacing.xs,
  },
  segmentSelected: {
    backgroundColor: IOS.colors.secondarySystemGroupedBackground,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS.colors.secondaryLabel,
  },
  segmentLabelSelected: {
    color: IOS.colors.blue,
    fontWeight: '600',
  },

  // AI Section
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: IOS.spacing.md,
    paddingHorizontal: IOS.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS.colors.separator,
  },
  aiSectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${IOS.colors.blue}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS.spacing.md,
  },
  aiSectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: IOS.colors.label,
  },
  aiSectionSubtitle: {
    fontSize: 13,
    color: IOS.colors.secondaryLabel,
    marginTop: 1,
  },
  aiSuccessBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${IOS.colors.green}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS.spacing.sm,
  },
  aiContent: {
    paddingVertical: IOS.spacing.md,
    paddingHorizontal: IOS.spacing.lg,
  },
});

export default IOSAddRaceForm;
