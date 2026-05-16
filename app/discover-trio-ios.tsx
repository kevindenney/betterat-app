/**
 * Discover trio — iOS register preview
 *
 * Canonical surface for the Discover tab: three siblings (Orgs, People,
 * Forums) sharing one chrome — large-title header, iOS segmented control,
 * single search field with surface-tuned placeholder, single inset-grouped
 * list. What differs is the cell. Renders Felix's sailing register sample
 * via the shared canonical cell kit at `components/discover/canonical`.
 *
 * Open at /discover-trio-ios. Initial surface selectable via
 * ?surface=orgs|people|forums.
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import {
  CanonicalForumRow,
  CanonicalList,
  CanonicalListEyebrow,
  CanonicalOrgRow,
  CanonicalPersonRow,
  type ForumTag,
  type PersonTag,
} from '@/components/discover/canonical';

type Surface = 'orgs' | 'people' | 'forums';
const VALID_SURFACES: Surface[] = ['orgs', 'people', 'forums'];

// Letter-mark palette — sample data uses explicit shades to match the canonical exactly.
const MARK = {
  slate: '#4F6B7E',
  stone: '#6B6558',
  sage: '#5E7363',
  ink: '#2A2824',
  deep: '#3F5B6F',
  coral: '#D97757',
  avSlate: '#8B9DA8',
  avPutty: '#C2A285',
  avSage: '#98A38C',
  avDeep: '#4F6B7E',
  avRose: '#C68B79',
  avStone: '#8E847A',
} as const;

// =============================================================================
// SAMPLE DATA — Felix's sailing register (Dragon class · Hong Kong)
// =============================================================================

const ORGS = [
  { id: 'rhkyc', initials: 'RH', name: 'Royal Hong Kong Yacht Club', descriptor: 'Causeway Bay · Member club · 2,840 sailors', markColor: MARK.deep, joinedLabel: 'Joined' },
  { id: 'abc', initials: 'AB', name: 'Aberdeen Boat Club', descriptor: 'Aberdeen Harbour · Member club · 910 sailors', markColor: MARK.slate },
  { id: 'ida', initials: 'ID', name: 'International Dragon Association', descriptor: 'Class association · 27 national fleets', markColor: MARK.ink },
  { id: 'jds', initials: 'JD', name: 'Junior Dragon Squad · Hong Kong', descriptor: 'Youth program · Founded 2024 · 38 sailors', markColor: MARK.coral },
  { id: 'rtyc', initials: 'RT', name: 'Royal Thames Yacht Club', descriptor: 'London · Member club · 1,650 sailors', markColor: MARK.stone },
  { id: 'hksf', initials: 'HK', name: 'Hong Kong Sailing Federation', descriptor: 'National federation · 6 affiliated clubs', markColor: MARK.sage },
] as const;

type PeopleSample = {
  id: string;
  initials: string;
  name: string;
  descriptor: string;
  concept: string;
  markColor: string;
  tag: PersonTag;
};

const PEOPLE: PeopleSample[] = [
  { id: 'markus', initials: 'MT', name: 'Markus Tham', descriptor: 'Dragon helm, RHKYC · 11 seasons', concept: 'Reading the starboard layline early', markColor: MARK.avDeep, tag: { kind: 'mine', label: 'Raced 4×' } },
  { id: 'yvonne', initials: 'YL', name: 'Yvonne Leung', descriptor: 'Dragon helm, Aberdeen BC · 17 seasons', concept: 'Trust the shift, not just the side', markColor: MARK.avPutty, tag: { kind: 'mine', label: 'Mutual', icon: 'swap-horizontal' } },
  { id: 'jamie', initials: 'JC', name: 'Jamie Carstairs', descriptor: 'Dragon helm, Royal Thames YC · 22 seasons', concept: 'Crew comms in heavy weather', markColor: MARK.avSage, tag: { kind: 'weak', label: 'Met at Spring Series' } },
  { id: 'ricardo', initials: 'RC', name: 'Ricardo Costa', descriptor: 'Dragon helm, RHKYC · 6 seasons', concept: 'Heavy-air starts in current', markColor: MARK.avSlate, tag: { kind: 'weak', label: 'Shared club' } },
  { id: 'sophie', initials: 'SK', name: 'Sophie Kjelsby', descriptor: 'Dragon helm, KNS Oslo · 9 seasons', concept: 'Mark roundings under pressure', markColor: MARK.avStone, tag: { kind: 'weak', label: 'Suggested' } },
  { id: 'peter', initials: 'PD', name: 'Peter Daubeny', descriptor: 'Dragon helm, Cowes · 14 seasons', concept: 'Reading the breeze on the water', markColor: MARK.avRose, tag: { kind: 'weak', label: 'Suggested' } },
];

type ForumsSample = {
  id: string;
  glyph: keyof typeof Ionicons.glyphMap;
  name: string;
  descriptor: string;
  activity: { threads: string; lastActivity: string };
  tag?: ForumTag;
  unread?: boolean;
};

const FORUMS: ForumsSample[] = [
  { id: 'rigging', glyph: 'construct-outline', name: 'Dragon rigging & tuning', descriptor: 'Boat setup · 342 sailors', activity: { threads: '1,184 threads', lastActivity: '17 new today' }, tag: { kind: 'mine', label: 'Following', icon: 'checkmark' }, unread: true },
  { id: 'starts', glyph: 'flag-outline', name: 'Heavy-air starts', descriptor: 'Tactics · 517 sailors', activity: { threads: '2,041 threads', lastActivity: 'Active 2h ago' }, tag: { kind: 'mine', label: 'Following', icon: 'checkmark' } },
  { id: 'marks', glyph: 'reload-outline', name: 'Mark roundings & tactical compression', descriptor: 'Tactics · 289 sailors', activity: { threads: '608 threads', lastActivity: 'Active today' }, tag: { kind: 'fit', label: 'Matches your concept' } },
  { id: 'rhkyc-wed', glyph: 'compass-outline', name: 'RHKYC: Wednesday-night racing', descriptor: 'Club forum · 164 sailors', activity: { threads: '312 threads', lastActivity: 'Active yesterday' }, tag: { kind: 'fit', label: 'From your club' } },
  { id: 'squall', glyph: 'thunderstorm-outline', name: 'Squall handling on small keelboats', descriptor: 'Safety · 1,180 sailors', activity: { threads: '934 threads', lastActivity: 'Active 4h ago' } },
  { id: 'rules', glyph: 'book-outline', name: 'Reading the racing rules', descriptor: 'Rules & protests · 3,420 sailors', activity: { threads: '5,712 threads', lastActivity: 'Active 1h ago' } },
];

const SEARCH_PLACEHOLDERS: Record<Surface, string> = {
  orgs: 'Find an org',
  people: 'Find people',
  forums: 'Find a topic',
};

const LIST_EYEBROWS: Record<Surface, { plain: string; em: string; tail?: string }> = {
  orgs: { plain: 'Around ', em: 'Dragon class racing in Hong Kong' },
  people: { plain: 'Other ', em: 'Dragon class', tail: ' practitioners' },
  forums: { plain: 'Topics around ', em: 'Dragon class racing' },
};

function resolveSurface(raw: unknown): Surface {
  if (typeof raw === 'string' && (VALID_SURFACES as string[]).includes(raw)) {
    return raw as Surface;
  }
  return 'orgs';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DiscoverTrioIosPreview() {
  const params = useLocalSearchParams<{ surface?: string }>();
  const [surface, setSurface] = useState<Surface>(resolveSurface(params.surface));

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topChrome}>
        <View style={styles.leftPad} />
        <Pressable
          style={styles.glyphBtn}
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : null)}
          accessibilityLabel="Close iOS preview"
        >
          <Ionicons name="close" size={22} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
      </View>

      <PreviewBanner />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {surface === 'orgs' && (
          <View style={styles.ptr}>
            <Ionicons name="checkmark" size={14} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.ptrText}>Updated just now</Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
        </View>

        <View style={styles.segWrap}>
          <IOSSegmentedControl
            segments={[
              { value: 'orgs', label: 'Orgs' },
              { value: 'people', label: 'People' },
              { value: 'forums', label: 'Forums' },
            ]}
            selectedValue={surface}
            onValueChange={(v) => setSurface(v as Surface)}
          />
        </View>

        <View style={styles.search}>
          <Ionicons
            name="search"
            size={16}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.searchPh} numberOfLines={1}>
            {SEARCH_PLACEHOLDERS[surface]}
          </Text>
          <Ionicons name="mic" size={16} color={IOS_REGISTER.labelSecondary} />
        </View>

        <CanonicalListEyebrow {...LIST_EYEBROWS[surface]} />

        <CanonicalList>
          {surface === 'orgs' &&
            ORGS.map((o, i) => (
              <CanonicalOrgRow
                key={o.id}
                first={i === 0}
                initials={o.initials}
                markColor={o.markColor}
                name={o.name}
                descriptor={o.descriptor}
                joinedLabel={o.joinedLabel}
              />
            ))}
          {surface === 'people' &&
            PEOPLE.map((p, i) => (
              <CanonicalPersonRow
                key={p.id}
                first={i === 0}
                initials={p.initials}
                markColor={p.markColor}
                name={p.name}
                descriptor={p.descriptor}
                concept={p.concept}
                tag={p.tag}
              />
            ))}
          {surface === 'forums' &&
            FORUMS.map((f, i) => (
              <CanonicalForumRow
                key={f.id}
                first={i === 0}
                glyph={f.glyph}
                name={f.name}
                descriptor={f.descriptor}
                activity={f.activity}
                tag={f.tag}
                unread={f.unread}
              />
            ))}
        </CanonicalList>

        <View style={{ height: 120 }} />
      </ScrollView>

      <FloatingTabBar />
    </SafeAreaView>
  );
}

// =============================================================================
// SUPPORTING
// =============================================================================

function FloatingTabBar() {
  return (
    <View style={styles.floatNav} pointerEvents="box-none">
      <View style={styles.floatNavInner}>
        <FloatTab icon="boat-outline" label="Race" />
        <FloatTab icon="book-outline" label="Playbook" />
        <FloatTab icon="compass-outline" label="Discover" active />
        <FloatTab icon="time-outline" label="Reflect" />
      </View>
    </View>
  );
}

function FloatTab({
  icon,
  label,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
}) {
  const tint = active ? IOS_REGISTER.accentUserAction : IOS_REGISTER.labelSecondary;
  return (
    <View style={styles.floatTab}>
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={[styles.floatTabLabel, { color: tint }]}>{label}</Text>
    </View>
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
        Preview: canonical Discover trio. Tap the segmented control to cycle
        between Orgs, People, and Forums. Sample content; not wired.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: IOS_REGISTER.groundBg },
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  ptr: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ptrText: { fontSize: 12, color: IOS_REGISTER.labelTertiary, letterSpacing: -0.05 },
  header: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 6 },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  segWrap: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },
  search: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    height: 36,
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  searchPh: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.2,
    color: IOS_REGISTER.labelSecondary,
  },
  floatNav: {
    position: 'absolute',
    bottom: 22,
    left: 14,
    right: 14,
    alignItems: 'stretch',
  },
  floatNavInner: {
    height: 64,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow:
          '0 12px 28px -16px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.05)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  floatTab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  floatTabLabel: { fontSize: 10, letterSpacing: 0.4 },
});
