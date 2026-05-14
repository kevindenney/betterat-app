/**
 * Discover — Paths for you iOS register preview
 *
 * Seventh iOS-register preview surface. The catalog tab — paths from
 * authors curated against the user's current practice.
 *
 * Three sections with locked signal grammars (preserved from editorial):
 *   1. Continuing your practice — coral dot signal (system recommendation)
 *   2. Sailors you follow — avatar dot signal (peer activity)
 *   3. New territory — no signal (system curation; provenance carries)
 *
 * Signal grammars do not cross sections.
 *
 * Wire-up status:
 *   - This is a re-skin of the existing Discover catalog. Real-path data
 *     would come from a paths/blueprints catalog service. For the visual
 *     preview pass, render with realistic placeholder entries matching
 *     the design exactly.
 *   - When the paths catalog API is wired, the placeholder PATH_DATA
 *     constant is replaced with a useDiscoverPaths(interestId) hook.
 *
 * Open at /discover-ios.
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

import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';

type SignalKind = 'coral' | 'avatars' | 'none';

interface PathEntry {
  id: string;
  title: string;
  length: string;
  author: string;
  authorRole: string;
  description: string;
  signal: SignalKind;
  signalText?: string;
  avatarColors?: string[];
}

// Placeholder catalog — when real paths catalog API exists, replace with
// useDiscoverPaths(interestId).data and let the section-curation logic
// run server-side.
const SECTIONS: { eyebrow: string; entries: PathEntry[] }[] = [
  {
    eyebrow: 'Continuing your practice',
    entries: [
      {
        id: 'p1',
        title: 'Reading the breeze',
        length: '8 weeks',
        author: 'Stuart Walker',
        authorRole: 'Path',
        description:
          'Using the compass and the water surface to anticipate shifts before they happen.',
        signal: 'coral',
        signalText: 'Extends your concept Trust the shift, not just the side.',
      },
      {
        id: 'p2',
        title: 'Mark roundings under pressure',
        length: '6 weeks',
        author: 'Bill Gladstone',
        authorRole: 'Path',
        description:
          'Tactical decisions when the fleet compresses at the windward mark.',
        signal: 'coral',
        signalText: "Builds on heavy-air helm work, the capability you're on.",
      },
      {
        id: 'p3',
        title: 'The rule before the start',
        length: '4 weeks',
        author: 'Sam Cooke',
        authorRole: 'Companion path',
        description:
          "On writing your own rules — the technique Sam touches in the path you're on.",
        signal: 'coral',
        signalText: 'Sam wrote this as a companion to your current path.',
      },
    ],
  },
  {
    eyebrow: 'Sailors you follow',
    entries: [
      {
        id: 'p4',
        title: 'Light-air starts',
        length: '7 weeks',
        author: 'Dave Perry',
        authorRole: 'Path',
        description:
          'The patience problem in zero-wind starting sequences.',
        signal: 'avatars',
        signalText: 'Three sailors you follow are reading this.',
        avatarColors: ['#7A92A8', '#9AA88F', '#B0967E'],
      },
      {
        id: 'p5',
        title: 'Crew communication in heavy weather',
        length: '5 weeks',
        author: 'Mike Holt',
        authorRole: 'Path',
        description:
          'How to talk on the boat when the conditions make talking hard.',
        signal: 'avatars',
        signalText: 'Two sailors you follow completed this last season.',
        avatarColors: ['#7A92A8', '#B0967E'],
      },
    ],
  },
  {
    eyebrow: 'New territory',
    entries: [
      {
        id: 'p6',
        title: 'Positioning',
        length: '14 weeks',
        author: 'Stuart Walker',
        authorRole: 'Book path',
        description:
          'The book Walker built his teaching career on. Strategy as the logic of where you choose to be.',
        signal: 'none',
      },
      {
        id: 'p7',
        title: 'Match racing fundamentals',
        length: '11 weeks',
        author: 'Peter Isler',
        authorRole: 'Path',
        description:
          'A different shape of the sport. Useful even if you never match race — it sharpens fleet tactics.',
        signal: 'none',
      },
      {
        id: 'p8',
        title: "The sailor's mind",
        length: '8 weeks',
        author: 'Brian Hancock',
        authorRole: 'Long-form path',
        description:
          'How solo offshore sailors hold their attention across days. Adjacent to your kind of racing.',
        signal: 'none',
      },
    ],
  },
];

export default function DiscoverIosPreview() {
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top chrome — root tab */}
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>

        <PreviewBanner />

        {/* Title block — Discover eyebrow + lighter-weight title */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>DISCOVER</Text>
          <Text style={styles.title}>Paths for you</Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <View key={section.eyebrow} style={styles.section}>
            <Text style={styles.sectionEyebrow}>{section.eyebrow}</Text>
            {section.entries.map((entry) => (
              <PathCard key={entry.id} entry={entry} />
            ))}
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PathCard({ entry }: { entry: PathEntry }) {
  return (
    <Pressable style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {entry.title}
        </Text>
        <View style={styles.lengthBadge}>
          <Text style={styles.lengthBadgeText}>{entry.length}</Text>
        </View>
      </View>
      <Text style={styles.cardSource}>
        {entry.author}
        <Text style={styles.cardSourceSep}>{' · '}</Text>
        {entry.authorRole}
      </Text>
      <Text style={styles.cardDesc}>{entry.description}</Text>
      {entry.signal !== 'none' && entry.signalText && (
        <View style={styles.signalRow}>
          {entry.signal === 'coral' ? (
            <View style={styles.coralDot} />
          ) : (
            <View style={styles.avatarsRow}>
              {(entry.avatarColors ?? []).map((color, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.signalAvatar,
                    { backgroundColor: color },
                    idx > 0 && { marginLeft: -8 },
                  ]}
                />
              ))}
            </View>
          )}
          <Text style={styles.signalText}>{entry.signalText}</Text>
        </View>
      )}
    </Pressable>
  );
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color={IOS_REGISTER.labelSecondary}
      />
      <Text style={styles.bannerText}>
        Preview: Path entries are placeholder. Real catalog wires in when
        the discover-paths service is built.
      </Text>
    </View>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
  },
  titleBlock: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 20,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
    letterSpacing: -0.88,
    color: IOS_REGISTER.label,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  // Path card
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    marginBottom: 10,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.34,
    lineHeight: 22,
    flex: 1,
  },
  lengthBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 999,
    flexShrink: 0,
    marginTop: 1,
  },
  lengthBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  cardSource: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  cardSourceSep: {
    color: IOS_REGISTER.labelTertiary,
  },
  cardDesc: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: IOS_REGISTER.separator,
  },
  coralDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97757',
  },
  signalText: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.cardBg,
  },
});
