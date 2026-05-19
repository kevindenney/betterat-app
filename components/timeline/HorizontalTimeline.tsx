import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { NowDivider } from './NowDivider';
import { StepCardH } from './StepCardH';
import type { StepCardH as StepCardHData } from './types';

interface Props {
  cards: StepCardHData[];
  /** User's own timeline → long-press menu (Move L/R), drag handle visible. */
  editable?: boolean;
  /** Read-only views → "+ Add to my timeline" CTA on each card. */
  showAdopt?: boolean;
  onCardPress?: (id: string) => void;
  onAdopt?: (id: string) => void;
  onReorder?: (id: string, direction: 'left' | 'right') => void;
}

/**
 * Horizontal step-card timeline (D31). Done left, NOW divider in the middle,
 * Planned right. Auto-centers the NOW divider on mount via `scrollTo` math.
 * Long-press a card in editable mode → menu with Move Left / Move Right.
 */
export function HorizontalTimeline({
  cards,
  editable = false,
  showAdopt = false,
  onCardPress,
  onAdopt,
  onReorder,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const nowOffsetRef = useRef<number>(0);
  const containerWidthRef = useRef<number>(0);

  // Compute split index — first non-done card is where NOW lands.
  const nowIndex = cards.findIndex((c) => c.state !== 'done');
  const splitIdx = nowIndex === -1 ? cards.length : nowIndex;

  const autoCenter = useCallback(() => {
    const w = containerWidthRef.current;
    const x = nowOffsetRef.current;
    if (!w || !x) return;
    const target = Math.max(0, x - w / 2 + 16);
    scrollRef.current?.scrollTo({ x: target, animated: false });
  }, []);

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      containerWidthRef.current = e.nativeEvent.layout.width;
      autoCenter();
    },
    [autoCenter]
  );

  const handleNowLayout = useCallback(
    (e: LayoutChangeEvent) => {
      nowOffsetRef.current = e.nativeEvent.layout.x;
      autoCenter();
    },
    [autoCenter]
  );

  useEffect(() => {
    // Re-center on cards change.
    const id = setTimeout(autoCenter, 0);
    return () => clearTimeout(id);
  }, [cards, autoCenter]);

  const handleLongPress = useCallback(
    (cardId: string, idx: number) => {
      if (!editable) return;
      Alert.alert('Move step', undefined, [
        {
          text: 'Move left',
          onPress: () => onReorder?.(cardId, 'left'),
          style: idx === 0 ? 'cancel' : 'default',
        },
        {
          text: 'Move right',
          onPress: () => onReorder?.(cardId, 'right'),
          style: idx === cards.length - 1 ? 'cancel' : 'default',
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [editable, cards.length, onReorder]
  );

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        decelerationRate="normal"
      >
        {cards.map((card, idx) => {
          const elements: React.ReactNode[] = [];
          if (idx === splitIdx && splitIdx > 0) {
            elements.push(
              <View key="now" onLayout={handleNowLayout}>
                <NowDivider />
              </View>
            );
          }
          elements.push(
            <StepCardH
              key={card.id}
              card={card}
              editable={editable}
              showAdopt={showAdopt}
              onPress={() => onCardPress?.(card.id)}
              onLongPress={() => handleLongPress(card.id, idx)}
              onAdopt={() => onAdopt?.(card.id)}
            />
          );
          return elements;
        })}
        {splitIdx === cards.length && cards.length > 0 ? (
          <View onLayout={handleNowLayout}>
            <NowDivider />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  track: {
    paddingHorizontal: 14,
    gap: 10,
    alignItems: 'stretch',
  },
});
