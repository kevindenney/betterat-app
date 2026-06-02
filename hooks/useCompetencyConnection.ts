/**
 * useCompetencyConnection — Links a lesson's step annotations to its mapped competencies.
 *
 * Given a lessonId and the competencyIds from lesson_data, this hook:
 *   1. Resolves competency_number → full competency definition + progress
 *   2. Computes aggregate confidence from step annotations
 *   3. Syncs annotation confidence to competency progress (not_started → learning)
 *
 * The sync is conservative: it only advances status forward and never
 * goes beyond "learning". Clinical attempts and preceptor validation
 * handle the rest of the progression chain.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useInterest } from '@/providers/InterestProvider'
import type {
  Competency,
  CompetencyProgress,
  CompetencyStatus,
  SelfRating,
} from '@/types/competency'
import type { ConfidenceLevel } from '@/hooks/useStepAnnotations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetencyConnectionInfo {
  competency: Competency
  progress: CompetencyProgress | null
}

interface AggregateConfidence {
  /** Average score (1–4 scale) across rated steps */
  averageScore: number
  /** Mapped to a SelfRating label */
  level: SelfRating
  /** Number of steps that have a confidence rating */
  ratedCount: number
  /** Total steps in the lesson */
  totalSteps: number
  /** Percentage of steps rated */
  coveragePercent: number
}

// Score mapping
const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = {
  needs_practice: 1,
  developing: 2,
  proficient: 3,
  confident: 4,
}

function scoreToLevel(score: number): SelfRating {
  if (score >= 3.5) return 'confident'
  if (score >= 2.5) return 'proficient'
  if (score >= 1.5) return 'developing'
  return 'needs_practice'
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompetencyConnection(
  lessonId: string | undefined,
  competencyNumbers: number[],
  annotationStats: { ratedCount: number; totalAnnotated: number },
  totalSteps: number,
) {
  const { user } = useAuth()
  const { currentInterest } = useInterest()
  const queryClient = useQueryClient()
  const hasSynced = useRef(false)

  const userId = user?.id
  const interestId = currentInterest?.id
  const enabled = Boolean(userId && interestId && competencyNumbers.length > 0)

  // Fetch competency definitions + progress for this lesson's mapped competencies
  const { data, isLoading } = useQuery<CompetencyConnectionInfo[]>({
    queryKey: ['competency-connection', interestId, competencyNumbers.join(','), userId],
    queryFn: async () => {
      if (!interestId || !userId) return []

      // Resolve competency_number → competency rows
      const { data: competencies, error: compError } = await supabase
        .from('betterat_competencies')
        .select('*')
        .eq('interest_id', interestId)
        .in('competency_number', competencyNumbers)

      if (compError) throw compError
      if (!competencies || competencies.length === 0) return []

      // Fetch progress for each (gracefully degrade if RLS blocks access)
      const compIds = competencies.map((c: Competency) => c.id)
      const { data: progressRows, error: progError } = await supabase
        .from('betterat_competency_progress')
        .select('*')
        .eq('user_id', userId)
        .in('competency_id', compIds)

      // Don't throw on progress errors — show competency info even without progress
      if (progError && !progError.message.includes('infinite recursion')) {
        console.warn('[useCompetencyConnection] progress fetch error:', progError.message)
      }

      const progressMap = new Map<string, CompetencyProgress>()
      for (const row of ((progressRows ?? []) as CompetencyProgress[])) {
        progressMap.set(row.competency_id, row)
      }

      return competencies.map((comp: Competency) => ({
        competency: comp,
        progress: progressMap.get(comp.id) ?? null,
      }))
    },
    enabled,
    staleTime: 0, // Always re-fetch (competency progress can change any time)
  })

  const connections = useMemo(() => data ?? [], [data])

  // Sync: ensure competency progress exists at "learning" when student has rated steps
  const syncToCompetency = useCallback(async () => {
    if (!userId || !interestId || connections.length === 0) return
    if (annotationStats.ratedCount === 0) return

    const newRows = connections
      .filter((conn) => conn.progress === null)
      .map((conn) => ({
        user_id: userId,
        competency_id: conn.competency.id,
        status: 'learning' as CompetencyStatus,
        attempts_count: 0,
        notes: 'Started from lesson study — self-rating step annotations.',
      }))

    if (newRows.length === 0) return

    // Single batch insert; ignoreDuplicates tolerates rows another process
    // created (the (user_id, competency_id) unique constraint).
    const { error } = await supabase
      .from('betterat_competency_progress')
      .upsert(newRows, {
        onConflict: 'user_id,competency_id',
        ignoreDuplicates: true,
      })

    if (error) {
      console.warn('[useCompetencyConnection] sync error:', error.message)
      return
    }

    // Invalidate once after the batch so the UI updates
    queryClient.invalidateQueries({ queryKey: ['competency-connection', interestId] })
    queryClient.invalidateQueries({ queryKey: ['competency-progress', userId, interestId] })
    queryClient.invalidateQueries({ queryKey: ['competency-summary', userId, interestId] })
  }, [userId, interestId, connections, annotationStats.ratedCount, queryClient])

  // Auto-sync when rated count changes (debounced by the confidence setter)
  useEffect(() => {
    if (annotationStats.ratedCount > 0 && connections.length > 0) {
      const hasUnstartedCompetency = connections.some((c) => c.progress === null)
      if (hasUnstartedCompetency && !hasSynced.current) {
        hasSynced.current = true
        syncToCompetency()
      }
    }
  }, [annotationStats.ratedCount, connections, syncToCompetency])

  // Compute aggregate confidence from step annotations
  const aggregateConfidence = useMemo((): AggregateConfidence | null => {
    if (annotationStats.ratedCount === 0) return null

    // We don't have per-step scores here, but we can estimate from the hook's stats.
    // For a proper calculation, we'd need the full annotations map.
    // For now, return a simplified version based on rated count / total.
    return {
      averageScore: 0, // Will be set by the component with actual data
      level: 'developing',
      ratedCount: annotationStats.ratedCount,
      totalSteps,
      coveragePercent: totalSteps > 0
        ? Math.round((annotationStats.ratedCount / totalSteps) * 100)
        : 0,
    }
  }, [annotationStats.ratedCount, totalSteps])

  return {
    /** Competencies this lesson maps to, with current progress */
    connections,
    /** Whether competency data is loading */
    isLoading,
    /** Aggregate confidence from step annotations */
    aggregateConfidence,
    /** Manually trigger sync */
    syncToCompetency,
  }
}

// Compute aggregate from a full annotations map (used by components with direct access)
export function computeAggregateConfidence(
  annotations: Map<number, { confidence: ConfidenceLevel | null }>,
  totalSteps: number,
): AggregateConfidence | null {
  const rated: number[] = []
  for (const a of annotations.values()) {
    if (a.confidence) {
      rated.push(CONFIDENCE_SCORE[a.confidence])
    }
  }
  if (rated.length === 0) return null

  const avg = rated.reduce((sum, s) => sum + s, 0) / rated.length

  return {
    averageScore: Math.round(avg * 10) / 10,
    level: scoreToLevel(avg),
    ratedCount: rated.length,
    totalSteps,
    coveragePercent: totalSteps > 0 ? Math.round((rated.length / totalSteps) * 100) : 0,
  }
}
