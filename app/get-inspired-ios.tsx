/**
 * Get Inspired — iOS register preview (modal sheet)
 *
 * Eighth iOS-register preview surface — fresh-build modal. The catalog's
 * "I have a link I want to learn from" entry point. Three input modes
 * via segmented control (Link / Paste text / Describe it), example chips
 * below, sparkle CTA pinned to bottom that toggles enabled/disabled
 * based on whether there's input.
 *
 * Wire-up: visual-only preview. The actual fetch/analyze/build-plan
 * pipeline is a separate Phase 5+ service.
 *
 * Open at /get-inspired-ios. Presented as a modal sheet — slide up
 * from the bottom over the Discover surface.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';

type Mode = 'link' | 'text' | 'describe';

interface ExampleChip {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
}

const EXAMPLES: ExampleChip[] = [
  {
    icon: 'logo-youtube',
    label: 'Andrew Campbell · heavy-air starts',
    url: 'https://youtube.com/watch?v=heavy-air-starts',
  },
  {
    icon: 'document-text-outline',
    label: 'Sailing World · leeward mark approaches',
    url: 'https://sailingworld.com/leeward-mark-approaches',
  },
  {
    icon: 'logo-instagram',
    label: '@northsails reel · main trim',
    url: 'https://instagram.com/p/northsails-main-trim',
  },
];

const PLACEHOLDER_FOR_MODE: Record<Mode, string> = {
  link: 'https://example.com/inspiring-article',
  text: 'Paste any text you want to learn from…',
  describe: "Describe what you want to learn. e.g. 'I want to get better at starts.'",
};

const LABEL_FOR_MODE: Record<Mode, string> = {
  link: 'Drop a link to something inspiring',
  text: 'Paste text you want to learn from',
  describe: 'Describe what you want to learn',
};

const SUBTITLE_FOR_MODE: Record<Mode, string> = {
  link: 'An article, video, or social post about something you want to learn.',
  text: 'Any prose — a blog post, an email from a coach, a snippet from a book.',
  describe: "Plain language. We'll find sources and shape a plan around it.",
};

export default function GetInspiredIosPreview() {
  const [mode, setMode] = useState<Mode>('link');
  const [value, setValue] = useState('');

  const hasInput = value.trim().length > 0;

  return (
    <View style={styles.modal}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>
        <View style={styles.sheetChrome}>
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            hitSlop={8}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.sparkle,
                hasInput && styles.sparkleActive,
              ]}
            >
              <Ionicons
                name="sparkles"
                size={20}
                color={
                  hasInput
                    ? IOS_REGISTER.accentMarkedContent
                    : IOS_REGISTER.labelTertiary
                }
              />
            </View>
            <Text style={styles.headerTitle}>{LABEL_FOR_MODE[mode]}</Text>
            <Text style={styles.headerSub}>{SUBTITLE_FOR_MODE[mode]}</Text>
          </View>

          <View style={styles.segWrap}>
            <IOSSegmentedControl
              segments={[
                { value: 'link', label: 'Link' },
                { value: 'text', label: 'Paste text' },
                { value: 'describe', label: 'Describe it' },
              ]}
              selectedValue={mode}
              onValueChange={(v) => setMode(v as Mode)}
            />
          </View>

          <View style={styles.fieldWrap}>
            <View style={styles.field}>
              {mode === 'link' && (
                <Ionicons
                  name="link"
                  size={18}
                  color={IOS_REGISTER.labelTertiary}
                  style={styles.fieldLead}
                />
              )}
              {mode === 'link' ? (
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={PLACEHOLDER_FOR_MODE[mode]}
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  style={styles.fieldInput}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              ) : (
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={PLACEHOLDER_FOR_MODE[mode]}
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  style={styles.fieldInputMulti}
                  multiline
                  numberOfLines={4}
                />
              )}
              {hasInput && (
                <Pressable
                  onPress={() => setValue('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={IOS_REGISTER.labelTertiary}
                  />
                </Pressable>
              )}
            </View>
            <Text style={styles.fieldHint}>
              We'll fetch the content, identify the skill, and shape a
              deliberate-practice plan you can run against it.
            </Text>
          </View>

          <View style={styles.examples}>
            <Text style={styles.examplesLabel}>Try one of yours</Text>
            <View style={styles.chips}>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex.label}
                  style={styles.chip}
                  onPress={() => {
                    setMode('link');
                    setValue(ex.url);
                  }}
                >
                  <Ionicons
                    name={ex.icon}
                    size={14}
                    color={IOS_REGISTER.accentUserAction}
                  />
                  <Text style={styles.chipLabel}>{ex.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.cta,
              !hasInput && styles.ctaDisabled,
            ]}
            disabled={!hasInput}
          >
            <Text
              style={[
                styles.ctaText,
                !hasInput && styles.ctaTextDisabled,
              ]}
            >
              Analyze &amp; Build Plan
            </Text>
          </Pressable>
          {!hasInput && (
            <Text style={styles.ctaFoot}>
              Paste a link, text, or description to begin.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  safe: {
    flex: 1,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.systemGray3,
  },
  sheetChrome: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cancel: {
    fontSize: 17,
    color: IOS_REGISTER.accentUserAction,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  sparkle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sparkleActive: {
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSub: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  segWrap: {
    marginBottom: 20,
  },
  fieldWrap: {
    marginBottom: 24,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 12,
  },
  fieldLead: {
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    fontSize: 17,
    color: IOS_REGISTER.label,
    paddingVertical: 0,
  },
  fieldInputMulti: {
    flex: 1,
    fontSize: 17,
    color: IOS_REGISTER.label,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  fieldHint: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  examples: {
    paddingHorizontal: 4,
  },
  examplesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chips: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipLabel: {
    fontSize: 13,
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopWidth: 0.5,
    borderTopColor: IOS_REGISTER.separator,
    ...Platform.select({
      web: {} as any,
      default: {},
    }),
  },
  cta: {
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: IOS_COLORS.systemGray4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  ctaTextDisabled: {
    color: IOS_REGISTER.labelTertiary,
  },
  ctaFoot: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: -0.05,
  },
});
