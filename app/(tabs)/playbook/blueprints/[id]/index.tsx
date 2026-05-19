import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, List } from 'lucide-react-native';
import { BlueprintTimeline } from '@/components/playbook/BlueprintTimeline';
import { useBlueprint } from '@/hooks/useBlueprint';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

/**
 * Playbook blueprint detail route — adds the "View all N steps" entry
 * point above the existing BlueprintTimeline when the canonical Blueprint
 * Index is enabled (BLUEPRINT_INDEX_FLEET_V2).
 *
 * The card is a plain View (Pressable was silently dropping its
 * backgroundColor + border render despite reporting correct layout).
 * Touch is provided by a sibling Pressable at StyleSheet.absoluteFill.
 */
export default function BlueprintTimelineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const indexFlagOn = FEATURE_FLAGS.BLUEPRINT_INDEX_FLEET_V2;
  const { data: blueprint } = useBlueprint(id ?? '');

  const goAllSteps = useCallback(() => {
    if (!id) return;
    router.push(`/(tabs)/playbook/blueprints/${id}/all-steps` as any);
  }, [id]);

  if (!id) return null;

  const stepCount = (blueprint as { step_count?: number } | undefined)?.step_count ?? null;
  const ctaLabel =
    typeof stepCount === 'number' ? `View all ${stepCount} steps` : 'View all steps';

  return (
    <View style={styles.container}>
      {indexFlagOn ? (
        <View style={[styles.ctaWrap, { marginTop: insets.top + 8 }]}>
          <View style={styles.ctaCard}>
            <View style={styles.ctaIcon}>
              <List size={14} color="#0040DD" />
            </View>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <ChevronRight size={16} color="#7C7C82" />
          </View>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={goAllSteps}
            accessibilityRole="button"
            accessibilityLabel="Open Blueprint Index"
          />
        </View>
      ) : null}
      <BlueprintTimeline blueprintId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  ctaWrap: {
    marginHorizontal: 14,
    marginBottom: 6,
    position: 'relative',
  },
  ctaCard: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7D9DE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  ctaIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
});
