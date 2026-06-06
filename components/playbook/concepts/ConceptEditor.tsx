/**
 * ConceptEditor — modal for creating a new personal concept or editing an
 * existing personal/forked row. Markdown is plain textarea + live preview.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  useCreatePlaybookConcept,
  useUpdatePlaybookConcept,
} from '@/hooks/usePlaybook';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { PlaybookConceptRecord } from '@/types/playbook';

type EditorBaseProps = {
  onClose: () => void;
  onSaved?: (concept: PlaybookConceptRecord) => void;
};

type EditorMode =
  | {
      mode: 'create';
      playbookId: string;
      interestId: string;
      initialTitle?: string;
      initialBodyMd?: string;
      saveLabel?: string;
    } & EditorBaseProps
  | {
      mode: 'edit';
      concept: PlaybookConceptRecord;
      playbookId: string;
    } & EditorBaseProps;

export function ConceptEditor(props: EditorMode) {
  const { onClose } = props;
  const existing = props.mode === 'edit' ? props.concept : null;
  const [title, setTitle] = useState(
    props.mode === 'create' ? props.initialTitle ?? '' : existing?.title ?? '',
  );
  const [bodyMd, setBodyMd] = useState(
    props.mode === 'create' ? props.initialBodyMd ?? '' : existing?.body_md ?? '',
  );
  const create = useCreatePlaybookConcept();
  const update = useUpdatePlaybookConcept();
  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Title required', 'Give your concept a title before saving.');
      return;
    }
    try {
      if (props.mode === 'edit') {
        const saved = await update.mutateAsync({
          conceptId: existing!.id,
          playbookId: props.playbookId,
          input: { title: trimmedTitle, body_md: bodyMd },
        });
        props.onSaved?.(saved);
      } else {
        const saved = await create.mutateAsync({
          playbook_id: props.playbookId,
          origin: 'personal',
          interest_id: props.interestId,
          slug: slugify(trimmedTitle),
          title: trimmedTitle,
          body_md: bodyMd,
        });
        props.onSaved?.(saved);
      }
      onClose();
    } catch (err) {
      showAlert('Save failed', (err as Error).message);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {props.mode === 'edit' ? 'Edit concept' : 'New concept'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Downwind trim in heavy air"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
            />
            <Text style={styles.label}>Body (Markdown)</Text>
            <TextInput
              value={bodyMd}
              onChangeText={setBodyMd}
              placeholder={'# Key idea\n\nWhat you want to remember about this concept.'}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.bodyInput]}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.save,
                saving && styles.saveDisabled,
                pressed && !saving && styles.pressed,
              ]}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving…' : props.mode === 'create' ? props.saveLabel ?? 'Save' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: IOS_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: IOS_COLORS.separator,
  },
  title: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  body: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  label: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  input: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    fontSize: 15,
    color: IOS_COLORS.label,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  bodyInput: {
    minHeight: 220,
    paddingVertical: IOS_SPACING.md,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.separator,
  },
  cancel: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  save: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  pressed: {
    opacity: 0.7,
  },
});
