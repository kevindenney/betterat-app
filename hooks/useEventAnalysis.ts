/**
 * useEventAnalysis Hook
 *
 * Interest-aware hook for reading AI event analysis.
 * Maps between the sailing-specific ai_coach_analysis table format
 * and the universal AiEventAnalysis type based on current interest.
 *
 * For sailing: reads from ai_coach_analysis table, maps to universal format
 * For other interests: reads from the same table using JSONB sections field
 *   (once the schema is extended), or returns null if no analysis exists
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { createLogger } from '@/lib/utils/logger';
import type {
  AiEventAnalysis,
  AiCoachAnalysisSummary,
} from '@/types/raceAnalysis';
import { mapSailingAnalysisToUniversal } from '@/types/raceAnalysis';

const logger = createLogger('useEventAnalysis');

export interface UseEventAnalysisParams {
  /** Race / event ID */
  eventId: string | null | undefined;
  /** User / sailor ID */
  userId: string | null | undefined;
}

export interface UseEventAnalysisReturn {
  /** Universal analysis data (null if none exists) */
  analysis: AiEventAnalysis | null;
  /** Analysis sections config from current interest */
  sectionConfigs: { id: string; label: string; description: string }[];
  /** Framework score configs from current interest */
  frameworkConfigs: { id: string; label: string; description: string }[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refetch from database */
  refetch: () => Promise<void>;
}

export function useEventAnalysis({
  eventId,
  userId,
}: UseEventAnalysisParams): UseEventAnalysisReturn {
  const eventConfig = useInterestEventConfig();
  const [analysis, setAnalysis] = useState<AiEventAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAnalysis = useCallback(async () => {
    // Bail for synthetic ids (demo data) and optimistic `temp-` ids — both
    // would 400 against `regatta_id=eq.{id}` (UUID-typed column).
    if (!eventId || !userId || eventId.startsWith('demo-') || eventId.startsWith('temp-')) {
      setAnalysis(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (eventConfig.interestSlug === 'sail-racing') {
        // Sailing: read from existing ai_coach_analysis table via timer session
        let sessionData: any = null;
        let sessionError: any = null;

        const primary = await supabase
          .from('race_timer_sessions')
          .select('id')
          .eq('regatta_id', eventId)
          .eq('sailor_id', userId)
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        sessionData = primary.data;
        sessionError = primary.error;

        if (isMissingIdColumn(sessionError, 'race_timer_sessions', 'regatta_id')) {
          const fallback = await supabase
            .from('race_timer_sessions')
            .select('id')
            .eq('race_id', eventId)
            .eq('sailor_id', userId)
            .order('end_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          sessionData = fallback.data;
          sessionError = fallback.error;
        }

        if (sessionError) {
          throw sessionError;
        }

        if (!sessionData) {
          if (isMountedRef.current) {
            setAnalysis(null);
            setIsLoading(false);
          }
          return;
        }

        // Fetch AI analysis for this session
        const { data: aiData, error: aiError } = await supabase
          .from('ai_coach_analysis')
          .select(
            'timer_session_id, confidence_score, overall_summary, start_analysis, upwind_analysis, downwind_analysis, tactical_decisions, boat_handling, recommendations, plan_vs_execution, created_at, updated_at'
          )
          .eq('timer_session_id', sessionData.id)
          .maybeSingle();

        if (aiError) {
          throw aiError;
        }

        if (isMountedRef.current) {
          if (aiData) {
            setAnalysis(mapSailingAnalysisToUniversal(aiData as AiCoachAnalysisSummary));
          } else {
            setAnalysis(null);
          }
        }
      } else {
        // Non-sailing interests: will use JSONB sections column once schema is extended
        // For now, return null — no AI analysis exists yet for these interests
        if (isMountedRef.current) {
          setAnalysis(null);
        }
      }
    } catch (err) {
      logger.error('[useEventAnalysis] Load error:', err);
      if (isMountedRef.current) {
        setError('Failed to load analysis');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [eventId, userId, eventConfig.interestSlug]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  return {
    analysis,
    sectionConfigs: eventConfig.aiAnalysisSections,
    frameworkConfigs: eventConfig.frameworkScores,
    isLoading,
    error,
    refetch: loadAnalysis,
  };
}

export default useEventAnalysis;
