/**
 * StepProvenanceBanner — shows where a step came from (blueprint, copied,
 * template, or follow-up from a prior step).
 *
 * Two variants:
 * - compact: small badge for timeline cards ("From MSN Entry Curriculum")
 * - full: tappable row for step detail with author profile link
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { useStepDetail } from '@/hooks/useStepDetail';
import { STEP_COLORS } from '@/lib/step-theme';
import type { TimelineStepSourceType } from '@/types/timeline-steps';

interface StepProvenanceBannerProps {
  sourceBlueprintId: string | null | undefined;
  sourceType: TimelineStepSourceType;
  copiedFromUserId?: string | null;
  /** When set, this step was created as a follow-up from another step (via the Critique "Create Next Step" flow). Renders a "Follow-up to: …" row with tap-through. */
  followUpToStepId?: string | null;
  variant: 'compact' | 'full';
}

export function StepProvenanceBanner({
  sourceBlueprintId,
  sourceType,
  copiedFromUserId,
  followUpToStepId,
  variant,
}: StepProvenanceBannerProps) {
  const router = useRouter();
  const { data: blueprint } = useBlueprintWithAuthor(
    sourceType === 'blueprint' ? sourceBlueprintId : null,
  );
  const { data: parentStep } = useStepDetail(followUpToStepId ?? undefined);

  // Follow-up provenance — render first when present, even for manual steps.
  if (followUpToStepId && parentStep) {
    const parentTitle = parentStep.title || 'previous step';
    if (variant === 'compact') {
      return (
        <View style={styles.compactBadge}>
          <Ionicons name="git-branch-outline" size={10} color="#6366F1" />
          <Text style={styles.compactText} numberOfLines={1}>
            Follow-up
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.fullContainer}>
        <Pressable
          style={styles.fullRow}
          onPress={() => router.push(`/step/${followUpToStepId}` as any)}
        >
          <Ionicons name="git-branch-outline" size={16} color={STEP_COLORS.accent} />
          <View style={styles.fullTextWrap}>
            <Text style={styles.fullLabel} numberOfLines={1}>
              Follow-up to: {parentTitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={STEP_COLORS.secondaryLabel} />
        </Pressable>
      </View>
    );
  }

  // Nothing to show for self-created steps without follow-up linkage
  if (sourceType === 'manual' || sourceType === 'program_session') return null;

  // Template steps without a blueprint — nothing useful to show in compact,
  // minimal label in full detail view
  if (sourceType === 'template' && !sourceBlueprintId) {
    if (variant === 'compact') return null;
    return (
      <View style={styles.fullRow}>
        <Ionicons name="document-outline" size={16} color={STEP_COLORS.secondaryLabel} />
        <Text style={styles.fullLabel}>From template</Text>
      </View>
    );
  }

  // Copied step without blueprint
  if (sourceType === 'copied' && !sourceBlueprintId) {
    if (variant === 'compact') {
      return (
        <View style={styles.compactBadge}>
          <Ionicons name="copy-outline" size={10} color="#6366F1" />
          <Text style={styles.compactText}>Copied</Text>
        </View>
      );
    }
    return (
      <Pressable
        style={styles.fullRow}
        onPress={copiedFromUserId ? () => router.push(`/person/${copiedFromUserId}` as any) : undefined}
      >
        <Ionicons name="copy-outline" size={16} color={STEP_COLORS.accent} />
        <Text style={styles.fullLabel}>Copied from another user</Text>
        {copiedFromUserId && (
          <Ionicons name="chevron-forward" size={14} color={STEP_COLORS.secondaryLabel} />
        )}
      </Pressable>
    );
  }

  // Blueprint-sourced — waiting for data
  if ((sourceType === 'blueprint' || sourceBlueprintId) && !blueprint) {
    // Still loading or no blueprint found — show nothing while loading
    return null;
  }

  if (!blueprint) return null;

  // Compact variant — small tappable badge on the card
  if (variant === 'compact') {
    return (
      <Pressable
        style={styles.compactBadge}
        onPress={() => router.push(`/blueprint/${blueprint.slug}` as any)}
      >
        <Ionicons name="layers-outline" size={10} color="#6366F1" />
        <Text style={styles.compactText} numberOfLines={1}>
          {blueprint.program_name || blueprint.title}
        </Text>
      </Pressable>
    );
  }

  // Full variant — tappable row with blueprint + author
  return (
    <View style={styles.fullContainer}>
      <Pressable
        style={styles.fullRow}
        onPress={() => router.push(`/blueprint/${blueprint.slug}` as any)}
      >
        <Ionicons name="layers-outline" size={16} color={STEP_COLORS.accent} />
        <View style={styles.fullTextWrap}>
          <Text style={styles.fullLabel} numberOfLines={1}>
            {blueprint.program_name
              ? `${blueprint.program_name} — ${blueprint.title}`
              : blueprint.title}
          </Text>
          {blueprint.organization_name && (
            <Text style={styles.fullOrg} numberOfLines={1}>
              {blueprint.organization_name}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={STEP_COLORS.secondaryLabel} />
      </Pressable>

      {blueprint.author_name && (
        <Pressable
          style={styles.authorRow}
          onPress={() => router.push(`/person/${blueprint.user_id}` as any)}
        >
          <View style={styles.authorAvatar}>
            {blueprint.author_avatar_emoji ? (
              <Text style={styles.authorAvatarEmoji}>{blueprint.author_avatar_emoji}</Text>
            ) : (
              <Ionicons name="person" size={10} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.authorName} numberOfLines={1}>
            by {blueprint.author_name}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={STEP_COLORS.secondaryLabel} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact badge (for timeline cards)
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#E0E7FF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4338CA',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // Full row (for step detail)
  fullContainer: {
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fullTextWrap: {
    flex: 1,
    gap: 1,
  },
  fullLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.label,
  },
  fullOrg: {
    fontSize: 11,
    color: STEP_COLORS.secondaryLabel,
  },

  // Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(61,138,90,0.15)',
  },
  authorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: STEP_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 24, // align with text above (icon width + gap)
  },
  authorAvatarEmoji: {
    fontSize: 10,
  },
  authorName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
});
