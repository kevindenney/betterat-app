import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.updated}>Last updated: April 4, 2026</Text>

          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.body}>
            BetterAt ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services. This policy applies to the BetterAt app available on Apple App Store and Google Play Store.
          </Text>

          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.subheading}>Personal Information</Text>
          <Text style={styles.body}>
            • Account information (name, email address){'\n'}
            • Profile information (organization, interests, goals){'\n'}
            • Location data (for venue intelligence and weather services){'\n'}
            • Activity and progress data (timeline steps, plans, reflections)
          </Text>

          <Text style={styles.subheading}>Authentication Data</Text>
          <Text style={styles.body}>
            If you sign in using Google or Apple, we receive basic profile information (such as your name and email) as provided by those services. We do not receive or store your Google or Apple password.
          </Text>

          <Text style={styles.subheading}>Automatically Collected Information</Text>
          <Text style={styles.body}>
            • Device information (device type, operating system){'\n'}
            • Usage data (features used, session duration){'\n'}
            • Log data (access times, pages viewed)
          </Text>

          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.body}>
            • Provide and maintain our services{'\n'}
            • Create and manage your account{'\n'}
            • Deliver personalized planning and coaching features{'\n'}
            • Power AI-assisted features (chat, recommendations, assessments){'\n'}
            • Send notifications about activities and events{'\n'}
            • Improve and personalize user experience{'\n'}
            • Process payments for premium features{'\n'}
            • Communicate updates and support
          </Text>

          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.body}>
            Our app uses the following third-party services:{'\n\n'}
            • Supabase — for authentication, data storage, and backend services (supabase.com/privacy){'\n'}
            • Stripe — for payment processing (stripe.com/privacy){'\n'}
            • Google Maps — to display locations and venue information (policies.google.com/privacy){'\n'}
            • Anthropic (Claude AI) — for AI-powered features; your conversations may be processed by Anthropic's API (anthropic.com/privacy){'\n'}
            • Google AI — for AI-powered features (policies.google.com/privacy){'\n'}
            • Apple Sign-In — for authentication (apple.com/legal/privacy){'\n'}
            • Google Sign-In — for authentication (policies.google.com/privacy)
          </Text>

          <Text style={styles.sectionTitle}>Data Sharing</Text>
          <Text style={styles.body}>
            We may share your information with:{'\n'}
            • Organizations you join (for program management){'\n'}
            • Collaborators you invite to shared plans{'\n'}
            • Service providers (cloud hosting, payment processing, analytics){'\n'}
            • Legal authorities (when required by law){'\n\n'}
            We do not sell your personal information to third parties.
          </Text>

          <Text style={styles.sectionTitle}>Data Security</Text>
          <Text style={styles.body}>
            We implement industry-standard security measures to protect your data, including encryption in transit and at rest, secure authentication, and regular security audits. Your data is stored securely using Supabase, which is hosted on cloud infrastructure with enterprise-grade security.
          </Text>

          <Text style={styles.sectionTitle}>Data Retention</Text>
          <Text style={styles.body}>
            We retain your personal information for as long as your account is active or as needed to provide you with our services. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it by law.
          </Text>

          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.body}>
            You have the right to:{'\n'}
            • Access your personal data{'\n'}
            • Correct inaccurate data{'\n'}
            • Request deletion of your data{'\n'}
            • Opt-out of marketing communications{'\n'}
            • Export your data{'\n'}
            • Withdraw consent for data processing at any time
          </Text>

          <Text style={styles.sectionTitle}>Account Deletion</Text>
          <Text style={styles.body}>
            You can request deletion of your account and all associated personal data at any time through the app's Settings screen or by contacting us at info@better.at. Upon receiving your request, we will delete your account and personal data within 30 days.
          </Text>

          <Text style={styles.sectionTitle}>Location Data</Text>
          <Text style={styles.body}>
            We collect location data to provide venue intelligence, weather forecasts, and tide information relevant to your location. Location data is only collected when the app is in use and you have granted permission. You can disable location services at any time in your device settings.
          </Text>

          <Text style={styles.sectionTitle}>California Residents (CCPA)</Text>
          <Text style={styles.body}>
            If you are a California resident, you have the right to: know what personal data we collect, request deletion of your data, and opt out of any sale of personal data. We do not sell personal data. To exercise these rights, contact us at info@better.at.
          </Text>

          <Text style={styles.sectionTitle}>European Users (GDPR)</Text>
          <Text style={styles.body}>
            If you are located in the European Economic Area, we process your personal data based on your consent, contractual necessity, and our legitimate interests. You have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data. To exercise these rights, contact us at info@better.at.
          </Text>

          <Text style={styles.sectionTitle}>Children's Privacy</Text>
          <Text style={styles.body}>
            Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete that information promptly.
          </Text>

          <Text style={styles.sectionTitle}>Changes to This Policy</Text>
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy within the app and updating the "Last updated" date above.
          </Text>

          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.body}>
            If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:{'\n\n'}
            Email: info@better.at{'\n'}
            Website: https://better.at
          </Text>
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
  subheading: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
});
