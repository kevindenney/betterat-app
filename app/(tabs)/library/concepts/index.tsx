/**
 * Concepts list route — renders ConceptList grid for current interest.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ConceptList } from '@/components/playbook/concepts/ConceptList';
import { PlaybookBackLink } from '@/components/playbook/PlaybookBackLink';

export default function PlaybookConceptsScreen() {
  return (
    <View style={styles.container}>
      <PlaybookBackLink />
      <ConceptList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
