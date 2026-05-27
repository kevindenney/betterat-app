/**
 * CrewSparseList — logbook-style listing of INPUT contributions when
 * the chart would be too thin to read.
 *
 * The per-week PeerJourneyChart shines once you have 3+ peers spread
 * across multiple weeks. With one peer landing once, the chart is mostly
 * empty whitespace and the eye gets pulled to the NOW band instead of
 * the actual contribution. A list of "Name · role · week N" sentences
 * is what a sailor expects to see in a logbook.
 *
 * L3SeasonView decides which to render based on peers.length and total
 * contribution count.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonPeer } from './types';

interface Props {
  peers: SeasonPeer[];
  /** Total number of weeks in this arc — used for "week N of M" copy. */
  totalWeeks: number;
}

export function CrewSparseList({ peers, totalWeeks }: Props) {
  if (peers.length === 0) return null;
  return (
    <View style={styles.list}>
      {peers.map((peer) => {
        const totalCount = peer.weeklyAppearances.reduce((n, w) => n + w.count, 0);
        const displayName = peer.name?.trim() || `Peer ${peer.initials}`;
        const weekLabel = formatWeekLabel(peer, totalCount, totalWeeks);
        return (
          <View key={peer.id} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: peer.color }]}>
              <Text style={styles.avatarText}>
                {peer.initials.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                <Text style={styles.detailRole}>{peer.role ?? 'shaped this'}</Text>
                <Text style={styles.detailSep}> · </Text>
                <Text style={styles.detailWhen}>{weekLabel}</Text>
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatWeekLabel(
  peer: SeasonPeer,
  totalCount: number,
  totalWeeks: number,
): string {
  if (totalCount <= 1) {
    return `week ${peer.firstWeek}${totalWeeks ? ` of ${totalWeeks}` : ''}`;
  }
  const lastWeek = peer.weeklyAppearances[peer.weeklyAppearances.length - 1]?.weekNumber;
  if (lastWeek && lastWeek !== peer.firstWeek) {
    return `${totalCount} times · weeks ${peer.firstWeek}–${lastWeek}`;
  }
  return `${totalCount} times · week ${peer.firstWeek}`;
}

const styles = StyleSheet.create({
  list: {
    marginHorizontal: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 14.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  detail: {
    fontSize: 12,
  },
  detailRole: {
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
  },
  detailSep: {
    color: IOS_REGISTER.labelTertiary,
  },
  detailWhen: {
    color: IOS_REGISTER.labelTertiary,
  },
});
