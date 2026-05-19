/**
 * LibraryLanding — Wave 1 wrapper.
 *
 * Adds the 4-zone segmented header (All / Plans / People / Concepts /
 * Resources) above the existing Concepts content. Tapping a chip updates
 * the `?zone=` URL param.
 *
 * Wave 1 scope: header + URL plumbing + empty scaffolds for the three
 * new zones. Concepts content is the existing landing variants (gated by
 * feature flags). Wave 2 replaces this with real Plans/People/Resources
 * content.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  SegmentedZoneHeader,
  type LibraryZone,
} from '@/components/library/SegmentedZoneHeader';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';

const VALID_ZONES: LibraryZone[] = ['all', 'plans', 'people', 'concepts', 'resources'];

interface Props {
  /** Renders the Concepts/All zone body. Existing PlaybookLanding variants. */
  conceptsBody: React.ReactNode;
}

export function LibraryLanding({ conceptsBody }: Props) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ zone?: string }>();
  const rawZone = Array.isArray(params.zone) ? params.zone[0] : params.zone;
  const zone: LibraryZone =
    rawZone && (VALID_ZONES as string[]).includes(rawZone)
      ? (rawZone as LibraryZone)
      : 'all';

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <SegmentedZoneHeader zone={zone} onChange={handleZoneChange} />
      </View>
      {zone === 'plans' ? (
        <ScrollView style={styles.body}>
          <PlansZone />
        </ScrollView>
      ) : zone === 'people' ? (
        <ScrollView style={styles.body}>
          <PeopleZone />
        </ScrollView>
      ) : zone === 'resources' ? (
        <ScrollView style={styles.body}>
          <ResourcesZone />
        </ScrollView>
      ) : (
        <View style={styles.body}>{conceptsBody}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  headerWrap: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  body: {
    flex: 1,
  },
});
