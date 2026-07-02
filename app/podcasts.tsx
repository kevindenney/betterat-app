/**
 * Podcasts Landing Page
 * Features the BetterAt Podcast with episodes on local knowledge and racing insights
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

// Episode data
interface Episode {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  duration: string;
  releaseDate: string;
  imageUrl?: string;
  spotifyUrl?: string;
  applePodcastsUrl?: string;
  youtubeUrl?: string;
  isFeatured?: boolean;
}

const EPISODES: Episode[] = [
  {
    id: 'ep-001',
    number: 1,
    title: 'Dragon Worlds Hong Kong 2026',
    subtitle: 'Local Knowledge',
    description:
      'Your complete guide to racing in Hong Kong waters. We break down the venue, discuss tidal patterns, common wind conditions, and tactical considerations for the upcoming Dragon Worlds in November 2026. Whether you\'re a first-time visitor or looking to sharpen your local knowledge, this episode has you covered.',
    duration: '45 min',
    releaseDate: 'January 2026',
    isFeatured: true,
    // Placeholder URLs - to be updated when published
    spotifyUrl: undefined,
    applePodcastsUrl: undefined,
    youtubeUrl: undefined,
  },
];

// Upcoming topics
const UPCOMING_TOPICS = [
  'Weather Routing Fundamentals',
  'Optimist Race Preparation',
  'Understanding Currents in Hong Kong',
  'Racing Rules Masterclass',
  'Coach Q&A Sessions',
];

export default function PodcastsPage() {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const isDesktop = width > 1024;

  const featuredEpisode = EPISODES.find((ep) => ep.isFeatured);
  const isPublished = featuredEpisode?.spotifyUrl || featuredEpisode?.applePodcastsUrl;

  const handleNotifyMe = () => {
    void Linking.openURL(
      'mailto:info@better.at?subject=Podcast%20Notifications&body=Please%20notify%20me%20when%20new%20BetterAt%20podcast%20episodes%20are%20available.'
    );
  };

  const handleSubscribe = (platform: 'spotify' | 'apple' | 'youtube') => {
    const urls = {
      spotify: featuredEpisode?.spotifyUrl || 'https://open.spotify.com',
      apple: featuredEpisode?.applePodcastsUrl || 'https://podcasts.apple.com',
      youtube: featuredEpisode?.youtubeUrl || 'https://youtube.com',
    };
    const targetUrl = urls[platform];
    if (Platform.OS === 'web') {
      window.open(urls[platform], '_blank');
      return;
    }
    void Linking.openURL(targetUrl);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <LandingNav transparent={false} sticky={true} />

      {/* Hero Section */}
      <LinearGradient
        colors={['#1E3A5F', '#3E92CC', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        {/* Audio wave pattern overlay */}
        <View style={styles.wavePattern}>
          {[...Array(12)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveLine,
                {
                  height: 20 + Math.sin(i * 0.8) * 15 + Math.random() * 10,
                  opacity: 0.15 + (i % 3) * 0.1,
                },
              ]}
            />
          ))}
        </View>

        <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
          <View style={styles.podcastBadge}>
            <Ionicons name="mic" size={16} color="#FFFFFF" />
            <Text style={styles.podcastBadgeText}>PODCAST</Text>
          </View>

          <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>
            BetterAt Podcast
          </Text>
          <Text style={[styles.heroSubtitle, isDesktop && styles.heroSubtitleDesktop]}>
            Local knowledge, racing insights, and strategy discussions
          </Text>

          {/* Subscribe buttons */}
          <View style={[styles.subscribeButtons, isMobile && styles.subscribeButtonsMobile]}>
            <TouchableOpacity
              style={[styles.subscribeButton, styles.spotifyButton]}
              onPress={() => handleSubscribe('spotify')}
            >
              <View style={styles.platformIcon}>
                <Text style={styles.platformIconText}>S</Text>
              </View>
              <Text style={styles.subscribeButtonText}>Spotify</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subscribeButton, styles.appleButton]}
              onPress={() => handleSubscribe('apple')}
            >
              <View style={styles.platformIcon}>
                <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.subscribeButtonText}>Apple Podcasts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subscribeButton, styles.youtubeButton]}
              onPress={() => handleSubscribe('youtube')}
            >
              <View style={styles.platformIcon}>
                <Ionicons name="logo-youtube" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.subscribeButtonText}>YouTube</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Featured Episode Section */}
      {featuredEpisode && (
        <View style={styles.featuredSection}>
          <View style={[styles.featuredContainer, isDesktop && styles.featuredContainerDesktop]}>
            <View style={styles.featuredHeader}>
              <View style={styles.featuredBadge}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.featuredBadgeText}>FEATURED EPISODE</Text>
              </View>
              {!isPublished && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>In Production</Text>
                </View>
              )}
            </View>

            <View style={[styles.episodeCard, isDesktop && styles.episodeCardDesktop]}>
              {/* Episode artwork placeholder */}
              <View style={[styles.episodeArtwork, isDesktop && styles.episodeArtworkDesktop]}>
                <LinearGradient
                  colors={['#0A2463', '#3E92CC']}
                  style={styles.artworkGradient}
                >
                  <View style={styles.artworkContent}>
                    <Text style={styles.artworkNumber}>EP {featuredEpisode.number}</Text>
                    <View style={styles.artworkIcon}>
                      <Ionicons name="boat" size={48} color="#FFFFFF" />
                    </View>
                    <Text style={styles.artworkVenue}>Hong Kong</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Episode details */}
              <View style={[styles.episodeDetails, isDesktop && styles.episodeDetailsDesktop]}>
                <Text style={styles.episodeNumber}>Episode {featuredEpisode.number}</Text>
                <Text style={[styles.episodeTitle, isDesktop && styles.episodeTitleDesktop]}>
                  {featuredEpisode.title}
                </Text>
                <Text style={styles.episodeSubtitle}>{featuredEpisode.subtitle}</Text>

                <Text style={styles.episodeDescription}>{featuredEpisode.description}</Text>

                <View style={styles.episodeMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text style={styles.metaText}>{featuredEpisode.duration}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.metaText}>{featuredEpisode.releaseDate}</Text>
                  </View>
                </View>

                {isPublished ? (
                  <TouchableOpacity style={styles.listenButton}>
                    <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.listenButtonText}>Listen Now</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.notifyContainer}>
                    <TouchableOpacity style={styles.notifyButton} onPress={handleNotifyMe}>
                      <Ionicons name="notifications-outline" size={20} color="#3E92CC" />
                      <Text style={styles.notifyButtonText}>Notify Me</Text>
                    </TouchableOpacity>
                    <Text style={styles.notifyHint}>Get notified when this episode drops</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Topics Section */}
      <View style={styles.topicsSection}>
        <View style={styles.topicsContainer}>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
            Coming Up on the Podcast
          </Text>
          <Text style={styles.sectionSubtitle}>
            Topics we're exploring in upcoming episodes
          </Text>

          <View style={[styles.topicsGrid, isDesktop && styles.topicsGridDesktop]}>
            {UPCOMING_TOPICS.map((topic, index) => (
              <View key={index} style={styles.topicCard}>
                <View style={styles.topicNumber}>
                  <Text style={styles.topicNumberText}>{index + 2}</Text>
                </View>
                <Text style={styles.topicTitle}>{topic}</Text>
                <View style={styles.topicStatus}>
                  <Text style={styles.topicStatusText}>In Production</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.aboutSection}>
        <View style={[styles.aboutContainer, isDesktop && styles.aboutContainerDesktop]}>
          <View style={styles.aboutContent}>
            <Text style={[styles.aboutTitle, isDesktop && styles.aboutTitleDesktop]}>
              About the Podcast
            </Text>
            <Text style={styles.aboutText}>
              The BetterAt Podcast brings you expert insights on racing venues around the world.
              From local knowledge to advanced tactics, we cover everything competitive sailors need
              to perform at their best.
            </Text>
            <Text style={styles.aboutText}>
              Each episode features in-depth discussions with local experts, coaches, and
              experienced racers who share their knowledge of specific venues and racing conditions.
            </Text>
          </View>

          <View style={styles.aboutFeatures}>
            <View style={styles.aboutFeature}>
              <View style={styles.aboutFeatureIcon}>
                <Ionicons name="compass-outline" size={28} color="#3E92CC" />
              </View>
              <View style={styles.aboutFeatureContent}>
                <Text style={styles.aboutFeatureTitle}>Venue Guides</Text>
                <Text style={styles.aboutFeatureText}>
                  Deep dives into racing venues with local experts
                </Text>
              </View>
            </View>

            <View style={styles.aboutFeature}>
              <View style={styles.aboutFeatureIcon}>
                <Ionicons name="analytics-outline" size={28} color="#3E92CC" />
              </View>
              <View style={styles.aboutFeatureContent}>
                <Text style={styles.aboutFeatureTitle}>Tactical Analysis</Text>
                <Text style={styles.aboutFeatureText}>
                  Breaking down race strategy and decision-making
                </Text>
              </View>
            </View>

            <View style={styles.aboutFeature}>
              <View style={styles.aboutFeatureIcon}>
                <Ionicons name="people-outline" size={28} color="#3E92CC" />
              </View>
              <View style={styles.aboutFeatureContent}>
                <Text style={styles.aboutFeatureTitle}>Expert Interviews</Text>
                <Text style={styles.aboutFeatureText}>
                  Conversations with coaches, pros, and industry leaders
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flexGrow: 1,
  },
  // Hero styles
  heroGradient: {
    paddingTop: 100,
    paddingBottom: 80,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  wavePattern: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  waveLine: {
    width: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  heroContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  heroContentDesktop: {
    paddingVertical: 40,
  },
  podcastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 24,
  },
  podcastBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 44,
  },
  heroTitleDesktop: {
    fontSize: 56,
    lineHeight: 68,
  },
  heroSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 40,
  },
  heroSubtitleDesktop: {
    fontSize: 22,
    lineHeight: 34,
  },
  subscribeButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subscribeButtonsMobile: {
    flexDirection: 'column',
    width: '100%',
    maxWidth: 280,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 10,
    minWidth: 160,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
  },
  appleButton: {
    backgroundColor: '#A855F7',
  },
  youtubeButton: {
    backgroundColor: '#FF0000',
  },
  platformIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subscribeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Featured Episode Section
  featuredSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  featuredContainer: {
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  featuredContainerDesktop: {},
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featuredBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  episodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
    }),
  },
  episodeCardDesktop: {
    flexDirection: 'row',
  },
  episodeArtwork: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 300,
  },
  episodeArtworkDesktop: {
    width: 300,
    maxHeight: 'none',
  },
  artworkGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkContent: {
    alignItems: 'center',
  },
  artworkNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
    marginBottom: 16,
  },
  artworkIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  artworkVenue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  episodeDetails: {
    padding: 24,
    flex: 1,
  },
  episodeDetailsDesktop: {
    padding: 32,
  },
  episodeNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3E92CC',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  episodeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 32,
  },
  episodeTitleDesktop: {
    fontSize: 28,
  },
  episodeSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  episodeDescription: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 24,
  },
  episodeMeta: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listenButton: {
    backgroundColor: '#3E92CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  listenButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notifyContainer: {
    alignItems: 'flex-start',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#3E92CC',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  notifyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3E92CC',
  },
  notifyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  // Topics Section
  topicsSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  topicsContainer: {
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 36,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  topicsGrid: {
    gap: 16,
  },
  topicsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    gap: 16,
    ...Platform.select({
      web: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '48%',
        minWidth: 280,
      },
    }),
  },
  topicNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topicTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  topicStatus: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topicStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  // About Section
  aboutSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  aboutContainer: {
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  aboutContainerDesktop: {
    flexDirection: 'row',
    gap: 48,
  },
  aboutContent: {
    flex: 1,
    marginBottom: 32,
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  aboutTitleDesktop: {
    fontSize: 32,
  },
  aboutText: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 26,
    marginBottom: 16,
  },
  aboutFeatures: {
    flex: 1,
    gap: 24,
  },
  aboutFeature: {
    flexDirection: 'row',
    gap: 16,
  },
  aboutFeatureIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aboutFeatureContent: {
    flex: 1,
  },
  aboutFeatureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  aboutFeatureText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
});
