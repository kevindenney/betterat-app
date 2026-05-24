/**
 * VoiceComposerV3Sheet — canonical Screen 13 of the v3 zoom screens.
 *
 * "Tell me what you're planning." Mic centred (locked component grammar
 * — the lone mic). The lilac AI offer card reads the input and proposes
 * either a single step or a structured block of N steps. One-tap accept
 * on the proposal; one-tap "just one step" to override.
 *
 * v1 ships UI-only. The mic doesn't actually record, the timer counts
 * up from 00:00 once visible, the waveform breathes in/out via
 * Reanimated, and the AI proposal card is a hand-authored mock that
 * always proposes the same "4-week light-air block" — enough fidelity
 * to demo the verb-first capture pattern without speech-recognition
 * + AI-proposal adapters that aren't here yet.
 *
 * Behind FEATURE_FLAGS.VOICE_COMPOSER_V3. Triggered from the mic
 * button on PlusComposerV3Sheet.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

const LILAC = '#AF52DE';
const LILAC_SOFT = 'rgba(175, 82, 222, 0.10)';
const LILAC_BORDER = 'rgba(175, 82, 222, 0.28)';

interface VoiceComposerV3SheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** "Just one step" — save as a single step using the (mocked) transcript. */
  onAcceptSingle: () => void;
  /** "Add as N-step block" — accept the AI's structured proposal. */
  onAcceptBlock: () => void;
}

/**
 * Hand-authored mock proposal. Real flow will compute this from the
 * transcribed audio + AI inference.
 */
const MOCK_PROPOSAL = {
  body:
    '"A 4-week light-air block before HKDW — focus on first-30s and kicker timing."',
  blockCount: 4,
  blockLabel: 'Add as 4-step block',
  context: 'under your Spring Series session',
};

export function VoiceComposerV3Sheet({
  visible,
  onDismiss,
  onAcceptSingle,
  onAcceptBlock,
}: VoiceComposerV3SheetProps) {
  // Timer ticks when the sheet is visible — counts up from 00:00.
  const [seconds, setSeconds] = useState(0);
  // After ~3s, the "librarian heard a block" mock card slides in.
  const [showProposal, setShowProposal] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSeconds(0);
      setShowProposal(false);
      return;
    }
    const tick = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    const reveal = setTimeout(() => setShowProposal(true), 3500);
    return () => {
      clearInterval(tick);
      clearTimeout(reveal);
    };
  }, [visible]);

  // Waveform "breathing" — three pill-shaped bars whose scaleY animates
  // out of phase. Reanimated keeps the animation on the UI thread so
  // it doesn't drop frames while the JS thread is sleepy.
  const wave1 = useSharedValue(0.4);
  const wave2 = useSharedValue(0.4);
  const wave3 = useSharedValue(0.4);

  useEffect(() => {
    if (!visible) return;
    wave1.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    wave2.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    wave3.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [visible, wave1, wave2, wave3]);

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scaleY: wave1.value }],
  }));
  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scaleY: wave2.value }],
  }));
  const wave3Style = useAnimatedStyle(() => ({
    transform: [{ scaleY: wave3.value }],
  }));

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const handleStopMic = useCallback(() => {
    // v1: stopping the mic just closes the sheet. Real flow will
    // finalize the audio buffer, run STT, and replace the mock
    // proposal with the real AI output.
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.surface}>
        <View style={styles.navRow}>
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={24} color={IOS_REGISTER.label} />
          </Pressable>
          <View style={styles.previewPill}>
            <Text style={styles.previewPillText}>PREVIEW</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.headline}>
            Tell me <Text style={styles.headlineItalic}>what you&rsquo;re planning</Text>.
          </Text>

          <View style={styles.waveformRow}>
            <Animated.View style={[styles.bar, styles.barTall, wave1Style]} />
            <Animated.View style={[styles.bar, styles.barMid,  wave2Style]} />
            <Animated.View style={[styles.bar, styles.barTall, wave3Style]} />
            <Animated.View style={[styles.bar, styles.barShort, wave2Style]} />
            <Animated.View style={[styles.bar, styles.barMid,  wave1Style]} />
            <Animated.View style={[styles.bar, styles.barTall, wave3Style]} />
            <Animated.View style={[styles.bar, styles.barMid,  wave2Style]} />
          </View>

          <View style={styles.timerRow}>
            <View style={styles.recDot} />
            <Text style={styles.timerText}>recording {mm}:{ss}</Text>
          </View>

          {showProposal ? (
            <View style={styles.proposalCard}>
              <Text style={styles.proposalEyebrow}>
                ❋ THE LIBRARIAN HEARD A <Text style={styles.proposalEyebrowAccent}>BLOCK</Text>
              </Text>
              <Text style={styles.proposalBody}>{MOCK_PROPOSAL.body}</Text>
              <Text style={styles.proposalContext}>
                Add as <Text style={styles.proposalContextBold}>
                  {MOCK_PROPOSAL.blockCount} steps
                </Text>{' '}{MOCK_PROPOSAL.context}?
              </Text>
              <View style={styles.proposalActions}>
                <Pressable style={styles.ghostBtn} onPress={onAcceptSingle}>
                  <Text style={styles.ghostBtnText}>Just one step</Text>
                </Pressable>
                <Pressable style={styles.lilacBtn} onPress={onAcceptBlock}>
                  <Text style={styles.lilacBtnText}>{MOCK_PROPOSAL.blockLabel}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.bigMic} onPress={handleStopMic}>
            <Ionicons name="mic" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.footerHint}>
            tap to stop · <Text style={styles.footerHintMuted}>pinch to cancel</Text>
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: '#F8F5ED',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
  },
  previewPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  previewPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 20,
  },
  headline: {
    fontSize: 24,
    lineHeight: 30,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 40,
  },
  headlineItalic: {
    fontStyle: 'italic',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 6,
    marginBottom: 16,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.label,
  },
  barTall: { height: 72 },
  barMid: { height: 52 },
  barShort: { height: 32 },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  timerText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  proposalCard: {
    width: '100%',
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 16,
    padding: 16,
  },
  proposalEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LILAC,
    marginBottom: 8,
  },
  proposalEyebrowAccent: {
    color: LILAC,
    fontStyle: 'italic',
    fontFamily: SERIF_FAMILY,
  },
  proposalBody: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  proposalContext: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 14,
  },
  proposalContextBold: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  lilacBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: LILAC,
  },
  lilacBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  bigMic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: IOS_REGISTER.label,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 10,
  },
  footerHint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  footerHintMuted: {
    color: IOS_REGISTER.labelTertiary,
  },
});

// IOS_COLORS imported for future native-control work (e.g. system-blue
// ghost button accents); not used in v1.
void IOS_COLORS;
