import { supabase } from '@/services/supabase';
import { getUserTimeline } from '@/services/TimelineStepService';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const RACE_STATUSES = new Set(['finished', 'dnf', 'dns', 'dsq', 'ocs', 'ret']);

export async function getSailingReflectLogEntries(userId: string): Promise<RaceLogEntry[]> {
  const { data: participants, error: participantsError } = await supabase
    .from('race_participants')
    .select('regatta_id, finish_position, points_scored, status')
    .eq('user_id', userId)
    .neq('status', 'withdrawn');

  if (participantsError) throw participantsError;

  const participantRegattaIds = (participants ?? [])
    .map((participant: any) => participant.regatta_id)
    .filter(Boolean);
  const ownedOrParticipatedFilter = participantRegattaIds.length > 0
    ? `created_by.eq.${userId},id.in.(${participantRegattaIds.join(',')})`
    : `created_by.eq.${userId}`;

  const { data: regattas, error: regattasError } = await supabase
    .from('regattas')
    .select('*')
    .or(ownedOrParticipatedFilter)
    .order('start_date', { ascending: false })
    .limit(200);

  if (regattasError) throw regattasError;

  const participantByRegatta = new Map(
    (participants ?? []).map((participant: any) => [participant.regatta_id, participant]),
  );
  const now = new Date();

  return (regattas ?? []).map((regatta: any): RaceLogEntry => {
    const participant = participantByRegatta.get(regatta.id);
    const startDate = regatta.start_date ?? regatta.date ?? regatta.created_at;
    const isUpcoming = new Date(startDate) > now;
    const participantStatus = String(participant?.status ?? '');
    const status = isUpcoming
      ? 'upcoming'
      : RACE_STATUSES.has(participantStatus)
        ? participantStatus as RaceLogEntry['status']
        : 'finished';

    return {
      id: regatta.id,
      regattaId: regatta.id,
      name: regatta.race_name || regatta.name || 'Untitled Race',
      date: startDate,
      venueName: regatta.metadata?.venue_name || regatta.venue_name || null,
      venueLocation: regatta.metadata?.location || null,
      fleetSize: regatta.metadata?.fleet_size || 0,
      position: participant?.finish_position || null,
      status,
      conditions: regatta.metadata?.conditions || null,
      boatClass: regatta.metadata?.boat_class || null,
      isOwner: regatta.created_by === userId,
    };
  });
}

export async function getTimelineReflectLogSteps(
  userId: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  return getUserTimeline(userId, interestId);
}
