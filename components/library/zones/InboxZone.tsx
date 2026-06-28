/**
 * <InboxZone> — the capture-first Inbox surface (BETTERAT_INBOX_SPEC.md).
 *
 * The "dump now, refine later" pile. A compact composer at the top captures a
 * pasted link or a jotted note in one move (no classifying up front); below it,
 * the unsorted captures list newest-first with a two-button triage: Keep (I
 * want this) or Archive (not now). Graduating a capture into a
 * step/concept/resource/blueprint lands in a follow-up.
 *
 * Lives inside LibraryLanding's shared ScrollView, so no inner scroll view.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import { useInbox, useDropLink, useDropNote, useTriageInsight } from '@/hooks/useInbox';
import type { PlaybookInsightRecord } from '@/services/QuickCaptureService';

// A capture is a link if it parses as an http(s) URL or bare domain. Kept
// permissive — the composer is one box, so we sniff rather than ask.
function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  return /^(https?:\/\/|www\.)\S+$/i.test(t) || /^\S+\.\S{2,}(\/\S*)?$/.test(t);
}

function normalizeUrl(text: string): string {
  const t = text.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function InboxZone() {
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;
  const toast = useToast();
  const { data: items = [], isLoading } = useInbox(interestId);
  const dropLink = useDropLink(interestId);
  const dropNote = useDropNote(interestId);
  const { keep, archive } = useTriageInsight(interestId);

  const [draft, setDraft] = useState('');
  const capturing = dropLink.isPending || dropNote.isPending;

  const handleCapture = useCallback(() => {
    const text = draft.trim();
    if (!text || capturing) return;
    const onDone = () => setDraft('');
    if (looksLikeUrl(text)) {
      dropLink.mutate(
        { url: normalizeUrl(text) },
        {
          onSuccess: () => {
            onDone();
            toast.show('Link captured', 'success');
          },
          onError: (e) => toast.show(e.message, 'error'),
        },
      );
    } else {
      dropNote.mutate(
        { text },
        {
          onSuccess: () => {
            onDone();
            toast.show('Note captured', 'success');
          },
          onError: (e) => toast.show(e.message, 'error'),
        },
      );
    }
  }, [draft, capturing, dropLink, dropNote, toast]);

  return (
    <View style={styles.container}>
      {/* Composer — one box, paste-and-go. */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Paste a link or jot a note…"
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleCapture}
          blurOnSubmit
        />
        <Pressable
          style={[styles.captureBtn, (!draft.trim() || capturing) && styles.captureBtnDisabled]}
          onPress={handleCapture}
          disabled={!draft.trim() || capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture to inbox"
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Inbox zero</Text>
          <Text style={styles.emptyBody}>
            Dump a link or a half-formed idea here without deciding what it is yet.
            Sort it into a step, concept, or resource later.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item, idx) => (
            <InboxRow
              key={item.id}
              item={item}
              first={idx === 0}
              keeping={keep.isPending && keep.variables?.insightId === item.id}
              archiving={archive.isPending && archive.variables?.insightId === item.id}
              onKeep={() =>
                keep.mutate(
                  { insightId: item.id },
                  { onError: (e) => toast.show(e.message, 'error') },
                )
              }
              onArchive={() =>
                archive.mutate(
                  { insightId: item.id },
                  { onError: (e) => toast.show(e.message, 'error') },
                )
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

function InboxRow({
  item,
  first,
  keeping,
  archiving,
  onKeep,
  onArchive,
}: {
  item: PlaybookInsightRecord;
  first: boolean;
  keeping: boolean;
  archiving: boolean;
  onKeep: () => void;
  onArchive: () => void;
}) {
  const isLink = item.kind === 'link' && !!item.source_url;
  const primary = isLink
    ? item.title?.trim() || hostOf(item.source_url!)
    : item.content.trim() || 'Untitled note';
  const secondary = isLink
    ? item.content.trim() || item.source_url!
    : null;
  const busy = keeping || archiving;

  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <View style={[styles.kindBadge, isLink ? styles.kindLink : styles.kindNote]}>
        <Ionicons
          name={isLink ? 'link' : item.kind === 'voice' ? 'mic' : 'document-text'}
          size={15}
          color={isLink ? '#0A84FF' : '#8E5BE8'}
        />
      </View>
      <Pressable
        style={styles.rowBody}
        disabled={!isLink}
        onPress={() => isLink && Linking.openURL(normalizeUrl(item.source_url!))}
      >
        <Text style={styles.rowPrimary} numberOfLines={2}>
          {primary}
        </Text>
        {secondary ? (
          <Text style={styles.rowSecondary} numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable
          style={styles.actionBtn}
          onPress={onKeep}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Keep"
          hitSlop={6}
        >
          {keeping ? (
            <ActivityIndicator size="small" color="#34C759" />
          ) : (
            <Ionicons name="bookmark-outline" size={20} color="#34C759" />
          )}
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={onArchive}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Archive"
          hitSlop={6}
        >
          {archiving ? (
            <ActivityIndicator size="small" color={IOS_COLORS.systemGray} />
          ) : (
            <Ionicons name="archive-outline" size={20} color={IOS_COLORS.systemGray} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: IOS_COLORS.label,
    paddingVertical: 6,
    maxHeight: 120,
  },
  captureBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  captureBtnDisabled: {
    backgroundColor: IOS_COLORS.systemGray3,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xl,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: IOS_SPACING.xl,
    paddingHorizontal: IOS_SPACING.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: IOS_COLORS.secondaryLabel,
  },
  list: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  kindBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindLink: {
    backgroundColor: 'rgba(10,132,255,0.12)',
  },
  kindNote: {
    backgroundColor: 'rgba(142,91,232,0.12)',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
  rowSecondary: {
    fontSize: 12.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
