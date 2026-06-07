/**
 * InspirationBlueprintStep — Step 3 of the wizard.
 *
 * Shows the AI-generated learning plan as a list of step cards.
 * User can review, edit titles, remove steps, and then activate.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type {
  InspirationExtraction,
  InspirationBlueprintStep as BlueprintStepType,
} from '@/types/inspiration';

const CATEGORY_COLORS: Record<string, string> = {
  general: IOS_COLORS.systemGray,
  nutrition: IOS_COLORS.systemGreen,
  strength: IOS_COLORS.systemOrange,
  cardio: IOS_COLORS.systemRed,
  hiit: IOS_COLORS.systemPink,
  sport: IOS_COLORS.systemBlue,
  race_day_check: IOS_COLORS.systemPurple,
  reading: IOS_COLORS.systemTeal,
};

interface InspirationBlueprintStepProps {
  extraction: InspirationExtraction;
  activating: boolean;
  onActivate: (steps: BlueprintStepType[]) => void;
}

export function InspirationBlueprintStep({
  extraction,
  activating,
  onActivate,
}: InspirationBlueprintStepProps) {
  const [steps, setSteps] = useState<BlueprintStepType[]>(
    extraction.blueprint.steps,
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  }, [expandedIndex]);

  const handleUpdateTitle = useCallback((index: number, title: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title } : s)),
    );
  }, []);

  const toggleExpand = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
    setEditingIndex(null);
  }, []);

  const totalDays = steps.reduce((sum, s) => sum + (s.estimated_duration_days || 0), 0);
  const totalWeeks = Math.ceil(totalDays / 7);

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {steps.length} steps
        </Text>
        <View style={styles.summaryDot} />
        <Text style={styles.summaryText}>
          ~{totalWeeks} {totalWeeks === 1 ? 'week' : 'weeks'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.blueprintTitle}>{extraction.blueprint.title}</Text>
        <Text style={styles.blueprintDescription}>
          {extraction.blueprint.description}
        </Text>

        {steps.map((step, index) => {
          const isExpanded = expandedIndex === index;
          const isEditing = editingIndex === index;
          const categoryColor =
            CATEGORY_COLORS[step.category] ?? IOS_COLORS.systemGray;

          return (
            <View key={`step-${index}`} style={styles.stepCard}>
              <Pressable
                onPress={() => toggleExpand(index)}
                style={styles.stepHeader}
              >
                <View
                  style={[styles.stepNumber, { backgroundColor: `${categoryColor}20` }]}
                >
                  <Text style={[styles.stepNumberText, { color: categoryColor }]}>
                    {index + 1}
                  </Text>
                </View>

                <View style={styles.stepHeaderContent}>
                  {isEditing ? (
                    <TextInput
                      style={styles.stepTitleInput}
                      value={step.title}
                      onChangeText={(text) => handleUpdateTitle(index, text)}
                      onBlur={() => setEditingIndex(null)}
                      autoFocus
                    />
                  ) : (
                    <Pressable onLongPress={() => setEditingIndex(index)}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                    </Pressable>
                  )}

                  <View style={styles.stepMeta}>
                    <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}15` }]}>
                      <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                        {step.category.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                    {step.estimated_duration_days > 0 && (
                      <Text style={styles.durationText}>
                        ~{step.estimated_duration_days}d
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.stepActions}>
                  <Pressable
                    onPress={() => handleRemoveStep(index)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={IOS_COLORS.systemGray3}
                    />
                  </Pressable>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={IOS_COLORS.systemGray2}
                  />
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.stepExpanded}>
                  {step.description && (
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  )}

                  {step.sub_steps.length > 0 && (
                    <View style={styles.subStepsSection}>
                      <Text style={styles.subStepsLabel}>HOW</Text>
                      {step.sub_steps.map((sub, si) => (
                        <View key={si} style={styles.subStepRow}>
                          <View style={styles.subStepBullet} />
                          <Text style={styles.subStepText}>{sub}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {step.reasoning && (
                    <View style={styles.reasoningSection}>
                      <Text style={styles.subStepsLabel}>WHY</Text>
                      <Text style={styles.reasoningText}>{step.reasoning}</Text>
                    </View>
                  )}

                  {step.cross_interest_slugs.length > 0 && (
                    <View style={styles.crossInterestSection}>
                      <Text style={styles.subStepsLabel}>
                        OVERLAPS WITH
                      </Text>
                      <View style={styles.crossInterestRow}>
                        {step.cross_interest_slugs.map((slug) => (
                          <View key={slug} style={styles.crossInterestBadge}>
                            <Ionicons
                              name="link"
                              size={10}
                              color={IOS_COLORS.systemBlue}
                            />
                            <Text style={styles.crossInterestText}>{slug}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Activate button */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => onActivate(steps)}
          disabled={activating || steps.length === 0}
          style={[
            styles.activateButton,
            (activating || steps.length === 0) && styles.activateButtonDisabled,
          ]}
        >
          {activating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.activateButtonText}>Creating your plan...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="rocket" size={18} color="#fff" />
              <Text style={styles.activateButtonText}>
                Create My Plan ({steps.length} steps)
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  summaryText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_COLORS.systemGray3,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xl,
  },
  blueprintTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 4,
  },
  blueprintDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    marginBottom: IOS_SPACING.md,
  },
  stepCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    marginBottom: IOS_SPACING.sm,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IOS_SPACING.md,
    gap: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepHeaderContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  stepTitleInput: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: IOS_COLORS.systemBlue,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  durationText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  stepActions: {
    alignItems: 'center',
    gap: 4,
  },
  stepExpanded: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    paddingTop: IOS_SPACING.sm,
  },
  stepDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    marginBottom: IOS_SPACING.sm,
  },
  subStepsSection: {
    marginBottom: IOS_SPACING.sm,
  },
  subStepsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 3,
  },
  subStepBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_COLORS.systemGray3,
    marginTop: 6,
  },
  subStepText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  reasoningSection: {
    marginBottom: IOS_SPACING.sm,
  },
  reasoningText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  crossInterestSection: {
    marginBottom: IOS_SPACING.xs,
  },
  crossInterestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  crossInterestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: `${IOS_COLORS.systemBlue}10`,
  },
  crossInterestText: {
    fontSize: 11,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  footer: {
    padding: IOS_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemGreen,
    paddingVertical: 14,
    borderRadius: 12,
  },
  activateButtonDisabled: {
    opacity: 0.5,
  },
  activateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
