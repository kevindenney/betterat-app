import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { IOSDetailNavBar } from '@/components/discover/detail';
import { YachtClubClaimService, type YachtClubOrganization } from '@/services/YachtClubClaimService';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  blue: '#0B63CE',
  red: '#B42318',
  green: '#0F766E',
} as const;

type ClaimVocabulary = {
  eyebrow: string;
  submittedBody: string;
  intro: string;
  roleLabel: string;
  rolePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  evidenceLabel: string;
  evidencePlaceholder: string;
  messagePlaceholder: string;
};

function claimVocabulary(org: YachtClubOrganization | null): ClaimVocabulary {
  const interestSlug = org?.interest_slug ?? null;
  const orgType = org?.organization_type ?? null;

  if (interestSlug === 'nursing' || orgType === 'institution') {
    return {
      eyebrow: 'Institution Claim',
      submittedBody:
        'BetterAt will review this institution claim before marking the organization official or adding institutional admins.',
      intro:
        'Claims are manually reviewed. Approval marks the institution official and adds the claimant as a BetterAt institution admin.',
      roleLabel: 'Institution role',
      rolePlaceholder: 'Program director, faculty lead, administrator',
      emailLabel: 'Official school or work email',
      emailPlaceholder: 'name@school.edu',
      evidenceLabel: 'Verification URL',
      evidencePlaceholder: 'Institution directory, program page, or contact page',
      messagePlaceholder: 'Anything BetterAt should know when reviewing this institution claim',
    };
  }

  if (interestSlug === 'sail-racing' || orgType === 'yacht_club' || orgType === 'club') {
    return {
      eyebrow: 'Yacht Club Claim',
      submittedBody:
        'BetterAt will review your club claim before marking this organization official or adding admins.',
      intro:
        'Claims are manually reviewed. Approval marks the organization official and adds the claimant as a BetterAt org admin.',
      roleLabel: 'Club role',
      rolePlaceholder: 'Commodore, secretary, sailing manager',
      emailLabel: 'Official email',
      emailPlaceholder: 'name@club.org',
      evidenceLabel: 'Verification URL',
      evidencePlaceholder: 'Club staff page or contact page',
      messagePlaceholder: 'Anything BetterAt should know when reviewing this claim',
    };
  }

  return {
    eyebrow: 'Organization Claim',
    submittedBody:
      'BetterAt will review this claim before marking the organization official or adding admins.',
    intro:
      'Claims are manually reviewed. Approval marks the organization official and adds the claimant as a BetterAt org admin.',
    roleLabel: 'Organization role',
    rolePlaceholder: 'Owner, administrator, program lead',
    emailLabel: 'Official email',
    emailPlaceholder: 'name@organization.org',
    evidenceLabel: 'Verification URL',
    evidencePlaceholder: 'Official staff page, directory, or contact page',
    messagePlaceholder: 'Anything BetterAt should know when reviewing this organization claim',
  };
}

export default function ClaimYachtClubPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const { user, signedIn } = useAuth();
  const [org, setOrg] = useState<YachtClubOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [claimantName, setClaimantName] = useState('');
  const [claimantRole, setClaimantRole] = useState('');
  const [email, setEmail] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [message, setMessage] = useState('');
  const vocab = claimVocabulary(org);
  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/organizations/${slug}` as never);
  }, [slug]);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [email, user?.email]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const nextOrg = await YachtClubClaimService.getOrganizationBySlug(slug);
        if (!nextOrg) throw new Error('Organization not found.');
        if (!cancelled) setOrg(nextOrg);
      } catch (error: any) {
        if (!cancelled) setErrorText(error?.message || 'Could not load this organization.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canSubmit =
    !!org?.id &&
    claimantName.trim().length > 1 &&
    claimantRole.trim().length > 1 &&
    email.trim().includes('@') &&
    signedIn &&
    !submitting;

  const submit = async () => {
    if (!org || !canSubmit) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      await YachtClubClaimService.submitClaim({
        organizationId: org.id,
        claimantName,
        claimantRole,
        submittedByEmail: email,
        verificationMethod: evidenceUrl.trim() ? 'official_website_link' : 'manual_admin',
        evidenceUrl,
        claimantMessage: message,
      });
      setSubmitted(true);
    } catch (error: any) {
      setErrorText(error?.message || 'Could not submit this claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: org ? `Claim ${org.name}` : 'Claim organization' }} />
      <IOSDetailNavBar
        backLabel="Organization"
        contextLabel="Claim"
        onBack={handleBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : submitted ? (
          <View style={styles.card}>
            <Ionicons name="checkmark-circle-outline" size={42} color={C.green} />
            <Text style={styles.title}>Claim submitted</Text>
            <Text style={styles.body}>
              {vocab.submittedBody}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.replace(`/organizations/${slug}` as never)}>
              <Text style={styles.secondaryButtonText}>Back to organization</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>{vocab.eyebrow}</Text>
            <Text style={styles.title}>{org?.name || 'Organization'}</Text>
            <Text style={styles.body}>
              {vocab.intro}
            </Text>

            {!signedIn ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>Sign in before submitting a claim.</Text>
                <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/login' as never)}>
                  <Text style={styles.primaryButtonText}>Log in</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Your name</Text>
              <TextInput value={claimantName} onChangeText={setClaimantName} style={styles.input} placeholder="Jane Smith" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{vocab.roleLabel}</Text>
              <TextInput value={claimantRole} onChangeText={setClaimantRole} style={styles.input} placeholder={vocab.rolePlaceholder} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{vocab.emailLabel}</Text>
              <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={vocab.emailPlaceholder} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{vocab.evidenceLabel}</Text>
              <TextInput value={evidenceUrl} onChangeText={setEvidenceUrl} style={styles.input} autoCapitalize="none" placeholder={vocab.evidencePlaceholder} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                style={[styles.input, styles.textarea]}
                multiline
                placeholder={vocab.messagePlaceholder}
              />
            </View>

            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            <View style={styles.buttonRow}>
              <Pressable style={[styles.secondaryButton, styles.rowButton]} onPress={handleBack}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.rowButton, !canSubmit && styles.buttonDisabled]} disabled={!canSubmit} onPress={submit}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Submit claim</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 14 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 18, gap: 14 },
  eyebrow: { color: C.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: C.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  body: { color: C.muted, fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: '#EEF4FF', borderRadius: 8, padding: 12, gap: 10 },
  noticeText: { color: C.ink, fontSize: 14, fontWeight: '700' },
  field: { gap: 6 },
  label: { color: C.ink, fontSize: 14, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11, color: C.ink, backgroundColor: '#FFFFFF', fontSize: 15 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  primaryButton: { alignSelf: 'flex-start', minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blue, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryButtonText: { color: C.ink, fontSize: 15, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  rowButton: { flexGrow: 1, minWidth: 120, alignSelf: 'stretch' },
  buttonDisabled: { opacity: 0.45 },
  error: { color: C.red, fontSize: 14, fontWeight: '700' },
});
