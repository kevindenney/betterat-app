/**
 * InspirationCaptureStep — Step 1 of the wizard.
 *
 * One dump-in box for pasted text, URLs, and PDF attachments. The extractor
 * decides what is useful; this screen only normalizes source metadata.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { IOS_COLORS, IOS_SPACING, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { extractInspiration } from '@/services/InspirationService';
import { documentStorageService } from '@/services/storage/DocumentStorageService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  GetInspiredRunningScreen,
  IOSRegisterErrorState,
} from '@/components/ios-register';
import type { GetInspiredSourceKind } from '@/components/ios-register/GetInspiredRunningScreen';
import { resolveInterestVocab } from '@/components/ios-register/timeline-zoom/interestVocab';
import { getAnchorsForRange } from '@/components/ios-register/timeline-zoom/interestAnchors';
import type {
  InspirationAttachment,
  InspirationExtraction,
  InspirationContentType,
} from '@/types/inspiration';

type GetInspiredErrorKind = 'network' | 'input' | 'system';

function classifyGetInspiredError(error: unknown): GetInspiredErrorKind {
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  if (
    message.includes('invalid') ||
    message.includes('unsupported') ||
    message.includes('empty') ||
    message.includes('link') ||
    message.includes('url')
  ) {
    return 'input';
  }
  return 'system';
}

interface GetInspiredErrorViewState {
  kind: GetInspiredErrorKind;
  source: string;
}

type ErrorVariantSpec = {
  glyph: React.ComponentProps<typeof Ionicons>['name'];
  headline: string;
  supportingText: string;
  primaryLabel: string;
  primaryIcon?: React.ComponentProps<typeof Ionicons>['name'];
  primaryAction: 'retry' | 'goBack';
  secondaryLabel: string;
  secondaryAction: 'tryDifferent' | 'goBack';
};

const ERROR_VARIANTS: Record<GetInspiredErrorKind, ErrorVariantSpec> = {
  network: {
    glyph: 'cloud-offline-outline',
    headline: "We couldn't reach the server.",
    supportingText:
      "Your connection dropped while we were reading what you sent. Nothing's lost — try again as soon as you're back.",
    primaryLabel: 'Try again',
    primaryIcon: 'refresh',
    primaryAction: 'retry',
    secondaryLabel: 'Use a different source',
    secondaryAction: 'tryDifferent',
  },
  input: {
    glyph: 'document-text-outline',
    headline: "This source doesn't have enough practice material.",
    supportingText:
      'Paste text, drop a source URL, or attach a PDF with dates, milestones, or concrete work to unpack.',
    primaryLabel: 'Try again',
    primaryIcon: 'refresh',
    primaryAction: 'retry',
    secondaryLabel: 'Clear source',
    secondaryAction: 'tryDifferent',
  },
  system: {
    glyph: 'construct-outline',
    headline: 'We hit an issue building your plan.',
    supportingText:
      "Something on our side didn't work this time. Our team can see it — try again in a few minutes.",
    primaryLabel: 'Try again',
    primaryIcon: 'refresh',
    primaryAction: 'retry',
    secondaryLabel: 'Go back',
    secondaryAction: 'goBack',
  },
};

interface InspirationCaptureInterestContext {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}

interface InspirationCaptureStepProps {
  userId?: string | null;
  userInterestSlugs: string[];
  currentInterest?: InspirationCaptureInterestContext | null;
  onComplete: (
    extraction: InspirationExtraction,
    content: string,
    contentType: InspirationContentType,
  ) => void;
  registerAbortHandler?: (handler: (() => void) | null) => void;
}

function detectContentType(value: string): InspirationContentType {
  return /^https?:\/\/\S+$/i.test(value.trim()) ? 'url' : 'text';
}

function calendarAnchorWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 2, 11, 31));
  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
    referenceISO: now.toISOString().slice(0, 10),
  };
}

export function InspirationCaptureStep({
  userId,
  userInterestSlugs,
  currentInterest,
  onComplete,
  registerAbortHandler,
}: InspirationCaptureStepProps) {
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<InspirationAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorState, setErrorState] = useState<GetInspiredErrorViewState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const detectedType = useMemo(() => detectContentType(inputValue), [inputValue]);
  const hasSource = Boolean(inputValue.trim()) || attachments.length > 0;
  const isDisabled = !hasSource || loading || uploading;

  const personaPayload = useMemo(() => {
    const vocab = resolveInterestVocab(currentInterest?.slug, currentInterest?.name);
    const window = calendarAnchorWindow();
    return {
      vocab: {
        id: vocab.id,
        periodNoun: vocab.periodNoun,
        anchorNoun: vocab.anchorNoun,
        crewHeader: vocab.crewHeader,
        capabilityHeader: vocab.capabilityHeader,
        visionPrompt: vocab.visionPrompt,
      },
      anchors: getAnchorsForRange(vocab.id, window.startISO, window.endISO, window.referenceISO),
    };
  }, [currentInterest?.name, currentInterest?.slug]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!registerAbortHandler) return;
    registerAbortHandler(() => {
      abortControllerRef.current?.abort();
    });
    return () => {
      registerAbortHandler(null);
    };
  }, [registerAbortHandler]);

  const handleAttachPdf = useCallback(async () => {
    if (!userId) {
      showAlert('Sign in required', 'Please sign in before attaching a PDF.');
      return;
    }
    setUploading(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const file = picked.assets[0];
      const result = await documentStorageService.uploadDocument(userId, file);
      if (!result.success || !result.document) {
        throw new Error(result.error ?? 'Could not upload PDF.');
      }

      const stored = result.document as unknown as Record<string, unknown>;
      setAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          mime: file.mimeType ?? 'application/pdf',
          storage_path: String(stored.storage_path ?? stored.file_path ?? ''),
          public_url: String(stored.public_url ?? stored.url ?? '') || null,
        },
      ]);
    } catch (err) {
      showAlert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not attach that PDF.',
      );
    } finally {
      setUploading(false);
    }
  }, [userId]);

  const handleAnalyze = useCallback(async () => {
    if (!hasSource) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorState(null);
    setLoading(true);
    const messages = [
      'Reading your dump...',
      'Finding dated anchors...',
      'Building your plan...',
    ];
    let msgIndex = 0;
    setLoadingMessage(messages[0]);

    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, messages.length - 1);
      setLoadingMessage(messages[msgIndex]);
    }, 3000);

    const content = inputValue.trim() || attachments.map((a) => a.filename).join(', ');
    const contentType = inputValue.trim() ? detectedType : 'text';

    try {
      const extraction = await extractInspiration(
        {
          content_type: contentType,
          content,
          user_existing_interest_slugs: userInterestSlugs,
          attachments,
          interest_id: currentInterest?.id ?? null,
          interest_slug: currentInterest?.slug ?? null,
          interest_label: currentInterest?.name ?? null,
          persona_vocabulary: personaPayload.vocab as unknown as Record<string, unknown>,
          recurring_anchors: personaPayload.anchors as unknown as Record<string, unknown>[],
        },
        { signal: controller.signal },
      );

      onComplete(extraction, content, contentType);
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;

      if (FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
        setErrorState({
          kind: classifyGetInspiredError(err),
          source: content,
        });
      } else {
        showAlert(
          'Extraction Failed',
          err instanceof Error
            ? err.message
            : 'Could not analyze the content. Try pasting the text directly.',
        );
      }
    } finally {
      clearInterval(interval);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
        setLoadingMessage('');
      }
    }
  }, [
    attachments,
    currentInterest?.id,
    currentInterest?.name,
    currentInterest?.slug,
    detectedType,
    hasSource,
    inputValue,
    onComplete,
    personaPayload,
    userInterestSlugs,
  ]);

  const handleErrorRetry = useCallback(() => {
    setErrorState(null);
    void handleAnalyze();
  }, [handleAnalyze]);

  const handleErrorTryDifferent = useCallback(() => {
    setErrorState(null);
    setInputValue('');
    setAttachments([]);
  }, []);

  const handleErrorGoBack = useCallback(() => {
    setErrorState(null);
  }, []);

  if (errorState && FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
    const variant = ERROR_VARIANTS[errorState.kind];
    return (
      <IOSRegisterErrorState
        glyph={variant.glyph}
        headline={variant.headline}
        supportingText={variant.supportingText}
        primaryAction={{
          label: variant.primaryLabel,
          icon: variant.primaryIcon,
          onPress: variant.primaryAction === 'retry' ? handleErrorRetry : handleErrorGoBack,
        }}
        secondaryAction={{
          label: variant.secondaryLabel,
          onPress: variant.secondaryAction === 'goBack' ? handleErrorGoBack : handleErrorTryDifferent,
        }}
      >
        <View style={styles.errorRef}>
          <View style={styles.errorRefIco}>
            <Ionicons name="document-text-outline" size={16} color={IOS_REGISTER.labelSecondary} />
          </View>
          <View style={styles.errorRefMeta}>
            <Text style={styles.errorRefTop}>YOU SENT</Text>
            <Text style={styles.errorRefSource} numberOfLines={1}>
              {errorState.source || '(PDF attachment)'}
            </Text>
          </View>
        </View>
      </IOSRegisterErrorState>
    );
  }

  if (loading && FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
    const hasText = Boolean(inputValue.trim());
    const sourceKind: GetInspiredSourceKind = hasText
      ? detectedType === 'url'
        ? 'url'
        : 'text'
      : 'file';
    return (
      <GetInspiredRunningScreen
        embedded
        submittedUrl={inputValue.trim() || attachments.map((a) => a.filename).join(', ')}
        sourceKind={sourceKind}
        onStop={() => {
          abortControllerRef.current?.abort();
        }}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={26} color={IOS_COLORS.systemBlue} />
        </View>
        <Text style={styles.heroTitle}>Drop in anything with a timeline</Text>
        <Text style={styles.heroSubtitle}>
          Paste a syllabus, notice of race, practice log, order list, URL, or PDF. BetterAt will look for dates, seasons, recurring anchors, and ordered work.
        </Text>
      </View>

      <View style={styles.captureCard}>
        <Text style={styles.label}>SOURCE</Text>
        <Text style={styles.helperText}>
          URLs are detected automatically. PDF is supported in this version; spreadsheets, slide decks, and Blackboard exports come later.
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Paste text or a URL..."
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <View style={styles.attachmentHeader}>
          <Text style={styles.detectedText}>
            {detectedType === 'url' ? 'Detected URL source' : 'Text dump source'}
          </Text>
          <Pressable
            onPress={handleAttachPdf}
            disabled={uploading || loading}
            style={[styles.attachButton, (uploading || loading) && styles.buttonDisabled]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            ) : (
              <Ionicons name="attach" size={16} color={IOS_COLORS.systemBlue} />
            )}
            <Text style={styles.attachButtonText}>Attach PDF</Text>
          </Pressable>
        </View>

        {attachments.length > 0 && (
          <View style={styles.attachmentList}>
            {attachments.map((attachment, index) => (
              <View key={`${attachment.storage_path}-${index}`} style={styles.attachmentRow}>
                <Ionicons name="document-text-outline" size={16} color={IOS_COLORS.systemBlue} />
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {attachment.filename}
                </Text>
                <Pressable
                  onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.promiseCard}>
          <Ionicons name="calendar-outline" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.promiseText}>
            You will review the proposed interest, blueprint, and calendar before anything is written.
          </Text>
        </View>

        <Pressable
          onPress={handleAnalyze}
          disabled={isDisabled}
          style={[styles.analyzeButton, isDisabled && styles.analyzeButtonDisabled]}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.analyzeButtonText}>{loadingMessage}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.analyzeButtonText}>Analyze &amp; Build Plan</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: IOS_SPACING.md + 2,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xl,
    gap: IOS_SPACING.md,
  },
  heroCard: {
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    backgroundColor: `${IOS_COLORS.systemBlue}08`,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${IOS_COLORS.systemBlue}20`,
  },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${IOS_COLORS.systemBlue}12`,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 460,
  },
  captureCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  input: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: IOS_COLORS.label,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  textArea: {
    minHeight: 190,
    paddingTop: 12,
  },
  attachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: IOS_SPACING.sm,
  },
  detectedText: {
    flex: 1,
    fontSize: 12.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${IOS_COLORS.systemBlue}10`,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}22`,
  },
  attachButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  attachmentList: {
    gap: 8,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${IOS_COLORS.systemBlue}08`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13.5,
    color: IOS_COLORS.label,
  },
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${IOS_COLORS.systemBlue}0B`,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${IOS_COLORS.systemBlue}18`,
  },
  promiseText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 15,
    borderRadius: 14,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorRef: {
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorRefIco: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorRefMeta: {
    flex: 1,
    minWidth: 0,
  },
  errorRefTop: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 1,
  },
  errorRefSource: {
    fontSize: 14,
    color: IOS_REGISTER.label,
  },
});
