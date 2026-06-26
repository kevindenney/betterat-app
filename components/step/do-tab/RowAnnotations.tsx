/**
 * RowAnnotations — shared library-pin + capture affordances for a checklist
 * row. Used by both the Do-tab How rows (PlanStartingFrameRow) and Beats
 * (BeatsList). The host row owns its own checkbox/title chrome and the
 * menu-open state; this renders the "+" trigger, the popup menu, the pinned
 * library chips, and the inline saved captures.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_TINT } from '@/components/library/resources/formatStyles';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { DoCaptureItem, DoCaptureKind } from './doCaptureModel';

export type SubStepCaptureKind = 'note' | 'photo' | 'voice';

const CAPTURE_GLYPH: Record<DoCaptureKind, React.ComponentProps<typeof Ionicons>['name']> = {
  voice: 'mic',
  note: 'chatbubble-ellipses-outline',
  photo: 'image',
  video: 'videocam',
  media_link: 'link',
  measurement: 'analytics-outline',
  flag: 'flag',
  time_marker: 'time',
};

function captureKindLabel(kind: DoCaptureKind): string {
  switch (kind) {
    case 'voice':
      return 'Voice note';
    case 'photo':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'media_link':
      return 'Link';
    case 'flag':
      return 'Flagged';
    case 'time_marker':
      return 'Marker';
    default:
      return 'Note';
  }
}

export function RowPlusButton({
  open,
  onPress,
}: {
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.plusBtn, open ? styles.plusBtnOpen : null]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Add a reference or capture to this step"
    >
      <Ionicons
        name={open ? 'close' : 'add'}
        size={15}
        color={open ? IOS_COLORS.secondaryLabel : IOS_COLORS.systemBlue}
      />
    </Pressable>
  );
}

interface RowAnnotationsProps {
  readOnly?: boolean;
  menuOpen: boolean;
  onCloseMenu: () => void;
  refs: BeforeShiftItem[];
  captures: DoCaptureItem[];
  onOpenLibraryRef?: (libraryItemId: string) => void;
  onRemoveLibraryRef?: (rowId: string) => void;
  onAttachLibrary?: () => void;
  onCapture?: (kind: SubStepCaptureKind) => void;
  /**
   * Inline note submit. When provided, "Add note" reveals a type-in-place
   * field on the row instead of routing through onCapture('note') (which
   * opened the quick-note modal). Photo/voice still go through onCapture.
   */
  onSubmitNote?: (text: string) => void;
}

export function RowAnnotations({
  readOnly,
  menuOpen,
  onCloseMenu,
  refs,
  captures,
  onOpenLibraryRef,
  onRemoveLibraryRef,
  onAttachLibrary,
  onCapture,
  onSubmitNote,
}: RowAnnotationsProps) {
  const canCaptureNote = Boolean(onSubmitNote || onCapture);
  const hasMenu = !readOnly && Boolean(onAttachLibrary || onCapture || onSubmitNote);

  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const canSubmitNote = draft.trim().length > 0;

  const pick = (fn?: () => void) => {
    onCloseMenu();
    fn?.();
  };

  const openNote = () => {
    onCloseMenu();
    setDraft('');
    setNoteOpen(true);
  };

  const submitNote = () => {
    const text = draft.trim();
    if (!text) {
      setNoteOpen(false);
      return;
    }
    onSubmitNote?.(text);
    setDraft('');
    setNoteOpen(false);
  };

  return (
    <>
      {hasMenu && menuOpen ? (
        <View style={styles.menu}>
          {onAttachLibrary ? (
            <MenuItem
              icon="link"
              label="Pin from library"
              onPress={() => pick(onAttachLibrary)}
            />
          ) : null}
          {canCaptureNote ? (
            <MenuItem
              icon="chatbubble-ellipses-outline"
              label="Add note"
              onPress={() => (onSubmitNote ? openNote() : pick(() => onCapture?.('note')))}
            />
          ) : null}
          {onCapture ? (
            <>
              <MenuItem
                icon="camera-outline"
                label="Add photo"
                onPress={() => pick(() => onCapture('photo'))}
              />
              <MenuItem
                icon="mic-outline"
                label="Add voice note"
                onPress={() => pick(() => onCapture('voice'))}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {noteOpen && !readOnly ? (
        <View style={styles.noteComposer}>
          <TextInput
            style={styles.noteInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a note…"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoFocus
            multiline
            maxLength={4000}
            onSubmitEditing={submitNote}
            blurOnSubmit
            returnKeyType="send"
            accessibilityLabel="Note text"
          />
          <Pressable
            style={[styles.noteSend, !canSubmitNote ? styles.noteSendDisabled : null]}
            onPress={submitNote}
            disabled={!canSubmitNote}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Save note"
            accessibilityState={{ disabled: !canSubmitNote }}
          >
            <Ionicons name="arrow-up" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      {refs.length > 0 ? (
        <View style={styles.refChips}>
          {refs.map((ref) => {
            const tint = FORMAT_TINT[ref.format];
            return (
              <View key={ref.id} style={styles.refChip}>
                <Pressable
                  style={styles.refChipBody}
                  onPress={
                    onOpenLibraryRef && ref.libraryItemId
                      ? () => onOpenLibraryRef(ref.libraryItemId!)
                      : undefined
                  }
                  disabled={!onOpenLibraryRef || !ref.libraryItemId}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${ref.title}`}
                >
                  <View style={[styles.refGlyph, { backgroundColor: `${tint}22` }]}>
                    <Ionicons name={FORMAT_ICON[ref.format]} size={11} color={tint} />
                  </View>
                  <Text style={styles.refTitle} numberOfLines={1}>
                    {ref.title}
                  </Text>
                  {ref.read ? (
                    <Ionicons name="checkmark-circle" size={12} color="#34C759" />
                  ) : null}
                </Pressable>
                {!readOnly && onRemoveLibraryRef ? (
                  <Pressable
                    style={styles.refRemove}
                    onPress={() => onRemoveLibraryRef(ref.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ref.title} from this step`}
                  >
                    <Ionicons name="close" size={13} color={IOS_COLORS.tertiaryLabel} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {captures.length > 0 ? (
        <View style={styles.captureList}>
          {captures.map((c) => (
            <View key={c.id} style={styles.captureRow}>
              <Ionicons
                name={CAPTURE_GLYPH[c.kind] ?? 'ellipse-outline'}
                size={12}
                color={IOS_COLORS.secondaryLabel}
              />
              <Text style={styles.captureText} numberOfLines={2}>
                {c.body?.trim() || captureKindLabel(c.kind)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={15} color={IOS_COLORS.systemBlue} />
      <Text style={styles.menuItemText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plusBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  plusBtnOpen: {
    backgroundColor: 'rgba(60,60,67,0.12)',
  },
  menu: {
    marginLeft: 22,
    borderRadius: 10,
    paddingVertical: 2,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  noteComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 22,
    marginTop: 2,
  },
  noteInput: {
    flex: 1,
    minHeight: 34,
    maxHeight: 96,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    lineHeight: 17,
    color: IOS_COLORS.label,
  },
  noteSend: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSendDisabled: {
    opacity: 0.4,
  },
  refChips: {
    gap: 4,
    marginLeft: 22,
  },
  refChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  refChipBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refGlyph: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  captureList: {
    gap: 4,
    marginLeft: 22,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 2,
  },
  captureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_COLORS.secondaryLabel,
  },
});
