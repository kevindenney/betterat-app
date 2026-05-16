import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';
import { DoStartCard } from './DoStartCard';
import { PlanStartingFrameRow } from './PlanStartingFrameRow';

export interface DoTabInteriorProps {
  state: DoInteriorState;
  planData: StepPlanData;
  captures: DoCaptureItem[];
  readOnly?: boolean;
  summaryText?: string;
  evidenceSelections?: string[];
  onVoiceNote?: () => void;
  onPhotoOrVideo?: () => void;
  onQuickNote?: () => void;
  onAutoSummarizePlan?: () => void;
  onTagCapture?: (captureId: string) => void;
  onMoveToReflect?: () => void;
  onRefineSummary?: () => void;
  footer?: React.ReactNode;
}

export function DoTabInterior({
  state,
  planData,
  readOnly,
  onVoiceNote,
  onPhotoOrVideo,
  onQuickNote,
  onAutoSummarizePlan,
  footer,
}: DoTabInteriorProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {state === 'pre_activity' && (
        <>
          <DoStartCard
            readOnly={readOnly}
            onVoiceNote={onVoiceNote}
            onPhotoOrVideo={onPhotoOrVideo}
            onQuickNote={onQuickNote}
          />
          <PlanStartingFrameRow
            planData={planData}
            onPress={readOnly ? undefined : onAutoSummarizePlan}
            disabled={readOnly}
          />
        </>
      )}

      {state !== 'pre_activity' && <View />}

      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 96,
    gap: IOS_SPACING.sm,
  },
});
