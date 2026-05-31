/**
 * <PeopleZone> — Library People zone landing.
 *
 * Lists everyone the current user follows with last-activity line and a
 * mutual-signal badge. Tap a row → followee profile route. (Followee
 * timeline scoping per D29 lands when the dedicated timeline route ships;
 * for now we route to the existing profile page.)
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useFollowedPeopleForLibrary } from '@/hooks/useFollowedPeopleForLibrary';
import { PersonRowCard } from '@/components/library/people/PersonRowCard';
import { useVocabulary } from '@/hooks/useVocabulary';

export function PeopleZone() {
  const { data: people, isLoading } = useFollowedPeopleForLibrary();
  const { vocab } = useVocabulary();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }

  if (!people || people.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="people-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Not following anyone yet</Text>
        <Text style={styles.emptyBlurb}>
          Follow {vocab('Peers')} and {vocab('Coaches').toLowerCase()} from Watch, and
          their timelines will surface here with the latest thing they've done.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {people.map((person) => (
        <PersonRowCard
          key={person.userId}
          person={person}
          onPress={() => router.push(`/sailor/${person.userId}` as never)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  loading: {
    paddingVertical: IOS_SPACING.xl,
    alignItems: 'center',
  },
  empty: {
    margin: IOS_SPACING.lg,
    padding: IOS_SPACING.lg,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
