import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, Mic, PencilLine, Ruler, Video } from 'lucide-react-native';
import type { FleetCaptureRow } from '@/services/FleetCaptureFeedService';

export interface FleetCaptureCardProps {
  capture: FleetCaptureRow;
}

function iconFor(kind: FleetCaptureRow['kind']) {
  switch (kind) {
    case 'voice':
      return Mic;
    case 'photo':
      return Camera;
    case 'video':
      return Video;
    case 'media_link':
      return Ruler;
    default:
      return PencilLine;
  }
}

export function FleetCaptureCard({ capture }: FleetCaptureCardProps) {
  const Icon = iconFor(capture.kind);
  const isMine = capture.authorIsMe;

  return (
    <View style={[styles.card, isMine ? styles.cardMine : styles.cardOthers]}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, isMine ? styles.avatarMine : styles.avatarOthers]}>
          <Text style={styles.avatarText}>{capture.authorInitials.slice(0, 2)}</Text>
        </View>
        <View style={styles.who}>
          <Text style={styles.whoName}>{isMine ? 'You' : capture.authorName}</Text>
          {capture.boatName ? <Text style={styles.whoBoat}>{capture.boatName}</Text> : null}
        </View>
        <Text style={styles.timestamp}>
          {new Date(capture.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.body}>
        {capture.kind === 'voice' ? `"${capture.body}"` : capture.body}
      </Text>
      <View style={styles.metaRow}>
        <Icon size={12} color="#6B7280" />
        <Text style={styles.metaText}>{capture.kindTag ?? capture.kind}</Text>
        <Text style={styles.metaSep}>·</Text>
        <Text style={styles.metaVisibility}>{capture.visibility}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    gap: 6,
    borderWidth: 1,
  },
  cardMine: {
    backgroundColor: 'rgba(255,107,107,0.07)',
    borderColor: '#FF6B6B',
  },
  cardOthers: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMine: {
    backgroundColor: '#FFE4E6',
  },
  avatarOthers: {
    backgroundColor: '#DBEAFE',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  who: {
    flex: 1,
  },
  whoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  whoBoat: {
    fontSize: 11,
    color: '#6B7280',
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  metaSep: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  metaVisibility: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
