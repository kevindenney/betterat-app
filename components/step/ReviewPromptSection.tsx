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
import type {
  NormalizedReviewSection,
  ReviewSectionPrompt,
  ReviewSectionSource,
} from '@/lib/step/getReviewSections';

// Local colors — kept in sync with StepCritiqueContent's C palette so the
// section blends with the rest of the After tab.
const C = {
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#D1D0CD',
  accent: '#3D8A5A',
  coral: '#D89575',
  badgeBg: '#EDECEA',
  badgeText: '#6D6C6A',
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
          <Ionicons name={meta.icon} size={11} color={C.badgeText} />
          <Text style={s.sourceBadgeText}>{meta.label}</Text>
        </View>
        {captured ? <Text style={s.capturedTime}>{captured}</Text> : null}
      </View>
      <Text style={s.capturedContent}>{section.content}</Text>
    </View>
  );
}

export function ReviewPromptSection({
  label,
  sections,
  icon,
  editable,
}: ReviewPromptSectionProps) {
  // Collapse empty prompts: no captured sections AND no editable input.
  if (sections.length === 0 && !editable) return null;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        {icon ? <Ionicons name={icon.name} size={18} color={icon.color} /> : null}
        <Text style={s.title}>{label}</Text>
      </View>
      {sections.map((section, idx) => (
        <CapturedCard key={`${section.source}-${idx}`} section={section} />
      ))}
      {editable ? (
        <TextInput
          style={s.input}
          value={editable.value}
          onChangeText={editable.editable ? editable.onChange : undefined}
          placeholder={editable.editable ? editable.placeholder : ''}
          placeholderTextColor={C.labelLight}
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
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  capturedCard: {
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    gap: 6,
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
    backgroundColor: C.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.badgeText,
    letterSpacing: 0.5,
  },
  capturedTime: {
    fontSize: 11,
    color: C.labelMid,
  },
  capturedContent: {
    fontSize: 13,
    color: C.labelDark,
    lineHeight: 19,
  },
  input: {
    fontSize: 13,
    color: C.labelDark,
    lineHeight: 20,
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    minHeight: 80,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
});
