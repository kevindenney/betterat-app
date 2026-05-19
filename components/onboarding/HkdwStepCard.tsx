/**
 * HKDW step card — the Phase 10 canonical "Your first step" card.
 *
 * Two variants:
 *  - web: install-hint footer ("Voice capture works in the BetterAt app")
 *  - native: with-row Worlds Fleet chip + AI Coach helper line at the top
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Anchor,
  ChevronRight,
  Lightbulb,
  List,
  Mic,
  Sparkles,
  Trophy,
} from 'lucide-react-native';

export interface HkdwStepCardProps {
  variant: 'web' | 'native';
  /** "HKDW Prep" — left half of the trophy strip. */
  blueprintShortName: string;
  /** "Week 1 of 24" — right half of the trophy strip. */
  blueprintWeekLine: string;
  /** "Your first step" / "Current step" — eyebrow above the title. */
  eyebrow?: string;
  /** Counter chip in head — e.g. "Step 1 of 12". Optional. */
  stepCounter?: string;
  /** Pre-title small-caps label, e.g. "Current step". */
  preTitle?: string;
  /** The step title. */
  stepTitle: string;
  /** "From Kevin's Prepare for the Worlds". */
  fromLine?: string;
  /** "Worlds Fleet · 63 sailors" with-row chip (native variant only). */
  fleetChipLabel?: string;
  /** "Sail your boat for one hour…" — body of the What field. */
  planWhatText?: string;
  /** "Sub-steps from Kevin's blueprint will appear here…" — body of the How field. */
  planHowText?: string;
  /** Tapping the trophy strip opens the Blueprint Index. */
  onTapBlueprintStrip?: () => void;
  /** Tapping the with-row chip opens the Worlds Fleet view (native only). */
  onTapFleetChip?: () => void;
  /** Tapping the AI helper opens AI Coach (native only). */
  onTapAiHelper?: () => void;
  /** Tapping the Discussion tab opens the Step Discussion screen. */
  onTapDiscussion?: () => void;
  /** Currently-on phase tab. */
  activePhase?: 'plan' | 'do' | 'reflect' | 'discussion';
  /** Total subscribers shown next to the AI helper / install hint. */
  totalSailors?: number;
}

const C = {
  card: '#FFFFFF',
  ink: '#1C1C1E',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  label4: '#C7C7CC',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  blueStrong: '#A8C8FF',
  blueTint: '#E6F0FF',
  purple: '#5856D6',
  purpleDeep: '#3F3DAB',
  purpleSoft: '#D7D6F4',
  purpleTint: '#EFEFFB',
  green: '#34C759',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
};

export function HkdwStepCard({
  variant,
  blueprintShortName,
  blueprintWeekLine,
  eyebrow = 'Your first step',
  stepCounter,
  preTitle = 'Current step',
  stepTitle,
  fromLine,
  fleetChipLabel,
  planWhatText,
  planHowText,
  onTapBlueprintStrip,
  onTapFleetChip,
  onTapAiHelper,
  onTapDiscussion,
  activePhase = 'plan',
  totalSailors,
}: HkdwStepCardProps) {
  const isNative = variant === 'native';

  return (
    <View style={styles.card}>
      {/* HEAD — eyebrow pill + counter */}
      <View style={styles.head}>
        <View style={styles.pillBlue}>
          <View style={styles.dot} />
          <Text style={styles.pillLabel}>{eyebrow}</Text>
        </View>
        {stepCounter ? <Text style={styles.counter}>{stepCounter}</Text> : null}
      </View>

      {/* TROPHY STRIP — blueprint short name + week */}
      <Pressable
        style={styles.strip}
        onPress={onTapBlueprintStrip}
        disabled={!onTapBlueprintStrip}
      >
        <View style={styles.stripIco}>
          <Trophy size={11} color={C.blue} />
        </View>
        <Text style={styles.stripText}>
          <Text style={styles.stripStrong}>{blueprintShortName}</Text>
          <Text style={styles.stripSep}> · </Text>
          {blueprintWeekLine}
        </Text>
        {onTapBlueprintStrip ? (
          <ChevronRight size={13} color={C.label3} style={styles.stripChev} />
        ) : null}
      </Pressable>

      {/* TITLE BLOCK */}
      <View style={styles.titleBlock}>
        <Text style={styles.pre}>{preTitle}</Text>
        <Text style={styles.title}>{stepTitle}</Text>
        {fromLine ? (
          <Text style={styles.from}>
            From <Text style={styles.fromStrong}>{fromLine}</Text>
          </Text>
        ) : null}
      </View>

      {/* WITH-ROW (native only) — Worlds Fleet chip */}
      {isNative && fleetChipLabel ? (
        <Pressable
          style={styles.withRow}
          onPress={onTapFleetChip}
          disabled={!onTapFleetChip}
        >
          <Text style={styles.withEye}>WITH</Text>
          <View style={styles.fleetChip}>
            <Anchor size={11} color={C.greenDeep} />
            <Text style={styles.fleetChipText}>{fleetChipLabel}</Text>
          </View>
        </Pressable>
      ) : null}

      {/* PHASE TABS */}
      <View style={styles.phaseRow}>
        <PhaseTab label="Plan" on={activePhase === 'plan'} />
        <PhaseTab label="Do" on={activePhase === 'do'} />
        <PhaseTab label="Reflect" on={activePhase === 'reflect'} />
        {isNative && onTapDiscussion ? (
          <Pressable onPress={onTapDiscussion}>
            <PhaseTab label="Discussion" on={activePhase === 'discussion'} />
          </Pressable>
        ) : null}
      </View>

      {/* BODY */}
      <View style={styles.body}>
        {/* AI helper (native only) */}
        {isNative ? (
          <Pressable
            style={styles.aiHelper}
            onPress={onTapAiHelper}
            disabled={!onTapAiHelper}
          >
            <Sparkles size={13} color={C.purpleDeep} />
            <Text style={styles.aiHelperText}>
              New to BetterAt?{' '}
              <Text style={styles.aiHelperStrong}>Let AI Coach walk you through Step 1</Text>
              {' →'}
            </Text>
          </Pressable>
        ) : null}

        {/* Field 1 — What */}
        <Field
          icon={<Lightbulb size={11} color={C.label3} />}
          eye="What will you do?"
          body={planWhatText ?? 'Sail your boat for one hour, recording target speeds on each point of sail in 8–12 kt of breeze…'}
        />

        {/* Field 2 — How / Capture */}
        {isNative ? (
          <Field
            icon={<Mic size={11} color={C.label3} />}
            eye="Capture · voice"
            body={planHowText ?? 'Tap the mic on the water — works offline, syncs back when you have signal.'}
          />
        ) : (
          <Field
            icon={<List size={11} color={C.label3} />}
            eye="How will you do it?"
            body={planHowText ?? "Sub-steps from Kevin's blueprint will appear here…"}
          />
        )}
      </View>

      {/* INSTALL HINT (web only) */}
      {!isNative ? (
        <View style={styles.installHint}>
          <Mic size={14} color={C.purple} />
          <Text style={styles.installHintText}>
            <Text style={styles.installHintStrong}>Voice capture</Text>
            {' works in the BetterAt app — install when you\'re heading out on the water.'}
            {typeof totalSailors === 'number' ? ` ${totalSailors} sailors are already here.` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PhaseTab({ label, on }: { label: string; on: boolean }) {
  return (
    <View style={[styles.ptab, on && styles.ptabOn]}>
      <Text style={[styles.ptabText, on && styles.ptabTextOn]}>{label}</Text>
    </View>
  );
}

function Field({
  icon,
  eye,
  body,
}: {
  icon: React.ReactNode;
  eye: string;
  body: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldEye}>
        {icon}
        <Text style={styles.fieldEyeText}>{eye}</Text>
      </View>
      <Text style={styles.placeholder}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 11,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  pillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.blueTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.blueStrong,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.blue,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.blueDeep,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  counter: {
    fontSize: 11,
    color: C.label3,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    backgroundColor: '#FAFAFC',
  },
  stripIco: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripText: {
    fontSize: 11,
    color: C.label2,
    flex: 1,
  },
  stripStrong: {
    color: C.label,
    fontWeight: '600',
  },
  stripSep: {
    color: C.label4,
  },
  stripChev: {
    marginLeft: 4,
  },
  titleBlock: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  pre: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.blue,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.35,
    lineHeight: 20,
  },
  from: {
    fontSize: 11,
    color: C.label3,
    marginTop: 5,
  },
  fromStrong: {
    color: C.label2,
    fontWeight: '500',
  },
  withRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    backgroundColor: '#FAFAFC',
  },
  withEye: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.label2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  fleetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.greenTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.greenSoft,
  },
  fleetChipText: {
    fontSize: 11,
    color: C.greenDeep,
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    backgroundColor: '#FAFAFC',
  },
  ptab: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
  },
  ptabOn: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  ptabText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: C.label3,
  },
  ptabTextOn: {
    color: C.blueDeep,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 9,
  },
  aiHelper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: C.purpleTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.purpleSoft,
    borderRadius: 11,
  },
  aiHelperText: {
    flex: 1,
    fontSize: 11,
    color: C.purpleDeep,
    letterSpacing: -0.05,
  },
  aiHelperStrong: {
    fontWeight: '600',
  },
  field: {
    backgroundColor: C.gray6,
    borderRadius: 11,
    padding: 12,
  },
  fieldEye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  fieldEyeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.label2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  placeholder: {
    fontSize: 12,
    color: C.label3,
    fontStyle: 'italic',
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  installHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(88,86,214,0.06)',
  },
  installHintText: {
    flex: 1,
    fontSize: 11,
    color: C.label2,
    letterSpacing: -0.05,
    lineHeight: 15,
  },
  installHintStrong: {
    color: C.purpleDeep,
    fontWeight: '600',
  },
});
