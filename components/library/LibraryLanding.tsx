/**
 * LibraryLanding — Library tab shell.
 *
 * Canonical §2/§6 layout:
 *   - Library hero (h1 + lede)
 *   - Segmented zone header (All · Plans · People · Concepts · Resources)
 *     with per-zone counts
 *   - Zone body: All renders four condensed sections; the per-zone tabs
 *     render their own landings.
 *
 * The Concepts zone still embeds the legacy PlaybookLanding via the
 * `conceptsBody` prop — that surface keeps its existing internals for
 * now and will get a focused refactor once Plans + People zones are
 * fully wired.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { LibraryHero } from '@/components/library/LibraryHero';
import {
  SegmentedZoneHeader,
  type LibraryZone,
} from '@/components/library/SegmentedZoneHeader';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { useInterest } from '@/providers/InterestProvider';

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

  const { currentInterest } = useInterest();
  const { data: counts } = useLibraryCounts(currentInterest?.id);

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <LibraryHero interestName={currentInterest?.name} />
        <SegmentedZoneHeader
          zone={zone}
          onChange={handleZoneChange}
          counts={counts}
        />
      </View>
      {zone === 'all' ? (
        <ScrollView style={styles.body}>
          <AllZone counts={counts} onJumpToZone={handleZoneChange} />
        </ScrollView>
      ) : zone === 'plans' ? (
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
