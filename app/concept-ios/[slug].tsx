/**
 * Concept detail — iOS register preview (Read mode)
 *
 * Fifth iOS-register preview surface. Drills in from the Playbook
 * concept shelf. Renders one concept's synthesis + chronological
 * reflection trail.
 *
 * Architectural commitments (from the design's side rail):
 *   - Read mode is the default. The segmented control (Read / Work)
 *     declares it. Work mode is a separate Phase 5+ pass — adds
 *     resources, open questions, AI offer, mic.
 *   - Synthesis card uses ALL-CAPS "SYNTHESIS — IN YOUR WORDS" eyebrow
 *     to name two things at once: composed (not captured), AND in the
 *     user's voice (AI drafted FROM the user, not adding vocabulary).
 *   - Reflection cards are the same component as Debrief iOS — same
 *     atom, different list grammar (chronology, not shelf).
 *   - The originating reflection earns a small coral "first written"
 *     tag, right-aligned in the provenance row. The card itself is
 *     otherwise identical.
 *
 * Wire-up status:
 *   Real data:
 *     - Concept title + body from usePlaybookConceptBySlug
 *     - Updated_at → synthesis stamp
 *     - Reflection trail: most recent same-interest completed steps
 *       with review sections (heuristic — true concept↔step association
 *       table doesn't exist yet)
 *
 *   Placeholder:
 *     - State pill (practicing/live) — no per-user concept state schema
 *     - "First written" tag is applied to the oldest reflection in the
 *       trail as a heuristic; should be derived from a concept-creation
 *       provenance field when one exists
 *     - Work mode is not yet built (Read mode only for now)
 *
 * Open at /concept-ios/{slug}.
 */

import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

import { ReflectionCard } from '@/components/ios-register';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { usePlaybook, usePlaybookConceptBySlug } from '@/hooks/usePlaybook';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import type {
  StepReviewData,
  StepReviewSection,
} from '@/types/step-detail';
import type { SourceGlyphVariant } from '@/components/ios-register/SourceGlyph';

interface ReflectionItem {
  id: string;
  whenParts: string[];
  body: string;
  source: SourceGlyphVariant;
  provenance: string;
  origin?: boolean;
}

export default function ConceptIosPreview() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const actualSlug = Array.isArray(slug) ? slug[0] : slug;

  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;

  const { data: playbook } = usePlaybook(interestId);
  const { data: concept, isLoading } = usePlaybookConceptBySlug(
    playbook?.id,
    interestId,
    actualSlug,
  );
  const { data: timeline } = useMyTimeline(interestId);

  const reflections = useMemo(
    () => buildConceptReflections(timeline ?? []),
    [timeline],
  );

  const [mode, setMode] = React.useState<'read' | 'work'>('read');

  if (!actualSlug) {
    return <ErrorState message="No concept slug provided." />;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
      </SafeAreaView>
    );
  }

  if (!concept) {
    return <ErrorState message="Concept not found in this playbook." />;
  }

  const updatedRelative = formatDistanceToNowStrict(
    parseISO(concept.updated_at),
    { addSuffix: true },
  );

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top chrome — back chevron to Playbook + search + overflow */}
        <View style={styles.topChrome}>
          <Pressable
            style={styles.back}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/playbook-ios' as any)
            }
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
            <Text style={styles.backLabel}>Playbook</Text>
          </Pressable>
          <View style={styles.rightGlyphs}>
            <Pressable style={styles.glyphBtn} hitSlop={8}>
              <Ionicons
                name="search"
                size={20}
                color={IOS_REGISTER.accentUserAction}
              />
            </Pressable>
            <Pressable style={styles.glyphBtn} hitSlop={8}>
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={IOS_REGISTER.accentUserAction}
              />
            </Pressable>
          </View>
        </View>

        <PreviewBanner />

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>CONCEPT</Text>
          <Text style={styles.title}>{concept.title}</Text>
          <View style={styles.metaRow}>
            {/* State pill — placeholder. Coral live variant when the concept
                is active in current step; iOS blue when practicing-but-quiet. */}
            <View style={styles.statePillCoral}>
              <View style={styles.statePillDot} />
              <Text style={styles.statePillTextCoral}>practicing</Text>
            </View>
            <Text style={styles.meta}>
              {reflections.length}{' '}
              {reflections.length === 1 ? 'reflection' : 'reflections'}
            </Text>
          </View>
        </View>

        {/* Read / Work segmented control */}
        <View style={styles.segWrap}>
          <IOSSegmentedControl
            segments={[
              { value: 'read', label: 'Read' },
              { value: 'work', label: 'Work' },
            ]}
            selectedValue={mode}
            onValueChange={(v) => setMode(v as 'read' | 'work')}
          />
        </View>

        {mode === 'read' ? (
          <ReadMode
            body={concept.body_md}
            updatedRelative={updatedRelative}
            reflections={reflections}
          />
        ) : (
          <WorkModePlaceholder />
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadMode({
  body,
  updatedRelative,
  reflections,
}: {
  body: string;
  updatedRelative: string;
  reflections: ReflectionItem[];
}) {
  return (
    <>
      {/* Synthesis card */}
      <View style={styles.synthCard}>
        <View style={styles.synthEyebrowRow}>
          <Text style={styles.synthEyebrow}>SYNTHESIS — IN YOUR WORDS</Text>
          <Text style={styles.synthStamp}>{updatedRelative}</Text>
        </View>
        {body ? (
          <Text style={styles.synthBody}>{body}</Text>
        ) : (
          <Text style={styles.synthEmpty}>
            No synthesis yet. AI will draft one from your reflections as they
            accumulate.
          </Text>
        )}
      </View>

      {/* Reflections — chronological */}
      <View style={styles.shelfHead}>
        <Text style={styles.shelfTitle}>Reflections</Text>
        <Text style={styles.shelfCount}>{reflections.length} total</Text>
      </View>

      {reflections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No reflections touch this concept yet. As you write debriefs, the
            AI surfaces relevant ones here.
          </Text>
        </View>
      ) : (
        <View style={styles.reflections}>
          {reflections.map((r) => (
            <ReflectionCard
              key={r.id}
              whenParts={r.whenParts}
              firstLine={r.body}
              source={r.source}
              provenance={r.provenance}
              origin={r.origin}
            />
          ))}
        </View>
      )}
    </>
  );
}

function WorkModePlaceholder() {
  return (
    <View style={styles.workPlaceholder}>
      <Ionicons
        name="construct-outline"
        size={32}
        color={IOS_REGISTER.labelTertiary}
      />
      <Text style={styles.workPlaceholderText}>
        Work mode coming in a later pass.{'\n'}
        Resources, open questions, AI offer, and a hold-to-speak mic live here.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a chronological reflection trail. True concept↔step association
 * doesn't exist yet, so this surfaces the most recent same-interest
 * reflections as a stand-in. The oldest one gets the "first written"
 * origin tag as a placeholder for true creation provenance.
 */
function buildConceptReflections(
  timeline: {
    id: string;
    title: string;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }[],
): ReflectionItem[] {
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
    .slice(0, 7);

  const items = candidates.flatMap<ReflectionItem>((step) => {
    const review = (step.metadata?.review_data as StepReviewData | undefined) ?? null;
    const sections = (review?.sections ?? []).filter(
      (s): s is StepReviewSection => Boolean(s.content?.trim()),
    );
    const section = sections[0];
    if (!section || !step.completed_at) return [];

    const date = parseISO(step.completed_at);
    const whenParts = [
      format(date, 'EEEE'),
      formatDistanceToNowStrict(date, { addSuffix: true }),
    ];

    return [
      {
        id: step.id,
        whenParts,
        body: shortenToQuotable(section.content),
        source: sourceVariantFor(section.source),
        provenance: `${step.title ?? 'Step'} Debrief`,
      },
    ];
  });

  // Tag the oldest as "first written" — heuristic until creation provenance exists.
  if (items.length > 0) {
    items[items.length - 1] = { ...items[items.length - 1], origin: true };
  }

  return items;
}

function shortenToQuotable(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 220) return trimmed;
  const sentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  if (sentence && sentence.length <= 220) return sentence;
  return trimmed.slice(0, 200).trim() + '…';
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

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color={IOS_REGISTER.labelSecondary}
      />
      <Text style={styles.bannerText}>
        Preview: concept body + reflection trail wired to real data.
        Concept-step association + state pill are placeholder.
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <Stack.Screen
        options={{ title: 'Concept (iOS preview)', headerShown: true }}
      />
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={IOS_REGISTER.accentMarkedContent}
      />
      <Text style={styles.errorText}>{message}</Text>
    </SafeAreaView>
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
  loading: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 32,
    textAlign: 'center',
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
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 6,
  },
  backLabel: {
    fontSize: 17,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  rightGlyphs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBtn: {
    padding: 6,
  },
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
  titleBlock: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 20,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 33,
    letterSpacing: -0.5,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  statePillCoral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
  },
  statePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  statePillTextCoral: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E85A5A',
    letterSpacing: 0.02,
  },
  meta: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  // Segmented control wrap
  segWrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // Synthesis card
  synthCard: {
    marginHorizontal: 16,
    marginBottom: 28,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 18,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
  },
  synthEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  synthEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  synthStamp: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  synthBody: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
  },
  synthEmpty: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
  // Shelf head for reflections list
  shelfHead: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 14,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  shelfTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  shelfCount: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  reflections: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyWrap: {
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 15,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  workPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 12,
  },
  workPlaceholderText: {
    fontSize: 15,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
