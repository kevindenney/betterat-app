/**
 * InputMethodStep Component
 *
 * Step 2 of AddRaceDialog: Choose how to enter race data
 * Options: AI Extraction (paste/upload/URL) or Manual Entry
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sparkles, PenLine, FileText, Link, Upload } from 'lucide-react-native';
import { Typography, Spacing, BorderRadius, colors } from '@/constants/designSystem';
import { RaceType, RACE_TYPE_COLORS, RaceTypeBadge } from '../RaceTypeSelector';

export type InputMethod = 'ai' | 'manual';

interface InputMethodStepProps {
  raceType: RaceType;
  onSelectMethod: (method: InputMethod) => void;
}

export function InputMethodStep({ raceType, onSelectMethod }: InputMethodStepProps) {
  const typeColors = RACE_TYPE_COLORS[raceType];

  return (
    <View style={styles.container}>
      {/* Race type badge */}
      <View style={styles.typeBadgeContainer}>
        <RaceTypeBadge type={raceType} />
      </View>

      {/* Title */}
      <Text style={styles.title}>How would you like to add this race?</Text>
      <Text style={styles.subtitle}>
        Use AI to extract details from race documents, or enter them manually
      </Text>

      {/* Option cards */}
      <View style={styles.optionsContainer}>
        {/* AI Extraction Option */}
        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            styles.aiCard,
            pressed && styles.optionCardPressed,
          ]}
          onPress={() => onSelectMethod('ai')}
        >
          <View style={styles.aiIconContainer}>
            <Sparkles size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.aiTitle}>Extract</Text>
          <Text style={styles.aiSubtitle}>
            Paste text, upload PDF, or enter a URL
          </Text>

          {/* Input method icons */}
          <View style={styles.inputMethodsRow}>
            <View style={styles.inputMethodBadge}>
              <FileText size={14} color={colors.ai[600]} />
              <Text style={styles.inputMethodText}>Paste</Text>
            </View>
            <View style={styles.inputMethodBadge}>
              <Upload size={14} color={colors.ai[600]} />
              <Text style={styles.inputMethodText}>PDF</Text>
            </View>
            <View style={styles.inputMethodBadge}>
              <Link size={14} color={colors.ai[600]} />
              <Text style={styles.inputMethodText}>URL</Text>
            </View>
          </View>

          <View style={styles.recommendedBadge}>
            <Sparkles size={12} color="#FFFFFF" />
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        </Pressable>

        {/* Manual Entry Option */}
        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            styles.manualCard,
            pressed && styles.optionCardPressed,
          ]}
          onPress={() => onSelectMethod('manual')}
        >
          <View style={[styles.manualIconContainer, { backgroundColor: `${typeColors.primary}15` }]}>
            <PenLine size={28} color={typeColors.primary} />
          </View>
          <Text style={styles.manualTitle}>Manual Entry</Text>
          <Text style={styles.manualSubtitle}>
            Fill in the race details yourself
          </Text>

          <Text style={styles.manualNote}>
            Quick form for basic race info
          </Text>
        </Pressable>
      </View>

      {/* Info text */}
      <Text style={styles.infoText}>
        Extraction works best with Notice of Race (NOR), Sailing Instructions (SI), or race calendar entries
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  typeBadgeContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionCard: {
    borderRadius: BorderRadius.large,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  optionCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  // AI Card styles
  aiCard: {
    backgroundColor: colors.ai[800],  // Darker purple for better contrast
    borderWidth: 2,
    borderColor: colors.ai[700],
  },
  aiIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  aiTitle: {
    ...Typography.h3,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  aiSubtitle: {
    ...Typography.body,
    color: '#FFFFFF',  // Solid white for better contrast
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  inputMethodsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inputMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.small,
  },
  inputMethodText: {
    ...Typography.caption,
    color: colors.ai[700],
    fontWeight: '600',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  recommendedText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  // Manual Card styles
  manualCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  manualIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  manualTitle: {
    ...Typography.h4,
    color: colors.text.primary,
    marginBottom: Spacing.xs,
  },
  manualSubtitle: {
    ...Typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  manualNote: {
    ...Typography.caption,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  infoText: {
    ...Typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
  },
});

export default InputMethodStep;
