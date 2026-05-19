/**
 * RawInboxCard — unified capture + inbox sidebar card.
 *
 * Top section: always-visible "Paste a link" input + action buttons (Link, Note).
 * Middle section: list of pending `playbook_inbox_items`.
 * Bottom: "Ingest now" button that calls `playbook-ingest-inbox`.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybookInbox, useAddInboxItem } from '@/hooks/usePlaybook';
import { router } from 'expo-router';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';
import type { PlaybookInboxItemRecord, InboxItemKind } from '@/types/playbook';

interface RawInboxCardProps {
  playbookId: string | undefined;
  onOpenSuggestions?: () => void;
}

const KIND_ICON: Record<InboxItemKind, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  file: 'document-outline',
  url: 'link-outline',
  photo: 'image-outline',
  voice: 'mic-outline',
  text: 'create-outline',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${mins}m ago`;
}

function itemTitle(item: PlaybookInboxItemRecord): string {
  return (
    item.title ||
    item.source_url ||
    (item.raw_text ? item.raw_text.slice(0, 60) : '') ||
    'Untitled capture'
  );
}

export function RawInboxCard({ playbookId, onOpenSuggestions }: RawInboxCardProps) {
  const { data: items = [] } = usePlaybookInbox(playbookId);
  const queryClient = useQueryClient();
  const addInbox = useAddInboxItem();
  const [ingesting, setIngesting] = useState(false);

  // Capture state
  const [mode, setMode] = useState<'none' | 'url' | 'text'>('none');
  const [urlDraft, setUrlDraft] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');

  const handleIngest = async () => {
    if (!playbookId || ingesting) return;
    setIngesting(true);
    try {
      const res = await PlaybookAIService.ingestInbox(playbookId);
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const first = query.queryKey[0];
          return typeof first === 'string' && (
            first.startsWith('playbook') ||
            first.startsWith('library')
          );
        },
      });
      if (res.suggestions_created && res.suggestions_created > 0 && onOpenSuggestions) {
        showConfirm(
          'Ingest complete',
          `${res.ingested} resource${res.ingested !== 1 ? 's' : ''} created, ${res.suggestions_created} concept update${res.suggestions_created !== 1 ? 's' : ''} suggested.`,
          () => onOpenSuggestions(),
          { confirmText: 'Review suggestions' },
        );
      } else if (res.ingested > 0) {
        showConfirm(
          'Ingest complete',
          `${res.ingested} resource${res.ingested !== 1 ? 's' : ''} added to your Playbook.`,
          () => router.push('/library/resources'),
          { confirmText: 'View resources' },
        );
      } else {
        showAlert('Ingest complete', 'Nothing to process.');
      }
    } catch (err) {
      showAlert('Ingest failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIngesting(false);
    }
  };

  const handleSaveUrl = async () => {
    const trimmed = urlDraft.trim();
    if (!trimmed || !playbookId) return;
    try {
      await addInbox.mutateAsync({
        playbook_id: playbookId,
        kind: 'url',
        source_url: trimmed,
        title: titleDraft.trim() || trimmed,
      });
      setUrlDraft('');
      setTitleDraft('');
      setMode('none');
    } catch (err) {
      showAlert('Could not save link', (err as Error).message);
    }
  };

  const handleSaveText = async () => {
    const trimmed = textDraft.trim();
    if (!trimmed || !playbookId) return;
    try {
      await addInbox.mutateAsync({
        playbook_id: playbookId,
        kind: 'text',
        raw_text: trimmed,
        title: titleDraft.trim() || trimmed.slice(0, 80),
      });
      setTextDraft('');
      setTitleDraft('');
      setMode('none');
    } catch (err) {
      showAlert('Could not save note', (err as Error).message);
    }
  };

  const saving = addInbox.isPending;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="file-tray-outline" size={16} color={IOS_COLORS.systemOrange} />
        <Text style={styles.title}>Raw Inbox</Text>
        {items.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{items.length} to ingest</Text>
          </View>
        ) : null}
      </View>

      {/* Capture buttons */}
      <View style={styles.captureRow}>
        <Pressable
          onPress={() => setMode(mode === 'url' ? 'none' : 'url')}
          style={({ pressed }) => [
            styles.captureBtn,
            mode === 'url' && styles.captureBtnActive,
            pressed && styles.captureBtnPressed,
          ]}
        >
          <Ionicons
            name="link-outline"
            size={16}
            color={mode === 'url' ? '#fff' : IOS_COLORS.systemBlue}
          />
          <Text
            style={[
              styles.captureBtnText,
              mode === 'url' && styles.captureBtnTextActive,
            ]}
          >
            Add link
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode(mode === 'text' ? 'none' : 'text')}
          style={({ pressed }) => [
            styles.captureBtn,
            mode === 'text' && styles.captureBtnActive,
            pressed && styles.captureBtnPressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={mode === 'text' ? '#fff' : IOS_COLORS.systemBlue}
          />
          <Text
            style={[
              styles.captureBtnText,
              mode === 'text' && styles.captureBtnTextActive,
            ]}
          >
            Add note
          </Text>
        </Pressable>
      </View>

      {/* URL capture form */}
      {mode === 'url' && (
        <View style={styles.captureForm}>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            placeholder="Paste a URL — article, PDF, video…"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            style={styles.input}
            onSubmitEditing={handleSaveUrl}
          />
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder="Title (optional)"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            style={styles.input}
          />
          <Pressable
            onPress={handleSaveUrl}
            disabled={saving || !urlDraft.trim()}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || !urlDraft.trim()) && styles.saveBtnDisabled,
              pressed && styles.saveBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Add to inbox</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Text/note capture form */}
      {mode === 'text' && (
        <View style={styles.captureForm}>
          <TextInput
            value={textDraft}
            onChangeText={setTextDraft}
            placeholder="Type a note, paste text, jot an idea…"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            multiline
            numberOfLines={3}
            autoFocus
            style={[styles.input, styles.textArea]}
          />
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder="Title (optional)"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            style={styles.input}
          />
          <Pressable
            onPress={handleSaveText}
            disabled={saving || !textDraft.trim()}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || !textDraft.trim()) && styles.saveBtnDisabled,
              pressed && styles.saveBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Add to inbox</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Pending items list */}
      {items.length === 0 && mode === 'none' ? (
        <Text style={styles.empty}>
          Add links, notes, or files. Tap Ingest now when you're ready for the
          AI to process them into resources and concept updates.
        </Text>
      ) : items.length > 0 ? (
        <View style={styles.list}>
          {items.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.item}>
              <Ionicons
                name={KIND_ICON[item.kind] ?? 'document-outline'}
                size={16}
                color={IOS_COLORS.secondaryLabel}
              />
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {itemTitle(item)}
                </Text>
                <Text style={styles.itemMeta}>
                  Added {relativeTime(item.created_at)}
                </Text>
              </View>
            </View>
          ))}
          {items.length > 4 && (
            <Text style={styles.moreText}>
              +{items.length - 4} more item{items.length - 4 !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      ) : null}

      {/* Ingest button */}
      <Pressable
        onPress={handleIngest}
        disabled={items.length === 0 || ingesting}
        style={({ pressed }) => [
          styles.ingestButton,
          (items.length === 0 || ingesting) && styles.ingestButtonDisabled,
          pressed && items.length > 0 && !ingesting && styles.ingestButtonPressed,
        ]}
      >
        {ingesting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="sparkles" size={16} color="#fff" />
        )}
        <Text style={styles.ingestButtonText}>
          {ingesting ? 'Ingesting…' : 'Ingest now'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemOrange,
  },
  captureRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  captureBtnActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  captureBtnPressed: {
    opacity: 0.7,
  },
  captureBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  captureBtnTextActive: {
    color: '#fff',
  },
  captureForm: {
    gap: IOS_SPACING.sm,
  },
  input: {
    fontSize: 13,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 8,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  list: {
    gap: IOS_SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  itemMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  moreText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    paddingTop: 2,
  },
  ingestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemOrange,
    paddingVertical: IOS_SPACING.md,
    borderRadius: 10,
  },
  ingestButtonDisabled: {
    opacity: 0.4,
  },
  ingestButtonPressed: {
    opacity: 0.85,
  },
  ingestButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
