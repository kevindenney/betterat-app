/**
 * <UniversalPlusSheet> — Phase 2 universal `+` modal.
 *
 * One sheet across all four tabs. Quick-capture composer at the top handles
 * the 90% case (voice-led idea capture). Four secondary rows route to
 * blueprint-import, follow-import, concept-drop, and share. Cancel row
 * dismisses without side effects.
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html
 *            §1 right pane
 * Spec:      docs/redesign/ios-register/phase-2-universal-plus-sheet.md
 */

import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GRAY_4,
  GRAY_5,
  IOS_BLUE,
  LABEL,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { MenuRow } from './MenuRow';
import {
  QuickCaptureComposer,
  type QuickCaptureSubmitPayload,
} from './QuickCaptureComposer';

const VOICE_SUPPORTED = Platform.OS !== 'web';

export interface UniversalPlusSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onQuickCapture: (payload: QuickCaptureSubmitPayload) => void;
  onAddFromBlueprint: () => void;
  onAddFromFollow: () => void;
  onDropConcept: (payload: QuickCaptureSubmitPayload) => void;
  onShareIdea: () => void;
  testID?: string;
}

export function UniversalPlusSheet({
  visible,
  onDismiss,
  onQuickCapture,
  onAddFromBlueprint,
  onAddFromFollow,
  onDropConcept,
  onShareIdea,
  testID,
}: UniversalPlusSheetProps) {
  // Concept-drop reuses the composer text once when the row is tapped. To
  // keep the flow simple in this PR we route the row through `onDropConcept`
  // and expect the host to surface a follow-up nudge if no text is captured.
  // For now, the secondary "concept" row creates an empty insight that the
  // user fills via Playbook (Phase 6); the row only requires a tap.
  // The brief allows this.

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
      testID={testID}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
        />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <Text style={styles.title}>What would you like to add?</Text>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <QuickCaptureComposer autoFocus onSubmit={onQuickCapture} />
              <Text style={styles.hint}>
                {VOICE_SUPPORTED
                  ? "Hold to speak · or tap to type. We'll name it for you."
                  : "Tap to type. We'll name it for you."}
              </Text>

              <Text style={styles.eyebrow}>Add a step from…</Text>
              <View style={styles.group}>
                <MenuRow
                  icon="template"
                  tint="blue"
                  title="Blueprint you follow"
                  subtitle="Adopt a step from a coach or program you subscribe to"
                  onPress={onAddFromBlueprint}
                />
                <MenuRow
                  icon="users"
                  tint="gray"
                  title="Someone you follow"
                  subtitle="Borrow a recent step from a peer or mentor"
                  onPress={onAddFromFollow}
                />
              </View>

              <Text style={styles.eyebrow}>Drop to Playbook</Text>
              <View style={styles.group}>
                <MenuRow
                  icon="bulb"
                  tint="purple"
                  title="A concept to come back to"
                  subtitle="Saved to your Playbook · Recent Insights"
                  onPress={() =>
                    // For the empty-tap variant, send an empty text payload —
                    // the host can choose to show a "what concept?" follow-up.
                    onDropConcept({ kind: 'text', content: '' })
                  }
                />
              </View>

              <Text style={styles.eyebrow}>Share</Text>
              <View style={styles.group}>
                <MenuRow
                  icon="share-3"
                  tint="green"
                  title="An idea, publicly or with crew"
                  subtitle="Opens the share composer"
                  onPress={onShareIdea}
                />
              </View>
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onDismiss}
              style={styles.cancelRow}
              hitSlop={4}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
    maxHeight: '88%' as any,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 24 },
      web: {
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.18)',
      } as any,
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GRAY_4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  hint: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: LABEL_3,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
    letterSpacing: -0.05,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_3,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  group: {
    gap: 0,
  },
  cancelRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: IOS_BLUE,
    letterSpacing: -0.1,
  },
});
