/**
 * ReviewPromptSection — renders one canonical review prompt + any sections
 * captured against it (by bot/voice/etc.), plus an optional editable input
 * for the legacy flat-field write path.
 *
 * Step Arch D/3 — the After tab in StepCritiqueContent loops over all 5
 * canonical prompts and renders this component for each, replacing the
 * 3 hardcoded prompt blocks that previously bound directly to flat fields.
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step D.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '@/lib/i18n/formatters';
import { STEP_PALETTE } from '@/lib/step-theme';
import { text } from '@/lib/design-tokens-editorial';
import type {
  NormalizedReviewSection,
  ReviewSectionPrompt,
  ReviewSectionSource,
} from '@/lib/step/getReviewSections';

const C = {
  radius: 12,
} as const;

interface SourceMeta {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const SOURCE_META: Record<ReviewSectionSource, SourceMeta> = {
  telegram: { icon: 'paper-plane', label: 'Telegram' },
  whatsapp: { icon: 'chatbubble', label: 'WhatsApp' },
  voice_transcript: { icon: 'mic', label: 'Voice' },
  voice: { icon: 'mic', label: 'Voice' },
  in_app: { icon: 'home', label: 'In app' },
  web: { icon: 'globe', label: 'Web' },
  sms: { icon: 'phone-portrait', label: 'SMS' },
  legacy: { icon: 'time', label: 'Saved' },
};

interface Editable {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  editable: boolean;
}

export interface ReviewPromptSectionProps {
  prompt: ReviewSectionPrompt;
  label: string;
  /** Already-filtered to this prompt — caller does the filtering once. */
  sections: NormalizedReviewSection[];
  /** Optional icon shown left of the label (matches existing thumbs-up/locate style). */
  icon?: { name: keyof typeof Ionicons.glyphMap; color: string };
  /** When provided, renders a TextInput bound to legacy flat fields. */
  editable?: Editable;
}

function CapturedCard({ section }: { section: NormalizedReviewSection }) {
  const meta = SOURCE_META[section.source];
  const captured = section.captured_at
    ? formatRelativeTime(section.captured_at)
    : null;
  return (
    <View style={s.capturedCard}>
      <View style={s.capturedHeader}>
        <View style={s.sourceBadge}>
          <Ionicons name={meta.icon} size={11} color={STEP_PALETTE.textTertiary} />
          <Text style={s.sourceBadgeText}>{meta.label}</Text>
        </View>
        {captured ? <Text style={s.capturedTime}>{captured}</Text> : null}
      </View>
      <Text style={s.capturedContent}>{section.content}</Text>
    </View>
  );
}

export function ReviewPromptSection({
  prompt,
  label,
  sections,
  // `icon` is intentionally accepted but ignored — the redesign favors plain
  // eyebrow text over leading icons (see mockups 02/15). Kept on the prop
  // surface so existing call sites compile without churn.
  icon: _icon,
  editable,
}: ReviewPromptSectionProps) {
  // Collapse empty prompts: no captured sections AND no editable input.
  if (sections.length === 0 && !editable) return null;

  return (
    <View style={s.wrap} testID={`review-prompt-${prompt}`}>
      <View style={s.header}>
        <Text style={s.title}>{label}</Text>
      </View>
      {sections.map((section, idx) => (
        <CapturedCard key={`${section.source}-${idx}`} section={section} />
      ))}
      {editable ? (
        <TextInput
          testID={`review-prompt-input-${prompt}`}
          style={s.input}
          value={editable.value}
          onChangeText={editable.editable ? editable.onChange : undefined}
          placeholder={editable.editable ? editable.placeholder : ''}
          placeholderTextColor={STEP_PALETTE.textTertiary}
          multiline
          textAlignVertical="top"
          editable={editable.editable}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...text.sansEyebrow,
    color: STEP_PALETTE.textTertiary,
  },
  capturedCard: {
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: C.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  capturedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: STEP_PALETTE.textTertiary,
    letterSpacing: 0.4,
  },
  capturedTime: {
    fontSize: 11,
    color: STEP_PALETTE.textTertiary,
  },
  capturedContent: {
    ...text.serifMeta,
    color: STEP_PALETTE.textPrimary,
  },
  input: {
    ...text.serifBody,
    color: STEP_PALETTE.textPrimary,
    backgroundColor: STEP_PALETTE.bgPrimary,
    borderRadius: C.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
});
