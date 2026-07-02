/**
 * Clubs Landing Page
 * Full landing page for yacht club features with hero, demo, features, and pricing
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LandingNav } from '@/components/landing/LandingNav';
import { ClubFeatureDescriptions, ClubFeatureId } from '@/components/landing/ClubFeatureDescriptions';
import { EmbeddedClubDemo } from '@/components/landing/EmbeddedClubDemo';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';

export default function ClubsPage() {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const isSmallMobile = width <= 430;
  const isDesktop = width > 1024;
  const [highlightedFeature, setHighlightedFeature] = useState<ClubFeatureId | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Inject CSS for responsive layout on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'clubs-page-responsive-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Mobile styles - stack vertically */
        [data-clubs-layout="three-column"] {
          flex-direction: column !important;
          gap: 32px !important;
        }
        [data-clubs-layout="feature-column"] {
          width: 100% !important;
          display: none !important;
        }
        [data-clubs-layout="demo-column"] {
          width: 100% !important;
          max-width: 100% !important;
          order: 1 !important;
        }
        [data-clubs-layout="mobile-features"] {
          display: block !important;
          order: 2 !important;
        }

        /* Desktop styles - show three columns */
        @media (min-width: 1025px) {
          [data-clubs-layout="three-column"] {
            flex-direction: row !important;
            gap: 24px !important;
            align-items: flex-start !important;
          }
          [data-clubs-layout="feature-column"] {
            width: 280px !important;
            min-width: 280px !important;
            max-width: 280px !important;
            display: flex !important;
          }
          [data-clubs-layout="demo-column"] {
            flex: 1 !important;
            min-width: 0 !important;
            max-width: none !important;
            order: 0 !important;
          }
          [data-clubs-layout="mobile-features"] {
            display: none !important;
          }
        }

        /* Wide desktop - larger feature columns */
        @media (min-width: 1400px) {
          [data-clubs-layout="feature-column"] {
            width: 320px !important;
            min-width: 320px !important;
            max-width: 320px !important;
          }
        }

        /* Small mobile (iPhone Pro Max and smaller) */
        @media (max-width: 430px) {
          [data-clubs-layout="three-column"] {
            padding: 16px !important;
            gap: 16px !important;
          }
          [data-clubs-layout="demo-column"] {
            padding: 0 8px !important;
          }
          [data-clubs-hero] {
            padding: 48px 16px !important;
            min-height: 350px !important;
          }
          [data-clubs-hero-title] {
            font-size: 28px !important;
          }
        }

        /* Extra small mobile (iPhone SE and smaller) */
        @media (max-width: 375px) {
          [data-clubs-layout="three-column"] {
            padding: 12px 8px !important;
          }
          [data-clubs-hero] {
            padding: 40px 12px !important;
          }
          [data-clubs-hero-title] {
            font-size: 24px !important;
          }
        }
      `;
      document.head.appendChild(style);

      return () => {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, []);

  const handleFeatureClick = (featureId: ClubFeatureId) => {
    setHighlightedFeature(featureId);
    // Clear highlight after animation
    setTimeout(() => setHighlightedFeature(null), 2000);
  };

  const scrollToPricing = () => {
    if (Platform.OS === 'web') {
      const pricingElement = document.getElementById('clubs-pricing-section');
      if (pricingElement) {
        pricingElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleContactSales = () => {
    const url = 'mailto:info@better.at?subject=Club Enterprise Inquiry';
    if (Platform.OS === 'web') {
      window.location.href = url;
      return;
    }
    Linking.openURL(url);
  };

  // Native view wrapper for web (allows CSS selectors)
  const DataView = Platform.OS === 'web'
    ? ({ dataLayout, style, children }: { dataLayout: string; style?: any; children: React.ReactNode }) => (
        // @ts-ignore
        <div data-clubs-layout={dataLayout} style={style}>
          {children}
        </div>
      )
    : ({ style, children }: { dataLayout: string; style?: any; children: React.ReactNode }) => (
        <View style={style}>{children}</View>
      );

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <LandingNav transparent={false} sticky={true} />

      {/* Hero Section */}
      <LinearGradient
        colors={['#047857', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
          <View style={styles.heroTextContainer}>
            <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>
              Modern Race Management
            </Text>
            <Text style={[styles.heroSubtitle, isDesktop && styles.heroSubtitleDesktop]}>
              Everything your yacht club needs: entries, scoring, results, and member management
            </Text>

            <View style={[styles.heroCTAs, isMobile && styles.heroCTAsMobile]}>
              <TouchableOpacity
                style={styles.primaryCTA}
                onPress={handleContactSales}
              >
                <Text style={styles.primaryCTAText}>Contact Sales</Text>
                <Ionicons name="mail-outline" size={18} color="#047857" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryCTA}
                onPress={scrollToPricing}
              >
                <Text style={styles.secondaryCTAText}>See Pricing</Text>
                <Ionicons name="arrow-down" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Three Column Demo Section */}
      <View style={styles.demoSection}>
        <View style={styles.demoHeader}>
          <Text style={[styles.demoTitle, isDesktop && styles.demoTitleDesktop]}>
            Complete Regatta Management Platform
          </Text>
          <Text style={styles.demoSubtitle}>
            From entries to results publishing - manage everything in one place
          </Text>
        </View>

        <DataView
          dataLayout="three-column"
          style={styles.threeColumnLayout}
        >
          {/* Left Feature Column */}
          <DataView
            dataLayout="feature-column"
            style={styles.featureColumn}
          >
            <ClubFeatureDescriptions
              column="left"
              highlightedFeature={highlightedFeature}
              onFeatureClick={handleFeatureClick}
            />
          </DataView>

          {/* Center Demo Column */}
          <DataView
            dataLayout="demo-column"
            style={styles.demoColumn}
          >
            <EmbeddedClubDemo
              highlightedFeature={highlightedFeature}
              onFeatureClick={handleFeatureClick}
            />
          </DataView>

          {/* Right Feature Column */}
          <DataView
            dataLayout="feature-column"
            style={styles.featureColumn}
          >
            <ClubFeatureDescriptions
              column="right"
              highlightedFeature={highlightedFeature}
              onFeatureClick={handleFeatureClick}
            />
          </DataView>
        </DataView>

        {/* Mobile Features (horizontal scroll) */}
        <DataView
          dataLayout="mobile-features"
          style={styles.mobileFeatures}
        >
          <Text style={styles.mobileFeaturesTitle}>Features</Text>
          <ClubFeatureDescriptions
            column="left"
            highlightedFeature={highlightedFeature}
            onFeatureClick={handleFeatureClick}
          />
          <View style={{ height: 16 }} />
          <ClubFeatureDescriptions
            column="right"
            highlightedFeature={highlightedFeature}
            onFeatureClick={handleFeatureClick}
          />
        </DataView>
      </View>

      {/* Pricing Section */}
      <View id="clubs-pricing-section" style={styles.pricingSection}>
        <PricingSection variant="club" />
      </View>

      {/* Footer */}
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flexGrow: 1,
  },
  // Hero styles
  heroGradient: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  heroContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  heroContentDesktop: {
    paddingVertical: 40,
  },
  heroTextContainer: {
    alignItems: 'center',
    maxWidth: 800,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 44,
  },
  heroTitleDesktop: {
    fontSize: 56,
    lineHeight: 68,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#D1FAE5',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
  },
  heroSubtitleDesktop: {
    fontSize: 22,
    lineHeight: 34,
  },
  heroCTAs: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  heroCTAsMobile: {
    flexDirection: 'column',
    width: '100%',
    maxWidth: 300,
  },
  primaryCTA: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 4,
      },
    }),
  },
  primaryCTAText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
  },
  secondaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  secondaryCTAText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Demo section styles
  demoSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  demoHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  demoTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  demoTitleDesktop: {
    fontSize: 36,
  },
  demoSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 600,
  },
  threeColumnLayout: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 24,
      },
    }),
  },
  featureColumn: {
    width: 280,
    flexShrink: 0,
  },
  demoColumn: {
    flex: 1,
    minWidth: 0,
  },
  mobileFeatures: {
    marginTop: 32,
    ...Platform.select({
      web: {
        display: 'none',
      },
    }),
  },
  mobileFeaturesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  // Pricing section
  pricingSection: {
    backgroundColor: '#FFFFFF',
  },
});
