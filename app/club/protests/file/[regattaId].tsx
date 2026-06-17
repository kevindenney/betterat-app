/**
 * Protest Filing Form
 * File a new protest with time-limit validation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Clock,
  Check,
  Flag,
  ChevronDown,
} from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import {
  protestService,
  ProtestType,
  ProtestFormData,
} from '@/services/ProtestService';

interface RaceOption {
  race_number: number;
  protest_deadline: string | null;
  status: string;
}

interface EntryOption {
  id: string;
  sail_number: string;
  boat_name?: string;
  skipper_name?: string;
}

const PROTEST_TYPES: { value: ProtestType; label: string; description: string }[] = [
  {
    value: 'boat_vs_boat',
    label: 'Boat vs Boat',
    description: 'A protest by one competitor against another',
  },
  {
    value: 'redress_request',
    label: 'Request for Redress',
    description: 'Request consideration for an action or omission',
  },
  {
    value: 'boat_vs_rc',
    label: 'Boat vs Race Committee',
    description: 'A protest against race committee actions',
  },
  {
    value: 'rc_vs_boat',
    label: 'Race Committee vs Boat',
    description: 'A protest by the race committee',
  },
  {
    value: 'equipment_inspection',
    label: 'Equipment Inspection',
    description: 'Request for equipment or measurement check',
  },
];

const COMMON_RULES = [
  'RRS 10 - On opposite tacks',
  'RRS 11 - On the same tack, overlapped',
  'RRS 12 - On the same tack, not overlapped',
  'RRS 13 - While tacking',
  'RRS 14 - Avoiding contact',
  'RRS 15 - Acquiring right of way',
  'RRS 16 - Changing course',
  'RRS 17 - On the same tack; proper course',
  'RRS 18 - Mark-room',
  'RRS 19 - Room to pass an obstruction',
  'RRS 20 - Room to tack at an obstruction',
  'RRS 31 - Touching a mark',
];

export default function FileProtest() {
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const router = useRouter();

  // Form state
  const [protestType, setProtestType] = useState<ProtestType>('boat_vs_boat');
  const [raceNumber, setRaceNumber] = useState<number | null>(null);
  const [protestorEntryId, setProtestorEntryId] = useState<string | null>(null);
  const [protesteeEntryIds, setProtesteeEntryIds] = useState<string[]>([]);
  const [ruleInfringed, setRuleInfringed] = useState('');
  const [incidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [description, setDescription] = useState('');
  const [hailGiven, setHailGiven] = useState(false);
  const [redFlagDisplayed, setRedFlagDisplayed] = useState(false);
  const [informedProtestee, setInformedProtestee] = useState(false);

  // Data state
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [entries, setEntries] = useState<EntryOption[]>([]);
  const [deadline, setDeadline] = useState<{
    deadline: Date | null;
    isExpired: boolean;
    minutesRemaining: number | null;
  }>({ deadline: null, isExpired: false, minutesRemaining: null });
  const [, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // UI state
  const [showRaceSelector, setShowRaceSelector] = useState(false);
  const [showProtestorSelector, setShowProtestorSelector] = useState(false);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Load races and entries
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  // Update deadline when race changes
  useEffect(() => {
    if (raceNumber) {
      loadDeadline(raceNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceNumber]);

  const loadData = async () => {
    try {
      const [racesRes, entriesRes] = await Promise.all([
        supabase
          .from('regatta_races')
          .select('race_number, protest_deadline, status')
          .eq('regatta_id', regattaId)
          .eq('status', 'completed')
          .order('race_number'),
        supabase
          .from('race_entries')
          .select('id, sail_number, boat_name, skipper_name')
          .eq('regatta_id', regattaId)
          .eq('status', 'confirmed')
          .order('sail_number'),
      ]);

      setRaces(racesRes.data || []);
      setEntries(entriesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeadline = async (race: number) => {
    const result = await protestService.getProtestDeadline(regattaId!, race);
    setDeadline(result);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!raceNumber) {
      showAlert('Required', 'Please select a race');
      return;
    }
    if (!description.trim()) {
      showAlert('Required', 'Please provide a description of the incident');
      return;
    }
    if (protestType === 'boat_vs_boat' && !protestorEntryId) {
      showAlert('Required', 'Please select the protestor boat');
      return;
    }

    // Warn about expired deadline
    if (deadline.isExpired) {
      showConfirm(
        'Time Limit Expired',
        'The protest time limit has passed. Your protest may be rejected unless the protest committee extends the time limit. Continue?',
        submitProtest,
        { confirmText: 'File Anyway' }
      );
      return;
    }

    submitProtest();
  };

  const submitProtest = async () => {
    setSubmitting(true);
    try {
      const protestData: ProtestFormData = {
        regatta_id: regattaId!,
        race_number: raceNumber!,
        protest_type: protestType,
        protestor_entry_id: protestorEntryId || undefined,
        protestee_entry_ids: protesteeEntryIds.length > 0 ? protesteeEntryIds : undefined,
        rule_infringed: ruleInfringed || undefined,
        incident_time: incidentTime ? new Date(incidentTime).toISOString() : undefined,
        incident_location: incidentLocation || undefined,
        description,
        hail_given: hailGiven,
        red_flag_displayed: redFlagDisplayed,
        informed_protestee: informedProtestee,
      };

      await protestService.fileProtest(protestData);
      showAlert('Success', 'Protest filed successfully');
      router.back();
    } catch (error) {
      console.error('Error filing protest:', error);
      showAlert('Error', 'Failed to file protest. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProtestee = (entryId: string) => {
    setProtesteeEntryIds(prev => 
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  // Render step 1: Type and Race
  const renderStep1 = () => (
    <>
      {/* Protest Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Protest Type</Text>
        {PROTEST_TYPES.map(type => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeOption,
              protestType === type.value && styles.typeOptionActive,
            ]}
            onPress={() => setProtestType(type.value)}
          >
            <View style={[
              styles.radio,
              protestType === type.value && styles.radioActive,
            ]}>
              {protestType === type.value && <View style={styles.radioInner} />}
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeLabel}>{type.label}</Text>
              <Text style={styles.typeDescription}>{type.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Race Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Race</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowRaceSelector(true)}
        >
          <Text style={raceNumber ? styles.selectorValue : styles.selectorPlaceholder}>
            {raceNumber ? `Race ${raceNumber}` : 'Select race...'}
          </Text>
          <ChevronDown size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Time limit warning */}
        {deadline.deadline && (
          <View style={[
            styles.deadlineBox,
            deadline.isExpired ? styles.deadlineExpired : styles.deadlineActive,
          ]}>
            <Clock size={16} color={deadline.isExpired ? '#DC2626' : '#059669'} />
            <View style={styles.deadlineInfo}>
              {deadline.isExpired ? (
                <>
                  <Text style={styles.deadlineWarning}>Time Limit Expired</Text>
                  <Text style={styles.deadlineText}>
                    Deadline was {deadline.deadline.toLocaleString()}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.deadlineOk}>
                    {deadline.minutesRemaining} minutes remaining
                  </Text>
                  <Text style={styles.deadlineText}>
                    Deadline: {deadline.deadline.toLocaleString()}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </>
  );

  // Render step 2: Parties
  const renderStep2 = () => (
    <>
      {/* Protestor */}
      {protestType !== 'rc_vs_boat' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protestor (Your Boat)</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowProtestorSelector(true)}
          >
            <Text style={protestorEntryId ? styles.selectorValue : styles.selectorPlaceholder}>
              {protestorEntryId 
                ? entries.find(e => e.id === protestorEntryId)?.sail_number 
                : 'Select your boat...'}
            </Text>
            <ChevronDown size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Protestees */}
      {(protestType === 'boat_vs_boat' || protestType === 'rc_vs_boat') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protestee(s)</Text>
          <Text style={styles.sectionSubtitle}>
            Select the boat(s) you are protesting against
          </Text>
          <View style={styles.entriesGrid}>
            {entries
              .filter(e => e.id !== protestorEntryId)
              .map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={[
                    styles.entryChip,
                    protesteeEntryIds.includes(entry.id) && styles.entryChipActive,
                  ]}
                  onPress={() => toggleProtestee(entry.id)}
                >
                  <Text style={[
                    styles.entryChipText,
                    protesteeEntryIds.includes(entry.id) && styles.entryChipTextActive,
                  ]}>
                    {entry.sail_number}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}
    </>
  );

  // Render step 3: Incident Details
  const renderStep3 = () => (
    <>
      {/* Rule Infringed */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rule Alleged to be Broken (Optional)</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowRuleSelector(true)}
        >
          <Text style={ruleInfringed ? styles.selectorValue : styles.selectorPlaceholder}>
            {ruleInfringed || 'Select or type rule...'}
          </Text>
          <ChevronDown size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Incident Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Incident Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., At the windward mark, on the first beat..."
          placeholderTextColor="#9CA3AF"
          value={incidentLocation}
          onChangeText={setIncidentLocation}
        />
      </View>

      {/* Incident Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description of Incident *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe what happened..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* Checkboxes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions Taken</Text>
        
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setHailGiven(!hailGiven)}
        >
          <View style={[styles.checkboxBox, hailGiven && styles.checkboxBoxActive]}>
            {hailGiven && <Check size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I hailed "Protest" at the time of the incident
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setRedFlagDisplayed(!redFlagDisplayed)}
        >
          <View style={[styles.checkboxBox, redFlagDisplayed && styles.checkboxBoxActive]}>
            {redFlagDisplayed && <Check size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I displayed a red flag at the first reasonable opportunity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setInformedProtestee(!informedProtestee)}
        >
          <View style={[styles.checkboxBox, informedProtestee && styles.checkboxBoxActive]}>
            {informedProtestee && <Check size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I informed the protestee of my intention to protest
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>File Protest</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map(step => (
          <React.Fragment key={step}>
            <TouchableOpacity
              style={[
                styles.stepDot,
                currentStep >= step && styles.stepDotActive,
              ]}
              onPress={() => setCurrentStep(step)}
            >
              <Text style={[
                styles.stepNumber,
                currentStep >= step && styles.stepNumberActive,
              ]}>
                {step}
              </Text>
            </TouchableOpacity>
            {step < 3 && (
              <View style={[
                styles.stepLine,
                currentStep > step && styles.stepLineActive,
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>
      <View style={styles.stepLabels}>
        <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>
          Type & Race
        </Text>
        <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>
          Parties
        </Text>
        <Text style={[styles.stepLabel, currentStep === 3 && styles.stepLabelActive]}>
          Details
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        {currentStep > 1 ? (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={styles.backStepButtonText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        
        {currentStep < 3 ? (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => setCurrentStep(currentStep + 1)}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Flag size={18} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {submitting ? 'Filing...' : 'File Protest'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Race Selector Modal */}
      {showRaceSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Race</Text>
            <ScrollView style={styles.modalList}>
              {races.map(race => (
                <TouchableOpacity
                  key={race.race_number}
                  style={styles.modalOption}
                  onPress={() => {
                    setRaceNumber(race.race_number);
                    setShowRaceSelector(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>Race {race.race_number}</Text>
                  {race.protest_deadline && (
                    <Text style={styles.modalOptionSubtext}>
                      Deadline: {new Date(race.protest_deadline).toLocaleTimeString()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowRaceSelector(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Protestor Selector Modal */}
      {showProtestorSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Boat</Text>
            <ScrollView style={styles.modalList}>
              {entries.map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setProtestorEntryId(entry.id);
                    setShowProtestorSelector(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{entry.sail_number}</Text>
                  {entry.boat_name && (
                    <Text style={styles.modalOptionSubtext}>{entry.boat_name}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowProtestorSelector(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rule Selector Modal */}
      {showRuleSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Rule</Text>
            <TextInput
              style={styles.ruleInput}
              placeholder="Or type a rule..."
              placeholderTextColor="#9CA3AF"
              value={ruleInfringed}
              onChangeText={setRuleInfringed}
            />
            <ScrollView style={styles.modalList}>
              {COMMON_RULES.map(rule => (
                <TouchableOpacity
                  key={rule}
                  style={styles.modalOption}
                  onPress={() => {
                    setRuleInfringed(rule);
                    setShowRuleSelector(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{rule}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowRuleSelector(false)}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#DC2626',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#DC2626',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    marginTop: -8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeOptionActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#DC2626',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  typeDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectorValue: {
    fontSize: 15,
    color: '#1F2937',
  },
  selectorPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  deadlineBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 10,
  },
  deadlineExpired: {
    backgroundColor: '#FEE2E2',
  },
  deadlineActive: {
    backgroundColor: '#D1FAE5',
  },
  deadlineInfo: {
    flex: 1,
  },
  deadlineWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  deadlineOk: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  deadlineText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  entriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entryChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  entryChipActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  entryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  entryChipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 120,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backStepButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backStepButtonText: {
    fontSize: 15,
    color: '#6B7280',
  },
  nextButton: {
    backgroundColor: '#1F2937',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 300,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#1F2937',
  },
  modalOptionSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCancel: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#6B7280',
  },
  ruleInput: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 15,
    color: '#1F2937',
  },
});

