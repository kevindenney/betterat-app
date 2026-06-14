import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiscoverInterestsContent } from '@/components/discover/DiscoverInterestsContent';

export default function InterestsPage() {
  const Container = Platform.OS === 'web' ? View : SafeAreaView;
  const containerStyle =
    Platform.OS === 'web'
      ? [styles.container, styles.webContainer]
      : styles.container;

  return (
    <Container style={containerStyle}>
      <DiscoverInterestsContent toolbarOffset={Platform.OS === 'web' ? 32 : 16} />
    </Container>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  webContainer: ViewStyle;
}>({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
  },
  webContainer: {
    minHeight: '100vh' as any,
    width: '100%',
  },
});
