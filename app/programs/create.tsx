import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import {
  ProgramStatus,
  ProgramTemplateRecord,
  WorkspaceDomain,
  programService,
} from '@/services/ProgramService';

type ProgramTypeOption = {
  key: string;
  label: string;
  sessionLabel: string;
};

const TYPE_OPTIONS: ProgramTypeOption[] = [
  { key: 'clinical_rotation', label: 'Clinical Rotation', sessionLabel: 'Clinical Block' },
  { key: 'simulation_lab', label: 'Simulation Lab', sessionLabel: 'Simulation Session' },
  { key: 'cohort_session', label: 'Cohort Session', sessionLabel: 'Cohort Meeting' },
  { key: 'orientation', label: 'Orientation', sessionLabel: 'Orientation Session' },
];

const STATUS_OPTIONS: ProgramStatus[] = ['draft', 'planned', 'active'];

function normalizeTypeParam(rawType: string | string[] | undefined) {
  const value = Array.isArray(rawType) ? rawType[0] : rawType;
  if (!value) return 'clinical_rotation';
  if (value === 'training') return 'clinical_rotation';
  if (value === 'meeting') return 'cohort_session';
  return value;
}

function toIsoFromDateInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const iso = `${trimmed}T09:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function CreateProgramScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { activeOrganization, ready } = useOrganization();
  const { activeDomain } = useWorkspaceDomain();

  const defaultType = normalizeTypeParam(params.type);

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [programType, setProgramType] = useState(defaultType);
  const [programStatus, setProgramStatus] = useState<ProgramStatus>('planned');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  const [createFirstSession, setCreateFirstSession] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionLocation, setSessionLocation] = useState('');
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [programTemplates, setProgramTemplates] = useState<ProgramTemplateRecord[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<ProgramTemplateRecord[]>([]);
  const [selectedProgramTemplateId, setSelectedProgramTemplateId] = useState<string | null>(null);
  const [selectedSessionTemplateId, setSelectedSessionTemplateId] = useState<string | null>(null);

  const selectedType = useMemo(
    () => TYPE_OPTIONS.find((row) => row.key === programType) ?? TYPE_OPTIONS[0],
    [programType]
  );

  const domain: WorkspaceDomain = activeDomain === 'sailing' ? 'generic' : activeDomain;
  const isInstitutionOrganization = activeOrganization?.organization_type === 'institution';

  useEffect(() => {
    const loadTemplates = async () => {
      if (!activeOrganization?.id) return;
      try {
        setTemplatesLoading(true);
        const [programRows, sessionRows] = await Promise.all([
          programService.listProgramTemplates(activeOrganization.id, domain, 'program', 50),
          programService.listProgramTemplates(activeOrganization.id, domain, 'session', 50),
        ]);
        setProgramTemplates(programRows);
        setSessionTemplates(sessionRows);
      } catch (error) {
        console.error('[programs/create] Failed to load templates:', error);
      } finally {
        setTemplatesLoading(false);
      }
    };
    void loadTemplates();
  }, [activeOrganization?.id, domain]);

  const applyProgramTemplate = (template: ProgramTemplateRecord) => {
    const content = (template.content || {}) as Record<string, unknown>;
    setSelectedProgramTemplateId(template.id);
    const nextTitle = content.title ?? template.title;
    const nextDescription = content.description ?? template.description;
    if (typeof nextTitle === 'string' && nextTitle.trim()) {
      setTitle(nextTitle);
    }
    if (typeof nextDescription === 'string') {
      setDescription(nextDescription);
    }
    const contentType = String(content.program_type || content.type || '');
    if (contentType && TYPE_OPTIONS.some((row) => row.key === contentType)) {
      setProgramType(contentType);
    }
  };

  const applySessionTemplate = (template: ProgramTemplateRecord) => {
    const content = (template.content || {}) as Record<string, unknown>;
    setSelectedSessionTemplateId(template.id);
    const nextTitle = content.title ?? template.title;
    const nextLocation = content.location;
    if (typeof nextTitle === 'string' && nextTitle.trim()) {
      setSessionTitle(nextTitle);
    }
    if (typeof nextLocation === 'string') {
      setSessionLocation(nextLocation);
    }
  };

  const submit = async () => {
    if (!activeOrganization?.id) {
      showAlert('Missing workspace', 'No active organization selected.');
      return;
    }
    if (!title.trim()) {
      showAlert('Missing title', 'Program title is required.');
      return;
    }

    const startAt = toIsoFromDateInput(startDateInput);
    const endAt = toIsoFromDateInput(endDateInput);
    if (startDateInput.trim() && !startAt) {
      showAlert('Invalid start date', 'Use YYYY-MM-DD format.');
      return;
    }
    if (endDateInput.trim() && !endAt) {
      showAlert('Invalid end date', 'Use YYYY-MM-DD format.');
      return;
    }

    try {
      setSaving(true);
      const created = await programService.createProgram({
        organization_id: activeOrganization.id,
        domain,
        title: title.trim(),
        description: description.trim() || null,
        type: programType,
        status: programStatus,
        start_at: startAt,
        end_at: endAt,
        metadata: {
          created_from: 'program_create_screen',
          organization_type: activeOrganization.organization_type,
          template_id: selectedProgramTemplateId,
        },
      });

      if (createFirstSession) {
        await programService.createProgramSession({
          organization_id: activeOrganization.id,
          program_id: created.id,
          title: (sessionTitle.trim() || selectedType.sessionLabel).trim(),
          session_type: programType,
          status: 'planned',
          starts_at: startAt,
          ends_at: endAt,
          location: sessionLocation.trim() || null,
          metadata: {
            template_id: selectedSessionTemplateId,
          },
        });
      }

      router.replace({
        pathname: '/(tabs)/programs',
        params: {
          refresh: String(Date.now()),
          createdProgramId: created.id,
          action: 'created',
        },
      } as any);
    } catch (error: any) {
      showAlert('Create failed', error?.message || 'Unable to create program');
    } finally {
      setSaving(false);
    }
  };

  if (ready && (!activeOrganization?.id || !isInstitutionOrganization)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.gateState}>
          <Ionicons name="alert-circle-outline" size={24} color="#B91C1C" />
          <ThemedText style={styles.gateStateTitle}>Programs require an institution organization</ThemedText>
          <ThemedText style={styles.gateStateBody}>
            Switch to an institution workspace before creating programs.
          </ThemedText>
          <TouchableOpacity style={styles.gateStateAction} onPress={() => router.replace('/settings/organization-access' as any)}>
            <ThemedText style={styles.gateStateActionText}>Open organization access</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>Create Program</ThemedText>
              <ThemedText style={styles.subtitle}>
                Set up a cohort, rotation, or simulation program for this organization.
              </ThemedText>
            </View>
          </View>

          <View style={styles.card}>
            {templatesLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.inlineLoadingText}>Loading templates…</ThemedText>
              </View>
            ) : null}

            {programTemplates.length > 0 ? (
              <>
                <ThemedText style={styles.fieldLabel}>Start from program template (optional)</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {programTemplates.map((template) => {
                    const active = selectedProgramTemplateId === template.id;
                    return (
                      <TouchableOpacity
                        key={template.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => applyProgramTemplate(template)}
                      >
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                          {template.title}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <ThemedText style={styles.fieldLabel}>Program title</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Adult-Gerontology Clinical Rotation • Cohort A"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <ThemedText style={styles.fieldLabel}>Program type</ThemedText>
            <View style={styles.chipRow}>
              {TYPE_OPTIONS.map((option) => {
                const active = option.key === programType;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProgramType(option.key)}
                  >
                    <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText style={styles.fieldLabel}>Status</ThemedText>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((status) => {
                const active = status === programStatus;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProgramStatus(status)}
                  >
                    <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText style={styles.fieldLabel}>Start date (optional)</ThemedText>
            <TextInput
              value={startDateInput}
              onChangeText={setStartDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
            />

            <ThemedText style={styles.fieldLabel}>End date (optional)</ThemedText>
            <TextInput
              value={endDateInput}
              onChangeText={setEndDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
            />

            <ThemedText style={styles.fieldLabel}>Description (optional)</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Program details, objectives, and context"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.notesInput]}
              multiline
            />
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.sessionToggleRow}
              onPress={() => setCreateFirstSession((prev) => !prev)}
            >
              <View style={styles.sessionToggleLeft}>
                <Ionicons
                  name={createFirstSession ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={createFirstSession ? '#007AFF' : '#64748B'}
                />
                <ThemedText style={styles.sessionToggleLabel}>Create first session now</ThemedText>
              </View>
            </TouchableOpacity>

            {createFirstSession ? (
              <>
                {sessionTemplates.length > 0 ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Session template (optional)</ThemedText>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRow}
                    >
                      {sessionTemplates.map((template) => {
                        const active = selectedSessionTemplateId === template.id;
                        return (
                          <TouchableOpacity
                            key={template.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => applySessionTemplate(template)}
                          >
                            <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                              {template.title}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}

                <ThemedText style={styles.fieldLabel}>Session title</ThemedText>
                <TextInput
                  value={sessionTitle}
                  onChangeText={setSessionTitle}
                  placeholder={selectedType.sessionLabel}
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />

                <ThemedText style={styles.fieldLabel}>Session location (optional)</ThemedText>
                <TextInput
                  value={sessionLocation}
                  onChangeText={setSessionLocation}
                  placeholder="e.g. Johns Hopkins Hospital • Med-Surg"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </>
            ) : null}
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()} disabled={saving}>
              <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={saving}>
              <ThemedText style={styles.primaryButtonText}>{saving ? 'Creating...' : 'Create program'}</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 13 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  fieldLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
  },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#DBEAFE',
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#1D4ED8' },
  sessionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sessionToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionToggleLabel: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  inlineLoadingText: { fontSize: 12, color: '#64748B' },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  gateState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  gateStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  gateStateBody: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
  },
  gateStateAction: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  gateStateActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
