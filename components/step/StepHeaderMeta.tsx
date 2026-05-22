/**
 * StepHeaderMeta — eyebrow (parent program · step N) and subtitle (date,
 * time range, preceptor/attribution) that sit above/below the step title.
 *
 * Eyebrow only renders when the step came from a blueprint (source_blueprint_id
 * resolves via useStepBlueprintChrome). Subtitle only renders when at least
 * one of starts_at / preceptor is set.
 *
 * Preceptor / attribution lives on step.metadata.preceptor for now — when
 * the step_collaborators UI ships, this falls back to a collaborator with
 * role='mentor' or 'preceptor'.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { STEP_COLORS } from '@/lib/step-theme';
import { useStepBlueprintChrome } from '@/hooks/useStepBlueprintChrome';

interface SubtitleProps {
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function StepHeaderEyebrow({ stepId }: { stepId: string }) {
  const { data } = useStepBlueprintChrome(stepId);
  if (!data) return null;
  const label = `${data.blueprintShortName.toUpperCase()}${
    data.stepNumber != null ? ` · STEP ${data.stepNumber}` : ''
  }`;
  return <Text style={styles.eyebrow}>{label}</Text>;
}

export function StepHeaderSubtitle({ startsAt, endsAt, metadata }: SubtitleProps) {
  const parts = formatSubtitleParts({ startsAt, endsAt, metadata });
  if (parts.length === 0) return null;
  return <Text style={styles.subtitle}>{parts.join(' · ')}</Text>;
}

function formatSubtitleParts({
  startsAt,
  endsAt,
  metadata,
}: SubtitleProps): string[] {
  const out: string[] = [];

  if (startsAt) {
    const start = new Date(startsAt);
    if (!Number.isNaN(start.getTime())) {
      out.push(
        start.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }),
      );
      if (endsAt) {
        const end = new Date(endsAt);
        if (!Number.isNaN(end.getTime())) {
          out.push(`${formatHour(start)}–${formatHour(end)}`);
        } else {
          out.push(formatHour(start));
        }
      } else {
        out.push(formatHour(start));
      }
    }
  }

  // metadata.preceptor (string) or metadata.attribution (string)
  const preceptor = pickString(metadata, ['preceptor']);
  const attribution = pickString(metadata, ['attribution']);
  if (preceptor) out.push(`${preceptor} preceptor`);
  else if (attribution) out.push(attribution);

  return out;
}

function formatHour(d: Date): string {
  // "7a" / "7:30a" / "12p" — drop minutes when :00, lowercase am/pm to
  // match the canonical's "7a-7p" style.
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

function pickString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!metadata) return null;
  for (const k of keys) {
    const v = metadata[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: STEP_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: STEP_COLORS.secondaryLabel,
    marginTop: 4,
  },
});
