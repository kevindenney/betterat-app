/**
 * Debrief — iOS register preview
 *
 * Companion preview to /race/ios/[stepId] that renders the After-phase
 * surface in the iOS register's chronological-capture-stack form. The
 * existing Review tab is a per-competency review FORM (star rating +
 * WHAT DIDN'T / WHAT DID YOU LEARN / ANYTHING ELSE prompts, repeated
 * per competency). This preview replaces that with the time-ordered
 * stack of raw captures the user made during the step:
 *
 *   - act_data.observations[] (voice / note)
 *   - act_data.media_uploads[] (photo / video)
 *
 * Each capture renders as a white card with time + kind glyph + body.
 * Voice fragments use italic per iOS Notes / Messages convention.
 *
 * Architectural commitment (from the design's side rail):
 *   - Ground is system gray 6 (Felix at his kitchen table, not on the boat).
 *   - Captures get card chrome (each is a complete readable artifact).
 *   - System speaks once, at the foot (coral AI offer card with
 *     coral-filled primary button — system signal, not pure user action).
 *
 * What this register intentionally does NOT show, per the design:
 *   - No "compose reflection" mic (Debrief is reading, not capturing).
 *   - No per-capture AI commentary (each card stands on its own).
 *   - No score / placing / rating chrome (those live inside photo captions).
 *   - No form-based competency assessment prompts (WHAT DIDN'T / WHAT DID
 *     YOU LEARN / ANYTHING ELSE × N competencies). User-confirmed
 *     2026-05-14: those move to a separate faculty/preceptor-facing
 *     Competency Assessment surface — Debrief is the student's reflection,
 *     not the graded artifact. See IOS_MIGRATION_PLAN.md "Resolved
 *     architecture decision — Reflection vs Competency Assessment."
 *
 * Wire-up status:
 *   Real data:
 *     - Title block (step.title, completed_at)
 *     - Capture stack from observations + media_uploads sorted chronologically
 *     - Empty state when neither array has entries
 *   Placeholder:
 *     - Silent-flag captures (no data field for them yet — see migration plan)
 *     - AI offer body copy (no clustering service yet)
 *     - Beat tags on captures (no beat-tagging schema yet)
 *
 * Open at /race/ios/debrief/{stepId}.
 */

import React, { useCallback, useMemo } from 'react';
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
import { format, parseISO } from 'date-fns';

import {
  CaptureCard,
  CoralAIPromptCard,
  type CaptureKind,
} from '@/components/ios-register';
import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useUpdateStepMetadata } from '@/hooks/useStepDetail';
import {
  LOCAL_KNOWLEDGE_TEMPLATES,
  appendAtlasRaceNote,
  appendReviewAnythingElseNote,
  getAtlasStepData,
} from '@/lib/atlasRaceStep';
import type {
  StepMetadata,
  StepActData,
  Observation,
  MediaUpload,
} from '@/types/step-detail';

interface CaptureItem {
  id: string;
  kind: CaptureKind;
  time: string;
  timestamp: string;
  text?: string;
  photoUri?: string;
  photoCaption?: string;
  flagged?: boolean;
}

export default function DebriefIosPreview() {
  const { stepId } = useLocalSearchParams<{ stepId: string }>();
  const actualId = Array.isArray(stepId) ? stepId[0] : stepId;
  const { data: step, isLoading, error } = useStepDetail(actualId);

  if (!actualId || error) {
    return <ErrorState message={error?.message ?? 'No step id provided'} />;
  }

  if (isLoading || !step) {
    return (
      <SafeAreaView style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
      </SafeAreaView>
    );
  }

  const metadata = (step.metadata ?? {}) as StepMetadata;
  const act = ((metadata.act ?? (step.metadata as any)?.act_data ?? {}) as StepActData) ?? {};

  return (
    <DebriefBody step={step} act={act} metadata={metadata} />
  );
}

function DebriefBody({
  step,
  act,
  metadata,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  act: StepActData;
  metadata: StepMetadata;
}) {
  const updateMetadata = useUpdateStepMetadata(step.id);
  const captures = useMemo(() => buildCaptures(act), [act]);
  const atlasData = useMemo(() => getAtlasStepData(metadata), [metadata]);
  const reviewNotes = (atlasData?.local_knowledge_notes ?? []).filter(
    (note) => note.phase === 'review',
  );
  const captureCount = captures.length;
  const flaggedCount = captures.filter((c) => c.flagged).length;

  const eyebrow = `${(step.title ?? 'Step').toUpperCase()} · DEBRIEF`;
  const completedDate = step.completed_at
    ? format(parseISO(step.completed_at), 'EEEE')
    : null;

  const handleAddReviewNote = useCallback(
    (text: string) => {
      const nextAtlas = appendAtlasRaceNote(atlasData, {
        text,
        phase: 'review',
        kind: 'general',
        source: 'debrief_preview',
        lat: step.location_lat ?? undefined,
        lng: step.location_lng ?? undefined,
        focus_label: atlasData?.next_event?.label ?? step.location_name ?? step.title,
      });
      const nextReview = appendReviewAnythingElseNote(metadata.review, text);
      updateMetadata.mutate({
        atlas: nextAtlas,
        review: nextReview,
      });
    },
    [atlasData, metadata.review, step.location_lat, step.location_lng, step.location_name, step.title, updateMetadata],
  );

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top chrome row — back chevron + search + overflow */}
        <View style={styles.topChrome}>
          <Pressable
            style={styles.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
            <Text style={styles.backLabel}>Race</Text>
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

        {/* Title block — "Race 4 · Debrief" eyebrow + "What happened on the water" */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>What happened</Text>
          <View style={styles.metaRow}>
            {completedDate ? (
              <Text style={styles.titleMeta}>{completedDate}</Text>
            ) : null}
            {completedDate ? <View style={styles.metaSep} /> : null}
            <Text style={styles.titleMeta}>
              {captureCount} {captureCount === 1 ? 'capture' : 'captures'}
            </Text>
            {flaggedCount > 0 && (
              <>
                <View style={styles.metaSep} />
                <Text style={styles.titleMetaFlagged}>
                  {flaggedCount} flagged
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.localKnowledgeCard}>
          <Text style={styles.localKnowledgeEyebrow}>LOCAL KNOWLEDGE LAYER</Text>
          <Text style={styles.localKnowledgeBody}>
            Add the course reads you want to carry forward. These save into Review and stay attached to this race context as a separate map-note layer.
          </Text>
          <View style={styles.localKnowledgeChipRow}>
            {LOCAL_KNOWLEDGE_TEMPLATES.map((template) => (
              <Pressable
                key={template.kind}
                style={styles.localKnowledgeChip}
                onPress={() => handleAddReviewNote(template.text)}
              >
                <Text style={styles.localKnowledgeChipText}>{template.label}</Text>
              </Pressable>
            ))}
          </View>
          {reviewNotes.length > 0 ? (
            <View style={styles.localKnowledgeList}>
              {reviewNotes.slice(-4).map((note) => (
                <Text key={note.id} style={styles.localKnowledgeListItem}>
                  • {note.text}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Capture stack — chronological */}
        {captureCount === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No captures from this step yet. Voice notes, photos, and typed
              notes you take during the step will appear here, in time order.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {captures.map((c) => (
              <CaptureCard
                key={c.id}
                kind={c.kind}
                time={c.time}
                text={c.text}
                photoUri={c.photoUri}
                photoCaption={c.photoCaption}
                flagged={c.flagged}
              />
            ))}
          </View>
        )}

        {/* AI offer card — coral-filled primary (system signal, per the
            Debrief design's local override of Race Prep's blue-filled). */}
        {captureCount >= 3 && (
          <View style={styles.aiOfferWrap}>
            <CoralAIPromptCard
              label="A PATTERN IN YOUR CAPTURES"
              primaryAccent="coral"
              primaryAction={{ label: 'Open', onPress: () => {} }}
              secondaryAction={{ label: 'Not now', onPress: () => {} }}
            >
              You captured {captureCount} moments during this step. Want to
              look at them together and see if a thread emerges?
            </CoralAIPromptCard>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCaptures(act: StepActData): CaptureItem[] {
  const items: CaptureItem[] = [];

  for (const obs of act.observations ?? []) {
    items.push(observationToCapture(obs));
  }
  for (const media of act.media_uploads ?? []) {
    const cap = mediaToCapture(media);
    if (cap) items.push(cap);
  }

  items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return items;
}

function observationToCapture(obs: Observation): CaptureItem {
  return {
    id: obs.id,
    kind: obs.source === 'voice' ? 'voice' : 'note',
    time: formatCaptureTime(obs.timestamp),
    timestamp: obs.timestamp,
    text: obs.text,
  };
}

function mediaToCapture(media: MediaUpload): CaptureItem | null {
  // Media without a created_at timestamp can't be sorted; skip rather than
  // placing them arbitrarily.
  if (!media.created_at) return null;
  return {
    id: media.id,
    kind: 'photo',
    time: formatCaptureTime(media.created_at),
    timestamp: media.created_at,
    photoUri: media.uri,
    photoCaption: media.caption,
  };
}

function formatCaptureTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Small subcomponents
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
        Preview: title and capture stack are wired to real act_data. Silent
        flags, beat tags, and AI clustering are deferred until their data
        layers land.
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <Stack.Screen
        options={{ title: 'Debrief (iOS preview)', headerShown: true }}
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
    paddingTop: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
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
  titleBlock: {
    paddingTop: 10,
    paddingRight: 20,
    paddingBottom: 24,
    paddingLeft: 20,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    ...IOS_REGISTER_TEXT.title,
    color: IOS_REGISTER.label,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  titleMeta: {
    ...IOS_REGISTER_TEXT.titleMeta,
    color: IOS_REGISTER.labelSecondary,
  },
  titleMetaFlagged: {
    ...IOS_REGISTER_TEXT.titleMeta,
    color: IOS_REGISTER.accentMarkedContent,
    fontWeight: '500',
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  localKnowledgeCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFF8EE',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190, 144, 72, 0.28)',
    gap: 10,
  },
  localKnowledgeEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: '#9A6C20',
    marginBottom: 0,
  },
  localKnowledgeBody: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelSecondary,
  },
  localKnowledgeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  localKnowledgeChip: {
    backgroundColor: 'rgba(190, 144, 72, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  localKnowledgeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A6C20',
  },
  localKnowledgeList: {
    gap: 4,
  },
  localKnowledgeListItem: {
    ...IOS_REGISTER_TEXT.caption,
    color: IOS_REGISTER.labelSecondary,
  },
  stack: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyText: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
  },
  aiOfferWrap: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
