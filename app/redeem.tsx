import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { HKDW_BLUEPRINT_SLUG } from '@/lib/hkdwPhaseP';
import { useBlueprint, useBlueprintSubscription, useSubscribe } from '@/hooks/useBlueprint';
import { getEventTabRoute } from '@/lib/navigation-config';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { fontFamily } from '@/lib/design-tokens-editorial';

const C = {
  cream: '#F6F4EE',
  cream2: '#EFECE2',
  navy: '#14223D',
  navy2: '#2F3D5C',
  navy3: '#5A6685',
  blue: '#007AFF',
  blueDeep: '#0060D4',
  green: '#34C759',
  line: 'rgba(20,34,61,0.12)',
  text: '#1C1C1E',
};

function firstNameFromProfile(profile: any, user: any): string {
  const raw =
    profile?.full_name ||
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'there';
  return String(raw).split(/[ @]/).filter(Boolean)[0] || 'there';
}

export default function RedeemScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 820;
  const { user, userProfile, ready, loading } = useAuth();
  const rootNavState = useRootNavigationState();
  const { data: blueprint, isLoading: blueprintLoading } = useBlueprint(HKDW_BLUEPRINT_SLUG);
  const { data: subscription, isLoading: subscriptionLoading } = useBlueprintSubscription(blueprint?.id);
  const subscribeMutation = useSubscribe();

  const signedIn = Boolean(user?.id);
  const firstName = useMemo(() => firstNameFromProfile(userProfile, user), [userProfile, user]);

  useEffect(() => {
    if (!rootNavState?.key) return;
    if (!FEATURE_FLAGS.REDEEM) {
      router.replace('/' as any);
    }
  }, [rootNavState?.key]);

  useEffect(() => {
    if (!rootNavState?.key) return;
    if (!FEATURE_FLAGS.REDEEM) return;
    if (!ready || loading || !signedIn || !blueprint?.id || subscriptionLoading) return;
    if (subscription) {
      router.replace(getEventTabRoute() as any);
    }
  }, [rootNavState?.key, ready, loading, signedIn, blueprint?.id, subscription, subscriptionLoading]);

  const goSignup = useCallback(() => {
    router.push({
      pathname: '/(auth)/signup',
      params: { returnTo: '/redeem', interest: 'sail-racing', persona: 'sailor' },
    } as any);
  }, []);

  const goExploreSignup = useCallback(() => {
    router.push('/(auth)/signup' as any);
  }, []);

  const goSignin = useCallback(() => {
    router.push({ pathname: '/(auth)/login', params: { returnTo: '/redeem' } } as any);
  }, []);

  const goPractice = useCallback(() => {
    router.replace(getEventTabRoute() as any);
  }, []);

  const followBlueprint = useCallback(async () => {
    if (!blueprint?.id) return;
    try {
      await subscribeMutation.mutateAsync(blueprint.id);
      router.replace(getEventTabRoute() as any);
    } catch (err: any) {
      showAlert('Could not follow blueprint', err?.message || 'Please try again.');
    }
  }, [blueprint?.id, subscribeMutation]);

  if (!FEATURE_FLAGS.REDEEM) return null;

  const checking =
    !ready ||
    loading ||
    blueprintLoading ||
    (signedIn && blueprint?.id && subscriptionLoading);

  if (checking || (signedIn && subscription)) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator size="large" color={C.blue} />
        <Text style={styles.loadingText}>Opening your BetterAt practice...</Text>
      </View>
    );
  }

  const signedOut = !signedIn;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <View style={styles.mark}>
              <Text style={styles.markText}>b</Text>
            </View>
            <Text style={styles.wordmark}>better<Text style={styles.dot}>.</Text>at</Text>
          </View>
          {signedOut ? (
            <Pressable onPress={goSignin} accessibilityRole="button">
              <Text style={styles.signinTop}>Sign in</Text>
            </Pressable>
          ) : (
            <Text style={styles.signedInTop}>{firstName}</Text>
          )}
        </View>

        <View style={[styles.heroGrid, isDesktop && styles.heroGridDesktop]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>
              <Text style={[styles.swatch, signedOut ? null : styles.swatchGreen]}> </Text>
              {signedOut ? ' Worlds 2027 · Hong Kong · November 2026' : ' Signed in · Worlds 2027'}
            </Text>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
              {signedOut ? (
                <>Prepare for <Text style={styles.serifItalic}>Dragon Worlds</Text> 2027</>
              ) : (
                <>Welcome back, <Text style={styles.serifItalic}>{firstName}</Text></>
              )}
            </Text>
            <Text style={styles.subtitle}>
              {signedOut
                ? "Follow Kevin Denney's preparation blueprint. Plan, do, reflect - together with the fleet."
                : "Follow Kevin's Worlds 2027 · November 2026 prep blueprint? You will get all fourteen steps on your Plan tab, and Kevin will see your reflections."}
            </Text>

            <View style={styles.ctaStack}>
              <Pressable
                onPress={signedOut ? goSignup : followBlueprint}
                disabled={!signedOut && subscribeMutation.isPending}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  !signedOut && subscribeMutation.isPending && styles.disabled,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>
                  {signedOut
                    ? "Follow Kevin's blueprint"
                    : subscribeMutation.isPending
                      ? 'Following...'
                      : 'Follow the blueprint'}
                </Text>
                <Ionicons name={signedOut ? 'arrow-forward' : 'checkmark'} size={18} color="#FFFFFF" />
              </Pressable>
              {signedOut ? (
                <Text style={styles.signinRow}>
                  Already have an account?{' '}
                  <Text style={styles.inlineLink} onPress={goSignin}>Sign in</Text>
                </Text>
              ) : (
                <Pressable onPress={goPractice} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryText}>Not now, take me to BetterAt</Text>
                </Pressable>
              )}
            </View>

            {signedOut && (
              <View style={styles.secondaryCtaCard}>
                <Text style={styles.secondaryCtaTitle}>Not racing in Worlds 2027?</Text>
                <Text style={styles.secondaryCtaBody}>
                  BetterAt works for any hard thing you're getting better at - drawing, nursing,
                  fitness, anything. Same Plan/Do/Reflect loop, just pick your own interest in setup.
                </Text>
                <Pressable
                  onPress={goExploreSignup}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.exploreLink, pressed && styles.pressed]}
                >
                  <Text style={styles.exploreLinkText}>
                    Explore BetterAt instead
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={C.navy2} />
                </Pressable>
              </View>
            )}

            <View style={styles.authorStrip}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>KD</Text>
              </View>
              <View style={styles.authorTextWrap}>
                <Text style={styles.authorText}>
                  Blueprint {signedOut ? 'authored' : 'by'} by <Text style={styles.authorStrong}>Kevin Denney</Text>
                </Text>
                <Text style={styles.authorMeta}>Dragon class - RHKYC - 12 weeks - 14 steps</Text>
              </View>
            </View>
          </View>

          {isDesktop ? (
            <View style={styles.sailCard}>
              <View style={styles.sailShapeOne} />
              <View style={styles.sailShapeTwo} />
              <Text style={styles.sailCaption}>
                Worlds 2027 · November 2026 prep blueprint
              </Text>
            </View>
          ) : (
            <View pointerEvents="none" style={styles.mobileSailMark}>
              <View style={styles.mobileSailOne} />
              <View style={styles.mobileSailTwo} />
            </View>
          )}
        </View>

        <View style={[styles.infoCard, !signedOut && styles.infoCardBlue]}>
          <Text style={[styles.infoTitle, !signedOut && styles.infoTitleBlue]}>
            {signedOut ? 'What is BetterAt' : 'What happens when you tap follow'}
          </Text>
          {signedOut ? (
            <>
              <Text style={styles.infoText}>
                BetterAt is a practice loop for people getting better at hard things. You plan what you will work on, do the practice, and reflect on what you learned.
              </Text>
              <View style={styles.loopRow}>
                <Text style={styles.loopPill}>Plan</Text>
                <Ionicons name="arrow-forward" size={14} color={C.navy3} />
                <Text style={styles.loopPill}>Do</Text>
                <Ionicons name="arrow-forward" size={14} color={C.navy3} />
                <Text style={styles.loopPill}>Reflect</Text>
              </View>
            </>
          ) : (
            <Text style={styles.infoText}>
              Kevin's 14 steps land on your Plan tab in order. The first one becomes your next session, and your shared reflections can be reviewed by Kevin.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.cream,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: C.navy3,
    fontSize: 14,
  },
  content: {
    minHeight: '100%' as any,
    padding: 18,
    paddingTop: Platform.OS === 'web' ? 22 : 56,
  },
  contentDesktop: {
    padding: 44,
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
  },
  shellDesktop: {
    minHeight: 640,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '700',
    color: C.navy,
    letterSpacing: 0,
  },
  dot: {
    color: C.blue,
  },
  signinTop: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  signedInTop: {
    color: C.navy3,
    fontSize: 14,
    fontWeight: '600',
  },
  heroGrid: {
    position: 'relative',
  },
  heroGridDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 64,
  },
  heroCopy: {
    flex: 1,
    zIndex: 2,
  },
  eyebrow: {
    color: C.blue,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  swatch: {
    backgroundColor: C.blue,
    borderRadius: 3,
    overflow: 'hidden',
  },
  swatchGreen: {
    backgroundColor: C.green,
  },
  title: {
    color: C.navy,
    fontFamily: fontFamily.serif,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 14,
  },
  titleDesktop: {
    fontSize: 64,
    lineHeight: 70,
    maxWidth: 660,
  },
  serifItalic: {
    fontStyle: 'italic',
  },
  subtitle: {
    color: C.navy2,
    fontFamily: fontFamily.serif,
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 650,
  },
  ctaStack: {
    marginTop: 26,
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    shadowColor: C.blueDeep,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.62,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: C.navy3,
    fontSize: 14,
    fontWeight: '600',
  },
  signinRow: {
    textAlign: 'center',
    color: C.navy3,
    fontSize: 13,
  },
  inlineLink: {
    color: C.blue,
    fontWeight: '700',
  },
  secondaryCtaCard: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,34,61,0.10)',
    maxWidth: 520,
    gap: 8,
  },
  secondaryCtaTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryCtaBody: {
    color: C.navy3,
    fontSize: 14,
    lineHeight: 20,
  },
  exploreLink: {
    alignSelf: 'flex-start',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  exploreLinkText: {
    color: C.navy2,
    fontSize: 14,
    fontWeight: '700',
  },
  authorStrip: {
    marginTop: 28,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,34,61,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 430,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4E6A85',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  authorTextWrap: {
    flex: 1,
  },
  authorText: {
    color: C.navy2,
    fontSize: 13,
    fontWeight: '500',
  },
  authorStrong: {
    color: C.navy,
    fontWeight: '800',
  },
  authorMeta: {
    color: C.navy3,
    fontSize: 12,
    marginTop: 2,
  },
  mobileSailMark: {
    position: 'absolute',
    right: -34,
    top: 30,
    width: 140,
    height: 210,
    opacity: 0.08,
  },
  mobileSailOne: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 78,
    height: 190,
    backgroundColor: C.navy,
    transform: [{ skewX: '20deg' }],
  },
  mobileSailTwo: {
    position: 'absolute',
    right: 0,
    top: 44,
    width: 42,
    height: 140,
    backgroundColor: C.navy,
    transform: [{ skewX: '16deg' }],
  },
  sailCard: {
    width: 360,
    height: 320,
    borderRadius: 24,
    backgroundColor: C.navy,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'flex-end',
  },
  sailShapeOne: {
    position: 'absolute',
    left: 86,
    top: 44,
    width: 130,
    height: 245,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ skewX: '24deg' }],
  },
  sailShapeTwo: {
    position: 'absolute',
    right: 60,
    top: 96,
    width: 78,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ skewX: '18deg' }],
  },
  sailCaption: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontFamily: fontFamily.serif,
    lineHeight: 20,
    maxWidth: 220,
  },
  infoCard: {
    marginTop: 26,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: C.line,
  },
  infoCardBlue: {
    backgroundColor: 'rgba(0,122,255,0.06)',
    borderColor: 'rgba(0,122,255,0.18)',
  },
  infoTitle: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoTitleBlue: {
    color: C.blue,
  },
  infoText: {
    color: C.navy2,
    fontFamily: fontFamily.serif,
    fontSize: 15,
    lineHeight: 23,
  },
  loopRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  loopPill: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: C.cream2,
    color: C.navy,
    fontSize: 13,
    fontWeight: '700',
  },
});
