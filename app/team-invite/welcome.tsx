/**
 * Team Welcome Screen
 *
 * Welcome screen shown after successfully joining a team.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useAuth } from '@/providers/AuthProvider';
import { SubscriptionTeamService } from '@/services/SubscriptionTeamService';
import type { SubscriptionTeam } from '@/types/subscriptionTeam';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

export default function TeamWelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [team, setTeam] = useState<SubscriptionTeam | null>(null);

  // Animation values
  const checkScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    loadTeam();
    triggerHaptic('success');

    // Animate in sequence
    checkScale.value = withDelay(200, withSpring(1, { damping: 12 }));
    titleOpacity.value = withDelay(400, withSpring(1));
    contentOpacity.value = withDelay(600, withSpring(1));
    // Runs once on mount; shared values + loadTeam captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTeam = async () => {
    if (!user?.id) return;
    const teamData = await SubscriptionTeamService.getTeam(user.id);
    setTeam(teamData);
  };

  const handleGetStarted = () => {
    router.replace('/(tabs)');
  };

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <Animated.View style={[styles.successIcon, checkStyle]}>
          <Ionicons name="checkmark-circle" size={96} color={IOS_COLORS.systemGreen} />
        </Animated.View>

        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>Welcome to the Team!</Text>
          {team && (
            <Text style={styles.teamName}>{team.name}</Text>
          )}
        </Animated.View>

        {/* Features */}
        <Animated.View style={[styles.featuresCard, contentStyle]}>
          <Text style={styles.featuresTitle}>You now have access to:</Text>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name="infinite" size={20} color={IOS_COLORS.systemBlue} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Unlimited Races</Text>
              <Text style={styles.featureDesc}>Track all your races with no limits</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name="sparkles" size={20} color={IOS_COLORS.systemPurple} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Strategy Analysis</Text>
              <Text style={styles.featureDesc}>Get personalized race insights</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={20} color={IOS_COLORS.systemOrange} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Team Collaboration</Text>
              <Text style={styles.featureDesc}>Share race prep with your team</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name="analytics" size={20} color={IOS_COLORS.systemGreen} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Advanced Analytics</Text>
              <Text style={styles.featureDesc}>Track performance over time</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.ctaContainer, contentStyle]}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.ctaButtonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xl * 2,
  },
  successIcon: {
    marginBottom: IOS_SPACING.xl,
  },
  title: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: IOS_COLORS.label,
    textAlign: 'center',
    marginBottom: IOS_SPACING.xs,
  },
  teamName: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.systemBlue,
    textAlign: 'center',
    marginBottom: IOS_SPACING.xl,
  },
  featuresCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    padding: IOS_SPACING.lg,
    width: '100%',
    marginBottom: IOS_SPACING.xl,
  },
  featuresTitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IOS_SPACING.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemGray6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: IOS_SPACING.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  featureDesc: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
  ctaContainer: {
    width: '100%',
    marginTop: 'auto',
    paddingBottom: IOS_SPACING.xl,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  ctaButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
});
