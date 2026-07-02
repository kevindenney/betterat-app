import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SAILOR_TIERS } from '@/lib/subscriptions/sailorTiers';
import { CLUB_SUBSCRIPTION_PLANS } from '@/services/ClubSubscriptionService';
import { ORG_PLAN_LIST } from '@/lib/subscriptions/orgTiers';

interface PricingSectionProps {
  variant?: 'sailor' | 'coach' | 'club' | 'institution';
}

export function PricingSection({ variant = 'sailor' }: PricingSectionProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 900;

  if (variant === 'coach') {
    return (
      <View id="pricing-section" style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Coaches Pricing</Text>
            <Text style={styles.headerSubtitle}>
              Simple, aligned pricing: we only make money when you do.
            </Text>
          </View>

          <View style={styles.offerCard}>
            <Ionicons name="cash-outline" size={28} color="#8B5CF6" />
            <Text style={styles.offerTitle}>5% platform fee on coaching fees earned</Text>
            <Text style={styles.offerBody}>
              No monthly subscription. BetterAt takes 5% only on sessions paid inside the platform.
            </Text>
            <View style={styles.offerList}>
              <Text style={styles.offerItem}>• Keep 95% of each booking</Text>
              <Text style={styles.offerItem}>• No setup fee</Text>
              <Text style={styles.offerItem}>• Cancel anytime</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push({ pathname: '/(auth)/signup', params: { persona: 'coach' } })}
            >
              <Text style={styles.primaryButtonText}>Start Coaching Free</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'institution') {
    return (
      <View id="pricing-section" style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Institutional Plans</Text>
            <Text style={styles.headerSubtitle}>
              Centralized billing for your students and faculty. Members get access included.
            </Text>
          </View>

          <View style={[styles.cardsRow, isDesktop && styles.cardsRowDesktop]}>
            {ORG_PLAN_LIST.map((plan) => (
              <PricingCard
                key={plan.id}
                title={plan.name}
                price={plan.price}
                sublabel={plan.priceDetail}
                features={plan.features.slice(0, 6)}
                cta={plan.cta}
                featured={plan.isPopular}
                outlined={!plan.isPopular}
                persona="club"
                onPress={() => router.push('/institutions/pricing')}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'club') {
    return (
      <View id="pricing-section" style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Club Plans</Text>
            <Text style={styles.headerSubtitle}>
              Race management tools for clubs of every size.
            </Text>
          </View>

          <View style={[styles.cardsRow, isDesktop && styles.cardsRowDesktop]}>
            {CLUB_SUBSCRIPTION_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                title={plan.name}
                price={`${plan.monthlyPriceFormatted}/mo`}
                sublabel={`or ${plan.annualPriceFormatted}/year · ${plan.annualSavings}`}
                features={plan.features}
                cta={`Choose ${plan.name}`}
                featured={plan.popular}
                outlined={!plan.popular}
                persona="club"
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View id="pricing-section" style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Simple Pricing</Text>
          <Text style={styles.headerSubtitle}>
            Choose the plan that fits your learning goals.
          </Text>
        </View>

        <View style={[styles.cardsRow, isDesktop && styles.cardsRowDesktop]}>
          <PricingCard
            title={SAILOR_TIERS.free.name}
            price="$0"
            sublabel="Get started"
            features={SAILOR_TIERS.free.features.slice(0, 4)}
            cta="Get Started Free"
            outlined
            persona={variant}
          />

          <PricingCard
            title={SAILOR_TIERS.plus.name}
            price={`${SAILOR_TIERS.plus.priceMonthly || '$9'}/mo`}
            sublabel={`or ${SAILOR_TIERS.plus.priceYearly || '$89'}/year`}
            features={SAILOR_TIERS.plus.features.slice(0, 6)}
            cta="Choose Plus"
            outlined
            persona={variant}
          />

          <PricingCard
            title={SAILOR_TIERS.pro.name}
            price={`${SAILOR_TIERS.pro.priceMonthly || '$100'}/mo`}
            sublabel={`or ${SAILOR_TIERS.pro.priceYearly || '$800'}/year`}
            features={SAILOR_TIERS.pro.features}
            cta="Choose Pro"
            featured
            persona={variant}
          />
        </View>
      </View>
    </View>
  );
}

function PricingCard({
  title,
  price,
  sublabel,
  features,
  cta,
  featured,
  outlined,
  persona = 'sailor',
  onPress,
}: {
  title: string;
  price: string;
  sublabel: string;
  features: string[];
  cta: string;
  featured?: boolean;
  outlined?: boolean;
  persona?: 'sailor' | 'coach' | 'club' | 'institution';
  onPress?: () => void;
}) {
  return (
    <View style={[styles.card, featured && styles.cardFeatured]}>
      {featured && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>POPULAR</Text>
        </View>
      )}

      <Text style={[styles.cardTitle, featured && styles.cardTitleFeatured]}>{title}</Text>
      <Text style={[styles.cardPrice, featured && styles.cardPriceFeatured]}>{price}</Text>
      <Text style={styles.cardSublabel}>{sublabel}</Text>

      <View style={styles.featureList}>
        {features.map((item) => (
          <View key={`${title}-${item}`} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#3E92CC" />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.ctaButton, outlined && styles.ctaButtonOutline, featured && styles.ctaButtonFeatured]}
        onPress={onPress || (() => router.push({ pathname: '/(auth)/signup', params: { persona } }))}
      >
        <Text style={[styles.ctaText, outlined && styles.ctaTextOutline]}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 72,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  content: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 17,
    color: '#4B5563',
    textAlign: 'center',
  },
  cardsRow: {
    gap: 16,
    flexDirection: 'column',
  },
  cardsRowDesktop: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
    minHeight: 420,
  },
  cardFeatured: {
    borderColor: '#3E92CC',
    borderWidth: 2,
  },
  badge: {
    alignSelf: 'flex-end',
    backgroundColor: '#3E92CC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  cardTitle: { fontSize: 26, fontWeight: '700', color: '#111827' },
  cardTitleFeatured: { color: '#3E92CC' },
  cardPrice: { fontSize: 42, fontWeight: '800', color: '#111827', marginTop: 8 },
  cardPriceFeatured: { color: '#3E92CC' },
  cardSublabel: { fontSize: 14, color: '#6B7280', marginTop: 2, marginBottom: 14 },
  featureList: { gap: 9, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: '#374151', flex: 1 },
  ctaButton: {
    marginTop: 'auto',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3E92CC',
  },
  ctaButtonOutline: { backgroundColor: '#FFFFFF' },
  ctaButtonFeatured: { backgroundColor: '#3E92CC' },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  ctaTextOutline: { color: '#3E92CC' },
  offerCard: {
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  offerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  offerBody: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    maxWidth: 560,
  },
  offerList: {
    alignSelf: 'stretch',
    marginTop: 6,
    gap: 6,
  },
  offerItem: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#3E92CC',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
