/**
 * usePracticeSession Hook
 *
 * Manages a single practice session with members, focus areas, and drills.
 * Provides real-time sync of session members.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { practiceSessionService } from '@/services/PracticeSessionService';
import {
  PracticeSession,
  PracticeSessionMember,
  PracticeFocusArea,
  PracticeSessionDrill,
  UpdatePracticeSessionInput,
  SessionReflectionInput,
  JoinPracticeInput,
  SkillArea,
  RSVPStatus,
} from '@/types/practice';
import { PRACTICE_QUERY_KEYS } from './usePracticeSessions';

interface UsePracticeSessionOptions {
  sessionId: string;
  enabled?: boolean;
}

interface UsePracticeSessionReturn {
  // Data
  session: PracticeSession | null;
  members: PracticeSessionMember[];
  focusAreas: PracticeFocusArea[];
  drills: PracticeSessionDrill[];

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  isJoining: boolean;

  // Errors
  error: Error | null;

  // Computed
  isOrganizer: boolean;
  isMember: boolean;
  inviteCode: string | null;
  inviteLink: string | null;
  confirmedCount: number;
  totalMemberCount: number;
  primaryFocusArea: PracticeFocusArea | null;

  // Session actions
  updateSession: (updates: UpdatePracticeSessionInput) => Promise<void>;
  startSession: () => Promise<void>;
  completeSession: (reflection: SessionReflectionInput) => Promise<void>;
  cancelSession: () => Promise<void>;
  deleteSession: () => Promise<void>;

  // Invite actions
  generateInviteCode: () => Promise<string>;
  clearInviteCode: () => Promise<void>;

  // Member actions
  joinSession: (input: JoinPracticeInput) => Promise<void>;
  leaveSession: () => Promise<void>;
  updateRsvp: (status: RSVPStatus) => Promise<void>;
  markAttendance: (memberId: string, attended: boolean) => Promise<void>;

  // Focus area actions
  addFocusAreas: (
    areas: { skillArea: SkillArea; priority: number }[]
  ) => Promise<void>;
  updateFocusAreaRating: (focusAreaId: string, rating: number, notes?: string) => Promise<void>;
  removeFocusArea: (focusAreaId: string) => Promise<void>;

  // Drill actions
  addDrills: (drillIds: string[]) => Promise<void>;
  updateDrillExecution: (
    sessionDrillId: string,
    updates: {
      completed?: boolean;
      rating?: number;
      notes?: string;
      actualDurationMinutes?: number;
    }
  ) => Promise<void>;
  removeDrill: (sessionDrillId: string) => Promise<void>;
  reorderDrills: (drillOrder: string[]) => Promise<void>;

  // Refresh
  refresh: () => void;
}

/**
 * Hook to manage a single practice session
 */
export function usePracticeSession({
  sessionId,
  enabled = true,
}: UsePracticeSessionOptions): UsePracticeSessionReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Local state for real-time member updates
  const [realtimeMembers, setRealtimeMembers] = useState<PracticeSessionMember[] | null>(null);
  const isMountedRef = useRef(true);
  const memberEffectRunIdRef = useRef(0);
  const activeSessionIdRef = useRef(sessionId);

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      memberEffectRunIdRef.current += 1;
    };
  }, []);

  // Query key for this session
  const queryKey = PRACTICE_QUERY_KEYS.session(sessionId);

  // Fetch session with all related data
  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => practiceSessionService.getSession(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Use realtime members if available, otherwise from query
  const members = useMemo(
    () => realtimeMembers ?? session?.members ?? [],
    [realtimeMembers, session?.members]
  );
  const focusAreas = useMemo(
    () => session?.focusAreas ?? [],
    [session?.focusAreas]
  );
  const drills = useMemo(
    () => session?.drills ?? [],
    [session?.drills]
  );

  // Computed values
  const isOrganizer = useMemo(() => {
    if (!user?.id || !session) return false;
    return session.createdBy === user.id;
  }, [user, session]);

  const isMember = useMemo(() => {
    if (!user?.id || !session) return false;
    return members.some((m) => m.userId === user.id);
  }, [user, session, members]);

  const inviteCode = session?.inviteCode || null;

  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    return `betterat://join-practice?code=${inviteCode}`;
  }, [inviteCode]);

  const confirmedCount = useMemo(
    () => members.filter((m) => m.rsvpStatus === 'accepted').length,
    [members]
  );

  const totalMemberCount = members.length;

  const primaryFocusArea = useMemo(
    () => focusAreas.find((fa) => fa.priority === 1) || focusAreas[0] || null,
    [focusAreas]
  );

  // Subscribe to real-time member updates
  useEffect(() => {
    if (!sessionId || !enabled) {
      if (isMountedRef.current) {
        setRealtimeMembers(null);
      }
      return;
    }
    const runId = ++memberEffectRunIdRef.current;
    const targetSessionId = sessionId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === memberEffectRunIdRef.current &&
      activeSessionIdRef.current === targetSessionId;
    if (isMountedRef.current) {
      setRealtimeMembers(null);
    }

    const unsubscribe = practiceSessionService.subscribeToMemberChanges(
      sessionId,
      (updatedMembers) => {
        if (!canCommit()) return;
        setRealtimeMembers(updatedMembers);
      }
    );

    return () => {
      memberEffectRunIdRef.current += 1;
      unsubscribe();
      if (isMountedRef.current && activeSessionIdRef.current === targetSessionId) {
        setRealtimeMembers(null);
      }
    };
  }, [sessionId, enabled]);

  // Helper to invalidate and refetch
  const invalidateSession = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: PRACTICE_QUERY_KEYS.upcoming() });
    queryClient.invalidateQueries({ queryKey: PRACTICE_QUERY_KEYS.past() });
  }, [queryClient, queryKey]);

  // Update session mutation
  const updateMutation = useMutation({
    mutationFn: (updates: UpdatePracticeSessionInput) =>
      practiceSessionService.updateSession(sessionId, updates),
    onSuccess: invalidateSession,
  });

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: () => practiceSessionService.startSession(sessionId),
    onSuccess: invalidateSession,
  });

  // Complete session mutation
  const completeMutation = useMutation({
    mutationFn: (reflection: SessionReflectionInput) =>
      practiceSessionService.completeSession(sessionId, reflection),
    onSuccess: invalidateSession,
  });

  // Cancel session mutation
  const cancelMutation = useMutation({
    mutationFn: () => practiceSessionService.cancelSession(sessionId),
    onSuccess: invalidateSession,
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: () => practiceSessionService.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: PRACTICE_QUERY_KEYS.upcoming() });
      queryClient.invalidateQueries({ queryKey: PRACTICE_QUERY_KEYS.past() });
    },
  });

  // Generate invite code mutation
  const generateCodeMutation = useMutation({
    mutationFn: () => practiceSessionService.generateInviteCode(sessionId),
    onSuccess: (code) => {
      // Update session in cache with new invite code
      queryClient.setQueryData<PracticeSession | null>(queryKey, (old) =>
        old ? { ...old, inviteCode: code } : null
      );
    },
  });

  // Clear invite code mutation
  const clearCodeMutation = useMutation({
    mutationFn: () => practiceSessionService.clearInviteCode(sessionId),
    onSuccess: () => {
      queryClient.setQueryData<PracticeSession | null>(queryKey, (old) =>
        old ? { ...old, inviteCode: undefined } : null
      );
    },
  });

  // Join session mutation
  const joinMutation = useMutation({
    mutationFn: (input: JoinPracticeInput) => practiceSessionService.joinSession(input),
    onSuccess: invalidateSession,
  });

  // Leave session mutation
  const leaveMutation = useMutation({
    mutationFn: () => practiceSessionService.leaveSession(sessionId),
    onSuccess: invalidateSession,
  });

  // Update RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: (status: RSVPStatus) => practiceSessionService.updateRsvp(sessionId, status),
    onSuccess: invalidateSession,
  });

  // Mark attendance mutation
  const attendanceMutation = useMutation({
    mutationFn: ({ memberId, attended }: { memberId: string; attended: boolean }) =>
      practiceSessionService.markAttendance(memberId, attended),
    onSuccess: invalidateSession,
  });

  // Focus area mutations
  const addFocusAreasMutation = useMutation({
    mutationFn: (areas: { skillArea: SkillArea; priority: number }[]) =>
      practiceSessionService.addFocusAreas(
        sessionId,
        areas.map((a) => ({ ...a, aiSuggested: false }))
      ),
    onSuccess: invalidateSession,
  });

  const updateFocusRatingMutation = useMutation({
    mutationFn: ({
      focusAreaId,
      rating,
      notes,
    }: {
      focusAreaId: string;
      rating: number;
      notes?: string;
    }) => practiceSessionService.updateFocusAreaRating(focusAreaId, rating, notes),
    onSuccess: invalidateSession,
  });

  const removeFocusAreaMutation = useMutation({
    mutationFn: (focusAreaId: string) => practiceSessionService.removeFocusArea(focusAreaId),
    onSuccess: invalidateSession,
  });

  // Drill mutations
  const addDrillsMutation = useMutation({
    mutationFn: (drillIds: string[]) => practiceSessionService.addDrills(sessionId, drillIds),
    onSuccess: invalidateSession,
  });

  const updateDrillMutation = useMutation({
    mutationFn: ({
      sessionDrillId,
      updates,
    }: {
      sessionDrillId: string;
      updates: { completed?: boolean; rating?: number; notes?: string; actualDurationMinutes?: number };
    }) => practiceSessionService.updateDrillExecution(sessionDrillId, updates),
    onSuccess: invalidateSession,
  });

  const removeDrillMutation = useMutation({
    mutationFn: (sessionDrillId: string) => practiceSessionService.removeDrill(sessionDrillId),
    onSuccess: invalidateSession,
  });

  const reorderDrillsMutation = useMutation({
    mutationFn: (drillOrder: string[]) =>
      practiceSessionService.reorderDrills(sessionId, drillOrder),
    onSuccess: invalidateSession,
  });

  // Check if any mutation is in progress
  const isUpdating =
    updateMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    deleteMutation.isPending ||
    generateCodeMutation.isPending ||
    clearCodeMutation.isPending;

  const isJoining = joinMutation.isPending || leaveMutation.isPending;

  return {
    // Data
    session: session ?? null,
    members,
    focusAreas,
    drills,

    // Loading states
    isLoading,
    isUpdating,
    isJoining,

    // Errors
    error: error as Error | null,

    // Computed
    isOrganizer,
    isMember,
    inviteCode,
    inviteLink,
    confirmedCount,
    totalMemberCount,
    primaryFocusArea,

    // Session actions
    updateSession: updateMutation.mutateAsync,
    startSession: startMutation.mutateAsync,
    completeSession: completeMutation.mutateAsync,
    cancelSession: cancelMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,

    // Invite actions
    generateInviteCode: generateCodeMutation.mutateAsync,
    clearInviteCode: clearCodeMutation.mutateAsync,

    // Member actions
    joinSession: async (input) => {
      await joinMutation.mutateAsync(input);
    },
    leaveSession: leaveMutation.mutateAsync,
    updateRsvp: rsvpMutation.mutateAsync,
    markAttendance: (memberId, attended) =>
      attendanceMutation.mutateAsync({ memberId, attended }),

    // Focus area actions
    addFocusAreas: addFocusAreasMutation.mutateAsync,
    updateFocusAreaRating: (focusAreaId, rating, notes) =>
      updateFocusRatingMutation.mutateAsync({ focusAreaId, rating, notes }),
    removeFocusArea: removeFocusAreaMutation.mutateAsync,

    // Drill actions
    addDrills: addDrillsMutation.mutateAsync,
    updateDrillExecution: (sessionDrillId, updates) =>
      updateDrillMutation.mutateAsync({ sessionDrillId, updates }),
    removeDrill: removeDrillMutation.mutateAsync,
    reorderDrills: reorderDrillsMutation.mutateAsync,

    // Refresh
    refresh: () => refetch(),
  };
}
