import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';

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

export function DoTabInterior(_props: DoTabInteriorProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View />
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
