import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCoachWorkspace } from '@/hooks/useCoachWorkspace';
import { coachingService, SailorSummary } from '@/services/CoachingService';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

type CoachingClientSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type CoachingClientStatus = 'active' | 'inactive' | 'completed';

const SKILL_LEVELS: { key: CoachingClientSkillLevel; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'expert', label: 'Pro' },
];

const STATUSES: { key: CoachingClientStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

export default function NewClientScreen() {
  const router = useRouter();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { coachId, loading: personaLoading } = useCoachWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SailorSummary[]>([]);
  const [selectedSailor, setSelectedSailor] = useState<SailorSummary | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: 'active' as CoachingClientStatus,
    skillLevel: 'intermediate' as CoachingClientSkillLevel,
    boatClass: '',
    goals: '',
    notes: '',
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showAlert('Search Required', 'Enter a sailor name or email to search.');
      return;
    }

    try {
      setSearching(true);
      const results = await coachingService.searchSailors(searchQuery.trim());
      setSearchResults(results);
      if (!results.length) {
        showAlert('No Sailors Found', 'Try a different name or email address.');
      }
    } catch (error) {
      console.error('Error searching sailors:', error);
      showAlert('Search Failed', 'Unable to search sailors right now. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateClient = async () => {
    if (!coachId) {
      showAlert('Coach Account Required', 'Switch to a coach profile to add clients.');
      return;
    }

    if (!selectedSailor) {
      showAlert('Select a Sailor', 'Choose a sailor from the search results first.');
      return;
    }

    try {
      setSaving(true);
      const newClient = await coachingService.createClient(coachId, selectedSailor.id, {
        status: form.status,
        skill_level: form.skillLevel,
        primary_boat_class: form.boatClass || selectedSailor.primary_boat_class || null,
        goals: form.goals || null,
        coach_notes: form.notes || null,
      });

      router.replace(`/coach/client/${newClient.id}`);
    } catch (error) {
      console.error('Error creating client:', error);
      showAlert('Unable to Create Client', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  const blurHiddenInputs = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement?.blur) {
      activeElement.blur();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        blurHiddenInputs();
      };
    }, [blurHiddenInputs])
  );

  useEffect(() => {
    return () => {
      blurHiddenInputs();
    };
  }, [blurHiddenInputs]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest('[aria-hidden="true"]')) {
        requestAnimationFrame(() => target.blur());
      }
    };
    document.addEventListener('focusin', handleFocusIn, true);
    return () => document.removeEventListener('focusin', handleFocusIn, true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const blurSub = navigation.addListener('blur', blurHiddenInputs);
    const transitionSub = navigation.addListener('transitionStart', blurHiddenInputs);
    return () => {
      blurSub?.();
      transitionSub?.();
    };
  }, [navigation, blurHiddenInputs]);

  if (personaLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Preparing coach workspace...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#0F172A" />
          <ThemedText style={styles.backText}>Back to Clients</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.title}>Add Coaching Client</ThemedText>
        <ThemedText style={styles.subtitle}>
          Connect with an existing sailor so you can track progress, schedule sessions, and share notes.
        </ThemedText>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>1. Find the sailor</ThemedText>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by email or full name"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.searchButtonText}>Search</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {selectedSailor ? (
            <View style={styles.selectionBanner}>
              <View>
                <ThemedText style={styles.selectionLabel}>Selected Sailor</ThemedText>
                <ThemedText style={styles.selectionValue}>
                  {selectedSailor.full_name || selectedSailor.email || 'Sailor'}
                </ThemedText>
                {selectedSailor.email ? (
                  <ThemedText style={styles.selectionMeta}>{selectedSailor.email}</ThemedText>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setSelectedSailor(null)}>
                <ThemedText style={styles.clearSelection}>Change</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}

          {searchResults.length > 0 && !selectedSailor && (
            <View style={styles.resultsContainer}>
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.resultRow}
                  onPress={() => setSelectedSailor(result)}
                >
                  <View style={styles.resultInfo}>
                    <ThemedText style={styles.resultName}>
                      {result.full_name || 'Unknown sailor'}
                    </ThemedText>
                    <ThemedText style={styles.resultEmail}>
                      {result.email || 'No email on file'}
                    </ThemedText>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#0284C7" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {selectedSailor ? (
          <>
            <View style={styles.card}>
              <ThemedText style={styles.sectionTitle}>2. Client details</ThemedText>

              <ThemedText style={styles.fieldLabel}>Coaching status</ThemedText>
              <View style={styles.chipRow}>
                {STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status.key}
                    style={[
                      styles.chip,
                      form.status === status.key && styles.chipActive,
                    ]}
                    onPress={() => setForm((prev) => ({ ...prev, status: status.key }))}
                  >
                    <ThemedText
                      style={[
                        styles.chipText,
                        form.status === status.key && styles.chipTextActive,
                      ]}
                    >
                      {status.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={styles.fieldLabel}>Skill level</ThemedText>
              <View style={styles.chipRow}>
                {SKILL_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.key}
                    style={[
                      styles.chip,
                      form.skillLevel === level.key && styles.chipActive,
                    ]}
                    onPress={() => setForm((prev) => ({ ...prev, skillLevel: level.key }))}
                  >
                    <ThemedText
                      style={[
                        styles.chipText,
                        form.skillLevel === level.key && styles.chipTextActive,
                      ]}
                    >
                      {level.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={styles.fieldLabel}>Primary boat class</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. ILCA 6, 420"
                value={form.boatClass}
                onChangeText={(boatClass) => setForm((prev) => ({ ...prev, boatClass }))}
                placeholderTextColor="#94A3B8"
              />

              <ThemedText style={styles.fieldLabel}>Goals or focus areas</ThemedText>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Describe what this sailor is working on"
                value={form.goals}
                onChangeText={(goals) => setForm((prev) => ({ ...prev, goals }))}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              <ThemedText style={styles.fieldLabel}>Private coach notes</ThemedText>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Notes are only visible to you"
                value={form.notes}
                onChangeText={(notes) => setForm((prev) => ({ ...prev, notes }))}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (!coachId || saving) && styles.primaryButtonDisabled]}
              onPress={handleCreateClient}
              disabled={!coachId || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Create Client</ThemedText>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#475569',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  searchButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  resultInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  resultEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  selectionBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ECFEFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  selectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#0891B2',
    fontWeight: '600',
  },
  selectionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectionMeta: {
    color: '#0E7490',
    marginTop: 2,
  },
  clearSelection: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  chipText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 16px rgba(14, 165, 233, 0.3)',
      },
      default: {
        shadowColor: '#0EA5E9',
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      },
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
  },
});
