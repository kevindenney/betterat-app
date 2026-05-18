/**
 * PeerCard — one row in the canonical Worlds Fleet list (§B-B).
 *
 * Avatar · name + club · activity line · status chip (Same step / Ahead /
 * Behind) · mini progress bar · "N/total" step tag.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, Check, Flag } from 'lucide-react-native';

export type FleetPeerStatus = 'same-step' | 'ahead' | 'behind';

export interface FleetPeer {
  id: string;
  initials: string;
  /** Same swatch set used elsewhere in the canonical. */
  avatarColorKey?: 'navy' | 'green' | 'purple' | 'brown' | 'gold';
  name: string;
  /** "RHKYC · HKG-12" */
  whereLine: string;
  /** "On Step 4 · Boat-speed baseline · captured 2 sessions" */
  activityLine: string;
  currentStepNumber: number;
  totalSteps: number;
  status: FleetPeerStatus;
}

export interface PeerCardProps {
  peer: FleetPeer;
  onPress?: () => void;
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
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
};

const AVATAR_BG: Record<NonNullable<FleetPeer['avatarColorKey']>, string> = {
  navy: '#4E6A85',
  green: '#3E6C4E',
  purple: '#5C3F7A',
  brown: '#4A3F2E',
  gold: '#8E6320',
};

export function PeerCard({ peer, onPress }: PeerCardProps) {
  const colorBg = AVATAR_BG[peer.avatarColorKey ?? 'navy'];
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round((peer.currentStepNumber / peer.totalSteps) * 100)),
  );

  const statusStyle =
    peer.status === 'same-step'
      ? styles.chipActive
      : peer.status === 'ahead'
        ? styles.chipAhead
        : styles.chipBehind;
  const statusText =
    peer.status === 'same-step'
      ? 'Same step'
      : peer.status === 'ahead'
        ? 'Ahead'
        : 'Behind you';
  const statusIcon =
    peer.status === 'same-step' ? (
      <Flag size={9} color={C.blueDeep} fill={C.blueDeep} />
    ) : peer.status === 'ahead' ? (
      <ArrowUp size={9} color={C.greenDeep} />
    ) : (
      <Check size={9} color={C.label2} />
    );
  const statusColor =
    peer.status === 'same-step'
      ? styles.statusTextActive
      : peer.status === 'ahead'
        ? styles.statusTextAhead
        : styles.statusTextBehind;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <View style={[styles.av, { backgroundColor: colorBg }]}>
        <Text style={styles.avText}>{peer.initials}</Text>
      </View>
      <View style={styles.mid}>
        <View style={styles.whoLine}>
          <Text style={styles.who}>{peer.name}</Text>
          <Text style={styles.where}>{peer.whereLine}</Text>
        </View>
        <Text style={styles.what}>{peer.activityLine}</Text>
      </View>
      <View style={styles.right}>
        <View style={[styles.statusChip, statusStyle]}>
          {statusIcon}
          <Text style={[styles.statusText, statusColor]}>{statusText}</Text>
        </View>
        <View style={styles.progressMini}>
          <View style={[styles.progressMiniBar, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.stepTag}>
          <Text style={styles.stepTagStrong}>{peer.currentStepNumber}</Text>/{peer.totalSteps}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mid: {
    flex: 1,
    gap: 4,
  },
  whoLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  who: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
  },
  where: {
    fontSize: 10.5,
    color: C.label3,
    letterSpacing: -0.05,
  },
  what: {
    fontSize: 11.5,
    color: C.label2,
    letterSpacing: -0.05,
    lineHeight: 16,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  chipAhead: {
    backgroundColor: C.greenTint,
    borderColor: C.greenSoft,
  },
  chipBehind: {
    backgroundColor: C.gray6,
    borderColor: C.line,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statusTextActive: {
    color: C.blueDeep,
  },
  statusTextAhead: {
    color: C.greenDeep,
  },
  statusTextBehind: {
    color: C.label2,
  },
  progressMini: {
    width: 62,
    height: 5,
    backgroundColor: C.line,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressMiniBar: {
    height: 5,
    backgroundColor: C.blue,
    borderRadius: 3,
  },
  stepTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.label3,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stepTagStrong: {
    color: C.label2,
  },
});
