/**
 * SubscribedBlueprintStrip
 *
 * Compact strip on the Races/Timeline tab showing blueprints the user is
 * subscribed to for the current interest, with quick unsubscribe.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSubscribedBlueprints, useUnsubscribe } from '@/hooks/useBlueprint';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';

const C = {
  bg: 'rgba(37,99,235,0.04)',
  border: 'rgba(37,99,235,0.08)',
  accent: '#007AFF',
  accentLight: '#3B82F6',
  label: '#1A1918',
  labelMid: '#6D6C6A',
} as const;

interface SubscribedBlueprintStripProps {
  interestId?: string | null;
}

export function SubscribedBlueprintStrip({ interestId }: SubscribedBlueprintStripProps) {
  const { data: subscribed } = useSubscribedBlueprints(interestId);
  const unsubscribeMutation = useUnsubscribe();
  const router = useRouter();
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);

  const handleUnsubscribe = useCallback(
    (blueprintId: string, title: string) => {
      showConfirm(
        'Unsubscribe',
        `Stop receiving updates from "${title}"?`,
        async () => {
          setUnsubscribingId(blueprintId);
          try {
            await unsubscribeMutation.mutateAsync(blueprintId);
          } finally {
            setUnsubscribingId(null);
          }
        },
      );
    },
    [unsubscribeMutation],
  );

  if (!subscribed || subscribed.length === 0) return null;

  return (
    <View style={styles.strip}>
      {subscribed.map((bp) => (
        <View key={bp.subscription_id} style={styles.row}>
          <Pressable
            style={styles.info}
            onPress={() => router.push(`/blueprint/${bp.blueprint_slug}` as any)}
          >
            <Ionicons name="layers-outline" size={12} color={C.accent} />
            <Text style={styles.title} numberOfLines={1}>
              {bp.blueprint_title}
            </Text>
            {bp.author_name && (
              <Text style={styles.author} numberOfLines={1}>
                by {bp.author_name}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={styles.unsubBtn}
            onPress={() => handleUnsubscribe(bp.blueprint_id, bp.blueprint_title)}
            disabled={unsubscribingId === bp.blueprint_id}
          >
            <Text style={styles.unsubText}>
              {unsubscribingId === bp.blueprint_id ? 'Removing...' : 'Unsubscribe'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
    flexShrink: 1,
  },
  author: {
    fontSize: 11,
    color: C.labelMid,
    flexShrink: 0,
  },
  unsubBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  unsubText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.labelMid,
    textDecorationLine: 'underline',
  },
});
