/**
 * InspirationCaptureStep — Step 1 of the wizard.
 *
 * User provides inspiring content via URL, pasted text, or a description.
 * Calls the AI extraction edge function and passes results to the next step.
 */

import React, { useState, useCallback } from 'react';
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
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { extractInspiration } from '@/services/InspirationService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { GetInspiredRunningScreen } from '@/components/ios-register';
import type {
  InspirationExtraction,
  InspirationContentType,
} from '@/types/inspiration';

type CaptureMode = 'url' | 'text' | 'description';

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

interface InspirationCaptureStepProps {
  userInterestSlugs: string[];
  onComplete: (
    extraction: InspirationExtraction,
    content: string,
    contentType: InspirationContentType,
  ) => void;
}

export function InspirationCaptureStep({
  userInterestSlugs,
  onComplete,
}: InspirationCaptureStepProps) {
  const [mode, setMode] = useState<CaptureMode>('url');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const isDisabled = !inputValue.trim() || loading;

  const handleAnalyze = useCallback(async () => {
    if (!inputValue.trim()) return;

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
      const extraction = await extractInspiration({
        content_type: mode === 'description' ? 'description' : mode,
        content: inputValue.trim(),
        user_existing_interest_slugs: userInterestSlugs,
      });

      onComplete(extraction, inputValue.trim(), mode === 'description' ? 'description' : mode);
    } catch (err) {
      showAlert(
        'Extraction Failed',
        err instanceof Error ? err.message : 'Could not analyze the content. Try pasting the text directly.',
      );
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMessage('');
    }
  }, [inputValue, mode, userInterestSlugs, onComplete]);

  // Render switch: when GET_INSPIRED_IOS_REGISTER is on and the extraction
  // pipeline is running, swap the entire capture form for the canonical
  // iOS-register running-state surface. Flag-off keeps the original
  // button-local spinner + timed text path unchanged (see the analyze
  // button render below).
  //
  // Temporary onStop: this commit only clears local loading state to
  // dismiss the surface visually. The actual in-flight network abort
  // (AbortController + edge-function teardown) lands in Commit 3 per
  // GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md. Until then the extraction
  // request continues in the background and its result is dropped when
  // it returns.
  if (loading && FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
    return (
      <GetInspiredRunningScreen
        embedded
        submittedUrl={inputValue.trim()}
        onStop={() => setLoading(false)}
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
      {/* Hero */}
      <View style={styles.hero}>
        <Ionicons
          name={hero.icon}
          size={36}
          color={IOS_COLORS.systemBlue}
        />
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
      </View>

      {/* Mode selector */}
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

      {/* Input */}
      {mode === 'url' && (
        <>
          <Text style={styles.label}>URL</Text>
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
        </>
      )}

      {mode === 'text' && (
        <>
          <Text style={styles.label}>PASTED CONTENT</Text>
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
          <Text style={styles.label}>WHAT INSPIRES YOU?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="I want to compete in an outdoor adventure competition that involves compass navigation, knot tying, off-road driving, and fitness challenges..."
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            multiline
            textAlignVertical="top"
            editable={!loading}
          />
        </>
      )}

      {/* Analyze button */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: IOS_SPACING.m,
    paddingBottom: IOS_SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: IOS_SPACING.l,
    paddingTop: IOS_SPACING.l,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: IOS_SPACING.s,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  modeRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.m,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: IOS_COLORS.label,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    marginBottom: IOS_SPACING.m,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: IOS_SPACING.s,
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
});
