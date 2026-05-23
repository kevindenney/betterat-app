/**
 * Shared list shell for public-face drill-in surfaces.
 *
 * Each drill-in (full practice timeline, all capabilities, all of the
 * practice circle, all published, all events, concept history) is a single
 * section of one row type. The shell handles the nav chrome + back wiring
 * so the route files stay focused on row composition.
 */

import React, { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import {
  IOSDetailNavBar,
  IOSDetailSection,
  IOSOnlyNotice,
} from '@/components/discover/detail';

import { PUBLIC_FACE_GROUND_BG } from './PublicFacePrimitives';

export interface PublicFaceListShellProps {
  /** Practitioner first name — used for the section header ("Markus's timeline"). */
  firstName: string;
  /** Tiny centred context label in the nav bar — e.g. "Timeline", "Capabilities". */
  navContextLabel: string;
  /** Section header copy — e.g. "Practice timeline", "Capabilities at hand". */
  sectionHeader: string;
  /** Row children. */
  children: React.ReactNode;
  /** Empty-state copy when there's nothing to show. */
  emptyLabel?: string;
}

export function PublicFaceListShell(props: PublicFaceListShellProps) {
  if (Platform.OS === 'web') return <IOSOnlyNotice surface={props.navContextLabel} />;
  return <PublicFaceListShellInner {...props} />;
}

function PublicFaceListShellInner({
  firstName,
  navContextLabel,
  sectionHeader,
  children,
  emptyLabel,
}: PublicFaceListShellProps) {
  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/discover' as any);
  }, []);

  const hasChildren = React.Children.count(children) > 0;

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <IOSDetailNavBar
        backLabel={firstName}
        contextLabel={navContextLabel}
        onBack={onBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasChildren ? (
          <IOSDetailSection header={sectionHeader}>{children}</IOSDetailSection>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyLabel}>{emptyLabel ?? 'Nothing to show yet.'}</Text>
          </View>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: PUBLIC_FACE_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  empty: {
    paddingTop: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  emptyLabel: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
