import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { buildAssignmentPendingSummary } from '@/lib/programs/assignmentDashboard';
import { AssignmentSortMode, buildAssignmentList } from '@/lib/programs/assignmentList';
import {
  buildProgramAssignmentsCsv,
  buildProgramAssignmentsCsvFilename,
} from '@/lib/programs/assignmentExport';
import {
  AssessmentRecord,
  ParticipantStatus,
  ProgramParticipantRecord,
  ProgramRecord,
  ProgramSessionRecord,
  programService,
  WorkspaceDomain,
} from '@/services/ProgramService';
import {
  InviteRolePreset,
  organizationInviteRolePresetService,
} from '@/services/OrganizationInviteRolePresetService';

const FALLBACK_ROLE_OPTIONS = [
  'Team Member',
] as const;

const STATUS_OPTIONS: ParticipantStatus[] = ['invited', 'active', 'completed', 'inactive'];

export default function ProgramAssignmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ programId?: string }>();
  const { activeOrganization, ready } = useOrganization();
  const { activeDomain } = useWorkspaceDomain();
  const isInstitutionOrganization = activeOrganization?.organization_type === 'institution';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [sessions, setSessions] = useState<ProgramSessionRecord[]>([]);
  const [participants, setParticipants] = useState<ProgramParticipantRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [status, setStatus] = useState<ParticipantStatus>('active');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<ParticipantStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<AssignmentSortMode>('newest');
  const [visibleCount, setVisibleCount] = useState(40);
  const [hasMutations, setHasMutations] = useState(false);
  const [inviteRolePresets, setInviteRolePresets] = useState<InviteRolePreset[]>([]);

  const getInviteDomain = (programId?: string | null): WorkspaceDomain => {
    const fromProgram = programId
      ? programs.find((program) => program.id === programId)?.domain
      : undefined;
    return fromProgram || activeDomain || 'generic';
  };

  const handleInviteFromAssignment = async (row: ProgramParticipantRecord) => {
    const domain = getInviteDomain(row.program_id);
    const presets = await organizationInviteRolePresetService.listPresets(domain);
    const rolePayload = organizationInviteRolePresetService.resolveRolePayload(
      presets,
      row.role,
      null
    );

    const inviteRole = encodeURIComponent(rolePayload.roleLabel);
    const inviteRoleKey = encodeURIComponent(rolePayload.roleKey);
    const inviteName = encodeURIComponent(String(row.display_name || ''));
    const inviteEmail = encodeURIComponent(String(row.email || ''));
    const participantId = encodeURIComponent(String(row.id || ''));
    const programId = encodeURIComponent(String(row.program_id || ''));
    const sessionId = encodeURIComponent(String(row.session_id || ''));

    router.push(
      (
        `/settings/organization-access?inviteRole=${inviteRole}` +
        `&inviteRoleKey=${inviteRoleKey}` +
        `&inviteName=${inviteName}` +
        `&inviteEmail=${inviteEmail}` +
        `&participantId=${participantId}` +
        `&programId=${programId}` +
        `&sessionId=${sessionId}` +
        `&autoInvite=1`
      ) as any
    );
  };

  const handleBack = () => {
    if (hasMutations || !router.canGoBack()) {
      router.replace({
        pathname: '/(tabs)/programs',
        params: {
          refresh: String(Date.now()),
          action: 'assignments-updated',
          ...(selectedProgramId ? { programId: selectedProgramId } : {}),
        },
      } as any);
      return;
    }
    router.back();
  };

  const loadPrograms = useCallback(async () => {
    if (!activeOrganization?.id) return;
    const nextPrograms = await programService.listPrograms(activeOrganization.id);
    setPrograms(nextPrograms);

    const routeProgramId = params.programId || null;
    const validFromRoute = routeProgramId && nextPrograms.some((row) => row.id === routeProgramId);
    setSelectedProgramId((current) => {
      if (current && nextPrograms.some((row) => row.id === current)) return current;
      return validFromRoute ? routeProgramId : nextPrograms[0]?.id || null;
    });
  }, [activeOrganization?.id, params.programId]);

  const loadProgramScopedData = useCallback(async (programId: string, sessionId?: string | null) => {
    const scopeSessionId = String(sessionId || '').trim() || undefined;
    const [nextSessions, nextParticipants, nextAssessments] = await Promise.all([
      programService.listProgramSessions(programId),
      programService.listProgramParticipants(programId, { sessionId: scopeSessionId, limit: 1000 }),
      programService.listAssessmentRecords(programId, { sessionId: scopeSessionId, limit: 1000 }),
    ]);
    setSessions(nextSessions);
    setParticipants(nextParticipants);
    setAssessments(nextAssessments);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!ready || !activeOrganization?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await loadPrograms();
      } catch (error) {
        console.error('[programs.assign] failed to load assignment data', error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeOrganization?.id, loadPrograms, ready]);

  useEffect(() => {
    let active = true;
    const loadScoped = async () => {
      if (!ready || !selectedProgramId) {
        setSessions([]);
        setParticipants([]);
        setAssessments([]);
        return;
      }

      try {
        await loadProgramScopedData(selectedProgramId, selectedSessionId);
      } catch (error) {
        if (!active) return;
        console.error('[programs.assign] failed to load scoped data', error);
      }
    };

    void loadScoped();
    return () => {
      active = false;
    };
  }, [loadProgramScopedData, ready, selectedProgramId, selectedSessionId]);

  useEffect(() => {
    if (!selectedProgramId) {
      setSelectedSessionId(null);
      return;
    }
    setSelectedSessionId((current) => {
      if (!current) return null;
      const stillExists = sessions.some((row) => row.id === current && row.program_id === selectedProgramId);
      return stillExists ? current : null;
    });
  }, [selectedProgramId, sessions]);

  useEffect(() => {
    let active = true;
    const loadInviteRolePresets = async () => {
      try {
        const domain = getInviteDomain(selectedProgramId);
        const presets = await organizationInviteRolePresetService.listPresets(domain);
        if (!active) return;
        setInviteRolePresets(presets);
      } catch (error) {
        console.error('[programs.assign] failed to load invite role presets', error);
        if (!active) return;
        setInviteRolePresets([]);
      }
    };

    void loadInviteRolePresets();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, programs, selectedProgramId]);

  const resolvedRoleOptions = useMemo(() => {
    if (!inviteRolePresets.length) return [...FALLBACK_ROLE_OPTIONS];
    const next: string[] = [];
    const seen = new Set<string>();
    for (const preset of inviteRolePresets) {
      const rolePayload = organizationInviteRolePresetService.resolveRolePayload(
        inviteRolePresets,
        preset.role,
        preset.key
      );
      const resolved = String(rolePayload.roleLabel || preset.role || '').trim();
      if (!resolved) continue;
      const signature = resolved.toLowerCase();
      if (seen.has(signature)) continue;
      seen.add(signature);
      next.push(resolved);
    }
    if (!next.length) return [...FALLBACK_ROLE_OPTIONS];
    return next;
  }, [inviteRolePresets]);

  const roleFilterOptions = useMemo(() => {
    const activeParticipantRoles = participants.map((row) => row.role).filter(Boolean) as string[];
    const options = ['all', ...resolvedRoleOptions, ...activeParticipantRoles];
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const option of options) {
      const normalized = String(option || '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(option);
    }
    return deduped;
  }, [participants, resolvedRoleOptions]);

  useEffect(() => {
    setRole((current) => {
      if (resolvedRoleOptions.includes(current)) return current;
      const preferred = organizationInviteRolePresetService.resolveDefaultRoleLabel(inviteRolePresets);
      if (resolvedRoleOptions.includes(preferred)) return preferred;
      return resolvedRoleOptions[0] || preferred || current;
    });
  }, [inviteRolePresets, resolvedRoleOptions]);

  const sessionOptions = sessions;

  const filteredParticipants = participants;

  const { filteredAssignments, pagedAssignments } = useMemo(() => {
    return buildAssignmentList(filteredParticipants, {
      role: filterRole,
      status: filterStatus,
      searchText,
      sortMode,
      visibleCount,
    });
  }, [filteredParticipants, filterRole, filterStatus, searchText, sortMode, visibleCount]);

  const staffQueue = useMemo(
    () =>
      filteredParticipants.filter(
        (row) =>
          organizationInviteRolePresetService.isStaffRole(row.role, inviteRolePresets) &&
          row.status !== 'inactive'
      ),
    [filteredParticipants, inviteRolePresets]
  );

  useEffect(() => {
    setVisibleCount(40);
  }, [selectedProgramId, filterRole, filterStatus, searchText, sortMode]);

  const exportFilteredCsv = () => {
    if (filteredAssignments.length === 0) {
      showAlert('Nothing to export', 'No assignments match the current filters.');
      return;
    }
    const csv = buildProgramAssignmentsCsv(filteredAssignments, programById, sessionById);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', buildProgramAssignmentsCsvFilename());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    showAlert('Export unavailable', 'CSV export is currently available on web.');
  };

  const pendingByEvaluatorId = useMemo(() => {
    return buildAssignmentPendingSummary(assessments).pendingByEvaluatorId;
  }, [assessments]);

  const programById = useMemo(() => {
    const map = new Map<string, ProgramRecord>();
    for (const row of programs) map.set(row.id, row);
    return map;
  }, [programs]);

  const sessionById = useMemo(() => {
    const map = new Map<string, ProgramSessionRecord>();
    for (const row of sessions) map.set(row.id, row);
    return map;
  }, [sessions]);

  const submit = async () => {
    if (!activeOrganization?.id) {
      showAlert('Missing organization', 'Select an active workspace first.');
      return;
    }
    if (!selectedProgramId) {
      showAlert('Missing program', 'Choose a program before assigning.');
      return;
    }
    if (!displayName.trim() && !email.trim()) {
      showAlert('Missing person details', 'Provide at least a name or an email.');
      return;
    }

    try {
      setSaving(true);
      await programService.createProgramParticipant({
        organization_id: activeOrganization.id,
        program_id: selectedProgramId,
        session_id: selectedSessionId,
        display_name: displayName.trim() || null,
        email: email.trim() || null,
        role,
        status,
        metadata: {
          source: 'program_assign_screen',
        },
      });

      const nextParticipants = await programService.listProgramParticipants(selectedProgramId, {
        sessionId: selectedSessionId,
        limit: 1000,
      });
      setParticipants(nextParticipants);
      setDisplayName('');
      setEmail('');
      setStatus('active');
      setHasMutations(true);
    } catch (error: any) {
      showAlert('Assignment failed', error?.message || 'Unable to assign participant');
    } finally {
      setSaving(false);
    }
  };

  const updateParticipant = async (
    participantId: string,
    updates: Partial<Pick<ProgramParticipantRecord, 'role' | 'status'>>
  ) => {
    if (!activeOrganization?.id || !selectedProgramId) return;
    try {
      await programService.updateProgramParticipant(participantId, updates);
      const nextParticipants = await programService.listProgramParticipants(selectedProgramId, {
        sessionId: selectedSessionId,
        limit: 1000,
      });
      setParticipants(nextParticipants);
      setHasMutations(true);
    } catch (error: any) {
      showAlert('Update failed', error?.message || 'Unable to update assignment');
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!activeOrganization?.id || !selectedProgramId) return;
    showConfirm(
      'Remove assignment',
      'Remove this person from the selected program?',
      async () => {
        try {
          await programService.removeProgramParticipant(participantId);
          const nextParticipants = await programService.listProgramParticipants(selectedProgramId, {
            sessionId: selectedSessionId,
            limit: 1000,
          });
          setParticipants(nextParticipants);
          setHasMutations(true);
        } catch (error: any) {
          showAlert('Remove failed', error?.message || 'Unable to remove assignment');
        }
      },
      { destructive: true },
    );
  };

  if (ready && (!activeOrganization?.id || !isInstitutionOrganization)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.gateState}>
          <Ionicons name="alert-circle-outline" size={24} color="#B91C1C" />
          <ThemedText style={styles.gateStateTitle}>Assignments require an institution organization</ThemedText>
          <ThemedText style={styles.gateStateBody}>
            Switch to an institution workspace before managing program assignments.
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Program Assignments</ThemedText>
            <ThemedText style={styles.subtitle}>Assign faculty, staff, and learners to programs and sessions.</ThemedText>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
              onPress={() => {
                if (selectedProgramId) {
                  void loadProgramScopedData(selectedProgramId, selectedSessionId);
                  return;
                }
                void loadPrograms();
            }}
          >
            <Ionicons name="refresh" size={18} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Loading programs…</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <ThemedText style={styles.fieldLabel}>Program</ThemedText>
              <View style={styles.chipRow}>
                {programs.map((row) => {
                  const active = selectedProgramId === row.id;
                  return (
                    <TouchableOpacity
                      key={row.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedProgramId(row.id)}
                    >
                      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{row.title}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>Session (optional)</ThemedText>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedSessionId && styles.chipActive]}
                  onPress={() => setSelectedSessionId(null)}
                >
                  <ThemedText style={[styles.chipText, !selectedSessionId && styles.chipTextActive]}>None</ThemedText>
                </TouchableOpacity>
                {sessionOptions.map((row) => {
                  const active = selectedSessionId === row.id;
                  return (
                    <TouchableOpacity
                      key={row.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedSessionId(row.id)}
                    >
                      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{row.title}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>Role</ThemedText>
              <View style={styles.chipRow}>
                {resolvedRoleOptions.map((option) => {
                  const active = role === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setRole(option)}
                    >
                      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{option}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>Status</ThemedText>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map((option) => {
                  const active = status === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatus(option)}
                    >
                      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{option}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>Name</ThemedText>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Person name"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />

              <ThemedText style={styles.fieldLabel}>Email</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@organization.edu"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={saving}>
                  <ThemedText style={styles.primaryButtonText}>{saving ? 'Assigning…' : 'Assign person'}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.sectionTitle}>Staff queue</ThemedText>
              {staffQueue.length === 0 ? (
                <ThemedText style={styles.emptyText}>No active staff assignments for this program.</ThemedText>
              ) : (
                <View style={styles.listColumn}>
                  {staffQueue.slice(0, 20).map((row) => {
                    const personLabel = row.display_name || row.email || 'Unspecified person';
                    const pending = row.user_id ? pendingByEvaluatorId[row.user_id] || 0 : 0;
                    return (
                      <View key={`staff-${row.id}`} style={styles.queueCard}>
                        <View style={styles.itemHeader}>
                          <ThemedText style={styles.itemTitle}>{personLabel}</ThemedText>
                          <View style={[styles.pill, pending > 0 ? styles.pillWarn : styles.pillOk]}>
                            <ThemedText style={styles.pillText}>{pending} pending</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.itemSub}>{row.role} • {row.status}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText style={styles.sectionTitle}>Current assignments</ThemedText>
                <TouchableOpacity style={styles.exportButton} onPress={exportFilteredCsv}>
                  <Ionicons name="download-outline" size={14} color="#1D4ED8" />
                  <ThemedText style={styles.exportButtonText}>Export CSV</ThemedText>
                </TouchableOpacity>
              </View>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search by name, email, or role"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <View style={styles.inlineFilters}>
                <View style={styles.inlineGroup}>
                  <ThemedText style={styles.inlineLabel}>Role filter</ThemedText>
                  <View style={styles.chipRow}>
                    {roleFilterOptions.map((option) => {
                      const active = filterRole === option;
                      return (
                        <TouchableOpacity
                          key={`filter-role-${option}`}
                          style={[styles.chipSmall, active && styles.chipActive]}
                          onPress={() => setFilterRole(option)}
                        >
                          <ThemedText style={[styles.chipTextSmall, active && styles.chipTextActive]}>{option}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.inlineGroup}>
                  <ThemedText style={styles.inlineLabel}>Status filter</ThemedText>
                  <View style={styles.chipRow}>
                    {(['all', ...STATUS_OPTIONS] as (ParticipantStatus | 'all')[]).map((option) => {
                      const active = filterStatus === option;
                      return (
                        <TouchableOpacity
                          key={`filter-status-${option}`}
                          style={[styles.chipSmall, active && styles.chipActive]}
                          onPress={() => setFilterStatus(option)}
                        >
                          <ThemedText style={[styles.chipTextSmall, active && styles.chipTextActive]}>{option}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.inlineGroup}>
                  <ThemedText style={styles.inlineLabel}>Sort</ThemedText>
                  <View style={styles.chipRow}>
                    {(['newest', 'oldest', 'name', 'role', 'status'] as AssignmentSortMode[]).map((option) => {
                      const active = sortMode === option;
                      return (
                        <TouchableOpacity
                          key={`sort-${option}`}
                          style={[styles.chipSmall, active && styles.chipActive]}
                          onPress={() => setSortMode(option)}
                        >
                          <ThemedText style={[styles.chipTextSmall, active && styles.chipTextActive]}>{option}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
              {filteredAssignments.length === 0 ? (
                <ThemedText style={styles.emptyText}>No assignments yet for this program.</ThemedText>
              ) : (
                <View style={styles.listColumn}>
                  {pagedAssignments.map((row) => {
                    const session = row.session_id ? sessionById.get(row.session_id) : null;
                    const program = programById.get(row.program_id);
                    const personLabel = row.display_name || row.email || 'Unspecified person';
                    return (
                      <View key={row.id} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <ThemedText style={styles.itemTitle}>{personLabel}</ThemedText>
                          <View style={styles.itemHeaderActions}>
                            {row.status === 'invited' ? (
                              <TouchableOpacity
                                style={styles.inviteAction}
                                onPress={() => {
                                  void handleInviteFromAssignment(row);
                                }}
                              >
                                <Ionicons name="mail-outline" size={14} color="#1D4ED8" />
                                <ThemedText style={styles.inviteActionText}>Invite</ThemedText>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity onPress={() => removeParticipant(row.id)}>
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <ThemedText style={styles.itemSub}>{program?.title || 'Program'}</ThemedText>
                        <ThemedText style={styles.itemSub}>
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                          {session ? ` • ${session.title}` : ''}
                        </ThemedText>

                        <View style={styles.inlineControls}>
                          <View style={styles.inlineGroup}>
                            <ThemedText style={styles.inlineLabel}>Role</ThemedText>
                            <View style={styles.chipRow}>
                              {resolvedRoleOptions.map((option) => {
                                const active = row.role === option;
                                return (
                                  <TouchableOpacity
                                    key={`${row.id}-role-${option}`}
                                    style={[styles.chipSmall, active && styles.chipActive]}
                                    onPress={() => void updateParticipant(row.id, { role: option })}
                                  >
                                    <ThemedText style={[styles.chipTextSmall, active && styles.chipTextActive]}>{option}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          <View style={styles.inlineGroup}>
                            <ThemedText style={styles.inlineLabel}>Status</ThemedText>
                            <View style={styles.chipRow}>
                              {STATUS_OPTIONS.map((option) => {
                                const active = row.status === option;
                                return (
                                  <TouchableOpacity
                                    key={`${row.id}-status-${option}`}
                                    style={[styles.chipSmall, active && styles.chipActive]}
                                    onPress={() => void updateParticipant(row.id, { status: option })}
                                  >
                                    <ThemedText style={[styles.chipTextSmall, active && styles.chipTextActive]}>{option}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {filteredAssignments.length > pagedAssignments.length ? (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() => setVisibleCount((prev) => prev + 40)}
                    >
                      <ThemedText style={styles.loadMoreText}>
                        Load more ({filteredAssignments.length - pagedAssignments.length} remaining)
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 13 },
  loadingBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { color: '#64748B', fontSize: 13 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  fieldLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipSmall: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: '#007AFF', backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextSmall: { fontSize: 11, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#1D4ED8' },
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
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  exportButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exportButtonText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },
  emptyText: { color: '#64748B', fontSize: 13 },
  listColumn: { gap: 8 },
  queueCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 4,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 6,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
  itemSub: { fontSize: 12, color: '#475569' },
  inviteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inviteActionText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillWarn: { backgroundColor: '#FEF3C7' },
  pillOk: { backgroundColor: '#DCFCE7' },
  pillText: { fontSize: 10, fontWeight: '700', color: '#334155' },
  inlineControls: { gap: 8, marginTop: 4 },
  inlineFilters: { gap: 8 },
  inlineGroup: { gap: 4 },
  inlineLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  loadMoreButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
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
