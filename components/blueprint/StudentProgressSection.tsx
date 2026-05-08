/**
 * StudentProgressSection — Shows blueprint authors per-subscriber
 * step adoption, completion, ratings, and evidence status.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useBlueprintSubscriberProgress } from '@/hooks/useBlueprint';
import { getUserCompetencyProgress } from '@/services/competencyService';
import type { SubscriberProgress, SubscriberStepProgress } from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { CompetencyWithProgress } from '@/types/competency';
import { COMPETENCY_STATUS_CONFIG } from '@/types/competency';

const C = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  accentLight: '#E0F2F1',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  gold: '#D4A64A',
  green: '#3D8A5A',
  coral: '#D89575',
  gray: '#C4C4C4',
  yellow: '#E5A500',
  red: '#D85050',
} as const;

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  not_adopted: { color: C.gray, label: 'Not adopted' },
  pending: { color: C.yellow, label: 'Pending' },
  in_progress: { color: C.yellow, label: 'In progress' },
  completed: { color: C.green, label: 'Completed' },
  skipped: { color: C.red, label: 'Skipped' },
  dismissed: { color: C.red, label: 'Dismissed' },
};

interface Props {
  blueprintId: string;
  blueprintSteps: TimelineStepRecord[];
  interestId?: string;
}

export function StudentProgressSection({ blueprintId, blueprintSteps, interestId }: Props) {
  const { data: progress, isLoading } = useBlueprintSubscriberProgress(blueprintId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="small" color={C.accent} />
      </View>
    );
  }

  if (!progress || progress.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Subscriber progress</Text>
        <Text style={s.emptyText}>No subscribers yet</Text>
      </View>
    );
  }

  const totalSteps = blueprintSteps.length;
  const avgCompletion =
    totalSteps > 0
      ? Math.round(
          (progress.reduce((sum, p) => sum + p.completed_count, 0) /
            (progress.length * totalSteps)) *
            100,
        )
      : 0;

  return (
    <View style={s.container}>
      <Text style={s.title}>Subscriber progress</Text>
      <Text style={s.summary}>
        {progress.length} subscriber{progress.length !== 1 ? 's' : ''} · {avgCompletion}% avg
        completion
      </Text>

      {progress.map((sub) => (
        <SubscriberRow
          key={sub.subscriber_id}
          subscriber={sub}
          totalSteps={totalSteps}
          expanded={expandedId === sub.subscriber_id}
          onToggle={() =>
            setExpandedId((prev) =>
              prev === sub.subscriber_id ? null : sub.subscriber_id,
            )
          }
          blueprintSteps={blueprintSteps}
          onStepPress={(adoptedStepId) =>
            router.push(`/step/${adoptedStepId}?readOnly=true` as any)
          }
          interestId={interestId}
        />
      ))}
    </View>
  );
}

function SubscriberRow({
  subscriber,
  totalSteps,
  expanded,
  onToggle,
  blueprintSteps,
  onStepPress,
  interestId,
}: {
  subscriber: SubscriberProgress;
  totalSteps: number;
  expanded: boolean;
  onToggle: () => void;
  blueprintSteps: TimelineStepRecord[];
  onStepPress: (adoptedStepId: string) => void;
  interestId?: string;
}) {
  const pct = totalSteps > 0 ? (subscriber.completed_count / totalSteps) * 100 : 0;

  // Build a map from source_step_id → step progress
  const stepMap = new Map<string, SubscriberStepProgress>();
  for (const sp of subscriber.steps) {
    stepMap.set(sp.source_step_id, sp);
  }

  // Fetch competency progress for this subscriber when expanded
  const { data: compProgress } = useQuery<CompetencyWithProgress[]>({
    queryKey: ['competency-progress', subscriber.subscriber_id, interestId],
    queryFn: () => getUserCompetencyProgress(subscriber.subscriber_id, interestId!),
    enabled: expanded && Boolean(interestId),
  });

  return (
    <View style={s.subscriberCard}>
      <Pressable style={s.subscriberHeader} onPress={onToggle}>
        <View style={s.subscriberAvatar}>
          <Ionicons name="person" size={14} color={C.accent} />
        </View>
        <View style={s.subscriberMeta}>
          <Text style={s.subscriberName} numberOfLines={1}>
            {subscriber.name}
          </Text>
          <View style={s.progressBarTrack}>
            <View style={[s.progressBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.subscriberStats}>
            {subscriber.adopted_count} adopted · {subscriber.completed_count} completed
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.labelMid}
        />
      </Pressable>

      {expanded && (
        <View style={s.stepList}>
          {blueprintSteps.map((bpStep) => {
            const sp = stepMap.get(bpStep.id);
            const status = sp
              ? sp.action === 'dismissed'
                ? 'dismissed'
                : sp.status
              : 'not_adopted';
            const dot = STATUS_DOT[status] ?? STATUS_DOT.not_adopted;
            const tappable = !!sp?.adopted_step_id;

            return (
              <Pressable
                key={bpStep.id}
                style={s.stepRow}
                onPress={() => tappable && onStepPress(sp!.adopted_step_id!)}
                disabled={!tappable}
              >
                <View style={[s.statusDot, { backgroundColor: dot.color }]} />
                <Text
                  style={[s.stepTitle, !tappable && { color: C.labelLight }]}
                  numberOfLines={1}
                >
                  {sp?.step_title || bpStep.title}
                </Text>
                {sp?.overall_rating != null && sp.overall_rating > 0 && (
                  <View style={s.ratingBadge}>
                    <Ionicons name="star" size={10} color={C.gold} />
                    <Text style={s.ratingText}>{sp.overall_rating}</Text>
                  </View>
                )}
                {sp?.has_evidence && (
                  <Ionicons name="image-outline" size={12} color={C.labelMid} />
                )}
                {tappable && (
                  <Ionicons name="chevron-forward" size={12} color={C.labelLight} />
                )}
              </Pressable>
            );
          })}

          {/* Competency summary — only render header if there are competencies
              with progress, otherwise the section was showing a bare title
              with no rows beneath it. */}
          {(() => {
            const withProgress = compProgress?.filter((cp) => cp.progress !== null) ?? [];
            if (withProgress.length === 0) return null;
            return (
              <View style={s.compSummary}>
                <Text style={s.compSummaryTitle}>COMPETENCY PROGRESS</Text>
                {withProgress.map((cp) => {
                  const statusCfg = COMPETENCY_STATUS_CONFIG[cp.progress!.status];
                  return (
                    <View key={cp.id} style={s.compRow}>
                      <View style={[s.compStatusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[s.compStatusText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                      <Text style={s.compName} numberOfLines={1}>{cp.title}</Text>
                      <Text style={s.compAttempts}>
                        {cp.progress!.attempts_count} attempt{cp.progress!.attempts_count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: C.labelDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: 12,
    color: C.labelMid,
  },
  emptyText: {
    fontSize: 12,
    color: C.labelLight,
  },
  subscriberCard: {
    backgroundColor: C.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  subscriberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  subscriberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriberMeta: {
    flex: 1,
    gap: 3,
  },
  subscriberName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelDark,
  },
  subscriberStats: {
    fontSize: 10,
    color: C.labelMid,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 2,
  },
  progressBarFill: {
    height: 3,
    backgroundColor: C.green,
    borderRadius: 2,
  },
  stepList: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepTitle: {
    flex: 1,
    fontSize: 12,
    color: C.labelDark,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.gold,
  },
  compSummary: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  compSummaryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.labelLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  compName: {
    flex: 1,
    fontSize: 12,
    color: C.labelDark,
  },
  compAttempts: {
    fontSize: 10,
    color: C.labelLight,
  },
});
