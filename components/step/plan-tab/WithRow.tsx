/**
 * <WithRow> — quiet co-practice row beneath the title block.
 *
 * Phase 1 · iOS register · D12b. Crew avatars (1–3 then "+N") + fleet/cohort
 * chip. Sails: crew_user_ids + fleet_id; nursing: cohort_id. Always visible
 * when set; empty state shows "+ add crew" affordance only when explicitly
 * opted in by caller.
 *
 * Canonical: docs/redesign/ios-register/becoming-loop-canonical.html
 *            .with-row · line 260–296
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Anchor, Plus, Users } from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export interface WithRowCrew {
  id: string;
  initials: string;
  avatarColor?: string;
}

export interface WithRowProps {
  crew?: WithRowCrew[];
  /** "Fleet · 14 boats" or "Cohort · 23 peers" */
  fleetLabel?: string;
  fleetIcon?: 'anchor' | 'users';
  /** When true and no crew/fleet, render "+ add crew" affordance instead. */
  empty?: boolean;
  onCrewPress?: () => void;
  onFleetPress?: () => void;
  onAddCrewPress?: () => void;
  testID?: string;
}

const AV_PALETTE: { [key: string]: [string, string] } = {
  brown: ['#6B5E48', '#4A3F2E'],
  plum: ['#8A5C7A', '#5C3F52'],
  blue: ['#4E6A85', '#7C7B6E'],
};

function avatarColor(seed: string, override?: string): string {
  if (override) return override;
  const keys = Object.keys(AV_PALETTE);
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const key = keys[h % keys.length];
  return AV_PALETTE[key][0];
}

export function WithRow({
  crew,
  fleetLabel,
  fleetIcon = 'anchor',
  empty,
  onCrewPress,
  onFleetPress,
  onAddCrewPress,
  testID,
}: WithRowProps) {
  const crewList = crew ?? [];
  const hasContent = crewList.length > 0 || Boolean(fleetLabel);

  if (!hasContent) {
    if (!empty || !onAddCrewPress) return null;
    return (
      <View style={styles.row} testID={testID}>
        <Text style={styles.eye}>With</Text>
        <Pressable
          onPress={onAddCrewPress}
          accessibilityRole="button"
          accessibilityLabel="Add crew"
          hitSlop={6}
          style={styles.addCrew}
        >
          <Plus size={12} color={IOS_BLUE} />
          <Text style={styles.addCrewText}>add crew</Text>
        </Pressable>
      </View>
    );
  }

  const visibleCrew = crewList.slice(0, 3);
  const overflow = crewList.length - visibleCrew.length;
  const FleetIcon = fleetIcon === 'users' ? Users : Anchor;

  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.eye}>With</Text>
      {visibleCrew.length > 0 ? (
        <Pressable
          onPress={onCrewPress}
          accessibilityRole={onCrewPress ? 'button' : undefined}
          style={styles.avatars}
        >
          {visibleCrew.map((c, idx) => (
            <View
              key={c.id}
              style={[
                styles.av,
                { backgroundColor: avatarColor(c.id, c.avatarColor) },
                idx > 0 && styles.avOverlap,
              ]}
            >
              <Text style={styles.avText}>{c.initials.slice(0, 2).toUpperCase()}</Text>
            </View>
          ))}
          {overflow > 0 ? (
            <View style={[styles.av, styles.avOverlap, styles.avOverflow]}>
              <Text style={styles.avText}>{`+${overflow}`}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      {fleetLabel ? (
        <Pressable
          onPress={onFleetPress}
          accessibilityRole={onFleetPress ? 'button' : undefined}
          accessibilityLabel={fleetLabel}
          style={styles.fleet}
          hitSlop={4}
        >
          <FleetIcon size={12} color={LABEL_3} />
          <Text style={styles.fleetText} numberOfLines={1}>
            {fleetLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAFAFC',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  eye: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  avatars: {
    flexDirection: 'row',
  },
  av: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avOverlap: {
    marginLeft: -8,
  },
  avOverflow: {
    backgroundColor: '#8E8E93',
  },
  avText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fleet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  fleetText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LABEL_2,
    letterSpacing: -0.05,
  },
  addCrew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCrewText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_BLUE,
    letterSpacing: -0.05,
  },
});
