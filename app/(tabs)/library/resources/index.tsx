/**
 * Playbook → Resources
 *
 * Phase 2 mounts the existing LibraryManager under the /playbook/resources
 * route so users keep the exact current behavior after the nav rename.
 * Phase 5 replaces this with ported components/playbook/resources/* UI.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LibraryManager } from '@/components/library-resources/LibraryManager';
import { PlaybookBackLink } from '@/components/playbook/PlaybookBackLink';

export default function PlaybookResourcesScreen() {
  return (
    <View style={styles.container}>
      <PlaybookBackLink />
      <LibraryManager />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
