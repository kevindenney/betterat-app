/**
 * FacultyAttestSheet — modal sheet for faculty / instructor /
 * preceptor to attest that a student demonstrated a competency on a
 * specific step.
 *
 * Backed by Codex's record_competency_evidence RPC; the SECURITY
 * DEFINER check on the backend validates the caller actually has
 * the right org role + the target is an active org member. So the
 * UI is forgiving — surface the picker, let the caller try, and
 * render any rejection in a toast/inline state.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useUserOrgCompetencies,
  type OrgCompetencyOption,
} from '@/hooks/useUserOrgCompetencies';
import { useRecordCompetencyEvidence } from '@/hooks/useRecordCompetencyEvidence';

interface Props {
  visible: boolean;
  onClose: () => void;
  stepId: string;
  /** Optional interest slug used to scope the org_competencies picker
   *  to a single vertical when caller belongs to multiple orgs. */
  interestSlug?: string | null;
  onSubmitted?: () => void;
}

export function FacultyAttestSheet({
  visible,
  onClose,
  stepId,
  interestSlug,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { data: competencies = [], isLoading } = useUserOrgCompetencies(interestSlug);
  const recordEvidence = useRecordCompetencyEvidence(stepId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedId(null);
      setNotes('');
      setErrorMessage(null);
    }
  }, [visible]);

  const grouped = useMemo(() => {
    const byOrg = new Map<string, { orgName: string; rows: OrgCompetencyOption[] }>();
    for (const c of competencies) {
      const entry = byOrg.get(c.orgId);
      if (entry) entry.rows.push(c);
      else byOrg.set(c.orgId, { orgName: c.orgName, rows: [c] });
    }
    return Array.from(byOrg.values()).sort((a, b) =>
      a.orgName.localeCompare(b.orgName),
    );
  }, [competencies]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setErrorMessage(null);
    try {
      await recordEvidence.mutateAsync({
        orgCompetencyId: selectedId,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not attest evidence');
    }
  };

  const submitDisabled = !selectedId || recordEvidence.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerSide}>
            <Text style={styles.headerLink}>Cancel</Text>
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Attest competency</Text>
            <Text style={styles.headerSubtitle}>
              Confirm the student demonstrated this on the step
            </Text>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={submitDisabled}
            hitSlop={8}
            style={styles.headerSide}
          >
            {recordEvidence.isPending ? (
              <ActivityIndicator size="small" color="#64748B" />
            ) : (
              <Text
                style={[
                  styles.headerLink,
                  styles.headerLinkStrong,
                  submitDisabled && styles.headerLinkDisabled,
                ]}
              >
                Attest
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionEyebrow}>COMPETENCY</Text>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#64748B" />
              <Text style={styles.loadingText}>Loading competencies…</Text>
            </View>
          ) : grouped.length === 0 ? (
            <Text style={styles.emptyCopy}>
              You don&rsquo;t have any org competencies available in this scope.
              You may not have a faculty/instructor role at this student&rsquo;s
              organization.
            </Text>
          ) : (
            grouped.map((group) => (
              <View key={group.orgName} style={styles.orgGroup}>
                <Text style={styles.orgGroupLabel}>{group.orgName}</Text>
                {group.rows.map((option) => {
                  const isSelected = option.id === selectedId;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setSelectedId(option.id)}
                      style={[
                        styles.competencyRow,
                        isSelected && styles.competencyRowActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.checkbox}>
                        {isSelected ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : null}
                      </View>
                      <View style={styles.competencyText}>
                        <Text style={styles.competencyTitle}>
                          {option.shortLabel || option.fullLabel}
                        </Text>
                        {option.shortLabel && option.fullLabel && option.shortLabel !== option.fullLabel ? (
                          <Text style={styles.competencyMeta} numberOfLines={2}>
                            {option.fullLabel}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}

          <Text style={[styles.sectionEyebrow, styles.notesEyebrow]}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you observe? Anything to flag for the next attempt?"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
          />

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerSide: { width: 72, alignItems: 'flex-start' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  headerLink: { fontSize: 15, color: '#007AFF' },
  headerLinkStrong: { fontWeight: '600' },
  headerLinkDisabled: { color: '#94A3B8' },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  notesEyebrow: { marginTop: 16 },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  emptyCopy: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    paddingVertical: 14,
  },
  orgGroup: { gap: 6 },
  orgGroupLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  competencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  competencyRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  competencyText: { flex: 1, gap: 2 },
  competencyTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  competencyMeta: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  notesInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12.5,
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    lineHeight: 18,
  },
});
