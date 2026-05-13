/**
 * AIRecommendationCard
 *
 * Displays an AI-generated practice suggestion with rationale.
 * Allows user to accept, modify, or dismiss the suggestion.
 * Apple HIG compliant with Tufte design principles.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import {
  Sparkles,
  Check,
  X,
  ChevronRight,
  Target,
  Clock,
  Dumbbell,
  BookOpen,
} from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import type { PracticeSuggestion } from '@/types/practice';

interface AIRecommendationCardProps {
  suggestion: PracticeSuggestion;
  onAccept: (suggestion: PracticeSuggestion) => void;
  onModify?: (suggestion: PracticeSuggestion) => void;
  onDismiss: () => void;
  isAccepting?: boolean;
}

export function AIRecommendationCard({
  suggestion,
  onAccept,
  onModify,
  onDismiss,
  isAccepting = false,
}: AIRecommendationCardProps) {
  const topDrill = suggestion.suggestedDrills[0];
  const hasLinkedLessons = suggestion.linkedLessons.length > 0;

  return (
    <View style={styles.container}>
      {/* Header with AI badge - iOS clean style */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.aiBadge}>
            <Sparkles size={14} color={IOS_COLORS.blue} />
            <Text style={styles.aiBadgeText}>Suggestion</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={IOS_COLORS.gray3} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Practice {suggestion.skillAreaLabel}</Text>
        <Text style={styles.headerReason}>{suggestion.reason}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Primary Drill */}
        {topDrill && (
          <View style={styles.drillSection}>
            <View style={styles.drillHeader}>
              <Dumbbell size={16} color={IOS_COLORS.blue} />
              <Text style={styles.sectionLabel}>RECOMMENDED DRILL</Text>
            </View>
            <View style={styles.drillCard}>
              <Text style={styles.drillName}>{topDrill.drill.name}</Text>
              <Text style={styles.drillDescription} numberOfLines={2}>
                {topDrill.drill.description}
              </Text>
              <View style={styles.drillMeta}>
                <View style={styles.drillMetaItem}>
                  <Clock size={14} color={IOS_COLORS.secondaryLabel} />
                  <Text style={styles.drillMetaText}>
                    {topDrill.suggestedDuration} min
                  </Text>
                </View>
                <View style={styles.drillMetaItem}>
                  <Target size={14} color={IOS_COLORS.blue} />
                  <Text style={styles.drillMetaText}>
                    {topDrill.relevanceScore}% match
                  </Text>
                </View>
              </View>
              <Text style={styles.drillFocus}>{topDrill.focus}</Text>
            </View>
          </View>
        )}

        {/* Linked Lesson */}
        {hasLinkedLessons && (
          <View style={styles.lessonSection}>
            <View style={styles.lessonHeader}>
              <BookOpen size={16} color={IOS_COLORS.blue} />
              <Text style={styles.sectionLabel}>LINKED LESSON</Text>
            </View>
            <View style={styles.lessonCard}>
              <Text style={styles.lessonTitle}>
                {suggestion.linkedLessons[0].lessonTitle}
              </Text>
              <Text style={styles.lessonModule}>
                {suggestion.linkedLessons[0].moduleTitle}
              </Text>
            </View>
          </View>
        )}

        {/* Contextual Notes */}
        {suggestion.contextualNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.contextualNotes}>{suggestion.contextualNotes}</Text>
          </View>
        )}

        {/* Duration Estimate */}
        <View style={styles.durationRow}>
          <Clock size={16} color={IOS_COLORS.secondaryLabel} />
          <Text style={styles.durationText}>
            Estimated: {suggestion.estimatedDuration} minutes
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onModify && (
          <TouchableOpacity
            style={styles.modifyButton}
            onPress={() => onModify(suggestion)}
          >
            <Text style={styles.modifyButtonText}>Customize</Text>
            <ChevronRight size={16} color={IOS_COLORS.blue} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
          onPress={() => onAccept(suggestion)}
          disabled={isAccepting}
        >
          <Check size={18} color="#FFFFFF" />
          <Text style={styles.acceptButtonText}>
            {isAccepting ? 'Creating...' : 'Use This Plan'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.gray5,
  },
  header: {
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.blue}15`,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  dismissButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 4,
  },
  headerReason: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  drillSection: {
    gap: 10,
  },
  drillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 0.8,
  },
  drillCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  drillName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  drillDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  drillMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  drillMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drillMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  drillFocus: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.blue,
    fontStyle: 'italic',
    marginTop: 4,
  },
  lessonSection: {
    gap: 10,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonCard: {
    backgroundColor: `${IOS_COLORS.blue}08`,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  lessonModule: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  notesSection: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 10,
    padding: 12,
  },
  contextualNotes: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  modifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.gray6,
  },
  modifyButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: IOS_COLORS.blue,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AIRecommendationCard;
