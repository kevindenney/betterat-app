/**
 * StepBlueprintChrome — canonical §A-phase-5 chrome for a step that
 * came from a subscribed blueprint.
 *
 * Layout (top → bottom):
 *   1. Trophy strip:   "<BlueprintShortName> · Step N of M"  → Blueprint Index
 *   2. Title block:    "From <Author's Blueprint Title>"
 *   3. WITH-row chip:  "Fleet · N sailors"                    → Worlds Fleet
 *
 * Renders nothing when the step has no source_blueprint_id (i.e. the step
 * isn't part of a subscribed blueprint). The route owns data loading and
 * passes the resolved blueprint metadata as props.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Anchor, ChevronRight, Trophy } from 'lucide-react-native';

export interface StepBlueprintChromeProps {
  /** Short label shown on the trophy strip (e.g. "HKDW Prep"). */
  blueprintShortName: string;
  /** "Step N of M" or "Week N of M" — caller decides the unit. */
  positionLine: string;
  /** Full blueprint title — shown in the "From X" line. */
  blueprintTitle: string;
  /** Author display name — prefixed to the blueprint title. */
  authorName: string | null;
  /** Number of subscribers to display in the WITH-row chip. */
  fleetCount: number | null;
  /** Optional override for the fleet chip label. Defaults to "Fleet · N sailors". */
  fleetLabel?: string;
  onTapBlueprintStrip?: () => void;
  onTapFleetChip?: () => void;
}

export function StepBlueprintChrome({
  blueprintShortName,
  positionLine,
  blueprintTitle,
  authorName,
  fleetCount,
  fleetLabel,
  onTapBlueprintStrip,
  onTapFleetChip,
}: StepBlueprintChromeProps) {
  const computedFleetLabel =
    fleetLabel ??
    (typeof fleetCount === 'number'
      ? `Fleet · ${fleetCount} sailor${fleetCount === 1 ? '' : 's'}`
      : null);

  return (
    <View style={styles.wrap}>
      {/* Trophy strip */}
      <Pressable
        style={styles.strip}
        onPress={onTapBlueprintStrip}
        disabled={!onTapBlueprintStrip}
        accessibilityRole="button"
        accessibilityLabel={`Open ${blueprintShortName} blueprint`}
      >
        <View style={styles.stripIco}>
          <Trophy size={11} color={C.blue} />
        </View>
        <Text style={styles.stripText} numberOfLines={1}>
          <Text style={styles.stripStrong}>{blueprintShortName}</Text>
          <Text style={styles.stripSep}> · </Text>
          {positionLine}
        </Text>
        {onTapBlueprintStrip ? (
          <ChevronRight size={13} color={C.label3} />
        ) : null}
      </Pressable>

      {/* "From <Author's blueprint title>" */}
      <View style={styles.fromRow}>
        <Text style={styles.fromText} numberOfLines={2}>
          From{' '}
          <Text style={styles.fromStrong}>
            {authorName ? `${authorName}'s ` : ''}
            {blueprintTitle}
          </Text>
        </Text>
      </View>

      {/* WITH-row fleet chip */}
      {computedFleetLabel ? (
        <Pressable
          style={styles.withRow}
          onPress={onTapFleetChip}
          disabled={!onTapFleetChip}
          accessibilityRole="button"
          accessibilityLabel="Open Worlds Fleet"
        >
          <Text style={styles.withEye}>WITH</Text>
          <View style={styles.fleetChip}>
            <Anchor size={11} color={C.greenDeep} />
            <Text style={styles.fleetChipText} numberOfLines={1}>
              {computedFleetLabel}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const C = {
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  label4: '#C7C7CC',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueTint: '#E6F0FF',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FAFAFC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
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
    flex: 1,
    fontSize: 11,
    color: C.label2,
  },
  stripStrong: {
    color: C.label,
    fontWeight: '600',
  },
  stripSep: {
    color: C.label4,
  },
  fromRow: {
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  fromText: {
    fontSize: 11,
    color: C.label3,
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
});
