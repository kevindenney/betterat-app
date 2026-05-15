/**
 * Error state canonical — iOS register preview (flat-under-app route)
 *
 * Variant-cycling preview surface for the three reference uses of the
 * `IOSRegisterErrorState` kit component (network / input / system). Sample
 * content drawn directly from the Claude Design "Error state · canonical ·
 * iOS register" handoff. The error component is cross-cutting
 * infrastructure — not a product surface — so this route exists for visual
 * review of the canonical chrome and the three reference variants only.
 *
 * Real callers consume `IOSRegisterErrorState` from `components/ios-register/`
 * directly: when a network call fails, when an input is rejected, when a
 * downstream service returns an unexpected error, etc. The component is
 * one of the few iOS-register kit primitives that ships *without* a
 * feature flag — error states are Principle #2 infrastructure
 * (IOS_MIGRATION_PLAN.md), not a render-path replacement.
 *
 * Open at /error-state-ios. Variant selectable via
 * ?variant=network|input|system.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { IOSRegisterErrorState } from '@/components/ios-register';

type Variant = 'network' | 'input' | 'system';
const VALID_VARIANTS: Variant[] = ['network', 'input', 'system'];

function resolveVariant(raw: unknown): Variant {
  if (typeof raw === 'string' && (VALID_VARIANTS as string[]).includes(raw)) {
    return raw as Variant;
  }
  return 'network';
}

export default function ErrorStateIosPreview() {
  const params = useLocalSearchParams<{ variant?: string }>();
  const variant = resolveVariant(params.variant);

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.previewChrome}>
        <VariantSelector active={variant} />
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : null)}
          accessibilityLabel="Close iOS preview"
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Ionicons
            name="close"
            size={22}
            color={IOS_REGISTER.accentUserAction}
          />
        </Pressable>
      </View>

      {variant === 'network' && <NetworkVariant />}
      {variant === 'input' && <InputVariant />}
      {variant === 'system' && <SystemVariant />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Variant 1 — Recoverable / network. Glyph + headline + supporting +
// reference card (user's submitted link preserved) + primary "Try again" +
// secondary "Use a different link".
// ---------------------------------------------------------------------------

function NetworkVariant() {
  return (
    <IOSRegisterErrorState
      headerTitle="Get Inspired"
      backLabel="Discover"
      onBackPress={() => (router.canGoBack() ? router.back() : null)}
      glyph="cloud-offline-outline"
      headline="We couldn’t reach the server."
      supportingText="Your connection dropped while we were reading the link. Nothing’s lost — we kept your link, and you can try again as soon as you’re back."
      primaryAction={{
        label: 'Try again',
        icon: 'refresh',
        onPress: () => {},
      }}
      secondaryAction={{
        label: 'Use a different link',
        onPress: () => {},
      }}
    >
      <ReferenceCard
        icon="document-text-outline"
        topLabel="Your link"
        url="sailingworld.com/heavy-air-starts-andrew-campbell"
      />
    </IOSRegisterErrorState>
  );
}

// ---------------------------------------------------------------------------
// Variant 2 — Input / user-correctable. Glyph + headline + supporting +
// reference card with "Can't use" tag + info card listing what works +
// primary "Try a different link" + secondary "Paste the text instead".
// ---------------------------------------------------------------------------

function InputVariant() {
  return (
    <IOSRegisterErrorState
      headerTitle="Get Inspired"
      backLabel="Discover"
      onBackPress={() => (router.canGoBack() ? router.back() : null)}
      navRightAction={{ label: 'What works?', onPress: () => {} }}
      glyph="link-outline"
      headline="This link doesn’t have a video we can pull from."
      supportingText="It looks like a tweet without an attached video. We need an article, a video, or a page that has one of those inside it."
      primaryAction={{
        label: 'Try a different link',
        icon: 'link',
        onPress: () => {},
      }}
      secondaryAction={{
        label: 'Paste the text instead',
        onPress: () => {},
      }}
    >
      <ReferenceCard
        icon="logo-twitter"
        topLabel="You sent"
        url="x.com/sailgp/status/18234902…"
        reasonTag="Can’t use"
      />
      <InfoCard
        eyebrow="What works"
        works={[
          'Articles — sailing blogs, magazine pieces, coaching posts.',
          'Videos — YouTube, Vimeo, embedded race footage.',
          'Podcast episodes with transcripts.',
        ]}
        bad={['Tweets, paywalls, members-only posts.']}
      />
    </IOSRegisterErrorState>
  );
}

// ---------------------------------------------------------------------------
// Variant 3 — System / non-recoverable. Glyph + headline + supporting +
// More-info disclosure (request id) + primary "Go back" + secondary
// "Tell us what you were trying to do" + tertiary "Try again later".
// ---------------------------------------------------------------------------

function SystemVariant() {
  return (
    <IOSRegisterErrorState
      headerTitle="Get Inspired"
      backLabel="Discover"
      onBackPress={() => (router.canGoBack() ? router.back() : null)}
      navRightAction={{ label: 'More info', onPress: () => {} }}
      glyph="construct-outline"
      headline="We hit an issue building your plan."
      supportingText="Something on our side didn’t work this time. Our team can see it — we don’t need you to file anything. Try again in a few minutes."
      primaryAction={{
        label: 'Go back',
        icon: 'arrow-back',
        onPress: () => (router.canGoBack() ? router.back() : null),
      }}
      secondaryAction={{
        label: 'Tell us what you were trying to do',
        onPress: () => {},
      }}
      tertiaryAction={{
        label: 'Try again later',
        onPress: () => {},
      }}
      disclosure={{
        defaultOpen: true,
        content: (
          <>
            <View style={styles.reqRow}>
              <Text style={styles.reqMono}>
                req_8f4a1c3e·2026-05-15·17:42z
              </Text>
              <Pressable
                onPress={() => {}}
                style={styles.copyBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy request id"
              >
                <Text style={styles.copyText}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.reqHint}>
              If you talk to support, sharing this lets them find the run.
              You don’t have to.
            </Text>
          </>
        ),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Internal preview helpers — sample reference + info cards. Callers in real
// product code compose their own equivalents around the kit component; the
// kit component is intentionally agnostic about what sits between the hero
// and the actions, so the preview demonstrates one credible composition.
// ---------------------------------------------------------------------------

function ReferenceCard({
  icon,
  topLabel,
  url,
  reasonTag,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  topLabel: string;
  url: string;
  reasonTag?: string;
}) {
  return (
    <View style={styles.ref}>
      <View style={styles.refIco}>
        <Ionicons
          name={icon}
          size={16}
          color={IOS_REGISTER.labelSecondary}
        />
      </View>
      <View style={styles.refMeta}>
        <Text style={styles.refTop}>{topLabel.toUpperCase()}</Text>
        <Text style={styles.refUrl} numberOfLines={1}>
          {url}
        </Text>
      </View>
      {reasonTag ? (
        <View style={styles.reasonTag}>
          <Text style={styles.reasonTagText}>
            {reasonTag.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoCard({
  eyebrow,
  works,
  bad,
}: {
  eyebrow: string;
  works: string[];
  bad: string[];
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardEyebrow}>{eyebrow.toUpperCase()}</Text>
      {works.map((w) => (
        <View key={w} style={styles.infoRow}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={IOS_REGISTER.accentUserAction}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>{w}</Text>
        </View>
      ))}
      {bad.map((b) => (
        <View key={b} style={styles.infoRow}>
          <Ionicons
            name="close-circle"
            size={16}
            color={IOS_REGISTER.accentMarkedContent}
            style={styles.infoIcon}
          />
          <Text style={styles.infoTextBad}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function VariantSelector({ active }: { active: Variant }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.variantsRow}
    >
      {VALID_VARIANTS.map((v) => {
        const on = v === active;
        return (
          <Pressable
            key={v}
            onPress={() => router.setParams({ variant: v })}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {v}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  previewChrome: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  closeBtn: { padding: 6 },
  variantsRow: {
    gap: 6,
    paddingRight: 4,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  chipOn: {
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  chipTextOn: {
    color: IOS_REGISTER.label,
  },
  // ----- reference card -----
  ref: {
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
  refIco: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  refMeta: {
    flex: 1,
    minWidth: 0,
  },
  refTop: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 1,
  },
  refUrl: {
    fontSize: 14,
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  reasonTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
  },
  reasonTagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: IOS_REGISTER.accentMarkedContent,
  },
  // ----- info card -----
  infoCard: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  infoCardEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  infoIcon: {
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.08,
    color: IOS_REGISTER.label,
  },
  infoTextBad: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.08,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- system variant disclosure inner content -----
  reqRow: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reqMono: {
    fontFamily: 'SF Mono, Menlo, monospace' as never,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  copyBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  copyText: {
    fontSize: 13,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.05,
  },
  reqHint: {
    fontSize: 12,
    lineHeight: 17,
    color: IOS_REGISTER.labelTertiary,
  },
});
