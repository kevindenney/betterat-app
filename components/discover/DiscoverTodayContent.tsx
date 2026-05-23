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
 *   - NOW HAPPENING AT YOUR {INSTITUTION} — home-org spotlight, the one
 *     earned chrome-break. Skipped entirely if no home org (the Cover
 *     doesn't pad).
 *   - THIS WEEK'S PICK and ALSO FOR YOU are intentionally NOT rendered yet —
 *     they require automated editor-like weekly scoring that the brief
 *     captures but the live tab doesn't have data for. Per the brief's
 *     "no empty state" rule, omitted is correct.
 *
 * Wire-up status (2026-05-23):
 *   - Home org: wired to the user's first active organization_membership
 *     scoped to the current interest. Both `status` and `membership_status`
 *     are checked (feedback_membership_status_split). Cross-interest
 *     fallback is intentionally absent — a nursing-school membership
 *     mustn't show under Sail Racing.
 *   - Vocabulary-aware eyebrow via vocab('Institution'): Yacht Club /
 *     Clinical Site / Studio / Gym / Training Group.
 *   - "This week's pick" + "Also for you" land when automated scoring is
 *     implemented. The scoring sketch lives in the Pass 11 brief.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
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

interface DiscoverTodayContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HOME-ORG QUERY — Pass 11 "Now happening" wiring
// =============================================================================

interface HomeOrg {
  orgId: string;
  name: string;
  slug: string | null;
  role: string | null;
}

function useHomeOrg(): HomeOrg | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const [club, setClub] = useState<HomeOrg | null>(null);

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
        // `membership_status` can diverge in the seed data
        // (feedback_membership_status_split). (2) fetch the org rows for the
        // matching IDs and pick one scoped to the current interest. Embedded
        // !inner joins also don't work here because
        // organization_memberships → auth.users isn't a relationship
        // PostgREST can resolve through the public schema
        // (feedback_supabase_embed_needs_fk).
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
        // this guard a nursing-school membership leaks into the Sail Racing
        // Today surface (and vice versa). The Cover represents what's
        // happening at your institution *in this interest*; cross-interest
        // orgs belong on the Today surface for those interests, not this one.
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
        console.warn('[DiscoverToday] home-org query failed:', err);
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
  const homeOrg = useHomeOrg();
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

      {/* Home-org spotlight — omitted entirely when no home org in this
          interest (per brief: the Cover doesn't pad). */}
      {homeOrg ? (
        <>
          <View style={styles.sectionEyebrowRow}>
            <Text style={styles.sectionEyebrow}>{nowHappeningEyebrow}</Text>
          </View>
          <View style={styles.homeClubCard}>
            <View
              style={[
                styles.avatar44,
                { backgroundColor: pickSquareMarkColor(homeOrg.orgId) },
              ]}
            >
              <Text style={styles.avatarInitials}>
                {initialsForName(homeOrg.name)}
              </Text>
            </View>
            <View style={styles.homeClubNameBlock}>
              <Text style={styles.homeClubName}>{homeOrg.name}</Text>
              <Text style={styles.homeClubDescriptor}>
                {homeOrg.role ? capitalize(homeOrg.role) : 'Member'}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {/* This week's pick + Also for you intentionally omitted. They need
          automated editor-like weekly scoring (concept overlap, author
          authority, peer signal) that isn't yet implemented. Per the brief's
          "no empty state" rule, omitting is correct. A single banner below
          explains the state to anyone curious why the surface is thin. */}
      <View style={styles.previewBanner}>
        <Ionicons
          name="information-circle"
          size={14}
          color={IOS_REGISTER.labelSecondary}
        />
        <Text style={styles.previewBannerText}>
          {homeOrg
            ? 'Your home org is wired here.'
            : 'No home org for this interest yet — join one in Orgs.'}
          {' '}This week’s pick + Also for you land when automated weekly
          scoring is implemented.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
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

  // Home-org spotlight card
  homeClubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

  // Preview banner — a single line explaining the not-yet-wired sections
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 16,
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
});
