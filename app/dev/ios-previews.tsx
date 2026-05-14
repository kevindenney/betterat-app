/**
 * iOS register previews — index
 *
 * One-page navigator listing every iOS-register preview surface built
 * across Phases 0–5. Quick way to tour the new register without
 * hunting through menus or constructing deep links by hand.
 *
 * Public route (under /dev) — bypasses AuthGate. Routes themselves
 * (e.g. /race/ios/[stepId]) still require auth for real data, but
 * the index doesn't.
 */

import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

interface PreviewEntry {
  title: string;
  subtitle: string;
  href: string;
  needsStepId?: boolean;
  needsConceptSlug?: boolean;
}

const ENTRIES: { section: string; items: PreviewEntry[] }[] = [
  {
    section: 'STEP SURFACES — pick a step ID first',
    items: [
      {
        title: 'Race Prep · iOS',
        subtitle: 'Before phase. Forecast + beats + crew + AI prompt.',
        href: '/race/ios/{stepId}',
        needsStepId: true,
      },
      {
        title: 'On the Water · iOS',
        subtitle:
          'During phase. Atmospheric slate, pinned rule, running log, hero mic.',
        href: '/race/ios/water/{stepId}',
        needsStepId: true,
      },
      {
        title: 'Debrief · iOS',
        subtitle:
          'After phase. Chronological capture stack. Replaces form-based review.',
        href: '/race/ios/debrief/{stepId}',
        needsStepId: true,
      },
    ],
  },
  {
    section: 'TAB SURFACES — open directly',
    items: [
      {
        title: 'Playbook · iOS',
        subtitle:
          'Apple Books library treatment. Vision + concept shelf + reflections.',
        href: '/playbook-ios',
      },
      {
        title: 'Reflect home · iOS',
        subtitle:
          'Contemplative root. Capability arc + thinking-shifted + moments returned to.',
        href: '/reflect-ios',
      },
      {
        title: 'Discover Paths · iOS',
        subtitle:
          'Three-section catalog: continuing your practice / sailors you follow / new territory.',
        href: '/discover-ios',
      },
    ],
  },
  {
    section: 'CONCEPT — needs a concept slug',
    items: [
      {
        title: 'Concept detail · iOS',
        subtitle:
          'Read/Work segmented control. Synthesis card + reflection trail.',
        href: '/concept-ios/{slug}',
        needsConceptSlug: true,
      },
    ],
  },
  {
    section: 'FACULTY SURFACE — needs a step ID',
    items: [
      {
        title: 'Competency Assessment · iOS',
        subtitle:
          'Faculty rubric. 4-state segmented control (44px earned exception). Splits from student-facing Debrief.',
        href: '/competency-assessment-ios/{stepId}',
        needsStepId: true,
      },
    ],
  },
  {
    section: 'FRESH BUILDS — no editorial precedent',
    items: [
      {
        title: 'Get Inspired modal · iOS',
        subtitle:
          'Drop a link / paste text / describe — three-mode capture, sparkle CTA.',
        href: '/get-inspired-ios',
      },
      {
        title: 'Trophy of Becoming · iOS',
        subtitle:
          'Path-completion synthesis. Six elements, italic title, coral rule.',
        href: '/trophy-ios',
      },
      {
        title: 'Step transition hinge · iOS',
        subtitle:
          'Mid-swipe interval. Filmstrip of named days between adjacent steps.',
        href: '/hinge-ios',
      },
      {
        title: 'Auth Welcome · iOS',
        subtitle:
          'Pre-auth landing. Full-bleed white, three-band composition.',
        href: '/auth-welcome-ios',
      },
    ],
  },
];

export default function IosPreviewsIndex() {
  return (
    <SafeAreaView style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>BETTERAT REDESIGN</Text>
          <Text style={styles.title}>iOS register previews</Text>
          <Text style={styles.sub}>
            Every iOS-register surface built across the Claude Design
            handoff. Step surfaces need a step ID; concept needs a slug;
            everything else opens directly.
          </Text>
        </View>

        {ENTRIES.map((section) => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionEyebrow}>{section.section}</Text>
            {section.items.map((item) => (
              <Pressable
                key={item.href}
                style={styles.row}
                onPress={() => {
                  if (item.needsStepId || item.needsConceptSlug) {
                    // Can't push without an ID — just show the path.
                    return;
                  }
                  router.push(item.href as any);
                }}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.rowHref}>{item.href}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={
                    item.needsStepId || item.needsConceptSlug
                      ? IOS_REGISTER.labelTertiary
                      : IOS_REGISTER.accentUserAction
                  }
                />
              </Pressable>
            ))}
          </View>
        ))}

        <View style={styles.footnote}>
          <Text style={styles.footnoteText}>
            Step-ID preview routes — Race Prep, On the Water, Debrief —
            are reachable from any timeline-step card's ⋮ menu. Concept
            detail is reachable by tapping a card on the Playbook iOS
            shelf.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  scroll: {
    paddingTop: 4,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  leftPad: { width: 1 },
  glyphBtn: { padding: 6 },
  header: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 24,
    paddingLeft: 20,
  },
  eyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: -0.7,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  section: {
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 8,
    paddingLeft: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  rowSubtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  rowHref: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: '"SF Mono", ui-monospace, Menlo, monospace',
      default: 'monospace',
    }) as string,
  },
  footnote: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  footnoteText: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    lineHeight: 17,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
