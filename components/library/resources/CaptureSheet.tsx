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

type CaptureMode = 'link' | 'upload' | 'photo' | 'paste';
type AttachTo = 'standalone' | 'concept' | 'step';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: (payload: {
    mode: CaptureMode;
    attachTo: AttachTo;
    tags: string[];
    title?: string;
  }) => void;
}

const DEMO_TAGS = ['Sepsis', 'Septic shock', 'Lactate', 'Critical care'];

export function CaptureSheet({ visible, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<CaptureMode>('upload');
  const [hasFile, setHasFile] = useState(true);
  const [attachTo, setAttachTo] = useState<AttachTo>('standalone');
  const [pastedText, setPastedText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

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

          <ModeTabs mode={mode} onChange={setMode} />

          {mode === 'upload' ? (
            <View>
              <TouchableOpacity
                activeOpacity={0.6}
                style={styles.dropZone}
                onPress={() => setHasFile(true)}
              >
                <Ionicons name="cloud-upload-outline" size={26} color={IOS_COLORS.tertiaryLabel} />
                <Text style={styles.dropZoneText}>
                  Drop PDF, EPUB, audio · or tap
                </Text>
              </TouchableOpacity>

              {hasFile ? (
                <View style={styles.uploaded}>
                  <View style={styles.uploadedGlyph}>
                    <Text style={styles.uploadedGlyphText}>PDF</Text>
                  </View>
                  <View style={styles.uploadedBody}>
                    <Text style={styles.uploadedTitle} numberOfLines={1}>
                      AACN-PracticeAlert-SevereSepsis.pdf
                    </Text>
                    <Text style={styles.uploadedMeta}>
                      8 pages · 1.2 MB · just now
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={6}
                    onPress={() => setHasFile(false)}
                  >
                    <Ionicons name="close-circle" size={18} color={IOS_COLORS.tertiaryLabel} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : mode === 'link' ? (
            <View style={styles.inputBlock}>
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="Paste a URL — youtube.com, nejm.org, …"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          ) : mode === 'photo' ? (
            <TouchableOpacity style={styles.dropZone} activeOpacity={0.6}>
              <Ionicons name="camera-outline" size={26} color={IOS_COLORS.tertiaryLabel} />
              <Text style={styles.dropZoneText}>
                Snap a textbook page · OCR detects title & topics
              </Text>
            </TouchableOpacity>
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

          {hasFile && mode === 'upload' ? (
            <View style={styles.autoMeta}>
              <View style={styles.autoEyebrow}>
                <Ionicons name="sparkles" size={12} color="#5C2DAA" />
                <Text style={styles.autoEyebrowText}>Detected · from the PDF</Text>
              </View>
              <View style={styles.tagRow}>
                {DEMO_TAGS.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Ionicons name="pricetag-outline" size={10} color="#5C2DAA" />
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLbl}>Source</Text>
                <View style={styles.metaValRow}>
                  <Text style={styles.metaVal}>AACN</Text>
                  <Ionicons name="pencil" size={11} color={IOS_COLORS.tertiaryLabel} />
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLbl}>Year</Text>
                <View style={styles.metaValRow}>
                  <Text style={styles.metaVal}>2025</Text>
                  <Ionicons name="pencil" size={11} color={IOS_COLORS.tertiaryLabel} />
                </View>
              </View>
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

          <View style={styles.collPick}>
            <Text style={styles.collLbl}>Collection</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.collPickBtn}>
              <Text style={styles.collPickText}>Sepsis & rapid response · 12</Text>
              <Ionicons name="chevron-down" size={14} color={IOS_COLORS.tertiaryLabel} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              onSave?.({
                mode,
                attachTo,
                tags: DEMO_TAGS,
                title: 'AACN Practice Alert · Severe Sepsis',
              });
              onClose();
            }}
            style={styles.cta}
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.ctaText}>Add to Library</Text>
          </TouchableOpacity>
          <Text style={styles.ctaFoot}>
            We'll extract excerpts and tag this against your playbook.
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
    fontWeight: '700',
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
  dropZoneText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
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
  uploadedGlyphText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF3B30',
    letterSpacing: 0.5,
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
    fontWeight: '700',
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
  attachLbl: {
    fontSize: 12,
    fontWeight: '700',
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
  collPick: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  collLbl: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  collPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  collPickText: {
    fontSize: 14,
    color: IOS_COLORS.label,
    fontWeight: '500',
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
