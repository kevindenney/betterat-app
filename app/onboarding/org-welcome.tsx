/**
 * Org Welcome Screen
 *
 * Shown after trial-activation for users who signed up from an org page.
 * Auto-joins the org, shows join status, and offers blueprint subscription.
 *
 * For post-approval flows (notification tap), use /org-welcome-modal instead.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import {
  organizationDiscoveryService,
  type RequestJoinResult,
} from '@/services/OrganizationDiscoveryService';
import { useOrganizationBlueprints } from '@/hooks/useBlueprint';
import { BlueprintPickerCard } from '@/components/onboarding/BlueprintPickerCard';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { useInterest } from '@/providers/InterestProvider';
import { useOrgPeers } from '@/hooks/useOrgPeers';
import { useAuth } from '@/providers/AuthProvider';
import { getOrCreateManifesto, updateManifesto, parseManifestoWithAI } from '@/services/ManifestoService';

interface OrgOnboardingConfig {
  welcome_message?: string;
  key_links?: { label: string; url: string }[];
  orientation_text?: string;
}

type JoinPhase = 'loading' | 'joined' | 'pending' | 'blocked' | 'error';

// Interests whose `app/<slug>/[orgSlug].tsx` route exists today. When the user
// arrives here via the /invite/[token] flow (issue #11) and the org's interest
// is in this set, the Continue button takes them straight to the org-catalog
// page that blends real + sample timelines. Otherwise we fall back to the
// races tab so the user never lands on a 404.
const INTERESTS_WITH_ORG_CATALOG = new Set<string>([
  'design',
  'drawing',
  'fiber-arts',
  'fitness',
  'global-health',
  'golf',
  'health-and-fitness',
  'knitting',
  'lifelong-learning',
  'nursing',
  'painting-printing',
  'regenerative-agriculture',
  'sail-racing',
]);

export default function OrgWelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromInvite?: string }>();
  const fromInvite = params.fromInvite === '1';
  const { user } = useAuth();
  const { addInterest, switchInterest, currentInterest } = useInterest();

  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [interestSlug, setInterestSlug] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [onboardingConfig, setOnboardingConfig] = useState<OrgOnboardingConfig | null>(null);
  const [phase, setPhase] = useState<JoinPhase>('loading');
  const [message, setMessage] = useState('');

  // Manifesto state
  const [manifestoText, setManifestoText] = useState('');
  const [manifestoId, setManifestoId] = useState<string | null>(null);
  const manifestoParseTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: orgBlueprints } = useOrganizationBlueprints(
    phase === 'joined' || phase === 'pending' ? orgId : null,
  );
  const publishedBlueprints = orgBlueprints?.filter((bp) => bp.is_published) ?? [];

  const { data: peers } = useOrgPeers(
    phase === 'joined' || phase === 'pending' ? orgId : null,
    { limit: 5 },
  );

  const ctx = getOnboardingContext(interestSlug || undefined);

  useEffect(() => {
    initAndJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initAndJoin = async () => {
    try {
      const [slug, interest] = await Promise.all([
        AsyncStorage.getItem('onboarding_org_slug'),
        AsyncStorage.getItem('onboarding_interest_slug'),
      ]);
      setOrgSlug(slug);
      setInterestSlug(interest);

      if (!slug) {
        setPhase('error');
        setMessage('No organization context found.');
        return;
      }

      // Look up org by slug
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name, slug, join_mode, interest_slug')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (orgErr || !org) {
        setPhase('error');
        setMessage('Could not find this organization. You can join later from the app.');
        return;
      }

      setOrgName(org.name);
      setOrgId(org.id);

      // Fetch onboarding_config separately (column may not exist yet)
      try {
        const { data: configRow } = await supabase
          .from('organizations')
          .select('onboarding_config')
          .eq('id', org.id)
          .maybeSingle();
        if (configRow?.onboarding_config) {
          setOnboardingConfig(configRow.onboarding_config as OrgOnboardingConfig);
        }
      } catch {
        // Column may not exist yet — non-critical
      }

      // Auto-switch interest (non-blocking)
      const orgInterest = org.interest_slug || interest;
      if (orgInterest) {
        try {
          await addInterest(orgInterest);
          await switchInterest(orgInterest);
        } catch {
          // Non-critical
        }
      }

      // Auto-join
      const result: RequestJoinResult = await organizationDiscoveryService.requestJoin({
        orgId: org.id,
        mode: org.join_mode || 'invite_only',
      });

      if (result.status === 'active' || result.status === 'existing') {
        setPhase('joined');
        setMessage(result.status === 'existing' ? 'You\'re already a member!' : `You've joined ${org.name}!`);
      } else if (result.status === 'pending') {
        setPhase('pending');
        setMessage(`Your request to join ${org.name} has been sent. An admin will review it.`);
      } else {
        setPhase('blocked');
        setMessage(`${org.name} requires an invitation to join. You can request one from a member.`);
      }
    } catch (err: any) {
      console.error('[OrgWelcome] Error:', err);
      setPhase('error');
      setMessage(err?.message || 'Something went wrong. You can join this organization later.');
    }
  };

  // Initialize manifesto when join succeeds and interest is known
  useEffect(() => {
    if ((phase === 'joined' || phase === 'pending') && user?.id && currentInterest?.id) {
      getOrCreateManifesto(user.id, currentInterest.id)
        .then((m) => {
          setManifestoId(m.id);
          if (m.content?.trim()) setManifestoText(m.content);
        })
        .catch(() => {});
    }
  }, [phase, user?.id, currentInterest?.id]);

  const handleManifestoChange = useCallback(
    (text: string) => {
      setManifestoText(text);
      // Auto-save with debounce
      if (manifestoParseTimer.current) clearTimeout(manifestoParseTimer.current);
      manifestoParseTimer.current = setTimeout(async () => {
        if (!manifestoId || !text.trim()) return;
        try {
          const extracted = await parseManifestoWithAI(text, currentInterest?.name || 'this interest');
          await updateManifesto(manifestoId, {
            content: text,
            philosophies: extracted.philosophies,
            role_models: extracted.role_models,
            weekly_cadence: extracted.weekly_cadence,
          });
        } catch {
          // Save content only
          await updateManifesto(manifestoId, { content: text }).catch(() => {});
        }
      }, 2000);
    },
    [manifestoId, currentInterest?.name],
  );

  const handleContinue = useCallback(async () => {
    // Save manifesto content before navigating (if entered)
    if (manifestoId && manifestoText.trim()) {
      await updateManifesto(manifestoId, { content: manifestoText }).catch(() => {});
    }

    // Invite flow: route into the org catalog (programs + people + sample timelines)
    // when one exists for this interest; otherwise drop the user onto their timeline.
    if (fromInvite) {
      if (interestSlug && orgSlug && INTERESTS_WITH_ORG_CATALOG.has(interestSlug)) {
        router.replace(`/${interestSlug}/${orgSlug}` as any);
        return;
      }
      router.replace('/(tabs)/races' as any);
      return;
    }

    router.replace('/onboarding/explore-interests');
  }, [router, manifestoId, manifestoText, fromInvite, interestSlug, orgSlug]);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={ctx.color} />
          <Text style={styles.loadingText}>Setting up your organization...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const icon: keyof typeof Ionicons.glyphMap =
    phase === 'joined' ? 'checkmark-circle' :
    phase === 'pending' ? 'time' :
    phase === 'blocked' ? 'lock-closed' :
    'alert-circle';

  const iconColor =
    phase === 'joined' ? '#16A34A' :
    phase === 'pending' ? '#D97706' :
    phase === 'blocked' ? '#64748B' :
    '#DC2626';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: iconColor + '15' }]}>
            <Ionicons name={icon} size={56} color={iconColor} />
          </View>

          <Text style={styles.title}>
            {phase === 'joined'
              ? `Welcome to ${orgName}!`
              : phase === 'pending'
                ? 'Request Sent'
                : orgName || 'Organization'}
          </Text>

          <Text style={styles.description}>{message}</Text>

          {/* Org custom welcome message */}
          {onboardingConfig?.welcome_message && (
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeMessage}>{onboardingConfig.welcome_message}</Text>
              {onboardingConfig.key_links && onboardingConfig.key_links.length > 0 && (
                <View style={styles.keyLinks}>
                  {onboardingConfig.key_links.map((link, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.keyLinkRow}
                      onPress={() => Linking.openURL(link.url)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="link" size={14} color={ctx.color} />
                      <Text style={[styles.keyLinkText, { color: ctx.color }]}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* People you might know */}
          {peers && peers.length > 0 && (
            <View style={styles.peersSection}>
              <Text style={styles.sectionLabel}>
                People already here
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peersRow}
              >
                {peers.map((peer) => (
                  <TouchableOpacity
                    key={peer.id}
                    style={styles.peerCard}
                    onPress={() => router.push(`/person/${peer.id}`)}
                    activeOpacity={0.7}
                  >
                    {peer.avatar_url ? (
                      <Image source={{ uri: peer.avatar_url }} style={styles.peerAvatar} />
                    ) : (
                      <View style={[styles.peerAvatarPlaceholder, { backgroundColor: ctx.color + '20' }]}>
                        <Ionicons name="person" size={18} color={ctx.color} />
                      </View>
                    )}
                    <Text style={styles.peerName} numberOfLines={1}>
                      {peer.full_name || 'Member'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Blueprint picker for joined/pending users */}
          {(phase === 'joined' || phase === 'pending') && publishedBlueprints.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                {phase === 'joined'
                  ? 'Subscribe to pathways to add steps to your timeline:'
                  : 'Available pathways (subscribe after approval):'}
              </Text>
              <View style={styles.blueprintList}>
                {publishedBlueprints.map((bp) => (
                  <BlueprintPickerCard
                    key={bp.id}
                    blueprint={bp}
                    accentColor={ctx.color}
                  />
                ))}
              </View>
            </>
          )}

          {/* Manifesto — "What's your vision?" */}
          {(phase === 'joined' || phase === 'pending') && (
            <View style={styles.manifestoSection}>
              <Text style={styles.sectionLabel}>
                What are you trying to achieve?
              </Text>
              <Text style={styles.manifestoHint}>
                Share your goals for {currentInterest?.name || 'this program'}. You can always update this later.
              </Text>
              <TextInput
                style={styles.manifestoInput}
                value={manifestoText}
                onChangeText={handleManifestoChange}
                placeholder={`E.g., "I want to master clinical assessment skills and build confidence with patient interactions..."`}
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Next step guidance */}
          {(phase === 'joined' || phase === 'pending') && (
            <View style={[styles.guidanceCard, { backgroundColor: ctx.color + '08' }]}>
              <Ionicons name="bulb-outline" size={18} color={ctx.color} />
              <Text style={styles.guidanceText}>
                {onboardingConfig?.orientation_text ||
                  (publishedBlueprints.length > 0
                    ? 'Subscribe to a pathway above, then open your timeline to see your first steps.'
                    : 'After continuing, explore your timeline and add your first steps.')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: ctx.color }]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 12,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  blueprintList: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  continueButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  welcomeCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  welcomeMessage: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  keyLinks: {
    marginTop: 12,
    gap: 8,
  },
  keyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keyLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  peersSection: {
    width: '100%',
    marginBottom: 20,
  },
  peersRow: {
    gap: 12,
    paddingVertical: 4,
  },
  peerCard: {
    alignItems: 'center',
    width: 64,
  },
  peerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  peerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  peerName: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  manifestoSection: {
    width: '100%',
    marginBottom: 20,
  },
  manifestoHint: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 10,
  },
  manifestoInput: {
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    minHeight: 120,
    lineHeight: 22,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
  guidanceCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  guidanceText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});
