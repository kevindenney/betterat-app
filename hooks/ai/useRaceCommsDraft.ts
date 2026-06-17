import { useCallback, useMemo, useState } from 'react';
import { invokeAIEdgeFunction } from '@/services/ai/invokeAIEdgeFunction';

export type RaceCommsUrgency = 'low' | 'medium' | 'high';

export interface RaceCommsDraft {
  urgency: RaceCommsUrgency;
  sms: string;
  email: string;
  notice_board: string;
  suggested_send_time?: string | null;
}

export interface UseRaceCommsDraftOptions {
  raceId: string | null;
  enabled?: boolean;
}

export interface UseRaceCommsDraftReturn {
  draft: RaceCommsDraft | null;
  isGenerating: boolean;
  error: string | null;
  generate: () => Promise<RaceCommsDraft | null>;
  reset: () => void;
  lastGeneratedAt: Date | null;
}

export function useRaceCommsDraft(options: UseRaceCommsDraftOptions): UseRaceCommsDraftReturn {
  const { raceId, enabled = true } = options;
  const [draft, setDraft] = useState<RaceCommsDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const ready = useMemo(() => enabled && !!raceId, [enabled, raceId]);

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
    setLastGeneratedAt(null);
  }, []);

  const generate = useCallback(async () => {
    if (!ready) {
      setError('Race context not available yet.');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data: payload, error: invokeError } = await invokeAIEdgeFunction<
        RaceCommsDraft & { error?: string }
      >('ai-race-comms-draft', {
        body: { raceId },
      });

      if (invokeError || !payload || payload.error) {
        throw new Error(
          invokeError?.message || payload?.error || 'Unable to generate race communications',
        );
      }

      const result: RaceCommsDraft = {
        urgency: payload.urgency,
        sms: payload.sms,
        email: payload.email,
        notice_board: payload.notice_board,
        suggested_send_time: payload.suggested_send_time ?? null,
      };

      setDraft(result);
      setLastGeneratedAt(new Date());
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [raceId, ready]);

  return {
    draft,
    isGenerating,
    error,
    generate,
    reset,
    lastGeneratedAt,
  };
}
