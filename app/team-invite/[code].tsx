/**
 * Team Invite Landing Page
 *
 * Landing page for users who click a team invite link.
 * Shows team info and allows accepting the invite.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { SubscriptionTeamService } from '@/services/SubscriptionTeamService';
import type { SubscriptionTeamInvite } from '@/types/subscriptionTeam';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

export default function TeamInvitePage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { user, isGuest } = useAuth();

  const [invite, setInvite] = useState<SubscriptionTeamInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInviteDetails();
    // loadInviteDetails closes over `code`; keying on code is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const loadInviteDetails = async () => {
    if (!code) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    try {
      const details = await SubscriptionTeamService.getInviteDetails(code);
      if (details) {
        setInvite(details);
      } else {
        setError('This invite link is invalid or has expired');
      }
    } catch (err) {
      setError('Failed to load invite details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user?.id || !code) return;

    setAccepting(true);
    try {
      const result = await SubscriptionTeamService.acceptInvite(code, user.id);
      if (result.success) {
        router.replace('/team-invite/welcome');
      } else {
        setError(result.error || 'Failed to join team');
      }
    } catch (err) {
      setError('Failed to join team');
    } finally {
      setAccepting(false);
    }
  };

  const handleSignUp = () => {
    // Store invite code for after signup
    router.push({
      pathname: '/(auth)/signup',
      params: { inviteCode: code },
    });
  };

  const handleSignIn = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { inviteCode: code },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          <Text style={styles.loadingText}>Loading invite...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !invite) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={64} color={IOS_COLORS.systemRed} />
          </View>
          <Text style={styles.errorTitle}>Invite Not Found</Text>
          <Text style={styles.errorText}>
            {error || 'This invite link is invalid or has expired'}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFull = invite.current_seats >= invite.max_seats;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Team Icon */}
        <View style={styles.teamIcon}>
          <Ionicons name="people" size={48} color="#FFFFFF" />
        </View>

        {/* Invite Text */}
        <Text style={styles.heading}>You're Invited!</Text>
        <Text style={styles.subheading}>
          Join <Text style={styles.teamName}>{invite.team_name}</Text>
        </Text>

        {/* Team Owner Info */}
        <View style={styles.ownerCard}>
          <View style={styles.ownerAvatar}>
            <Text style={styles.ownerInitials}>
              {getInitials(invite.owner_name)}
            </Text>
          </View>
          <View style={styles.ownerInfo}>
            <Text style={styles.ownerName}>{invite.owner_name}</Text>
            <Text style={styles.ownerLabel}>Team Owner</Text>
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>As a team member, you get:</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={IOS_COLORS.systemGreen} />
            <Text style={styles.benefitText}>Unlimited races</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={IOS_COLORS.systemGreen} />
            <Text style={styles.benefitText}>Unlimited queries</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={IOS_COLORS.systemGreen} />
            <Text style={styles.benefitText}>Team collaboration features</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={IOS_COLORS.systemGreen} />
            <Text style={styles.benefitText}>Advanced analytics</Text>
          </View>
        </View>

        {/* Seat Availability */}
        {isFull ? (
          <View style={styles.fullBanner}>
            <Ionicons name="warning" size={20} color={IOS_COLORS.systemOrange} />
            <Text style={styles.fullText}>
              This team is currently full ({invite.max_seats} members)
            </Text>
          </View>
        ) : (
          <Text style={styles.seatsText}>
            {invite.max_seats - invite.current_seats} of {invite.max_seats} seats available
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isGuest ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, isFull && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={isFull}
              >
                <Text style={styles.primaryButtonText}>Sign Up to Join</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSignIn}
              >
                <Text style={styles.secondaryButtonText}>
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isFull || accepting) && styles.buttonDisabled,
              ]}
              onPress={handleAcceptInvite}
              disabled={isFull || accepting}
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Accept Invite</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/\s/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: IOS_SPACING.xl,
  },
  loadingText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.md,
  },
  errorIcon: {
    marginBottom: IOS_SPACING.lg,
  },
  errorTitle: {
    ...IOS_TYPOGRAPHY.title2,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  errorText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOS_SPACING.xl,
  },
  backButton: {
    paddingVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.lg,
  },
  backButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.systemBlue,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xl * 2,
  },
  teamIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: IOS_COLORS.systemBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOS_SPACING.xl,
  },
  heading: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  subheading: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.xl,
  },
  teamName: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    padding: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.lg,
    width: '100%',
    marginBottom: IOS_SPACING.lg,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: IOS_COLORS.systemGray4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: IOS_SPACING.md,
  },
  ownerInitials: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.secondaryLabel,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  ownerLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
  benefitsCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    padding: IOS_SPACING.lg,
    borderRadius: IOS_RADIUS.lg,
    width: '100%',
    marginBottom: IOS_SPACING.lg,
  },
  benefitsTitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.sm,
  },
  benefitText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
  },
  seatsText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.systemBlue,
    marginBottom: IOS_SPACING.xl,
  },
  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.md,
    marginBottom: IOS_SPACING.xl,
    width: '100%',
  },
  fullText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.systemOrange,
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: IOS_SPACING.md,
  },
  primaryButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: IOS_SPACING.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.systemBlue,
  },
  buttonDisabled: {
    backgroundColor: IOS_COLORS.systemGray4,
  },
});
