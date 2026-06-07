import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, ExternalLink } from 'lucide-react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

const SUPPORT_EMAIL = 'info@better.at';

const faqs = [
  {
    question: 'What is BetterAt?',
    answer:
      'BetterAt is a learning-and-doing platform for getting better at the things you care about. You add interests (like sail racing, nursing school, or marathon training), plan what to do, do it, and reflect on what you learned — building real, evidence-backed mastery over time.',
  },
  {
    question: 'How do I add an interest?',
    answer:
      'Open the interest switcher at the top of the app and choose "Add interest". Each interest gets its own timeline, plans, and recommendations tailored to that pursuit.',
  },
  {
    question: 'How does the Plan / Do / Review loop work?',
    answer:
      'Plan is where you decide what to work on next. Do is where you carry it out and capture notes, photos, or voice memos in the moment. Review is where you reflect on what happened and see which capabilities you exercised, so each cycle makes the next plan smarter.',
  },
  {
    question: 'How do I join an organization or program?',
    answer:
      'Browse organizations in the Discover and Atlas tabs, or open an invite link from a club, school, or coach. Once you join, any blueprints or cohorts they publish appear in your timeline for you to adopt step by step.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes. You control what you share. Steps and reflections are private to you by default; you choose when to share them with collaborators, a group, or an organization you have joined. We never sell your personal information. See our Privacy Policy at https://better.at/privacy.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'You can request deletion from the app’s Settings screen, or email us at info@better.at. We delete your account and associated personal data within 30 days.',
  },
];

export default function SupportScreen() {
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
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.intro}>
            Need a hand? Reach out and we’ll get back to you as soon as we can.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            style={styles.contactRow}
          >
            <Mail size={20} color={IOS_COLORS.systemBlue} />
            <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
            <ExternalLink size={16} color={IOS_COLORS.tertiaryLabel} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
        {faqs.map((faq) => (
          <View key={faq.question} style={styles.card}>
            <Text style={styles.question}>{faq.question}</Text>
            <Text style={styles.answer}>{faq.answer}</Text>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.question}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Website</Text>
            <Text style={styles.infoValue}>https://better.at</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>iOS, Android, and Web</Text>
          </View>
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
  intro: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginLeft: 12,
    flex: 1,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  answer: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.secondaryLabel,
  },
  infoRow: {
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
  },
  infoValue: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
});
