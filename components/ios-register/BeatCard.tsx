/**
 * BeatCard — white rounded-rect for a named planning section ("Start",
 * "First beat", "Contingency" in sailing; "Briefing", "Shift", "Debrief"
 * in clinical; etc.).
 *
 * Header: 22pt semibold title with optional right-meta. Hairline divider.
 * Body: 17pt prose. Optional embedded photo floats right; optional
 * permission-rule callout slot via `children`.
 *
 * Per-interest beat naming flows through the existing plan-question
 * vocabulary system — BeatCard is the visual shell, not a new data
 * concept. See docs/redesign/IOS_MIGRATION_PLAN.md decision #3.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

interface Props {
  title: string;
  meta?: string;
  children: React.ReactNode;
  /** Optional 132x88 thumbnail floated to the right at the body's start */
  embedPhoto?: React.ReactNode;
}

export function BeatCard({ title, meta, children, embedPhoto }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.body}>
        {embedPhoto ? (
          <View style={styles.embedRow}>
            <View style={styles.embedPhoto}>{embedPhoto}</View>
            <View style={styles.embedAdjacent}>{children}</View>
          </View>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/**
 * BeatBody — 17pt prose paragraph for use inside BeatCard. Use multiple
 * stacked BeatBody nodes for multi-paragraph bodies; the spacing is
 * managed here.
 */
export function BeatBody({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bodyText}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingRight: 18,
    paddingBottom: 12,
    paddingLeft: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    ...IOS_REGISTER_TEXT.beatHeader,
    color: IOS_REGISTER.label,
  },
  meta: {
    ...IOS_REGISTER_TEXT.beatMeta,
    color: IOS_REGISTER.labelSecondary,
  },
  body: {
    paddingTop: 14,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
  },
  bodyText: {
    ...IOS_REGISTER_TEXT.beatBody,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  // Embedded photo layout — RN can't float, so we use a side-by-side row.
  embedRow: {
    flexDirection: 'row',
    gap: 14,
  },
  embedPhoto: {
    width: 132,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  embedAdjacent: {
    flex: 1,
    minWidth: 0,
  },
});
