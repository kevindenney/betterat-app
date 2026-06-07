/**
 * InspirationSuccessStep — Step 4 of the wizard.
 *
 * Confirmation screen showing the new interest and offering navigation.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { resolveIonicon } from './resolveIonicon';
import type { InspirationExtraction, ProposedInterest } from '@/types/inspiration';

interface InspirationSuccessStepProps {
  extraction: InspirationExtraction;
  interestEdits: Partial<ProposedInterest>;
  result: {
    interestSlug: string;
    blueprintSlug: string;
  };
  onClose: () => void;
}

export function InspirationSuccessStep({
  extraction,
  interestEdits,
  result,
  onClose,
}: InspirationSuccessStepProps) {
  const router = useRouter();
  const { switchInterest } = useInterest();

  const name = interestEdits.name ?? extraction.proposed_interest.name;
  const accentColor =
    interestEdits.accent_color ?? extraction.proposed_interest.accent_color;
  const iconName = resolveIonicon(interestEdits.icon_name ?? extraction.proposed_interest.icon_name);
  const stepCount = extraction.blueprint.steps.length;

  const handleStartExploring = async () => {
    // Switch to the new interest, then close and navigate
    try {
      await switchInterest(result.interestSlug);
    } catch (err) {
      console.warn('[InspirationSuccessStep] switchInterest failed:', err);
    }
    onClose();
    router.push('/(tabs)/practice');
  };

  const handleViewBlueprint = async () => {
    try {
      await switchInterest(result.interestSlug);
    } catch (err) {
      console.warn('[InspirationSuccessStep] switchInterest failed:', err);
    }
    onClose();
    router.push(`/blueprint/${result.blueprintSlug}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success animation area */}
        <View style={[styles.iconCircle, { backgroundColor: `${accentColor}20` }]}>
          <Ionicons name={iconName} size={48} color={accentColor} />
        </View>

        <View style={styles.checkBadge}>
          <Ionicons name="checkmark-circle" size={28} color={IOS_COLORS.systemGreen} />
        </View>

        <Text style={styles.title}>You're all set!</Text>

        <Text style={styles.subtitle}>
          <Text style={{ fontWeight: '700', color: accentColor }}>{name}</Text>
          {' '}is ready with {stepCount} steps to get you started.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stepCount}</Text>
            <Text style={styles.statLabel}>Steps</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Blueprint</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Playbook</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <Pressable onPress={handleStartExploring} style={styles.primaryButton}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Start Exploring</Text>
        </Pressable>

        <Pressable onPress={handleViewBlueprint} style={styles.secondaryButton}>
          <Ionicons name="map-outline" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.secondaryButtonText}>View Blueprint</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    marginTop: -12,
    marginBottom: IOS_SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.md,
    marginTop: IOS_SPACING.xl,
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  statLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: IOS_COLORS.separator,
  },
  footer: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemGreen,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
});
