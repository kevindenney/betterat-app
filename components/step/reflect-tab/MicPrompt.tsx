import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { IOS_CORAL, IOS_CORAL_DEEP, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';
import { voiceNoteService } from '@/services/ai/VoiceNoteService';
import { logger } from '@/lib/logger';

export interface MicPromptProps {
  activeFieldId?: string;
  onTranscript: (fieldId: string, text: string) => void;
  onSpawnAnythingElseField: () => string;
}

export function MicPrompt({
  activeFieldId,
  onTranscript,
  onSpawnAnythingElseField,
}: MicPromptProps) {
  const [recording, setRecording] = useState(false);
  const targetRef = useRef<string | undefined>(activeFieldId);
  const scale = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 420, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ).start();
  };

  const stopPulse = () => {
    scale.stopAnimation();
    scale.setValue(1);
  };

  const handleStart = async () => {
    targetRef.current = activeFieldId ?? onSpawnAnythingElseField();
    setRecording(true);
    startPulse();
    try {
      await voiceNoteService.startRecording({ maxDuration: 90 });
    } catch (err) {
      logger.warn('Reflect mic recording unavailable; falling back to note marker', err);
    }
  };

  const handleStop = async () => {
    setRecording(false);
    stopPulse();
    let transcript = 'Voice reflection captured.';
    try {
      const note = await voiceNoteService.stopRecording();
      if (note?.duration) {
        transcript = `Voice reflection · ${Math.max(1, Math.round(note.duration))}s`;
      }
    } catch (err) {
      logger.warn('Reflect mic recording stop failed', err);
    }
    const target = targetRef.current ?? onSpawnAnythingElseField();
    onTranscript(target, transcript);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Release to stop recording reflection' : 'Hold to speak reflection'}
          onPressIn={handleStart}
          onPressOut={handleStop}
          style={[styles.button, recording && styles.buttonRecording]}
        >
          <Mic size={25} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>
      <Text style={styles.hint}>{recording ? 'Listening… release to save' : 'Hold to speak · or type'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_CORAL,
    shadowColor: IOS_CORAL,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  buttonRecording: {
    backgroundColor: IOS_CORAL_DEEP,
    shadowOpacity: 0.48,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: LABEL_3,
  },
});
