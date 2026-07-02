/**
 * For Organizations Landing Page
 * Professional B2B marketing page for yacht clubs and regatta organizers
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

export default function ForOrganizationsPage() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const handleScheduleDemo = () => {
    // Navigate to contact/demo page or open email
    const url = 'mailto:info@better.at?subject=Schedule Demo Request';
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  };

  const handleViewPortfolio = () => {
    // Navigate to portfolio/case studies page
    router.push('/events');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>BA</Text>
            </View>
            <Text style={styles.brandName}>BetterAt</Text>
          </View>

          {/* Desktop Navigation */}
          {isDesktop && (
            <View style={styles.nav}>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Products</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Pricing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Resources</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={() => router.push('/signup')}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.breadcrumbText}>Home</Text>
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color="#999" />
        <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>
          For Organizations
        </Text>
      </View>

      {/* Badge */}
      <View style={styles.badgeContainer}>
        <View style={styles.badge}>
          <Ionicons name="business" size={14} color="#4169E1" />
          <Text style={styles.badgeText}>For Organizations</Text>
        </View>
      </View>

      {/* Hero Section */}
      <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
        <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>
          Custom Mobile Apps for Your{' '}
          <Text style={styles.heroTitleAccent}>Sailing Events</Text>
        </Text>

        <Text style={[styles.heroSubtitle, isDesktop && styles.heroSubtitleDesktop]}>
          Full-service app development from design to app store. Give your sailors
          {'\n'}and spectators a professional mobile experience.
        </Text>

        {/* Feature Pills */}
        <View style={[styles.featurePills, isDesktop && styles.featurePillsDesktop]}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Increase regatta participation</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Modernize your event</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Delight your sailors</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Showcase sponsors effectively</Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={[styles.ctaButtons, isDesktop && styles.ctaButtonsDesktop]}>
          <TouchableOpacity
            style={styles.primaryCTA}
            onPress={handleScheduleDemo}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text style={styles.primaryCTAText}>Schedule Demo</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCTA}
            onPress={handleViewPortfolio}
          >
            <Ionicons name="grid" size={20} color="#4169E1" />
            <Text style={styles.secondaryCTAText}>View Portfolio</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* iPhone Mockups Section */}
      <View style={[styles.mockupsSection, isDesktop && styles.mockupsSectionDesktop]}>
        <View style={[styles.mockupsContainer, isDesktop && styles.mockupsContainerDesktop]}>
          {/* Left Phone - Newport YC */}
          <View style={[styles.phone, styles.phoneLeft]}>
            <View style={styles.phoneHeader}>
              <View style={[styles.phoneStatusBar, { backgroundColor: '#4169E1' }]}>
                <Text style={styles.phoneLocation}>Newport YC</Text>
                <View style={styles.phoneStatusIcons} />
              </View>
            </View>
            <View style={styles.phoneContent}>
              <Text style={styles.phoneEventTitle}>Spring Series 2024</Text>
              <Text style={styles.phoneEventSubtitle}>Live Tracking</Text>
              <View style={styles.phoneContentBody}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.phoneContentLine} />
                ))}
              </View>
              <View style={styles.phoneDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </View>
          </View>

          {/* Center Phone - San Francisco YC */}
          <View style={[styles.phone, styles.phoneCenter]}>
            <View style={styles.phoneHeader}>
              <View style={[styles.phoneStatusBar, { backgroundColor: '#2D8B54' }]}>
                <Text style={styles.phoneLocation}>San Francisco YC</Text>
                <View style={styles.phoneStatusIcons} />
              </View>
            </View>
            <View style={styles.phoneContent}>
              <Text style={styles.phoneEventTitle}>Big Boat Series</Text>
              <Text style={styles.phoneEventSubtitle}>Results & Scoring</Text>
              <View style={styles.phoneContentBody}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={styles.phoneContentLine} />
                ))}
              </View>
              <View style={styles.phoneDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </View>
          </View>

          {/* Right Phone - Royal YS */}
          <View style={[styles.phone, styles.phoneRight]}>
            <View style={styles.phoneHeader}>
              <View style={[styles.phoneStatusBar, { backgroundColor: '#7B68EE' }]}>
                <Text style={styles.phoneLocation}>Royal YS</Text>
                <View style={styles.phoneStatusIcons} />
              </View>
            </View>
            <View style={styles.phoneContent}>
              <Text style={styles.phoneEventTitle}>Cowes Week 2024</Text>
              <Text style={styles.phoneEventSubtitle}>Event Schedule</Text>
              <View style={styles.phoneContentBody}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.phoneContentLine} />
                ))}
              </View>
              <View style={styles.phoneDots}>
                <View style={styles.dot} />
                <View style={styles.dot} />
                <View style={[styles.dot, styles.dotActive]} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Features Section */}
      <View style={[styles.section, styles.featuresSection]}>
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Everything You Need</Text>
          <Text style={styles.sectionSubtitle}>
            Complete custom app development from concept to launch
          </Text>

          <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
            {/* Feature 1 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="phone-portrait" size={32} color="#4169E1" />
              </View>
              <Text style={styles.featureCardTitle}>Native Mobile Apps</Text>
              <Text style={styles.featureCardText}>
                Beautiful iOS and Android apps customized for your event with your branding
              </Text>
            </View>

            {/* Feature 2 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="speedometer" size={32} color="#F59E0B" />
              </View>
              <Text style={styles.featureCardTitle}>Live Race Tracking</Text>
              <Text style={styles.featureCardText}>
                Real-time GPS tracking, live leaderboards, and instant results for sailors and spectators
              </Text>
            </View>

            {/* Feature 3 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="calendar" size={32} color="#10B981" />
              </View>
              <Text style={styles.featureCardTitle}>Event Management</Text>
              <Text style={styles.featureCardText}>
                Complete scheduling, registration, and communication tools in one platform
              </Text>
            </View>

            {/* Feature 4 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="megaphone" size={32} color="#EC4899" />
              </View>
              <Text style={styles.featureCardTitle}>Sponsor Integration</Text>
              <Text style={styles.featureCardText}>
                Showcase sponsors with branded content, banners, and premium placements
              </Text>
            </View>

            {/* Feature 5 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="notifications" size={32} color="#6366F1" />
              </View>
              <Text style={styles.featureCardTitle}>Push Notifications</Text>
              <Text style={styles.featureCardText}>
                Send updates, race alerts, and important announcements directly to participants
              </Text>
            </View>

            {/* Feature 6 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconLarge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="stats-chart" size={32} color="#0EA5E9" />
              </View>
              <Text style={styles.featureCardTitle}>Analytics Dashboard</Text>
              <Text style={styles.featureCardText}>
                Track engagement, downloads, and usage to measure success and improve future events
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* How It Works Section */}
      <View style={[styles.section, styles.howItWorksSection]}>
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Simple Process, Professional Results</Text>
          <Text style={styles.sectionSubtitle}>
            From concept to launch in 6-8 weeks
          </Text>

          <View style={[styles.stepsContainer, isDesktop && styles.stepsContainerDesktop]}>
            {/* Step 1 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Discovery Call</Text>
              <Text style={styles.stepText}>
                We learn about your event, goals, and requirements
              </Text>
            </View>

            {isDesktop && <View style={styles.stepArrow}>
              <Ionicons name="arrow-forward" size={24} color="#D1D5DB" />
            </View>}

            {/* Step 2 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Design & Planning</Text>
              <Text style={styles.stepText}>
                Custom designs matching your brand and event identity
              </Text>
            </View>

            {isDesktop && <View style={styles.stepArrow}>
              <Ionicons name="arrow-forward" size={24} color="#D1D5DB" />
            </View>}

            {/* Step 3 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Development</Text>
              <Text style={styles.stepText}>
                Build and test your custom app with your feedback
              </Text>
            </View>

            {isDesktop && <View style={styles.stepArrow}>
              <Ionicons name="arrow-forward" size={24} color="#D1D5DB" />
            </View>}

            {/* Step 4 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepTitle}>Launch</Text>
              <Text style={styles.stepText}>
                Deploy to App Store and Google Play with full support
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Testimonials Section */}
      <View style={[styles.section, styles.testimonialsSection]}>
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Trusted by Leading Sailing Organizations</Text>

          <View style={[styles.testimonialsGrid, isDesktop && styles.testimonialsGridDesktop]}>
            {/* Testimonial 1 */}
            <View style={styles.testimonialCard}>
              <View style={styles.quoteIcon}>
                <Ionicons name="quote" size={32} color="#4169E1" />
              </View>
              <Text style={styles.testimonialText}>
                "The custom app transformed our regatta. Sailors loved the live tracking and results were posted instantly. Worth every penny."
              </Text>
              <View style={styles.testimonialAuthor}>
                <Text style={styles.authorName}>Sarah Mitchell</Text>
                <Text style={styles.authorTitle}>Race Director, Newport Yacht Club</Text>
              </View>
            </View>

            {/* Testimonial 2 */}
            <View style={styles.testimonialCard}>
              <View style={styles.quoteIcon}>
                <Ionicons name="quote" size={32} color="#4169E1" />
              </View>
              <Text style={styles.testimonialText}>
                "Our sponsors were thrilled with the visibility. The app paid for itself through increased sponsorship revenue."
              </Text>
              <View style={styles.testimonialAuthor}>
                <Text style={styles.authorName}>James Chen</Text>
                <Text style={styles.authorTitle}>Commodore, San Francisco YC</Text>
              </View>
            </View>

            {/* Testimonial 3 */}
            <View style={styles.testimonialCard}>
              <View style={styles.quoteIcon}>
                <Ionicons name="quote" size={32} color="#4169E1" />
              </View>
              <Text style={styles.testimonialText}>
                "BetterAt made us look incredibly professional. Participation doubled the following year."
              </Text>
              <View style={styles.testimonialAuthor}>
                <Text style={styles.authorName}>Emma Thompson</Text>
                <Text style={styles.authorTitle}>Event Manager, Royal Yacht Squadron</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Final CTA Section */}
      <View style={[styles.section, styles.finalCTASection]}>
        <View style={styles.sectionContent}>
          <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
            Ready to Elevate Your Event?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: '#FFFFFF', opacity: 0.9 }]}>
            Schedule a demo to see how a custom app can transform your regatta
          </Text>

          <View style={[styles.ctaButtons, { marginTop: 32 }]}>
            <TouchableOpacity
              style={[styles.primaryCTA, { backgroundColor: '#FFFFFF' }]}
              onPress={handleScheduleDemo}
            >
              <Ionicons name="calendar" size={20} color="#4169E1" />
              <Text style={[styles.primaryCTAText, { color: '#4169E1' }]}>Schedule Demo</Text>
              <Ionicons name="arrow-forward" size={18} color="#4169E1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <View style={styles.footerTop}>
            <View style={styles.footerBrand}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>BA</Text>
              </View>
              <Text style={styles.brandName}>BetterAt</Text>
            </View>

            <Text style={styles.footerTagline}>
              Professional sailing race management platform
            </Text>
          </View>

          <View style={styles.footerLinks}>
            <View style={styles.footerColumn}>
              <Text style={styles.footerColumnTitle}>Product</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Features</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Pricing</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Case Studies</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerColumn}>
              <Text style={styles.footerColumnTitle}>Resources</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Documentation</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Support</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Blog</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerColumn}>
              <Text style={styles.footerColumnTitle}>Company</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>About</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerBottom}>
            <Text style={styles.footerCopyright}>
              © 2025 BetterAt. All rights reserved.
            </Text>
            <View style={styles.footerSocial}>
              <TouchableOpacity style={styles.socialIcon}>
                <Ionicons name="logo-twitter" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <Ionicons name="logo-linkedin" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <Ionicons name="logo-instagram" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  nav: {
    flexDirection: 'row',
    gap: 32,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  signInText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  getStartedButton: {
    backgroundColor: '#4169E1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#6B7280',
  },
  breadcrumbActive: {
    color: '#111827',
    fontWeight: '500',
  },
  badgeContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeText: {
    fontSize: 13,
    color: '#4169E1',
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },
  heroDesktop: {
    paddingTop: 60,
    paddingBottom: 80,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 44,
    maxWidth: 800,
  },
  heroTitleDesktop: {
    fontSize: 56,
    lineHeight: 68,
  },
  heroTitleAccent: {
    color: '#4169E1',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 600,
    lineHeight: 24,
  },
  heroSubtitleDesktop: {
    fontSize: 20,
    lineHeight: 30,
    marginTop: 24,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 32,
    justifyContent: 'center',
    maxWidth: 700,
  },
  featurePillsDesktop: {
    marginTop: 48,
  },
  pill: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaButtonsDesktop: {
    marginTop: 48,
  },
  primaryCTA: {
    backgroundColor: '#4169E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(65, 105, 225, 0.3)',
      },
      default: {
        shadowColor: '#4169E1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  primaryCTAText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryCTA: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  secondaryCTAText: {
    color: '#4169E1',
    fontSize: 16,
    fontWeight: '600',
  },
  mockupsSection: {
    paddingVertical: 60,
    backgroundColor: '#F9FAFB',
  },
  mockupsSectionDesktop: {
    paddingVertical: 100,
  },
  mockupsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    paddingHorizontal: 24,
  },
  mockupsContainerDesktop: {
    gap: 40,
  },
  phone: {
    width: 280,
    height: 580,
    backgroundColor: '#1F2937',
    borderRadius: 36,
    borderWidth: 8,
    borderColor: '#1F2937',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 20px 30px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 10,
      },
    }),
  },
  phoneLeft: {
    transform: [{ rotate: '-3deg' }, { translateY: 20 }],
  },
  phoneCenter: {
    transform: [{ scale: 1.05 }],
    zIndex: 2,
  },
  phoneRight: {
    transform: [{ rotate: '3deg' }, { translateY: 20 }],
  },
  phoneHeader: {
    backgroundColor: '#FFFFFF',
  },
  phoneStatusBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneLocation: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  phoneStatusIcons: {
    width: 60,
    height: 12,
  },
  phoneContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  phoneEventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  phoneEventSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  phoneContentBody: {
    flex: 1,
    gap: 12,
  },
  phoneContentLine: {
    height: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  phoneDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#4169E1',
  },
  // New Section Styles
  section: {
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  sectionContent: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 48,
  },
  featuresSection: {
    backgroundColor: '#FFFFFF',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'center',
  },
  featuresGridDesktop: {
    gap: 32,
  },
  featureCard: {
    flex: 1,
    minWidth: 280,
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  featureIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  featureCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  featureCardText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  howItWorksSection: {
    backgroundColor: '#F9FAFB',
  },
  stepsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  stepsContainerDesktop: {
    flexWrap: 'nowrap',
    gap: 16,
  },
  step: {
    flex: 1,
    minWidth: 200,
    maxWidth: 280,
    alignItems: 'center',
  },
  stepArrow: {
    paddingTop: 40,
  },
  stepNumber: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepNumberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  testimonialsSection: {
    backgroundColor: '#FFFFFF',
  },
  testimonialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'center',
  },
  testimonialsGridDesktop: {
    gap: 32,
  },
  testimonialCard: {
    flex: 1,
    minWidth: 300,
    maxWidth: 380,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quoteIcon: {
    marginBottom: 20,
    opacity: 0.2,
  },
  testimonialText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 26,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  authorTitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  finalCTASection: {
    backgroundColor: '#4169E1',
  },
  footer: {
    backgroundColor: '#1F2937',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  footerContent: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  footerTop: {
    alignItems: 'center',
    marginBottom: 40,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  footerTagline: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 48,
    justifyContent: 'center',
    marginBottom: 40,
  },
  footerColumn: {
    minWidth: 150,
  },
  footerColumnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerLink: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  footerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerCopyright: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  footerSocial: {
    flexDirection: 'row',
    gap: 16,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
