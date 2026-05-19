/**
 * Q&A route — renders QAList.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { QAList } from '@/components/playbook/qa/QAList';
import { PlaybookBackLink } from '@/components/playbook/PlaybookBackLink';

export default function PlaybookQAScreen() {
  return (
    <View style={styles.container}>
      <PlaybookBackLink />
      <QAList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
