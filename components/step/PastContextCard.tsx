/**
 * PastContextCard — ambient "From last time …" surface for the During tab.
 *
 * Per redesign §10.2 there's no AI badge, no chat bubble, no avatar — the
 * surface itself communicates that this is past context. Matches mockup 14.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, text } from '@/lib/design-tokens';
import { STEP_PALETTE } from '@/lib/step-theme';

interface PastContextCardProps {
  quote: string;
  completedAtIso: string;
  stepTitle?: string;
}

function formatRelativeAge(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'Earlier today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return 'Last month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function PastContextCard({ quote, completedAtIso, stepTitle }: PastContextCardProps) {
  const trimmed = quote.trim();
  if (!trimmed) return null;
  const age = formatRelativeAge(completedAtIso);
  const caption = stepTitle ? `${age} · ${stepTitle}` : age;
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>From last time</Text>
      <Text style={s.quote}>“{trimmed}”</Text>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  eyebrow: {
    ...text.sansEyebrow,
    color: STEP_PALETTE.textTertiary,
    letterSpacing: 0.6,
    fontSize: 11,
  },
  quote: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    color: STEP_PALETTE.textPrimary,
    opacity: 0.92,
  },
  caption: {
    fontSize: 11,
    color: STEP_PALETTE.textTertiary,
  },
});
