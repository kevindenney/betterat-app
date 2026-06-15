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
import { fontFamily } from '@/lib/design-tokens-editorial';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useToast } from '@/components/ui/AppToast';
import { hapticSuccess } from '@/lib/haptics';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { useLibraryZonesData } from '@/hooks/useLibraryZonesData';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { useInterest } from '@/providers/InterestProvider';
import { LibraryItemCard } from './LibraryItemCard';
import { RecentItemRow } from './RecentItemRow';
import { CollectionsRow } from './CollectionsRow';
import { CaptureSheet } from './CaptureSheet';
import { mapCapturePayloadToLibraryItem } from './capturePayloadMap';
import { DEMO_COLLECTIONS, DEMO_IN_PLAY, DEMO_RECENT } from './demoZonesData';

interface Props {
  /** Optional external open trigger; if not provided the zone opens its own sheet. */
  onOpenCapture?: () => void;
}

export function ResourcesZone({ onOpenCapture }: Props) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const { currentInterest } = useInterest();
  const toast = useToast();
  const createLibraryItem = useCreateLibraryItem();
  const { data: zones } = useLibraryZonesData(currentInterest?.id);
  const { data: counts } = useLibraryCounts(currentInterest?.id);

  // Demo content stands in only when the account is completely empty so
  // the JHU/MSN-Capstone screenshots keep working on a fresh account. Any
  // real capture flips the zone to live data for that interest.
  const isEmpty = zones ? !zones.hasAnyItems : false;
  const inPlay = isEmpty ? DEMO_IN_PLAY : (zones?.inPlay ?? []);
  const recent = isEmpty ? DEMO_RECENT : (zones?.recent ?? []);
  const collections = isEmpty
    ? DEMO_COLLECTIONS
    : (zones?.collections ?? []);

  const interestName = currentInterest?.name ?? 'Your library';
  const itemCount = counts?.resources;
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
          <Text style={styles.metaText}>{interestName}</Text>
          {typeof itemCount === 'number' ? (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </Text>
            </>
          ) : null}
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

      {inPlay.length > 0 ? (
        <>
          <ShelfHead
            title="In play this week"
            count={inPlay.length}
            onSeeAll={() =>
              showAlert(
                'In play this week',
                'Full list view is on the roadmap — not built yet.',
              )
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfTrack}
          >
            {inPlay.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                onPress={() => openItem(item.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <ShelfHead
            title="Recently added"
            onSeeAll={() =>
              showAlert(
                'Recently added',
                'Full list view is on the roadmap — not built yet.',
              )
            }
          />
          <View style={styles.recentBlock}>
            {recent.map((item) => (
              <RecentItemRow
                key={item.id}
                item={item}
                onPress={() => openItem(item.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {collections.length > 0 ? (
        <>
          <ShelfHead
            title="Collections"
            topPad={IOS_SPACING.lg}
            onSeeAll={() =>
              showAlert(
                'Collections',
                'Full list view is on the roadmap — not built yet.',
              )
            }
          />
          <CollectionsRow
            collections={collections}
            onPress={(id) => {
              const c = collections.find((x) => x.id === id);
              showAlert(
                c?.name ?? 'Collection',
                'Collection detail screen is on the roadmap — not built yet.',
              );
            }}
          />
        </>
      ) : null}

      <View style={styles.bottomPad} />
      <CaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSave={(payload) => {
          const input = mapCapturePayloadToLibraryItem(
            payload,
            currentInterest?.id,
          );
          if (!input) return;
          createLibraryItem.mutate(input, {
            onSuccess: () => {
              hapticSuccess();
              toast.show(
                "Saved — your Librarian will surface this when it's relevant.",
                'success',
              );
            },
            onError: (err) =>
              showAlert(
                'Capture failed',
                err instanceof Error ? err.message : String(err),
              ),
          });
        }}
      />
    </ScrollView>
  );
}

function ShelfHead({
  title,
  count,
  topPad,
  onSeeAll,
}: {
  title: string;
  count?: number;
  topPad?: number;
  onSeeAll?: () => void;
}) {
  return (
    <View style={[styles.shelfHead, topPad ? { paddingTop: topPad } : null]}>
      <Text style={styles.shelfTitle}>
        {title}
        {count != null ? <Text style={styles.shelfCount}>  {count}</Text> : null}
      </Text>
      <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={onSeeAll}>
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
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
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
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
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
