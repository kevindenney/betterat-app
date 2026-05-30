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
 *   - Working on now / practice timeline /
 *     capabilities / practice circle /
 *     published / events                        →  demo enrichment (seed
 *                                                  sailors only) until the
 *                                                  underlying schemas land.
 *
 * The enrichment lookup table lives at the bottom of this file. Production
 * users without enrichment see hero + framing + where, with other sections
 * absent — exactly the "STATE 2 · sparse data" rule the canonical locks.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { SuggestStepComposer } from '@/components/sailor/SuggestStepComposer';

import {
  IOSDetailNavBar,
  IOSDetailSection,
  RelationshipButton,
  RelationshipMinePill,
  IOSOnlyNotice,
} from '@/components/discover/detail';
import { initialsForName } from '@/components/discover/canonical';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useSailorFullProfile } from '@/hooks/useSailorFullProfile';
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
  if (Platform.OS === 'web') return <IOSOnlyNotice surface="Public face" />;
  return <PublicFaceScreenInner userId={userId} />;
}

function PublicFaceScreenInner({ userId }: { userId: string }) {
  const { profile, isLoading, error, toggleFollow, isToggling } =
    useSailorFullProfile(userId);
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.ground} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingFill}>
          <ActivityIndicator size="large" color={IOS_REGISTER.label} />
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
  // scaled up. Meta-pellets carry venue + seasons.
  const descriptor = enrichment.descriptor ?? profile.location ?? undefined;
  const meta = enrichment.meta ?? [];

  // Framing line — written when joining BetterAt. Falls back to profile.bio
  // (the closest existing field) when there's no explicit framing.
  const framingText = enrichment.framing?.text ?? profile.bio ?? undefined;
  const framingProvenance =
    enrichment.framing?.provenance ?? (profile.bio ? 'Written when joining BetterAt' : undefined);

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <IOSDetailNavBar
        backLabel="Back"
        contextLabel="Public face"
        dockedName={displayName}
        docked={docked && !profile.isFollowing}
        trailingAction={
          docked && !profile.isFollowing
            ? { label: 'Follow', icon: 'add', onPress: handleFollow }
            : undefined
        }
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* 01 · HERO — bigger mark + name. Identity, descriptor, meta. */}
        <PublicFaceHero
          markText={initials}
          name={displayName}
          descriptor={descriptor}
          meta={meta}
        >
          {profile.isFollowing ? (
            <RelationshipMinePill label="Following" onPress={handleUnfollowConfirm} />
          ) : (
            <RelationshipButton
              label={isToggling ? 'Following…' : 'Follow'}
              icon="add"
              loading={isToggling}
              onPress={handleFollow}
            />
          )}
          <MessageIconButton onPress={onMessage} />
        </PublicFaceHero>

        {/* v3 screen-designs Phase C — dual CTA row: Suggest a step + Reflect.
            Sits below the hero, above the framing line. Gated by
            SUGGEST_VERB_V3. The Reflect path is a stub for v1 (peer
            reflections schema lands in a follow-up). */}
        {FEATURE_FLAGS.SUGGEST_VERB_V3 ? (
          <View style={dualCtaStyles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Suggest a step"
              onPress={() => setComposerOpen(true)}
              style={({ pressed }) => [dualCtaStyles.primary, pressed && dualCtaStyles.pressed]}
            >
              <Ionicons name="bulb-outline" size={15} color="#FFFFFF" />
              <Text style={dualCtaStyles.primaryText}>Suggest a step</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reflect"
              onPress={() => showAlert('Reflect', 'Peer reflections are coming soon.')}
              style={({ pressed }) => [dualCtaStyles.secondary, pressed && dualCtaStyles.pressed]}
            >
              <Ionicons name="chatbubble-outline" size={15} color={IOS_REGISTER.label} />
              <Text style={dualCtaStyles.secondaryText}>Reflect</Text>
            </Pressable>
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
                      onPress: () => router.push(`/sailor/${userId}/concepts` as any),
                    }
                  : undefined
              }
            />
          </IOSDetailSection>
        ) : null}

        {/* 04 · PRACTICE TIMELINE — chronological feed of settled moments.
            No medallions; italic-emphasis settled marker on title.
            Row-level taps reserved for a future trophy-detail surface — not
            wired here so the chevron doesn't promise something undelivered. */}
        {enrichment.timeline && enrichment.timeline.length > 0 ? (
          <IOSDetailSection
            header="Practice timeline"
            seeAll={{
              label: 'See full timeline',
              onPress: () => router.push(`/sailor/${userId}/timeline` as any),
            }}
          >
            {enrichment.timeline.map((t, i) => (
              <TrophyRowPublic
                key={i}
                title={t.title}
                settled={t.settled}
                sub={t.sub}
                when={t.when}
                onPress={
                  t.trophyId
                    ? () => router.push(`/sailor/${userId}/trophy/${t.trophyId}` as any)
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
                    onPress: () => router.push(`/sailor/${userId}/capabilities` as any),
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
                    onPress: () => router.push(`/sailor/${userId}/circle` as any),
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
                  p.userId ? () => router.push(`/sailor/${p.userId}` as any) : undefined
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
                    onPress: () => router.push(`/sailor/${userId}/published` as any),
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
        ) : null}

        {/* 08 · WHERE X PRACTISES — iOS form-row pattern. */}
        {enrichment.where && enrichment.where.length > 0 ? (
          <IOSDetailSection header={`Where ${enrichment.firstName ?? displayName} practises`}>
            {enrichment.where.map((r, i) => (
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
                    onPress: () => router.push(`/sailor/${userId}/events` as any),
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
      </ScrollView>

      {FEATURE_FLAGS.SUGGEST_VERB_V3 ? (
        <SuggestStepComposer
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          recipientId={userId}
          recipientName={displayName}
          recipientInitials={initials}
          reContext={enrichment.concept?.weekTail ?? null}
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
  pressed: {
    opacity: 0.7,
  },
});

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: PUBLIC_FACE_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  loadingFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
