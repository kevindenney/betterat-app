/**
 * L1 — one card focused, peeks left and right, horizontal swipe.
 *
 * Frame 1/5. The full step card: pre-title, title, meta row, Plan/Do/Reflect
 * phase tabs (presentational — actual tab routing happens elsewhere in the
 * Practice tab), what/how body, capability chips, FROM provenance footer,
 * cohort avatars. Step counter ("Step 27 of 41") sits in the parent header.
 *
 * Pinch out → L2. Tap the right-rail pill → jump.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDetailContent } from '@/components/step/StepDetailContent';
import type { TimelineDataset, TimelineStep } from './types';

interface L1StepViewProps {
  dataset: TimelineDataset;
  step: TimelineStep;
  /**
   * When provided, the L1 card becomes pressable — tap → push to the full
   * step detail surface (existing `<StepDetailContent />` at /step/[id]).
   * The canvas itself stays mounted; back-gesture from detail returns here
   * with zoom level preserved. Omitted in preview routes where no real
   * step record exists.
   */
  onOpenStepDetail?: (stepId: string) => void;
  /**
   * When true, L1 embeds the full <StepDetailContent /> inline — same
   * Plan/Do/Reflect/Discuss tabs ("taskbar") + rich body content as the
   * /step/[id] route. The pinch-out gesture takes the user back to L2;
   * no extra navigation push needed. Requires `step.id` to be a real
   * Supabase row UUID. Sample-data routes leave this false and get the
   * slim preview card.
   */
  embedFullDetail?: boolean;
}

const PHASES = ['Plan', 'Do', 'Reflect'] as const;

export function L1StepView({ step, onOpenStepDetail, embedFullDetail }: L1StepViewProps) {
  if (embedFullDetail) {
    return (
      <View style={styles.embedHost}>
        <StepDetailContent stepId={step.id} />
      </View>
    );
  }

  const activePhase =
    step.status === 'plan' ? 'Plan' : step.status === 'do' ? 'Do' : 'Reflect';

  const handleOpen = onOpenStepDetail
    ? () => onOpenStepDetail(step.id)
    : undefined;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={styles.card}
        onPress={handleOpen}
        disabled={!handleOpen}
        accessibilityRole={handleOpen ? 'button' : undefined}
        accessibilityLabel={handleOpen ? `Open ${step.title}` : undefined}
      >
        {handleOpen ? (
          <View style={styles.openHint}>
            <Text style={styles.openHintText}>OPEN</Text>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={IOS_REGISTER.accentUserAction}
            />
          </View>
        ) : null}
        {step.preTitle ? (
          <Text style={styles.eyebrow}>{step.preTitle}</Text>
        ) : null}
        <Text style={styles.title}>{step.title}</Text>

        {(step.metaLeft || step.metaRight) ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{step.metaLeft}</Text>
            {step.metaRight ? <Text style={styles.metaText}>{step.metaRight}</Text> : null}
          </View>
        ) : null}

        <View style={styles.phaseRow}>
          {PHASES.map((p) => {
            const active = p === activePhase;
            return (
              <View key={p} style={styles.phaseTab}>
                <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]}>{p}</Text>
                {active ? <View style={styles.phaseUnderline} /> : null}
              </View>
            );
          })}
        </View>

        {step.whatBody ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>WHAT WILL YOU DO?</Text>
            <Text style={styles.bodyText}>{step.whatBody}</Text>
          </View>
        ) : null}

        {step.howItems?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>HOW WILL YOU DO IT?</Text>
            {step.howItems.map((item, idx) => (
              <View key={idx} style={styles.howRow}>
                <View style={[styles.check, item.checked && styles.checkOn]}>
                  {item.checked ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.howLabel,
                    item.checked && styles.howLabelChecked,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {step.capabilities?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>CAPABILITIES</Text>
            <View style={styles.capabilityRow}>
              {step.capabilities.map((cap) => (
                <View
                  key={cap.id}
                  style={[styles.capChip, { backgroundColor: withAlpha(cap.color, 0.16) }]}
                >
                  <Text style={[styles.capText, { color: darken(cap.color) }]}>{cap.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step.from ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>FROM</Text>
            <View style={styles.fromRow}>
              <Ionicons name="git-network-outline" size={13} color={IOS_REGISTER.labelSecondary} />
              <Text style={styles.fromText} numberOfLines={2}>
                <Text style={styles.fromSource}>{step.from.source}</Text>
                {step.from.suggestedBy ? (
                  <Text style={styles.fromSuggested}>
                    {`  ·  suggested by ${step.from.suggestedBy}`}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>
    </ScrollView>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * 0.65);
  const g = Math.round(parseInt(m[2], 16) * 0.65);
  const b = Math.round(parseInt(m[3], 16) * 0.65);
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  embedHost: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  openHint: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  openHintText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.accentUserAction,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.accentUserAction,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.5,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  phaseTab: {
    paddingBottom: 8,
  },
  phaseLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  phaseLabelActive: {
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '600',
  },
  phaseUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  section: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.separatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  howLabel: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  howLabelChecked: {
    color: IOS_REGISTER.labelSecondary,
  },
  capabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  capChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  capText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fromText: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  fromSource: {
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  fromSuggested: {
    color: IOS_REGISTER.labelSecondary,
  },
});
