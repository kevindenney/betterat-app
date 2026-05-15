/**
 * CrossInterestSuggestions — AI-generated suggestions that find connections
 * between a user's multiple interests.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { useInterest } from '@/providers/InterestProvider';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import type { CrossInterestSuggestion } from '@/types/step-detail';

interface CrossInterestSuggestionsProps {
  stepId: string;
  interestId: string | undefined;
  onApplyToStep: (text: string) => void;
  onCreateStep: (suggestion: CrossInterestSuggestion) => Promise<string | undefined>;
}

export function CrossInterestSuggestions({
  stepId,
  interestId,
  onApplyToStep,
  onCreateStep,
}: CrossInterestSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<Set<string>>(new Set());
  const [createdSteps, setCreatedSteps] = useState<Map<string, { stepId: string; interestSlug: string }>>(new Map());
  const [focusText, setFocusText] = useState('');
  const [showFocusInput, setShowFocusInput] = useState(false);
  const { suggestions, isLoading, refetch } = useCrossInterestSuggestions(stepId, interestId, focusText);

  const router = useRouter();
  const { switchInterest } = useInterest();

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const handleApply = useCallback((suggestion: CrossInterestSuggestion) => {
    onApplyToStep(suggestion.suggestion);
    setApplied((prev) => new Set(prev).add(suggestion.id));
  }, [onApplyToStep]);

  const handleCreate = useCallback(async (suggestion: CrossInterestSuggestion) => {
    setCreating((prev) => new Set(prev).add(suggestion.id));
    try {
      const newStepId = await onCreateStep(suggestion);
      if (newStepId) {
        setCreatedSteps((prev) => new Map(prev).set(suggestion.id, {
          stepId: newStepId,
          interestSlug: suggestion.sourceInterestSlug,
        }));
      }
    } finally {
      setCreating((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  }, [onCreateStep]);

  const handleRefresh = useCallback(() => {
    setDismissed(new Set());
    refetch();
  }, [refetch]);

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  // Don't render anything if loading, no suggestions, or all dismissed
  if (!isLoading && visible.length === 0 && suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={16} color={IOS_COLORS.systemPurple} />
        <Text style={styles.headerText}>Ideas from your other interests</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setShowFocusInput((v) => !v)}
          hitSlop={8}
          style={styles.headerAction}
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={showFocusInput ? IOS_COLORS.systemPurple : IOS_COLORS.systemGray2}
          />
        </Pressable>
        <Pressable onPress={handleRefresh} hitSlop={8} style={styles.headerAction} disabled={isLoading}>
          <Ionicons
            name="refresh-outline"
            size={15}
            color={isLoading ? IOS_COLORS.systemGray3 : IOS_COLORS.systemGray2}
          />
        </Pressable>
      </View>

      {showFocusInput && (
        <View style={styles.focusRow}>
          <TextInput
            style={styles.focusInput}
            placeholder="Focus on a specific area, e.g. 'anatomy for artists'"
            placeholderTextColor={IOS_COLORS.systemGray3}
            value={focusText}
            onChangeText={setFocusText}
            returnKeyType="go"
            onSubmitEditing={handleRefresh}
          />
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
          <Text style={styles.loadingText}>Finding connections...</Text>
        </View>
      )}

      {!isLoading && visible.length === 0 && suggestions.length > 0 && (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>All suggestions dismissed.</Text>
          <Pressable onPress={handleRefresh}>
            <Text style={[styles.loadingText, { color: IOS_COLORS.systemPurple, fontStyle: 'normal', fontWeight: '600' }]}>
              Get new ideas
            </Text>
          </Pressable>
        </View>
      )}

      {visible.map((suggestion) => (
        <View key={suggestion.id} style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: suggestion.sourceInterestColor }]} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.interestBadge, { backgroundColor: suggestion.sourceInterestColor + '20' }]}>
                <Text style={[styles.interestBadgeText, { color: suggestion.sourceInterestColor }]}>
                  {suggestion.sourceInterestName}
                </Text>
              </View>
              <Pressable onPress={() => handleDismiss(suggestion.id)} hitSlop={8}>
                <Ionicons name="close" size={16} color={IOS_COLORS.systemGray3} />
              </Pressable>
            </View>
            <Text style={styles.suggestionText}>{suggestion.suggestion}</Text>
            <Text style={styles.relevanceText}>{suggestion.relevance}</Text>
            <View style={styles.actions}>
              {applied.has(suggestion.id) ? (
                <View style={[styles.applyButton, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                  <Ionicons name="checkmark-outline" size={14} color={IOS_COLORS.systemGreen} />
                  <Text style={[styles.applyButtonText, { color: IOS_COLORS.systemGreen }]}>Added as sub-step</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => handleApply(suggestion)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="add-circle-outline" size={14} color={STEP_COLORS.accent} />
                  <Text style={styles.applyButtonText}>Add to this step</Text>
                </TouchableOpacity>
              )}
              {createdSteps.has(suggestion.id) ? (
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: 'rgba(52,199,89,0.15)' }]}
                  onPress={async () => {
                    const info = createdSteps.get(suggestion.id)!;
                    await switchInterest(info.interestSlug);
                    router.push(`/(tabs)/practice?selected=${info.stepId}` as any);
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="checkmark-circle" size={14} color={IOS_COLORS.systemGreen} />
                  <Text style={styles.createButtonText}>
                    Created — View in {suggestion.sourceInterestName}
                  </Text>
                </TouchableOpacity>
              ) : creating.has(suggestion.id) ? (
                <View style={styles.createButton}>
                  <ActivityIndicator size={12} color={IOS_COLORS.systemGreen} />
                  <Text style={styles.createButtonText}>Creating...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => handleCreate(suggestion)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="add-outline" size={14} color={IOS_COLORS.systemGreen} />
                  <Text style={styles.createButtonText}>
                    Create in {suggestion.sourceInterestName}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: IOS_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray4,
    paddingTop: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.sm,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  headerAction: {
    padding: 4,
    marginLeft: 4,
  },
  focusRow: {
    marginBottom: IOS_SPACING.sm,
  },
  focusInput: {
    fontSize: 13,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6 ?? '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: IOS_SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  accentBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: IOS_SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  interestBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  interestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  suggestionText: {
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
    marginBottom: 4,
  },
  relevanceText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontStyle: 'italic',
    lineHeight: 17,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  createButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
});
