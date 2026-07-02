/**
 * Assigned-blueprint preview — read-only detail for an institution-managed
 * Studio blueprint a student has been assigned through a cohort.
 *
 * The System-A blueprint routes (/blueprint/[slug], /library/blueprints/[id])
 * read timeline_blueprints + blueprint_steps; institutional blueprints live in
 * blueprints + blueprint_step_templates, so they have no detail surface of
 * their own. This screen lists the authored steps (with an "Added" marker on
 * any the student has already materialized) and offers a single "Add to plan"
 * CTA that adopts the whole blueprint into the timeline.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useAssignedBlueprintDetail } from '@/hooks/useAssignedBlueprints';
import { BlueprintSubscribeSheet } from '@/components/blueprint/BlueprintSubscribeSheet';
import {
  addRemainingInstitutionalSteps,
  addInstitutionalStepById,
} from '@/services/BlueprintSubscribeService';
import { useAuth } from '@/providers/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';

export default function AssignedBlueprintDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { detail, loading, error } = useAssignedBlueprintDetail(id);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [addingMore, setAddingMore] = useState(false);
  const [addingStepId, setAddingStepId] = useState<string | null>(null);

  const fullyAdopted =
    !!detail && detail.totalSteps > 0 && detail.adoptedSteps >= detail.totalSteps;
  const remaining = detail ? detail.totalSteps - detail.adoptedSteps : 0;
  const hasAdopted = !!detail && detail.adoptedSteps > 0;

  const invalidateAdoption = () => {
    if (!user?.id) return;
    queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['assigned-blueprint-detail', user.id] });
    queryClient.invalidateQueries({ queryKey: ['assigned-blueprints', user.id] });
    queryClient.invalidateQueries({ queryKey: ['institutional-next-steps'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['library-plans'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['library-counts'], refetchType: 'all' });
  };

  const handleAddRemaining = async () => {
    if (!user?.id || !detail) return;
    setAddingMore(true);
    try {
      await addRemainingInstitutionalSteps(user.id, detail.id, detail.interestId);
      invalidateAdoption();
    } finally {
      setAddingMore(false);
    }
  };

  const handleAddStep = async (templateId: string) => {
    if (!user?.id || !detail) return;
    setAddingStepId(templateId);
    try {
      await addInstitutionalStepById(user.id, detail.id, templateId, detail.interestId);
      invalidateAdoption();
    } finally {
      setAddingStepId(null);
    }
  };
  const viaLabel = detail
    ? [detail.orgName, detail.cohortName].filter(Boolean).join(' · ')
    : '';

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/library' as never))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={[styles.backLink, { marginTop: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={18} color={IOS_COLORS.systemBlue} />
        <Text style={styles.backText}>Library</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
        </View>
      ) : error || !detail ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={28} color={IOS_COLORS.systemOrange} />
          <Text style={styles.emptyTitle}>Blueprint unavailable</Text>
          <Text style={styles.emptyBlurb}>
            This plan may have been unpublished or is no longer assigned to you.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>ASSIGNED TO YOU</Text>
            <Text style={styles.title}>{detail.title}</Text>
            {viaLabel ? <Text style={styles.via}>{viaLabel}</Text> : null}
            {detail.authorUserId ? (
              <Pressable
                style={styles.authorRow}
                onPress={() => router.push(`/profile/${detail.authorUserId}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`View ${detail.authorName ?? 'author'}'s profile`}
              >
                {detail.authorAvatarUrl ? (
                  <Image source={{ uri: detail.authorAvatarUrl }} style={styles.authorAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={28} color={IOS_COLORS.systemGray3} />
                )}
                <Text style={styles.authorName}>
                  By {detail.authorName ?? 'Faculty author'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
              </Pressable>
            ) : null}
            {detail.description ? (
              <Text style={styles.description}>{detail.description}</Text>
            ) : null}
            <Text style={styles.progress}>
              {detail.totalSteps} step{detail.totalSteps !== 1 ? 's' : ''}
              {detail.adoptedSteps > 0
                ? ` · ${detail.adoptedSteps} added to your plan`
                : ''}
            </Text>
          </View>

          <View style={styles.list}>
            {detail.steps.map((step, i) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.description ? (
                    <Text style={styles.stepDesc} numberOfLines={3}>
                      {step.description}
                    </Text>
                  ) : null}
                  {step.preceptorRole ? (
                    <Text style={styles.stepMeta}>With {step.preceptorRole}</Text>
                  ) : null}
                </View>
                {step.adopted ? (
                  <View style={styles.addedTag}>
                    <Ionicons name="checkmark" size={12} color={IOS_COLORS.systemGreen} />
                    <Text style={styles.addedTagText}>Added</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      styles.addStepBtn,
                      addingStepId === step.id && styles.ctaPending,
                    ]}
                    disabled={addingStepId !== null}
                    onPress={() => handleAddStep(step.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${step.title} to your plan`}
                  >
                    {addingStepId === step.id ? (
                      <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
                    ) : (
                      <>
                        <Ionicons name="add" size={14} color={IOS_COLORS.systemBlue} />
                        <Text style={styles.addStepBtnText}>Add</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {detail && !loading ? (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
          {fullyAdopted ? (
            <Pressable
              style={styles.ctaSecondary}
              onPress={() => router.push('/practice' as never)}
              accessibilityRole="button"
              accessibilityLabel="Go to your plan in Practice"
            >
              <Text style={styles.ctaSecondaryText}>Added · Open in Practice</Text>
            </Pressable>
          ) : hasAdopted ? (
            // Already subscribed with a partial set — pull the rest in place.
            <Pressable
              style={[styles.ctaPrimary, addingMore && styles.ctaPending]}
              disabled={addingMore}
              onPress={handleAddRemaining}
              accessibilityRole="button"
              accessibilityLabel={`Add ${remaining} more steps from ${detail.title}`}
            >
              {addingMore ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaPrimaryText}>
                  {remaining === 1
                    ? 'Add the last step'
                    : `Add all ${remaining} remaining steps`}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={styles.ctaPrimary}
              onPress={() => setSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${detail.title} to my plan`}
            >
              <Text style={styles.ctaPrimaryText}>Add to plan</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {detail ? (
        <BlueprintSubscribeSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          blueprint={{
            id: detail.id,
            system: 'institutional',
            title: detail.title,
            authorInterestId: detail.interestId,
            authorInterestSlug: detail.interestSlug,
            authorInterestLabel: detail.interestName,
            orgLabel: detail.orgName,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.xl,
  },
  header: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.md,
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#7C3AED',
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: IOS_COLORS.label,
  },
  via: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.label,
    marginTop: 4,
  },
  progress: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  stepMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  addStepBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  addedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  addedTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
  emptyTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  emptyBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 12,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  ctaPrimary: {
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPending: {
    opacity: 0.6,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaSecondary: {
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
});
