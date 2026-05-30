/**
 * WelcomeCard — Centered modal card shown after signup.
 *
 * Personalized, interest-aware welcome with clear next actions.
 * BetterAt brand: blue accent, cream feel, Manrope-style typography.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface WelcomeCardProps {
  visible: boolean;
  onStartTour: () => void;
  onSkip: () => void;
  onNavigate?: (route: string) => void;
  interestSlug?: string | null;
  userName?: string | null;
}

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: string;
}

const SAILING_ACTIONS: QuickAction[] = [
  {
    icon: 'add-circle-outline',
    title: 'Add your first race',
    description: 'Track an upcoming regatta on your timeline',
    route: '/(tabs)/races',
  },
  {
    icon: 'compass-outline',
    title: 'Browse programs',
    description: 'Discover training plans and blueprints',
    route: '/(tabs)/library?zone=follow',
  },
  {
    icon: 'people-outline',
    title: 'Find people',
    description: 'Connect with coaches and fellow sailors',
    route: '/(tabs)/watch',
  },
];

const GENERIC_ACTIONS: QuickAction[] = [
  {
    icon: 'add-circle-outline',
    title: 'Add your first step',
    description: 'Create a timeline step to track your progress',
    route: '/(tabs)/races',
  },
  {
    icon: 'compass-outline',
    title: 'Browse programs',
    description: 'Discover pathways and blueprints',
    route: '/(tabs)/library?zone=follow',
  },
  {
    icon: 'people-outline',
    title: 'Find people',
    description: 'Connect with peers and mentors',
    route: '/(tabs)/watch',
  },
];

const SAILING_SLUGS = new Set(['sail-racing', 'sailing']);

function getActions(interestSlug?: string | null): QuickAction[] {
  if (interestSlug && SAILING_SLUGS.has(interestSlug)) return SAILING_ACTIONS;
  return GENERIC_ACTIONS;
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return '';
  return fullName.split(/\s+/)[0];
}

export function WelcomeCard({ visible, onStartTour: _onStartTour, onSkip, onNavigate, interestSlug, userName }: WelcomeCardProps) {
  const { width } = useWindowDimensions();

  if (!visible) return null;

  const cardWidth = Math.min(380, width - 40);
  const actions = getActions(interestSlug);
  const firstName = getFirstName(userName);

  const handleAction = (route: string) => {
    onSkip(); // Dismiss the card
    onNavigate?.(route);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.backdrop}
    >
      <View style={[styles.card, { width: cardWidth }]}>
        {/* Brand icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="sparkles" size={24} color="#2563EB" />
        </View>

        {/* Greeting */}
        <Text style={styles.title}>
          {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
        </Text>
        <Text style={styles.description}>
          You're all set with 14 days of Pro access.{'\n'}Here are a few ways to get started:
        </Text>

        {/* Quick actions */}
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionRow}
              onPress={() => handleAction(action.route)}
              activeOpacity={0.7}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={20} color="#2563EB" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Primary dismiss */}
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={onSkip}
          activeOpacity={0.85}
        >
          <Text style={styles.exploreButtonText}>Got it, let me explore</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const ACCENT = '#2563EB';

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 16,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 1,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-SemiBold' },
      android: { fontFamily: 'Manrope-SemiBold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '600' as const },
    }),
  },
  actionDescription: {
    fontSize: 13,
    color: '#94A3B8',
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },
  exploreButton: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
});
