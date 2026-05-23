/**
 * DiscoverTodayContent — the Cover front door of the Discover tab
 *
 * Pass 11 (docs/redesign/ios-register/discover-pass-11-brief.md):
 *
 *   The front of the magazine. One thing happening now, one editorial pick,
 *   three cross-shelf invitations. The five sub-tabs share one structure;
 *   the Cover is the front door.
 *
 *   - Title is time-stamped rather than categorical ("This Sunday" instead of
 *     "Discover") — the title does editorial work.
 *   - NOW HAPPENING AT YOUR CLUB — home-club spotlight, the one earned
 *     chrome-break. Live green dot permitted. Skipped entirely if nothing's
 *     live (the Cover doesn't pad).
 *   - THIS WEEK'S PICK — one featured Path, italic-serif description, full
 *     Component-1 weight. Always a Path — the most considered editorial move
 *     BetterAt makes per week.
 *   - ALSO FOR YOU — three cards, each tagged A sailor / A room / A club.
 *
 * Wire-up status (2026-05-23):
 *   - "Now happening" pulls the user's primary org from organization_memberships
 *     so the home-club identity is real. The race + sailors-you-follow count
 *     line is currently illustrative; an upcoming-race query lands in a future
 *     pass.
 *   - "This week's pick" + "Also for you" render with illustrative content
 *     pending automated editor-like picking. Brief calls for scoring that
 *     selects 1 Path per week (concept overlap, author authority, freshness)
 *     and 3 cross-shelf cards (one per source shelf, top of its system-rec
 *     section). A small "Preview" banner explains the state.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { supabase } from '@/services/supabase';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { initialsForName, pickSquareMarkColor } from '@/components/discover/canonical';

const DISCOVERY_ACCENT = '#D97757';
const LIVE_GREEN = IOS_COLORS.systemGreen;

interface DiscoverTodayContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HOME-CLUB QUERY — Pass 11 "Now happening" wiring
// =============================================================================

interface HomeClub {
  orgId: string;
  name: string;
  slug: string | null;
  role: string | null;
}

function useHomeClub(): HomeClub | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const [club, setClub] = useState<HomeClub | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setClub(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Two-step lookup. (1) fetch every membership row this user has and
        // filter by BOTH status columns in JS — `status` and
        // `membership_status` can diverge in the seed data (see
        // feedback_membership_status_split). (2) fetch the org rows for the
        // matching membership IDs, preferring an org in the current interest
        // when one exists, else any active org. (3) Embedded `!inner` joins
        // also don't work here because organization_memberships → auth.users
        // isn't a relationship PostgREST can resolve through public schema.
        const { data: memberships, error: memErr } = await supabase
          .from('organization_memberships')
          .select('organization_id, role, status, membership_status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (memErr) throw memErr;
        if (cancelled) return;

        const activeRows = (memberships ?? []).filter((r: any) => {
          const a = r.status === 'active' || r.status === 'invite_accepted';
          const b =
            r.membership_status === 'active' ||
            r.membership_status === 'invite_accepted';
          return a || b;
        }) as { organization_id: string; role: string | null }[];

        if (activeRows.length === 0) {
          setClub(null);
          return;
        }

        const orgIds = activeRows.map((r) => r.organization_id);
        const { data: orgs, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name, slug, interest_slug, is_active')
          .in('id', orgIds)
          .eq('is_active', true);
        if (orgErr) throw orgErr;
        if (cancelled) return;

        const orgsById = new Map<string, any>();
        for (const o of orgs ?? []) orgsById.set(o.id, o);

        // Only pick an org scoped to the user's current interest. Without
        // this guard a nursing-school membership leaked into the Sail Racing
        // Today surface (and vice versa). The Cover represents what's
        // happening at "your club" *in this interest*; cross-interest orgs
        // belong on the Today surface for those interests, not this one.
        const interestSlug = currentInterest?.slug ?? null;
        let pick: { row: { organization_id: string; role: string | null }; org: any } | null =
          null;
        for (const row of activeRows) {
          const org = orgsById.get(row.organization_id);
          if (!org) continue;
          if (!interestSlug || org.interest_slug === interestSlug) {
            pick = { row, org };
            break;
          }
        }

        if (pick) {
          setClub({
            orgId: pick.org.id,
            name: pick.org.name,
            slug: pick.org.slug ?? null,
            role: pick.row.role,
          });
        } else {
          setClub(null);
        }
      } catch (err) {
        console.warn('[DiscoverToday] home-club query failed:', err);
        if (!cancelled) setClub(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, currentInterest?.slug]);

  return club;
}

// =============================================================================
// MAIN
// =============================================================================

export function DiscoverTodayContent({
  toolbarOffset,
  onScroll,
}: DiscoverTodayContentProps) {
  const homeClub = useHomeClub();
  const { vocab } = useVocabulary();
  const todayLabel = useMemo(() => formatTodayLabel(new Date()), []);

  // Vocabulary-aware eyebrow. The brief's "AT YOUR CLUB" is sailing-specific;
  // BetterAt is multi-interest so the institution word swaps in:
  //   sail-racing → "Yacht Club"   nursing → "Clinical Site"
  //   drawing     → "Studio"       fitness → "Gym"
  const institutionWord = vocab('Institution').toUpperCase();
  const nowHappeningEyebrow = `NOW HAPPENING AT YOUR ${institutionWord}`;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{todayLabel}</Text>
      </View>

      <View style={styles.previewBanner}>
        <Ionicons
          name="information-circle"
          size={14}
          color={IOS_REGISTER.labelSecondary}
        />
        <Text style={styles.previewBannerText}>
          Pass 11 front door. Home club is wired to your membership; the
          editorial picks below are illustrative until automated weekly
          scoring lands.
        </Text>
      </View>

      {/* NOW HAPPENING AT YOUR {INSTITUTION} — omitted entirely when no home org */}
      {homeClub ? (
        <>
          <SectionEyebrow text={nowHappeningEyebrow} />
          <View style={styles.homeClubCard}>
            <View style={styles.homeClubHeader}>
              <View
                style={[
                  styles.avatar44,
                  { backgroundColor: pickSquareMarkColor(homeClub.orgId) },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {initialsForName(homeClub.name)}
                </Text>
              </View>
              <View style={styles.homeClubNameBlock}>
                <Text style={styles.homeClubName}>{homeClub.name}</Text>
                <Text style={styles.homeClubDescriptor}>
                  {homeClub.role ? capitalize(homeClub.role) : 'Member'}
                </Text>
              </View>
            </View>
            <View style={styles.homeClubLines}>
              <View style={styles.homeClubLine}>
                <View style={styles.liveDot} />
                <Text style={styles.homeClubLineText}>
                  Pending wire-up — the live-race signal lands when the
                  upcoming-race query is implemented.
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : null}

      {/* THIS WEEK'S PICK — illustrative until automated scoring lands */}
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

      {/* ALSO FOR YOU — three cross-shelf invitations, illustrative for now */}
      <SectionEyebrow
        text="ALSO FOR YOU"
        trailing={<SeeAllLink label="See more" />}
      />
      <AlsoForYouSailor />
      <AlsoForYouRoom />
      <AlsoForYouClub />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// =============================================================================
// ALSO-FOR-YOU CARDS — illustrative content; rotate to real picks in next pass
// =============================================================================

function AlsoForYouSailor() {
  return (
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
  );
}

function AlsoForYouRoom() {
  return (
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
  );
}

function AlsoForYouClub() {
  return (
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
      {trailing ? <View>{trailing}</View> : null}
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

// =============================================================================
// HELPERS
// =============================================================================

function formatTodayLabel(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return `This ${weekday}`;
  return weekday;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120, paddingHorizontal: 16 },

  titleBlock: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
    letterSpacing: -0.88,
    color: IOS_REGISTER.label,
  },

  previewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
  },
  previewBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
  },

  // Section eyebrow
  sectionEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  seeAllText: {
    fontSize: 13,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  seeAllChevron: {
    color: IOS_REGISTER.accentUserAction,
  },

  // Home-club spotlight (the one earned chrome-break)
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

  // This week's pick
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
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      web: { fontFamily: 'Georgia, "Times New Roman", serif' } as any,
    }),
    marginBottom: 12,
  },
  cardSourceSep: {
    color: IOS_REGISTER.labelTertiary,
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
  alsoTagRow: { marginBottom: 10 },
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
  alsoSailorText: { flex: 1 },
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
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      web: { fontFamily: 'Georgia, "Times New Roman", serif' } as any,
    }),
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
  alsoRoomText: { flex: 1 },
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

  // Avatars
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

  // Signal row
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

  italicEmphasis: {
    fontStyle: 'italic',
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      web: { fontFamily: 'Georgia, "Times New Roman", serif' } as any,
    }),
  },
});
