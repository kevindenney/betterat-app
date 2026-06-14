import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtimeService } from '@/services/RealtimeService';

export type CoachHomeRealtimePayload = {
  table?: string;
  eventType?: string;
  commit_timestamp?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

type CreateCoachHomeRealtimeControllerParams = {
  organizationId: string;
  userId: string;
  runId: number;
  isActiveRun: () => boolean;
  scheduleRefresh: (delayMs?: number) => void;
  now?: () => number;
};

const DUPLICATE_WINDOW_MS = 5_000;
const SIGNATURE_TTL_MS = 90_000;

export function createCoachHomeRealtimeController(params: CreateCoachHomeRealtimeControllerParams) {
  const now = params.now ?? (() => Date.now());
  const seenSignatures = new Map<string, number>();

  let disposed = false;
  const channelName = `coach-home-counters:${params.organizationId}:${params.userId}:${params.runId}`;

  const canCommit = () => !disposed && params.isActiveRun();

  const buildKeyId = (payload: CoachHomeRealtimePayload): string => {
    const table = String(payload.table || '');
    const next = (payload.new || {}) as Record<string, unknown>;
    const old = (payload.old || {}) as Record<string, unknown>;

    if (table === 'assessment_records' || table === 'communication_messages') {
      return String(next.id || old.id || '');
    }
    if (table === 'communication_thread_reads') {
      const threadId = String(next.thread_id || old.thread_id || '');
      const readUserId = String(next.user_id || old.user_id || '');
      return `${threadId}:${readUserId}`;
    }
    return '';
  };

  const isDuplicateRealtimeEvent = (payload: CoachHomeRealtimePayload): boolean => {
    const table = String(payload.table || '');
    const eventType = String(payload.eventType || '');
    const commitTs = String(payload.commit_timestamp || '');
    const keyId = buildKeyId(payload);
    const signature = `${table}|${eventType}|${commitTs}|${keyId}`;
    const tsNow = now();

    for (const [key, ts] of seenSignatures.entries()) {
      if (tsNow - ts > SIGNATURE_TTL_MS) {
        seenSignatures.delete(key);
      }
    }

    const previous = seenSignatures.get(signature);
    if (previous && tsNow - previous < DUPLICATE_WINDOW_MS) {
      return true;
    }

    seenSignatures.set(signature, tsNow);
    return false;
  };

  const onRealtimePayload = (payload: CoachHomeRealtimePayload) => {
    if (!canCommit()) return;
    if (isDuplicateRealtimeEvent(payload)) return;

    const table = String(payload.table || '');
    const next = (payload.new || {}) as Record<string, unknown>;
    const old = (payload.old || {}) as Record<string, unknown>;

    if (table === 'assessment_records') {
      const evaluatorId = String(next.evaluator_id || old.evaluator_id || '');
      if (evaluatorId !== params.userId) return;
    }

    if (table === 'communication_messages') {
      const senderId = String(next.sender_id || old.sender_id || '');
      if (senderId && senderId === params.userId) return;
    }

    if (table === 'communication_thread_reads') {
      const readUserId = String(next.user_id || old.user_id || '');
      if (readUserId !== params.userId) return;
    }

    params.scheduleRefresh();
  };

  const handlePayload = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    onRealtimePayload(payload as CoachHomeRealtimePayload);
  };

  const onStatus = (status: string) => {
    if (!canCommit()) return;
    if (status === 'SUBSCRIBED') {
      params.scheduleRefresh(0);
    }
  };

  const filter = `organization_id=eq.${params.organizationId}`;
  realtimeService.subscribe<Record<string, unknown>>(
    channelName,
    {
      table: 'assessment_records',
      event: '*',
      schema: 'public',
      filter,
      onStatus,
      changes: [
        { event: '*', schema: 'public', table: 'assessment_records', filter },
        { event: '*', schema: 'public', table: 'communication_messages', filter },
        { event: '*', schema: 'public', table: 'communication_thread_reads', filter },
      ],
    },
    handlePayload
  );

  return {
    dispose: () => {
      disposed = true;
      void realtimeService.unsubscribe(channelName, handlePayload, onStatus);
    },
  };
}
