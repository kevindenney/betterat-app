/**
 * ResourcesZone — Library tab Resources zone (Emily Phone 1).
 * - "Drop something in" capture entry (opens capture sheet, Wave 2f)
 * - "In play this week" horizontal shelf
 * - "Recently added" vertical list
 * - "Collections" horizontal shelf of named bundles
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { LibraryItemCard } from './LibraryItemCard';
import { RecentItemRow } from './RecentItemRow';
import { CollectionsRow } from './CollectionsRow';
import { CaptureSheet } from './CaptureSheet';
import type { CollectionCard, LibraryItemRow } from './types';

// Wave 2e demo data — Emily's MSN Capstone library.
const IN_PLAY: LibraryItemRow[] = [
  {
    id: 'aacn-sepsis',
    format: 'pdf',
    source: 'AACN Practice Alert',
    title: 'Severe sepsis & septic shock',
    meta: '8 pages',
    active: true,
  },
  {
    id: 'bates-cardio',
    format: 'video',
    source: "Bates' video series",
    title: 'Cardiovascular exam, bedside',
    meta: '12 min',
    active: true,
  },
  {
    id: 'bates-ch8',
    format: 'book',
    source: "Bates' Guide · 13e",
    title: 'Ch 8 · Cardiovascular system',
    meta: '3 marks',
  },
  {
    id: 'nejm-egdt',
    format: 'link',
    source: 'NEJM · 2001',
    title: 'Early goal-directed therapy in sepsis',
    meta: '5 min read',
  },
  {
    id: 'curbsiders-lactate',
    format: 'audio',
    source: 'Curbsiders #441',
    title: 'Lactate, demystified',
    meta: '54 min',
  },
];

const RECENT: LibraryItemRow[] = [
  {
    id: 'jhh-code-blue',
    format: 'pdf',
    source: '',
    title: 'JHH Code Blue 2025 · pocket card',
    capturedFrom: 'Uploaded',
    capturedAt: '2 hr ago',
    topicTag: 'Sepsis & rapid response',
  },
  {
    id: 'piv-ultrasound',
    format: 'video',
    source: '',
    title: 'Bedside ultrasound for PIV access',
    capturedFrom: 'From YouTube',
    capturedAt: 'Yesterday',
    topicTag: 'Krista Murphy DNP',
  },
  {
    id: 'lactate-clearance',
    format: 'link',
    source: '',
    title: "When lactate doesn't fall: re-examining clearance",
    capturedFrom: 'From Annals of EM',
    capturedAt: 'Sunday',
  },
];

const COLLECTIONS: CollectionCard[] = [
  {
    id: 'sepsis',
    name: 'Sepsis & rapid response',
    itemCount: 12,
    formatStrip: ['pdf', 'link', 'video', 'audio'],
  },
  {
    id: 'cardiac',
    name: 'Cardiac & telemetry',
    itemCount: 18,
    formatStrip: ['book', 'video', 'pdf'],
  },
  {
    id: 'peds',
    name: 'Pediatric vitals & meds',
    itemCount: 9,
    formatStrip: ['pdf', 'link'],
  },
  {
    id: 'pharm',
    name: 'High-alert pharmacology',
    itemCount: 14,
    formatStrip: ['book', 'pdf', 'note'],
  },
];

interface Props {
  /** Optional external open trigger; if not provided the zone opens its own sheet. */
  onOpenCapture?: () => void;
}

export function ResourcesZone({ onOpenCapture }: Props) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const openItem = (id: string) => router.push(`/library/items/${id}` as any);
  const handleOpenCapture = () => {
    if (onOpenCapture) onOpenCapture();
    else setCaptureOpen(true);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Library</Text>
        <View style={styles.metaRow}>
          <View style={styles.interestDot} />
          <Text style={styles.metaText}>MSN Capstone</Text>
          <Text style={styles.metaSep}>·</Text>
          <Text style={styles.metaText}>84 items</Text>
          <Text style={styles.metaSep}>·</Text>
          <Text style={styles.metaText}>12 in active steps</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleOpenCapture}
        activeOpacity={0.6}
        style={styles.dropin}
      >
        <View style={styles.dropinIcon}>
          <Ionicons name="sparkles" size={16} color="#5C2DAA" />
        </View>
        <View style={styles.dropinCopy}>
          <Text style={styles.dropinHead}>Drop something in</Text>
          <Text style={styles.dropinSub}>
            Link, PDF, photo of a page, audio · or paste text
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
      </TouchableOpacity>

      <ShelfHead title="In play this week" count={IN_PLAY.length} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfTrack}
      >
        {IN_PLAY.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            onPress={() => openItem(item.id)}
          />
        ))}
      </ScrollView>

      <ShelfHead title="Recently added" />
      <View style={styles.recentBlock}>
        {RECENT.map((item) => (
          <RecentItemRow
            key={item.id}
            item={item}
            onPress={() => openItem(item.id)}
          />
        ))}
      </View>

      <ShelfHead title="Collections" topPad={IOS_SPACING.lg} />
      <CollectionsRow collections={COLLECTIONS} />

      <View style={styles.bottomPad} />
      <CaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
      />
    </ScrollView>
  );
}

function ShelfHead({
  title,
  count,
  topPad,
}: {
  title: string;
  count?: number;
  topPad?: number;
}) {
  return (
    <View style={[styles.shelfHead, topPad ? { paddingTop: topPad } : null]}>
      <Text style={styles.shelfTitle}>
        {title}
        {count != null ? <Text style={styles.shelfCount}>  {count}</Text> : null}
      </Text>
      <TouchableOpacity hitSlop={8} activeOpacity={0.6}>
        <Text style={styles.seeAll}>All</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  titleBlock: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.sm,
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: IOS_COLORS.label,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  interestDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#34C759',
    marginRight: 3,
  },
  metaText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  metaSep: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: 1,
  },
  dropin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: IOS_SPACING.lg,
    marginVertical: IOS_SPACING.sm,
    padding: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  dropinIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropinCopy: {
    flex: 1,
  },
  dropinHead: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  dropinSub: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: 6,
  },
  shelfTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  shelfCount: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  shelfTrack: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: 10,
    paddingVertical: 6,
  },
  recentBlock: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  bottomPad: {
    height: 32,
  },
});
