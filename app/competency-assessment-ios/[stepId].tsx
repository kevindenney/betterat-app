/**
 * Competency Assessment — iOS register preview (12th and final surface)
 *
 * First faculty-facing iOS surface. Splits the After-phase rubric out of
 * the student-facing Debrief: same step, two artifacts, two readers.
 *
 * Architectural commitments (from the design's side rail):
 *
 *   - **Faculty surface, register-continuous.** Same gray 6 ground,
 *     white 16px cards, SF Pro, iOS-blue actions, iOS-coral AI prompts.
 *     What changes is *density* and *voice*, not pigment, type, or radius.
 *
 *   - **Density calibration.** Faculty surfaces are denser than
 *     practitioner surfaces: 12px competency-card gaps (not 24), tighter
 *     eyebrows, inline meta lines. Reason: faculty are working through
 *     a rubric (throughput); practitioners are composing (breathing room).
 *     Both are the iOS register; the calibration is the surface
 *     designer's call. See IOS_MIGRATION_PLAN.md — "Faculty surface
 *     density calibration" decision (2026-05-15).
 *
 *   - **One earned register exception.** The four-state segmented
 *     control on each competency card is 44px tall with semibold active
 *     label (vs the iOS default 32px regular). It earns the exception
 *     because it carries the grading decision — the single most
 *     consequential interaction on the surface. Documented in
 *     IOS_MIGRATION_PLAN.md — "Earned register exception" decision.
 *
 *   - **Owner-distinct, AI accent reversed.** AI offer card uses
 *     coral-filled primary button (not blue-filled). System signal
 *     "follow this thread" rather than user-action "open a concept".
 *     Same local override as Debrief iOS's AI offer.
 *
 *   - **Floating nav swaps to faculty tabs.** Students / Paths / Review /
 *     Me — not Race / Playbook / Discover / Reflect. The faculty cascade
 *     and the practitioner cascade share the iOS register but not the
 *     navigation graph.
 *
 * Wire-up status:
 *   Real data:
 *     - step.title → title block
 *     - step.completed_at → "Submitted N min ago"
 *     - observations.length + media_uploads.length → captures count
 *     - review_data.competency_assessment.planned_competency_results →
 *       initial ratings + evidence when present
 *   Placeholder:
 *     - Competency list (real list would come from path/program
 *       competency schema; using a 3-competency stand-in)
 *     - "Open Debrief view" tap-through (would navigate to a
 *       faculty-scoped Debrief variant)
 *     - AI offer body (clustering service deferred)
 *     - Submit / Save draft (faculty review submission service not wired)
 *     - "2 flagged" count (no flag schema)
 *
 * Open at /competency-assessment-ios/{stepId}.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import type { StepActData } from '@/types/step-detail';

type Rating = 'emerging' | 'developing' | 'proficient' | 'distinguished';

const RATINGS: { value: Rating; label: string }[] = [
  { value: 'emerging', label: 'Emerging' },
  { value: 'developing', label: 'Developing' },
  { value: 'proficient', label: 'Proficient' },
  { value: 'distinguished', label: 'Distinguished' },
];

interface CompetencyRow {
  id: string;
  label: string;
  desc: string;
}

// Placeholder rubric — a real Competency Assessment surface would pull
// the competencies the path/program assesses from a schema. Until that
// exists, three nursing competencies stand in.
const PLACEHOLDER_COMPETENCIES: CompetencyRow[] = [
  {
    id: 'patient-assessment',
    label: 'Patient Assessment',
    desc: 'Recognizes and prioritizes clinical findings',
  },
  {
    id: 'clinical-reasoning',
    label: 'Clinical Reasoning',
    desc: 'Integrates assessment data into prioritized clinical action',
  },
  {
    id: 'therapeutic-communication',
    label: 'Therapeutic Communication',
    desc: "Adapts tone and content to the patient's state and stake",
  },
];

interface AssessmentState {
  rating: Rating | null;
  evidence: string;
}

export default function CompetencyAssessmentIosPreview() {
  const { stepId } = useLocalSearchParams<{ stepId: string }>();
  const actualId = Array.isArray(stepId) ? stepId[0] : stepId;
  const { data: step, isLoading, error } = useStepDetail(actualId);

  // Per-competency assessment state — kept local on this preview.
  // Real version persists into review_data.competency_assessment.
  const [assessments, setAssessments] = useState<Record<string, AssessmentState>>({
    'patient-assessment': {
      rating: 'proficient',
      evidence:
        "Strong work picking up the early perfusion change on Bed 3 before rapid response was called. The framework is there. The remaining growth edge is naming what you're seeing out loud the moment you see it, rather than after — you have the assessment skill, the trigger to act is the next step.",
    },
    'clinical-reasoning': {
      rating: 'developing',
      evidence: '',
    },
    'therapeutic-communication': {
      rating: 'proficient',
      evidence:
        'Family conversation in Bed 2 was handled with real care — you slowed your pace, you',
    },
  });

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

  const act = ((step.metadata?.act_data ?? {}) as StepActData) ?? {};
  const captureCount =
    (act.observations?.length ?? 0) + (act.media_uploads?.length ?? 0);
  const submittedRelative = step.completed_at
    ? `Submitted ${formatDistanceToNowStrict(parseISO(step.completed_at), { addSuffix: true })}`
    : 'Not yet submitted';

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top chrome — back to Dashboard + share + more */}
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
            <Text style={styles.backLabel}>Dashboard</Text>
          </Pressable>
          <View style={styles.rightGlyphs}>
            <Pressable style={styles.glyphBtn} hitSlop={8}>
              <Ionicons
                name="share-outline"
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

        {/* Title block — denser than practitioner surfaces */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>Competency Assessment</Text>
          <Text style={styles.title}>{step.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.titleMeta}>MSN Capstone</Text>
            <View style={styles.metaSep} />
            <Text style={styles.titleMeta}>Acute Care</Text>
            <View style={styles.metaSep} />
            <Text style={styles.titleMeta}>{submittedRelative}</Text>
          </View>
        </View>

        {/* Captures context — link back to Debrief view */}
        <Pressable
          style={styles.capturesCard}
          onPress={() =>
            router.push(`/race/ios/debrief/${actualId}` as any)
          }
        >
          <View style={styles.capturesLeft}>
            <Text style={styles.capturesEyebrow}>
              What the student captured on shift
            </Text>
            <Text style={styles.capturesBody}>
              {captureCount}{' '}
              {captureCount === 1 ? 'capture' : 'captures'}
              {' across this step'}
              {/* Flag count placeholder until step_flags schema exists */}
            </Text>
          </View>
          <View style={styles.capturesRight}>
            <Text style={styles.capturesRightText}>Open Debrief view</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={IOS_REGISTER.accentUserAction}
            />
          </View>
        </Pressable>

        {/* Section eyebrow */}
        <View style={styles.sectionEyebrow}>
          <Text style={styles.sectionEyebrowText}>Competencies</Text>
          <Text style={styles.sectionEyebrowCount}>
            {PLACEHOLDER_COMPETENCIES.length} of {PLACEHOLDER_COMPETENCIES.length}
          </Text>
        </View>

        {/* Competency cards — 12px gap (faculty density) */}
        <View style={styles.compStack}>
          {PLACEHOLDER_COMPETENCIES.map((comp) => (
            <CompetencyCard
              key={comp.id}
              competency={comp}
              state={assessments[comp.id]}
              onRatingChange={(rating) =>
                setAssessments((prev) => ({
                  ...prev,
                  [comp.id]: { ...prev[comp.id], rating },
                }))
              }
              onEvidenceChange={(evidence) =>
                setAssessments((prev) => ({
                  ...prev,
                  [comp.id]: { ...prev[comp.id], evidence },
                }))
              }
            />
          ))}
        </View>

        {/* AI offer — coral, surfacing a relevant capture */}
        <View style={styles.aiOffer}>
          <View style={styles.aiOfferHead}>
            <Ionicons
              name="sparkles"
              size={16}
              color={IOS_REGISTER.accentMarkedContent}
            />
            <Text style={styles.aiOfferLabel}>From the student's captures</Text>
          </View>
          <View style={styles.aiOfferBody}>
            <View style={styles.pullQuote}>
              <Text style={styles.pullQuoteText}>
                "Noticed the change in perfusion before the rapid response."
              </Text>
            </View>
            <Text style={styles.aiAscription}>
              Capture at <Text style={styles.aiAscriptionAccent}>14:18</Text>{' '}
              supports{' '}
              <Text style={styles.aiAscriptionAccent}>
                Patient Assessment · Distinguished
              </Text>
              . Want to insert as evidence?
            </Text>
          </View>
          <View style={styles.aiActions}>
            <Pressable style={styles.aiBtnFill}>
              <Text style={styles.aiBtnFillText}>Insert</Text>
            </Pressable>
            <Pressable style={styles.aiBtnText}>
              <Text style={styles.aiBtnTextLabel}>Not now</Text>
            </Pressable>
          </View>
        </View>

        {/* Submit row */}
        <View style={styles.submitRow}>
          <Pressable style={styles.btnSubmit}>
            <Text style={styles.btnSubmitText}>
              Submit assessment to the student
            </Text>
          </Pressable>
          <Pressable style={styles.btnDraft}>
            <Text style={styles.btnDraftText}>Save as draft</Text>
          </Pressable>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Competency card with segmented control
// ---------------------------------------------------------------------------

function CompetencyCard({
  competency,
  state,
  onRatingChange,
  onEvidenceChange,
}: {
  competency: CompetencyRow;
  state: AssessmentState;
  onRatingChange: (r: Rating) => void;
  onEvidenceChange: (e: string) => void;
}) {
  const hasEvidence = state.evidence.trim().length > 0;

  return (
    <View style={styles.compCard}>
      <Text style={styles.compLabel}>{competency.label}</Text>
      <Text style={styles.compDesc}>{competency.desc}</Text>

      {/* 44px-tall four-state segmented control — earned register exception */}
      <View style={styles.seg}>
        {RATINGS.map((opt, idx) => {
          const isActive = state.rating === opt.value;
          const prevActive =
            idx > 0 && RATINGS[idx - 1].value === state.rating;
          return (
            <Pressable
              key={opt.value}
              style={[styles.segOpt, isActive && styles.segOptActive]}
              onPress={() => onRatingChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
            >
              {idx > 0 && !isActive && !prevActive && (
                <View style={styles.segDivider} />
              )}
              <Text
                style={[
                  styles.segOptText,
                  isActive && styles.segOptTextActive,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Evidence textarea */}
      <TextInput
        value={state.evidence}
        onChangeText={onEvidenceChange}
        placeholder="What did you observe?"
        placeholderTextColor={IOS_REGISTER.labelSecondary}
        style={[styles.evidence, hasEvidence && styles.evidenceHasContent]}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Capture-chip — when an AI capture has been inserted as evidence.
          For the preview, show it for the first competency only when
          its evidence mentions perfusion (matches the design content). */}
      {competency.id === 'patient-assessment' && hasEvidence && (
        <View style={styles.capChip}>
          <Ionicons
            name="mic"
            size={12}
            color={IOS_REGISTER.accentMarkedContent}
          />
          <Text style={styles.capChipTime}>14:18</Text>
          <Text style={styles.capChipText}>
            "noticed the change in perfusion…"
          </Text>
        </View>
      )}

      <View style={styles.evidenceHelpRow}>
        <Text style={styles.evidenceHelp}>
          Reference the student's captures —{' '}
          <Text style={styles.evidenceHelpLink}>
            tap a capture to insert as evidence
          </Text>
        </Text>
      </View>
    </View>
  );
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
        Preview: step metadata + capture count wired to real data.
        Competency list, AI capture surfacing, and submit/draft flows are
        placeholder. Real Competency Assessment runs against a path/program
        competency schema (faculty pre-defined per path).
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <Stack.Screen
        options={{ title: 'Competency Assessment (iOS preview)', headerShown: true }}
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
  // Title block — denser than practitioner (18/20/22 vs 24/24/28 elsewhere)
  titleBlock: {
    paddingTop: 18,
    paddingRight: 20,
    paddingBottom: 22,
    paddingLeft: 20,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 31,
    letterSpacing: -0.62,
    color: IOS_REGISTER.label,
    marginBottom: 10,
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
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  // Captures card — link back to Debrief
  capturesCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  capturesLeft: { flex: 1, minWidth: 0 },
  capturesEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  capturesBody: {
    fontSize: 17,
    fontWeight: '400',
    color: IOS_REGISTER.label,
    letterSpacing: -0.34,
  },
  capturesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  capturesRightText: {
    fontSize: 15,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  // Section eyebrow — tightened for faculty density
  sectionEyebrow: {
    paddingTop: 4,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrowText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionEyebrowCount: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  // Competency stack — 12px gap (faculty density)
  compStack: {
    paddingHorizontal: 16,
    gap: 12,
  },
  compCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  compLabel: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  compDesc: {
    fontSize: 15,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  // Earned register exception — 44px tall, semibold active
  seg: {
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 9,
    padding: 2,
    flexDirection: 'row',
    height: 44,
    marginBottom: 12,
  },
  segOpt: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  segOptActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  segDivider: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  segOptText: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_REGISTER.label,
    // Tightened letter-spacing so "Distinguished" fits in the quarter-width
    // segment at 13pt regular alongside Emerging / Developing / Proficient.
    // Without this, the longest label truncates to "Distinguis…".
    letterSpacing: -0.4,
  },
  segOptTextActive: {
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  // Evidence textarea
  evidence: {
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 96,
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  evidenceHasContent: {
    backgroundColor: 'rgba(0, 122, 255, 0.04)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 0 0 0.5px rgba(0, 122, 255, 0.18)',
      } as any,
      default: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0, 122, 255, 0.18)',
      },
    }),
  },
  // Capture-chip — coral, inserted evidence
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  capChipTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E85A5A',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  capChipText: {
    fontSize: 13,
    color: '#E85A5A',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  evidenceHelpRow: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  evidenceHelp: {
    fontSize: 12,
    lineHeight: 17,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  evidenceHelpLink: {
    color: IOS_REGISTER.accentUserAction,
  },
  // AI offer — coral
  aiOffer: {
    marginTop: 18,
    marginHorizontal: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
    borderRadius: 16,
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
    color: '#E85A5A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  aiOfferBody: {
    marginBottom: 14,
  },
  pullQuote: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderLeftWidth: 2,
    borderLeftColor: IOS_REGISTER.accentMarkedContent,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  pullQuoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
    lineHeight: 21,
  },
  aiAscription: {
    marginTop: 8,
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  aiAscriptionAccent: {
    color: '#E85A5A',
    fontWeight: '600',
  },
  aiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBtnFill: {
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  aiBtnFillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  aiBtnText: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  aiBtnTextLabel: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
  },
  // Submit row
  submitRow: {
    marginTop: 24,
    marginHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  btnSubmit: {
    width: '100%',
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnSubmitText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  btnDraft: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  btnDraftText: {
    fontSize: 15,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
});
