/**
 * BlueprintStepRow — one row in the canonical Blueprint Index list.
 *
 * Renders the step number, title, meta line, and the right-edge affordance
 * based on status:
 *   - done     → green check + "Done" pill
 *   - current  → blue-ringed number + "Now" pill
 *   - added    → blue-tinted number + "In plan" pill (queued via + Add)
 *   - upcoming → gray number + "+ Add" button
 *
 * Pixel-parity to canonical §B-A.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Flag, Plus } from 'lucide-react-native';

export type BlueprintIndexStepStatus = 'done' | 'current' | 'upcoming' | 'added';

export interface BlueprintIndexStep {
  id: string;
  blueprintStepId: string;
  number: number;
  title: string;
  meta?: string;
  status: BlueprintIndexStepStatus;
}

export interface BlueprintStepRowProps {
  step: BlueprintIndexStep;
  pending?: boolean;
  onAdd?: () => void;
}

const C = {
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  blueStrong: '#A8C8FF',
  blueTint: '#E6F0FF',
  green: '#34C759',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
};

export function BlueprintStepRow({ step, pending = false, onAdd }: BlueprintStepRowProps) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.num,
          step.status === 'done' && styles.numDone,
          step.status === 'current' && styles.numCurrent,
          step.status === 'added' && styles.numAdded,
        ]}
      >
        {step.status === 'done' ? (
          <Check size={13} color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.numText,
              (step.status === 'current' || step.status === 'added') && styles.numTextLight,
            ]}
          >
            {step.number}
          </Text>
        )}
      </View>

      <View style={styles.mid}>
        <Text style={styles.ttl}>{step.title}</Text>
        {step.meta ? <Text style={styles.meta}>{step.meta}</Text> : null}
      </View>

      {step.status === 'done' ? (
        <View style={[styles.pill, styles.pillDone]}>
          <Check size={9} color={C.greenDeep} />
          <Text style={styles.pillTextDone}>Done</Text>
        </View>
      ) : step.status === 'current' ? (
        <View style={[styles.pill, styles.pillNow]}>
          <Flag size={9} color={C.blueDeep} />
          <Text style={styles.pillTextNow}>Now</Text>
        </View>
      ) : step.status === 'added' ? (
        <View style={[styles.pill, styles.pillNow]}>
          <Check size={9} color={C.blueDeep} />
          <Text style={styles.pillTextNow}>In plan</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.add, pending && styles.addBusy]}
          onPress={onAdd}
          disabled={pending || !onAdd}
          accessibilityRole="button"
        >
          <Plus size={12} color="#FFFFFF" />
          <Text style={styles.addText}>{pending ? 'Adding…' : 'Add'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numDone: {
    backgroundColor: C.green,
    borderColor: C.green,
  },
  numCurrent: {
    backgroundColor: C.blue,
    borderWidth: 3,
    borderColor: C.blueTint,
  },
  numAdded: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  numText: {
    color: C.label2,
    fontSize: 12,
    fontWeight: '700',
  },
  numTextLight: {
    color: '#FFFFFF',
  },
  mid: {
    flex: 1,
  },
  ttl: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  meta: {
    fontSize: 10.5,
    color: C.label3,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  add: {
    backgroundColor: C.blue,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addBusy: {
    opacity: 0.7,
  },
  addText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillDone: {
    backgroundColor: C.greenTint,
    borderColor: C.greenSoft,
  },
  pillNow: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  pillTextDone: {
    fontSize: 10,
    fontWeight: '700',
    color: C.greenDeep,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pillTextNow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.blueDeep,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
