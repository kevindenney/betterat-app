/**
 * Playbook — iOS register preview
 *
 * Fourth iOS-register preview surface. The user's conceptual home base,
 * translated through an Apple Books library reference. Same gray-6 +
 * white-card chrome as Race Prep / Debrief, with three additions:
 *
 *   - Vision card at top as a frontispiece (manifesto.content)
 *   - "Working on this season" horizontal-scroll concept shelf (Books
 *     "Want to Read" treatment — vertical cards with state pill + ref
 *     count + title)
 *   - "Recent reflections" stack at the foot (same grammar as Race
 *     Prep's "From your last race" quotes, with date eyebrow)
 *
 * Three concept states earn the two-accent system + neutral:
 *   practicing   → iOS blue (working state)
 *   learning     → neutral gray (quiet, entering)
 *   breakthrough → coral (marked moment)
 *
 * Wire-up status:
 *   Real data:
 *     - Vision body from useManifesto (the user's interest manifesto content)
 *     - Concepts from usePlaybookConcepts (title; state + ref count are
 *       placeholder until per-user concept state schema lands)
 *     - Reflections from useMyTimeline filtered to recent completed steps
 *       with review_data.sections
 *
 *   Placeholder:
 *     - Concept state pills (no per-user concept progression schema yet)
 *     - Reflection counts on concept cards (no concept↔step association yet)
 *     - "Active in current step" live-dot (same gap)
 *     - "Revise" button action (visual only)
 *
 * Open at /playbook-ios.
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
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

import {
  ConceptCard,
  ReflectionCard,
  type ConceptState,
} from '@/components/ios-register';
import { OnDeckBanner } from '@/components/timelines';
import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useManifesto } from '@/hooks/useManifesto';
import {
  usePlaybook,
  usePlaybookConcepts,
  usePlaybookInbox,
} from '@/hooks/usePlaybook';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import type { PlaybookConceptRecord } from '@/types/playbook';
import type {
  StepReviewData,
  StepReviewSection,
} from '@/types/step-detail';
import type { SourceGlyphVariant } from '@/components/ios-register/SourceGlyph';

interface ReflectionItem {
  id: string;
  whenParts: string[];
  firstLine: string;
  source: SourceGlyphVariant;
  provenance: string;
}

interface Props {
  /**
   * When true, this component is mounted as the canonical Playbook tab
   * (post-cutover, gated by FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER). Hides
   * the close-X chrome since there's no parent route to navigate back
   * to. False when rendered as the standalone /playbook-ios preview.
   */
  embedded?: boolean;
  onOpenInspiration?: () => void;
}

export function PlaybookIosPreview({
  embedded = false,
  onOpenInspiration,
}: Props = {}) {
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;
  const interestName = currentInterest?.name ?? 'your practice';

  const { manifesto, isLoading: isLoadingManifesto } = useManifesto(interestId);
  const { data: playbook, isLoading: isLoadingPlaybook } = usePlaybook(interestId);
  const { data: concepts } = usePlaybookConcepts(playbook?.id, interestId);
  const { data: timeline } = useMyTimeline(interestId);
  const { data: inboxItems } = usePlaybookInbox(playbook?.id);
  const { data: subscribedBlueprints = [] } = useSubscribedBlueprints(interestId);
  const subscribedBlueprintCount = subscribedBlueprints.length;

  // Count of unprocessed inbox items — surfaces as a chrome badge top-right
  // so the user notices items waiting to be ingested without the full inbox
  // section dominating home.
  const pendingInboxCount =
    inboxItems?.filter((i) => i.status === 'pending').length ?? 0;

  const reflections = useMemo(
    () => buildRecentReflections(timeline ?? []),
    [timeline],
  );

  if (!interestId) {
    return (
      <ErrorState message="Pick an interest first to view its playbook." />
    );
  }

  if (isLoadingManifesto || isLoadingPlaybook) {
    return (
      <SafeAreaView style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
      </SafeAreaView>
    );
  }

  const conceptCount = concepts?.length ?? 0;

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top chrome — root tab: no back chevron, just inbox + close.
            Inbox badge surfaces unprocessed item count (coral when present)
            so the user notices the Raw Inbox without it dominating home. */}
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <View style={styles.rightGlyphs}>
            <Pressable
              style={styles.glyphBtn}
              hitSlop={8}
              accessibilityLabel={
                pendingInboxCount > 0
                  ? `Raw Inbox — ${pendingInboxCount} unprocessed`
                  : 'Raw Inbox'
              }
            >
              <View style={styles.inboxIconWrap}>
                <Ionicons
                  name="mail-outline"
                  size={22}
                  color={IOS_REGISTER.accentUserAction}
                />
                {pendingInboxCount > 0 && (
                  <View style={styles.inboxBadge}>
                    <Text style={styles.inboxBadgeText}>
                      {pendingInboxCount > 9 ? '9+' : pendingInboxCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
            {!embedded && (
              <Pressable
                style={styles.glyphBtn}
                hitSlop={8}
                onPress={() => (router.canGoBack() ? router.back() : null)}
                accessibilityLabel="Back to existing playbook"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={IOS_REGISTER.accentUserAction}
                />
              </Pressable>
            )}
          </View>
        </View>

        {!embedded && <PreviewBanner />}

        {/* Title block — Books "Library" treatment */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Your Playbook</Text>
          <View style={styles.metaRow}>
            <View style={styles.interestDot} />
            <Text style={styles.titleMeta}>{interestName}</Text>
            <View style={styles.metaSep} />
            <Text style={styles.titleMeta}>
              {conceptCount} {conceptCount === 1 ? 'concept' : 'concepts'}
            </Text>
            {reflections.length > 0 && (
              <>
                <View style={styles.metaSep} />
                <Text style={styles.titleMeta}>
                  {reflections.length}{' '}
                  {reflections.length === 1 ? 'reflection' : 'reflections'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Vision card — frontispiece */}
        <View style={styles.visionCard}>
          <View style={styles.visionEyebrowRow}>
            <Text style={styles.visionEyebrow}>VISION</Text>
            {manifesto?.updated_at ? (
              <Text style={styles.visionRevised}>
                revised {format(parseISO(manifesto.updated_at), 'MMMM')}
              </Text>
            ) : null}
          </View>
          {manifesto?.content ? (
            <Text style={styles.visionBody}>{manifesto.content}</Text>
          ) : (
            <Text style={styles.visionEmpty}>
              You haven't written a vision yet. Tap Revise to draft one.
            </Text>
          )}
          <View style={styles.visionReviseRow}>
            <Pressable accessibilityRole="button" hitSlop={8}>
              <Text style={styles.visionReviseLabel}>Revise</Text>
            </Pressable>
          </View>
        </View>

        <OnDeckBanner />

        <Pressable
          style={({ pressed }) => [
            styles.browseCard,
            pressed && styles.browseCardPressed,
          ]}
          onPress={() => router.push('/(tabs)/playbook/blueprints' as any)}
          accessibilityRole="button"
          accessibilityLabel="Blueprints you follow"
        >
          <View style={styles.browseCopy}>
            <Text style={styles.browseEyebrow}>NETWORK BROWSING</Text>
            <Text style={styles.browseTitle}>Blueprints you follow</Text>
            <Text style={styles.browseBody}>
              {subscribedBlueprintCount > 0
                ? `${subscribedBlueprintCount} subscribed blueprint${subscribedBlueprintCount === 1 ? '' : 's'} ready to browse and add into your timeline.`
                : 'Browse subscribed blueprints and pull their steps into your timeline.'}
            </Text>
          </View>
          <Text style={styles.browseCta}>Open</Text>
        </Pressable>

        <GetInspiredHeroCTA onPress={onOpenInspiration} />

        {/* Working on this season — concept shelf */}
        <View style={styles.shelfHead}>
          <Text style={styles.shelfTitle}>Working on this season</Text>
          {conceptCount > 0 && (
            <Pressable accessibilityRole="button" hitSlop={8}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          )}
        </View>

        {conceptCount === 0 ? (
          <View style={styles.emptyShelfWrap}>
            <Text style={styles.emptyShelfText}>
              No concepts in this playbook yet. They'll appear as your
              reflections accumulate.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfTrack}
          >
            {(concepts ?? []).map((concept) => (
              <ConceptCard
                key={concept.id}
                title={concept.title}
                state={derivePlaceholderState(concept)}
                reflectionCount={undefined}
                onPress={() =>
                  router.push(`/concept-ios/${concept.slug}` as any)
                }
              />
            ))}
          </ScrollView>
        )}

        {/* Recent reflections */}
        {reflections.length > 0 && (
          <>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>Recent reflections</Text>
              <Pressable accessibilityRole="button" hitSlop={8}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <View style={styles.reflections}>
              {reflections.map((r) => (
                <ReflectionCard
                  key={r.id}
                  whenParts={r.whenParts}
                  firstLine={r.firstLine}
                  source={r.source}
                  provenance={r.provenance}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Per-user concept state isn't in the data model yet (see migration plan
 * follow-up #2). Until it lands, derive a placeholder state from concept
 * origin so the shelf reads with some variation rather than uniform pills.
 *
 *   personal / forked          → practicing  (concepts the user has touched)
 *   pathway_baseline           → learning    (inherited but not yet worked)
 *   platform_baseline (rare)   → learning
 *
 * NOT load-bearing — flip to a real per-user-state field once it exists.
 */
function derivePlaceholderState(concept: PlaybookConceptRecord): ConceptState {
  switch (concept.origin) {
    case 'personal':
    case 'forked':
      return 'practicing';
    case 'pathway_baseline':
    case 'platform_baseline':
    default:
      return 'learning';
  }
}

function buildRecentReflections(
  timeline: {
    id: string;
    title: string;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }[],
): ReflectionItem[] {
  const completed = timeline
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

  return completed.flatMap<ReflectionItem>((step) => {
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
        firstLine: shortenToQuotable(section.content),
        source: sourceVariantFor(section.source),
        provenance: `${step.title ?? 'Step'} Debrief`,
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

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function GetInspiredHeroCTA({
  onPress,
}: {
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.inspirationCard,
        pressed && styles.inspirationCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Get Inspired"
      accessibilityHint="Opens a flow to turn a link, pasted text, or idea into a first plan."
    >
      <View style={styles.inspirationGlyph}>
        <Ionicons
          name="sparkles-outline"
          size={20}
          color={IOS_REGISTER.accentMarkedContent}
        />
      </View>
      <View style={styles.inspirationText}>
        <Text style={styles.inspirationEyebrow}>GET INSPIRED</Text>
        <Text style={styles.inspirationTitle}>
          Start from something inspiring
        </Text>
        <Text style={styles.inspirationBody}>
          Drop a link, paste text, or describe what you want to learn.
          BetterAt will turn it into a first plan.
        </Text>
      </View>
      <View style={styles.inspirationAction}>
        <Text style={styles.inspirationActionText}>Start</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_REGISTER.accentUserAction}
        />
      </View>
    </Pressable>
  );
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
        Preview: vision, concepts, and reflections are wired to real data.
        Concept state pills + reflection counts are placeholder until the
        per-user concept-state schema lands.
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <Stack.Screen
        options={{ title: 'Playbook (iOS preview)', headerShown: true }}
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
    minHeight: 36,
  },
  leftPad: {
    width: 1,
  },
  rightGlyphs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxIconWrap: {
    position: 'relative',
  },
  inboxBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0,
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
    letterSpacing: -0.1,
  },
  // Title block — Books "Library" treatment
  titleBlock: {
    paddingTop: 4,
    paddingRight: 20,
    paddingBottom: 24,
    paddingLeft: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 37,
    letterSpacing: -0.88, // -0.026em on 34px
    color: IOS_REGISTER.label,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  titleMeta: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
  },
  interestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5E7B8E',
    marginRight: 2,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  // Vision card
  visionCard: {
    marginHorizontal: 16,
    marginBottom: 28,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 18,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
  },
  visionEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  visionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  visionRevised: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  visionBody: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
  },
  visionEmpty: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
  visionReviseRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  visionReviseLabel: {
    color: IOS_REGISTER.accentUserAction,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  browseCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  browseCardPressed: {
    opacity: 0.82,
  },
  browseCopy: {
    flex: 1,
    gap: 4,
  },
  browseEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  browseTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  browseBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
  },
  browseCta: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_REGISTER.accentUserAction,
  },
  inspirationCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inspirationCardPressed: {
    opacity: 0.82,
  },
  inspirationGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
  },
  inspirationText: {
    flex: 1,
    gap: 3,
  },
  inspirationEyebrow: {
    ...IOS_REGISTER_TEXT.eyebrow,
    color: IOS_REGISTER.accentMarkedContent,
  },
  inspirationTitle: {
    ...IOS_REGISTER_TEXT.cardTitle,
    color: IOS_COLORS.label,
  },
  inspirationBody: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_COLORS.secondaryLabel,
  },
  inspirationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inspirationActionText: {
    ...IOS_REGISTER_TEXT.callout,
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '600',
  },
  // Shelf header — Books-style 22pt bold
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
  seeAll: {
    fontSize: 15,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  // Concept shelf
  shelfTrack: {
    paddingTop: 2,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    gap: 12,
  },
  emptyShelfWrap: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  emptyShelfText: {
    fontSize: 15,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Reflections list
  reflections: {
    paddingHorizontal: 16,
    gap: 10,
  },
});

// Default export for Expo Router (route file). Named export above is for
// the embedded render path on the (tabs)/playbook tab route.
export default PlaybookIosPreview;
