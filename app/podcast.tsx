/**
 * Podcast Page
 * Podcast entry page with links to published episodes and notifications
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LandingNav } from '@/components/landing/LandingNav';

export default function PodcastPage() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={styles.container}>
      <LandingNav transparent={false} sticky={true} />
      <LinearGradient
        colors={['#0A2463', '#3E92CC', '#0A2463']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          <View style={styles.iconContainer}>
            <Ionicons name="mic-outline" size={64} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
            BetterAt Podcast
          </Text>

          <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
            We're working on a podcast covering racing tactics, strategy, and insights from top sailors and coaches.
          </Text>

          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Episode Pipeline Active</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/podcasts')}>
            <Text style={styles.primaryButtonText}>Browse Episodes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              Linking.openURL(
                'mailto:info@better.at?subject=Podcast%20Notifications&body=Please%20notify%20me%20when%20BetterAt%20podcast%20episodes%20launch.'
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Notify Me</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingVertical: 80,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  contentDesktop: {
    paddingVertical: 120,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  titleDesktop: {
    fontSize: 48,
  },
  subtitle: {
    fontSize: 18,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
  },
  subtitleDesktop: {
    fontSize: 20,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#0A2463',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
