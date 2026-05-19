/**
 * Reviews route — renders ReviewsList.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ReviewsList } from '@/components/playbook/reviews/ReviewsList';
import { PlaybookBackLink } from '@/components/playbook/PlaybookBackLink';

export default function PlaybookReviewsScreen() {
  return (
    <View style={styles.container}>
      <PlaybookBackLink />
      <ReviewsList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
