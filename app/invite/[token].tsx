/**
 * Invite Acceptance Page
 *
 * Landing page for users who click an organization invite link.
 * Shows org info and allows accepting/declining the invite.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  organizationInviteService,
  type OrganizationInviteRecord,
} from '@/services/OrganizationInviteService';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { supabase } from '@/services/supabase';
import { NotificationService } from '@/services/NotificationService';
import { useOrganizationBlueprints } from '@/hooks/useBlueprint';
import { BlueprintPickerCard } from '@/components/onboarding/BlueprintPickerCard';

/** Role keys that indicate an admin-level org role */
const ADMIN_ROLE_KEYS = new Set([
  'dean', 'program-director', 'department-chair',
  'commodore', 'race-officer', 'fleet-captain',
  'owner', 'admin', 'manager',
]);

/** Role keys that indicate a faculty/instructor content-creator role */
const FACULTY_ROLE_KEYS = new Set([
  'faculty', 'instructor', 'lead-instructor', 'clinical-instructor',
  'preceptor', 'evaluator', 'workshop-leader', 'master-printer',
  'head-grower', 'head-chef', 'lead-facilitator', 'pattern-designer',
  'teaching-professional', 'head-professional', 'head-trainer',
  'personal-trainer', 'studio-director', 'guild-master',
]);

export default function InviteTokenPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { userInterests, switchInterest, addInterest } = useInterest();

  const [invite, setInvite] = useState<OrganizationInviteRecord | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<'welcome' | 'blueprints' | 'done'>('welcome');

  // Fetch org blueprints for the post-accept picker
  const { data: orgBlueprints } = useOrganizationBlueprints(
    accepted ? invite?.organization_id : null,
  );
  const publishedBlueprints = orgBlueprints?.filter((bp) => bp.is_published) ?? [];

  useEffect(() => {
    loadInviteDetails();
    // loadInviteDetails reads only `token`; adding it as a dep would cause
    // an infinite refetch loop since it's redeclared each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInviteDetails = async () => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    try {
      const inviteData = await organizationInviteService.getInviteByToken(token);
      if (!inviteData) {
        setError('This invite link is invalid or has expired');
        setLoading(false);
        return;
      }

      setInvite(inviteData);

      // Mark as opened
      try {
        await organizationInviteService.markInviteOpenedByToken(token);
      } catch {
        // Non-critical
      }

      // Fetch org name
      if (inviteData.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name,interest_slug')
          .eq('id', inviteData.organization_id)
          .single();
        if (org) {
          setOrgName(org.name);
          setOrgInterestSlug(org.interest_slug || null);
        }
      }

      // Fetch program name if invite has a program
      if (inviteData.program_id) {
        const { data: prog } = await supabase
          .from('programs')
          .select('title')
          .eq('id', inviteData.program_id)
          .single();
        if (prog?.title) {
          setProgramName(prog.title);
        }
      }

      // Fetch inviter name
      if (inviteData.invited_by) {
        const { data: inviter } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', inviteData.invited_by)
          .single();
        if (inviter?.full_name) {
          setInviterName(inviter.full_name);
        }
      }
    } catch (err) {
      setError('Failed to load invite details');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    setResponding(true);
    try {
      await organizationInviteService.acceptInviteTokenForCurrentUser(token);
      setAccepted(true);

      // Auto-switch interest to the org's interest (non-blocking)
      if (orgInterestSlug) {
        try {
          const isHidden = !userInterests.some((i) => i.slug === orgInterestSlug);
          if (isHidden) await addInterest(orgInterestSlug);
          await switchInterest(orgInterestSlug);
        } catch {
          // Non-critical — don't block the accept flow
        }
      }

      // Notify the inviter that their invite was accepted (non-blocking)
      if (invite?.invited_by && user) {
        try {
          const { data: accepterProfile } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single();
          await NotificationService.notifyOrgInviteAccepted({
            inviterId: invite.invited_by,
            accepterName: accepterProfile?.full_name || user.email || 'Someone',
            accepterId: user.id,
            organizationId: invite.organization_id,
            organizationName: orgName || 'your organization',
            roleLabel: invite.role_label || 'Member',
          });
        } catch {
          // Non-critical — don't block the accept flow
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invite');
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    // Send signed-in users straight to their main tab, guests to the landing
    // page — skips the AuthGate flicker that happens when navigating to `/`.
    const destination: Parameters<typeof router.replace>[0] = isGuest
      ? '/'
      : ('/(tabs)/races' as any);

    if (!token) {
      router.replace(destination);
      return;
    }
    setResponding(true);
    // Best-effort: try to record the decline, but always navigate the user
    // away so they aren't stranded on an error banner (e.g. when the
    // signed-in account doesn't match the invitee email).
    try {
      await organizationInviteService.declineInviteByTokenForCurrentUser(token);
    } catch {
      // Swallow — user intent is to leave this screen, not retry.
    } finally {
      setResponding(false);
      router.replace(destination);
    }
  };

  const handleSignUp = () => {
    router.push({
      pathname: '/(auth)/signup',
      params: {
        inviteToken: token,
        ...(orgInterestSlug ? { interest: orgInterestSlug } : {}),
      },
    });
  };

  const handleSignIn = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { inviteToken: token },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading invite...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !invite) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={64} color="#DC2626" />
          </View>
          <Text style={styles.errorTitle}>Invite Not Found</Text>
          <Text style={styles.errorText}>
            {error || 'This invite link is invalid or has expired'}
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Accepted state — multi-step welcome flow
  if (accepted) {
    const ctx = getOnboardingContext(orgInterestSlug || undefined);
    const roleKey = (invite?.role_key || '').toLowerCase();
    const isAdminRole = ADMIN_ROLE_KEYS.has(roleKey);
    const isFacultyRole = FACULTY_ROLE_KEYS.has(roleKey);

    const handleFinalNav = () => {
      if (isAdminRole) {
        router.replace('/organization/members' as any);
      } else {
        router.replace('/(tabs)/races' as any);
      }
    };

    const handleGoToTimeline = () => {
      router.replace('/(tabs)/races' as any);
    };

    const handlePostAcceptNav = () => {
      if (isAdminRole) {
        router.replace('/organization/members' as any);
      } else if (isFacultyRole) {
        setWelcomeStep('blueprints');
      } else if (publishedBlueprints.length > 0) {
        setWelcomeStep('blueprints');
      } else if (orgInterestSlug) {
        router.replace(`/${orgInterestSlug}` as any);
      } else {
        router.replace('/(tabs)/races' as any);
      }
    };

    const programSuffix = programName ? ` for the ${programName} program` : '';
    const successDescription = isAdminRole
      ? `You've been added as ${invite?.role_label || 'an admin'}. You can now manage members, programs, and organization settings.`
      : isFacultyRole
        ? `You've been added as ${invite?.role_label || 'Faculty'}${programSuffix}. You can create learning pathways that students subscribe to and follow step-by-step.`
        : `You've been added as ${invite?.role_label || 'a member'}${programSuffix}. You can now access the organization's content and programs.`;

    // Step: Faculty blueprint guidance / member blueprint picker
    if (welcomeStep === 'blueprints') {
      if (isFacultyRole) {
        // Faculty-specific: guide them to create a blueprint
        return (
          <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.content}>
                <View style={[styles.successIcon, orgInterestSlug ? { backgroundColor: ctx.color + '18' } : undefined]}>
                  <Ionicons name="create-outline" size={48} color={orgInterestSlug ? ctx.color : '#2563EB'} />
                </View>
                <Text style={styles.successTitle}>
                  {programName ? `Create Your ${programName} Blueprint` : 'Create a Blueprint'}
                </Text>
                <Text style={styles.successText}>
                  As {invite?.role_label || 'Faculty'} at {orgName || 'the organization'}{programName ? ` for ${programName}` : ''}, you can build a structured timeline of steps for students to follow.
                </Text>

                {/* How it works explanation */}
                <View style={styles.guidanceCard}>
                  <View style={styles.guidanceStep}>
                    <View style={[styles.guidanceStepNumber, { backgroundColor: (orgInterestSlug ? ctx.color : '#2563EB') + '18' }]}>
                      <Text style={[styles.guidanceStepNumberText, { color: orgInterestSlug ? ctx.color : '#2563EB' }]}>1</Text>
                    </View>
                    <View style={styles.guidanceStepContent}>
                      <Text style={styles.guidanceStepTitle}>Build your timeline</Text>
                      <Text style={styles.guidanceStepDesc}>Add steps with resources, dates, and descriptions that guide students through the program.</Text>
                    </View>
                  </View>
                  <View style={styles.guidanceStep}>
                    <View style={[styles.guidanceStepNumber, { backgroundColor: (orgInterestSlug ? ctx.color : '#2563EB') + '18' }]}>
                      <Text style={[styles.guidanceStepNumberText, { color: orgInterestSlug ? ctx.color : '#2563EB' }]}>2</Text>
                    </View>
                    <View style={styles.guidanceStepContent}>
                      <Text style={styles.guidanceStepTitle}>Publish as a blueprint</Text>
                      <Text style={styles.guidanceStepDesc}>Use the "Publish as Blueprint" option to make your timeline subscribable under {orgName || 'the organization'}.</Text>
                    </View>
                  </View>
                  <View style={styles.guidanceStep}>
                    <View style={[styles.guidanceStepNumber, { backgroundColor: (orgInterestSlug ? ctx.color : '#2563EB') + '18' }]}>
                      <Text style={[styles.guidanceStepNumberText, { color: orgInterestSlug ? ctx.color : '#2563EB' }]}>3</Text>
                    </View>
                    <View style={styles.guidanceStepContent}>
                      <Text style={styles.guidanceStepTitle}>Students subscribe &amp; follow</Text>
                      <Text style={styles.guidanceStepDesc}>Students get your steps on their own timeline and receive updates as you add new content.</Text>
                    </View>
                  </View>
                </View>

                {/* Show existing blueprints if any */}
                {publishedBlueprints.length > 0 && (
                  <>
                    <Text style={styles.existingBlueprintsLabel}>
                      Existing programs at {orgName || 'the organization'}:
                    </Text>
                    <View style={styles.blueprintList}>
                      {publishedBlueprints.map((bp) => (
                        <BlueprintPickerCard
                          key={bp.id}
                          blueprint={bp}
                          accentColor={orgInterestSlug ? ctx.color : '#2563EB'}
                        />
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: orgInterestSlug ? ctx.color : '#2563EB' }]}
                    onPress={handleGoToTimeline}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryButtonText}>Start Building Your Timeline</Text>
                  </TouchableOpacity>
                  {orgInterestSlug && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace(`/${orgInterestSlug}` as any)}>
                      <Text style={styles.secondaryButtonText}>Browse {ctx.interestName} Catalog</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        );
      }

      // Non-faculty: existing blueprint picker for members/students
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              <View style={[styles.successIcon, orgInterestSlug ? { backgroundColor: ctx.color + '18' } : undefined]}>
                <Ionicons name="layers-outline" size={48} color={orgInterestSlug ? ctx.color : '#2563EB'} />
              </View>
              <Text style={styles.successTitle}>Choose Your Pathways</Text>
              <Text style={styles.successText}>
                Subscribe to programs from {orgName || 'the organization'} to add their steps to your timeline.
              </Text>

              <View style={styles.blueprintList}>
                {publishedBlueprints.map((bp) => (
                  <BlueprintPickerCard
                    key={bp.id}
                    blueprint={bp}
                    accentColor={orgInterestSlug ? ctx.color : '#2563EB'}
                  />
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: orgInterestSlug ? ctx.color : '#2563EB' }]} onPress={handleFinalNav}>
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleFinalNav}>
                  <Text style={styles.secondaryButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Step: Welcome (default)
    const ctaLabel = isAdminRole
      ? 'Go to Management'
      : isFacultyRole
        ? 'Get Started'
        : publishedBlueprints.length > 0
          ? 'Choose Your Pathways'
          : orgInterestSlug
            ? `Explore ${ctx.interestName}`
            : 'Go to Dashboard';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.successIcon, orgInterestSlug ? { backgroundColor: ctx.color + '18' } : undefined]}>
            <Ionicons name="checkmark-circle" size={64} color={orgInterestSlug ? ctx.color : '#16A34A'} />
          </View>
          <Text style={styles.successTitle}>Welcome to {orgName || 'the organization'}!</Text>
          {invite?.role_label && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{invite.role_label}</Text>
            </View>
          )}
          <Text style={styles.successText}>{successDescription}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, orgInterestSlug ? { backgroundColor: ctx.color } : undefined]}
            onPress={handlePostAcceptNav}
          >
            <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAlreadyResponded = invite?.status === 'accepted' || invite?.status === 'declined';
  const ctx = getOnboardingContext(orgInterestSlug || undefined);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Org Icon */}
          <View style={[styles.orgIcon, { backgroundColor: orgInterestSlug ? ctx.color : '#2563EB' }]}>
            <Ionicons name="business" size={48} color="#FFFFFF" />
          </View>

          {/* Invite Text */}
          <Text style={styles.heading}>You're Invited!</Text>
          <Text style={styles.subheading}>
            Join <Text style={styles.orgName}>{orgName || 'an organization'}</Text>
          </Text>

          {/* Interest Badge */}
          {orgInterestSlug && (
            <View style={[styles.interestBadge, { backgroundColor: ctx.color + '18', borderColor: ctx.color + '40' }]}>
              <Text style={[styles.interestBadgeText, { color: ctx.color }]}>
                {ctx.interestName}
              </Text>
            </View>
          )}

          {/* Invite Details Card */}
          <View style={styles.detailsCard}>
            {invite?.role_label && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Role</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{invite.role_label}</Text>
                </View>
              </View>
            )}
            {inviterName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invited by</Text>
                <Text style={styles.detailValue}>{inviterName}</Text>
              </View>
            )}
            {programName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Program</Text>
                <Text style={styles.detailValue}>{programName}</Text>
              </View>
            )}
            {invite?.invitee_email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>For</Text>
                <Text style={styles.detailValue}>{invite.invitee_email}</Text>
              </View>
            )}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Actions */}
          {isAlreadyResponded ? (
            <View style={styles.actions}>
              <View style={styles.respondedBanner}>
                <Ionicons
                  name={invite?.status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={invite?.status === 'accepted' ? '#16A34A' : '#DC2626'}
                />
                <Text style={styles.respondedText}>
                  This invite has already been {invite?.status}.
                </Text>
              </View>
              {invite?.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.primaryButton, orgInterestSlug ? { backgroundColor: ctx.color } : undefined]}
                  onPress={() => {
                    if (orgInterestSlug) {
                      router.replace('/(tabs)/races' as any);
                    } else {
                      router.replace('/');
                    }
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    {orgInterestSlug ? `Go to ${ctx.interestName}` : 'Go to Dashboard'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : isGuest ? (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp}>
                <Text style={styles.primaryButtonText}>Sign Up to Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSignIn}>
                <Text style={styles.secondaryButtonText}>
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryButton, responding && styles.buttonDisabled]}
                onPress={handleAccept}
                disabled={responding}
              >
                {responding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Accept Invite</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineButton, responding && styles.buttonDisabled]}
                onPress={handleDecline}
                disabled={responding}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  loadingText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 12,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  orgIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 18,
    color: '#64748B',
    marginBottom: 12,
  },
  orgName: {
    color: '#2563EB',
    fontWeight: '600',
  },
  interestBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 20,
  },
  interestBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  errorBanner: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  respondedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 14,
    width: '100%',
  },
  respondedText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '500',
  },
  declineButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  declineButtonText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Blueprint picker
  blueprintList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },

  // Faculty guidance card
  guidanceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    gap: 20,
    marginBottom: 24,
  },
  guidanceStep: {
    flexDirection: 'row',
    gap: 12,
  },
  guidanceStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guidanceStepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  guidanceStepContent: {
    flex: 1,
  },
  guidanceStepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  guidanceStepDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  existingBlueprintsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
});
