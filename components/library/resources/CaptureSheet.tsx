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

import React, { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { fetchOEmbedMetadata } from '@/lib/oEmbed';
import {
  pickFile,
  pickImage,
  uploadFile,
  type PickedFile,
} from '@/services/LibraryUploadService';

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

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
  } catch {
    return '';
  }
}

function filenameToTitle(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CaptureSheet({ visible, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userInterests, currentInterest } = useInterest();
  const [mode, setMode] = useState<CaptureMode>('link');
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachTo, setAttachTo] = useState<AttachTo>('standalone');
  const [pastedText, setPastedText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [title, setTitle] = useState('');
  const [autoFillingTitle, setAutoFillingTitle] = useState(false);
  const [interestIds, setInterestIds] = useState<Set<string>>(() =>
    currentInterest ? new Set([currentInterest.id]) : new Set(),
  );

  // Keep the chip preselection aligned with the active interest each time
  // the sheet opens. Only re-seeds on visible→true transitions so the
  // user's mid-capture chip toggles aren't reset on re-render.
  React.useEffect(() => {
    if (!visible) return;
    setTitle('');
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

  const handleModeChange = (next: CaptureMode) => {
    if (next !== mode) {
      // Drop any picked file when switching modes so we don't carry stale
      // upload state into a different capture flow.
      setPicked(null);
      setPickError(null);
    }
    setMode(next);
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
        if (!title.trim()) setTitle(filenameToTitle(result.name));
      }
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err));
    }
  };

  // Auto-name a link from its oEmbed title, or — for file-like URLs that don't
  // oEmbed (PDFs, CSVs, spreadsheets) — from the cleaned-up filename. Never
  // clobbers a name the user already typed.
  const handleAutoFillTitle = async () => {
    const url = linkUrl.trim();
    if (!url || title.trim()) return;
    const fileName = fileNameFromUrl(url);
    if (fileName && /\.(pdf|csv|xlsx?|docx?|pptx?|txt)$/i.test(fileName)) {
      setTitle(filenameToTitle(fileName));
      return;
    }
    setAutoFillingTitle(true);
    try {
      const meta = await fetchOEmbedMetadata(url);
      if (meta?.title && !title.trim()) setTitle(meta.title);
      else if (fileName && !title.trim()) setTitle(filenameToTitle(fileName));
    } finally {
      setAutoFillingTitle(false);
    }
  };

  const canSave =
    (mode === 'link' && linkUrl.trim().length > 0)
    || (mode === 'paste' && pastedText.trim().length > 0)
    || ((mode === 'upload' || mode === 'photo') && picked !== null);

  const handleSubmit = async () => {
    if (!canSave) return;
    let upload:
      | { publicUrl: string; mimeType: string; fileName: string; sizeBytes: number }
      | undefined;
    let titleFromUpload: string | undefined;
    let oEmbed: { title?: string; thumbnailUrl?: string } | undefined;
    if (mode === 'link' && linkUrl.trim()) {
      // Best-effort enrichment — failure is silent and we fall back to
      // hostname-only title plus a colored preview spine.
      setUploading(true);
      const meta = await fetchOEmbedMetadata(linkUrl.trim());
      setUploading(false);
      if (meta) {
        oEmbed = {
          title: meta.title,
          thumbnailUrl: meta.thumbnailUrl,
        };
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
      url: mode === 'link' ? linkUrl.trim() : undefined,
      pastedText: mode === 'paste' ? pastedText.trim() : undefined,
      upload,
      interestIds: Array.from(interestIds),
      oEmbed,
    });
    setLinkUrl('');
    setPastedText('');
    setPicked(null);
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

          <ModeTabs mode={mode} onChange={handleModeChange} />

          {mode === 'upload' ? (
            <View>
              <TouchableOpacity
                activeOpacity={0.6}
                style={styles.dropZone}
                onPress={() => handlePick('file')}
              >
                <Ionicons name="cloud-upload-outline" size={26} color={IOS_COLORS.tertiaryLabel} />
                <Text style={styles.dropZoneText}>
                  Tap to pick a PDF, image, or document
                </Text>
              </TouchableOpacity>

              {picked ? (
                <View style={styles.uploaded}>
                  <View style={styles.uploadedGlyph}>
                    <Text style={styles.uploadedGlyphText}>
                      {(picked.mimeType.split('/')[1] ?? 'FILE')
                        .slice(0, 4)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.uploadedBody}>
                    <Text style={styles.uploadedTitle} numberOfLines={1}>
                      {picked.name}
                    </Text>
                    <Text style={styles.uploadedMeta}>
                      {formatBytes(picked.size)} · ready to upload
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={6}
                    onPress={() => setPicked(null)}
                  >
                    <Ionicons name="close-circle" size={18} color={IOS_COLORS.tertiaryLabel} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {pickError ? (
                <Text style={styles.pickError}>{pickError}</Text>
              ) : null}
            </View>
          ) : mode === 'link' ? (
            <View style={styles.inputBlock}>
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                onBlur={handleAutoFillTitle}
                placeholder="Paste a URL — youtube.com, nejm.org, …"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          ) : mode === 'photo' ? (
            <View>
              <View style={styles.photoRow}>
                <TouchableOpacity
                  style={[styles.dropZone, styles.dropZoneHalf]}
                  activeOpacity={0.6}
                  onPress={() => handlePick('camera')}
                >
                  <Ionicons name="camera-outline" size={26} color={IOS_COLORS.tertiaryLabel} />
                  <Text style={styles.dropZoneText}>Take a photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropZone, styles.dropZoneHalf]}
                  activeOpacity={0.6}
                  onPress={() => handlePick('image')}
                >
                  <Ionicons name="image-outline" size={26} color={IOS_COLORS.tertiaryLabel} />
                  <Text style={styles.dropZoneText}>Pick from library</Text>
                </TouchableOpacity>
              </View>
              {picked ? (
                <View style={styles.uploaded}>
                  <View style={[styles.uploadedGlyph, styles.uploadedGlyphImage]}>
                    <Text style={styles.uploadedGlyphText}>IMG</Text>
                  </View>
                  <View style={styles.uploadedBody}>
                    <Text style={styles.uploadedTitle} numberOfLines={1}>
                      {picked.name}
                    </Text>
                    <Text style={styles.uploadedMeta}>
                      {formatBytes(picked.size)} · ready to upload
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={6}
                    onPress={() => setPicked(null)}
                  >
                    <Ionicons name="close-circle" size={18} color={IOS_COLORS.tertiaryLabel} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {pickError ? (
                <Text style={styles.pickError}>{pickError}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.inputBlock}>
              <TextInput
                value={pastedText}
                onChangeText={setPastedText}
                placeholder="Paste any text or quote here…"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={[styles.input, styles.inputMulti]}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          <View style={styles.titleBlock}>
            <View style={styles.titleLblRow}>
              <Text style={styles.titleLbl}>Name</Text>
              {autoFillingTitle ? (
                <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
              ) : null}
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="We'll fill this in — or name it yourself"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
            />
          </View>

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

function ModeTabs({
  mode,
  onChange,
}: {
  mode: CaptureMode;
  onChange: (m: CaptureMode) => void;
}) {
  const modes: { key: CaptureMode; label: string }[] = [
    { key: 'link', label: 'Link' },
    { key: 'upload', label: 'Upload' },
    { key: 'photo', label: 'Photo' },
    { key: 'paste', label: 'Paste' },
  ];
  return (
    <View style={styles.modeRow}>
      {modes.map((m) => {
        const isActive = m.key === mode;
        return (
          <TouchableOpacity
            key={m.key}
            onPress={() => onChange(m.key)}
            activeOpacity={0.7}
            style={[styles.modeBtn, isActive ? styles.modeBtnActive : null]}
          >
            <Text
              style={[
                styles.modeBtnText,
                isActive ? styles.modeBtnTextActive : null,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
  modeRow: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: IOS_COLORS.systemBackground,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  modeBtnTextActive: {
    color: IOS_COLORS.label,
  },
  dropZone: {
    height: 116,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(60,60,67,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dropZoneHalf: {
    flex: 1,
  },
  dropZoneText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickError: {
    marginTop: 6,
    fontSize: 12,
    color: '#FF3B30',
  },
  uploaded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 8,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  uploadedGlyph: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255,59,48,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedGlyphImage: {
    backgroundColor: 'rgba(255,204,0,0.18)',
  },
  uploadedGlyphText: {
    fontSize: 9,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: '#FF3B30',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  uploadedBody: {
    flex: 1,
    minWidth: 0,
  },
  uploadedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  uploadedMeta: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
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
  autoMeta: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  autoEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  autoEyebrowText: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: '#5C2DAA',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C2DAA',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLbl: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  metaValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  attach: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  titleBlock: {
    gap: 6,
  },
  titleLblRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLbl: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
