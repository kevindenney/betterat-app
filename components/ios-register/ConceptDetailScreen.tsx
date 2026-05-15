/**
 * ConceptDetailScreen — canonical Concept detail iOS surface with 3 state
 * variants: new, dormant, and breakthrough.
 *
 * The Read-mode detail view that drills in from the Playbook concept shelf.
 * Renders one concept's synthesis-in-your-words + chronological reflection
 * trail. Apple Books inheritance, gray-6 ground, white synthesis card,
 * italic-only-for-voice on reflections.
 *
 * Variants (selected via the `variant` prop):
 *   new           — one reflection in. "Still forming" state pill (neutral
 *                   ring glyph). Synthesis-as-not-yet (italic + secondary)
 *                   says we haven't crystallized this in your voice yet.
 *                   A quiet mute-tint "Try next" suggest-card sits where
 *                   the second synthesis paragraph would normally live.
 *   dormant       — full mature synthesis but the user hasn't touched
 *                   this concept in months. Practicing pill in iOS blue
 *                   (no live-dot — concept is resting, not in play).
 *                   The stamp reads "4 months ago", honest. Below the
 *                   reflections list, a one-line dormant footer with a
 *                   single coral dot offers "Worth revisiting?"
 *   breakthrough  — the system has clustered evidence that the concept
 *                   has shifted. Breakthrough pill (coral with live dot).
 *                   A coral AI-offer card "We noticed a shift" sits
 *                   between the synthesis card and the reflections list,
 *                   offering to author a reflection about the change.
 *
 * Architecture decision #4 reminder: this is a **detail** surface, distinct
 * from any summary-card representation of the same concept. Summary and
 * detail are different jobs, not scaled versions of one another.
 *
 * Earned-register exceptions inherited from the canonical Concept register:
 *   - italic-only-for-voice on reflection first-line (already in ReflectionCard)
 *   - state pill grammar (forming / practicing / breakthrough) is the
 *     register's per-concept accent system
 * No new variant-specific weight-ups. Per architecture decision #3, none
 * of the variant-specific actions (Worth revisiting? · Write what changed)
 * are irreversible-or-near-irreversible without re-entry, and the surface's
 * primary purpose is reading the concept, not deciding on the offer.
 *
 * Visual source: Claude Design "Concept · Variants · iOS register" handoff.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { ReflectionCard } from './ReflectionCard';
import type { SourceGlyphVariant } from './SourceGlyph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConceptDetailVariant = 'new' | 'dormant' | 'breakthrough';
export type ConceptDetailMode = 'read' | 'work';

/**
 * The state pill rendered in the title-block meta row. Maps to the
 * register's per-concept accent system:
 *   forming      → mute-tint, neutral ring glyph (V1 "new")
 *   practicing   → iOS blue tint, blue dot (V2 "dormant" — concept is
 *                  practicing but resting)
 *   learning     → mute-tint, neutral ring (entering / earlier than practicing)
 *   breakthrough → coral tint, coral live dot (V3)
 */
export type ConceptStatePillKind =
  | 'forming'
  | 'practicing'
  | 'learning'
  | 'breakthrough';

export interface ConceptReflection {
  id: string;
  whenParts: string[];
  body: string;
  source: SourceGlyphVariant;
  provenance: string;
  /** Italic display (overrides voice-default heuristic). */
  italic?: boolean;
  /** True for the originating reflection — renders the coral first-written tag. */
  origin?: boolean;
  onPress?: () => void;
}

export interface ConceptDetailContent {
  /** Concept name — 30pt semibold title. */
  title: string;
  /** State pill kind. Caller maps the per-user concept progression state. */
  stateKind: ConceptStatePillKind;
  /** State pill label override. Defaults derived from stateKind. */
  stateLabel?: string;
  /** Meta line spans rendered with bullet separators ("Named yesterday", "1 reflection"). */
  metaSpans: string[];
  /**
   * Synthesis paragraphs. V1 typically passes a single "not yet" line; V2/V3
   * pass the full mature synthesis (1-2 paragraphs).
   */
  synthesisParagraphs: string[];
  /** Right-aligned stamp on the synthesis card ("2 days ago", "4 months ago", "not yet"). */
  synthesisStamp: string;
  /** V1-only: copy for the "Try next" suggest card. Ignored on V2 / V3. */
  suggestNextCopy?: string;
  /** V3-only: the AI offer card body. Ignored on V1 / V2. */
  aiOfferBody?: string;
  /** V3-only: AI offer label (defaults to "We noticed a shift"). */
  aiOfferLabel?: string;
  /** V2-only: dormant footer copy ("Last reflection 4 months ago"). */
  dormantFooterStamp?: string;
  /** V2-only: dormant footer offer copy ("Worth revisiting?"). */
  dormantFooterAsk?: string;
  reflections: ConceptReflection[];
  /** Total reflection count for the shelf head ("5 total"). Falls back to reflections.length. */
  totalReflections?: number;
}

interface Props {
  variant: ConceptDetailVariant;
  content: ConceptDetailContent;
  mode?: ConceptDetailMode;
  onModeChange?: (mode: ConceptDetailMode) => void;
  onBack?: () => void;
  onSharePress?: () => void;
  onMorePress?: () => void;
  /** V3-only: caller wires the actual reflection-authoring jump. */
  onAiOfferAccept?: () => void;
  onAiOfferDismiss?: () => void;
  /** V2-only: caller wires the actual revisit jump. */
  onDormantOfferPress?: () => void;
  /** Bottom inset for floating tab bar. */
  bottomPad?: number;
}

// ---------------------------------------------------------------------------

export function ConceptDetailScreen({
  variant,
  content,
  mode = 'read',
  onModeChange,
  onBack,
  onSharePress,
  onMorePress,
  onAiOfferAccept,
  onAiOfferDismiss,
  onDormantOfferPress,
  bottomPad = 130,
}: Props) {
  const totalReflections = content.totalReflections ?? content.reflections.length;
  return (
    <View style={styles.screen}>
      {/* Top chrome — back chevron + share + dots */}
      <View style={styles.topChrome}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Playbook"
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={IOS_REGISTER.accentUserAction}
          />
          <Text style={styles.backLabel}>Playbook</Text>
        </Pressable>
        <View style={styles.rightGlyphs}>
          <Pressable
            onPress={onSharePress}
            accessibilityRole="button"
            accessibilityLabel="Share"
            hitSlop={8}
            style={styles.glyphBtn}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
          <Pressable
            onPress={onMorePress}
            accessibilityRole="button"
            accessibilityLabel="More"
            hitSlop={8}
            style={styles.glyphBtn}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Title block — eyebrow + title + state pill + meta */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>CONCEPT</Text>
          <Text style={styles.titleH1}>{content.title}</Text>
          <View style={styles.metaRow}>
            <StatePill
              kind={content.stateKind}
              label={content.stateLabel ?? defaultLabelForKind(content.stateKind)}
            />
            {content.metaSpans.length > 0 && (
              <View style={styles.metaSpansRow}>
                {content.metaSpans.map((span, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={styles.metaSep} />}
                    <Text style={styles.metaSpan}>{span}</Text>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Read / Work segmented control */}
        <View style={styles.segWrap}>
          <Segment
            active={mode === 'read'}
            onPress={() => onModeChange?.('read')}
            label="Read"
          />
          <Segment
            active={mode === 'work'}
            onPress={() => onModeChange?.('work')}
            label="Work"
          />
        </View>

        {/* Synthesis card */}
        <View
          style={[
            styles.synthCard,
            variant === 'new' && styles.synthCardForming,
          ]}
        >
          <View style={styles.synthEyebrowRow}>
            <Text style={styles.synthEyebrow}>SYNTHESIS — IN YOUR WORDS</Text>
            <Text style={styles.synthStamp}>{content.synthesisStamp}</Text>
          </View>
          {content.synthesisParagraphs.map((p, i) => (
            <Text
              key={i}
              style={[
                styles.synthBody,
                variant === 'new' && styles.synthBodyForming,
                i > 0 && { marginTop: 10 },
              ]}
            >
              {p}
            </Text>
          ))}
        </View>

        {/* V1-only: Try next suggest card */}
        {variant === 'new' && content.suggestNextCopy ? (
          <View style={styles.suggestCard}>
            <Text style={styles.suggestEyebrow}>TRY NEXT</Text>
            <Text style={styles.suggestBody}>{content.suggestNextCopy}</Text>
          </View>
        ) : null}

        {/* V3-only: AI offer card — coral, "We noticed a shift" */}
        {variant === 'breakthrough' && content.aiOfferBody ? (
          <View style={styles.aiOffer}>
            <View style={styles.aiOfferHead}>
              <Ionicons
                name="sparkles"
                size={17}
                color={IOS_REGISTER.accentMarkedContent}
              />
              <Text style={styles.aiOfferLabel}>
                {(content.aiOfferLabel ?? 'We noticed a shift').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.aiOfferBody}>{content.aiOfferBody}</Text>
            <View style={styles.aiOfferActions}>
              <Pressable
                onPress={onAiOfferAccept}
                style={styles.aiOfferFill}
                accessibilityRole="button"
              >
                <Text style={styles.aiOfferFillText}>Write what changed</Text>
              </Pressable>
              <Pressable
                onPress={onAiOfferDismiss}
                style={styles.aiOfferText}
                accessibilityRole="button"
              >
                <Text style={styles.aiOfferTextLabel}>Not yet</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Reflections shelf head + list */}
        <View style={styles.shelfHead}>
          <Text style={styles.shelfHeadH2}>Reflections</Text>
          <Text style={styles.shelfCount}>
            {totalReflections} total
          </Text>
        </View>

        <View style={styles.reflections}>
          {content.reflections.map((r) => (
            <ReflectionCard
              key={r.id}
              whenParts={r.whenParts}
              firstLine={r.body}
              source={r.source}
              provenance={r.provenance}
              italic={r.italic}
              origin={r.origin}
              onPress={r.onPress}
            />
          ))}
        </View>

        {/* V2-only: dormant footer — one line, single coral dot */}
        {variant === 'dormant' &&
        (content.dormantFooterStamp || content.dormantFooterAsk) ? (
          <Pressable
            onPress={onDormantOfferPress}
            style={styles.dormantFooter}
            accessibilityRole="button"
          >
            {content.dormantFooterStamp ? (
              <>
                <Text style={styles.dormantStamp}>
                  {content.dormantFooterStamp}
                </Text>
                {content.dormantFooterAsk ? (
                  <View style={styles.dormantSep} />
                ) : null}
              </>
            ) : null}
            {content.dormantFooterAsk ? (
              <>
                <View style={styles.dormantCoralDot} />
                <Text style={styles.dormantAsk}>
                  {content.dormantFooterAsk}
                </Text>
              </>
            ) : null}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

function StatePill({
  kind,
  label,
}: {
  kind: ConceptStatePillKind;
  label: string;
}) {
  if (kind === 'forming') {
    return (
      <View style={[styles.statePill, styles.statePillForming]}>
        <View style={styles.statePillRing} />
        <Text style={[styles.statePillText, { color: IOS_REGISTER.labelSecondary }]}>
          {label}
        </Text>
      </View>
    );
  }
  if (kind === 'breakthrough') {
    return (
      <View
        style={[
          styles.statePill,
          { backgroundColor: 'rgba(255, 107, 107, 0.18)' },
        ]}
      >
        <View
          style={[
            styles.statePillDot,
            { backgroundColor: IOS_REGISTER.accentMarkedContent },
          ]}
        />
        <Text style={[styles.statePillText, { color: '#E85A5A' }]}>{label}</Text>
      </View>
    );
  }
  // practicing / learning
  return (
    <View
      style={[
        styles.statePill,
        { backgroundColor: 'rgba(0, 122, 255, 0.10)' },
      ]}
    >
      <View
        style={[
          styles.statePillDot,
          { backgroundColor: IOS_REGISTER.accentUserAction },
        ]}
      />
      <Text style={[styles.statePillText, { color: IOS_REGISTER.accentUserAction }]}>
        {label}
      </Text>
    </View>
  );
}

function defaultLabelForKind(kind: ConceptStatePillKind): string {
  switch (kind) {
    case 'forming':
      return 'still forming';
    case 'practicing':
      return 'practicing';
    case 'learning':
      return 'learning';
    case 'breakthrough':
      return 'breakthrough';
  }
}

function Segment({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.seg, active && styles.segOn]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segLabel, active && styles.segLabelOn]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // ----- top chrome -----
  topChrome: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backLabel: {
    fontSize: 17,
    letterSpacing: -0.4,
    color: IOS_REGISTER.accentUserAction,
    marginLeft: 2,
  },
  rightGlyphs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    gap: 2,
  },
  glyphBtn: {
    padding: 6,
  },
  // ----- title block -----
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  titleEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 10,
  },
  titleH1: {
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 33,
    letterSpacing: -0.78,
    color: IOS_REGISTER.label,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaSpansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  metaSpan: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.15,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  // ----- state pill -----
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  statePillForming: {
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
  },
  statePillRing: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.25,
    borderColor: IOS_REGISTER.labelTertiary,
    backgroundColor: 'transparent',
  },
  statePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statePillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // ----- read/work segmented -----
  segWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 18,
    flexDirection: 'row',
    gap: 2,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 2,
    borderRadius: 9,
    height: 32,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  segOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: IOS_REGISTER.labelSecondary,
  },
  segLabelOn: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  // ----- synthesis card -----
  synthCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  synthCardForming: {},
  synthEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  synthEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  synthStamp: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  synthBody: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
    color: IOS_REGISTER.label,
    letterSpacing: -0.34,
  },
  synthBodyForming: {
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
  },
  // ----- suggest card (V1) -----
  suggestCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
    borderRadius: 14,
    gap: 6,
  },
  suggestEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  suggestBody: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: IOS_REGISTER.label,
    letterSpacing: -0.24,
  },
  // ----- ai offer card (V3) -----
  aiOffer: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
    borderRadius: 14,
  },
  aiOfferHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  aiOfferLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.accentMarkedContent,
  },
  aiOfferBody: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
    color: IOS_REGISTER.label,
    letterSpacing: -0.34,
    marginBottom: 14,
  },
  aiOfferActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  aiOfferFill: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  aiOfferFillText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  aiOfferText: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  aiOfferTextLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- reflections shelf -----
  shelfHead: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  shelfHeadH2: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  shelfCount: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.08,
  },
  reflections: {
    paddingHorizontal: 16,
    gap: 10,
  },
  // ----- dormant footer (V2) -----
  dormantFooter: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dormantStamp: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.08,
  },
  dormantSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
  },
  dormantCoralDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  dormantAsk: {
    fontSize: 13,
    color: '#E85A5A',
    fontWeight: '500',
    letterSpacing: -0.08,
  },
});
