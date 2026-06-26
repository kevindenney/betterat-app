/**
 * CaptureSheet (D40, Emily Phone 4) — quick-capture modal.
 *
 * Four input modes: Link / Upload / Photo / Paste.
 * After capture, auto-detected topic tags (purple chips), editable
 * source/year, and an optional attach-to picker (Standalone /
 * Concept / Step). The same sheet is reachable from the Library
 * home "Drop something in" card and from any step's "Add from
 * library" row.
 *
 * Wave 2f: UI only — write to library_items lands in a follow-up.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { fetchOEmbedMetadata } from '@/lib/oEmbed';
import { filenameToTitle } from '@/lib/utils/filenameToTitle';
import { FORMAT_ICON, FORMAT_TINT } from './formatStyles';
import {
  deriveKindFromUrl,
  hostnameOf,
  kindFromMime,
  titleFromPastedText,
  titleFromUrl,
} from './capturePayloadMap';
import type { LibraryFormat } from './types';
import {
  pickFile,
  pickImage,
  uploadFile,
  type PickedFile,
} from '@/services/LibraryUploadService';

/** A trimmed value reads as a URL when it has a scheme or a bare domain. */
function looksLikeUrl(value: string): boolean {
  const t = value.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|\?|$)/i.test(t);
}

/** Prepend https:// to a bare domain so URL parsing and oEmbed work. */
function normalizeUrl(value: string): string {
  const t = value.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const FORMAT_LABEL: Record<LibraryFormat, string> = {
  pdf: 'PDF',
  video: 'Video',
  book: 'Book',
  link: 'Link',
  audio: 'Audio',
  article: 'Article',
  note: 'Note',
  image: 'Image',
};

type CaptureMode = 'link' | 'upload' | 'photo' | 'paste';
type AttachTo = 'standalone' | 'concept' | 'step';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: (payload: {
    mode: CaptureMode;
    attachTo: AttachTo;
    tags: string[];
    title?: string;
    /** Populated when mode === 'link'. */
    url?: string;
    /** Populated when mode === 'paste'. */
    pastedText?: string;
    /** Populated when mode === 'upload' or 'photo' after successful upload. */
    upload?: {
      publicUrl: string;
      mimeType: string;
      fileName: string;
      sizeBytes: number;
    };
    /** Interest ids selected via the "Relevant for" chip row. Caller writes
     *  these into library_item_interests so the M2M scope lands at capture
     *  time (no untagged-everywhere fallback). */
    interestIds: string[];
    /** Populated for link mode when YouTube/Vimeo oEmbed returns metadata. */
    oEmbed?: { title?: string; thumbnailUrl?: string };
  }) => void;
}

export function CaptureSheet({ visible, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userInterests, currentInterest } = useInterest();
  // One smart field for the common case (paste a URL or text); file/photo are
  // secondary affordances that set `picked` instead.
  const [smartText, setSmartText] = useState('');
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [pickedKind, setPickedKind] = useState<'upload' | 'photo'>('upload');
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachTo, setAttachTo] = useState<AttachTo>('standalone');
  const [title, setTitle] = useState('');
  // oEmbed result for the typed URL, resolved on blur to enrich the live
  // preview (real title + thumbnail). Null until/unless one resolves.
  const [linkMeta, setLinkMeta] = useState<{
    title?: string;
    thumbnailUrl?: string;
  } | null>(null);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [interestIds, setInterestIds] = useState<Set<string>>(() =>
    currentInterest ? new Set([currentInterest.id]) : new Set(),
  );

  // Keep the chip preselection aligned with the active interest each time
  // the sheet opens. Only re-seeds on visible→true transitions so the
  // user's mid-capture chip toggles aren't reset on re-render.
  React.useEffect(() => {
    if (!visible) return;
    setSmartText('');
    setTitle('');
    setPicked(null);
    setPickError(null);
    setLinkMeta(null);
    setInterestIds(currentInterest ? new Set([currentInterest.id]) : new Set());
    // intentionally omit currentInterest to avoid wiping toggles mid-sheet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleInterest = (id: string) => {
    setInterestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePick = async (kind: 'file' | 'image' | 'camera') => {
    setPickError(null);
    try {
      const result =
        kind === 'file'
          ? await pickFile()
          : await pickImage({ fromCamera: kind === 'camera' });
      if (result) {
        setPicked(result);
        setPickedKind(kind === 'file' ? 'upload' : 'photo');
        setSmartText('');
        setLinkMeta(null);
      }
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err));
    }
  };

  // Resolve a typed URL's oEmbed metadata on blur so the preview card can show
  // a real title + thumbnail before saving. File-like URLs (PDF/CSV/…) don't
  // oEmbed, so we skip the fetch and let the preview derive from the filename.
  const handleResolveLink = async () => {
    if (picked || !looksLikeUrl(smartText)) return;
    const url = normalizeUrl(smartText);
    if (/\.(pdf|csv|xlsx?|docx?|pptx?|txt)(\?|$)/i.test(url)) return;
    setResolvingLink(true);
    try {
      const meta = await fetchOEmbedMetadata(url);
      setLinkMeta(
        meta ? { title: meta.title, thumbnailUrl: meta.thumbnailUrl } : null,
      );
    } finally {
      setResolvingLink(false);
    }
  };

  // The detected capture mode — drives the preview and the save payload so
  // what the user sees is exactly what lands in the library.
  const detectedMode: CaptureMode | null = picked
    ? pickedKind
    : looksLikeUrl(smartText)
    ? 'link'
    : smartText.trim().length > 0
    ? 'paste'
    : null;

  // Resolved preview of what will be saved (format/title/source/thumb).
  const preview = useMemo(() => {
    if (picked) {
      const format =
        pickedKind === 'photo'
          ? 'image'
          : kindFromMime(picked.mimeType, 'upload');
      return {
        format,
        title: title.trim() || filenameToTitle(picked.name),
        source: pickedKind === 'photo' ? 'Photo' : 'Uploaded file',
        meta: formatBytes(picked.size),
        thumb: null as string | null,
      };
    }
    const t = smartText.trim();
    if (!t) return null;
    if (looksLikeUrl(t)) {
      const url = normalizeUrl(t);
      return {
        format: deriveKindFromUrl(url),
        title: title.trim() || linkMeta?.title?.trim() || titleFromUrl(url),
        source: hostnameOf(url) ?? 'Link',
        meta: '',
        thumb: linkMeta?.thumbnailUrl ?? null,
      };
    }
    return {
      format: 'note' as LibraryFormat,
      title: title.trim() || titleFromPastedText(t),
      source: 'Pasted note',
      meta: `${t.length} characters`,
      thumb: null as string | null,
    };
  }, [picked, pickedKind, smartText, title, linkMeta]);

  const canSave = detectedMode !== null;

  const handleSubmit = async () => {
    if (!detectedMode) return;
    const mode = detectedMode;
    let upload:
      | { publicUrl: string; mimeType: string; fileName: string; sizeBytes: number }
      | undefined;
    let titleFromUpload: string | undefined;
    let oEmbed: { title?: string; thumbnailUrl?: string } | undefined;
    if (mode === 'link') {
      const url = normalizeUrl(smartText);
      // Reuse the preview's resolved metadata; fetch only if blur didn't run.
      if (linkMeta) {
        oEmbed = linkMeta;
      } else {
        setUploading(true);
        const meta = await fetchOEmbedMetadata(url);
        setUploading(false);
        if (meta) oEmbed = { title: meta.title, thumbnailUrl: meta.thumbnailUrl };
      }
    }
    if ((mode === 'upload' || mode === 'photo') && picked) {
      if (!user?.id) {
        showAlert('Sign in required', 'Capture needs an authenticated user.');
        return;
      }
      setUploading(true);
      try {
        const result = await uploadFile(user.id, picked);
        if (!result.metadata.public_url) {
          throw new Error('Upload succeeded but no public URL was returned.');
        }
        upload = {
          publicUrl: result.metadata.public_url,
          mimeType: result.metadata.mime_type,
          fileName: result.metadata.original_filename,
          sizeBytes: result.metadata.file_size,
        };
        titleFromUpload = result.suggestedTitle;
      } catch (err) {
        showAlert(
          'Upload failed',
          err instanceof Error ? err.message : String(err),
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    onSave?.({
      mode,
      attachTo,
      tags: [],
      title: title.trim() || titleFromUpload || oEmbed?.title,
      url: mode === 'link' ? normalizeUrl(smartText) : undefined,
      pastedText: mode === 'paste' ? smartText.trim() : undefined,
      upload,
      interestIds: Array.from(interestIds),
      oEmbed,
    });
    setSmartText('');
    setTitle('');
    setPicked(null);
    setLinkMeta(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>
        <View style={styles.chrome}>
          <TouchableOpacity hitSlop={8} onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerSparkle}>
              <Ionicons name="sparkles" size={22} color="#5C2DAA" />
            </View>
            <Text style={styles.headerTitle}>Add to your Library</Text>
            <Text style={styles.headerSub}>
              Link, file, photo of a page, or paste text.
            </Text>
          </View>

          {!picked ? (
            <View style={styles.inputBlock}>
              <TextInput
                value={smartText}
                onChangeText={setSmartText}
                onBlur={handleResolveLink}
                placeholder="Paste a link or any text — youtube.com, a PDF URL, a quote…"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={[styles.input, styles.inputMulti]}
                autoCapitalize="none"
                multiline
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {!picked && smartText.trim().length === 0 ? (
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.6}
                onPress={() => handlePick('file')}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={18}
                  color={IOS_COLORS.secondaryLabel}
                />
                <Text style={styles.secondaryBtnText}>File</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.6}
                onPress={() => handlePick('camera')}
              >
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color={IOS_COLORS.secondaryLabel}
                />
                <Text style={styles.secondaryBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.6}
                onPress={() => handlePick('image')}
              >
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={IOS_COLORS.secondaryLabel}
                />
                <Text style={styles.secondaryBtnText}>Photo</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {pickError ? (
            <Text style={styles.pickError}>{pickError}</Text>
          ) : null}

          {preview ? (
            <View style={styles.preview}>
              <View style={styles.previewEyebrowRow}>
                <Ionicons name="sparkles" size={12} color="#5C2DAA" />
                <Text style={styles.previewEyebrow}>
                  Auto-detected · {FORMAT_LABEL[preview.format]}
                </Text>
                {resolvingLink ? (
                  <ActivityIndicator
                    size="small"
                    color={IOS_COLORS.tertiaryLabel}
                  />
                ) : null}
              </View>
              <View style={styles.previewCard}>
                <View
                  style={[
                    styles.previewThumb,
                    { backgroundColor: `${FORMAT_TINT[preview.format]}1F` },
                  ]}
                >
                  {preview.thumb ? (
                    <Image
                      source={{ uri: preview.thumb }}
                      style={styles.previewThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name={FORMAT_ICON[preview.format]}
                      size={22}
                      color={FORMAT_TINT[preview.format]}
                    />
                  )}
                </View>
                <View style={styles.previewBody}>
                  <Text style={styles.previewTitle} numberOfLines={2}>
                    {preview.title}
                  </Text>
                  <Text style={styles.previewMeta} numberOfLines={1}>
                    {preview.source}
                    {preview.meta ? ` · ${preview.meta}` : ''}
                  </Text>
                </View>
                {picked ? (
                  <TouchableOpacity hitSlop={6} onPress={() => setPicked(null)}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={IOS_COLORS.tertiaryLabel}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Rename — or keep the auto-name"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={styles.previewRename}
              />
            </View>
          ) : null}

          {userInterests.length > 0 ? (
            <View style={styles.relevantFor}>
              <Text style={styles.relevantForLbl}>Relevant for</Text>
              <View style={styles.relevantChips}>
                {userInterests.map((i) => {
                  const on = interestIds.has(i.id);
                  return (
                    <TouchableOpacity
                      key={i.id}
                      activeOpacity={0.7}
                      onPress={() => toggleInterest(i.id)}
                      style={[styles.relChip, on ? styles.relChipOn : null]}
                    >
                      {on ? (
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      ) : null}
                      <Text
                        style={[
                          styles.relChipLabel,
                          on ? styles.relChipLabelOn : null,
                        ]}
                      >
                        {i.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.relevantHint}>
                {interestIds.size === 0
                  ? 'Untagged — will show in every interest. Tap to scope.'
                  : `Tagged for ${interestIds.size} interest${interestIds.size === 1 ? '' : 's'}.`}
              </Text>
            </View>
          ) : null}

          <View style={styles.attach}>
            <Text style={styles.attachLbl}>Attach to</Text>
            <View style={styles.attachOpts}>
              {(['standalone', 'concept', 'step'] as AttachTo[]).map((opt) => {
                const isActive = attachTo === opt;
                const label =
                  opt === 'standalone'
                    ? 'Standalone'
                    : opt === 'concept'
                    ? 'Concept'
                    : 'Step';
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setAttachTo(opt)}
                    activeOpacity={0.7}
                    style={[styles.attachOpt, isActive ? styles.attachOptActive : null]}
                  >
                    <Text
                      style={[
                        styles.attachOptText,
                        isActive ? styles.attachOptTextActive : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.attachHint}>
              It'll be added to your library either way — attaching links it as a
              starting source.
            </Text>
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!canSave || uploading}
            onPress={handleSubmit}
            style={[styles.cta, (!canSave || uploading) ? styles.ctaDisabled : null]}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.ctaText}>Add to Library</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.ctaFoot}>
            {uploading
              ? 'Uploading…'
              : "We'll tag this against your interest and you can refine from the detail screen."}
          </Text>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,67,0.25)',
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 6,
  },
  cancel: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    alignItems: 'center',
    paddingTop: 4,
    gap: 4,
  },
  headerSparkle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  pickError: {
    marginTop: 6,
    fontSize: 12,
    color: '#FF3B30',
  },
  preview: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  previewEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewEyebrow: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: '#5C2DAA',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewThumbImg: {
    ...StyleSheet.absoluteFillObject,
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
  previewMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  previewRename: {
    fontSize: 14,
    color: IOS_COLORS.label,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  inputBlock: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  input: {
    fontSize: 15,
    color: IOS_COLORS.label,
    minHeight: 36,
    padding: 0,
  },
  inputMulti: {
    minHeight: 96,
  },
  attach: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  relevantFor: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  relevantForLbl: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  relevantChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  relChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  relChipOn: {
    backgroundColor: IOS_COLORS.label,
  },
  relChipLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  relChipLabelOn: {
    color: '#FFFFFF',
  },
  relevantHint: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  attachLbl: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  attachOpts: {
    flexDirection: 'row',
    gap: 6,
  },
  attachOpt: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  attachOptActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  attachOptText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  attachOptTextActive: {
    color: '#FFFFFF',
  },
  attachHint: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.2)',
    backgroundColor: IOS_COLORS.systemBackground,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.15,
  },
  ctaFoot: {
    textAlign: 'center',
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    paddingTop: 6,
    paddingBottom: 4,
  },
});
