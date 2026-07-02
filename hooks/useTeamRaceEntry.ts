/**
 * useTeamRaceEntry Hook
 *
 * Manages team race entries for collaboration.
 * Provides real-time sync of team members and state.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { teamRaceEntryService } from '@/services/TeamRaceEntryService';
import {
  TeamRaceEntry,
  TeamRaceEntryMember,
  JoinTeamInput,
} from '@/types/teamRacing';
import type { RaceType } from '@/types/raceEvents';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useTeamRaceEntry');

interface UseTeamRaceEntryOptions {
  raceEventId: string;
  raceType: RaceType;
}

interface UseTeamRaceEntryReturn {
  // State
  teamEntry: TeamRaceEntry | null;
  members: TeamRaceEntryMember[];
  isLoading: boolean;
  isCreating: boolean;
  isJoining: boolean;
  error: Error | null;

  // Computed
  isTeamRace: boolean;
  isTeamMember: boolean;
  isTeamCreator: boolean;
  inviteCode: string | null;
  inviteLink: string | null;

  // Actions
  createTeamEntry: (teamName: string) => Promise<TeamRaceEntry>;
  generateInviteCode: () => Promise<string>;
  joinTeam: (input: JoinTeamInput) => Promise<void>;
  leaveTeam: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage team race entries and collaboration
 */
export function useTeamRaceEntry({
  raceEventId,
  raceType,
}: UseTeamRaceEntryOptions): UseTeamRaceEntryReturn {
  const { user } = useAuth();

  // State
  const [teamEntry, setTeamEntry] = useState<TeamRaceEntry | null>(null);
  const [members, setMembers] = useState<TeamRaceEntryMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const membersEffectRunIdRef = useRef(0);
  const activeRaceEventIdRef = useRef<string>(raceEventId);

  useEffect(() => {
    activeRaceEventIdRef.current = raceEventId;
  }, [raceEventId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
      membersEffectRunIdRef.current += 1;
    };
  }, []);

  // Only active for team racing
  const isTeamRace = raceType === 'team';

  // Computed values
  const isTeamMember = useMemo(() => {
    if (!user?.id || !teamEntry) return false;
    return members.some((m) => m.userId === user.id);
  }, [user, teamEntry, members]);

  const isTeamCreator = useMemo(() => {
    if (!user?.id || !teamEntry) return false;
    return teamEntry.createdBy === user.id;
  }, [user, teamEntry]);

  const inviteCode = teamEntry?.inviteCode || null;
  const teamEntryId = teamEntry?.id;

  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    // Use deep link format for mobile
    return `betterat://join-team?code=${inviteCode}`;
  }, [inviteCode]);

  /**
   * Load team entry for this race
   */
  const loadTeamEntry = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const targetRaceEventId = raceEventId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === loadRunIdRef.current &&
      activeRaceEventIdRef.current === targetRaceEventId;

    if (!targetRaceEventId || !isTeamRace) {
      if (!canCommit()) return;
      setTeamEntry(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const entry = await teamRaceEntryService.getTeamEntryForRace(targetRaceEventId);
      if (!canCommit()) return;
      setTeamEntry(entry);

      if (entry) {
        const teamMembers = await teamRaceEntryService.getTeamMembers(entry.id);
        if (!canCommit()) return;
        setMembers(teamMembers);
      } else {
        setMembers([]);
      }
    } catch (err) {
      logger.error('Failed to load team entry:', err);
      if (!canCommit()) return;
      setError(err instanceof Error ? err : new Error('Failed to load team entry'));
    } finally {
      if (!canCommit()) return;
      setIsLoading(false);
    }
  }, [raceEventId, isTeamRace]);

  /**
   * Create a new team entry
   */
  const createTeamEntry = useCallback(
    async (teamName: string): Promise<TeamRaceEntry> => {
      const targetRaceEventId = raceEventId;
      if (!user?.id) {
        throw new Error('Not authenticated');
      }

      try {
        if (!isMountedRef.current || activeRaceEventIdRef.current !== targetRaceEventId) {
          throw new Error('Race context changed');
        }
        setIsCreating(true);
        setError(null);

        const entry = await teamRaceEntryService.createTeamEntry({
          raceEventId: targetRaceEventId,
          teamName,
        });

        if (!isMountedRef.current || activeRaceEventIdRef.current !== targetRaceEventId) return entry;
        setTeamEntry(entry);

        // Load members (creator is auto-added)
        const teamMembers = await teamRaceEntryService.getTeamMembers(entry.id);
        if (!isMountedRef.current || activeRaceEventIdRef.current !== targetRaceEventId) return entry;
        setMembers(teamMembers);

        logger.info('Created team entry', { entryId: entry.id });
        return entry;
      } catch (err) {
        logger.error('Failed to create team entry:', err);
        if (!isMountedRef.current || activeRaceEventIdRef.current !== targetRaceEventId) throw err;
        setError(err instanceof Error ? err : new Error('Failed to create team'));
        throw err;
      } finally {
        if (!isMountedRef.current || activeRaceEventIdRef.current !== targetRaceEventId) return undefined as any;
        setIsCreating(false);
      }
    },
    [raceEventId, user]
  );

  /**
   * Generate invite code for teammates
   */
  const generateInviteCode = useCallback(async (): Promise<string> => {
    if (!teamEntry) {
      throw new Error('No team entry');
    }

    try {
      const code = await teamRaceEntryService.generateInviteCode(teamEntry.id);
      setTeamEntry((prev) => (prev ? { ...prev, inviteCode: code } : null));
      return code;
    } catch (err) {
      logger.error('Failed to generate invite code:', err);
      throw err;
    }
  }, [teamEntry]);

  /**
   * Join a team via invite code
   */
  const joinTeam = useCallback(
    async (input: JoinTeamInput): Promise<void> => {
      try {
        if (!isMountedRef.current) return;
        setIsJoining(true);
        setError(null);

        await teamRaceEntryService.joinTeam(input);

        // Reload to get updated entry and members
        await loadTeamEntry();

        logger.info('Joined team', { inviteCode: input.inviteCode });
      } catch (err) {
        logger.error('Failed to join team:', err);
        if (!isMountedRef.current) throw err;
        setError(err instanceof Error ? err : new Error('Failed to join team'));
        throw err;
      } finally {
        if (!isMountedRef.current) return;
        setIsJoining(false);
      }
    },
    [loadTeamEntry]
  );

  /**
   * Leave the team
   */
  const leaveTeam = useCallback(async (): Promise<void> => {
    if (!teamEntry) {
      throw new Error('Not in a team');
    }

    try {
      await teamRaceEntryService.leaveTeam(teamEntry.id);
      if (!isMountedRef.current) return;
      setTeamEntry(null);
      setMembers([]);
      logger.info('Left team', { entryId: teamEntry.id });
    } catch (err) {
      logger.error('Failed to leave team:', err);
      throw err;
    }
  }, [teamEntry]);

  /**
   * Refresh team data
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadTeamEntry();
  }, [loadTeamEntry]);

  // Load team entry on mount and when race changes
  useEffect(() => {
    loadTeamEntry();
  }, [loadTeamEntry]);

  // Subscribe to member changes when we have a team entry
  useEffect(() => {
    if (!teamEntryId) return;
    const runId = ++membersEffectRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === membersEffectRunIdRef.current;

    const unsubscribe = teamRaceEntryService.subscribeToMemberChanges(
      teamEntryId,
      (updatedMembers) => {
        if (!canCommit()) return;
        setMembers(updatedMembers);
      }
    );

    return () => {
      membersEffectRunIdRef.current += 1;
      unsubscribe();
    };
  }, [teamEntryId]);

  return {
    // State
    teamEntry,
    members,
    isLoading,
    isCreating,
    isJoining,
    error,

    // Computed
    isTeamRace,
    isTeamMember,
    isTeamCreator,
    inviteCode,
    inviteLink,

    // Actions
    createTeamEntry,
    generateInviteCode,
    joinTeam,
    leaveTeam,
    refresh,
  };
}

export default useTeamRaceEntry;
