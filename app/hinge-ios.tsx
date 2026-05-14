/**
 * Step transition hinge — iOS register preview
 *
 * Tenth iOS-register preview surface. The mid-swipe surface that appears
 * between adjacent steps on the Race timeline. Names the time between
 * named moments.
 *
 * Architectural commitments (from the design's side rail):
 *   - Filmstrip grammar — horizontal scroll of small day-tiles, each
 *     deliberately lower visual weight than the step surfaces it sits
 *     between. The hinge isn't shouting; it's connective tissue.
 *   - "The time between named moments is itself named" — the editorial
 *     register's central commitment, preserved through register
 *     translation.
 *   - Header eyebrow + sentence + dates → the iOS equivalent of the
 *     italic-serif anchor on desktop.
 *
 * Wire-up status: visual-only preview. Real hinge content depends on
 * (a) detecting adjacent same-interest steps in the timeline,
 * (b) surfacing flagged moments / reflections / captured notes from
 * the gap between, (c) Concept-update + Resource-pinned events as
 * tile kinds. All deferred until the hinge integration into the step
 * carousel.
 *
 * Open at /hinge-ios.
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

interface HingeTile {
  id: string;
  day: string;
  date: string;
  kind: string;
  kindIcon: keyof typeof Ionicons.glyphMap;
  body: string;
  bodyItalic?: boolean;
  src: string;
  when: string;
}

const TILES: HingeTile[] = [
  {
    id: 'wed',
    day: 'Wednesday',
    date: 'March 18',
    kind: 'A flagged moment',
    kindIcon: 'flag-outline',
    body: 'Re-watched Sam\'s coaching note from Race 3 three times in the morning. Flagged the seven seconds where he says "trust the shift."',
    src: 'Race 3 debrief',
    when: '8:14 am',
  },
  {
    id: 'thu',
    day: 'Thursday',
    date: 'March 19',
    kind: 'A reflection',
    kindIcon: 'pencil',
    body: 'Wrote about the right side winning for the wrong reason. The shift came back twice on the second beat — the side just happened to be where the breeze landed.',
    src: 'Concept · Trust the shift',
    when: '9:42 pm',
  },
  {
    id: 'fri',
    day: 'Friday',
    date: 'March 20',
    kind: 'A captured note',
    kindIcon: 'bookmark-outline',
    body: '"If the left fills past ten degrees on starboard, I commit." Wrote it the night before Race 4. Brought it into Prep as the rule.',
    bodyItalic: true,
    src: 'Race 4 prep · the rule',
    when: '10:18 pm',
  },
];

export default function HingeIosPreview() {
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top chrome — close button */}
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

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Between Race 3 and Race 4</Text>
          <Text style={styles.title}>Three days at the edge</Text>
          <Text style={styles.dates}>March 18–20</Text>
        </View>

        {/* Filmstrip — horizontal scroll of day tiles */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filmstrip}
        >
          {TILES.map((tile) => (
            <Pressable key={tile.id} style={styles.tile}>
              <Text style={styles.tileDay}>{tile.day}</Text>
              <Text style={styles.tileDate}>{tile.date}</Text>
              <View style={styles.tileKindRow}>
                <Ionicons
                  name={tile.kindIcon}
                  size={12}
                  color={IOS_REGISTER.labelSecondary}
                />
                <Text style={styles.tileKind}>{tile.kind}</Text>
              </View>
              <Text
                style={[
                  styles.tileBody,
                  tile.bodyItalic && styles.tileBodyItalic,
                ]}
                numberOfLines={6}
              >
                {tile.body}
              </Text>
              <View style={styles.tileSpacer} />
              <View style={styles.tileProv}>
                <Text style={styles.tileSrc}>{tile.src}</Text>
                <Text style={styles.tileWhen}>{tile.when}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Bookends */}
        <View style={styles.bookends}>
          <Pressable style={styles.bookend}>
            <View style={styles.bookendGlyph}>
              <Ionicons
                name="arrow-back"
                size={16}
                color={IOS_REGISTER.accentUserAction}
              />
            </View>
            <View style={styles.bookendLabel}>
              <Text style={styles.bookendStep}>BEFORE</Text>
              <Text style={styles.bookendName}>Race 3 · Debrief</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={IOS_REGISTER.labelTertiary}
            />
          </Pressable>
          <Pressable style={styles.bookend}>
            <View style={styles.bookendGlyph}>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={IOS_REGISTER.accentUserAction}
              />
            </View>
            <View style={styles.bookendLabel}>
              <Text style={styles.bookendStep}>AFTER</Text>
              <Text style={styles.bookendName}>Race 4 · Prep</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={IOS_REGISTER.labelTertiary}
            />
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          The hinge is a state, not a destination — you arrive here by
          swiping between adjacent races on the Race timeline.{' '}
          <Text style={styles.footnoteItalic}>
            The time between named moments is itself named.
          </Text>
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
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
        Preview: tiles are placeholder. The real hinge surfaces flagged
        moments + reflections + captured notes from the actual gap between
        adjacent same-interest steps.
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
  header: {
    paddingTop: 16,
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
    fontWeight: '500',
    lineHeight: 36,
    letterSpacing: -0.7,
    color: IOS_REGISTER.label,
    marginBottom: 6,
  },
  dates: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
  },
  // Filmstrip
  filmstrip: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 24,
  },
  tile: {
    width: 220,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingTop: 14,
    paddingRight: 14,
    paddingBottom: 14,
    paddingLeft: 14,
    minHeight: 220,
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
  tileDay: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  tileDate: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
    marginBottom: 12,
  },
  tileKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  tileKind: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  tileBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  tileBodyItalic: {
    fontStyle: 'italic',
  },
  tileSpacer: { flex: 1, minHeight: 12 },
  tileProv: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: IOS_REGISTER.separator,
  },
  tileSrc: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    flex: 1,
  },
  tileWhen: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
  // Bookends
  bookends: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 18,
  },
  bookend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bookendGlyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookendLabel: {
    flex: 1,
  },
  bookendStep: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.5,
  },
  bookendName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  footnote: {
    paddingHorizontal: 28,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: 12,
  },
  footnoteItalic: {
    fontStyle: 'italic',
  },
});
