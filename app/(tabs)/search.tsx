/**
 * Search Tab Screen - Strava-style search with Sailors/Clubs tabs
 *
 * Two main segments:
 * - Sailors: Find and follow sailors (sub-tabs: Suggested, Contacts, QR Code)
 * - Clubs: Find and join clubs with filters
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { TabScreenToolbar, type ToolbarAction } from '@/components/ui/TabScreenToolbar';
import { SailorSearchContent } from '@/components/search/SailorSearchContent';
import { ClubSearchContent } from '@/components/search/ClubSearchContent';
import { OrganizationSearchContent } from '@/components/search/OrganizationSearchContent';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

type SearchSegment = 'sailors' | 'clubs';

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const [activeSegment, setActiveSegment] = useState<SearchSegment>('sailors');
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll } = useScrollToolbarHide();
  const eventConfig = useInterestEventConfig();
  const isSailing = eventConfig.interestSlug === 'sail-racing';
  const segments = useMemo(() => ([
    {value: 'sailors' as const, label: isSailing ? 'Sailors' : 'People'},
    {value: 'clubs' as const, label: isSailing ? 'Clubs' : 'Organizations'},
  ]), [isSailing]);

  // Toolbar actions (none — Search is a primary tab now)
  const toolbarActions: ToolbarAction[] = useMemo(() => [], []);

  return (
    <View style={styles.container}>
      <TabScreenToolbar
        topInset={insets.top}
        actions={toolbarActions}
        onMeasuredHeight={setToolbarHeight}
        hidden={toolbarHidden}
      >
        <View style={styles.segmentContainer}>
          <IOSSegmentedControl<SearchSegment>
            segments={segments}
            selectedValue={activeSegment}
            onValueChange={setActiveSegment}
          />
        </View>
      </TabScreenToolbar>

      {activeSegment === 'sailors' && (
        <SailorSearchContent
          toolbarOffset={toolbarHeight}
          onScroll={handleScroll}
        />
      )}
      {activeSegment === 'clubs' && (
        isSailing ? (
          <ClubSearchContent
            toolbarOffset={toolbarHeight}
            onScroll={handleScroll}
          />
        ) : (
          <OrganizationSearchContent
            toolbarOffset={toolbarHeight}
            onScroll={handleScroll}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
