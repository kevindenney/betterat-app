/**
 * StepCombinatorsRow — context pill row under the IdentityDeck title.
 *
 * Surfaces a small set of typed chips that name what's "around" this
 * step so the user can predict where a tap goes before tapping:
 *
 *   [⇄ Also relevant for <OtherInterest>] · [WITH · N] · [N yours] · [N playbook]
 *
 * Cross-interest — first AI-generated cross-interest suggestion's
 * source interest. Tap → routes to that interest's timeline.
 *
 * WITH — distinct people on this step (owner + explicit access grants +
 * blueprint-cohort), deduplicated. Replaces the older fragmented
 * cluster of "N peers" / "X person has access" / cohort avatar stack
 * that each answered "who's on this step" with a different number.
 * Tap → opens the People sheet listing everyone once with role tags.
 *
 * yours — viewer's other timeline steps that share blueprint / category
 * / capability with this one. Tap → existing related-steps sheet.
 *
 * playbook — library items linked to this step. Tap → switches to the
 * Plan tab where the library-before list lives.
 *
 * Each chip hides when its count is zero; the row hides entirely when
 * nothing has data.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { getAtlasStepData, isAtlasRaceCourseStep } from '@/lib/atlasRaceStep';
import { useStepLibraryBefore } from '@/hooks/useStepLibraryBefore';
import { useStepWithPeople } from '@/hooks/useStepWithPeople';
import { useAtlasPeerSteps } from '@/hooks/useAtlasPeerSteps';
import { StepCombinatorsSheet } from './StepCombinatorsSheet';
import { StepPeopleSheet } from './StepPeopleSheet';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { StepAccessPerson } from './StepDiscussionInline';

interface StepCombinatorsRowProps {
  step: TimelineStepRecord;
  /**
   * Kept on the prop signature for back-compat with callers that still
   * pass them, but unused now — the IdentityDeck above us renders
   * blueprint provenance as a text line so we don't duplicate it here.
   */
  blueprintTitle?: string | null;
  blueprintAuthorName?: string | null;
  /** Viewer's own timeline steps — used to count related entries. */
  viewerSteps: TimelineStepRecord[];
  /**
   * Owner + collaborators with access to this step. Sourced from the
   * parent's discussionAccess. Feeds the WITH chip's deduped count.
   */
  accessPeople?: StepAccessPerson[];
  /**
   * Called when the "N playbook" chip is tapped. Typically routes the
   * parent to the Plan tab where the step_library_before list lives.
   */
  onShowPlaybook?: () => void;
}

export function StepCombinatorsRow({
  step,
  viewerSteps,
  accessPeople = [],
  onShowPlaybook,
}: StepCombinatorsRowProps) {
  const { suggestions } = useCrossInterestSuggestions(
    step.id,
    step.interest_id ?? undefined,
  );
  const { switchInterest } = useInterest();
  const { user } = useAuth();
  const atlasData = getAtlasStepData(step.metadata);
  const suppressCrossInterest =
    isAtlasRaceCourseStep(step.metadata) ||
    Boolean(atlasData?.origin) ||
    atlasData?.interest_slug === 'sail-racing' ||
    step.category === 'sailing';
  const crossInterest = suppressCrossInterest ? null : suggestions[0] ?? null;

  const relatedSteps = useMemo(() => {
    const stepMetadata = (step.metadata ?? {}) as {
      plan?: { capability_goals?: string[]; competency_ids?: string[] };
    };
    const stepGoals = new Set(
      (stepMetadata.plan?.capability_goals ?? [])
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
    );
    const stepCompetencies = new Set(stepMetadata.plan?.competency_ids ?? []);
    // Categories like 'general', 'uncategorized', '' are too broad to
    // produce a useful match — every uncategorized step would pile in.
    // Only treat domain-specific categories as match signal.
    const GENERIC_CATEGORIES = new Set(['', 'general', 'uncategorized', 'misc', 'other']);
    const stepCategoryNorm = (step.category ?? '').trim().toLowerCase();
    const categoryIsSpecific = Boolean(stepCategoryNorm) && !GENERIC_CATEGORIES.has(stepCategoryNorm);

    const stepStartIso = step.starts_at ?? step.due_at ?? null;
    const stepStartWeek = stepStartIso ? weekKey(stepStartIso) : null;

    const matches = viewerSteps
      .filter((s) => s.id !== step.id)
      .map((s) => {
        const reasons: string[] = [];
        if (step.source_blueprint_id != null && s.source_blueprint_id === step.source_blueprint_id) {
          reasons.push('same blueprint');
        }
        const otherCategoryNorm = (s.category ?? '').trim().toLowerCase();
        if (categoryIsSpecific && otherCategoryNorm === stepCategoryNorm) {
          reasons.push(`same category: ${step.category}`);
        }
        const otherMetadata = (s.metadata ?? {}) as {
          plan?: { capability_goals?: string[]; competency_ids?: string[] };
        };
        const sharedGoal = (otherMetadata.plan?.capability_goals ?? [])
          .map((g) => g.trim())
          .find((g) => stepGoals.has(g.toLowerCase()));
        if (sharedGoal) reasons.push(`shared capability: ${sharedGoal}`);
        const sharedCompetency = (otherMetadata.plan?.competency_ids ?? [])
          .find((id) => stepCompetencies.has(id));
        if (sharedCompetency) reasons.push('shared competency');
        if (
          step.location_place_id != null &&
          s.location_place_id === step.location_place_id
        ) {
          reasons.push('same place');
        }
        if (stepStartWeek && (s.starts_at || s.due_at)) {
          const otherWeek = weekKey((s.starts_at ?? s.due_at) as string);
          if (otherWeek === stepStartWeek) reasons.push('same week');
        }
        return { step: s, reasons };
      })
      .filter((item) => item.reasons.length > 0);

    // Sort by relevance: more reasons = stronger match. Tiebreak by
    // recency so the freshest stuff lands first.
    matches.sort((a, b) => {
      if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
      const aDate = a.step.starts_at ?? a.step.due_at ?? a.step.created_at;
      const bDate = b.step.starts_at ?? b.step.due_at ?? b.step.created_at;
      return (bDate ?? '').localeCompare(aDate ?? '');
    });

    return matches.slice(0, 12);
  }, [viewerSteps, step]);
  const relatedCount = relatedSteps.length;

  const { people, totalCount: withCount } = useStepWithPeople({
    stepId: step.id,
    accessPeople,
    viewerUserId: user?.id ?? null,
  });

  const { data: libraryBefore } = useStepLibraryBefore(step.id);
  const playbookCount = libraryBefore?.length ?? 0;

  // NEAR — proximity-derived: peer steps within ~5km of this step's
  // location. Distinct from WITH (explicit relationships). Hidden when
  // the step has no location.
  const { data: nearbyPeerSteps = [] } = useAtlasPeerSteps({
    lat: step.location_lat,
    lng: step.location_lng,
    radiusKm: 5,
    enabled: step.location_lat != null && step.location_lng != null,
  });
  const nearCount = useMemo(
    () => nearbyPeerSteps.filter((s) => s.relationship !== 'self').length,
    [nearbyPeerSteps],
  );

  const [sheet, setSheet] = useState<null | 'related' | 'people' | 'near' | 'cross'>(null);
  const nearbyPeerStepsForSheet = useMemo(
    () => nearbyPeerSteps.filter((s) => s.relationship !== 'self'),
    [nearbyPeerSteps],
  );

  const hasCross = Boolean(crossInterest);
  const hasRelated = relatedCount > 0;
  // Only surface the WITH chip when others are involved — "1 with"
  // when the only person is the viewer themselves is noise.
  const hasWith = withCount >= 2;
  const hasNear = nearCount > 0;
  const hasPlaybook = playbookCount > 0;

  if (!hasCross && !hasRelated && !hasWith && !hasNear && !hasPlaybook) return null;

  return (
    <View>
      <View style={styles.row}>
        {hasCross && crossInterest ? (
          <Pressable
            style={styles.crossPill}
            onPress={() => setSheet('cross')}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={12}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              <Text style={styles.pillDim}>Also relevant for </Text>
              <Text style={styles.pillCrossEmphasis}>
                {crossInterest.sourceInterestName}
              </Text>
            </Text>
          </Pressable>
        ) : null}

        {hasWith ? (
          <Pressable style={[styles.pill, styles.withPill]} onPress={() => setSheet('people')}>
            <View style={styles.withAvatarStack}>
              {people.slice(0, 3).map((person, idx) => (
                <View
                  key={person.userId}
                  style={[
                    styles.withAvatar,
                    idx > 0 && styles.withAvatarOverlap,
                    {
                      backgroundColor:
                        person.avatarColor ?? withAvatarFallback(person.userId),
                    },
                  ]}
                >
                  <Text style={styles.withAvatarText}>
                    {person.initials.slice(0, 1) || '?'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.pillText}>
              <Text style={styles.pillBold}>{withCount}</Text>
              <Text style={styles.pillDim}> with</Text>
            </Text>
          </Pressable>
        ) : null}

        {hasNear ? (
          <Pressable style={[styles.pill, styles.nearPill]} onPress={() => setSheet('near')}>
            <Ionicons name="locate-outline" size={12} color="#0A84FF" />
            <Text style={styles.pillText}>
              <Text style={[styles.pillBold, styles.nearBold]}>{nearCount}</Text>
              <Text style={styles.pillDim}> near</Text>
            </Text>
          </Pressable>
        ) : null}

        {hasRelated ? (
          <Pressable style={styles.pill} onPress={() => setSheet('related')}>
            <Ionicons
              name="link-outline"
              size={12}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.pillText}>
              <Text style={styles.pillBold}>{relatedCount}</Text>
              <Text style={styles.pillDim}> yours</Text>
            </Text>
          </Pressable>
        ) : null}

        {hasPlaybook ? (
          onShowPlaybook ? (
            <Pressable style={styles.pill} onPress={onShowPlaybook}>
              <Ionicons
                name="bookmark-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{playbookCount}</Text>
                <Text style={styles.pillDim}> playbook</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={styles.pill}>
              <Ionicons
                name="bookmark-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{playbookCount}</Text>
                <Text style={styles.pillDim}> playbook</Text>
              </Text>
            </View>
          )
        ) : null}
      </View>

      {sheet === 'related' ? (
        <StepCombinatorsSheet
          visible
          mode="related"
          relatedSteps={relatedSteps}
          onDismiss={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'near' ? (
        <StepCombinatorsSheet
          visible
          mode="near"
          nearbySteps={nearbyPeerStepsForSheet}
          onDismiss={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'cross' && crossInterest ? (
        <StepCombinatorsSheet
          visible
          mode="cross"
          cross={crossInterest}
          onOpenInterest={async () => {
            await switchInterest(crossInterest.sourceInterestSlug);
            router.replace('/(tabs)/practice' as never);
          }}
          onDismiss={() => setSheet(null)}
        />
      ) : null}

      <StepPeopleSheet
        visible={sheet === 'people'}
        people={people}
        onDismiss={() => setSheet(null)}
      />
    </View>
  );
}

const WITH_AVATAR_COLORS = ['#1F6FEB', '#22A06B', '#F08C00', '#9333EA', '#DC2626'];
function withAvatarFallback(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return WITH_AVATAR_COLORS[Math.abs(h) % WITH_AVATAR_COLORS.length] as string;
}

/** ISO week key (YYYY-Wnn) used to group steps by week for matching. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // ISO week calculation: Thursday of the same week determines the year.
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = 1 + Math.round(((thursday.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    maxWidth: 280,
  },
  crossPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(175, 82, 222, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175, 82, 222, 0.30)',
    maxWidth: 280,
  },
  pillText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  pillBold: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  pillDim: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '400',
  },
  pillCrossEmphasis: {
    color: '#7B3FB0',
    fontWeight: '600',
  },
  // NEAR chip — distinct from WITH (which is explicit relationships).
  // Blue accent says "geographic / proximity signal." Distinct enough
  // from the lilac cross-interest pill so a sailor can tell them apart
  // at a glance.
  nearPill: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderColor: 'rgba(10, 132, 255, 0.30)',
  },
  nearBold: {
    color: '#0A84FF',
  },
  // WITH chip with inline avatar stack so the people on this step read
  // at a glance — surfacing them only via the popup sheet hid the
  // most useful "who's here?" signal.
  withPill: {
    paddingLeft: 4,
    paddingRight: 9,
    gap: 6,
  },
  withAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  withAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.cardBg,
  },
  withAvatarOverlap: {
    marginLeft: -7,
  },
  withAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.1,
  },
});
