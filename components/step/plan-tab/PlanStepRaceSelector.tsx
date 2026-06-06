import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { RacePlan } from '@/types/step-detail';
import { RaceCourseMiniMap } from './RaceCourseMiniMap';
import { RaceCourseLiveMap } from './RaceCourseLiveMap';

/**
 * Phase N.4 — the Step ⟷ Race selector that sits at the top of the Plan
 * composer for sailing. A step is just a step; flagging it a Race is the one
 * distinction that changes Atlas behavior (⛵ pin in a race-area polygon +
 * course/marks/conditions cockpit). Persists to `timeline_steps.is_race`.
 *
 * When Race is selected we reveal an entry to set the race area & course —
 * the on-water authoring flow already owns that geometry, so we link to it
 * rather than duplicating mark/course editing inline.
 */

const RACE = '#2563EB';

interface PlanStepRaceSelectorProps {
  isRace: boolean;
  onChange: (next: boolean) => void;
  readOnly?: boolean;
  /** Opens the race area & course authoring flow (on-water screen). */
  onOpenRaceCourse?: () => void;
  /** Opens Atlas centered on the saved race area/course. */
  onOpenRaceCourseAtlas?: () => void;
  /**
   * One-line summary of the saved race plan (e.g. "Port shelter ·
   * Windward–Leeward · 2 laps"). When set, the reveal row shows it in place of
   * the generic prompt so a picked course reads as saved, not unset.
   */
  courseSummary?: string;
  /**
   * The saved race plan. When it carries an area, the reveal row is replaced by
   * a schematic course map (area polygon, marks, start line) per the redesign,
   * with "Edit course" linking back into the authoring flow.
   */
  racePlan?: Pick<
    RacePlan,
    'area_id' | 'area_name' | 'center' | 'course_label' | 'laps' | 'course_type'
  >;
  /**
   * Render the live Atlas MapLibre map (real area polygon + course geometry +
   * live wind/current/wave overlays) instead of the lightweight SVG schematic.
   * Set only on the single step-detail Plan tab — the timeline carousel cards
   * keep the schematic so we don't mount N live WebGL canvases.
   */
  liveMap?: boolean;
  /**
   * The race's scheduled time (step.starts_at). Threaded to the live map so its
   * conditions forecast targets race start, not "now". Null ⇒ the map prompts
   * for a race time instead of showing conditions.
   */
  raceTime?: string | null;
  /**
   * Suppress the "Race area & course ›" reveal row when course authoring is
   * handled inline below this selector (the + composer renders RaceCoursePicker
   * directly), so the toggle doesn't show a redundant dead navigation row.
   */
  hideCourseReveal?: boolean;
}

export function PlanStepRaceSelector({
  isRace,
  onChange,
  readOnly,
  onOpenRaceCourse,
  onOpenRaceCourseAtlas,
  courseSummary,
  racePlan,
  liveMap,
  raceTime,
  hideCourseReveal,
}: PlanStepRaceSelectorProps) {
  const hasArea = Boolean(racePlan?.area_id || racePlan?.area_name);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Option
          glyph="📍"
          title="Step"
          desc="Anything you do — practice, boat work, a debrief."
          selected={!isRace}
          tone={IOS_COLORS.systemBlue}
          onPress={readOnly ? undefined : () => onChange(false)}
        />
        <Option
          glyph="⛵"
          title="Race"
          desc="An event on a course. Gets Atlas course & marks."
          selected={isRace}
          tone={RACE}
          onPress={readOnly ? undefined : () => onChange(true)}
        />
      </View>

      {!isRace ? (
        <Text style={styles.note}>
          Most steps are just <Text style={styles.noteStrong}>Step</Text>. Mark
          a step a <Text style={styles.noteStrong}>Race</Text> only when it
          happens on a course with marks — that unlocks the race grammar.
        </Text>
      ) : hideCourseReveal ? null : hasArea ? (
        <View style={styles.mapBlock}>
          <Text style={styles.revealTitle}>Race area & course</Text>
          {liveMap && racePlan?.center ? (
            <RaceCourseLiveMap
              racePlan={racePlan}
              raceTime={raceTime}
              onEditCourse={readOnly ? undefined : onOpenRaceCourse}
              onOpenAtlas={onOpenRaceCourseAtlas}
            />
          ) : (
            <RaceCourseMiniMap
              areaName={racePlan?.area_name}
              courseLabel={racePlan?.course_label}
              laps={racePlan?.laps}
              onEditCourse={readOnly ? undefined : onOpenRaceCourse}
            />
          )}
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.revealRow, pressed && styles.revealPressed]}
          onPress={readOnly ? undefined : onOpenRaceCourse}
          disabled={readOnly || !onOpenRaceCourse}
          accessibilityRole="button"
        >
          <Ionicons name="navigate-circle-outline" size={18} color={RACE} />
          <View style={styles.revealText}>
            <Text style={styles.revealTitle}>Race area & course</Text>
            {courseSummary ? (
              <Text style={styles.revealSummary}>{courseSummary}</Text>
            ) : (
              <Text style={styles.revealSub}>Set the course geometry, marks, and conditions</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={RACE} />
        </Pressable>
      )}
    </View>
  );
}

function Option({
  glyph,
  title,
  desc,
  selected,
  tone,
  onPress,
}: {
  glyph: string;
  title: string;
  desc: string;
  selected: boolean;
  tone: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.option,
        selected && { borderColor: tone, backgroundColor: hexToTint(tone) },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected && (
        <View style={[styles.check, { backgroundColor: tone }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
      <Text style={styles.glyph}>{glyph}</Text>
      <Text style={[styles.optTitle, selected && { color: tone }]}>{title}</Text>
      <Text style={styles.optDesc}>{desc}</Text>
    </Pressable>
  );
}

// Selected card gets a faint wash of its tone — keeps the two options visually
// distinct without a hard fill that would fight the form below.
function hexToTint(hex: string): string {
  if (hex === '#007AFF') return 'rgba(0,122,255,0.08)';
  return 'rgba(37,99,235,0.08)';
}

const styles = StyleSheet.create({
  wrap: {
    gap: IOS_SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  option: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 12,
  },
  check: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 21,
  },
  optTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginTop: 7,
  },
  optDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 3,
  },
  note: {
    fontSize: 11,
    lineHeight: 15,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: 2,
  },
  noteStrong: {
    color: IOS_COLORS.label,
    fontWeight: '700',
  },
  mapBlock: {
    gap: 8,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: 'rgba(37,99,235,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  revealPressed: {
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  revealText: {
    flex: 1,
  },
  revealTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: RACE,
  },
  revealSub: {
    fontSize: 11,
    lineHeight: 15,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  revealSummary: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: RACE,
    marginTop: 1,
  },
});
