import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={IOS_COLORS.label} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.updated}>Last updated: February 1, 2026</Text>

          <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
          <Text style={styles.body}>
            By using BetterAt, you agree to these terms and our privacy policy. If you do not
            agree, stop using the service.
          </Text>

          <Text style={styles.sectionTitle}>Service Description</Text>
          <Text style={styles.body}>
            BetterAt provides learning, planning, coaching, and progress-tracking tools across the
            interests you pursue. Features may evolve over time.
          </Text>

          <Text style={styles.sectionTitle}>Accounts and Security</Text>
          <Text style={styles.body}>
            You are responsible for account credentials and activity under your account. You must
            provide accurate profile details.
          </Text>

          <Text style={styles.sectionTitle}>User Content</Text>
          <Text style={styles.body}>
            You retain ownership of your uploaded data. You grant us a limited license to host and
            process content needed to operate the product.
          </Text>

          <Text style={styles.sectionTitle}>Acceptable Use</Text>
          <Text style={styles.body}>
            Do not misuse the service, interfere with operations, scrape unauthorized data, or
            violate applicable laws.
          </Text>

          <Text style={styles.sectionTitle}>Payments and Subscriptions</Text>
          <Text style={styles.body}>
            Paid features renew per your selected plan unless canceled. Taxes and payment terms are
            shown at checkout.
          </Text>

          <Text style={styles.sectionTitle}>Availability and Changes</Text>
          <Text style={styles.body}>
            We may modify or discontinue features, and we may update these terms. Material changes
            will be reflected by an updated date.
          </Text>

          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.body}>
            BetterAt is provided as-is to the extent permitted by law. We are not liable for
            indirect or consequential damages.
          </Text>

          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.body}>Questions about these terms: info@better.at</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  updated: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
});
