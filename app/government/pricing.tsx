/**
 * Government / Livelihood-Mission Pricing — India variant.
 *
 * The institutional page (app/institutions/pricing.tsx) is USD, seat-based and
 * school/club-framed — right for JHU/RHKYC, wrong for a State Rural Livelihood
 * Mission. Missions don't think in seats; they think in blocks and districts,
 * pay in INR against a budget line, and never charge the beneficiary (the SHG
 * member). So the unit here is the administrative BLOCK, the women under it are
 * included free, and every CTA is a conversation (no self-serve checkout).
 *
 * This is a sales artifact to put in front of a named mission/department and
 * get a reaction — not a billing system. CTAs open email.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SimpleLandingNav } from '@/components/landing/SimpleLandingNav';
import { ScrollFix } from '@/components/landing/ScrollFix';

interface MissionPlan {
  id: 'pilot' | 'district' | 'state';
  name: string;
  description: string;
  /** Pre-formatted price for flat plans; district is computed from block count. */
  price: string;
  priceDetail: string;
  unitLabel: string;
  features: string[];
  cta: string;
  emailSubject: string;
  isPopular?: boolean;
  accentColor: string;
  iconName: string;
}

const CONTACT_EMAIL = 'missions@betterat.com';

const MISSION_PLANS: MissionPlan[] = [
  {
    id: 'pilot',
    name: 'One Block',
    description:
      'Start in a single block. Equip its CRPs and cluster coordinators to issue blueprints and mentor the SHG members they already work with.',
    price: '₹1,50,000',
    priceDetail: '/ year · one block, flat',
    unitLabel: '1 administrative block',
    features: [
      'One administrative block',
      'Unlimited SHG members included — never charged',
      'Field staff issue & mentor blueprints',
      'Progress dashboard for the block',
      'Works on basic phones, low data',
      'Onboarding for your CRPs',
    ],
    cta: 'Request a pilot',
    emailSubject: 'BetterAt — Block pilot enquiry',
    accentColor: '#007AFF',
    iconName: 'leaf-outline',
  },
  {
    id: 'district',
    name: 'District Mission',
    description:
      'Roll out across every block in a district. Mission staff see district-wide progress; aligns with your DAY-NRLM reporting.',
    price: '₹50,000',
    priceDetail: '/ block / year',
    unitLabel: 'All blocks in a district',
    features: [
      'Every block in the district',
      'Unlimited SHG members included',
      'District-wide progress reporting',
      'CRP onboarding & training',
      'Aligns with DAY-NRLM reporting',
      'Priority support',
    ],
    cta: 'Talk to us',
    emailSubject: 'BetterAt — District mission enquiry',
    isPopular: true,
    accentColor: '#059669',
    iconName: 'business-outline',
  },
  {
    id: 'state',
    name: 'State Mission',
    description:
      'A whole State Rural Livelihood Mission. Custom rollout across districts, with export into your existing MIS.',
    price: 'Custom',
    priceDetail: 'Tailored to your mission',
    unitLabel: 'Whole state mission',
    features: [
      'Every district in the state',
      'Dedicated mission account manager',
      'Custom onboarding across districts',
      'Data export for your mission MIS',
      'On-ground training rollout',
      'SLA & data-residency assurances',
    ],
    cta: 'Contact us',
    emailSubject: 'BetterAt — State mission enquiry',
    accentColor: '#B45309',
    iconName: 'flag-outline',
  },
];

const BLOCK_OPTIONS = [1, 5, 10, 25];

function formatINR(n: number): string {
  // Indian grouping: 1,50,000 not 150,000.
  return '₹' + n.toLocaleString('en-IN');
}

export default function GovernmentPricingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [blockCount, setBlockCount] = useState(10);

  const isDesktop = width >= 768;

  const handleSelectPlan = (plan: MissionPlan) => {
    Linking.openURL(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(plan.emailSubject)}`,
    );
  };

  const getDisplayPrice = (plan: MissionPlan) => {
    if (plan.id === 'district') {
      return formatINR(blockCount * 50000);
    }
    return plan.price;
  };

  const getPriceDetail = (plan: MissionPlan) => {
    if (plan.id === 'district') {
      return `/ year for ${blockCount} block${blockCount === 1 ? '' : 's'}`;
    }
    return plan.priceDetail;
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && <ScrollFix />}
      <SimpleLandingNav />

      <View style={[styles.header, { paddingTop: insets.top + 80 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEyebrow}>FOR LIVELIHOOD MISSIONS & DEPARTMENTS</Text>
          <Text style={styles.headerTitle}>Equip your block field staff</Text>
          <Text style={styles.headerSubtitle}>
            Give your CRPs and cluster coordinators the tools to issue blueprints, mentor
            SHG members, and show what your women are actually building — funded centrally
            by the mission. The women themselves are never charged.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.unitSelector}>
          <Text style={styles.unitLabel}>How many blocks in your district?</Text>
          <View style={styles.unitOptions}>
            {BLOCK_OPTIONS.map((count) => (
              <TouchableOpacity
                key={count}
                style={[styles.unitOption, blockCount === count && styles.unitOptionActive]}
                onPress={() => setBlockCount(count)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.unitOptionText,
                    blockCount === count && styles.unitOptionTextActive,
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            {MISSION_PLANS.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  isDesktop && styles.cardDesktop,
                  plan.isPopular && styles.cardHighlighted,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: plan.accentColor + '15' }]}>
                    <Ionicons name={plan.iconName as any} size={24} color={plan.accentColor} />
                  </View>
                  {plan.isPopular && (
                    <View style={[styles.badgePill, { backgroundColor: plan.accentColor + '15' }]}>
                      <Text style={[styles.badgeText, { color: plan.accentColor }]}>
                        MOST COMMON
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardName}>{plan.name}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.priceAmount}>{getDisplayPrice(plan)}</Text>
                </View>
                <Text style={styles.priceDetail}>{getPriceDetail(plan)}</Text>

                <Text style={styles.cardDescription}>{plan.description}</Text>

                <View style={styles.unitInfo}>
                  <Ionicons name="grid-outline" size={16} color={plan.accentColor} />
                  <Text style={styles.unitInfoText}>{plan.unitLabel}</Text>
                </View>

                <View style={[styles.tierBadge, { borderColor: plan.accentColor + '40' }]}>
                  <Ionicons name="people" size={14} color={plan.accentColor} />
                  <Text style={[styles.tierBadgeText, { color: plan.accentColor }]}>
                    SHG members included free
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.featuresList}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color={plan.accentColor} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.ctaButton,
                    plan.isPopular
                      ? { backgroundColor: plan.accentColor }
                      : { borderColor: plan.accentColor + '40' },
                  ]}
                  onPress={() => handleSelectPlan(plan)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.ctaText,
                      plan.isPopular ? styles.ctaTextHighlighted : { color: plan.accentColor },
                    ]}
                  >
                    {plan.cta}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLead}>
            Pricing in INR, billed annually to your mission or department. Beneficiaries — the
            SHG members — are never charged.
          </Text>
          <Text style={styles.footerText}>
            An NGO or SHG federation rather than a government department? Talk to us about
            sponsored access — write to {CONTACT_EMAIL}.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#14281E',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#7FD1A8',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    maxWidth: 640,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  unitSelector: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  unitLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12,
  },
  unitOptions: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  unitOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unitOptionActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as any,
    }),
  },
  unitOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  unitOptionTextActive: {
    color: '#1A1A1A',
  },
  section: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
  },
  sectionDesktop: {
    padding: 40,
  },
  grid: {
    gap: 16,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        cursor: 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  cardDesktop: {
    flex: 1,
    flexBasis: 300,
    maxWidth: 380,
  },
  cardHighlighted: {
    borderColor: '#059669',
    borderWidth: 2,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(5,150,105,0.15)' } as any,
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  priceDetail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  unitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  unitInfoText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  ctaButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    marginTop: 'auto',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctaTextHighlighted: {
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
    maxWidth: 720,
    alignSelf: 'center',
  },
  footerLead: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
  },
});
