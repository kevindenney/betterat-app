/**
 * Discover · Pass 11 iOS register preview
 *
 * Five sub-tabs, one structure: a Cover (Today) front door + four curated
 * shelves (Paths / Orgs / People / Forums). Each shelf carries the same
 * three-section / three-signal grammar Pass 09 locked on Paths:
 *
 *   - Section 1 — coral dot, system recommendation tied to current practice
 *   - Section 2 — avatar dots, peer signal
 *   - Section 3 — no signal, editorial framing carries the weight
 *
 * The Cover samples the four shelves: one home-club spotlight (live green dot,
 * the one earned chrome-break), one editorial pick from Paths, three cross-
 * shelf invitations.
 *
 * Brief: docs/redesign/ios-register/discover-pass-11-brief.md
 * Locked baseline: docs/redesign/ios-register/discover-trio-canonical.html
 *
 * Wire-up status: placeholder data exactly matching the PDF copy. The data
 * each curated section needs (peer activity, capability overlap, fleet-club
 * graph, threads-near-concepts) doesn't yet exist as Supabase queries. Wiring
 * is a separate pass.
 *
 * Open at /discover-ios.
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
import { fontFamily } from '@/lib/design-tokens-editorial';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  IOS_COLORS,
  IOS_REGISTER,
  IOS_REGISTER_TEXT,
} from '@/lib/design-tokens-ios';

// =============================================================================
// CONSTANTS
// =============================================================================

const DISCOVERY_ACCENT = '#D97757'; // Component 13 — coral, system recommendation
const LIVE_GREEN = IOS_COLORS.systemGreen; // earned exception: home-club only

type SubTab = 'today' | 'paths' | 'orgs' | 'people' | 'forums';

const SUB_TABS: { value: SubTab; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'paths', label: 'Paths' },
  { value: 'orgs', label: 'Orgs' },
  { value: 'people', label: 'People' },
  { value: 'forums', label: 'Forums' },
];

const SUB_TAB_HEADERS: Record<SubTab, { eyebrow: string; title: string }> = {
  today: { eyebrow: 'DISCOVER · SAIL RACING', title: 'This Sunday' },
  paths: { eyebrow: 'DISCOVER', title: 'Paths for you' },
  orgs: { eyebrow: 'DISCOVER', title: 'Clubs and federations' },
  people: { eyebrow: 'DISCOVER', title: 'Sailors to learn from' },
  forums: { eyebrow: 'DISCOVER', title: 'Rooms to read' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DiscoverIosPreview() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('today');
  const header = SUB_TAB_HEADERS[activeSubTab];

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top chrome — close affordance */}
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

        {/* Title block — eyebrow + lighter-weight title; title and sub-tab
            move together (per the brief, no segmented swap of the title) */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>{header.eyebrow}</Text>
          <Text style={styles.title}>{header.title}</Text>
        </View>

        {/* Sub-tab segmented control — five segments, one structure */}
        <SubTabBar active={activeSubTab} onChange={setActiveSubTab} />

        {/* Surface body */}
        {activeSubTab === 'today' && <TodayCover />}
        {activeSubTab === 'paths' && <PathsShelf />}
        {activeSubTab === 'orgs' && <OrgsShelf />}
        {activeSubTab === 'people' && <PeopleShelf />}
        {activeSubTab === 'forums' && <ForumsShelf />}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// SUB-TAB BAR — the one switcher across all five surfaces
// =============================================================================

function SubTabBar({
  active,
  onChange,
}: {
  active: SubTab;
  onChange: (next: SubTab) => void;
}) {
  return (
    <View style={styles.subTabBarOuter}>
      <View style={styles.subTabBar}>
        {SUB_TABS.map((tab) => {
          const selected = tab.value === active;
          return (
            <Pressable
              key={tab.value}
              style={[styles.subTab, selected && styles.subTabSelected]}
              onPress={() => onChange(tab.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.subTabLabel,
                  selected && styles.subTabLabelSelected,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// =============================================================================
// COVER — Today / This Sunday
// =============================================================================

function TodayCover() {
  return (
    <View style={styles.surface}>
      {/* SECTION 1 — Now happening at your club (home-club spotlight) */}
      <SectionEyebrow text="NOW HAPPENING AT YOUR CLUB" />
      <View style={styles.homeClubCard}>
        <View style={styles.homeClubHeader}>
          <View style={[styles.avatar44, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.avatarInitials}>RH</Text>
          </View>
          <View style={styles.homeClubNameBlock}>
            <Text style={styles.homeClubName}>Royal Hong Kong Yacht Club</Text>
            <Text style={styles.homeClubDescriptor}>Member · Dragon helm</Text>
          </View>
        </View>
        <View style={styles.homeClubLines}>
          <View style={styles.homeClubLine}>
            <View style={styles.liveDot} />
            <Text style={styles.homeClubLineText}>
              <Text style={styles.italic}>Spring Series Race 5</Text> starts in{' '}
              <Text style={styles.semibold}>2 hours</Text>.
            </Text>
          </View>
          <View style={styles.homeClubLine}>
            <Ionicons
              name="people-outline"
              size={13}
              color={IOS_REGISTER.labelSecondary}
              style={styles.homeClubLineGlyph}
            />
            <Text style={styles.homeClubLineText}>
              Twelve sailors you follow are rigging now.
            </Text>
          </View>
        </View>
      </View>

      {/* SECTION 2 — This week's pick (one editorial bet, italic-serif) */}
      <SectionEyebrow
        text="THIS WEEK'S PICK"
        trailing={<SeeAllLink label="See all in Paths" />}
      />
      <View style={styles.pickCard}>
        <Text style={styles.pickEyebrow}>FOR YOU, THIS SUNDAY</Text>
        <Text style={styles.pickTitle}>Reading the breeze</Text>
        <Text style={styles.pickSource}>
          Stuart Walker
          <Text style={styles.cardSourceSep}> · </Text>
          Nine weeks
          <Text style={styles.cardSourceSep}> · </Text>
          Path
        </Text>
        <Text style={styles.pickQuote}>
          “Walker’s patient case for using the compass and the water surface to
          anticipate shifts before they happen — the discipline behind the
          concept you wrote last week.”
        </Text>
        <View style={styles.signalRowNoBorder}>
          <View style={styles.coralDot} />
          <Text style={styles.signalText}>
            Extends your concept{' '}
            <Text style={styles.italicEmphasis}>
              trust the shift, not just the side
            </Text>
            .
          </Text>
        </View>
      </View>

      {/* SECTION 3 — Also for you (three cross-shelf invitations) */}
      <SectionEyebrow
        text="ALSO FOR YOU"
        trailing={<SeeAllLink label="See more" />}
      />

      {/* A sailor — italic-serif-with-provenance quote */}
      <View style={styles.alsoCard}>
        <View style={styles.alsoTagRow}>
          <Text style={styles.alsoTag}>A SAILOR</Text>
        </View>
        <View style={styles.alsoSailorBody}>
          <View style={[styles.avatar44, { backgroundColor: '#9AA88F' }]}>
            <Text style={styles.avatarInitials}>YL</Text>
          </View>
          <View style={styles.alsoSailorText}>
            <Text style={styles.alsoSailorName}>Yvonne Leung</Text>
            <Text style={styles.alsoSailorRole}>
              Dragon helm · RHKYC · 17 seasons
            </Text>
          </View>
        </View>
        <Text style={styles.alsoSailorQuote}>
          “Once I started writing the wind shifts down before each race, I
          stopped second-guessing the side.”
        </Text>
        <Text style={styles.alsoSailorProv}>
          captured at her last debrief, three weeks ago
        </Text>
      </View>

      {/* A room — coral dot, threads-near-concepts framing */}
      <View style={styles.alsoCard}>
        <View style={styles.alsoTagRow}>
          <Text style={styles.alsoTag}>A ROOM</Text>
        </View>
        <View style={styles.alsoRoomBody}>
          <View style={styles.alsoRoomGlyph}>
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={IOS_REGISTER.labelSecondary}
            />
          </View>
          <View style={styles.alsoRoomText}>
            <Text style={styles.alsoRoomTitle}>
              Halyard tension downwind in chop
            </Text>
            <Text style={styles.alsoRoomDesc}>Dragon fleet · rig setup</Text>
          </View>
        </View>
        <View style={styles.signalRow}>
          <View style={styles.coralDot} />
          <Text style={styles.signalText}>
            Adjacent to your concept{' '}
            <Text style={styles.italicEmphasis}>
              trust the shift, not the side
            </Text>
            .
          </Text>
        </View>
      </View>

      {/* A club — avatar dots, peer signal */}
      <View style={styles.alsoCard}>
        <View style={styles.alsoTagRow}>
          <Text style={styles.alsoTag}>A CLUB</Text>
        </View>
        <View style={styles.alsoRoomBody}>
          <View style={[styles.avatar44, { backgroundColor: '#A2845E' }]}>
            <Text style={styles.avatarInitials}>HK</Text>
          </View>
          <View style={styles.alsoRoomText}>
            <Text style={styles.alsoRoomTitle}>Hebe Haven Yacht Club</Text>
            <Text style={styles.alsoRoomDesc}>Member club · Sai Kung</Text>
          </View>
        </View>
        <View style={styles.signalRow}>
          <AvatarDots colors={['#7A92A8', '#9AA88F', '#B0967E']} />
          <Text style={styles.signalText}>
            Six sailors you follow have raced here this season.
          </Text>
        </View>
      </View>

      {/* Cover has no search foot — that's a shelf concern */}
    </View>
  );
}

// =============================================================================
// PATHS — locked Pass 09 grammar (kept from original preview, lightly tuned)
// =============================================================================

function PathsShelf() {
  return (
    <View style={styles.surface}>
      <SectionEyebrow text="CONTINUING YOUR PRACTICE" />
      <PathCard
        title="Reading the breeze"
        length="9 weeks"
        author="Stuart Walker"
        authorRole="Path"
        description="Using the compass and the water surface to anticipate shifts before they happen."
        signal="coral"
        signalText={
          <>
            Extends your concept{' '}
            <Text style={styles.italicEmphasis}>
              trust the shift, not just the side
            </Text>
            .
          </>
        }
      />
      <PathCard
        title="Mark roundings under pressure"
        length="6 weeks"
        author="Bill Gladstone"
        authorRole="Path"
        description="Tactical decisions when the fleet compresses at the windward mark."
        signal="coral"
        signalText={
          <>
            Builds on{' '}
            <Text style={styles.italicEmphasis}>heavy-air helm work</Text>, the
            capability you’re on.
          </>
        }
      />
      <PathCard
        title="The rule before the start"
        length="4 weeks"
        author="Sam Cooke"
        authorRole="Companion path"
        description="On writing your own rules — the technique Sam touches in the path you’re on."
        signal="coral"
        signalText={
          <>Sam wrote this as a companion to your current path.</>
        }
      />

      <SectionEyebrow text="SAILORS YOU FOLLOW" />
      <PathCard
        title="Light-air starts"
        length="7 weeks"
        author="Dave Perry"
        authorRole="Path"
        description="The patience problem in zero-wind starting sequences."
        signal="avatars"
        avatarColors={['#7A92A8', '#9AA88F', '#B0967E']}
        signalText={<>Three sailors you follow are reading this.</>}
      />
      <PathCard
        title="Crew communication in heavy weather"
        length="5 weeks"
        author="Mike Holt"
        authorRole="Path"
        description="How to talk on the boat when the conditions make talking hard."
        signal="avatars"
        avatarColors={['#7A92A8', '#B0967E']}
        signalText={<>Two sailors you follow completed this last season.</>}
      />

      <SectionEyebrow text="NEW TERRITORY" />
      <PathCard
        title="Positioning"
        length="14 weeks"
        author="Stuart Walker"
        authorRole="Book path"
        description="The book Walker built his teaching career on. Strategy as the logic of where you choose to be."
        signal="none"
      />
      <PathCard
        title="Match racing fundamentals"
        length="11 weeks"
        author="Peter Isler"
        authorRole="Path"
        description="A different shape of the sport. Useful even if you never match race — it sharpens fleet tactics."
        signal="none"
      />

      <SearchFoot placeholder="Find a path" />
    </View>
  );
}

// =============================================================================
// ORGS — Clubs and federations
// =============================================================================

function OrgsShelf() {
  return (
    <View style={styles.surface}>
      {/* SECTION 1 — Where you race (home-club spotlight; the one chrome-break) */}
      <SectionEyebrow text="WHERE YOU RACE" />
      <View style={styles.homeClubCard}>
        <View style={styles.homeClubHeader}>
          <View style={[styles.avatar44, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.avatarInitials}>RH</Text>
          </View>
          <View style={styles.homeClubNameBlock}>
            <Text style={styles.homeClubName}>Royal Hong Kong Yacht Club</Text>
            <Text style={styles.homeClubDescriptor}>Member · Dragon helm</Text>
          </View>
        </View>
        <View style={styles.homeClubLines}>
          <View style={styles.homeClubLine}>
            <View style={styles.liveDot} />
            <Text style={styles.homeClubLineText}>
              <Text style={styles.italic}>Spring Series Race 5</Text> starts in{' '}
              <Text style={styles.semibold}>2 hours</Text>.
            </Text>
          </View>
          <View style={styles.homeClubLine}>
            <Ionicons
              name="people-outline"
              size={13}
              color={IOS_REGISTER.labelSecondary}
              style={styles.homeClubLineGlyph}
            />
            <Text style={styles.homeClubLineText}>
              Twelve sailors you follow are on the water.
            </Text>
          </View>
          <View style={styles.homeClubLine}>
            <Ionicons
              name="chatbubble-outline"
              size={13}
              color={IOS_REGISTER.labelSecondary}
              style={styles.homeClubLineGlyph}
            />
            <Text style={styles.homeClubLineText}>
              <Text style={styles.italic}>Dragon fleet · rig setup</Text> — three new replies.
            </Text>
          </View>
        </View>
      </View>

      {/* SECTION 2 — Clubs your fleet races at (coral / peer signal) */}
      <SectionEyebrow text="CLUBS YOUR FLEET RACES AT" />
      <AvatarRowCard
        initials="AB"
        markColor="#B0967E"
        name="Aberdeen Boat Club"
        descriptor="Member club · Ap Lei Chau"
        signal="coral"
        signalText={
          <>
            RHKYC Dragons race here for the{' '}
            <Text style={styles.italicEmphasis}>cross-harbour series</Text>.
          </>
        }
      />
      <AvatarRowCard
        initials="HK"
        markColor="#9AA88F"
        name="Hebe Haven Yacht Club"
        descriptor="Member club · Sai Kung"
        signal="coral"
        signalText={
          <>Six sailors you follow have raced here this season.</>
        }
      />

      {/* SECTION 3 — Federations and circuits (no signal) */}
      <SectionEyebrow text="FEDERATIONS AND CIRCUITS" />
      <AvatarRowCard
        initials="HK"
        markColor="#7A92A8"
        name="Hong Kong Sailing Federation"
        descriptor="National authority · founded 1962"
        signal="none"
      />
      <AvatarRowCard
        initials="IDA"
        markColor="#A2845E"
        name="International Dragon Association"
        descriptor="Class authority · 26 countries"
        signal="none"
      />

      <SearchFoot placeholder="Find a club" />
    </View>
  );
}

// =============================================================================
// PEOPLE — Sailors to learn from
// =============================================================================

function PeopleShelf() {
  return (
    <View style={styles.surface}>
      <SectionEyebrow text="WORKING ON WHAT YOU'RE WORKING ON" />
      <AvatarRowCard
        initials="MT"
        markColor="#7A92A8"
        name="Markus Tham"
        descriptor="Dragon helm · RHKYC · 11 seasons"
        signal="coral"
        signalText={
          <>
            Working on{' '}
            <Text style={styles.italicEmphasis}>heavy-air helm work</Text>, the
            same capability you’re on.
          </>
        }
      />
      <AvatarRowCard
        initials="YL"
        markColor="#9AA88F"
        name="Yvonne Leung"
        descriptor="Dragon helm · RHKYC · 17 seasons"
        signal="coral"
        signalText={
          <>
            Settled{' '}
            <Text style={styles.italicEmphasis}>
              trust the shift, not the side
            </Text>{' '}
            last March — your open concept.
          </>
        }
      />

      <SectionEyebrow text="IN YOUR FLEET" />
      <AvatarRowCard
        initials="RC"
        markColor="#B0967E"
        name="Ricardo Costa"
        descriptor="Dragon helm · RHKYC · 6 seasons"
        signal="avatars"
        avatarColors={['#7A92A8', '#9AA88F', '#B0967E']}
        signalText={<>Three sailors you follow also follow Ricardo.</>}
      />
      <AvatarRowCard
        initials="TR"
        markColor="#A2845E"
        name="Tomás Renart"
        descriptor="Dragon helm · RHKYC · 12 seasons"
        signal="avatars"
        avatarColors={['#7A92A8', '#9AA88F']}
        signalText={<>You both race out of Victoria Harbour.</>}
      />

      <SectionEyebrow text="AUTHORS IN YOUR PLAYBOOK" />
      <AvatarRowCard
        initials="SW"
        markColor="#3B82F6"
        name="Stuart Walker"
        descriptor="Author · 12 paths · The Tactics of Small Boat Racing"
        signal="none"
      />
      <AvatarRowCard
        initials="BG"
        markColor="#9AA88F"
        name="Bill Gladstone"
        descriptor="Author · 8 paths · North U coach"
        signal="none"
      />

      <SearchFoot placeholder="Find a sailor" />
    </View>
  );
}

// =============================================================================
// FORUMS — Rooms to read
// =============================================================================

function ForumsShelf() {
  return (
    <View style={styles.surface}>
      <SectionEyebrow text="THREADS NEAR YOUR OPEN CONCEPTS" />
      <RoomCard
        title="Halyard tension downwind in chop"
        descriptor="Dragon fleet · rig setup"
        signal="coral"
        signalText={
          <>
            Adjacent to your concept{' '}
            <Text style={styles.italicEmphasis}>
              trust the shift, not the side
            </Text>
            .
          </>
        }
      />
      <RoomCard
        title="When the right side wins for the wrong reason"
        descriptor="Stuart Walker readers"
        signal="coral"
        signalText={
          <>
            Quotes your <Text style={styles.italicEmphasis}>own</Text> debrief
            phrasing from Race 4.
          </>
        }
      />

      <SectionEyebrow text="WHERE YOUR FLEET IS TALKING" />
      <RoomCard
        title="2027 Dragon Worlds · HK"
        descriptor="Event room"
        signal="avatars"
        avatarColors={['#7A92A8', '#9AA88F', '#B0967E']}
        signalText={<>Markus, Yvonne and four others are reading this.</>}
      />
      <RoomCard
        title="Victoria Harbour conditions"
        descriptor="Location room · tide and breeze"
        signal="avatars"
        avatarColors={['#7A92A8', '#9AA88F']}
        signalText={<>Two sailors you follow posted here this week.</>}
      />

      <SectionEyebrow text="ROOMS WORTH KNOWING EXIST" />
      <RoomCard
        title="The starting-line library"
        descriptor="Technique room · curated by Dave Perry"
        signal="none"
      />
      <RoomCard
        title="Repair logs · classic Dragons"
        descriptor="Maintenance room · wooden boats"
        signal="none"
      />

      <SearchFoot placeholder="Find a room" />
    </View>
  );
}

// =============================================================================
// BUILDING BLOCKS
// =============================================================================

function SectionEyebrow({
  text,
  trailing,
}: {
  text: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionEyebrowRow}>
      <Text style={styles.sectionEyebrow}>{text}</Text>
      {trailing ? <View style={styles.sectionEyebrowTrailing}>{trailing}</View> : null}
    </View>
  );
}

function SeeAllLink({ label }: { label: string }) {
  return (
    <Pressable hitSlop={8}>
      <Text style={styles.seeAllText}>
        {label}
        <Text style={styles.seeAllChevron}> ›</Text>
      </Text>
    </Pressable>
  );
}

function AvatarDots({ colors }: { colors: string[] }) {
  return (
    <View style={styles.avatarsRow}>
      {colors.map((color, idx) => (
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
  );
}

type SignalKind = 'coral' | 'avatars' | 'none';

function PathCard({
  title,
  length,
  author,
  authorRole,
  description,
  signal,
  signalText,
  avatarColors,
}: {
  title: string;
  length: string;
  author: string;
  authorRole: string;
  description: string;
  signal: SignalKind;
  signalText?: React.ReactNode;
  avatarColors?: string[];
}) {
  return (
    <Pressable style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.lengthBadge}>
          <Text style={styles.lengthBadgeText}>{length}</Text>
        </View>
      </View>
      <Text style={styles.cardSource}>
        {author}
        <Text style={styles.cardSourceSep}> · </Text>
        {authorRole}
      </Text>
      <Text style={styles.cardDesc}>{description}</Text>
      {signal !== 'none' && signalText ? (
        <View style={styles.signalRow}>
          {signal === 'coral' ? (
            <View style={styles.coralDot} />
          ) : (
            <AvatarDots colors={avatarColors ?? []} />
          )}
          <Text style={styles.signalText}>{signalText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function AvatarRowCard({
  initials,
  markColor,
  name,
  descriptor,
  signal,
  signalText,
  avatarColors,
}: {
  initials: string;
  markColor: string;
  name: string;
  descriptor: string;
  signal: SignalKind;
  signalText?: React.ReactNode;
  avatarColors?: string[];
}) {
  return (
    <Pressable style={styles.card}>
      <View style={styles.rowCardHeader}>
        <View style={[styles.avatar44, { backgroundColor: markColor }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <View style={styles.rowCardNameBlock}>
          <Text style={styles.rowCardName}>{name}</Text>
          <Text style={styles.rowCardDescriptor}>{descriptor}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_REGISTER.labelTertiary}
        />
      </View>
      {signal !== 'none' && signalText ? (
        <View style={styles.signalRow}>
          {signal === 'coral' ? (
            <View style={styles.coralDot} />
          ) : (
            <AvatarDots colors={avatarColors ?? []} />
          )}
          <Text style={styles.signalText}>{signalText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function RoomCard({
  title,
  descriptor,
  signal,
  signalText,
  avatarColors,
}: {
  title: string;
  descriptor: string;
  signal: SignalKind;
  signalText?: React.ReactNode;
  avatarColors?: string[];
}) {
  return (
    <Pressable style={styles.card}>
      <View style={styles.rowCardHeader}>
        <View style={[styles.roomGlyph]}>
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={IOS_REGISTER.labelSecondary}
          />
        </View>
        <View style={styles.rowCardNameBlock}>
          <Text style={styles.rowCardName}>{title}</Text>
          <Text style={styles.rowCardDescriptor}>{descriptor}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_REGISTER.labelTertiary}
        />
      </View>
      {signal !== 'none' && signalText ? (
        <View style={styles.signalRow}>
          {signal === 'coral' ? (
            <View style={styles.coralDot} />
          ) : (
            <AvatarDots colors={avatarColors ?? []} />
          )}
          <Text style={styles.signalText}>{signalText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SearchFoot({ placeholder }: { placeholder: string }) {
  return (
    <View style={styles.searchFootOuter}>
      <View style={styles.searchFootPill}>
        <Ionicons
          name="search"
          size={14}
          color={IOS_REGISTER.labelTertiary}
        />
        <Text style={styles.searchFootText}>{placeholder}</Text>
      </View>
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
        Preview: Pass 11 — Discover · Cover and four shelves. Placeholder data
        matches the brief. Wiring is a separate pass.
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

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

  // Title block
  titleBlock: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 12,
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

  // Sub-tab bar — five-segment pill control
  subTabBarOuter: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 9,
    padding: 2,
  },
  subTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabSelected: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow:
          '0 3px 1px rgba(0,0,0,0.04), 0 3px 8px rgba(0,0,0,0.12)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  subTabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.08,
  },
  subTabLabelSelected: {
    fontWeight: '600',
  },

  // Surface body
  surface: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Section eyebrow row (with optional trailing link)
  sectionEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 12,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionEyebrowTrailing: {},
  seeAllText: {
    fontSize: 13,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  seeAllChevron: {
    color: IOS_REGISTER.accentUserAction,
  },

  // Home-club spotlight — the one earned chrome-break on Discover
  homeClubCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
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
  homeClubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  homeClubNameBlock: {
    flex: 1,
  },
  homeClubName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  homeClubDescriptor: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  homeClubLines: {
    gap: 8,
  },
  homeClubLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  homeClubLineGlyph: {
    marginTop: 2,
  },
  homeClubLineText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: IOS_REGISTER.label,
    letterSpacing: -0.15,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LIVE_GREEN,
    marginTop: 6,
  },

  // This week's pick — italic-serif treatment
  pickCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.25)',
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
  pickEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    color: DISCOVERY_ACCENT,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pickTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pickSource: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  pickQuote: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    lineHeight: 22,
    letterSpacing: -0.15,
    fontStyle: 'italic',
    fontFamily: fontFamily.serif,
    marginBottom: 12,
  },

  // Also-for-you cards
  alsoCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
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
  alsoTagRow: {
    marginBottom: 10,
  },
  alsoTag: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  alsoSailorBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  alsoSailorText: {
    flex: 1,
  },
  alsoSailorName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  alsoSailorRole: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  alsoSailorQuote: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    lineHeight: 22,
    letterSpacing: -0.15,
    fontStyle: 'italic',
    fontFamily: fontFamily.serif,
    marginBottom: 6,
  },
  alsoSailorProv: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
    fontStyle: 'italic',
  },
  alsoRoomBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  alsoRoomGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alsoRoomText: {
    flex: 1,
  },
  alsoRoomTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  alsoRoomDesc: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },

  // Path card (Pass 09 shape — title + length badge on top, source line, desc)
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

  // Avatar-row card (orgs / people)
  rowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCardNameBlock: {
    flex: 1,
  },
  rowCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  rowCardDescriptor: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  avatar44: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  roomGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Signal row (coral dot OR avatar dots + text)
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: IOS_REGISTER.separator,
  },
  signalRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  coralDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DISCOVERY_ACCENT,
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

  // Search foot — quiet pill below all three sections (shelves only)
  searchFootOuter: {
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchFootPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(120, 120, 128, 0.10)',
    borderRadius: 12,
  },
  searchFootText: {
    fontSize: 14,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.15,
  },

  // Inline emphasis helpers
  italic: {
    fontStyle: 'italic',
  },
  italicEmphasis: {
    fontStyle: 'italic',
    fontFamily: fontFamily.serif,
  },
  semibold: {
    fontWeight: '600',
  },
});
