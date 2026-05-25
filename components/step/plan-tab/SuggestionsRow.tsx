/**
 * <SuggestionsRow> — 3-row "Suggested new steps" list on Plan.
 *
 * Phase 1 · iOS register · D12a. Renders blueprint / follow / mentor
 * suggestions ranked by recency+relevance, capped at 3. Empty state hides
 * the whole section.
 *
 * Canonical: docs/redesign/ios-register/becoming-loop-canonical.html
 *            .suggestions-section + .suggestion-row · line 432–483
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, FileText, Sparkles, User } from 'lucide-react-native';
import {
  GRAY_3,
  GRAY_5,
  IOS_BLUE,
  IOS_BLUE_DEEP,
  IOS_BLUE_TINT,
  IOS_PURPLE_DEEP,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export type SuggestionKind = 'blueprint' | 'follow' | 'mentor';

export interface SuggestionRowItem {
  id: string;
  kind: SuggestionKind;
  title: string;
  /** "Sam Cooke · blueprint you follow" */
  subtitle: string;
  onPress: () => void;
}

export interface SuggestionsRowProps {
  items: SuggestionRowItem[];
  onSeeAll?: () => void;
  testID?: string;
}

function IconForKind({ kind }: { kind: SuggestionKind }) {
  if (kind === 'blueprint') {
    return (
      <View style={[styles.icBg, { backgroundColor: IOS_BLUE_TINT }]}>
        <FileText size={12} color={IOS_BLUE_DEEP} />
      </View>
    );
  }
  if (kind === 'mentor') {
    return (
      <View style={[styles.icBg, { backgroundColor: IOS_PURPLE_TINT }]}>
        <Sparkles size={12} color={IOS_PURPLE_DEEP} />
      </View>
    );
  }
  return (
    <View style={[styles.icBg, { backgroundColor: GRAY_5 }]}>
      <User size={12} color={LABEL_2} />
    </View>
  );
}

export function SuggestionsRow({ items, onSeeAll, testID }: SuggestionsRowProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.eyeText}>Suggested new steps</Text>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel="See all suggestions"
            hitSlop={6}
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={12} color={IOS_BLUE} />
          </Pressable>
        ) : null}
      </View>
      <View>
        {items.slice(0, 3).map((item, idx) => {
          const isLast = idx === Math.min(items.length, 3) - 1;
          return (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={[styles.row, isLast && styles.rowLast]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <IconForKind kind={item.kind} />
              <View style={styles.copy}>
                <Text style={styles.ttl} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <ChevronRight size={13} color={GRAY_3} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    marginTop: 4,
    paddingTop: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  eyeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_BLUE,
    letterSpacing: -0.05,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icBg: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  ttl: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.1,
    lineHeight: 15,
  },
  sub: {
    fontSize: 10.5,
    color: LABEL_3,
    letterSpacing: -0.02,
    marginTop: 1,
  },
});
