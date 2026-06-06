/**
 * RaceLocalKnowledgeAdder — the compact "add to local knowledge" chip card
 * shown on a race step's Do and Review tabs.
 *
 * The local-knowledge layer is homed on the race area in Atlas; this surface
 * only *appends* to it. `phase` distinguishes in-the-moment captures on the Do
 * tab ('live') from post-race notes on the Review tab ('review'). A tapped
 * template also lands in Do observations so it shows in the running log.
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useRaceStartTracking } from '@/hooks/useRaceStartTracking';
import { LOCAL_KNOWLEDGE_TEMPLATES } from '@/lib/atlasRaceStep';
import type { AtlasRaceNotePhase, StepActData, StepMetadata } from '@/types/step-detail';

interface RaceLocalKnowledgeAdderProps {
  stepId: string;
  phase?: AtlasRaceNotePhase;
  readOnly?: boolean;
}

export function RaceLocalKnowledgeAdder({ stepId, phase = 'live', readOnly }: RaceLocalKnowledgeAdderProps) {
  const { data: step } = useStepDetail(stepId);
  if (!step) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={IOS_COLORS.secondaryLabel} />
      </View>
    );
  }
  return <AdderBody step={step} phase={phase} readOnly={readOnly} />;
}

function AdderBody({
  step,
  phase,
  readOnly,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  phase: AtlasRaceNotePhase;
  readOnly?: boolean;
}) {
  const metadata = (step.metadata ?? {}) as StepMetadata;
  const act = useMemo(
    () => ((metadata.act ?? (step.metadata as any)?.act_data ?? {}) as StepActData) ?? {},
    [metadata.act, step.metadata],
  );
  const { appendStampedNote } = useRaceStartTracking(step, act);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ADD TO LOCAL KNOWLEDGE</Text>
      <Text style={styles.body}>
        {phase === 'review'
          ? 'Tag what the course taught you. It attaches to this race area’s local-knowledge layer in Atlas.'
          : 'Tap a note in the moment. It saves to Do observations and attaches to this course’s local-knowledge layer in Atlas.'}
      </Text>
      <View style={styles.chipRow}>
        {LOCAL_KNOWLEDGE_TEMPLATES.map((template) => (
          <Pressable
            key={template.kind}
            style={[styles.chip, readOnly && styles.chipDisabled]}
            onPress={() => appendStampedNote(template.text, phase)}
            disabled={readOnly}
          >
            <Text style={styles.chipText}>{template.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
});

export default RaceLocalKnowledgeAdder;
