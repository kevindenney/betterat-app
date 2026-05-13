/**
 * DetailBottomSheet - Bottom Sheet for Detail Card Drill-Down
 *
 * Displays full detail cards (Conditions, Strategy, Rig, etc.) in a bottom sheet
 * when users tap on condensed info in the phase-based race cards.
 *
 * Uses Gluestack ActionSheet for iOS-native feel:
 * - Slides up from bottom
 * - Swipe down to dismiss
 * - Keeps race context visible above
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {
  renderDetailCardByType,
  createDetailCardsForRace,
  type RaceDataForDetailCards,
} from './detail-cards';
import type { DetailCardType } from '@/constants/navigationAnimations';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  systemBackground: '#FFFFFF',
};

// Detail type to title mapping
const DETAIL_TYPE_TITLES: Record<DetailCardType, string> = {
  conditions: 'Conditions',
  strategy: 'Strategy',
  rig: 'Rig Setup',
  course: 'Course',
  fleet: 'Fleet',
  regulatory: 'Regulatory',
  results: 'Results',
  analysis: 'Analysis',
  fleet_insights: 'Fleet Insights',
  learning: 'Key Takeaway',
};

export interface DetailBottomSheetProps {
  /** The type of detail card to show */
  type: DetailCardType | null;
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when sheet is closed */
  onClose: () => void;
  /** Race ID for the detail card */
  raceId: string;
  /** Race data for the detail card */
  raceData: RaceDataForDetailCards;
  /** Optional custom title override */
  customTitle?: string;
}

export function DetailBottomSheet({
  type,
  isOpen,
  onClose,
  raceId,
  raceData,
  customTitle,
}: DetailBottomSheetProps) {
  // Trigger haptic feedback when opening
  React.useEffect(() => {
    if (isOpen && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isOpen]);

  // Handle close with haptic
  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose]);

  // Don't render if no type selected
  if (!type) return null;

  // Find the card data for this type
  const cards = createDetailCardsForRace({
    ...raceData,
    id: raceId,
  });
  const card = cards.find((c) => c.type === type);

  // Get title
  const title = customTitle || DETAIL_TYPE_TITLES[type] || 'Details';

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%] bg-background-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={IOS_COLORS.gray} />
          </Pressable>
        </View>

        {/* Scrollable content with detail card */}
        <ActionsheetScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardContainer}>
            {card ? (
              renderDetailCardByType(card, 0, true, undefined, {
                isExpanded: true, // Always show expanded in sheet
                onToggle: undefined, // No toggle in sheet context
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No data available for this section.
                </Text>
              </View>
            )}
          </View>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    width: '100%',
    position: 'relative',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: IOS_COLORS.gray5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },
});

export default DetailBottomSheet;
