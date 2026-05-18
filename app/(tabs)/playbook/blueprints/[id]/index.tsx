import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, List } from 'lucide-react-native';
import { BlueprintTimeline } from '@/components/playbook/BlueprintTimeline';
import { useBlueprint } from '@/hooks/useBlueprint';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export default function BlueprintTimelineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const indexFlagOn = FEATURE_FLAGS.BLUEPRINT_INDEX_FLEET_V2;
  const { data: blueprint } = useBlueprint(id ?? '');

  const goAllSteps = useCallback(() => {
    if (!id) return;
    router.push(`/(tabs)/playbook/blueprints/${id}/all-steps` as any);
  }, [id]);

  if (!id) return null;

  const stepCount = (blueprint as { step_count?: number } | undefined)?.step_count ?? null;
  const ctaLabel =
    typeof stepCount === 'number'
      ? `View all ${stepCount} steps`
      : 'View all steps';

  return (
    <View style={styles.container}>
      {indexFlagOn ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={goAllSteps}
          accessibilityRole="button"
          accessibilityLabel="Open Blueprint Index"
        >
          <View style={styles.ctaIcon}>
            <List size={14} color="#0040DD" />
          </View>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
          <ChevronRight size={16} color="#7C7C82" />
        </Pressable>
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
  cta: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaPressed: {
    opacity: 0.85,
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
