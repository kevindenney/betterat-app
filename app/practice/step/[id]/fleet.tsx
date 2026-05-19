import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { FleetView } from '@/components/practice';
import { loadFleetCaptureFeed } from '@/services/FleetCaptureFeedService';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

const IOS_BLUE = '#007AFF';
const LABEL = '#1C1C1E';

export default function FleetViewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = React.useState<string>('all');

  const flagOn = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;

  const enabled = Boolean(id && user?.id && flagOn);

  const { data, isLoading } = useQuery({
    queryKey: ['phase8-fleet-feed', id, user?.id],
    queryFn: () => loadFleetCaptureFeed({ viewerUserId: user!.id, stepId: id! }),
    enabled,
  });

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data.rows;
    if (activeFilter === 'mine') return data.rows.filter((r) => r.authorIsMe);
    if (activeFilter === 'others') return data.rows.filter((r) => !r.authorIsMe);
    return data.rows;
  }, [data, activeFilter]);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen
          options={{
            title: 'Fleet view',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
                <ChevronLeft size={20} color={IOS_BLUE} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ),
          }}
        />
        <Text style={styles.disabledTitle}>Fleet view is part of an upcoming refresh.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Fleet view',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <ChevronLeft size={20} color={IOS_BLUE} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        }}
      />

      {isLoading || !data ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FleetView
          step={{
            id,
            title: data.anchorStep?.title ?? 'Fleet view',
            settledLabel: data.anchorStep?.completed_at
              ? new Date(data.anchorStep.completed_at).toLocaleDateString()
              : 'Settled',
            eventLabel: data.anchorStep?.location_name ?? 'Shared event',
          }}
          stats={data.summary}
          filterChips={[
            { id: 'all', label: 'All', count: data.summary.captures },
            { id: 'mine', label: 'Yours', count: data.summary.yours },
            { id: 'others', label: 'Others', count: data.summary.captures - data.summary.yours },
          ]}
          activeFilterIds={[activeFilter]}
          onFilterToggle={(id) => setActiveFilter(id)}
          captures={filtered}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 15,
    color: IOS_BLUE,
    marginLeft: -2,
  },
  disabled: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LABEL,
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
