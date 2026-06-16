import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import {
  ProgramParticipantRecord,
  ProgramRecord,
  ProgramSessionRecord,
  programService,
} from '@/services/ProgramService';

type AttendanceState = 'present' | 'absent' | 'pending';

export default function SessionBuilderScreen() {
  const params = useLocalSearchParams<{ programId?: string }>();
  const { user } = useAuth();
  const { activeOrganization, ready } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [sessions, setSessions] = useState<ProgramSessionRecord[]>([]);
  const [participants, setParticipants] = useState<ProgramParticipantRecord[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [objectives, setObjectives] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [attendanceByParticipantId, setAttendanceByParticipantId] = useState<Record<string, AttendanceState>>({});

  useEffect(() => {
    const load = async () => {
      if (!ready || !activeOrganization?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const nextPrograms = await programService.listPrograms(activeOrganization.id);
        setPrograms(nextPrograms);
        const routeProgramId = String(params.programId || '');
        const resolvedProgramId = nextPrograms.some((row) => row.id === routeProgramId)
          ? routeProgramId
          : nextPrograms[0]?.id || null;
        setSelectedProgramId(resolvedProgramId);
      } catch (error) {
        console.error('[session-builder] failed to load programs', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeOrganization?.id, params.programId, ready]);

  useEffect(() => {
    const loadScoped = async () => {
      if (!activeOrganization?.id || !selectedProgramId) {
        setSessions([]);
        setParticipants([]);
        setSelectedSessionId(null);
        return;
      }
      try {
        const [nextSessions, nextParticipants] = await Promise.all([
          programService.listProgramSessions(selectedProgramId),
          programService.listProgramParticipants(selectedProgramId, { limit: 1000 }),
        ]);
        setSessions(nextSessions);
        setParticipants(nextParticipants);
        setSelectedSessionId((current) => {
          if (current && nextSessions.some((row) => row.id === current)) return current;
          return nextSessions[0]?.id || null;
        });
      } catch (error) {
        console.error('[session-builder] failed to load program scope', error);
      }
    };
    void loadScoped();
  }, [activeOrganization?.id, selectedProgramId]);

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === selectedSessionId) || null,
    [selectedSessionId, sessions]
  );

  useEffect(() => {
    const metadata = (selectedSession?.metadata || {}) as Record<string, unknown>;
    const builder = (metadata.session_builder || {}) as Record<string, unknown>;
    setObjectives(String(builder.objectives || ''));
    const checklistRows = Array.isArray(builder.checklist) ? builder.checklist.map((item) => String(item || '')) : [];
    setChecklistText(checklistRows.join('\n'));
    setQuickNotes(String(builder.quick_notes || ''));

    const attendance = (builder.attendance || {}) as Record<string, unknown>;
    const mapped: Record<string, AttendanceState> = {};
    for (const [participantId, value] of Object.entries(attendance)) {
      const normalized = String(value || '').trim().toLowerCase();
      mapped[participantId] =
        normalized === 'present' || normalized === 'absent' || normalized === 'pending'
          ? (normalized as AttendanceState)
          : 'pending';
    }
    setAttendanceByParticipantId(mapped);
  }, [selectedSession?.id, selectedSession?.metadata]);

  const visibleParticipants = useMemo(() => {
    if (!selectedSessionId) return participants;
    return participants.filter((row) => !row.session_id || row.session_id === selectedSessionId);
  }, [participants, selectedSessionId]);

  const checklistItems = useMemo(
    () =>
      checklistText
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean),
    [checklistText]
  );

  const updateAttendance = (participantId: string) => {
    setAttendanceByParticipantId((prev) => {
      const current = prev[participantId] || 'pending';
      const next: AttendanceState = current === 'pending' ? 'present' : current === 'present' ? 'absent' : 'pending';
      return {
        ...prev,
        [participantId]: next,
      };
    });
  };

  const saveSessionBuilder = async () => {
    if (!selectedSession?.id || !user?.id) {
      showAlert('Not ready', 'Select a session and ensure you are signed in.');
      return;
    }
    try {
      setSaving(true);
      const sessionMetadata = (selectedSession.metadata || {}) as Record<string, unknown>;
      const nextMetadata = {
        ...sessionMetadata,
        session_builder: {
          objectives: objectives.trim(),
          checklist: checklistItems,
          quick_notes: quickNotes.trim(),
          attendance: attendanceByParticipantId,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
      };
      const updated = await programService.updateProgramSession(selectedSession.id, {
        metadata: nextMetadata,
      });
      setSessions((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      showAlert('Saved', 'Session builder details were saved.');
    } catch (error: any) {
      showAlert('Save failed', error?.message || 'Unable to save session details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading session builder…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Ionicons name="construct-outline" size={20} color="#007AFF" />
          <View>
            <ThemedText style={styles.title}>Session Builder</ThemedText>
            <ThemedText style={styles.subtitle}>Objectives, checklist, attendance, and quick notes.</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.label}>Program</ThemedText>
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

        <ThemedText style={styles.label}>Session</ThemedText>
        <View style={styles.chipRow}>
          {sessions.map((row) => {
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

        <ThemedText style={styles.label}>Objectives</ThemedText>
        <TextInput
          value={objectives}
          onChangeText={setObjectives}
          placeholder="What should learners achieve today?"
          style={[styles.input, styles.multiline]}
          multiline
          placeholderTextColor="#94A3B8"
        />

        <ThemedText style={styles.label}>Checklist (one item per line)</ThemedText>
        <TextInput
          value={checklistText}
          onChangeText={setChecklistText}
          placeholder="Safety brief&#10;Equipment check&#10;Competency station"
          style={[styles.input, styles.multiline]}
          multiline
          placeholderTextColor="#94A3B8"
        />

        <ThemedText style={styles.label}>Quick notes</ThemedText>
        <TextInput
          value={quickNotes}
          onChangeText={setQuickNotes}
          placeholder="Capture session highlights and follow-ups"
          style={[styles.input, styles.multiline]}
          multiline
          placeholderTextColor="#94A3B8"
        />

        <ThemedText style={styles.label}>Attendance</ThemedText>
        <View style={styles.listColumn}>
          {visibleParticipants.map((participant) => {
            const state = attendanceByParticipantId[participant.id] || 'pending';
            const label = participant.display_name || participant.email || participant.role || 'Participant';
            return (
              <TouchableOpacity
                key={participant.id}
                style={styles.attendanceRow}
                onPress={() => updateAttendance(participant.id)}
              >
                <ThemedText style={styles.attendanceName}>{label}</ThemedText>
                <View
                  style={[
                    styles.attendanceBadge,
                    state === 'present'
                      ? styles.badgePresent
                      : state === 'absent'
                        ? styles.badgeAbsent
                        : styles.badgePending,
                  ]}
                >
                  <ThemedText style={styles.attendanceBadgeText}>{state}</ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveSessionBuilder} disabled={saving}>
          <Ionicons name="save-outline" size={16} color="#FFFFFF" />
          <ThemedText style={styles.saveText}>{saving ? 'Saving…' : 'Save Session Builder'}</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 12 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#64748B', fontSize: 13 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B' },
  label: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: '#007AFF', backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#1D4ED8' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  listColumn: { gap: 8 },
  attendanceRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendanceName: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  attendanceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgePresent: { backgroundColor: '#DCFCE7' },
  badgeAbsent: { backgroundColor: '#FEE2E2' },
  badgePending: { backgroundColor: '#E2E8F0' },
  attendanceBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', color: '#334155' },
  saveButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
