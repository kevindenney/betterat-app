/**
 * InspirationCaptureStep — Step 1 of the wizard.
 *
 * User provides inspiring content via URL, pasted text, or a description.
 * Calls the AI extraction edge function and passes results to the next step.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { IOS_COLORS, IOS_SPACING, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { extractInspiration } from '@/services/InspirationService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  GetInspiredRunningScreen,
  IOSRegisterErrorState,
} from '@/components/ios-register';
import type {
  InspirationExtraction,
  InspirationContentType,
} from '@/types/inspiration';

// Classification of non-abort extraction failures into the three canonical
// IOSRegisterErrorState variants. Keep the matchers loose because the
// edge function surfaces user-shaped messages (not error codes), and
// downstream services throw plain Error objects.
type GetInspiredErrorKind = 'network' | 'input' | 'system';

function classifyGetInspiredError(error: unknown): GetInspiredErrorKind {
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
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
  sourceMode: CaptureMode;
}

type CaptureMode = 'url' | 'text' | 'description';
type DescriptionPromptField = 'Why' | 'How' | 'When' | 'Where';

const MODES: { key: CaptureMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'url', label: 'Link', icon: 'link' },
  { key: 'text', label: 'Paste text', icon: 'document-text' },
  { key: 'description', label: 'Describe it', icon: 'chatbubble-ellipses' },
];

const HERO: Record<CaptureMode, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }> = {
  url: {
    icon: 'sparkles',
    title: 'Drop a link to something inspiring',
    subtitle: 'An article, video, or social post about something you want to learn.',
  },
  text: {
    icon: 'document-text',
    title: 'Paste the content',
    subtitle: 'Copy text from an article, newsletter, or post and paste it here.',
  },
  description: {
    icon: 'chatbubble-ellipses',
    title: 'Describe what you want to do',
    subtitle: 'Tell us about the activity, competition, or skill you want to pursue.',
  },
};

const URL_EXAMPLES = [
  { label: 'Example article', value: 'https://sailingworld.com/leeward-mark-approaches' },
  { label: 'Example YouTube', value: 'https://youtube.com/watch?v=heavy-air-starts' },
  { label: 'Example Instagram', value: 'https://instagram.com/p/northsails-main-trim' },
] as const;

const DESCRIPTION_FIELDS: readonly DescriptionPromptField[] = ['Why', 'How', 'When', 'Where'] as const;

// Canonical error-variant copy per GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md.
// Mirrors the three variants in app/error-state-ios.tsx; the only Get-
// Inspired-specific bits are the variant-to-action wiring and the source-
// reference card injected as children below.
type ErrorVariantSpec = {
  glyph: React.ComponentProps<typeof Ionicons>['name'];
  headline: string;
  supportingText: string;
  primaryLabel: string;
  primaryIcon?: React.ComponentProps<typeof Ionicons>['name'];
  primaryAction: 'retry' | 'goBack';
  secondaryLabel: string;
  secondaryAction: 'tryDifferent' | 'switchToText' | 'goBack';
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
    secondaryLabel: 'Use a different link',
    secondaryAction: 'tryDifferent',
  },
  input: {
    glyph: 'link-outline',
    headline: "This source doesn't have enough practice material.",
    supportingText:
      "We need an article, a video, or a page with one of those inside it.",
    primaryLabel: 'Try a different link',
    primaryIcon: 'link',
    primaryAction: 'retry',
    secondaryLabel: 'Paste the text instead',
    secondaryAction: 'switchToText',
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

interface InspirationCaptureStepProps {
  userInterestSlugs: string[];
  onComplete: (
    extraction: InspirationExtraction,
    content: string,
    contentType: InspirationContentType,
  ) => void;
  /**
   * Parent-child abort contract. When extraction is running, the capture
   * step registers an abort handler; the wizard calls it on modal close
   * so the network request is cancelled instead of completing silently
   * and advancing past the closed UI. Passes null on unmount/cleanup.
   */
  registerAbortHandler?: (handler: (() => void) | null) => void;
}

export function InspirationCaptureStep({
  userInterestSlugs,
  onComplete,
  registerAbortHandler,
}: InspirationCaptureStepProps) {
  const [mode, setMode] = useState<CaptureMode>('url');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorState, setErrorState] = useState<GetInspiredErrorViewState | null>(null);

  // Mutable handle to the active extraction's abort controller. Using a
  // ref (not state) because aborting is a side-effect on the in-flight
  // request, not a render-driving signal.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount — abort any active extraction.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const isDisabled = !inputValue.trim() || loading;

  const handleAnalyze = useCallback(async () => {
    if (!inputValue.trim()) return;

    // If a previous extraction is still in flight (e.g. user retried fast),
    // abort it before starting a new one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorState(null);
    setLoading(true);
    const messages = [
      'Reading content...',
      'Extracting skills...',
      'Building your plan...',
    ];
    let msgIndex = 0;
    setLoadingMessage(messages[0]);

    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, messages.length - 1);
      setLoadingMessage(messages[msgIndex]);
    }, 3000);

    try {
      const extraction = await extractInspiration(
        {
          content_type: mode === 'description' ? 'description' : mode,
          content: inputValue.trim(),
          user_existing_interest_slugs: userInterestSlugs,
        },
        { signal: controller.signal },
      );

      onComplete(extraction, inputValue.trim(), mode === 'description' ? 'description' : mode);
    } catch (err) {
      // User-initiated abort: silent return to filled capture state.
      // Preserve inputValue + mode so retry is a single tap away.
      if (isAbortError(err) || controller.signal.aborted) {
        return;
      }

      if (FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
        setErrorState({
          kind: classifyGetInspiredError(err),
          source: inputValue.trim(),
          sourceMode: mode,
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
      // Only flip state if this is still the active controller. A newer
      // request may have replaced us via the abortControllerRef.current?.abort()
      // line above; in that case the newer request owns loading state.
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
        setLoadingMessage('');
      }
    }
  }, [inputValue, mode, userInterestSlugs, onComplete]);

  // Register/unregister the abort handler with the wizard parent so modal
  // close can cancel the running extraction. The handler aborts the active
  // controller; the catch arm above treats that as user-cancel and returns
  // silently.
  useEffect(() => {
    if (!registerAbortHandler) return;
    registerAbortHandler(() => {
      abortControllerRef.current?.abort();
    });
    return () => {
      registerAbortHandler(null);
    };
  }, [registerAbortHandler]);

  const handleErrorRetry = useCallback(() => {
    setErrorState(null);
    void handleAnalyze();
  }, [handleAnalyze]);

  const handleErrorTryDifferent = useCallback(() => {
    setErrorState(null);
    setInputValue('');
  }, []);

  const handleErrorSwitchToText = useCallback(() => {
    setErrorState(null);
    setInputValue('');
    setMode('text');
  }, []);

  const handleErrorGoBack = useCallback(() => {
    setErrorState(null);
  }, []);

  const insertDescriptionField = useCallback((field: DescriptionPromptField) => {
    const template = `${field}: `;
    setInputValue((prev) => {
      if (!prev.trim()) return template;
      if (prev.includes(template)) return prev;
      return `${prev.trimEnd()}\n${template}`;
    });
  }, []);

  // Error-state early return (highest priority). Flag-on only — flag-off
  // errors still surface via showAlert in the catch arm above.
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
          onPress:
            variant.primaryAction === 'retry'
              ? handleErrorRetry
              : handleErrorGoBack,
        }}
        secondaryAction={{
          label: variant.secondaryLabel,
          onPress:
            variant.secondaryAction === 'switchToText'
              ? handleErrorSwitchToText
              : variant.secondaryAction === 'goBack'
              ? handleErrorGoBack
              : handleErrorTryDifferent,
        }}
      >
        <View style={styles.errorRef}>
          <View style={styles.errorRefIco}>
            <Ionicons
              name={errorState.sourceMode === 'url' ? 'document-text-outline' : 'document-outline'}
              size={16}
              color={IOS_REGISTER.labelSecondary}
            />
          </View>
          <View style={styles.errorRefMeta}>
            <Text style={styles.errorRefTop}>YOU SENT</Text>
            <Text style={styles.errorRefSource} numberOfLines={1}>
              {errorState.source || '(empty)'}
            </Text>
          </View>
        </View>
      </IOSRegisterErrorState>
    );
  }

  // Running-state early return. Flag-on only. Stop button now actually
  // aborts the in-flight extraction (the catch arm above handles the
  // resulting AbortError silently).
  if (loading && FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
    return (
      <GetInspiredRunningScreen
        embedded
        submittedUrl={inputValue.trim()}
        onStop={() => {
          abortControllerRef.current?.abort();
        }}
      />
    );
  }

  const hero = HERO[mode];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Ionicons
            name={hero.icon}
            size={26}
            color={IOS_COLORS.systemBlue}
          />
        </View>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
      </View>

      <View style={styles.captureCard}>
        <View style={styles.captureTop}>
          <View style={styles.modeCard}>
            <View style={styles.modeRow}>
              {MODES.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => { setMode(m.key); setInputValue(''); }}
                  style={[styles.modePill, mode === m.key && styles.modePillActive]}
                >
                  <Ionicons
                    name={m.icon}
                    size={14}
                    color={mode === m.key ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                  />
                  <Text
                    style={[styles.modePillText, mode === m.key && styles.modePillTextActive]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {mode === 'url' && (
            <>
              <Text style={styles.label}>LINK</Text>
              <Text style={styles.helperText}>
                Best for an article, video, or post with concrete material to learn from.
              </Text>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="https://example.com/inspiring-article"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!loading}
              />
              <Text style={styles.examplesLabel}>QUICK EXAMPLES</Text>
              <Text style={styles.examplesHelperText}>
                These just fill the field with sample links so you can test the flow or see what kind of source works best.
              </Text>
              <View style={styles.exampleRow}>
                {URL_EXAMPLES.map((example) => (
                  <Pressable
                    key={example.label}
                    onPress={() => setInputValue(example.value)}
                    style={styles.exampleChip}
                  >
                    <Text style={styles.exampleChipText}>{example.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {mode === 'text' && (
            <>
              <Text style={styles.label}>PASTED CONTENT</Text>
              <Text style={styles.helperText}>
                Paste the exact excerpt you want BetterAt to unpack into a plan.
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Paste the article, newsletter excerpt, or social post here..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                multiline
                textAlignVertical="top"
                editable={!loading}
              />
            </>
          )}

          {mode === 'description' && (
            <>
              <Text style={styles.label}>DESCRIBE IT</Text>
              <Text style={styles.helperText}>
                If you do not have a source yet, describe it using the same fields your steps already use.
              </Text>
              <View style={styles.exampleRow}>
                {DESCRIPTION_FIELDS.map((field) => (
                  <Pressable
                    key={field}
                    onPress={() => insertDescriptionField(field)}
                    style={styles.exampleChip}
                  >
                    <Text style={styles.exampleChipText}>{field}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Why: \nHow: \nWhen: \nWhere: "
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                multiline
                textAlignVertical="top"
                editable={!loading}
              />
            </>
          )}
        </View>

        <View style={styles.captureBottom}>
          <View style={styles.promiseCard}>
            <Ionicons name="sparkles-outline" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.promiseText}>
              BetterAt will propose an interest, outline the first steps, and turn the source into a usable plan.
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
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 420,
  },
  modeRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.xs,
  },
  modeCard: {
    marginBottom: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 16,
    padding: 5,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  modePillActive: {
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}40`,
  },
  modePillText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  modePillTextActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  captureCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
  },
  captureTop: {
    gap: IOS_SPACING.xs,
  },
  captureBottom: {
    marginTop: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.sm,
    paddingRight: IOS_SPACING.xs,
  },
  examplesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
    marginTop: IOS_SPACING.sm,
    marginBottom: 4,
  },
  examplesHelperText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.tertiaryLabel,
    marginBottom: IOS_SPACING.sm,
    paddingRight: IOS_SPACING.sm,
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
    minHeight: 164,
    paddingTop: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.sm,
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${IOS_COLORS.systemBlue}10`,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}1F`,
  },
  exampleChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
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
  // Reference card inside the error-state children slot. Mirrors the
  // submitted-link card in app/error-state-ios.tsx so users see WHICH
  // source failed, not just THAT something failed.
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
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
});
