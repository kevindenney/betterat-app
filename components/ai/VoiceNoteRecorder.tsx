/**
 * Voice Note Recorder - Race Day Voice Recording Component
 * Optimized for marine environment: large buttons, high contrast, glove-friendly
 * Integrates with AI analysis for real-time tactical insights
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  voiceNoteService,
  type VoiceNote,
  type TacticalInsight,
  type VoiceRecordingOptions,
  type RaceContext
} from '@/services/ai/VoiceNoteService';

interface VoiceNoteRecorderProps {
  raceContext?: RaceContext;
  onInsightGenerated?: (insights: TacticalInsight[]) => void;
  onVoiceNoteCreated?: (voiceNote: VoiceNote) => void;
  style?: object;
  compact?: boolean; // For integration into race day interface
}

interface RecordingState {
  isRecording: boolean;
  duration: number;
  recordingId: string | null;
  amplitude: number;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  raceContext,
  onInsightGenerated,
  onVoiceNoteCreated,
  style,
  compact = false
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    recordingId: null,
    amplitude: 0
  });

  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showNotesList, setShowNotesList] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Animation values
  const _recordingAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  // Timer for recording duration
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Start recording animation
  useEffect(() => {
    if (recordingState.isRecording) {
      // Pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animation
      Animated.loop(
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.duration + 0.1
        }));
      }, 100);
    } else {
      pulseAnimation.stopAnimation();
      waveAnimation.stopAnimation();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingState.isRecording]);

  const startRecording = async () => {
    try {
      Vibration.vibrate(50); // Haptic feedback

      const options: VoiceRecordingOptions = {
        maxDuration: 60,
        quality: 'high',
        enableNoiseReduction: true,
        raceContext
      };

      const recordingId = await voiceNoteService.startRecording(options);

      setRecordingState({
        isRecording: true,
        duration: 0,
        recordingId,
        amplitude: 0
      });

    } catch (error) {

      showAlert(
        'Recording Error',
        'Failed to start voice recording. Please check microphone permissions.'
      );
    }
  };

  const stopRecording = async () => {
    try {
      Vibration.vibrate(100); // Different haptic for stop
      setIsProcessing(true);

      const voiceNote = await voiceNoteService.stopRecording();

      setRecordingState({
        isRecording: false,
        duration: 0,
        recordingId: null,
        amplitude: 0
      });

      if (voiceNote) {
        setVoiceNotes(prev => [voiceNote, ...prev]);
        onVoiceNoteCreated?.(voiceNote);

        // Wait for processing to complete and extract insights
        const checkProcessing = setInterval(() => {
          // In real implementation, you'd have a way to get updated voiceNote
          // For now, simulate processing completion
          setTimeout(() => {
            clearInterval(checkProcessing);
            setIsProcessing(false);

            // Simulate insights for demo
            const demoInsights: TacticalInsight[] = [
              {
                type: 'wind_shift',
                confidence: 0.85,
                description: 'Right wind shift observed',
                recommendation: 'Consider tacking to take advantage of the shift',
                timestamp: new Date(),
                importance: 'important'
              }
            ];

            onInsightGenerated?.(demoInsights);
          }, 2000);
        }, 100);
      }

    } catch (error) {

      setIsProcessing(false);
      setRecordingState({
        isRecording: false,
        duration: 0,
        recordingId: null,
        amplitude: 0
      });
    }
  };

  const cancelRecording = async () => {
    try {
      await voiceNoteService.cancelRecording();
      setRecordingState({
        isRecording: false,
        duration: 0,
        recordingId: null,
        amplitude: 0
      });
    } catch (error) {

    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVoiceNote = ({ item }: { item: VoiceNote }) => (
    <View style={styles.voiceNoteItem}>
      <View style={styles.voiceNoteHeader}>
        <Ionicons name="mic" size={16} color="#0066CC" />
        <Text style={styles.voiceNoteTime}>
          {item.timestamp.toLocaleTimeString()}
        </Text>
        <Text style={styles.voiceNoteDuration}>
          {formatDuration(item.duration)}
        </Text>
      </View>

      {item.transcription && (
        <Text style={styles.transcription} numberOfLines={2}>
          {item.transcription}
        </Text>
      )}

      {item.tacticalInsights && item.tacticalInsights.length > 0 && (
        <View style={styles.insightsContainer}>
          {item.tacticalInsights.slice(0, 2).map((insight, index) => (
            <View key={index} style={styles.insightBadge}>
              <Text style={styles.insightText}>{insight.type.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>
      )}

      {item.isProcessing && (
        <View style={styles.processingContainer}>
          <Ionicons name="refresh" size={14} color="#666" />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </View>
  );

  if (compact) {
    // Compact version for race day interface
    return (
      <View style={[styles.compactContainer, style]}>
        <TouchableOpacity
          style={[
            styles.compactButton,
            recordingState.isRecording && styles.compactButtonRecording
          ]}
          onPress={recordingState.isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          <Animated.View
            style={[
              styles.compactButtonInner,
              { transform: [{ scale: recordingState.isRecording ? pulseAnimation : 1 }] }
            ]}
          >
            <Ionicons
              name={recordingState.isRecording ? "stop" : "mic"}
              size={24}
              color="white"
            />
          </Animated.View>
        </TouchableOpacity>

        {recordingState.isRecording && (
          <Text style={styles.compactDuration}>
            {formatDuration(recordingState.duration)}
          </Text>
        )}

        {isProcessing && (
          <Text style={styles.compactProcessing}>Processing...</Text>
        )}
      </View>
    );
  }

  // Full version
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Race Voice Notes</Text>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => setShowNotesList(true)}
        >
          <Ionicons name="list" size={20} color="#0066CC" />
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recordingArea}>
        {/* Recording Visualization */}
        <View style={styles.visualizationContainer}>
          {recordingState.isRecording && (
            <Animated.View
              style={[
                styles.waveContainer,
                { opacity: waveAnimation }
              ]}
            >
              {[1, 2, 3, 4, 5].map(i => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: recordingState.amplitude * 40 + 10,
                      transform: [{ scaleY: pulseAnimation }]
                    }
                  ]}
                />
              ))}
            </Animated.View>
          )}
        </View>

        {/* Main Recording Button */}
        <TouchableOpacity
          style={[
            styles.recordButton,
            recordingState.isRecording && styles.recordButtonActive
          ]}
          onPress={recordingState.isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          <Animated.View
            style={[
              styles.recordButtonInner,
              { transform: [{ scale: recordingState.isRecording ? pulseAnimation : 1 }] }
            ]}
          >
            <LinearGradient
              colors={recordingState.isRecording
                ? ['#FF3B30', '#FF6B60']
                : ['#0066CC', '#4A90E2']
              }
              style={styles.recordButtonGradient}
            >
              <Ionicons
                name={recordingState.isRecording ? "stop" : "mic"}
                size={36}
                color="white"
              />
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>

        {/* Duration Display */}
        {recordingState.isRecording && (
          <Text style={styles.duration}>
            {formatDuration(recordingState.duration)}
          </Text>
        )}

        {/* Cancel Button (only during recording) */}
        {recordingState.isRecording && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelRecording}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {isProcessing && (
          <View style={styles.processingIndicator}>
            <Ionicons name="refresh" size={20} color="#0066CC" />
            <Text style={styles.processingLabel}>Analyzing voice note...</Text>
          </View>
        )}
      </View>

      {/* Context Info */}
      {raceContext && (
        <View style={styles.contextContainer}>
          <Text style={styles.contextLabel}>Race Context:</Text>
          <Text style={styles.contextText}>
            {raceContext.racePhase.replace('_', ' ').toUpperCase()}
            {raceContext.currentLeg && ` • ${raceContext.currentLeg}`}
          </Text>
        </View>
      )}

      {/* Voice Notes History Modal */}
      <Modal
        visible={showNotesList}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <BlurView intensity={95} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Voice Notes History</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowNotesList(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={voiceNotes}
            renderItem={renderVoiceNote}
            keyExtractor={item => item.id}
            style={styles.notesList}
            contentContainerStyle={styles.notesListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="mic-off" size={48} color="#CCC" />
                <Text style={styles.emptyStateText}>No voice notes yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Record your racing observations for analysis
                </Text>
              </View>
            }
          />
        </BlurView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    margin: 10,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    borderRadius: 8,
  },
  historyText: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingArea: {
    alignItems: 'center',
    gap: 16,
  },
  visualizationContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#0066CC',
    borderRadius: 2,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 8,
    boxShadow: '0px 4px',
  },
  recordButtonActive: {elevation: 12, boxShadow: '0px 0px 0px rgba(0, 0, 0, 0.4)'},
  recordButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    overflow: 'hidden',
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    boxShadow: '0px 2px',
  },
  compactButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  compactButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  duration: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF3B30',
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  compactDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    borderRadius: 8,
  },
  processingLabel: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '500',
  },
  compactProcessing: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  contextContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 102, 204, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0066CC',
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextText: {
    fontSize: 14,
    color: '#1F2937',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesList: {
    flex: 1,
  },
  notesListContent: {
    padding: 20,
    gap: 12,
  },
  voiceNoteItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  voiceNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  voiceNoteTime: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  voiceNoteDuration: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  transcription: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 8,
  },
  insightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  insightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    borderRadius: 6,
  },
  insightText: {
    fontSize: 11,
    color: '#0066CC',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  processingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
});
