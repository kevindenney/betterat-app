/**
 * DoTabIOSRegisterShell — flag-on Do tab render surface.
 *
 * Mounts DoTabInterior driven by useStepActCaptureController, plus the
 * Mark-as-evidence sheet (opened by tapping a frozen Frame 3 capture row)
 * and the quick-note modal (opened by the Frame 2 composer's quick-note
 * + voice affordances).
 *
 * Used by:
 * - components/step/ActTab.tsx — when FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER
 *   is true and StepDetailContent mounts the standalone step page.
 * - components/cards/content/RaceSummaryCard.tsx — when the same flag is
 *   true and the user opens the on_water phase inside the inline race
 *   card. The Race-tab carousel does NOT go through StepDetailContent,
 *   so this shell is the bridge that keeps the flag-on path consistent
 *   across both entry points.
 *
 * In v1 the MarkAsEvidenceSheet capabilities list is empty until the
 * capability model lands. The sheet's graceful empty state covers this
 * so tapping a frozen row still produces a self-explanatory outcome.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStepActCaptureController } from '@/hooks/useStepActCaptureController';
import { DoTabInterior } from './DoTabInterior';
import { DoQuickNoteModal } from './DoQuickNoteModal';
import { MarkAsEvidenceSheet } from './MarkAsEvidenceSheet';

export interface DoTabIOSRegisterShellProps {
  /** Step the shell is bound to. */
  stepId: string;
  /** Suppress every mutating callback. */
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
  /** Move-to-Reflect CTA callback. Forwarded as the controller's onMoveToReflect. */
  onMoveToReflect?: () => void;
  /** Optional footer rendered beneath DoTabInterior (matches ActTab's contract). */
  footer?: React.ReactNode;
  /** When true, render without flex:1 container + ScrollView so parent owns scroll. */
  embedded?: boolean;
}

export function DoTabIOSRegisterShell({
  stepId,
  readOnly,
  interestId,
  interestName,
  interestSlug,
  onMoveToReflect,
  footer,
  embedded,
}: DoTabIOSRegisterShellProps) {
  const controller = useStepActCaptureController({
    stepId,
    readOnly,
    interestId,
    interestName,
    interestSlug,
    onMoveToReflect,
  });

  return (
    <View style={embedded ? styles.containerEmbedded : styles.container}>
      <DoTabInterior {...controller.doTabInteriorProps} footer={footer} embedded={embedded} />

      <MarkAsEvidenceSheet
        visible={controller.markingCaptureId != null}
        onClose={controller.closeMarkAsEvidence}
        capture={controller.markingCapture}
        capabilities={[]}
        selectedCapabilityIds={[]}
        onToggleCapability={() => {}}
        strength={null}
        onChangeStrength={() => {}}
        onSave={controller.closeMarkAsEvidence}
      />

      <DoQuickNoteModal
        visible={controller.quickNoteVisible}
        onClose={controller.closeQuickNoteModal}
        onSubmit={controller.submitQuickNote}
        initialText={controller.quickNoteInitialText}
        title={controller.quickNoteTitle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerEmbedded: {
    // intrinsic — parent ScrollView owns scroll
  },
});
