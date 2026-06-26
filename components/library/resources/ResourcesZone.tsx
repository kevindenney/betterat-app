/**
 * ResourcesZone — Library tab Resources zone (Emily Phone 1).
 * - "Drop something in" capture entry (opens capture sheet, Wave 2f)
 * - "In play this week" horizontal shelf
 * - "Recently added" vertical list
 * - "Collections" horizontal shelf of named bundles
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useToast } from '@/components/ui/AppToast';
import { hapticSuccess } from '@/lib/haptics';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { useLibraryZonesData } from '@/hooks/useLibraryZonesData';
import { useLibraryResources } from '@/hooks/useLibraryResources';
import {
  useUpdateLibraryItem,
  useDeleteLibraryItem,
} from '@/hooks/useLibraryItemMutations';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { useInterest } from '@/providers/InterestProvider';
import { LibraryItemCard } from './LibraryItemCard';
import { RecentItemRow } from './RecentItemRow';
import { ResourceListRow } from './ResourceListRow';
import { CollectionsRow } from './CollectionsRow';
import { CaptureSheet } from './CaptureSheet';
import { mapCapturePayloadToLibraryItem } from './capturePayloadMap';
import { FORMAT_TINT } from './formatStyles';
import { DEMO_COLLECTIONS, DEMO_IN_PLAY, DEMO_RECENT } from './demoZonesData';
import type { LibraryFormat, LibraryItemRow } from './types';

const FORMAT_CHIP_LABEL: Record<LibraryFormat, string> = {
  pdf: 'PDFs',
  video: 'Videos',
  book: 'Books',
  link: 'Links',
  audio: 'Audio',
  article: 'Articles',
  note: 'Notes',
  image: 'Images',
};

interface Props {
  /** Optional external open trigger; if not provided the zone opens its own sheet. */
  onOpenCapture?: () => void;
}

export function ResourcesZone({ onOpenCapture }: Props) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<LibraryFormat | 'all'>('all');
  const [menuItem, setMenuItem] = useState<LibraryItemRow | null>(null);
  const [renameItem, setRenameItem] = useState<LibraryItemRow | null>(null);
  const [renameText, setRenameText] = useState('');
  const { currentInterest } = useInterest();
  const toast = useToast();
  const createLibraryItem = useCreateLibraryItem();
  const {
    data: zones,
    isLoading: zonesLoading,
    error: zonesError,
    refetch: refetchZones,
  } = useLibraryZonesData(currentInterest?.id);
  const { data: allResources = [] } = useLibraryResources(currentInterest?.id);
  const updateItem = useUpdateLibraryItem(renameItem?.id);
  const deleteItem = useDeleteLibraryItem();
  const { data: counts } = useLibraryCounts(currentInterest?.id);

  // Format chips: only offer formats that actually appear in the list.
  const availableFormats = useMemo(() => {
    const set = new Set<LibraryFormat>();
    for (const r of allResources) set.add(r.format);
    return Array.from(set);
  }, [allResources]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResources.filter((r) => {
      if (formatFilter !== 'all' && r.format !== formatFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.source ?? '').toLowerCase().includes(q)
      );
    });
  }, [allResources, query, formatFilter]);

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

  const startRename = (item: LibraryItemRow) => {
    setMenuItem(null);
    setRenameItem(item);
    setRenameText(item.title);
  };
  const commitRename = () => {
    const next = renameText.trim();
    if (!renameItem || !next || next === renameItem.title) {
      setRenameItem(null);
      return;
    }
    updateItem.mutate(
      { title: next },
      {
        onSuccess: () => {
          hapticSuccess();
          setRenameItem(null);
        },
        onError: (err) =>
          showAlert(
            'Rename failed',
            err instanceof Error ? err.message : String(err),
          ),
      },
    );
  };
  const confirmDelete = (item: LibraryItemRow) => {
    setMenuItem(null);
    showConfirm(
      'Delete resource',
      `Remove "${item.title}" from your library? Steps that pin it will lose the reference.`,
      () =>
        deleteItem.mutate(item.id, {
          onSuccess: () => {
            hapticSuccess();
            toast.show('Removed from your library.', 'success');
          },
          onError: (err) =>
            showAlert(
              'Delete failed',
              err instanceof Error ? err.message : String(err),
            ),
        }),
      { destructive: true, confirmText: 'Delete' },
    );
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

      {zonesError ? (
        <View style={styles.stateCard}>
          <Ionicons name="warning-outline" size={24} color={IOS_COLORS.systemOrange} />
          <Text style={styles.stateTitle}>Could not load resources</Text>
          <Text style={styles.stateBody}>
            {zonesError instanceof Error ? zonesError.message : 'Try again in a moment.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Retry loading resources"
            onPress={() => {
              void refetchZones();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : zonesLoading && !zones ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.stateBody}>Loading resources…</Text>
        </View>
      ) : inPlay.length > 0 ? (
        <>
          <ShelfHead title="In play this week" count={inPlay.length} />
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

      {!zonesError && !(zonesLoading && !zones) && recent.length > 0 ? (
        <>
          <ShelfHead title="Recently added" />
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

      {!zonesError && !(zonesLoading && !zones) && collections.length > 0 ? (
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

      {!zonesError && allResources.length > 0 ? (
        <>
          <ShelfHead
            title="All resources"
            count={allResources.length}
            topPad={IOS_SPACING.lg}
          />
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={15}
              color={IOS_COLORS.tertiaryLabel}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search resources"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity hitSlop={8} onPress={() => setQuery('')}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={IOS_COLORS.tertiaryLabel}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {availableFormats.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipTrack}
            >
              <FilterChip
                label="All"
                active={formatFilter === 'all'}
                onPress={() => setFormatFilter('all')}
              />
              {availableFormats.map((f) => (
                <FilterChip
                  key={f}
                  label={FORMAT_CHIP_LABEL[f]}
                  tint={FORMAT_TINT[f]}
                  active={formatFilter === f}
                  onPress={() => setFormatFilter(f)}
                />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.recentBlock}>
            {filteredResources.length > 0 ? (
              filteredResources.map((item) => (
                <ResourceListRow
                  key={item.id}
                  item={item}
                  onPress={() => openItem(item.id)}
                  onMore={() => setMenuItem(item)}
                />
              ))
            ) : (
              <Text style={styles.emptyFilter}>
                No resources match “{query.trim() || FORMAT_CHIP_LABEL[
                  formatFilter as LibraryFormat
                ]}”.
              </Text>
            )}
          </View>
        </>
      ) : null}

      <View style={styles.bottomPad} />

      <Modal
        visible={menuItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuItem(null)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setMenuItem(null)}
        >
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle} numberOfLines={1}>
              {menuItem?.title}
            </Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                const it = menuItem;
                setMenuItem(null);
                if (it) openItem(it.id);
              }}
            >
              <Ionicons name="open-outline" size={18} color={IOS_COLORS.label} />
              <Text style={styles.menuRowText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => menuItem && startRename(menuItem)}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={IOS_COLORS.label}
              />
              <Text style={styles.menuRowText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => menuItem && confirmDelete(menuItem)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={[styles.menuRowText, { color: '#FF3B30' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={renameItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameItem(null)}
      >
        <View style={styles.menuBackdrop}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename resource</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholder="Title"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameBtn}
                onPress={() => setRenameItem(null)}
              >
                <Text style={styles.renameBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, styles.renameSave]}
                onPress={commitRename}
                disabled={updateItem.isPending}
              >
                {updateItem.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.renameBtnText, styles.renameSaveText]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
      {onSeeAll ? (
        <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={onSeeAll}>
          <Text style={styles.seeAll}>All</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function FilterChip({
  label,
  tint,
  active,
  onPress,
}: {
  label: string;
  tint?: string;
  active: boolean;
  onPress: () => void;
}) {
  const accent = tint ?? '#007AFF';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }
          : null,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active ? { color: accent, fontWeight: '700' } : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  stateCard: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.sm,
    padding: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
    alignItems: 'center',
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  stateBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
  },
  chipTrack: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.22)',
    backgroundColor: IOS_COLORS.systemBackground,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptyFilter: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 18,
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  menuSheet: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.14)',
  },
  menuRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  renameCard: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  renameInput: {
    fontSize: 15,
    color: IOS_COLORS.label,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  renameBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  renameSave: {
    backgroundColor: '#007AFF',
  },
  renameSaveText: {
    color: '#FFFFFF',
  },
  bottomPad: {
    height: 32,
  },
});
