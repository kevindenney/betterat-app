/**
 * Coaches Landing Page
 * Full landing page for coaches with hero, demo, features, and pricing
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LandingNav } from '@/components/landing/LandingNav';
import { CoachFeatureDescriptions, type CoachFeatureId } from '@/components/landing/CoachFeatureDescriptions';
import { EmbeddedCoachingDemo } from '@/components/landing/EmbeddedCoachingDemo';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';
import { ScrollFix } from '@/components/landing/ScrollFix';

export default function CoachesPage() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(false);
  const [highlightedFeature, setHighlightedFeature] = React.useState<CoachFeatureId | null>(null);

  // Ensure we only check dimensions after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const shouldStackColumns = mounted && width <= 1200;
  const isSmallMobile = mounted && width <= 430;

  // Inject responsive CSS for three-column layout (web only)
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'coach-landing-responsive-layout';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `
        /* Global responsive utilities */
        * {
          box-sizing: border-box;
        }

        body, html {
          width: 100%;
          overflow-x: hidden;
          margin: 0;
          padding: 0;
        }

        /* Three-column layout responsive styles */
        @media (max-width: 1200px) {
          [data-coach-demo-with-features] {
            flex-direction: column !important;
            padding: 30px 20px !important;
            gap: 20px !important;
          }
          [data-coach-features-left] {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            position: static !important;
            order: 2 !important;
            margin-top: 24px !important;
          }
          [data-coach-demo-center] {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            order: 1 !important;
            margin-bottom: 24px !important;
          }
          [data-coach-features-right] {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            position: static !important;
            order: 3 !important;
            margin-top: 24px !important;
          }
        }

        /* Mobile: Stack everything vertically */
        @media (max-width: 768px) {
          [data-coach-demo-with-features] {
            flex-direction: column !important;
            padding: 20px 16px !important;
            gap: 16px !important;
          }
          [data-coach-features-left],
          [data-coach-features-right] {
            order: 2 !important;
            margin-top: 16px !important;
            margin-bottom: 0 !important;
          }
          [data-coach-demo-center] {
            order: 1 !important;
            margin-bottom: 16px !important;
          }
        }

        /* Hero section responsive styles */
        @media (max-width: 768px) {
          [data-coach-hero-section] {
            min-height: 400px !important;
            padding: 60px 20px !important;
          }
        }

        /* Small mobile (iPhone Pro Max and smaller) */
        @media (max-width: 430px) {
          [data-coach-hero-section] {
            min-height: 350px !important;
            padding: 48px 16px !important;
          }
          [data-coach-hero-title] {
            font-size: 28px !important;
            line-height: 1.4 !important;
          }
          [data-coach-demo-with-features] {
            padding: 16px !important;
            gap: 12px !important;
          }
          [data-coach-demo-center] {
            padding: 0 8px !important;
          }
        }

        /* Extra small mobile (iPhone SE and smaller) */
        @media (max-width: 375px) {
          [data-coach-hero-section] {
            min-height: 320px !important;
            padding: 40px 12px !important;
          }
          [data-coach-hero-title] {
            font-size: 24px !important;
          }
          [data-coach-demo-with-features] {
            padding: 12px 8px !important;
          }
        }

        /* Demo container wrapper */
        .coach-demo-center-wrapper {
          flex: 1 1 0;
          min-width: 0;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        @media (max-width: 1200px) {
          .coach-demo-center-wrapper {
            flex: 1 1 100% !important;
            max-width: 100% !important;
            width: 100% !important;
            order: 1 !important;
            margin-bottom: 24px !important;
          }
        }
      `;

      return () => {
        const existing = document.getElementById(styleId);
        if (existing && existing.parentNode) {
          existing.remove();
        }
      };
    }
  }, []);

  const handleGetStarted = () => {
    router.push({
      pathname: '/(auth)/signup',
      params: { persona: 'coach' }
    });
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  const handleScrollToPricing = () => {
    if (Platform.OS === 'web') {
      const pricingSection = document.getElementById('coach-pricing-section');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const Container = Platform.OS === 'web' ? View : SafeAreaView;
  const containerStyle = Platform.OS === 'web'
    ? [styles.container, styles.webContainer]
    : styles.container;

  return (
    <Container style={containerStyle}>
      <ScrollFix />
      <LandingNav transparent={true} sticky={true} />

      <View style={styles.pageWrapper}>
        {/* Hero Section */}
        <LinearGradient
          colors={['#5B21B6', '#7C3AED', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
          {...(Platform.OS === 'web' ? { 'data-coach-hero-section': true } : {})}
        >
          <View style={styles.heroContent}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>BetterAt</Text>
              <View style={styles.forCoachesBadge}>
                <Text style={styles.forCoachesText}>FOR COACHES</Text>
              </View>
            </View>

            {/* Title */}
            <Text
              style={styles.heroTitle}
              {...(Platform.OS === 'web' ? { 'data-coach-hero-title': true } : {})}
            >
              Grow Your Coaching Business
            </Text>

            {/* Subtitle */}
            <Text style={styles.heroSubtitle}>
              Build your client base, manage sessions, and develop winning sailors - all in one platform
            </Text>

            {/* CTA Buttons */}
            <View style={styles.ctaButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted}>
                <Text style={styles.primaryButtonText}>Start Coaching</Text>
                <Ionicons name="arrow-forward" size={20} color="#7C3AED" style={styles.buttonIcon} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleScrollToPricing}>
                <Text style={styles.secondaryButtonText}>See Pricing</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View style={styles.signInLink}>
              <Text style={styles.signInLinkText}>
                Already a coach?{' '}
                <Text style={styles.signInLinkButton} onPress={handleSignIn}>
                  Sign In
                </Text>
              </Text>
            </View>

            {/* Other User Types */}
            <View style={styles.otherUserTypes}>
              <Text style={styles.otherUserTypesText}>
                Looking for{' '}
                <Text
                  style={styles.otherUserTypesLink}
                  onPress={() => router.push('/')}
                >
                  sailor
                </Text>
                {' '}or{' '}
                <Text
                  style={styles.otherUserTypesLink}
                  onPress={() => router.push('/clubs')}
                >
                  club
                </Text>
                {' '}features?
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Demo Section with Features - Three Column Layout */}
        <View style={styles.demoSection} id="features-demo">
          <View
            style={[
              styles.demoWithFeatures,
              shouldStackColumns && styles.demoWithFeaturesStacked,
            ]}
            {...(Platform.OS === 'web' ? { 'data-coach-demo-with-features': true } : {})}
          >
            {/* LEFT COLUMN - Feature Cards */}
            <View
              style={[
                styles.featuresLeft,
                shouldStackColumns && styles.featuresLeftStacked,
              ]}
              {...(Platform.OS === 'web' ? { 'data-coach-features-left': true } : {})}
            >
              <CoachFeatureDescriptions
                column="left"
                highlightedFeature={highlightedFeature}
                onFeatureClick={(featureId) => {
                  setHighlightedFeature(featureId);
                  // Auto-clear after 3 seconds
                  setTimeout(() => {
                    setHighlightedFeature(null);
                  }, 3000);
                }}
              />
            </View>

            {/* CENTER - Coaching Demo */}
            {Platform.OS === 'web' ? (
              // @ts-ignore - Web only: use native div for CSS containment
              <div
                data-coach-demo-center="true"
                className="coach-demo-center-wrapper"
              >
                <EmbeddedCoachingDemo
                  highlightedFeature={highlightedFeature}
                  onFeatureHighlight={setHighlightedFeature}
                />
              </div>
            ) : (
              <View
                style={[
                  styles.demoCenter,
                  shouldStackColumns && styles.demoCenterStacked,
                ]}
              >
                <EmbeddedCoachingDemo
                  highlightedFeature={highlightedFeature}
                  onFeatureHighlight={setHighlightedFeature}
                />
              </View>
            )}

            {/* RIGHT COLUMN - Feature Cards */}
            <View
              style={[
                styles.featuresRight,
                shouldStackColumns && styles.featuresRightStacked,
              ]}
              {...(Platform.OS === 'web' ? { 'data-coach-features-right': true } : {})}
            >
              <CoachFeatureDescriptions
                column="right"
                highlightedFeature={highlightedFeature}
                onFeatureClick={(featureId) => {
                  setHighlightedFeature(featureId);
                  // Auto-clear after 3 seconds
                  setTimeout(() => {
                    setHighlightedFeature(null);
                  }, 3000);
                }}
              />
            </View>
          </View>
        </View>

        {/* Pricing Section */}
        <View id="coach-pricing-section">
          <PricingSection variant="coach" />
        </View>

        {/* Footer */}
        <Footer />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  webContainer: {
    minHeight: '100vh' as any,
    width: '100%',
  },
  pageWrapper: {
    width: '100%',
    ...Platform.select({
      web: {
        minWidth: 320,
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      },
    }),
  },

  // Hero Section
  heroSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 600,
    ...Platform.select({
      web: {
        paddingTop: 120, // Account for fixed nav
      },
    }),
  },
  heroContent: {
    maxWidth: 900,
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  forCoachesBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  forCoachesText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 20,
    ...Platform.select({
      web: {
        fontSize: 'clamp(36px, 5vw, 56px)' as any,
        lineHeight: 1.2 as any,
      },
    }),
  },
  heroSubtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 40,
    maxWidth: 600,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7C3AED',
  },
  buttonIcon: {
    marginLeft: 4,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signInLink: {
    marginBottom: 16,
  },
  signInLinkText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  signInLinkButton: {
    color: '#FFFFFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  otherUserTypes: {
    marginTop: 8,
  },
  otherUserTypesText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTypesLink: {
    color: '#FFFFFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },

  // Demo Section
  demoSection: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 60,
    width: '100%',
    ...Platform.select({
      web: {
        overflowX: 'hidden',
      },
    }),
  },
  demoWithFeatures: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 32,
    maxWidth: 1600,
    marginHorizontal: 'auto',
  },
  demoWithFeaturesStacked: {
    flexDirection: 'column',
    paddingHorizontal: 24,
    gap: 24,
  },
  featuresLeft: {
    width: 280,
    flexShrink: 0,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 100,
      },
    }),
  },
  featuresLeftStacked: {
    width: '100%',
    ...Platform.select({
      web: {
        position: 'static',
        maxWidth: 600,
        alignSelf: 'center',
      },
    }),
  },
  featuresRight: {
    width: 280,
    flexShrink: 0,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 100,
      },
    }),
  },
  featuresRightStacked: {
    width: '100%',
    ...Platform.select({
      web: {
        position: 'static',
        maxWidth: 600,
        alignSelf: 'center',
      },
    }),
  },
  demoCenter: {
    flex: 1,
    maxWidth: 600,
    minWidth: 0,
  },
  demoCenterStacked: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});
