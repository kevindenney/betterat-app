import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RelationshipButton } from '@/components/discover/detail';
import { IOSDetailNavBar } from '@/components/discover/detail';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { showConfirm, showAlert } from '@/lib/utils/crossPlatformAlert';
import { OrgLocationsMap, type OrgLocation } from '@/components/organizations/OrgLocationsMap';
import { useOrgViewerMembership } from '@/hooks/useOrgViewerMembership';
import { useOrganization } from '@/providers/OrganizationProvider';
import { OrgJoinService } from '@/services/OrgJoinService';
import {
  YachtClubClaimService,
  type OrgJoinMode,
  type YachtClubOrganization,
} from '@/services/YachtClubClaimService';
import {
  YACHT_CLUB_DEMO_CALENDAR,
  YACHT_CLUB_DEMO_FLEETS,
  YACHT_CLUB_DEMO_FOCUS,
  YACHT_CLUB_DEMO_MAJOR_CLASSES,
  YACHT_CLUB_DEMO_MEMBERSHIP,
  YACHT_CLUB_DEMO_PROGRAMS,
  YACHT_CLUB_DEMO_RACES,
  YACHT_CLUB_DEMO_PROFILE,
  YACHT_CLUB_DEMO_SOCIAL_CALENDAR,
  YACHT_CLUB_DEMO_SURFACES,
  YACHT_CLUB_DEMO_TAGLINE,
  YACHT_CLUB_DEMO_NAME,
  YACHT_CLUB_DEMO_STATS,
  YACHT_CLUB_DEMO_TIERS,
  isYachtClubDemoSlug,
} from '@/services/YachtClubDemoService';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  blue: '#0B63CE',
  green: '#0F766E',
  amber: '#B45309',
  red: '#B42318',
} as const;

function statusLabel(org: YachtClubOrganization): string {
  if (org.claim_status === 'claimed' && org.official) return 'Official BetterAt organization';
  if (org.claim_status === 'claim_pending') return 'Claim pending review';
  if (org.claim_status === 'rejected') return 'Claim rejected';
  return 'Unclaimed placeholder';
}

/**
 * Resolve display copy by `organizations.organization_type`. The page
 * used to be yacht-club-only; now that non-yacht orgs (e.g. JHSON for
 * nursing) appear via search, we render the right vocabulary instead
 * of "BetterAt Yacht Clubs" on every page.
 */
function orgTypeLabels(type: string | null | undefined): {
  eyebrow: string;
  contextLabel: string;
  pricingLabel: string;
} {
  switch (type) {
    case 'yacht_club':
      return {
        eyebrow: 'BetterAt Yacht Clubs',
        contextLabel: 'Yacht club',
        pricingLabel: 'Yacht-club pricing',
      };
    case 'institution':
      return {
        eyebrow: 'BetterAt Institutions',
        contextLabel: 'Institution',
        pricingLabel: 'Institutional pricing',
      };
    case 'association':
      return {
        eyebrow: 'BetterAt Associations',
        contextLabel: 'Association',
        pricingLabel: 'Pricing',
      };
    case 'community':
      return {
        eyebrow: 'BetterAt Communities',
        contextLabel: 'Community',
        pricingLabel: 'Pricing',
      };
    case 'business':
      return {
        eyebrow: 'BetterAt Businesses',
        contextLabel: 'Business',
        pricingLabel: 'Pricing',
      };
    case 'club':
    default:
      return {
        eyebrow: 'BetterAt Clubs',
        contextLabel: 'Club',
        pricingLabel: 'Club pricing',
      };
  }
}

function tierLabel(tier: string | null): string {
  switch (tier) {
    case 'club_free':
      return 'Free club tier';
    case 'club_plus':
      return 'Club Plus';
    case 'club_pro':
      return 'Regatta Pro';
    case 'enterprise':
      return 'Institutional';
    default:
      return 'Club tier';
  }
}

export default function OrganizationPlaceholderPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const isDemo = isYachtClubDemoSlug(slug);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<YachtClubOrganization | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [orgLocations, setOrgLocations] = useState<OrgLocation[]>([]);
  const [joining, setJoining] = useState(false);
  const { user: authUser } = useAuth();
  const { setActiveOrganizationId } = useOrganization();
  const toast = useToast();
  // Viewer's membership in this org. `null` once resolved means
  // non-member; status='active' is a full member; pending/rejected are
  // shown distinctly so the join CTA can adapt.
  const { membership, refetch: refetchMembership } = useOrgViewerMembership(org?.id);
  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/library' as never);
  }, []);
  const handleOpenAtlas = React.useCallback(() => {
    if (!slug) return;
    router.push({ pathname: '/(tabs)/atlas', params: { orgSlug: slug } } as any);
  }, [slug]);
  // Self-serve join, branched by the org's join_mode. open_join lands
  // the viewer as an active member; request_to_join files a pending
  // request an admin approves later. invite_only never reaches here.
  const runJoin = React.useCallback(
    async (joinMode: OrgJoinMode) => {
      if (!authUser?.id || !org?.id || joining) return;
      setJoining(true);
      try {
        const result = await OrgJoinService.join({
          orgId: org.id,
          userId: authUser.id,
          joinMode,
        });
        refetchMembership();
        toast.show(
          result === 'active' ? 'You’re in — welcome!' : 'Request submitted',
          'success',
        );
      } catch (err) {
        toast.show((err as Error)?.message || 'Could not join this organization', 'error');
      } finally {
        setJoining(false);
      }
    },
    [authUser?.id, org?.id, joining, refetchMembership, toast],
  );
  // Member-surface link-hub. The /organization/* surfaces resolve which
  // org to show from the global active-org context (OrganizationProvider),
  // not a route param — so switch the active org to this one before
  // navigating. The setter is a no-op unless the viewer is an active
  // member here, which is exactly when these links render.
  const goToMemberSurface = React.useCallback(
    async (route: string) => {
      if (org?.id) await setActiveOrganizationId(org.id);
      router.push(route as never);
    },
    [org?.id, setActiveOrganizationId],
  );
  const handleJoinPress = React.useCallback(() => {
    const joinMode: OrgJoinMode = org?.join_mode ?? 'invite_only';
    if (joinMode === 'invite_only') {
      showAlert(
        'Membership is by invitation',
        'This organization adds members by invitation. Reach out to an organizer to be added.',
      );
      return;
    }
    if (joinMode === 'open_join') {
      showConfirm(
        `Join ${org?.name ?? 'this organization'}?`,
        'You’ll get access to this organization right away.',
        () => void runJoin('open_join'),
        { confirmText: 'Join' },
      );
      return;
    }
    showConfirm(
      `Request to join ${org?.name ?? 'this organization'}?`,
      'An organizer will review your request before you’re added.',
      () => void runJoin('request_to_join'),
      { confirmText: 'Request' },
    );
  }, [org?.join_mode, org?.name, runJoin]);
  // Fetch all organization_locations for the embedded map below the
  // hero. Ordered by sort_order so the primary site sits first in any
  // future "Sites" list. RLS allows public SELECT (org-site geography
  // is a discovery surface); writes stay owner/admin only.
  useEffect(() => {
    let cancelled = false;
    if (!org?.id) {
      setOrgLocations([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const { data } = await supabase
        .from('organization_locations')
        .select('id, name, lat, lng, sort_order')
        .eq('organization_id', org.id)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []) as Record<string, unknown>[];
      const out: OrgLocation[] = [];
      for (const r of rows) {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (lat === 0 && lng === 0) continue;
        out.push({
          id: r.id ? String(r.id) : undefined,
          name: r.name ? String(r.name) : 'Site',
          lat,
          lng,
        });
      }
      setOrgLocations(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        if (isDemo) {
          const demoOrg = await YachtClubClaimService.getOrganizationBySlug(slug);
          if (!demoOrg) throw new Error('Organization not found.');
          if (cancelled) return;
          setOrg(demoOrg);
          return;
        }
        const nextOrg = await YachtClubClaimService.getOrganizationBySlug(slug);
        if (!nextOrg) throw new Error('Organization not found.');
        if (cancelled) return;
        setOrg(nextOrg);
      } catch (error: any) {
        if (!cancelled) setErrorText(error?.message || 'Could not load this organization.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemo, slug]);

  const isPlaceholder = org?.status === 'placeholder' || org?.official === false;
  const visibleAliases = Array.from(new Set(org?.aliases ?? []));
  const demoTierCards = YACHT_CLUB_DEMO_TIERS;
  const typeLabels = orgTypeLabels(org?.organization_type);
  // ClubSpot-imported clubs (source='dragon_worlds_clubspot') are the
  // only orgs with import-evidence stats and ClubSpot aliases; every
  // other org type has source=null and should get a generic body.
  const isClubspotImport = !!org?.source && org.source.includes('clubspot');
  const isActiveMember = !isDemo && membership?.status === 'active';
  // Member surfaces, all admin-gated server-side via RLS regardless of
  // what we show. Billing is admin-only in the UI (manage subscription).
  const memberLinks = React.useMemo(
    () => [
      { key: 'programs', label: 'Programs', detail: 'Templates and blueprints this org publishes', route: '/organization/templates', icon: 'albums-outline' as const, adminOnly: false },
      { key: 'cohorts', label: 'Cohorts', detail: 'Groups moving through a blueprint together', route: '/organization/cohorts', icon: 'people-outline' as const, adminOnly: false },
      { key: 'members', label: 'Members', detail: 'Roster, roles, and join requests', route: '/organization/members', icon: 'person-add-outline' as const, adminOnly: false },
      { key: 'competencies', label: 'Competencies', detail: 'The capability framework and evidence', route: '/organization/competencies', icon: 'ribbon-outline' as const, adminOnly: false },
      { key: 'billing', label: 'Manage subscription', detail: 'Plan, seats, and billing', route: '/organization/billing', icon: 'card-outline' as const, adminOnly: true },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: org?.name || 'Organization' }} />
      <IOSDetailNavBar
        backLabel="Orgs"
        contextLabel={typeLabels.contextLabel}
        dockedName={org?.name}
        docked={false}
        onBack={handleBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : errorText || !org ? (
          <View style={styles.card}>
            <Ionicons name="business-outline" size={36} color={C.muted} />
            <Text style={styles.title}>Organization not found</Text>
            <Text style={styles.body}>{errorText || 'This organization may not exist yet.'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.mark}>
                <Text style={styles.markText}>{org.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.heroText}>
                <Text style={styles.eyebrow}>{typeLabels.eyebrow}</Text>
                <Text style={styles.h1}>{org.name}</Text>
                <View
                  style={[
                    styles.badge,
                    isDemo
                      ? styles.badgeDemo
                      : org.official
                        ? styles.badgeOfficial
                        : styles.badgePlaceholder,
                  ]}
                >
                  <Ionicons
                    name={isDemo ? 'sparkles-outline' : org.official ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                    size={15}
                    color={isDemo ? C.blue : org.official ? C.green : C.amber}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      isDemo ? styles.demoText : org.official ? styles.officialText : styles.placeholderText,
                    ]}
                  >
                    {isDemo ? 'Synthetic demo club' : statusLabel(org)}
                  </Text>
                </View>
                {isDemo ? <Text style={styles.heroSub}>{YACHT_CLUB_DEMO_TAGLINE}</Text> : null}
              </View>
            </View>

            {/* Membership badge — sits between hero and actions so the
                viewer immediately knows their relationship to this org.
                Shown only for non-demo orgs (demo orgs use a separate
                'Synthetic demo club' badge in the hero). */}
            {!isDemo && membership ? (
              <View
                style={[
                  styles.membershipBadge,
                  membership.status === 'active'
                    ? styles.membershipBadgeActive
                    : membership.status === 'pending'
                      ? styles.membershipBadgePending
                      : styles.membershipBadgeMuted,
                ]}
              >
                <Ionicons
                  name={
                    membership.status === 'active'
                      ? 'shield-checkmark-outline'
                      : membership.status === 'pending'
                        ? 'hourglass-outline'
                        : 'close-circle-outline'
                  }
                  size={14}
                  color={
                    membership.status === 'active'
                      ? C.green
                      : membership.status === 'pending'
                        ? C.amber
                        : C.muted
                  }
                />
                <Text style={styles.membershipBadgeText}>
                  {membership.status === 'active'
                    ? membership.isAdmin
                      ? `You're an ${membership.role}`
                      : "You're a member"
                    : membership.status === 'pending'
                      ? 'Membership pending'
                      : `Membership ${membership.status}`}
                </Text>
              </View>
            ) : null}

            {/* Embedded map of all the org's locations. Hidden when
                there are zero rows in organization_locations so the
                hero/CTAs don't get an empty placeholder card. */}
            {orgLocations.length > 0 ? (
              <View style={styles.embeddedMapWrap}>
                <OrgLocationsMap locations={orgLocations} height={220} />
                <Text style={styles.embeddedMapCaption}>
                  {orgLocations.length === 1
                    ? '1 site'
                    : `${orgLocations.length} sites`}
                </Text>
              </View>
            ) : null}

            <View style={styles.mapActionRow}>
              <RelationshipButton
                label="Open map"
                icon="map-outline"
                secondary
                fullWidth={false}
                onPress={handleOpenAtlas}
              />
              {/* Member-vs-non-member CTA. Active members (admins) get a
                  Manage shortcut; everyone else gets a join CTA whose
                  shape follows the org's join_mode and the viewer's
                  pending/rejected state. */}
              {!isDemo && membership?.status === 'active' ? (
                membership.isAdmin ? (
                  <RelationshipButton
                    label="Manage"
                    icon="settings-outline"
                    secondary
                    fullWidth={false}
                    onPress={() => router.push(`/admin/organizations/${slug}` as never)}
                  />
                ) : null
              ) : !isDemo && org && membership?.status === 'pending' ? (
                <RelationshipButton
                  label="Request pending"
                  icon="hourglass-outline"
                  secondary
                  fullWidth={false}
                  onPress={() => {}}
                />
              ) : !isDemo && org ? (
                <RelationshipButton
                  label={
                    (org.join_mode ?? 'invite_only') === 'invite_only'
                      ? 'By invitation'
                      : (org.join_mode === 'request_to_join'
                          ? (membership?.status === 'rejected' ? 'Request again' : 'Request to join')
                          : 'Join organization')
                  }
                  icon={
                    (org.join_mode ?? 'invite_only') === 'invite_only'
                      ? 'mail-outline'
                      : 'add-circle-outline'
                  }
                  secondary={(org.join_mode ?? 'invite_only') === 'invite_only'}
                  fullWidth={false}
                  loading={joining}
                  onPress={handleJoinPress}
                />
              ) : null}
            </View>

            {/* Member link-hub. Active members get one-tap access to the
                org's working surfaces; admin-only rows (billing) are
                hidden for non-admins. Each tap switches the active-org
                context to this org first (see goToMemberSurface). */}
            {isActiveMember ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Your organization</Text>
                <View style={styles.surfaceList}>
                  {memberLinks
                    .filter((link) => !link.adminOnly || membership?.isAdmin)
                    .map((link) => (
                      <Pressable
                        key={link.key}
                        style={styles.surfaceRow}
                        onPress={() => void goToMemberSurface(link.route)}
                      >
                        <Ionicons name={link.icon} size={20} color={C.blue} />
                        <View style={styles.surfaceCopy}>
                          <Text style={styles.surfaceLabel}>{link.label}</Text>
                          <Text style={styles.surfaceDetail}>{link.detail}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.muted} />
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}

            {isDemo ? (
              <>
                <View style={styles.demoNotice}>
                  <Text style={styles.noticeTitle}>This is a synthetic sample club.</Text>
                  <Text style={styles.noticeBody}>
                    {YACHT_CLUB_DEMO_NAME} is not claimable and is not tied to a real venue. Use it to see
                    the club profile, linked club surfaces, and Atlas handoff before you build the real one.
                  </Text>
                </View>

                <View style={styles.grid}>
                  {YACHT_CLUB_DEMO_STATS.map((card) => (
                    <View key={card.label} style={styles.stat}>
                      <Text style={styles.statValue}>{card.value}</Text>
                      <Text style={styles.statLabel}>{card.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Current focus</Text>
                  <Text style={styles.focusBody}>{YACHT_CLUB_DEMO_FOCUS}</Text>
                  <View style={styles.focusPills}>
                    <View style={styles.focusPill}>
                      <Text style={styles.focusPillText}>{YACHT_CLUB_DEMO_CALENDAR[0].title}</Text>
                    </View>
                    <View style={styles.focusPill}>
                      <Text style={styles.focusPillText}>{YACHT_CLUB_DEMO_RACES[0].title}</Text>
                    </View>
                    <View style={styles.focusPill}>
                      <Text style={styles.focusPillText}>{YACHT_CLUB_DEMO_PROGRAMS[0].title}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Club profile</Text>
                  <View style={styles.profileList}>
                    {YACHT_CLUB_DEMO_PROFILE.map((field) => (
                      <View key={field.label} style={styles.profileRow}>
                        <Text style={styles.profileLabel}>{field.label}</Text>
                        <Text style={styles.profileValue}>{field.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Club surfaces</Text>
                  <View style={styles.surfaceList}>
                    {YACHT_CLUB_DEMO_SURFACES.map((surface) => (
                      <Pressable
                        key={surface.key}
                        style={styles.surfaceRow}
                        onPress={() => router.push(surface.route as never)}
                      >
                        <View style={styles.surfaceCopy}>
                          <Text style={styles.surfaceLabel}>{surface.label}</Text>
                          <Text style={styles.surfaceDetail}>{surface.detail}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.muted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Calendar and races</Text>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Club calendar</Text>
                    <View style={styles.featureList}>
                      {YACHT_CLUB_DEMO_CALENDAR.map((item) => (
                        <View key={item.title} style={styles.featureRow}>
                          <View style={styles.featureDot} />
                          <View style={styles.featureCopy}>
                            <Text style={styles.featureTitle}>{item.title}</Text>
                            <Text style={styles.featureSub}>{item.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Races</Text>
                    <View style={styles.featureList}>
                      {YACHT_CLUB_DEMO_RACES.map((item) => (
                        <View key={item.title} style={styles.featureRow}>
                          <View style={[styles.featureDot, styles.featureDotAlt]} />
                          <View style={styles.featureCopy}>
                            <Text style={styles.featureTitle}>{item.title}</Text>
                            <Text style={styles.featureSub}>{item.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Fleets and classes</Text>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Fleets</Text>
                    <View style={styles.featureList}>
                      {YACHT_CLUB_DEMO_FLEETS.map((fleet) => (
                        <View key={fleet.name} style={styles.featureRow}>
                          <View style={styles.featureDot} />
                          <View style={styles.featureCopy}>
                            <Text style={styles.featureTitle}>{fleet.name}</Text>
                            <Text style={styles.featureSub}>{fleet.note}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Major classes</Text>
                    <View style={styles.chips}>
                      {YACHT_CLUB_DEMO_MAJOR_CLASSES.map((item) => (
                        <View key={item.title} style={styles.chip}>
                          <Text style={styles.chipText}>{item.title}</Text>
                          <Text style={styles.chipSubText}>{item.detail}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Programs and social calendar</Text>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Programs</Text>
                    <View style={styles.featureList}>
                      {YACHT_CLUB_DEMO_PROGRAMS.map((item) => (
                        <View key={item.title} style={styles.featureRow}>
                          <View style={[styles.featureDot, styles.featureDotAlt]} />
                          <View style={styles.featureCopy}>
                            <Text style={styles.featureTitle}>{item.title}</Text>
                            <Text style={styles.featureSub}>{item.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.previewGroup}>
                    <Text style={styles.previewLabel}>Social calendar</Text>
                    <View style={styles.featureList}>
                      {YACHT_CLUB_DEMO_SOCIAL_CALENDAR.map((item) => (
                        <View key={item.title} style={styles.featureRow}>
                          <View style={styles.featureDot} />
                          <View style={styles.featureCopy}>
                            <Text style={styles.featureTitle}>{item.title}</Text>
                            <Text style={styles.featureSub}>{item.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Membership</Text>
                  <View style={styles.featureList}>
                    {YACHT_CLUB_DEMO_MEMBERSHIP.map((item) => (
                      <View key={item.title} style={styles.featureRow}>
                        <View style={styles.featureDot} />
                        <View style={styles.featureCopy}>
                          <Text style={styles.featureTitle}>{item.title}</Text>
                          <Text style={styles.featureSub}>{item.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.profileList}>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Claim path</Text>
                      <Text style={styles.profileValue}>Free by default, review before official status</Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Primary contact</Text>
                      <Text style={styles.profileValue}>membership@harborview.example</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Pricing ladder</Text>
                  <View style={styles.tierGrid}>
                    {demoTierCards.map((tier) => (
                      <View
                        key={tier.tier}
                        style={[styles.tierCard, tier.highlight && styles.tierCardHighlight]}
                      >
                        <View style={styles.tierHeaderRow}>
                          <View style={styles.tierHeaderCopy}>
                            <Text style={[styles.tierLabel, tier.highlight && styles.tierLabelHighlight]}>
                              {tier.label}
                            </Text>
                            <Text style={styles.tierAudience}>{tier.audience}</Text>
                          </View>
                          <View style={styles.tierPricePill}>
                            <Text style={styles.tierPrice}>{tier.price}</Text>
                            {tier.cadence ? <Text style={styles.tierCadence}>{tier.cadence}</Text> : null}
                          </View>
                        </View>
                        <Text style={styles.tierBody}>{tier.description}</Text>
                        <View style={styles.tierPills}>
                          {tier.includes.map((item) => (
                            <View key={item} style={styles.tierMiniPill}>
                              <Text style={styles.tierMiniPillText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <>
                {isPlaceholder ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>
                      This is not an official {typeLabels.contextLabel.toLowerCase()} account yet.
                    </Text>
                    <Text style={styles.noticeBody}>
                      {isClubspotImport
                        ? 'BetterAt created this placeholder from public Dragon Worlds ClubSpot entrant club strings. No sailors or entrants have been attached to this club automatically.'
                        : `BetterAt created this placeholder so ${org.name} can be discovered. Claim it to manage members, publish programs, and turn on official status.`}
                    </Text>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => router.push(`/organizations/${org.slug || slug}/claim` as never)}
                    >
                      <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Claim this organization</Text>
                    </Pressable>
                  </View>
                ) : null}

                {!isClubspotImport && org.source_summary ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.body}>{org.source_summary}</Text>
                  </View>
                ) : null}

                <View style={styles.grid}>
                  {isClubspotImport ? (
                    <>
                      <View style={styles.stat}>
                        <Text style={styles.statValue}>{org.total_entry_refs}</Text>
                        <Text style={styles.statLabel}>Import evidence</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={styles.statValue}>{org.confidence || 'review'}</Text>
                        <Text style={styles.statLabel}>Import confidence</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{typeLabels.contextLabel}</Text>
                      <Text style={styles.statLabel}>Organization type</Text>
                    </View>
                  )}
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{tierLabel(org.pricing_tier)}</Text>
                    <Text style={styles.statLabel}>{typeLabels.pricingLabel}</Text>
                  </View>
                </View>

                {isClubspotImport && visibleAliases.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Known ClubSpot Aliases</Text>
                    <View style={styles.chips}>
                      {visibleAliases.map((alias) => (
                        <View key={alias} style={styles.chip}>
                          <Text style={styles.chipText}>{alias}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, gap: 16 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 16 },
  mark: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  heroText: { flex: 1, gap: 8 },
  heroSub: { color: C.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  embeddedMapWrap: {
    marginBottom: 12,
  },
  embeddedMapCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.55)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  mapActionRow: {
    paddingBottom: 8,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  membershipBadgeActive: {
    backgroundColor: 'rgba(56, 175, 122, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56, 175, 122, 0.35)',
  },
  membershipBadgePending: {
    backgroundColor: 'rgba(231, 137, 60, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231, 137, 60, 0.35)',
  },
  membershipBadgeMuted: {
    backgroundColor: 'rgba(120, 120, 128, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120, 120, 128, 0.30)',
  },
  membershipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.1,
  },
  eyebrow: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  h1: { color: C.ink, fontSize: 34, lineHeight: 40, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeOfficial: { backgroundColor: '#E6F4F1' },
  badgePlaceholder: { backgroundColor: '#FFF7ED' },
  badgeDemo: { backgroundColor: '#EAF2FF' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  officialText: { color: C.green },
  placeholderText: { color: C.amber },
  demoText: { color: C.blue },
  notice: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 8, padding: 16, gap: 10 },
  demoNotice: { backgroundColor: '#F7FAFF', borderColor: 'rgba(11, 99, 206, 0.16)', borderWidth: 1, borderRadius: 8, padding: 16, gap: 10 },
  noticeTitle: { color: C.ink, fontSize: 18, fontWeight: '800' },
  noticeBody: { color: C.ink, fontSize: 15, lineHeight: 22 },
  primaryButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 220, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 14 },
  statValue: { color: C.ink, fontSize: 20, fontWeight: '800', textTransform: 'capitalize' },
  statLabel: { color: C.muted, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { color: C.ink, fontSize: 24, fontWeight: '800' },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: '800' },
  body: { color: C.muted, fontSize: 15, lineHeight: 22 },
  focusBody: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  focusPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  focusPill: { borderRadius: 999, backgroundColor: '#EEF4FF', paddingHorizontal: 10, paddingVertical: 6 },
  focusPillText: { color: C.blue, fontSize: 12, fontWeight: '700' },
  previewGroup: { gap: 8 },
  previewLabel: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 8,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 132,
    gap: 2,
  },
  chipText: { color: C.blue, fontSize: 13, fontWeight: '700' },
  chipSubText: { color: C.blue, fontSize: 11, lineHeight: 15 },
  surfaceList: { gap: 8 },
  surfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: 'rgba(11, 99, 206, 0.12)',
  },
  surfaceCopy: { flex: 1, gap: 2 },
  surfaceLabel: { color: C.ink, fontSize: 14, fontWeight: '800' },
  surfaceDetail: { color: C.muted, fontSize: 13, lineHeight: 18 },
  tierGrid: { gap: 10 },
  tierCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    gap: 4,
    backgroundColor: '#FBFCFE',
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tierHeaderCopy: { flex: 1, gap: 2 },
  tierCardHighlight: {
    borderColor: 'rgba(11, 99, 206, 0.22)',
    backgroundColor: '#F7FAFF',
  },
  tierLabel: { color: C.ink, fontSize: 16, fontWeight: '800' },
  tierLabelHighlight: { color: C.blue },
  tierAudience: { color: C.muted, fontSize: 12, lineHeight: 16 },
  tierPricePill: {
    alignItems: 'flex-end',
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 84,
  },
  tierPrice: { color: C.blue, fontSize: 16, fontWeight: '800' },
  tierCadence: { color: C.blue, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tierBody: { color: C.muted, fontSize: 13, lineHeight: 18 },
  tierPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  tierMiniPill: {
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tierMiniPillText: { color: C.blue, fontSize: 11, fontWeight: '700' },
  featureList: { gap: 10 },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  profileList: { gap: 12 },
  profileRow: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217, 226, 236, 0.8)',
  },
  profileLabel: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  profileValue: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  featureDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: C.blue,
    marginTop: 6,
  },
  featureDotAlt: { backgroundColor: C.green },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { color: C.ink, fontSize: 14, fontWeight: '800' },
  featureSub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  featureText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 20 },
});
