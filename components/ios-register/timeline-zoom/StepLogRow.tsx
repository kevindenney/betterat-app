/**
 * Step log row — the single-column, card-less step representation used by
 * L3's THE WORK list. Matches mockup 19's unified-surface design: a leading
 * status glyph, the title (with an inline ✷ when reflected), and a meta line
 * of capability dots + people avatars + the status word. No card chrome —
 * rows are separated by a hairline so the list reads as a logbook, letting
 * the capability river above stay the visual anchor.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { StepStatus, TimelineStep } from './types';

const LILAC = '#9D70C9';
const NOW = '#FF6B5A';
const DONE_GREEN = '#5BA46F';
const ROW_DIVIDER = '#EDEAE0';

const ROW_STATUS: Record<StepStatus, { word: string; wordColor: string }> = {
  plan: { word: 'planned', wordColor: IOS_REGISTER.labelTertiary },
  do: { word: 'in progress', wordColor: NOW },
  reflect: { word: 'reflecting', wordColor: LILAC },
  reflected: { word: 'reflected', wordColor: IOS_REGISTER.labelSecondary },
  done: { word: 'done', wordColor: IOS_REGISTER.labelSecondary },
};

const GENERIC_CAP_LABELS = [
  'general',
  'practice',
  'planning',
  'plan',
  'do',
  'done',
  'reflect',
  'reflecting',
  'review',
];

interface StepLogRowProps {
  step: TimelineStep;
  /** Blue-outline emphasis for the focused / "came from" / selected row. */
  highlighted?: boolean;
  selected?: boolean;
  selectEnabled?: boolean;
  onPress?: () => void;
}

export function StepLogRow({
  step,
  highlighted,
  selected,
  selectEnabled,
  onPress,
}: StepLogRowProps) {
  const meta = ROW_STATUS[step.status];
  const isReflected = step.status === 'reflected';
  const capabilities = (step.capabilities ?? []).filter(
    (cap) => !GENERIC_CAP_LABELS.includes(cap.label.trim().toLowerCase()),
  );
  const people = step.cohortAvatars ?? [];

  const Container: React.ComponentType<any> = onPress ? Pressable : View;
  const containerProps = onPress ? { onPress } : {};

  return (
    <Container
      {...containerProps}
      style={[styles.row, highlighted && styles.rowHighlighted]}
    >
      <StatusGlyph
        status={step.status}
        selectEnabled={selectEnabled}
        selected={selected}
      />

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {step.title}
          {isReflected ? <Text style={styles.reflMark}> ✷</Text> : null}
        </Text>

        <View style={styles.meta}>
          {capabilities.length > 0 ? (
            <View style={styles.caps}>
              {capabilities.slice(0, 4).map((cap) => (
                <View
                  key={cap.id}
                  style={[styles.cdot, { backgroundColor: cap.color }]}
                />
              ))}
            </View>
          ) : null}

          {people.length > 0 ? (
            <View style={styles.ppl}>
              {people.slice(0, 4).map((person, i) => (
                <View
                  key={person.id}
                  style={[
                    styles.pdot,
                    { backgroundColor: person.color },
                    i > 0 && styles.pdotOverlap,
                  ]}
                >
                  <Text style={styles.pdotText}>{person.initials}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[styles.statusWord, { color: meta.wordColor }]}>
            {meta.word}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={15}
        color={IOS_REGISTER.labelTertiary}
        style={styles.chevron}
      />
    </Container>
  );
}

function StatusGlyph({
  status,
  selectEnabled,
  selected,
}: {
  status: StepStatus;
  selectEnabled?: boolean;
  selected?: boolean;
}) {
  if (selectEnabled) {
    return (
      <View style={[styles.glyph, selected ? styles.glyphSelected : styles.glyphSelectIdle]}>
        {selected ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
      </View>
    );
  }

  if (status === 'done') {
    return (
      <View style={[styles.glyph, styles.glyphDone]}>
        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
      </View>
    );
  }

  const ringColor =
    status === 'do'
      ? NOW
      : status === 'reflect' || status === 'reflected'
        ? LILAC
        : IOS_REGISTER.labelTertiary;
  const dashed = status === 'do' || status === 'reflect' || status === 'plan';

  return (
    <View
      style={[
        styles.glyph,
        { borderColor: ringColor, borderStyle: dashed ? 'dashed' : 'solid' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_DIVIDER,
    borderRadius: 8,
  },
  rowHighlighted: {
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
  },
  glyph: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.labelTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphDone: {
    backgroundColor: DONE_GREEN,
    borderColor: DONE_GREEN,
  },
  glyphSelectIdle: {
    borderColor: IOS_REGISTER.separatorStrong,
  },
  glyphSelected: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  reflMark: {
    color: LILAC,
    fontSize: 10,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  caps: {
    flexDirection: 'row',
    gap: 3,
  },
  cdot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  ppl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: IOS_REGISTER.groundBg,
  },
  pdotOverlap: {
    marginLeft: -3,
  },
  pdotText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '700',
  },
  statusWord: {
    fontSize: 10.5,
  },
  chevron: {
    opacity: 0.5,
  },
});
