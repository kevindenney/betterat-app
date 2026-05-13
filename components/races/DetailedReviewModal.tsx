/**
 * DetailedReviewModal Component
 *
 * Modal wrapper for the full PostRaceAnalysisForm wizard.
 * Shows personalized nudges from past races before the wizard.
 *
 * Features:
 * - ReviewPhaseNudges banner at top showing relevant past learnings
 * - Full 7-step PostRaceAnalysisForm wizard
 * - Triggers AI analysis on completion
 * - Saves detailed analysis data
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Sparkles, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { PostRaceAnalysisForm } from './PostRaceAnalysisForm';
import { ReviewPhaseNudges } from './ReviewPhaseNudges';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import type { RaceAnalysis } from '@/types/raceAnalysis';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('DetailedReviewModal');

// iOS System Colors
const IOS_COLORS = {
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C434A',
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  blue: '#007AFF',
  green: '#34C759',
  purple: '#AF52DE',
  gray: '#8E8E93',
};

interface DetailedReviewModalProps {
  visible: boolean;
  raceId: string;
  raceName: string;
  venueId?: string;
  conditions?: {
    windSpeed?: number;
    windDirection?: number;
  };
  timerSessionId?: string;
  onClose: () => void;
  onComplete: () => void;
}

type ModalState = 'nudges' | 'form' | 'analyzing' | 'complete';

export function DetailedReviewModal({
  visible,
  raceId,
  raceName,
  venueId,
  conditions,
  timerSessionId,
  onClose,
  onComplete,
}: DetailedReviewModalProps) {
  const { user: _user } = useAuth();
  const [modalState, setModalState] = useState<ModalState>('nudges');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setModalState('nudges');
      setAnalysisError(null);
    }
  }, [visible]);

  // Handle form completion
  const handleFormComplete = useCallback(async (formData: RaceAnalysis) => {
    logger.info('Detailed review form completed', { raceId, hasData: !!formData });
    setModalState('analyzing');
    setAnalysisError(null);

    try {
      // If we have a timer session, trigger AI analysis with the detailed data
      if (timerSessionId) {
        const result = await RaceAnalysisService.analyzeRaceSession(timerSessionId, {
          force: true,
          detailedAnalysis: formData,
        } as any);

        if (!result) {
          logger.warn('AI analysis returned no result');
          setAnalysisError('Analysis generation failed');
          setModalState('form');
          return;
        }
      }

      // Success
      setModalState('complete');

      // Auto-close after brief success display
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1500);
    } catch (err) {
      logger.error('Error generating analysis:', err);
      setAnalysisError('Failed to generate analysis. Your data has been saved.');
      setModalState('form');
    }
  }, [raceId, timerSessionId, onComplete, onClose]);

  // Handle nudges acknowledgment - proceed to form
  const handleNudgesComplete = useCallback(() => {
    setModalState('form');
  }, []);

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Render content based on state
  const renderContent = () => {
    switch (modalState) {
      case 'nudges':
        return (
          <View style={styles.nudgesContainer}>
            <View style={styles.nudgesHeader}>
              <Text style={styles.nudgesTitle}>Before you dive in...</Text>
              <Text style={styles.nudgesSubtitle}>
                Here are some insights from your past races that might be relevant
              </Text>
            </View>

            <ReviewPhaseNudges
              raceEventId={raceId}
              venueId={venueId}
              conditions={conditions}
            />

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleNudgesComplete}
            >
              <Text style={styles.continueButtonText}>Continue to Detailed Review</Text>
            </TouchableOpacity>
          </View>
        );

      case 'form':
        return (
          <PostRaceAnalysisForm
            raceId={raceId}
            onComplete={handleFormComplete}
            onCancel={handleFormCancel}
            raceEventId={raceId}
            venueId={venueId}
            conditions={conditions}
          />
        );

      case 'analyzing':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={IOS_COLORS.purple} />
            <Text style={styles.statusTitle}>Generating Analysis</Text>
            <Text style={styles.statusSubtitle}>
              Analyzing your detailed review against your past performance...
            </Text>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color={IOS_COLORS.green} />
            </View>
            <Text style={styles.statusTitle}>Analysis Complete!</Text>
            <Text style={styles.statusSubtitle}>
              Your detailed review has been saved and analyzed.
            </Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={20} color={IOS_COLORS.purple} />
              <Text style={styles.headerTitle}>Detailed Review</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <X size={24} color={IOS_COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Race name */}
          <View style={styles.raceNameContainer}>
            <Text style={styles.raceName}>{raceName}</Text>
          </View>

          {/* Error banner */}
          {analysisError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{analysisError}</Text>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {renderContent()}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  closeButton: {
    padding: 4,
  },
  raceNameContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  raceName: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFCDD2',
  },
  errorText: {
    fontSize: 13,
    color: '#C62828',
  },
  content: {
    flex: 1,
  },

  // Nudges state
  nudgesContainer: {
    flex: 1,
    padding: 16,
  },
  nudgesHeader: {
    marginBottom: 20,
  },
  nudgesTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 6,
  },
  nudgesSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: IOS_COLORS.blue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Status states (analyzing, complete)
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  successIcon: {
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default DetailedReviewModal;
