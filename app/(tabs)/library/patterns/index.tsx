/**
 * Patterns route — renders PatternsList.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PatternsList } from '@/components/playbook/patterns/PatternsList';
import { PlaybookBackLink } from '@/components/playbook/PlaybookBackLink';

export default function PlaybookPatternsScreen() {
  return (
    <View style={styles.container}>
      <PlaybookBackLink />
      <PatternsList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
