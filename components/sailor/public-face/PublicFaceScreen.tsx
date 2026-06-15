/**
 * Public Face — Person deep
 *
 * Implements the canonical defined in
 * `docs/redesign/ios-register/public-face-canonical.html` (BetterAt — Public
 * face · Person deep brief). The deeper Person surface that comes after the
 * Discover detail Person calling card. Eight sections compose; sparse data
 * means sections are absent, never empty placeholders.
 *
 * Data wiring:
 *   - Hero / descriptor / meta / framing line  →  profiles row (real)
 *   - Where X practises                         →  profiles row (real)
 *   - Practice timeline / published /
 *     working on now / capabilities /
 *     practice circle                           →  enrichment when a seed
 *                                                  sailor has it; otherwise
 *                                                  real data via
 *                                                  usePersonPublicSections
 *                                                  (get_person_public_face
 *                                                  RPC centralizes privacy).
 *   - Events                                    →  demo enrichment only
 *                                                  (deferred — race_results
 *                                                  has no public RLS story).
 *
 * Production users without data see hero + framing + where, with other
 * sections absent — exactly the "STATE 2 · sparse data" rule the canonical
 * locks.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Star, Bell, BellOff, UserMinus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { SuggestStepComposer } from '@/components/sailor/SuggestStepComposer';
import { IOSActionSheet, type ActionSheetAction } from '@/components/ui/IOSActionSheet';

import {
  IOSDetailNavBar,
  IOSDetailSection,
  RelationshipButton,
  RelationshipMinePill,
  WebDetailContainer,
} from '@/components/discover/detail';
import { initialsForName } from '@/components/discover/canonical';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useSailorFullProfile } from '@/hooks/useSailorFullProfile';
import {
  usePersonPublicSections,
  formatPersonWhen,
} from '@/hooks/usePersonPublicSections';
import { CrewThreadService } from '@/services/CrewThreadService';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

import {
  PublicFaceHero,
  FramingLine,
  MessageIconButton,
  CapabilityRow,
  PracticeCircleRow,
  PublishedReflectionRow,
  PublishedThreadRow,
  TrophyRowPublic,
  WhereFormRow,
  EventRow,
  PUBLIC_FACE_GROUND_BG,
  type CapabilityStatus,
} from './PublicFacePrimitives';
import { ConceptCard } from '@/components/discover/detail';
import { getPublicFaceEnrichment } from './enrichment';

export interface PublicFaceScreenProps {
  userId: string;
}

export function PublicFaceScreen({ userId }: PublicFaceScreenProps) {
  return <PublicFaceScreenInner userId={userId} />;
}

function PublicFaceScreenInner({ userId }: { userId: string }) {
  const {
    profile,
    isLoading,
    error,
    isOwnProfile,
    toggleFollow,
    isToggling,
    toggleFavorite,
    toggleNotifications,
    toggleMute,
  } = useSailorFullProfile(userId);
  const [relOptionsOpen, setRelOptionsOpen] = useState(false);
  const { data: sections } = usePersonPublicSections(userId);
  const [docked, setDocked] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDocked(e.nativeEvent.contentOffset.y > 140);
  }, []);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/library' as any);
  }, []);

  const onMessage = useCallback(async () => {
    const thread = await CrewThreadService.getOrCreateDirectThread(userId);
    if (thread?.id) {
      router.push(`/crew-thread/${thread.id}` as any);
    } else {
      showAlert('Could not open thread', 'Try again in a moment.');
    }
  }, [userId]);

  const enrichment = useMemo(() => getPublicFaceEnrichment(userId), [userId]);

  // Real-data fallbacks — when a seed sailor has hand-written enrichment it
  // wins; otherwise the practitioner's own settled steps and public thread
  // posts populate the timeline/published sections. Empty lists leave the
  // section absent, per the sparse-data rule.
  const timeline = useMemo(() => {
    if (enrichment.timeline?.length) return enrichment.timeline;
    return (sections?.trajectory ?? []).map((t) => ({
      title: t.title,
      settled: t.settled,
      sub: t.interestName ?? undefined,
      when: formatPersonWhen(t.whenISO),
      trophyId: undefined as string | undefined,
    }));
  }, [enrichment.timeline, sections?.trajectory]);

  const publishedThreads = useMemo(() => {
    if (enrichment.published?.length) return null;
    return (sections?.publicThreads ?? []).map((p) => ({
      title: `“${p.snippet}”`,
      topic: p.stepTitle,
      replies: p.replies,
      when: formatPersonWhen(p.whenISO) ?? '',
      stepId: p.stepId,
    }));
  }, [enrichment.published, sections?.publicThreads]);

  const realConcept = useMemo(() => {
    if (enrichment.concept || !sections?.concept) return null;
    const c = sections.concept;
    const statBits: string[] = [];
    if (c.linkedStepCount > 0) {
      statBits.push(`In play across ${c.linkedStepCount} step${c.linkedStepCount === 1 ? '' : 's'}`);
    }
    if (c.settledCount > 0) {
      statBits.push(`${c.settledCount} settled`);
    }
    return {
      weekTail: `Week ${c.weekTail}`,
      text: c.body.trim() || c.title,
      stats: statBits.length ? statBits.join(' · ') : undefined,
    };
  }, [enrichment.concept, sections?.concept]);

  const realCapabilities = useMemo(() => {
    if (enrichment.capabilities?.length || !sections?.capabilities?.length) return null;
    const statusFor = (standing: string): CapabilityStatus =>
      standing === 'settled' ? 'settled' : standing === 'working' ? 'working' : 'emerging';
    return sections.capabilities.slice(0, 4).map((c) => ({
      name: c.name,
      status: statusFor(c.standing),
      provenance: `${c.evidenceCount} evidence capture${c.evidenceCount === 1 ? '' : 's'} across practice steps`,
    }));
  }, [enrichment.capabilities, sections?.capabilities]);

  const realCircle = useMemo(() => {
    if (enrichment.circle?.length || !sections?.circle) return null;
    const seen = new Set<string>();
    const rows: {
      name: string;
      role: string;
      initials: string;
      tail?: string;
      userId?: string;
    }[] = [];
    for (const m of sections.circle.mutuals) {
      if (m.userId) {
        if (seen.has(m.userId)) continue;
        seen.add(m.userId);
      }
      rows.push({
        name: m.name,
        role: 'Follows each other',
        initials: initialsForName(m.name),
        tail: 'Mutual',
        userId: m.userId ?? undefined,
      });
    }
    for (const c of sections.circle.crew) {
      if (c.userId) {
        if (seen.has(c.userId)) continue;
        seen.add(c.userId);
      }
      const roleLabel = c.role ? c.role[0].toUpperCase() + c.role.slice(1) : 'Crew';
      rows.push({
        name: c.name,
        role: c.isPrimary ? `${roleLabel} · primary crew` : `${roleLabel} · crew`,
        initials: initialsForName(c.name),
        userId: c.userId ?? undefined,
      });
    }
    return rows.length ? rows : null;
  }, [enrichment.circle, sections?.circle]);

  const realCircleTotal =
    (sections?.circle?.mutualCount ?? 0) + (sections?.circle?.crewCount ?? 0);

  const realCapabilitiesTotal = sections?.capabilities?.length ?? 0;

  const displayName = profile?.displayName || 'Practitioner';

  const handleFollow = useCallback(async () => {
    await toggleFollow();
  }, [toggleFollow]);

  const handleUnfollowConfirm = useCallback(() => {
    showConfirm(
      `Unfollow ${displayName}?`,
      'You can follow them again anytime.',
      handleFollow,
      { destructive: true, confirmText: 'Unfollow' },
    );
  }, [displayName, handleFollow]);

  // Relationship dials live behind the "Following" pill — favorite / notify /
  // mute toggle the matching user_follows columns; unfollow stays gated behind
  // its confirm. Labels reflect current state so reopening shows the new value.
  const isFavorite = profile?.isFavorite ?? false;
  const notificationsEnabled = profile?.notificationsEnabled ?? false;
  const isMuted = profile?.isMuted ?? false;
  const relationshipActions = useMemo<ActionSheetAction[]>(
    () => [
      {
        label: isFavorite ? 'Remove favorite' : 'Add to favorites',
        icon: <Star fill={isFavorite ? '#F5A623' : 'transparent'} color="#F5A623" />,
        onPress: toggleFavorite,
      },
      {
        label: notificationsEnabled ? 'Turn off notifications' : 'Turn on notifications',
        icon: notificationsEnabled ? <BellOff /> : <Bell />,
        onPress: toggleNotifications,
      },
      {
        label: isMuted ? 'Unmute' : 'Mute',
        icon: isMuted ? <Bell /> : <BellOff />,
        onPress: toggleMute,
      },
      {
        label: `Unfollow ${displayName}`,
        icon: <UserMinus />,
        destructive: true,
        onPress: handleUnfollowConfirm,
      },
    ],
    [
      isFavorite,
      notificationsEnabled,
      isMuted,
      displayName,
      toggleFavorite,
      toggleNotifications,
      toggleMute,
      handleUnfollowConfirm,
    ],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.ground} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.skeletonHero}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonHeroBody}>
            <View style={[styles.skeletonBar, styles.skeletonName]} />
            <View style={[styles.skeletonBar, styles.skeletonDescriptor]} />
            <View style={[styles.skeletonBar, styles.skeletonMeta]} />
          </View>
        </View>
        <View style={styles.skeletonSections}>
          <View style={[styles.skeletonBar, styles.skeletonCard]} />
          <View style={[styles.skeletonBar, styles.skeletonCard]} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.ground} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorFill}>
          <Text style={styles.errorTitle}>Public face unavailable</Text>
          <Text style={styles.errorBody}>This practitioner profile could not be loaded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = initialsForName(displayName);

  // Descriptor + meta — pulled from the merged profiles/users row. The
  // public-face hero mirrors the Discover Person descriptor pattern but
  // scaled up: "Dragon Helm · Hong Kong". Meta-pellets carry club + seasons.
  const d = sections?.descriptor;
  const personInterests = sections?.interests ?? [];
  const identity = [d?.sailingClass?.trim(), d?.sailingPosition?.trim()]
    .filter(Boolean)
    .join(' ');
  const realDescriptor =
    [identity, d?.sailingLocation?.trim()].filter(Boolean).join(' · ') || undefined;
  // Non-sailing personas have no sailing_* columns; fall back to the person's
  // primary interest + generic location so the identity layer still renders.
  const interestDescriptor =
    [personInterests[0]?.name, profile.location?.trim()].filter(Boolean).join(' · ') || undefined;
  const descriptor =
    enrichment.descriptor ?? realDescriptor ?? interestDescriptor ?? profile.location ?? undefined;
  const realMeta: { icon?: any; text: string }[] = [];
  if (d?.sailingClub) realMeta.push({ icon: 'location-outline', text: d.sailingClub });
  if (d?.seasonsActive) {
    realMeta.push({
      icon: 'calendar-outline',
      text: `${d.seasonsActive} season${d.seasonsActive === 1 ? '' : 's'}`,
    });
  }
  // "Should I follow?" signal — followers + depth of practice. Only when the
  // viewer isn't looking at their own profile and the counts are non-zero.
  const followerCount = profile.followerCount ?? 0;
  const stepCount = sections?.stepCount ?? 0;
  if (!isOwnProfile && followerCount > 0) {
    realMeta.push({
      icon: 'people-outline',
      text: `${followerCount} follower${followerCount === 1 ? '' : 's'}`,
    });
  }
  if (stepCount > 0) {
    realMeta.push({
      icon: 'footsteps-outline',
      text: `${stepCount} step${stepCount === 1 ? '' : 's'}`,
    });
  }
  const meta = enrichment.meta ?? realMeta;

  // Framing line — written when joining BetterAt. Falls back to profile.bio
  // (the closest existing field) when there's no explicit framing.
  const framingText = enrichment.framing?.text ?? profile.bio ?? undefined;
  const framingProvenance =
    enrichment.framing?.provenance ?? (profile.bio ? 'Written when joining BetterAt' : undefined);
  const realWhereRows = d
    ? ([
        d.sailingLocation ? { k: 'Home waters', v: d.sailingLocation } : null,
        d.sailingClub ? { k: 'Club', v: d.sailingClub } : null,
        d.sailingClass ? { k: 'Class', v: d.sailingClass } : null,
        d.sailingPosition ? { k: 'Position', v: d.sailingPosition } : null,
        d.seasonsActive
          ? {
              k: 'Seasons active',
              v: `${d.seasonsActive} season${d.seasonsActive === 1 ? '' : 's'}`,
            }
          : null,
      ].filter(Boolean) as { k: string; v: string }[])
    : [];
  // Generic identity rows for non-sailing personas — built from the real
  // interest + location data, never invented. Used only when the sailing
  // block is empty so the "where" section doesn't silently disappear.
  const genericWhereRows: { k: string; v: string }[] = [];
  if (personInterests.length) {
    genericWhereRows.push({
      k: personInterests.length === 1 ? 'Focus' : 'Focuses',
      v: personInterests.map((i) => i.name).join(', '),
    });
  }
  if (profile.location?.trim()) {
    genericWhereRows.push({ k: 'Based in', v: profile.location.trim() });
  }
  const realWhere = realWhereRows.length
    ? realWhereRows
    : genericWhereRows.length
      ? genericWhereRows
      : null;

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <WebDetailContainer>
        <IOSDetailNavBar
          backLabel="Back"
          contextLabel="Public face"
          dockedName={displayName}
          docked={docked && !isOwnProfile && !profile.isFollowing}
          trailingAction={
            docked && !isOwnProfile && !profile.isFollowing
              ? { label: 'Follow', icon: 'add', onPress: handleFollow }
              : undefined
          }
          onBack={onBack}
        />
      </WebDetailContainer>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <WebDetailContainer>
        {/* 01 · HERO — bigger mark + name. Identity, descriptor, meta. */}
        <PublicFaceHero
          markText={initials}
          markImageUrl={profile.avatarUrl ?? undefined}
          name={displayName}
          descriptor={descriptor}
          meta={meta}
        >
          {isOwnProfile ? (
            <RelationshipMinePill
              label="This is you · Edit profile"
              onPress={() => router.push('/settings/edit-profile' as any)}
            />
          ) : (
            <>
              {profile.isFollowing ? (
                <RelationshipMinePill
                  label="Following"
                  onPress={() => setRelOptionsOpen(true)}
                />
              ) : (
                <RelationshipButton
                  label={isToggling ? 'Following…' : 'Follow'}
                  icon="add"
                  loading={isToggling}
                  onPress={handleFollow}
                />
              )}
              <MessageIconButton onPress={onMessage} />
            </>
          )}
        </PublicFaceHero>

        {/* Public peer actions. Reflect is a stub until peer reflections land. */}
        {!isOwnProfile ? (
          <View style={dualCtaStyles.row}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Suggest a step"
              onPress={() => setComposerOpen(true)}
              activeOpacity={0.7}
              style={dualCtaStyles.primary}
            >
              <Ionicons name="bulb-outline" size={15} color="#FFFFFF" />
              <Text style={dualCtaStyles.primaryText}>Suggest a step</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reflect"
              onPress={() => showAlert('Reflect', 'Peer reflections are coming soon.')}
              activeOpacity={0.7}
              style={dualCtaStyles.secondary}
            >
              <Ionicons name="chatbubble-outline" size={15} color={IOS_REGISTER.label} />
              <Text style={dualCtaStyles.secondaryText}>Reflect</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 02 · FRAMING — the practitioner's own sentence at attribution.
            Italic-serif-with-provenance, separated from hero by hairline.
            Absent if practitioner hasn't written one. */}
        {framingText ? (
          <FramingLine text={framingText} provenance={framingProvenance ?? ''} />
        ) : null}

        {/* 03 · WORKING ON NOW — coral concept card. Same component as
            Discover, plus the concept-history affordance inside the card. */}
        {enrichment.concept ? (
          <IOSDetailSection header="Working on now" bare>
            <ConceptCard
              tail={enrichment.concept.weekTail}
              text={enrichment.concept.text}
              stats={enrichment.concept.stats}
              history={
                enrichment.concept.history
                  ? {
                      primary: enrichment.concept.history.primary,
                      secondary: enrichment.concept.history.secondary,
                      onPress: () => router.push(`/profile/${userId}/concepts` as any),
                    }
                  : undefined
              }
            />
          </IOSDetailSection>
        ) : realConcept ? (
          <IOSDetailSection header="Working on now" bare>
            <ConceptCard
              tail={realConcept.weekTail}
              text={realConcept.text}
              stats={realConcept.stats}
            />
          </IOSDetailSection>
        ) : null}

        {/* 04 · PRACTICE TIMELINE — chronological feed of settled moments.
            No medallions; italic-emphasis settled marker on title.
            Row-level taps reserved for a future trophy-detail surface — not
            wired here so the chevron doesn't promise something undelivered. */}
        {timeline.length > 0 ? (
          <IOSDetailSection
            header="Practice timeline"
            seeAll={{
              label: 'See full timeline',
              onPress: () => router.push(`/profile/${userId}/timeline` as any),
            }}
          >
            {timeline.map((t, i) => (
              <TrophyRowPublic
                key={i}
                title={t.title}
                settled={t.settled}
                sub={t.sub}
                when={t.when}
                onPress={
                  t.trophyId
                    ? () => router.push(`/profile/${userId}/trophy/${t.trophyId}` as any)
                    : undefined
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 05 · CAPABILITIES AT HAND — capability name + status pill +
            evidence quote + provenance. Four visible, all behind link. */}
        {enrichment.capabilities && enrichment.capabilities.length > 0 ? (
          <IOSDetailSection
            header="Capabilities at hand"
            seeAll={
              enrichment.capabilitiesTotal
                ? {
                    label: `All ${enrichment.capabilitiesTotal}`,
                    onPress: () => router.push(`/profile/${userId}/capabilities` as any),
                  }
                : undefined
            }
          >
            {enrichment.capabilities.map((c, i) => (
              <CapabilityRow
                key={i}
                name={c.name}
                status={c.status}
                evidence={c.evidence}
                provenance={c.provenance}
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : realCapabilities ? (
          <IOSDetailSection
            header="Capabilities at hand"
            seeAll={
              realCapabilitiesTotal > 4
                ? {
                    label: `All ${realCapabilitiesTotal}`,
                    onPress: () => router.push(`/profile/${userId}/capabilities` as any),
                  }
                : undefined
            }
          >
            {realCapabilities.map((c, i) => (
              <CapabilityRow
                key={i}
                name={c.name}
                status={c.status}
                provenance={c.provenance}
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 06 · PRACTICE CIRCLE — single curated list, not a follow split.
            Coaches, crew, faculty, peers — each row's sub-line names their
            role in this practice. Mutual tag at right edge. */}
        {enrichment.circle && enrichment.circle.length > 0 ? (
          <IOSDetailSection
            header="Practice circle"
            seeAll={
              enrichment.circleTotal
                ? {
                    label: `All ${enrichment.circleTotal}`,
                    onPress: () => router.push(`/profile/${userId}/circle` as any),
                  }
                : undefined
            }
          >
            {enrichment.circle.map((p, i) => (
              <PracticeCircleRow
                key={i}
                name={p.name}
                role={p.role}
                initials={p.initials}
                markColor={p.markColor}
                tail={p.tail}
                onPress={
                  p.userId ? () => router.push(`/profile/${p.userId}` as any) : undefined
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : realCircle ? (
          <IOSDetailSection
            header="Practice circle"
            seeAll={
              realCircleTotal > realCircle.length
                ? {
                    label: `All ${realCircleTotal}`,
                    onPress: () => router.push(`/profile/${userId}/circle` as any),
                  }
                : undefined
            }
          >
            {realCircle.map((p, i) => (
              <PracticeCircleRow
                key={i}
                name={p.name}
                role={p.role}
                initials={p.initials}
                tail={p.tail}
                onPress={
                  p.userId ? () => router.push(`/profile/${p.userId}` as any) : undefined
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 07 · PUBLISHED — newest-first reflections + threads in one
            section. Row type carries the difference. */}
        {enrichment.published && enrichment.published.length > 0 ? (
          <IOSDetailSection
            header="Published"
            seeAll={
              enrichment.publishedTotal
                ? {
                    label: `All ${enrichment.publishedTotal}`,
                    onPress: () => router.push(`/profile/${userId}/published` as any),
                  }
                : undefined
            }
          >
            {enrichment.published.map((p, i) =>
              p.kind === 'reflection' ? (
                <PublishedReflectionRow
                  key={i}
                  text={p.text}
                  provenance={p.provenance}
                  isFirst={i === 0}
                />
              ) : (
                <PublishedThreadRow
                  key={i}
                  title={p.title}
                  topic={p.topic}
                  replies={p.replies}
                  when={p.when}
                  isFirst={i === 0}
                />
              ),
            )}
          </IOSDetailSection>
        ) : publishedThreads && publishedThreads.length > 0 ? (
          <IOSDetailSection header="Published">
            {publishedThreads.map((p, i) => (
              <PublishedThreadRow
                key={i}
                title={p.title}
                topic={p.topic}
                replies={p.replies}
                when={p.when}
                onPress={() =>
                  router.push(`/practice/step/${p.stepId}/discussion` as any)
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 08 · WHERE X PRACTISES — iOS form-row pattern. */}
        {enrichment.where && enrichment.where.length > 0 ? (
          <IOSDetailSection header={`Where ${enrichment.firstName ?? displayName} practises`}>
            {enrichment.where.map((r, i) => (
              <WhereFormRow key={i} k={r.k} v={r.v} isFirst={i === 0} />
            ))}
          </IOSDetailSection>
        ) : realWhere ? (
          <IOSDetailSection header={`Where ${(displayName.split(' ')[0] || displayName)} practises`}>
            {realWhere.map((r, i) => (
              <WhereFormRow key={i} k={r.k} v={r.v} isFirst={i === 0} />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 09 · EVENTS — plain-text result, no medal glyphs, no podium. */}
        {enrichment.events && enrichment.events.length > 0 ? (
          <IOSDetailSection
            header="Events"
            seeAll={
              enrichment.eventsTotal
                ? {
                    label: `All ${enrichment.eventsTotal}`,
                    onPress: () => router.push(`/profile/${userId}/events` as any),
                  }
                : undefined
            }
          >
            {enrichment.events.map((e, i) => (
              <EventRow
                key={i}
                dateTop={e.dateTop}
                dateBottom={e.dateBottom}
                name={e.name}
                venue={e.venue}
                resultTop={e.resultTop}
                resultBottom={e.resultBottom}
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        <View style={styles.bottomPad} />
        </WebDetailContainer>
      </ScrollView>

      {!isOwnProfile ? (
        <SuggestStepComposer
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          recipientId={userId}
          recipientName={displayName}
          recipientInitials={initials}
          reContext={enrichment.concept?.weekTail ?? null}
        />
      ) : null}

      {!isOwnProfile ? (
        <IOSActionSheet
          isOpen={relOptionsOpen}
          onClose={() => setRelOptionsOpen(false)}
          title={displayName}
          actions={relationshipActions}
        />
      ) : null}
    </SafeAreaView>
  );
}

// Re-export the status type so consumers can build local capability lists.
export type { CapabilityStatus };

const dualCtaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.label,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
  },
  secondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: PUBLIC_FACE_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  loadingFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonHero: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    paddingTop: 18,
    gap: 16,
  },
  skeletonAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  skeletonHeroBody: { flex: 1, paddingTop: 6, gap: 10 },
  skeletonBar: {
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 6,
  },
  skeletonName: { height: 24, width: '70%' },
  skeletonDescriptor: { height: 15, width: '85%' },
  skeletonMeta: { height: 13, width: '55%' },
  skeletonSections: { paddingHorizontal: 22, paddingTop: 32, gap: 16 },
  skeletonCard: { height: 92, width: '100%', borderRadius: 14 },
  errorFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  errorBody: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
    textAlign: 'center',
  },
});
