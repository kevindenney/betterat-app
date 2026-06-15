import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInterest } from '@/providers/InterestProvider';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';

export default function PlaybookBlueprintsListRoute() {
  const insets = useSafeAreaInsets();
  const { currentInterest } = useInterest();
  const { data: blueprints = [] } = useSubscribedBlueprints(currentInterest?.id);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 12,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24,
        },
      ]}
    >
      <Pressable
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/(tabs)/library' as any)
        }
        accessibilityRole="button"
        accessibilityLabel="Back to Library"
        hitSlop={8}
        style={styles.backLink}
      >
        <Ionicons name="chevron-back" size={18} color="#007AFF" />
        <Text style={styles.backText}>Library</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Library</Text>
        <Text style={styles.title}>Blueprints you've subscribed to</Text>
        <Text style={styles.subtitle}>
          Subscribed timelines you can add into your own practice.
        </Text>
      </View>

      {blueprints.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={28} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No blueprints yet</Text>
          <Text style={styles.emptyBody}>
            Subscribe to a coach- or org-published plan to see it here — then add
            its steps one at a time into your own practice.
          </Text>
          <Pressable
            style={styles.emptyCta}
            onPress={() => router.push('/(tabs)/library?zone=follow' as any)}
            accessibilityRole="button"
            accessibilityLabel="Find a plan to follow"
          >
            <Ionicons name="search" size={16} color="#FFFFFF" />
            <Text style={styles.emptyCtaText}>Find a plan</Text>
          </Pressable>
        </View>
      ) : (
        blueprints.map((blueprint) => (
          <Pressable
            key={blueprint.blueprint_id}
            style={styles.card}
            onPress={() => router.push(`/(tabs)/library/blueprints/${blueprint.blueprint_id}` as any)}
          >
            <Text style={styles.cardTitle}>{blueprint.blueprint_title}</Text>
            <Text style={styles.cardMeta}>
              {blueprint.author_name ?? 'Author unknown'} · subscribed{' '}
              {new Date(blueprint.subscribed_at).toLocaleDateString()}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#6D5EF7',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
