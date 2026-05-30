/**
 * LibraryBeforePicker — modal sheet that lists the user's library_items and
 * lets them pick one to attach to a step's "Before the shift" checklist
 * (step_library_before). Used from BeforeTheShiftCard's "+ Add from library"
 * footer via useLibraryBeforeBinding.
 *
 * Single-select for now: tap an item → insert → close. The card's read
 * checkboxes and reorder live on the step itself.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useLibraryItemsForBeforePicker } from '@/hooks/useLibraryItemsForBeforePicker';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { FORMAT_ICON, FORMAT_TINT } from '@/components/library/resources/formatStyles';
import type { LibraryFormat } from '@/components/library/resources/types';
import type { PickerLibraryItem } from '@/hooks/useLibraryItemsForBeforePicker';

/**
 * Classify free-typed picker text as a link (when it looks like a URL) or a
 * plain note, so "add to library" can create the right kind inline.
 */
function detectKind(text: string): {
  kind: LibraryFormat;
  url: string | null;
  title: string;
  source_label: string | null;
} {
  const t = text.trim();
  const hasScheme = /^https?:\/\//i.test(t);
  const looksUrl = hasScheme || /^(www\.)?[^\s]+\.[^\s]{2,}(\/\S*)?$/i.test(t);
  if (looksUrl) {
    const url = hasScheme ? t : `https://${t}`;
    let host = t;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // Malformed despite the regex — fall back to the raw text as the host.
    }
    return { kind: 'link', url, title: host, source_label: host };
  }
  return { kind: 'note', url: null, title: t, source_label: null };
}

export interface LibraryBeforePickerProps {
  visible: boolean;
  onClose: () => void;
  /** Library item ids already attached to this step — hidden from the list. */
  attachedItemIds: string[];
  /** Called with the picked library_items.id; parent runs the insert. */
  onSelect: (libraryItemId: string) => void;
  /** Scope the picker to a single interest's items (plus legacy NULL rows). */
  interestId?: string;
}

export function LibraryBeforePicker({
  visible,
  onClose,
  attachedItemIds,
  onSelect,
  interestId,
}: LibraryBeforePickerProps) {
  const [query, setQuery] = useState('');
  const { data: allItems = [], isLoading } =
    useLibraryItemsForBeforePicker(interestId);
  const createItem = useCreateLibraryItem();

  const excludeSet = useMemo(() => new Set(attachedItemIds), [attachedItemIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((it) => {
      if (excludeSet.has(it.id)) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q)
        || (it.source ?? '').toLowerCase().includes(q)
      );
    });
  }, [allItems, query, excludeSet]);

  const trimmedQuery = query.trim();
  const detected = useMemo(
    () => (trimmedQuery ? detectKind(trimmedQuery) : null),
    [trimmedQuery],
  );

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handlePick = (item: PickerLibraryItem) => {
    onSelect(item.id);
    setQuery('');
  };

  const handleCreate = async () => {
    if (!detected || createItem.isPending) return;
    const { id } = await createItem.mutateAsync({
      kind: detected.kind,
      title: detected.title,
      url_or_blob_id: detected.url,
      source_label: detected.source_label,
      interest_id: interestId ?? null,
    });
    onSelect(id);
    setQuery('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.chrome}>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Pin from library</Text>
            <Text style={styles.cancelGhost}>Cancel</Text>
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={16} color={IOS_COLORS.secondaryLabel} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search, or paste a link / type a note to add"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={17} color={IOS_COLORS.secondaryLabel} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {detected ? (
              <Pressable
                style={styles.createRow}
                onPress={handleCreate}
                disabled={createItem.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Add "${detected.title}" to your library`}
                accessibilityState={{ disabled: createItem.isPending }}
              >
                <View style={styles.createGlyph}>
                  {createItem.isPending ? (
                    <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
                  ) : (
                    <Ionicons name="add" size={20} color={IOS_COLORS.systemBlue} />
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.createTitle} numberOfLines={2}>
                    Add “{detected.title}” to library
                  </Text>
                  <Text style={styles.createMeta}>
                    {detected.kind === 'link' ? 'New link' : 'New note'}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={IOS_COLORS.systemBlue} />
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="library-outline" size={28} color={IOS_COLORS.systemGray2} />
                <Text style={styles.emptyTitle}>
                  {query
                    ? 'No matches'
                    : excludeSet.size > 0 && allItems.length > 0
                      ? 'Everything is already attached'
                      : 'Nothing in your library yet'}
                </Text>
                <Text style={styles.emptyBody}>
                  {query
                    ? 'Try a different term, or capture something new from the Library tab.'
                    : excludeSet.size > 0
                      ? 'Capture more from the Library tab to attach more items.'
                      : 'Drop a link, PDF, or note into your library first, then attach it here.'}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filtered.map((item) => (
                  <PickerRow
                    key={item.id}
                    item={item}
                    onPress={() => handlePick(item)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({
  item,
  onPress,
}: {
  item: PickerLibraryItem;
  onPress: () => void;
}) {
  const tint = FORMAT_TINT[item.format];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.glyph, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={FORMAT_ICON[item.format]} size={16} color={tint} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.meta}
          </Text>
        ) : null}
      </View>
      <Ionicons name="add-circle" size={22} color={IOS_COLORS.systemBlue} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '88%',
    minHeight: '50%',
  },
  grabberRow: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.tertiaryLabel,
  },
  chrome: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: {
    color: IOS_COLORS.systemBlue,
    fontSize: 16,
  },
  cancelGhost: {
    color: 'transparent',
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.1,
  },
  search: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 28,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  createRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemBlue,
  },
  createGlyph: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${IOS_COLORS.systemBlue}1F`,
  },
  createTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  createMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  row: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  rowMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
});
