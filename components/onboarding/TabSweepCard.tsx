/**
 * TabSweepCard — Full-screen card showing all 4 navigation tabs.
 *
 * Replaces four individual tab spotlight steps with a single card
 * that describes each tab's purpose with an icon + one-liner.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
export interface TabSweepCardProps {
  visible: boolean;
  onNext: () => void;
  onSkip: () => void;
  canContinue: boolean;
  activeTabLabel?: string;
  activeTabDescription?: string;
  emptyStateHint?: string;
}

export function TabSweepCard({
  visible,
  onNext,
  onSkip,
  canContinue,
  activeTabLabel,
  activeTabDescription,
  emptyStateHint,
}: TabSweepCardProps) {
  const { width } = useWindowDimensions();

  if (!visible) return null;

  const cardWidth = Math.min(300, width - 60);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { width: cardWidth }]}>
        <Text style={styles.title}>Explore every tab</Text>
        <Text style={styles.subtitle}>Tap each tab once. Use the progress pills below.</Text>
        {!!activeTabLabel && !!activeTabDescription && (
          <View style={styles.contextBox}>
            <Text style={styles.contextTitle}>{activeTabLabel}</Text>
            <Text style={styles.contextBody}>{activeTabDescription}</Text>
            {!!emptyStateHint && <Text style={styles.contextHint}>{emptyStateHint}</Text>}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
            onPress={onNext}
            disabled={!canContinue}
            activeOpacity={0.8}
          >
            <Text style={[styles.nextButtonText, !canContinue && styles.nextButtonTextDisabled]}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 78,
    zIndex: 1100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 7,
  },
  contextBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  contextBody: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: '#1E3A8A',
  },
  contextHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#475569',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextButtonDisabled: {
    backgroundColor: '#BFDBFE',
  },
  nextButtonTextDisabled: {
    color: '#E2E8F0',
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
