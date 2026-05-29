/**
 * Step digest card — the canonical small step representation used by L2
 * and L3. L2's nearby mode is intentionally sparse: neighboring cards stay
 * identifiable while the centered card can surface one relevant content
 * snippet without becoming a full L1 detail surface.
 *
 * Matches Frame 2/3/6/7. Status dot, pre-title eyebrow, title, capability
 * chips, provenance footer, cohort avatars.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { Capability, CohortAvatar, StepHowItem, StepOriginKind, StepStatus, TimelineStep } from './types';

const STATUS_VISUAL: Record<
  StepStatus,
  { label: string; color: string; dotColor: string }
> = {
  plan:      { label: 'Plan',      color: IOS_REGISTER.accentUserAction, dotColor: IOS_REGISTER.accentUserAction },
  do:        { label: 'Do',        color: '#FF9500',                     dotColor: '#FF9500' },
  reflect:   { label: 'Reflect',   color: '#5BA46F',                     dotColor: '#5BA46F' },
  reflected: { label: 'REFLECTED', color: IOS_REGISTER.labelSecondary,   dotColor: IOS_REGISTER.labelTertiary },
  done:      { label: 'Done',      color: IOS_REGISTER.labelSecondary,   dotColor: IOS_REGISTER.labelTertiary },
};

const NEARBY_STATUS_LABEL: Record<StepStatus, string> = {
  plan: 'Queued',
  do: 'In play',
  reflect: 'Reflecting',
  reflected: 'Done',
  done: 'Done',
};

const ORIGIN_VISUAL: Record<
  StepOriginKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }
> = {
  mine: {
    label: 'Mine',
    icon: 'person-circle-outline',
    color: IOS_REGISTER.accentUserAction,
    bg: 'rgba(0, 122, 255, 0.08)',
    border: 'rgba(0, 122, 255, 0.22)',
  },
  shared: {
    label: 'Shared',
    icon: 'people-outline',
    color: '#2D8B6A',
    bg: 'rgba(45, 139, 106, 0.10)',
    border: 'rgba(45, 139, 106, 0.30)',
  },
  blueprint: {
    label: 'Blueprint',
    icon: 'bookmark-outline',
    color: '#7B3FB0',
    bg: 'rgba(123, 63, 176, 0.10)',
    border: 'rgba(123, 63, 176, 0.28)',
  },
};

interface StepDigestCardProps {
  step: TimelineStep;
  /** Visually highlights the card with iOS-blue outline (the "came from" or "today" card). */
  highlighted?: boolean;
  /** L3 section layout — narrower, no capability chips, no provenance. */
  compact?: boolean;
  /** L2 nearby layout — slim planning columns around NOW. */
  variant?: 'default' | 'nearby';
  /** When true, surface one high-signal snippet for the centered nearby card. */
  showRelevantSnippet?: boolean;
  /**
   * When provided and the step is in-play ('do'), the nearby card renders
   * the how-sub-steps as a checkable checklist; tapping a row toggles it.
   */
  onToggleHowItem?: (subStepId: string, completed: boolean) => void;
  onPress?: () => void;
}

export function StepDigestCard({
  step,
  highlighted,
  compact,
  variant = 'default',
  showRelevantSnippet = false,
  onToggleHowItem,
  onPress,
}: StepDigestCardProps) {
  const status = STATUS_VISUAL[step.status];
  const isToday = step.preTitle?.startsWith('TODAY');
  const isNearby = variant === 'nearby';
  const origin = ORIGIN_VISUAL[step.originKind ?? 'mine'];
  // In-play cards expose an interactive checklist instead of the static
  // "next beats" snippet so the user can tick items off straight from L2.
  const inPlayChecklist =
    isNearby &&
    step.status === 'do' &&
    !!onToggleHowItem &&
    (step.howItems?.length ?? 0) > 0;
  // Done/reflected centered cards lead with the reflection digest (key
  // takeaway + lead reflection + evidence) instead of the "next beats"
  // planning snippet. Falls back to the planning snippet when the step
  // was completed without a reflection.
  const isReflectedDone = step.status === 'done' || step.status === 'reflected';
  const reflectedBlock =
    showRelevantSnippet && isReflectedDone && !inPlayChecklist
      ? getReflectedBlock(step)
      : null;
  const relevantBlock =
    showRelevantSnippet && !inPlayChecklist && !reflectedBlock
      ? getRelevantBlock(step)
      : null;
  const visibleCapabilities = (step.capabilities ?? []).filter((cap) => {
    const normalized = cap.label.trim().toLowerCase();
    return ![
      'general',
      'practice',
      'planning',
      'plan',
      'do',
      'done',
      'reflect',
      'reflecting',
      'review',
    ].includes(normalized);
  });
  const primaryCapability = visibleCapabilities[0];
  const statusLabel = isNearby ? NEARBY_STATUS_LABEL[step.status] : status.label;

  // When no onPress is supplied the card is non-interactive (e.g. L2's
  // carousel, where a wrapping RNGH gesture owns tap-to-open + drag). Render
  // a plain View so it doesn't claim the touch responder from that gesture.
  const Container: React.ComponentType<any> = onPress ? Pressable : View;
  const containerProps = onPress ? { onPress } : {};

  return (
    <Container
      {...containerProps}
      style={[
        styles.card,
        compact && styles.cardCompact,
        isNearby && styles.cardNearby,
        isNearby && { borderColor: origin.border },
        isNearby && highlighted && styles.cardNearbyFocused,
        isNearby && !highlighted && styles.cardNearbySide,
        highlighted && styles.cardHighlighted,
      ]}
    >
      {isNearby ? (
        <View style={[styles.originAccent, { backgroundColor: origin.color }]} />
      ) : null}

      {(isNearby || compact) && primaryCapability ? (
        <View
          style={[
            styles.nearbyRail,
            compact && !isNearby && styles.compactRail,
            { backgroundColor: withAlpha(primaryCapability.color, highlighted ? 0.8 : 0.55) },
          ]}
        />
      ) : null}

      {isNearby ? (
        <View style={[styles.originPill, { backgroundColor: origin.bg, borderColor: origin.border }]}>
          <Ionicons name={origin.icon} size={10} color={origin.color} />
          <Text style={[styles.originPillText, { color: origin.color }]} numberOfLines={1}>
            {origin.label}
          </Text>
        </View>
      ) : null}

      {step.preTitle ? (
        <Text
          style={[
            styles.eyebrow,
            isNearby && styles.eyebrowNearby,
            isToday && styles.eyebrowToday,
          ]}
          numberOfLines={1}
        >
          {step.preTitle}
        </Text>
      ) : null}

      <Text
        style={[
          styles.title,
          isNearby && styles.titleNearby,
          isNearby && !highlighted && styles.titleNearbySide,
        ]}
        numberOfLines={isNearby ? 2 : 3}
      >
        {step.title}
      </Text>

      {inPlayChecklist ? (
        <View style={styles.checklistWrap}>
          {(step.howItems ?? []).map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={() => onToggleHowItem?.(item.id, !item.checked)}
            />
          ))}
        </View>
      ) : null}

      {isNearby && reflectedBlock ? (
        <View style={styles.reflectedWrap}>
          <View style={styles.reflectedHeader}>
            <Ionicons name="sparkles" size={11} color="#2D8B6A" />
            <Text style={styles.reflectedLabel} numberOfLines={1}>
              {reflectedBlock.keyTakeaway ? 'Key takeaway' : 'Reflected'}
            </Text>
          </View>
          {reflectedBlock.lead ? (
            <Text style={styles.reflectedLead} numberOfLines={3}>
              {reflectedBlock.lead}
            </Text>
          ) : null}
          {reflectedBlock.keyTakeaway && reflectedBlock.reflection ? (
            <Text style={styles.reflectedReflection} numberOfLines={2}>
              {reflectedBlock.reflection}
            </Text>
          ) : null}
          {reflectedBlock.evidenceCount ? (
            <View style={styles.reflectedEvidenceRow}>
              <Ionicons name="document-attach-outline" size={11} color="#2D8B6A" />
              <Text style={styles.reflectedEvidenceText}>
                {reflectedBlock.evidenceCount}{' '}
                {reflectedBlock.evidenceCount === 1 ? 'evidence' : 'evidence items'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {isNearby && relevantBlock ? (
        <View style={styles.relevantWrap}>
          {relevantBlock.context ? (
            <Text style={styles.relevantContext} numberOfLines={1}>
              {relevantBlock.context}
            </Text>
          ) : null}
          {relevantBlock.beats.length > 0 ? (
            <View style={styles.beatsList}>
              {relevantBlock.beats.map((beat, idx) => (
                <View key={idx} style={styles.beatRow}>
                  <Text style={styles.beatBullet}>•</Text>
                  <Text style={styles.beatText} numberOfLines={2}>{beat}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {relevantBlock.why ? (
            <Text style={styles.relevantWhy} numberOfLines={2}>
              {relevantBlock.why}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.bottomBlock}>
        <View style={styles.statusRow}>
          {step.status === 'done' || step.status === 'reflected' ? (
            <Ionicons
              name={step.status === 'reflected' ? 'sparkles' : 'checkmark-circle'}
              size={12}
              color={status.color}
            />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
          )}
          <Text style={[styles.statusLabel, { color: status.color }]}>{statusLabel}</Text>
          {(isNearby || compact) && step.cohortAvatars?.length ? (
            <View style={styles.statusWithChip}>
              <AvatarStack avatars={step.cohortAvatars} max={2} compact />
              <Text style={styles.statusWithCount}>
                +{step.cohortAvatars.length}
              </Text>
            </View>
          ) : null}
        </View>

        {!compact && visibleCapabilities.length ? (
          <View style={styles.chipRow}>
            {visibleCapabilities.slice(0, isNearby ? 1 : 3).map((cap) => (
              <CapabilityChip key={cap.id} cap={cap} />
            ))}
          </View>
        ) : null}

        {!compact && step.from && !isNearby ? (
          <View style={styles.fromRow}>
            <Ionicons name="git-network-outline" size={11} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.fromText} numberOfLines={1}>
              {step.from.source}
            </Text>
          </View>
        ) : null}

        {!compact && step.cohortAvatars?.length && !isNearby ? (
          <View style={styles.cohortRow}>
            <AvatarStack avatars={step.cohortAvatars} />
            {step.cohortLabel ? (
              <Text style={styles.cohortLabel}>{step.cohortLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {step.pinnedFromOtherInterest ? (
          <View style={styles.pinnedRow}>
            <Ionicons name="pin" size={10} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.pinnedLabel} numberOfLines={1}>
              Pinned from another interest
            </Text>
          </View>
        ) : null}
      </View>
    </Container>
  );
}

/**
 * Build the richer "what does this step actually involve" block shown
 * under the title on a nearby (centered) card.
 *
 * Returns three optional strands:
 *   - context: a single one-liner with who/when/where (synthesized from
 *     metaLeft, whenLabel, cohortLabel)
 *   - beats: up to three unchecked howItems as bullets
 *   - why: one whyReasoning sentence under the beats (when present)
 *
 * If a step has nothing to add beyond its title (no beats, no context,
 * no why), the block resolves to null so the card stays compact.
 */
// Phrases that creep into metaLeft for steps created via drop-pin,
// blueprint adoption, or other UI affordances. They describe *how* the
// step was created, not where/when/who — so they don't belong in the
// context line. When metaLeft starts with one of these, we skip it and
// fall through to whenLabel · cohortLabel instead.
const CREATION_SOURCE_PREFIXES = [
  'dropped pin',
  'from blueprint',
  'from playbook',
  'from suggestion',
  'pinned from',
  'imported from',
  'shared by',
];

function isCreationSourceMeta(meta: string): boolean {
  const m = meta.trim().toLowerCase();
  return CREATION_SOURCE_PREFIXES.some((p) => m.startsWith(p));
}

function getRelevantBlock(
  step: TimelineStep,
): { context?: string; beats: string[]; why?: string } | null {
  // Unchecked beats — the "what to do next" set.
  const uncheckedBeats = (step.howItems ?? [])
    .filter((h) => !h.checked)
    .slice(0, 3)
    .map((h) => h.label);

  // Context line — prefer metaLeft (already includes day · venue), but
  // skip provenance/creation-source values like "Dropped pin · ..." that
  // describe how the step was created rather than where/when/who. Fall
  // back to a synthesized when · cohort line.
  const useMetaLeft = step.metaLeft && !isCreationSourceMeta(step.metaLeft);
  const contextParts: string[] = [];
  if (useMetaLeft && step.metaLeft) {
    contextParts.push(step.metaLeft);
  } else {
    if (step.whenLabel) contextParts.push(step.whenLabel);
    if (step.cohortLabel) contextParts.push(step.cohortLabel);
  }
  const context = contextParts.join(' · ') || undefined;

  const why = step.whyReasoning?.trim() || undefined;

  if (!context && uncheckedBeats.length === 0 && !why) return null;
  return { context, beats: uncheckedBeats, why };
}

// Single checklist row on an in-play L2 card. Uses an RNGH Tap so it nests
// inside the carousel slot's drag/tap gesture and wins the touch (a bare
// Pressable would race with the card-level tap-to-open).
function ChecklistRow({
  item,
  onToggle,
}: {
  item: StepHowItem;
  onToggle: () => void;
}) {
  const tap = React.useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((_e, success) => {
          if (success) onToggle();
        }),
    [onToggle],
  );
  return (
    <GestureDetector gesture={tap}>
      <View style={styles.checklistRow}>
        <View
          style={[
            styles.checkbox,
            item.checked ? styles.checkboxChecked : null,
          ]}
        >
          {item.checked ? (
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          ) : null}
        </View>
        <Text
          style={[
            styles.checklistLabel,
            item.checked ? styles.checklistLabelDone : null,
          ]}
          numberOfLines={2}
        >
          {item.label}
        </Text>
      </View>
    </GestureDetector>
  );
}

/**
 * Build the reflection digest shown under the title on a done/reflected
 * centered card. `lead` is the prominent line — the key takeaway when one was
 * written, otherwise the reflection summary, so the block always has a strong
 * anchor instead of a lone faint line. Returns null when the step carries no
 * reflection signal, so the card falls back to the planning snippet.
 */
function getReflectedBlock(step: TimelineStep): {
  keyTakeaway?: string;
  reflection?: string;
  lead?: string;
  evidenceCount?: number;
} | null {
  const keyTakeaway = step.keyTakeaway?.trim() || undefined;
  const reflection = step.reflectionSummary?.trim() || undefined;
  const evidenceCount = step.evidenceCount && step.evidenceCount > 0 ? step.evidenceCount : undefined;
  if (!keyTakeaway && !reflection && !evidenceCount) return null;
  return { keyTakeaway, reflection, lead: keyTakeaway ?? reflection, evidenceCount };
}

function CapabilityChip({ cap }: { cap: Capability }) {
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(cap.color, 0.12) }]}>
      <Text style={[styles.chipText, { color: darken(cap.color) }]}>{cap.label}</Text>
    </View>
  );
}

function AvatarStack({
  avatars,
  max = 3,
  compact = false,
}: {
  avatars: CohortAvatar[];
  max?: number;
  compact?: boolean;
}) {
  return (
    <View style={styles.avatarStack}>
      {avatars.slice(0, max).map((av, idx) => (
        <View
          key={av.id}
          style={[
            compact ? styles.avatarBubbleCompact : styles.avatarBubble,
            { backgroundColor: av.color, marginLeft: idx === 0 ? 0 : -6 },
          ]}
        >
          <Text style={compact ? styles.avatarTextCompact : styles.avatarText}>
            {compact ? av.initials.slice(0, 1) : av.initials}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Helpers — minimal color math; preview-fidelity only.
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
  const r = Math.round(parseInt(m[1], 16) * 0.7);
  const g = Math.round(parseInt(m[2], 16) * 0.7);
  const b = Math.round(parseInt(m[3], 16) * 0.7);
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: 14,
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    flex: 1,
  },
  cardCompact: {
    minHeight: 92,
    padding: 12,
    borderRadius: 12,
  },
  cardNearby: {
    minHeight: 312,
    paddingTop: 15,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  cardNearbyFocused: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardNearbySide: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  cardHighlighted: {
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  nearbyRail: {
    position: 'absolute',
    left: 10,
    top: 16,
    bottom: 16,
    width: 3,
    borderRadius: 999,
  },
  // Compact (L3) variant of the capability rail — slimmer and tighter
  // to the card edge so it reads as a tint, not a chunk.
  compactRail: {
    left: 6,
    top: 10,
    bottom: 10,
    width: 2,
  },
  originAccent: {
    position: 'absolute',
    top: 7,
    left: 24,
    right: 24,
    height: 3,
    borderRadius: 999,
  },
  originPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    marginLeft: 10,
    marginBottom: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  originPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 6,
  },
  eyebrowNearby: {
    paddingLeft: 10,
  },
  eyebrowToday: {
    color: IOS_REGISTER.accentUserAction,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  titleNearby: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '650',
    paddingLeft: 10,
    marginBottom: 8,
  },
  titleNearbySide: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 7,
  },
  relevantWrap: {
    marginBottom: 8,
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(210, 123, 84, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210, 123, 84, 0.18)',
    gap: 6,
  },
  relevantContext: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: '#B45F06',
    textTransform: 'uppercase',
  },
  checklistWrap: {
    marginBottom: 8,
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 149, 0, 0.2)',
    gap: 6,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
  },
  checklistLabelDone: {
    color: IOS_REGISTER.labelSecondary,
    textDecorationLine: 'line-through',
  },
  beatsList: {
    gap: 3,
  },
  beatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  beatBullet: {
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
    width: 8,
  },
  beatText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
  },
  relevantWhy: {
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
  },
  reflectedWrap: {
    marginBottom: 8,
    marginLeft: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 139, 106, 0.11)',
    borderLeftWidth: 2.5,
    borderLeftColor: '#2D8B6A',
    gap: 5,
  },
  reflectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reflectedLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#2D8B6A',
    textTransform: 'uppercase',
  },
  reflectedLead: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  reflectedReflection: {
    fontSize: 11.5,
    lineHeight: 16,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
  },
  reflectedEvidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 139, 106, 0.14)',
  },
  reflectedEvidenceText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2D8B6A',
  },
  bottomBlock: {
    gap: 8,
    marginTop: 'auto',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fromText: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    flexShrink: 1,
  },
  cohortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarBubbleCompact: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  avatarTextCompact: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
  },
  statusWithChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  statusWithCount: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  cohortLabel: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginLeft: 4,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedLabel: {
    fontSize: 10.5,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    flexShrink: 1,
  },
});
