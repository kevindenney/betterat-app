/**
 * TagBulkSheet — Frame 12 bulk Tag action.
 *
 * Lists every category the viewer has already used across their
 * timeline (deduped, alphabetical), plus an inline "+ new tag"
 * field. Picking one writes `category = <value>` to each selected
 * step via the caller-provided commit handler.
 *
 * Single-value model: timeline_steps stores one category string per
 * step today. Multi-tag landing (when the schema gets there) will
 * keep this same picker UI and swap the write to an array push.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface TagBulkSheetProps {
  visible: boolean;
  stepIds: string[];
  /** Tag values already in use by the viewer — surfaces as picker rows. */
  existingTags: string[];
  onPickTag: (tag: string) => void;
  onDismiss: () => void;
}

export function TagBulkSheet({
  visible,
  stepIds,
  existingTags,
  onPickTag,
  onDismiss,
}: TagBulkSheetProps) {
  const [newTag, setNewTag] = useState('');
  const countLabel = stepIds.length === 1 ? '1 step' : `${stepIds.length} steps`;

  const sortedTags = useMemo(
    () =>
      Array.from(new Set(existingTags.filter((t) => t && t.trim())))
        .sort((a, b) => a.localeCompare(b)),
    [existingTags],
  );

  const canCreate = newTag.trim().length > 0;

  const reset = () => {
    setNewTag('');
  };
  const handleDismiss = () => {
    reset();
    onDismiss();
  };
  const handlePick = (tag: string) => {
    onPickTag(tag);
    reset();
  };
  const handleCreate = () => {
    if (!canCreate) return;
    handlePick(newTag.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleDismiss} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Tag {countLabel}</Text>
              <Pressable hitSlop={8} onPress={handleDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.newRow}>
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={IOS_REGISTER.accentUserAction}
                />
                <TextInput
                  style={styles.newInput}
                  placeholder="New tag…"
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  value={newTag}
                  onChangeText={setNewTag}
                  autoFocus
                  onSubmitEditing={handleCreate}
                  returnKeyType="done"
                />
                <Pressable
                  hitSlop={6}
                  onPress={handleCreate}
                  disabled={!canCreate}
                  style={[styles.applyBtn, !canCreate && styles.applyBtnDisabled]}
                >
                  <Text style={styles.applyText}>Apply</Text>
                </Pressable>
              </View>

              {sortedTags.length === 0 ? (
                <Text style={styles.emptyText}>
                  No tags used yet — type one above to apply.
                </Text>
              ) : (
                sortedTags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={styles.tagRow}
                    onPress={() => handlePick(tag)}
                  >
                    <Ionicons
                      name="pricetag"
                      size={14}
                      color={IOS_REGISTER.labelSecondary}
                    />
                    <Text style={styles.tagLabel}>{tag}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={IOS_REGISTER.labelTertiary}
                    />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '85%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  scroll: { maxHeight: 500 },
  scrollContent: { paddingVertical: 8 },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  newInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    paddingVertical: 4,
  },
  applyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  tagLabel: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
});
