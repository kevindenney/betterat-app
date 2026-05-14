/**
 * Reflect home — iOS register preview
 *
 * Sixth iOS-register preview surface. The contemplative root tab — long-
 * arc retrospection. Spec calls it "quieter than the rest of the product."
 *
 * Three white cards, in order:
 *   1. Capability arc — SVG line drawing over 12 weeks, one capability,
 *      current week marked with coral dot. No axis, no gridlines. Caption
 *      beneath with capability name + trend pill.
 *   2. Where your thinking has shifted — synthesis card chrome, AI-drafted
 *      from the user's voice, italic contrast spans.
 *   3. Moments returned to — three reflection cards inside one parent card
 *      with a system-purple return-count badge appended to the provenance row.
 *
 * Architectural commitments (from the design's side rail):
 *   - Large title in REGULAR (not semibold). The only iOS surface that
 *     breaks weight. The contemplative register: "Sunday morning" reads
 *     as a soft observation, not a heading.
 *   - No segmented control — Reflect home is read-only by intent. Compose
 *     mode lives on the capture surface, not duplicated here.
 *   - System purple at 0.12 tint is a new fourth accent — return-count
 *     borrows neither blue (information) nor coral (live/breakthrough).
 *     This is about memory, not state.
 *
 * Wire-up status:
 *   Real data:
 *     - Largetitle text from current weekday + relative-day formatting
 *     - Recent reflections from useMyTimeline (used as "moments returned to"
 *       — true return-count requires usage tracking we don't have yet)
 *   Placeholder:
 *     - Capability arc data (twelve-week trajectory) — no per-week
 *       capability progression table; SVG draws a fixed shape
 *     - "Where your thinking has shifted" body — no AI synthesis service
 *       yet; uses a static evocative placeholder
 *     - Return-count badges — placeholder counts until usage tracking exists
 *
 * Open at /reflect-ios.
 */

import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

import { IOS_COLORS, IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import type {
  StepReviewData,
  StepReviewSection,
} from '@/types/step-detail';
import { SourceGlyph, type SourceGlyphVariant } from '@/components/ios-register/SourceGlyph';

interface MomentItem {
  id: string;
  body: string;
  source: SourceGlyphVariant;
  provenance: string;
  returnCount: number;
}

export default function ReflectIosPreview() {
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;

  const { data: timeline } = useMyTimeline(interestId);

  const moments = buildMomentsReturnedTo(timeline ?? []);

  const today = new Date();
  const weekday = format(today, 'EEEE'); // e.g. "Sunday"
  const partOfDay = today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening';
  const largeTitle = `${weekday} ${partOfDay}`;

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top chrome — root tab */}
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <View style={styles.rightGlyphs}>
            <Pressable
              style={styles.glyphBtn}
              hitSlop={8}
              onPress={() => (router.canGoBack() ? router.back() : null)}
              accessibilityLabel="Close iOS preview"
            >
              <Ionicons name="close" size={22} color={IOS_REGISTER.accentUserAction} />
            </Pressable>
          </View>
        </View>

        <PreviewBanner />

        {/* Title block — 34pt REGULAR (intentional weight break) */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{largeTitle}</Text>
          <Text style={styles.titleMeta}>
            Week 7 of 12 · Spring Series
          </Text>
        </View>

        {/* Card 1 — Capability arc */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>CAPABILITY ARC · 12 WEEKS</Text>
          <View style={styles.arcWrap}>
            <Svg
              viewBox="0 0 360 120"
              preserveAspectRatio="none"
              width="100%"
              height={120}
            >
              {/* Vertical guide at week 7 */}
              <Line
                x1="180"
                y1="6"
                x2="180"
                y2="114"
                stroke="rgba(60,60,67,0.12)"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              {/* Projected future (dashed) */}
              <Path
                d="M 180 30 C 210 26, 240 22, 270 19 S 330 14, 354 12"
                fill="none"
                stroke="rgba(60,60,67,0.28)"
                strokeWidth={1.4}
                strokeDasharray="3 4"
                strokeLinecap="round"
              />
              {/* The arc — solid, weeks 1 → 7 */}
              <Path
                d="M 6 78 C 30 76, 48 75, 66 70 S 102 62, 120 56 S 156 42, 180 30"
                fill="none"
                stroke="#000000"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Origin dot */}
              <Circle cx={6} cy={78} r={2.4} fill="#000000" />
              {/* Week 7 highlight — outer coral ring + filled coral dot + white inner ring */}
              <Circle cx={180} cy={30} r={9} fill="rgba(255,107,107,0.18)" />
              <Circle cx={180} cy={30} r={4.2} fill="#E85A5A" />
              <Circle cx={180} cy={30} r={4.2} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
            </Svg>
          </View>
          <View style={styles.arcCaption}>
            <Text style={styles.arcCapLabel}>Heavy-air helm work</Text>
            <View style={styles.metaSep} />
            <View style={styles.trendPill}>
              <Ionicons
                name="trending-up"
                size={11}
                color={IOS_REGISTER.accentMarkedContent}
              />
              <Text style={styles.trendPillText}>trending breakthrough</Text>
            </View>
          </View>
        </View>

        {/* Card 2 — Where your thinking has shifted */}
        <View style={styles.card}>
          <View style={styles.cardEyebrowRow}>
            <Text style={styles.cardEyebrow}>Where your thinking has shifted</Text>
            <Text style={styles.cardStamp}>synthesized today</Text>
          </View>
          <Text style={styles.synthBody}>
            Three months ago you were sailing the favored side. Now you're
            sailing the shift. The{' '}
            <Text style={styles.italic}>boat speed</Text> conversation went
            quiet, and the <Text style={styles.italic}>wind reading</Text>{' '}
            conversation got loud.
          </Text>
        </View>

        {/* Card 3 — Moments returned to */}
        <View style={styles.card}>
          <View style={styles.cardEyebrowRow}>
            <Text style={styles.cardEyebrow}>Moments you've returned to</Text>
            <Text style={styles.cardStamp}>
              {moments.length} of {(timeline ?? []).length}
            </Text>
          </View>
          {moments.length === 0 ? (
            <Text style={styles.synthEmpty}>
              As reflections accumulate, the ones you keep coming back to
              will surface here.
            </Text>
          ) : (
            moments.map((m, idx) => (
              <View key={m.id}>
                {idx > 0 && <View style={styles.momentDivider} />}
                <Pressable style={styles.momentRow}>
                  <Text style={styles.momentQuote}>
                    {m.source === 'voice' ? `“${m.body}”` : m.body}
                  </Text>
                  <View style={styles.momentMetaRow}>
                    <SourceGlyph variant={m.source} size={20} />
                    <Text style={styles.momentProv}>{m.provenance}</Text>
                    <View style={styles.returnBadge}>
                      <Ionicons
                        name="arrow-undo-outline"
                        size={11}
                        color="#5856D6"
                      />
                      <Text style={styles.returnBadgeText}>
                        {m.returnCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMomentsReturnedTo(
  timeline: {
    id: string;
    title: string;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }[],
): MomentItem[] {
  const candidates = timeline
    .filter((s) => s.completed_at)
    .filter((s) => {
      const review = (s.metadata?.review_data as StepReviewData | undefined) ?? null;
      return Boolean(review?.sections?.length);
    })
    .sort((a, b) => {
      const at = a.completed_at ?? '';
      const bt = b.completed_at ?? '';
      return bt.localeCompare(at);
    })
    .slice(0, 3);

  return candidates.flatMap<MomentItem>((step, idx) => {
    const review = (step.metadata?.review_data as StepReviewData | undefined) ?? null;
    const sections = (review?.sections ?? []).filter(
      (s): s is StepReviewSection => Boolean(s.content?.trim()),
    );
    const section = sections[0];
    if (!section || !step.completed_at) return [];

    const date = parseISO(step.completed_at);
    const provenance = `${step.title ?? 'Step'} Debrief · ${formatDistanceToNowStrict(date, { addSuffix: true })}`;

    return [
      {
        id: step.id,
        body: shortenToQuotable(section.content),
        source: sourceVariantFor(section.source),
        provenance,
        // Placeholder return counts — true usage tracking doesn't exist yet.
        returnCount: 6 - idx,
      },
    ];
  });
}

function shortenToQuotable(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 200) return trimmed;
  const sentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  if (sentence && sentence.length <= 200) return sentence;
  return trimmed.slice(0, 180).trim() + '…';
}

function sourceVariantFor(
  source: StepReviewSection['source'],
): SourceGlyphVariant {
  if (
    source === 'voice' ||
    source === 'voice_transcript' ||
    source === 'telegram' ||
    source === 'whatsapp' ||
    source === 'sms'
  ) {
    return 'voice';
  }
  return 'note';
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color={IOS_REGISTER.labelSecondary}
      />
      <Text style={styles.bannerText}>
        Preview: moments are wired to your real reflections. Capability arc
        + thinking-shifted card + return counts are placeholder until
        per-week progression and AI synthesis services land.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  scroll: {
    paddingTop: 4,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  leftPad: { width: 1 },
  rightGlyphs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBtn: { padding: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
  },
  // Title block — REGULAR weight, intentional break
  titleBlock: {
    paddingTop: 12,
    paddingRight: 20,
    paddingBottom: 24,
    paddingLeft: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '400', // REGULAR — the contemplative register
    lineHeight: 38,
    letterSpacing: -0.88,
    color: IOS_REGISTER.label,
    marginBottom: 8,
  },
  titleMeta: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
  },
  // Card chrome
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 18,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cardStamp: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
    marginBottom: 12,
  },
  // Capability arc
  arcWrap: {
    marginTop: -4,
    marginBottom: 12,
  },
  arcCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  arcCapLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
  },
  trendPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E85A5A',
    letterSpacing: 0.02,
  },
  // Synthesis body
  synthBody: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
  },
  synthEmpty: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
  italic: {
    fontStyle: 'italic',
  },
  // Moments
  momentDivider: {
    height: 1,
    backgroundColor: IOS_REGISTER.separator,
    marginVertical: 14,
  },
  momentRow: {
    paddingVertical: 2,
  },
  momentQuote: {
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  momentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  momentProv: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    flex: 1,
  },
  // Return-count badge — system purple, the new fourth accent
  returnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(88, 86, 214, 0.12)',
  },
  returnBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5856D6',
    letterSpacing: 0.02,
  },
});
