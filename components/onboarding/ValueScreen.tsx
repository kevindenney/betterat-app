/**
 * ValueScreen - Reusable animated value showcase screen
 * Used for pre-signup screens that highlight app benefits
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Breakpoint for desktop layout
const DESKTOP_BREAKPOINT = 768;

export interface ValueScreenProps {
  /** Main title text */
  title: string;
  /** Subtitle/description text */
  subtitle: string;
  /** Icon or illustration component - receives isDesktop prop for responsive sizing */
  illustration: React.ReactNode;
  /** Gradient colors for background */
  gradientColors: readonly [string, string, ...string[]];
  /** CTA button text */
  ctaText: string;
  /** Route to navigate to on CTA press */
  nextRoute: string;
  /** Optional skip button text */
  skipText?: string;
  /** Optional skip route */
  skipRoute?: string;
  /** Current step index (0-indexed) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Optional callback for CTA press */
  onContinue?: () => void;
  /** Optional callback for skip press */
  onSkip?: () => void;
}

/** Hook to determine if we're on a desktop-sized screen (web only) */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

// Reanimated entering animations don't run on react-native-web — elements
// stay stuck at their pre-enter opacity 0, which left the title + CTA column
// invisible on desktop web. Skip entering on web; native keeps the motion.
const enterFadeIn = Platform.OS === 'web' ? undefined : FadeIn.delay(400).duration(400);
const enterTitle = Platform.OS === 'web' ? undefined : FadeInDown.delay(200).duration(400).springify();
const enterSubtitle = Platform.OS === 'web' ? undefined : FadeInDown.delay(300).duration(400).springify();

export function ValueScreen({
  title,
  subtitle,
  illustration,
  gradientColors,
  ctaText,
  nextRoute,
  skipText,
  skipRoute,
  currentStep,
  totalSteps,
  onContinue,
  onSkip,
}: ValueScreenProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  // Animation values
  const illustrationScale = useSharedValue(0.8);
  const illustrationOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate illustration entrance
    illustrationScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });
    illustrationOpacity.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.ease),
    });
  }, [illustrationOpacity, illustrationScale]);

  const illustrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: illustrationScale.value }],
    opacity: illustrationOpacity.value,
  }));

  const handleContinue = () => {
    onContinue?.();
    router.push(nextRoute as any);
  };

  const handleSkip = () => {
    onSkip?.();
    if (skipRoute) {
      router.push(skipRoute as any);
    }
  };

  // Progress dots component (shared between layouts)
  const ProgressDots = (
    <View style={[styles.progressContainer, isDesktop && styles.progressContainerDesktop]}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            index === currentStep && styles.progressDotActive,
            index < currentStep && styles.progressDotCompleted,
          ]}
        />
      ))}
    </View>
  );

  // Actions component (shared between layouts)
  const Actions = (
    <Animated.View
      entering={enterFadeIn}
      style={[styles.actionsContainer, isDesktop && styles.actionsContainerDesktop]}
    >
      <TouchableOpacity
        style={[styles.ctaButton, isDesktop && styles.ctaButtonDesktop]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={[styles.ctaText, isDesktop && styles.ctaTextDesktop]}>{ctaText}</Text>
      </TouchableOpacity>

      {skipText && skipRoute && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>{skipText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* Progress Dots - top on mobile, bottom on desktop */}
          {!isDesktop && ProgressDots}

          {isDesktop ? (
            // Desktop: Two-column layout
            <View style={styles.desktopLayout}>
              {/* Left column: Illustration */}
              <Animated.View style={[styles.illustrationContainerDesktop, illustrationStyle]}>
                {illustration}
              </Animated.View>

              {/* Right column: Text + Actions */}
              <View style={styles.desktopRightColumn}>
                <View style={styles.textContainerDesktop}>
                  <Animated.Text
                    entering={enterTitle}
                    style={[styles.title, styles.titleDesktop]}
                  >
                    {title}
                  </Animated.Text>

                  <Animated.Text
                    entering={enterSubtitle}
                    style={[styles.subtitle, styles.subtitleDesktop]}
                  >
                    {subtitle}
                  </Animated.Text>
                </View>

                {Actions}
              </View>
            </View>
          ) : (
            // Mobile: Single-column layout (original)
            <>
              <Animated.View style={[styles.illustrationContainer, illustrationStyle]}>
                {illustration}
              </Animated.View>

              <View style={styles.textContainer}>
                <Animated.Text
                  entering={enterTitle}
                  style={styles.title}
                >
                  {title}
                </Animated.Text>

                <Animated.Text
                  entering={enterSubtitle}
                  style={styles.subtitle}
                >
                  {subtitle}
                </Animated.Text>
              </View>

              {Actions}
            </>
          )}

          {/* Progress Dots at bottom for desktop */}
          {isDesktop && ProgressDots}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 40,
  },
  // Desktop: center content with max-width
  contentDesktop: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 48,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    gap: 8,
  },
  progressContainerDesktop: {
    paddingTop: 0,
    marginTop: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  // Desktop: Two-column layout container
  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 60,
    flex: 1,
  },
  illustrationContainerDesktop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 450,
  },
  desktopRightColumn: {
    flex: 1,
    maxWidth: 450,
    justifyContent: 'center',
  },
  textContainer: {
    marginBottom: 32,
  },
  textContainerDesktop: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 44,
    textAlign: 'left',
    marginBottom: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  subtitleDesktop: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'left',
    paddingHorizontal: 0,
  },
  actionsContainer: {
    gap: 16,
  },
  actionsContainerDesktop: {
    maxWidth: 320,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDesktop: {
    paddingVertical: 20,
    borderRadius: 14,
  },
  ctaText: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
  },
  ctaTextDesktop: {
    fontSize: 18,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ValueScreen;
