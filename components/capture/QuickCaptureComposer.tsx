/**
 * <QuickCaptureComposer> — voice + text composer inside <UniversalPlusSheet>.
 *
 * Phase 2 · iOS register. Two modes:
 *   • text  — keyboard rises, send button appears when text is non-empty
 *   • voice — press-and-hold mic starts recording; releases stops + posts
 *
 * Voice path delegates to services/ai/VoiceNoteService for recording. Real
 * transcription is still a stub in that service, so we set a placeholder
 * title ("Voice capture · {Ns}") the user can edit before committing. The
 * audio URI rides along on the payload so a later transcription pass can
 * fill in the real text.
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html §1
 * Spec:      docs/redesign/ios-register/phase-2-universal-plus-sheet.md (§ QuickCaptureComposer)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowUp, Mic, Pencil } from 'lucide-react-native';
import { voiceNoteService } from '@/services/ai/VoiceNoteService';
import { logger } from '@/lib/logger';
import {
  GRAY_5,
  IOS_BLUE,
  IOS_BLUE_TINT,
  IOS_CORAL,
  LABEL,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

// expo-av's native Audio recording constants are undefined on web, so the
// press-and-hold mic flow only renders on native platforms. Web users get
// the text composer; voice capture lives on iOS/Android.
const VOICE_SUPPORTED = Platform.OS !== 'web';

export type QuickCaptureKind = 'text' | 'voice';

export interface QuickCaptureSubmitPayload {
  kind: QuickCaptureKind;
  content: string;
  audioUri?: string;
}

export interface QuickCaptureComposerProps {
  placeholder?: string;
  onSubmit: (payload: QuickCaptureSubmitPayload) => void;
  /** Optional autoFocus hint. Sheets typically don't autofocus on open. */
  autoFocus?: boolean;
  testID?: string;
}

const DEFAULT_PLACEHOLDER = 'Capture a step idea…';

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function QuickCaptureComposer({
  placeholder = DEFAULT_PLACEHOLDER,
  onSubmit,
  autoFocus,
  testID,
}: QuickCaptureComposerProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const pulse = useRef(new Animated.Value(0)).current;

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  useEffect(() => {
    return () => {
      stopTicker();
      // Best-effort cancel if the user closes the sheet mid-record.
      voiceNoteService.cancelRecording().catch(() => undefined);
    };
  }, [stopTicker]);

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({ kind: 'text', content: trimmed });
    setText('');
  };

  const handleRecordStart = async () => {
    if (!VOICE_SUPPORTED) return;
    if (isRecording) return;
    try {
      await voiceNoteService.startRecording({ maxDuration: 60 });
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setIsRecording(true);
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch (err) {
      logger.error('Quick-capture recording failed to start', err);
      setIsRecording(false);
    }
  };

  const handleRecordStop = async () => {
    if (!isRecording) return;
    stopTicker();
    setIsRecording(false);
    try {
      const note = await voiceNoteService.stopRecording();
      if (!note) return;
      const durationSec = Math.max(1, Math.round(note.duration || elapsedMs / 1000));
      onSubmit({
        kind: 'voice',
        content: `Voice capture · ${durationSec}s`,
        audioUri: note.fileUri,
      });
    } catch (err) {
      logger.error('Quick-capture recording failed to stop', err);
    }
  };

  const showSend = text.trim().length > 0 && !isRecording;
  const elapsedLabel = formatElapsed(elapsedMs);

  return (
    <View style={styles.composer} testID={testID}>
      <View style={styles.iconTile}>
        <Pencil size={14} color={IOS_BLUE} strokeWidth={2.25} />
      </View>

      <View style={styles.middle}>
        {isRecording ? (
          <View style={styles.recordingRow}>
            <Animated.View
              style={[
                styles.waveDot,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [
                    {
                      scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.recordingText} numberOfLines={1}>
              Listening… {elapsedLabel}
            </Text>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={LABEL_3}
            autoFocus={autoFocus}
            multiline
            scrollEnabled={false}
            onSubmitEditing={handleSendText}
            returnKeyType="send"
            blurOnSubmit
          />
        )}
      </View>

      {showSend ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send capture"
          onPress={handleSendText}
          style={styles.sendButton}
          hitSlop={6}
        >
          <ArrowUp size={20} color="#FFFFFF" strokeWidth={2.75} />
        </Pressable>
      ) : VOICE_SUPPORTED ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Hold to record voice'}
          onPressIn={handleRecordStart}
          onPressOut={handleRecordStop}
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          hitSlop={6}
        >
          <Mic size={18} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 6,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: IOS_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minHeight: 28,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    color: LABEL,
    lineHeight: 19,
    padding: 0,
    margin: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any,
    }),
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: IOS_CORAL,
  },
  recordingText: {
    fontSize: 13,
    color: LABEL,
    fontVariant: ['tabular-nums'],
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: IOS_CORAL,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  micButtonActive: {
    transform: [{ scale: 1.08 }],
  },
});
