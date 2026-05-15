/**
 * OrgAdminOnboardingCard — top-of-dashboard welcome card for new org admins.
 *
 * Renders the canonical "Welcome to Org Admin" card from
 * docs/redesign/ios-register/jhu-admin-dashboard-canonical.html. Presentational
 * only: the parent owns flag gating, dismissal persistence, and tour routing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface OrgAdminOnboardingCardProps {
  adminName?: string | null;
  organizationName?: string | null;
  onTakeTour: () => void;
  onDismiss: () => void;
}

export function OrgAdminOnboardingCard({
  adminName,
  onTakeTour,
  onDismiss,
}: OrgAdminOnboardingCardProps) {
  const greetingName = adminName?.trim() || '';
  const title = greetingName
    ? `Welcome, ${greetingName}. Here’s a quick tour of your dashboard.`
    : 'Welcome. Here’s a quick tour of your dashboard.';

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.iconTile}>
        <Ionicons name="trail-sign-outline" size={20} color="#FFFFFF" />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>WELCOME TO ORG ADMIN</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.bodyText}>
          Four minutes covers the roster, cohort setup, capability mapping, and how
          invitations and clinical-site approvals flow.
        </Text>
        <View style={styles.progressDots} accessibilityElementsHidden>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onDismiss}
          style={styles.btnGhost}
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
          testID="org-admin-onboarding-maybe-later"
        >
          <Text style={styles.btnGhostText}>Maybe later</Text>
        </Pressable>
        <Pressable
          onPress={onTakeTour}
          style={styles.btnPrimary}
          accessibilityRole="button"
          accessibilityLabel="Take the tour"
          testID="org-admin-onboarding-take-tour"
        >
          <Text style={styles.btnPrimaryText}>Take the tour →</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onDismiss}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss onboarding card"
        testID="org-admin-onboarding-dismiss"
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color="#94A3B8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 18,
    paddingHorizontal: 22,
    paddingRight: 44,
    borderRadius: 14,
    backgroundColor: '#EAF3FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 122, 255, 0.22)',
    marginHorizontal: 16,
    marginTop: 16,
    position: 'relative',
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1,
    fontWeight: '600',
    color: '#0040A6',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
    alignItems: 'center',
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0, 122, 255, 0.20)',
  },
  progressDotActive: {
    width: 16,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#007AFF',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  btnGhost: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
  },
  btnPrimary: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
