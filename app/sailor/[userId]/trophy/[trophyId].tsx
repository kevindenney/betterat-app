/**
 * Trophy detail — settled-concept deep page.
 *
 * What a practitioner walks away with when a concept settles: a closing
 * synthesis, the capabilities it locked in, the journey of practice
 * that earned it, the people who were part of that practice, and (if it
 * gave way to a new concept) the chain forward.
 *
 * Section composition mirrors the public face vocabulary: italic-serif-
 * with-provenance for synthesis + journey, settled-status pills for
 * capabilities, PracticeCircleRow for people, ConceptCard tail-link for
 * "grew into". No net-new primitives — vocabulary reuse only.
 *
 * Sparse-data rule: sections absent when the trophy doesn't carry the
 * field. A trophy with no `journey` shows hero + synthesis only.
 */

import React, { useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import {
  IOSDetailNavBar,
  IOSDetailSection,
  IOSOnlyNotice,
} from '@/components/discover/detail';
import {
  FramingLine,
  PracticeCircleRow,
  PublishedReflectionRow,
  StatusPill,
  PUBLIC_FACE_GROUND_BG,
} from '@/components/sailor/public-face/PublicFacePrimitives';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { getPublicFaceEnrichment, getTrophy } from '@/components/sailor/public-face/enrichment';

export default function SailorTrophyRoute() {
  if (Platform.OS === 'web') return <IOSOnlyNotice surface="Trophy" />;
  return <TrophyDetailInner />;
}

function TrophyDetailInner() {
  const { userId, trophyId } = useLocalSearchParams<{ userId: string; trophyId: string }>();

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/discover' as any);
  }, []);

  if (!userId || !trophyId) return null;

  const enrichment = getPublicFaceEnrichment(userId);
  const trophy = getTrophy(userId, trophyId);
  const firstName = enrichment.firstName ?? 'Back';

  if (!trophy) {
    return (
      <SafeAreaView style={styles.ground} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <IOSDetailNavBar
          backLabel={firstName}
          contextLabel="Trophy"
          onBack={onBack}
        />
        <View style={styles.errorFill}>
          <Text style={styles.errorTitle}>Trophy unavailable</Text>
          <Text style={styles.errorBody}>
            This settled concept is not on file yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <IOSDetailNavBar
        backLabel={firstName}
        contextLabel="Trophy"
        onBack={onBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 01 · HERO — title + settled-at date. */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>SETTLED · {trophy.settledAt.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{trophy.title}</Text>
        </View>

        {/* 02 · CLOSING SYNTHESIS — italic-serif-with-provenance reuse. */}
        <FramingLine
          text={trophy.synthesis.text}
          provenance={trophy.synthesis.provenance}
        />

        {/* 03 · CAPABILITIES SETTLED — settled-status pills. Absent when none. */}
        {trophy.capabilities && trophy.capabilities.length > 0 ? (
          <IOSDetailSection header="Capabilities settled">
            <View style={styles.capRow}>
              {trophy.capabilities.map((c, i) => (
                <View key={i} style={styles.capChip}>
                  <StatusPill status="settled" />
                  <Text style={styles.capChipText}>{c}</Text>
                </View>
              ))}
            </View>
          </IOSDetailSection>
        ) : null}

        {/* 04 · JOURNEY — reflections that built up to settling. */}
        {trophy.journey && trophy.journey.length > 0 ? (
          <IOSDetailSection header="The journey that earned it">
            {trophy.journey.map((j, i) => (
              <PublishedReflectionRow
                key={i}
                text={j.text}
                provenance={j.when}
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 05 · PEOPLE IN THIS — circle filtered to the journey. */}
        {trophy.circleInThis && trophy.circleInThis.length > 0 ? (
          <IOSDetailSection header="People in this">
            {trophy.circleInThis.map((p, i) => (
              <PracticeCircleRow
                key={i}
                name={p.name}
                role={p.role}
                initials={p.initials}
                onPress={
                  p.userId ? () => router.push(`/sailor/${p.userId}` as any) : undefined
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* 06 · GREW INTO — closes the loop with the current concept. */}
        {trophy.grewInto ? (
          <IOSDetailSection header="What grew from this">
            <View style={styles.grewBox}>
              <Text style={styles.grewTitle}>{trophy.grewInto.title}</Text>
              {trophy.grewInto.sub ? (
                <Text style={styles.grewSub}>{trophy.grewInto.sub}</Text>
              ) : null}
            </View>
          </IOSDetailSection>
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const LABEL = IOS_REGISTER.label;
const LABEL_2 = IOS_REGISTER.labelSecondary;
const LABEL_3 = IOS_REGISTER.labelTertiary;

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: PUBLIC_FACE_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  heroEyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: '#3F8758',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
    color: LABEL,
  },
  capRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  capChipText: {
    fontSize: 14,
    color: LABEL,
    letterSpacing: -0.1,
  },
  grewBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  grewTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: LABEL,
    lineHeight: 19,
  },
  grewSub: {
    fontSize: 12.5,
    color: LABEL_2,
    letterSpacing: -0.05,
  },
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
    color: LABEL,
    letterSpacing: -0.2,
  },
  errorBody: {
    fontSize: 13,
    color: LABEL_3,
    letterSpacing: -0.05,
    textAlign: 'center',
  },
});
