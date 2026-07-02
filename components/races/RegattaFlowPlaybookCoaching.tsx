/**
 * BetterAt Playbook Coaching Display
 *
 * Shows personalized coaching feedback based on the BetterAt Playbook frameworks
 * after post-race analysis is completed.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import type {
  RegattaFlowPlaybookCoachingProps,
  CoachingFeedback,
  FrameworkScores,
} from '@/types/raceAnalysis';

export function RegattaFlowPlaybookCoaching({
  analysis,
  coachingFeedback,
  frameworkScores,
  onDemoClick,
}: RegattaFlowPlaybookCoachingProps) {
  /**
   * Get color for score
   */
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FFA500'; // Orange
    return '#FF3B30'; // Red
  };

  /**
   * Get impact badge color
   */
  const getImpactColor = (impact: string): string => {
    if (impact === 'high') return '#FF3B30';
    if (impact === 'medium') return '#FFA500';
    return '#007AFF';
  };

  /**
   * Handle demo reference click
   */
  const handleDemoClick = (demoRef?: string) => {
    if (!demoRef) return;

    // Extract demo number from "./playbook-demo X"
    const match = demoRef.match(/(\d+)/);
    if (match && onDemoClick) {
      onDemoClick(parseInt(match[1], 10));
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🏆</Text>
        <Text style={styles.headerTitle}>BetterAt Playbook Coaching</Text>
        <Text style={styles.headerSubtitle}>
          Championship racing tactics tailored for your crew
        </Text>
      </View>

      {/* Overall Framework Adoption Score */}
      {frameworkScores.overall_framework_adoption !== undefined && (
        <View style={styles.overallScoreCard}>
          <Text style={styles.overallScoreLabel}>
            Framework Adoption Score
          </Text>
          <View style={styles.scoreCircle}>
            <Text
              style={[
                styles.scoreValue,
                {
                  color: getScoreColor(
                    frameworkScores.overall_framework_adoption
                  ),
                },
              ]}
            >
              {frameworkScores.overall_framework_adoption}
            </Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <Text style={styles.overallScoreDescription}>
            {frameworkScores.overall_framework_adoption >= 80
              ? '✅ Excellent! You\'re applying the championship playbook consistently.'
              : frameworkScores.overall_framework_adoption >= 60
              ? '⚡ Good progress! Keep integrating the key playbook concepts.'
              : '🎯 Focus area: Review the playbook frameworks and practice application.'}
          </Text>
        </View>
      )}

      {/* Individual Framework Scores */}
      <View style={styles.scoresContainer}>
        <Text style={styles.sectionTitle}>Framework Performance</Text>
        {Object.entries(frameworkScores)
          .filter(([key]) => key !== 'overall_framework_adoption')
          .map(([key, score]) => (
            <FrameworkScoreItem
              key={key}
              name={formatFrameworkName(key)}
              score={score as number}
              color={getScoreColor(score as number)}
            />
          ))}
      </View>

      {/* Coaching Feedback by Phase */}
      <View style={styles.feedbackContainer}>
        <Text style={styles.sectionTitle}>Detailed Coaching</Text>
        {coachingFeedback.map((feedback, index) => (
          <CoachingFeedbackCard
            key={index}
            feedback={feedback}
            impactColor={getImpactColor(feedback.impact)}
            onDemoClick={() => handleDemoClick(feedback.demo_reference)}
          />
        ))}
      </View>

      {/* Attribution */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>
          💡 All coaching generated from the BetterAt Playbook championship knowledge base.
        </Text>
        <Text style={styles.attributionText}>
          Confidence: 95% (physics-based, champion-tested frameworks)
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Framework Score Item
 */
function FrameworkScoreItem({
  name,
  score,
  color,
}: {
  name: string;
  score: number;
  color: string;
}) {
  const barWidth = `${score}%`;

  return (
    <View style={styles.scoreItem}>
      <View style={styles.scoreItemHeader}>
        <Text style={styles.scoreItemName}>{name}</Text>
        <Text style={[styles.scoreItemValue, { color }]}>{score}</Text>
      </View>
      <View style={styles.scoreBar}>
        <View style={[styles.scoreBarFill, { width: barWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/**
 * Coaching Feedback Card
 */
function CoachingFeedbackCard({
  feedback,
  impactColor,
  onDemoClick,
}: {
  feedback: CoachingFeedback;
  impactColor: string;
  onDemoClick: () => void;
}) {
  return (
    <View style={styles.feedbackCard}>
      {/* Header */}
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackHeaderLeft}>
          <Text style={styles.feedbackPhase}>{formatPhase(feedback.phase)}</Text>
          <View style={[styles.impactBadge, { backgroundColor: impactColor }]}>
            <Text style={styles.impactBadgeText}>
              {feedback.impact.toUpperCase()} IMPACT
            </Text>
          </View>
        </View>
        <Text style={styles.confidenceText}>{feedback.confidence}%</Text>
      </View>

      {/* Framework Reference */}
      <View style={styles.frameworkTag}>
        <Text style={styles.frameworkTagText}>
          📚 {feedback.playbook_framework}
        </Text>
      </View>

      {/* Your Approach */}
      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackSectionLabel}>Your Approach:</Text>
        <Text style={styles.feedbackSectionText}>{feedback.your_approach}</Text>
      </View>

      {/* Playbook Recommendation */}
      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackSectionLabel}>Playbook Coaching:</Text>
        <Text style={styles.playbookRecommendation}>
          {feedback.playbook_recommendation}
        </Text>
      </View>

      {/* Next Race Focus */}
      <View style={styles.nextFocusBox}>
        <Text style={styles.nextFocusLabel}>🎯 Next Race Focus:</Text>
        <Text style={styles.nextFocusText}>{feedback.next_race_focus}</Text>
      </View>

      {/* Demo Reference */}
      {feedback.demo_reference && (
        <TouchableOpacity style={styles.demoButton} onPress={onDemoClick}>
          <Text style={styles.demoButtonText}>
            📖 Review Framework: {feedback.demo_reference.replace('./demo', 'demo').replace('./bill-demo', 'demo')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Format framework name for display
 */
function formatFrameworkName(key: string): string {
  const names: Record<string, string> = {
    puff_response: 'Puff Response',
    shift_awareness: 'Shift Awareness',
    delayed_tack_usage: 'Delayed Tack',
    downwind_detection: 'Downwind Detection',
    getting_in_phase: 'Getting In Phase',
  };
  return names[key] || key;
}

/**
 * Format phase name for display
 */
function formatPhase(phase: string): string {
  const phases: Record<string, string> = {
    equipment: 'Equipment',
    planning: 'Planning',
    prestart: 'Pre-Start',
    start: 'Start',
    upwind: 'Upwind',
    windward_mark: 'Windward Mark',
    downwind: 'Downwind',
    leeward_mark: 'Leeward Mark',
    finish: 'Finish',
    overall: 'Overall',
  };
  return phases[phase] || phase;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 24,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  overallScoreCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overallScoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  scoreCircle: {
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreOutOf: {
    fontSize: 18,
    color: '#666',
  },
  overallScoreDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scoresContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  scoreItem: {
    marginBottom: 16,
  },
  scoreItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  scoreItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 8,
    borderRadius: 4,
  },
  feedbackContainer: {
    padding: 16,
    paddingTop: 0,
  },
  feedbackCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackPhase: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  impactBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  frameworkTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  frameworkTagText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  feedbackSection: {
    marginBottom: 12,
  },
  feedbackSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  feedbackSectionText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  playbookRecommendation: {
    fontSize: 14,
    color: '#000',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  nextFocusBox: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
    marginTop: 8,
  },
  nextFocusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  nextFocusText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  demoButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  attribution: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  attributionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
});
