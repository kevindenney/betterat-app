/**
 * Race Prep — iOS register preview
 *
 * Side-by-side preview route that renders an existing step using the iOS
 * register kit (components/ios-register/*). Sits alongside the existing
 * /step/[id] Plan tab, NOT a replacement yet.
 *
 * Wire-up status (Phase 3 of the iOS register migration — see
 * docs/redesign/IOS_MIGRATION_PLAN.md):
 *
 *   Real data:
 *     - Step title, description, starts_at, location → title block
 *     - plan_data.how_sub_steps → up to 3 beats (with sailing fallback
 *       names when fewer than 3 sub-steps exist)
 *     - plan_data.collaborators → crew list (with avatar initials)
 *
 *   Placeholder data (data-layer not wired yet):
 *     - Forecast tiles — hardcoded "WIND/SEA/TIDE/SKY" copy
 *     - "From your last race" quote stack — hardcoded
 *     - Working-on pills — hardcoded capability + concept
 *     - Permission rule callout — hardcoded sailing rule
 *     - Coral AI prompt card — hardcoded "From your playbook" offer
 *
 * Open at /race/ios/{stepId} to compare visually against /step/{stepId}.
 */

import React from 'react';
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

import {
  BeatCard,
  BeatBody,
  CoralAIPromptCard,
  CrewList,
  ForecastTileGroup,
  PermissionRuleCallout,
  QuoteCard,
  ToolbarComposer,
  WorkingOnPill,
} from '@/components/ios-register';
import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useCompetenciesForInterest } from '@/hooks/useCompetencies';
import { useCompetencyProgress } from '@/hooks/useCompetencyProgress';
import type { StepPlanData, StepCollaborator } from '@/types/step-detail';
import type { CompetencyStatus } from '@/types/competency';

// --- Sailing-only beat name fallback (per migration plan decision #3) ---
// When plan_data.how_sub_steps doesn't supply enough entries, fill in with
// the sailing register's beat names. Per-interest mapping defers to a
// future commit (clinical: Briefing/Shift/Debrief; drawing: TBD).
const SAILING_BEAT_FALLBACK = [
  { title: 'Start', meta: '5-min sequence' },
  { title: 'First beat', meta: 'to the windward mark' },
  { title: 'Contingency', meta: 'your rule' },
];

// Avatar tints — deterministic by index so re-renders don't reshuffle.
const AVATAR_COLORS = ['#7A92A8', '#9AA88F', '#B0967E', '#A87E8E', '#8E7EA8'];

export default function RaceIosPreview() {
  const { stepId } = useLocalSearchParams<{ stepId: string }>();
  const actualId = Array.isArray(stepId) ? stepId[0] : stepId;
  const { data: step, isLoading, error } = useStepDetail(actualId);

  if (!actualId || error) {
    return <ErrorState message={error?.message ?? 'No step id provided'} />;
  }

  if (isLoading || !step) {
    return (
      <SafeAreaView style={styles.loading}>
        <Stack.Screen
          options={{ title: 'Race Prep (iOS preview)', headerShown: true }}
        />
        <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
      </SafeAreaView>
    );
  }

  const plan = ((step.metadata?.plan_data ?? {}) as StepPlanData) ?? {};
  const eyebrow = step.starts_at ? formatEyebrow(step.starts_at) : null;
  const metaLines = buildMetaLines(step.description, step.location_name);

  const collaborators: StepCollaborator[] = plan.collaborators ?? [];
  const competencyIds = plan.competency_ids ?? [];

  return (
    <RaceIosPreviewBody
      step={step}
      plan={plan}
      eyebrow={eyebrow}
      metaLines={metaLines}
      collaborators={collaborators}
      competencyIds={competencyIds}
    />
  );
}

interface PreviewBodyProps {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  plan: StepPlanData;
  eyebrow: string | null;
  metaLines: string[];
  collaborators: StepCollaborator[];
  competencyIds: string[];
}

function RaceIosPreviewBody({
  step,
  plan,
  eyebrow,
  metaLines,
  collaborators,
  competencyIds,
}: PreviewBodyProps) {
  // Real competency titles for the step's interest.
  const { data: allCompetencies } = useCompetenciesForInterest(step.interest_id);
  // Per-user progress (scoped to the user's *active* interest — may be empty
  // when viewing a step from a different interest).
  const { competencies: competencyProgress } = useCompetencyProgress();

  const workingOnCapabilities = competencyIds
    .map((id) => {
      const def = allCompetencies?.find((c) => c.id === id);
      if (!def) return null;
      const prog = competencyProgress?.find((c) => c.id === id);
      return {
        id,
        title: def.title,
        status: prog?.progress?.status ?? null,
      };
    })
    .filter((c): c is { id: string; title: string; status: CompetencyStatus | null } =>
      c !== null,
    );

  // Map plan_data.how_sub_steps to beats. Use the sub-step text as the body
  // when present; fall back to the sailing-register name + placeholder body.
  const beats = SAILING_BEAT_FALLBACK.map((fallback, idx) => {
    const sub = plan.how_sub_steps?.[idx];
    return {
      title: fallback.title,
      meta: fallback.meta,
      body: sub?.text ?? null,
    };
  });

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

        {/* Preview-mode banner — honest disclosure that some sections are
            placeholder content until the data layer is wired. */}
        <PreviewBanner />

        {/* Title block */}
        <View style={styles.titleBlock}>
          {eyebrow ? <Text style={styles.titleEyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{step.title}</Text>
          {metaLines.length > 0 && (
            <View>
              {metaLines.map((line, idx) => (
                <Text key={idx} style={styles.titleMeta}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Forecast tiles — PLACEHOLDER until weather data layer is wired */}
        <ForecastTileGroup
          tiles={[
            {
              label: 'WIND',
              value: '18–22',
              unit: 'kn',
              sub: 'NE, gusts 28',
              icon: 'arrow-up',
            },
            {
              label: 'SEA',
              value: '1.2',
              unit: 'm',
              sub: 'Building',
              icon: 'water-outline',
            },
            {
              label: 'TIDE',
              value: 'Falling',
              sub: 'LW 14:08',
              icon: 'arrow-down',
            },
            {
              label: 'SKY',
              value: 'Partly',
              sub: 'Cloud lifting',
              icon: 'partly-sunny-outline',
            },
          ]}
        />
        <Text style={styles.forecastProv}>
          Placeholder forecast · weather data layer pending
        </Text>

        {/* Working-on pills — capabilities wired to plan_data.competency_ids;
            concept pill stays hardcoded until concept-active-in-step schema
            exists (see IOS_MIGRATION_PLAN.md follow-ups). */}
        <Text style={styles.sectHead}>WORKING ON</Text>
        <View style={styles.workPills}>
          {workingOnCapabilities.length === 0 ? (
            <Text style={styles.emptyWorkingOn}>
              No capabilities tagged on this step yet.
            </Text>
          ) : (
            workingOnCapabilities.map((cap) => (
              <WorkingOnPill
                key={cap.id}
                kind="capability"
                name={cap.title}
                state={cap.status ?? undefined}
                icon="walk-outline"
              />
            ))
          )}
          <WorkingOnPill
            kind="concept"
            name="Trust the shift, not just the side"
            live
          />
        </View>

        {/* Quotes — PLACEHOLDER until prior-step Debrief query is wired */}
        <Text style={styles.sectHead}>FROM YOUR LAST RACE</Text>
        <View style={styles.quoteStack}>
          <QuoteCard
            quote="The mistake wasn't the plan, it was not updating it when the breeze told me to."
            provenance="Race 3 Debrief · Sunday morning"
            source="voice"
          />
          <QuoteCard
            quote="Trust the shift, not just the side."
            provenance="First time you used these words · Wednesday"
            source="ai"
          />
        </View>

        {/* Beats — wired to plan_data.how_sub_steps with sailing fallback */}
        <View style={styles.sectHeadRow}>
          <Text style={styles.sectHead}>YOUR PLAN</Text>
          <Text style={styles.sectHeadMeta}>3 beats</Text>
        </View>
        <View style={styles.beats}>
          {beats.map((beat, idx) => {
            const isContingency = idx === beats.length - 1;
            return (
              <BeatCard key={beat.title} title={beat.title} meta={beat.meta}>
                <BeatBody>
                  {beat.body ?? (
                    <Text style={styles.beatPlaceholder}>
                      {`(Sub-step ${idx + 1} not yet captured — fill the How section in the Plan tab to populate this beat.)`}
                    </Text>
                  )}
                </BeatBody>
                {isContingency && (
                  <>
                    <PermissionRuleCallout
                      label="YOUR RULE"
                      text="If the left fills in past ten degrees on starboard, I commit."
                    />
                    <BeatBody>
                      Don't rewrite this in your head on the water. The rule
                      is the rule. The discipline isn't reading the breeze —
                      it's trusting what you've already decided.
                    </BeatBody>
                  </>
                )}
              </BeatCard>
            );
          })}
        </View>

        {/* AI prompt — PLACEHOLDER until concept-suggestion service is wired */}
        <Text style={styles.sectHead}>FROM YOUR PLAYBOOK</Text>
        <View style={styles.aiPromptWrap}>
          <CoralAIPromptCard
            label="FROM YOUR PLAYBOOK"
            primaryAction={{
              label: 'Open as a concept',
              onPress: () => {},
            }}
            secondaryAction={{ label: 'Not now', onPress: () => {} }}
          >
            You've written about{' '}
            <Text style={{ fontStyle: 'italic' }}>
              Trust the shift, not just the side
            </Text>{' '}
            in three reflections since March. Want to open it as a concept
            and bring its accumulated notes into this race's prep?
          </CoralAIPromptCard>
        </View>

        {/* Crew — wired to plan_data.collaborators */}
        <View style={styles.sectHeadRow}>
          <Text style={styles.sectHead}>WHO'S ON THE BOAT</Text>
          <Text style={styles.sectHeadMeta}>
            {collaborators.length > 0
              ? `${collaborators.length} on the boat`
              : ''}
          </Text>
        </View>
        <View style={styles.crewWrap}>
          {collaborators.length > 0 ? (
            <CrewList
              members={collaborators.map((c, idx) => ({
                id: c.id,
                name: c.display_name,
                role: c.connection_space ?? undefined,
                initials: deriveInitials(c.display_name),
                avatarColor:
                  c.avatar_color ?? AVATAR_COLORS[idx % AVATAR_COLORS.length],
              }))}
            />
          ) : (
            <Text style={styles.emptyCrew}>
              No crew added yet — add collaborators in the Plan tab.
            </Text>
          )}
        </View>

        {/* Composer — visual-only on this preview surface */}
        <ToolbarComposer
          prompt="Anything else you want to think out loud about?"
          tools={[
            { key: 'list', label: 'List', icon: 'list', onPress: () => {} },
            {
              key: 'camera',
              label: 'Camera',
              icon: 'camera',
              onPress: () => {},
            },
            {
              key: 'photo',
              label: 'Photo library',
              icon: 'image',
              onPress: () => {},
            },
            { key: 'audio', label: 'Audio', icon: 'mic', onPress: () => {} },
            {
              key: 'location',
              label: 'Location',
              icon: 'location',
              onPress: () => {},
            },
            {
              key: 'sparkles',
              label: 'AI suggestions',
              icon: 'sparkles',
              sparkles: true,
              onPress: () => {},
            },
          ]}
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEyebrow(startsAt: string): string {
  try {
    const date = parseISO(startsAt);
    const weekday = format(date, 'EEEE').toUpperCase();
    const now = new Date();
    // Drop the time component so "in 2 days" reads correctly across midnight.
    const truncatedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const truncatedNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = truncatedDate.getTime() - truncatedNow.getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    if (diffDays === 0) return `${weekday} · TODAY`;
    if (diffDays === 1) return `${weekday} · TOMORROW`;
    if (diffDays === -1) return `${weekday} · YESTERDAY`;
    const rel = formatDistanceToNowStrict(date, { addSuffix: true });
    return `${weekday} · ${rel.toUpperCase()}`;
  } catch {
    return '';
  }
}

function buildMetaLines(
  description: string | null,
  location: string | null,
): string[] {
  const lines: string[] = [];
  if (description) {
    // First line of description if multi-line; otherwise the whole thing.
    const first = description.split('\n')[0].trim();
    if (first) lines.push(first);
  }
  if (location) lines.push(location);
  return lines;
}

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
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
        Preview: title, description, plan sub-steps, and crew are wired to
        real data. Forecast, working-on, quotes, and AI prompt are
        placeholder until their data layers land.
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <Stack.Screen
        options={{ title: 'Race Prep (iOS preview)', headerShown: true }}
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
  // Top chrome row
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
  // Preview banner
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
  // Title block
  titleBlock: {
    paddingTop: 10,
    paddingRight: 20,
    paddingBottom: 32,
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
  titleMeta: {
    ...IOS_REGISTER_TEXT.titleMeta,
    color: IOS_REGISTER.labelSecondary,
  },
  // Forecast provenance line
  forecastProv: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 24,
    marginTop: 12,
    letterSpacing: -0.1,
    fontStyle: 'italic',
  },
  // Section eyebrow + right-meta layout
  sectHead: {
    ...IOS_REGISTER_TEXT.sectionEyebrow,
    color: IOS_REGISTER.labelSecondary,
    paddingTop: 32,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  sectHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  sectHeadMeta: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.3,
    paddingTop: 32,
    paddingBottom: 12,
  },
  workPills: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyWorkingOn: {
    ...IOS_REGISTER_TEXT.beatMeta,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
  quoteStack: {
    paddingHorizontal: 16,
    gap: 10,
  },
  beats: {
    paddingHorizontal: 16,
    gap: 12,
  },
  beatPlaceholder: {
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
  aiPromptWrap: {
    paddingHorizontal: 16,
  },
  crewWrap: {
    paddingHorizontal: 16,
  },
  emptyCrew: {
    ...IOS_REGISTER_TEXT.beatBody,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
});
