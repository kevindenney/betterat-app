/**
 * QuickCaptureModal — multi-type capture sheet triggered from the Playbook
 * toolbar's "+" button. Supports URL, YouTube, and text note capture.
 * Drops items into `playbook_inbox_items` with `status='pending'`;
 * ingest runs from the Raw Inbox sidebar card.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAddInboxItem } from '@/hooks/usePlaybook';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { fetchYouTubeMetadata } from '@/services/YouTubeMetadataService';

type CaptureMode = 'url' | 'youtube' | 'note' | 'inspiration';

const YOUTUBE_RE = /(?:youtube\.com|youtu\.be)\//i;

interface QuickCaptureModalProps {
  visible: boolean;
  playbookId: string | undefined;
  onClose: () => void;
  /** When set, opens the InspirationWizard instead of closing */
  onOpenInspiration?: () => void;
}

const MODES: { key: CaptureMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'url', label: 'URL', icon: 'link' },
  { key: 'youtube', label: 'YouTube', icon: 'videocam' },
  { key: 'note', label: 'Note', icon: 'document-text' },
  { key: 'inspiration', label: 'Inspiration', icon: 'sparkles' },
];

const HERO: Record<CaptureMode, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }> = {
  url: {
    icon: 'link',
    title: 'Drop a link into your inbox',
    subtitle: 'Save it now, run "Ingest now" from the sidebar when you\'re ready to process it.',
  },
  youtube: {
    icon: 'videocam',
    title: 'Add a YouTube video',
    subtitle: 'Paste a YouTube link and we\'ll grab the title automatically.',
  },
  note: {
    icon: 'document-text',
    title: 'Capture a note',
    subtitle: 'Jot down learnings, tips, or observations to ingest later.',
  },
  inspiration: {
    icon: 'sparkles',
    title: 'Get inspired',
    subtitle: 'Paste a link or describe something you want to learn — we\'ll build you a plan.',
  },
};

export function QuickCaptureModal({
  visible,
  playbookId,
  onClose,
  onOpenInspiration,
}: QuickCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<CaptureMode>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const addInbox = useAddInboxItem();

  // Auto-detect YouTube URLs typed in URL mode
  useEffect(() => {
    if (mode === 'url' && YOUTUBE_RE.test(url)) {
      setMode('youtube');
    }
  }, [url, mode]);

  // Auto-fetch YouTube title
  useEffect(() => {
    if (mode !== 'youtube' || !url.trim() || !YOUTUBE_RE.test(url) || title.trim()) return;
    let cancelled = false;
    setFetchingMeta(true);
    fetchYouTubeMetadata(url.trim(), { generateNotes: false })
      .then((meta) => {
        if (!cancelled && meta?.title) setTitle(meta.title);
      })
      .finally(() => { if (!cancelled) setFetchingMeta(false); });
    return () => { cancelled = true; };
  }, [url, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setUrl('');
    setTitle('');
    setNoteText('');
    setFetchingMeta(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!playbookId) return;

    try {
      if (mode === 'note') {
        const trimmed = noteText.trim();
        if (!trimmed) {
          showAlert('Note required', 'Write something before saving.');
          return;
        }
        await addInbox.mutateAsync({
          playbook_id: playbookId,
          kind: 'text',
          title: title.trim() || 'Quick note',
          raw_text: trimmed,
        });
      } else {
        // url or youtube
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
          showAlert('URL required', 'Paste a link before capturing.');
          return;
        }
        const isYouTube = mode === 'youtube' || YOUTUBE_RE.test(trimmedUrl);
        await addInbox.mutateAsync({
          playbook_id: playbookId,
          kind: 'url',
          source_url: trimmedUrl,
          title: title.trim() || trimmedUrl,
          ...(isYouTube
            ? { metadata: { resource_type: 'video', platform: 'youtube' } }
            : {}),
        });
      }
      resetForm();
      onClose();
    } catch (err) {
      showAlert(
        'Capture failed',
        err instanceof Error ? err.message : 'Could not save item',
      );
    }
  };

  const isSubmitDisabled =
    addInbox.isPending ||
    !playbookId ||
    (mode === 'note' ? !noteText.trim() : !url.trim());

  const hero = HERO[mode];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + IOS_SPACING.md }]}>
          <Pressable onPress={handleClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Quick capture</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            style={styles.headerBtn}
          >
            {addInbox.isPending ? (
              <ActivityIndicator color={IOS_COLORS.systemBlue} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  isSubmitDisabled && styles.saveTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Mode selector */}
          <View style={styles.modeRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => {
                  if (m.key === 'inspiration' && onOpenInspiration) {
                    onClose();
                    onOpenInspiration();
                    return;
                  }
                  setMode(m.key);
                }}
                style={[
                  styles.modePill,
                  mode === m.key && styles.modePillActive,
                ]}
              >
                <Ionicons
                  name={m.icon}
                  size={14}
                  color={mode === m.key ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                />
                <Text
                  style={[
                    styles.modePillText,
                    mode === m.key && styles.modePillTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Ionicons
              name={hero.icon}
              size={28}
              color={
                mode === 'youtube'
                  ? '#FF0000'
                  : mode === 'note'
                    ? IOS_COLORS.systemOrange
                    : IOS_COLORS.systemBlue
              }
            />
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
          </View>

          {/* Fields per mode */}
          {mode !== 'note' && (
            <>
              <Text style={styles.label}>
                {mode === 'youtube' ? 'YOUTUBE URL' : 'URL'}
              </Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder={
                  mode === 'youtube'
                    ? 'https://youtube.com/watch?v=...'
                    : 'https://…'
                }
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />
            </>
          )}

          <Text style={styles.label}>
            {mode === 'note' ? 'TITLE (OPTIONAL)' : 'TITLE (OPTIONAL)'}
          </Text>
          <View style={styles.titleRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={
                mode === 'youtube'
                  ? 'Auto-detected from YouTube...'
                  : mode === 'note'
                    ? 'e.g. Dragon mast rake notes'
                    : 'e.g. North Sails downwind article'
              }
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={[styles.input, styles.titleInput]}
            />
            {fetchingMeta && (
              <ActivityIndicator
                size="small"
                color={IOS_COLORS.systemGray}
                style={styles.titleSpinner}
              />
            )}
          </View>

          {mode === 'note' && (
            <>
              <Text style={styles.label}>NOTE</Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Jot down what you learned, observed, or want to remember..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoFocus
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerBtn: {
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    textAlign: 'right',
  },
  saveTextDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
  body: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  modePillActive: {
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}30`,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  modePillTextActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.lg,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  heroSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    color: IOS_COLORS.secondaryLabel,
    maxWidth: 320,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.sm,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    fontSize: 15,
    color: IOS_COLORS.label,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray4,
  },
  titleRow: {
    position: 'relative',
  },
  titleInput: {
    paddingRight: 36,
  },
  titleSpinner: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  textArea: {
    minHeight: 120,
    paddingTop: IOS_SPACING.md,
  },
});
