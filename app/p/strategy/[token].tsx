/**
 * Public Strategy Page
 * Accessible without authentication - shareable link for race strategies
 * Matches the comprehensive view from the Share Strategy preview
 * 
 * URL: /p/strategy/[token]
 */

import { Text } from '@/components/ui/text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
    Anchor,
    Calendar,
    Flag,
    MapPin,
    Share2,
    User,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Share,
} from 'react-native';

interface StrategyData {
  id: string;
  share_token: string;
  shared_at: string | null;
  race: {
    id: string;
    name: string;
    event_date: string | null;
    venue: string | null;
    boat_class: string | null;
    race_type: 'fleet' | 'distance' | null;
    total_distance_nm: number | null;
    waypoints: { name: string; latitude: number; longitude: number }[] | null;
  } | null;
  regatta: {
    id: string;
    name: string;
    venue: string | null;
    start_date: string | null;
  } | null;
  sailor: {
    display_name: string;
    boat_class: string | null;
  } | null;
  weather: {
    wind_speed: number | null;
    wind_speed_max: number | null;
    wind_direction: string | null;
    temperature: number | null;
    wave_height: number | null;
    tide_state: string | null;
    tide_height: number | null;
    current_speed: number | null;
    current_direction: string | null;
  } | null;
  rig_tuning: {
    preset: string | null;
    wind_range: string | null;
    notes: string | null;
    settings: Record<string, string> | null;
  } | null;
  strategy: {
    rig_tuning: string | null;
    prestart: string | null;
    start: string | null;
    upwind: string | null;
    windward_mark: string | null;
    downwind: string | null;
    leeward_mark: string | null;
    finish: string | null;
  };
  ai_insights: {
    wind_strategy: string | null;
    tide_strategy: string | null;
    current_strategy: string | null;
    start_line_bias: string | null;
    favored_end: string | null;
    upwind_tactics: string | null;
    downwind_tactics: string | null;
    contextual_insights: string[] | null;
  } | null;
  user_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Get API base URL - use current origin in development
const getApiBase = () => {
  // If running in browser, detect localhost
  if (typeof window !== 'undefined') {
    const isLocalhost = 
      window.location?.hostname === 'localhost' || 
      window.location?.hostname === '127.0.0.1' ||
      window.location?.hostname === '';
    
    if (isLocalhost) {
      // In development, API routes are Vercel serverless functions
      // They run on localhost:3000 (Vercel dev server), not on the Expo dev server
      // Always try Vercel dev server first in development
      return 'http://localhost:3000';
    }
  }
  
  // Use environment variable or fallback to production
  return process.env.EXPO_PUBLIC_API_URL || 'https://regattaflow.com';
};

const API_BASE = getApiBase();

export default function PublicStrategyPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchStrategyData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // In development, try multiple endpoints with timeout
      const endpoints: { url: string; timeout: number }[] = [];
      
      if (typeof window !== 'undefined') {
        const isLocalhost = 
          window.location?.hostname === 'localhost' || 
          window.location?.hostname === '127.0.0.1';
        
        if (isLocalhost) {
          // Try Vercel dev server first (port 3000)
          endpoints.push({ url: `http://localhost:3000/api/public/strategies/${token}`, timeout: 5000 });
          // Fallback to production API
          endpoints.push({ url: `https://regattaflow.com/api/public/strategies/${token}`, timeout: 10000 });
        } else {
          // Production - use API_BASE
          endpoints.push({ url: `${API_BASE}/api/public/strategies/${token}`, timeout: 10000 });
        }
      } else {
        // Server-side or no window
        endpoints.push({ url: `${API_BASE}/api/public/strategies/${token}`, timeout: 10000 });
      }
      
      let lastError: Error | null = null;
      
      for (const { url, timeout } of endpoints) {
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
          });
          
          // Race between fetch and timeout
          const response = await Promise.race([
            fetch(url),
            timeoutPromise,
          ]);
          
          if (response.ok) {
            const result = await response.json();
            setData(result);
            return; // Success!
          } else if (response.status === 404) {
            throw new Error('Strategy not found or sharing is disabled');
          } else {
            throw new Error(`Server error: ${response.status}`);
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Network error');
          console.warn(`Failed to fetch from ${url}:`, err);
          // Continue to next endpoint
        }
      }
      
      // If all endpoints failed, show helpful error message
      if (lastError?.message.includes('timeout')) {
        throw new Error('API server is not responding. Make sure Vercel dev server is running (npx vercel dev)');
      } else if (lastError?.message.includes('Failed to fetch') || lastError?.message.includes('Network')) {
        throw new Error('Cannot connect to API server. Make sure Vercel dev server is running on port 3000 (npx vercel dev)');
      } else {
        throw lastError || new Error('Failed to load strategy');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load strategy';
      setError(errorMessage);
      console.error('Failed to fetch strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    // Use current origin for sharing (we're already on the page)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : API_BASE;
    const url = `${baseUrl}/p/strategy/${token}`;
    const title = data?.race?.name ? `Race Strategy - ${data.race.name}` : 'Race Strategy';

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await Share.share({
        message: `Check out this race strategy: ${url}`,
        url,
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading strategy...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="compass-off" size={64} color="#CBD5E1" />
        <Text style={styles.errorTitle}>Strategy Not Found</Text>
        <Text style={styles.errorText}>
          {error || 'This strategy may have been removed or sharing has been disabled.'}
        </Text>
      </View>
    );
  }

  // Check what content is available
  const hasWeather = data.weather && (
    data.weather.wind_speed !== null ||
    data.weather.temperature !== null ||
    data.weather.tide_state !== null
  );

  const hasRigTuning = data.rig_tuning && (
    data.rig_tuning.preset ||
    data.rig_tuning.notes ||
    data.rig_tuning.settings
  );

  const hasUserStrategy = data.strategy && (
    data.strategy.start ||
    data.strategy.upwind ||
    data.strategy.downwind ||
    data.strategy.windward_mark ||
    data.strategy.leeward_mark ||
    data.strategy.finish
  );

  const hasAIInsights = data.ai_insights && (
    data.ai_insights.wind_strategy ||
    data.ai_insights.tide_strategy ||
    data.ai_insights.upwind_tactics ||
    data.ai_insights.downwind_tactics ||
    (data.ai_insights.contextual_insights && data.ai_insights.contextual_insights.length > 0)
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {data.sailor && (
            <View style={styles.sailorBadge}>
              <User size={14} color="#0EA5E9" />
              <Text style={styles.sailorName}>{data.sailor.display_name}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Share2 size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        {data.race && (
          <Text style={styles.raceName}>{data.race.name}</Text>
        )}
        
        <View style={styles.headerMeta}>
          {data.race?.event_date && (
            <View style={styles.metaRow}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.metaText}>{formatDate(data.race.event_date)}</Text>
            </View>
          )}
          
          {(data.race?.venue || data.regatta?.venue) && (
            <View style={styles.metaRow}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.metaText}>{data.race?.venue || data.regatta?.venue}</Text>
            </View>
          )}
          
          {(data.race?.boat_class || data.sailor?.boat_class) && (
            <View style={styles.metaRow}>
              <Anchor size={16} color="#6B7280" />
              <Text style={styles.metaText}>{data.race?.boat_class || data.sailor?.boat_class}</Text>
            </View>
          )}
        </View>

        {data.regatta && (
          <View style={styles.regattaBadge}>
            <Flag size={14} color="#7C3AED" />
            <Text style={styles.regattaText}>{data.regatta.name}</Text>
          </View>
        )}
      </View>

      {/* Strategy Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>Strategy Overview</Text>
        <View style={styles.overviewGrid}>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons 
              name={hasWeather ? 'check-circle' : 'circle-outline'} 
              size={20} 
              color={hasWeather ? '#10B981' : '#CBD5E1'} 
            />
            <Text style={[styles.overviewLabel, !hasWeather && styles.overviewLabelEmpty]}>
              Weather
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons 
              name={hasRigTuning ? 'check-circle' : 'circle-outline'} 
              size={20} 
              color={hasRigTuning ? '#10B981' : '#CBD5E1'} 
            />
            <Text style={[styles.overviewLabel, !hasRigTuning && styles.overviewLabelEmpty]}>
              Rig Tuning
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons 
              name={hasUserStrategy ? 'check-circle' : 'circle-outline'} 
              size={20} 
              color={hasUserStrategy ? '#10B981' : '#CBD5E1'} 
            />
            <Text style={[styles.overviewLabel, !hasUserStrategy && styles.overviewLabelEmpty]}>
              Race Plan
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons 
              name={hasAIInsights ? 'check-circle' : 'circle-outline'} 
              size={20} 
              color={hasAIInsights ? '#10B981' : '#CBD5E1'} 
            />
            <Text style={[styles.overviewLabel, !hasAIInsights && styles.overviewLabelEmpty]}>
              Insights
            </Text>
          </View>
        </View>
      </View>

      {/* Forecast Synopsis */}
      {hasWeather ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#0EA5E9" />
            <Text style={[styles.sectionTitle, { color: '#0EA5E9' }]}>Forecast Synopsis</Text>
          </View>
          <View style={styles.weatherGrid}>
            {data.weather?.wind_speed !== null && (
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="weather-windy" size={24} color="#64748B" />
                <Text style={styles.weatherValue}>
                  {data.weather.wind_speed_max 
                    ? `${data.weather.wind_speed}-${data.weather.wind_speed_max}`
                    : data.weather.wind_speed} kts
                </Text>
                {data.weather.wind_direction && (
                  <Text style={styles.weatherLabel}>{data.weather.wind_direction}</Text>
                )}
              </View>
            )}
            {data.weather?.temperature !== null && (
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="thermometer" size={24} color="#64748B" />
                <Text style={styles.weatherValue}>{data.weather.temperature}°C</Text>
                <Text style={styles.weatherLabel}>temp</Text>
              </View>
            )}
            {data.weather?.tide_state && (
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="waves" size={24} color="#64748B" />
                <Text style={styles.weatherValue}>{data.weather.tide_state}</Text>
                {data.weather.tide_height !== null && (
                  <Text style={styles.weatherLabel}>{data.weather.tide_height.toFixed(1)}m</Text>
                )}
              </View>
            )}
            {data.weather?.current_speed !== null && data.weather.current_speed > 0 && (
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="swap-horizontal" size={24} color="#64748B" />
                <Text style={styles.weatherValue}>{data.weather.current_speed.toFixed(1)} kts</Text>
                {data.weather.current_direction && (
                  <Text style={styles.weatherLabel}>{data.weather.current_direction}</Text>
                )}
              </View>
            )}
            {data.weather?.wave_height !== null && data.weather.wave_height > 0 && (
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="wave" size={24} color="#64748B" />
                <Text style={styles.weatherValue}>{data.weather.wave_height.toFixed(1)}m</Text>
                <Text style={styles.weatherLabel}>waves</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptySection}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color="#CBD5E1" />
          <View style={styles.emptySectionContent}>
            <Text style={styles.emptySectionTitle}>Forecast Synopsis</Text>
            <Text style={styles.emptySectionHint}>No weather data available</Text>
          </View>
        </View>
      )}

      {/* Rig Tuning */}
      {hasRigTuning ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="cog" size={20} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>Rig Tuning</Text>
          </View>
          {data.rig_tuning?.preset && (
            <Text style={styles.rigPreset}>{data.rig_tuning.preset}</Text>
          )}
          {data.rig_tuning?.wind_range && (
            <Text style={styles.rigWindRange}>Wind Range: {data.rig_tuning.wind_range}</Text>
          )}
          {data.rig_tuning?.settings && Object.keys(data.rig_tuning.settings).length > 0 && (
            <View style={styles.rigSettingsGrid}>
              {Object.entries(data.rig_tuning.settings).map(([key, value]) => (
                <View key={key} style={styles.rigSettingItem}>
                  <Text style={styles.rigSettingLabel}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </Text>
                  <Text style={styles.rigSettingValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
          {data.rig_tuning?.notes && (
            <Text style={styles.rigNotes}>{data.rig_tuning.notes}</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptySection}>
          <MaterialCommunityIcons name="cog" size={24} color="#CBD5E1" />
          <View style={styles.emptySectionContent}>
            <Text style={styles.emptySectionTitle}>Rig Tuning</Text>
            <Text style={styles.emptySectionHint}>No rig tuning data available</Text>
          </View>
        </View>
      )}

      {/* Strategy Notes */}
      {data.user_notes && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pencil" size={20} color="#10B981" />
            <Text style={[styles.sectionTitle, { color: '#10B981' }]}>Strategy Notes</Text>
          </View>
          <Text style={styles.notesContent}>{data.user_notes}</Text>
        </View>
      )}

      {/* Race Strategy - Different for Fleet vs Distance */}
      {data.race?.race_type === 'distance' ? (
        // Distance Racing Strategy
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="map-marker-path" size={20} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>Distance Race Strategy</Text>
          </View>

          {/* Route Overview */}
          {(data.race?.total_distance_nm || data.race?.waypoints?.length) && (
            <View style={styles.distanceOverview}>
              {data.race.total_distance_nm && (
                <View style={styles.distanceItem}>
                  <MaterialCommunityIcons name="map-marker-distance" size={20} color="#0EA5E9" />
                  <Text style={styles.distanceValue}>{data.race.total_distance_nm.toFixed(1)} nm</Text>
                </View>
              )}
              {data.race.waypoints && data.race.waypoints.length > 0 && (
                <View style={styles.distanceItem}>
                  <MaterialCommunityIcons name="map-marker-multiple" size={20} color="#0EA5E9" />
                  <Text style={styles.distanceValue}>{data.race.waypoints.length} waypoints</Text>
                </View>
              )}
            </View>
          )}

          {/* Waypoints List */}
          {data.race?.waypoints && data.race.waypoints.length > 0 && (
            <View style={styles.waypointsList}>
              {data.race.waypoints.map((wp, idx) => (
                <View key={idx} style={styles.waypointItem}>
                  <Text style={styles.waypointNumber}>{idx + 1}</Text>
                  <Text style={styles.waypointName}>{wp.name}</Text>
                </View>
              ))}
            </View>
          )}

          {data.strategy.start ? (
            <PhaseCard icon="flag-variant" title="Start / Departure" content={data.strategy.start} />
          ) : (
            <PhasePlaceholder icon="flag-variant" title="Start / Departure" />
          )}

          {data.strategy.upwind ? (
            <PhaseCard icon="weather-windy" title="Weather Routing" content={data.strategy.upwind} />
          ) : (
            <PhasePlaceholder icon="weather-windy" title="Weather Routing" />
          )}

          {data.strategy.windward_mark ? (
            <PhaseCard icon="waves" title="Tide Gates & Current" content={data.strategy.windward_mark} />
          ) : (
            <PhasePlaceholder icon="waves" title="Tide Gates & Current" />
          )}

          {data.strategy.downwind ? (
            <PhaseCard icon="account-group" title="Watch System / Crew" content={data.strategy.downwind} />
          ) : (
            <PhasePlaceholder icon="account-group" title="Watch System / Crew" />
          )}

          {data.strategy.finish ? (
            <PhaseCard icon="trophy" title="Finishing Strategy" content={data.strategy.finish} />
          ) : (
            <PhasePlaceholder icon="trophy" title="Finishing Strategy" />
          )}
        </View>
      ) : (
        // Fleet Racing Strategy (default)
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>Race Phase Strategy</Text>
          </View>

          {data.strategy.start ? (
            <PhaseCard icon="flag-checkered" title="Start" content={data.strategy.start} />
          ) : (
            <PhasePlaceholder icon="flag-checkered" title="Start" />
          )}

          {data.strategy.upwind ? (
            <PhaseCard icon="arrow-up-bold" title="Upwind" content={data.strategy.upwind} />
          ) : (
            <PhasePlaceholder icon="arrow-up-bold" title="Upwind" />
          )}

          {data.strategy.windward_mark ? (
            <PhaseCard icon="rotate-right" title="Windward Mark" content={data.strategy.windward_mark} />
          ) : (
            <PhasePlaceholder icon="rotate-right" title="Windward Mark" />
          )}

          {data.strategy.downwind ? (
            <PhaseCard icon="arrow-down-bold" title="Downwind" content={data.strategy.downwind} />
          ) : (
            <PhasePlaceholder icon="arrow-down-bold" title="Downwind" />
          )}

          {data.strategy.leeward_mark ? (
            <PhaseCard icon="rotate-left" title="Leeward Mark" content={data.strategy.leeward_mark} />
          ) : (
            <PhasePlaceholder icon="rotate-left" title="Leeward Mark" />
          )}

          {data.strategy.finish ? (
            <PhaseCard icon="trophy" title="Finish" content={data.strategy.finish} />
          ) : (
            <PhasePlaceholder icon="trophy" title="Finish" />
          )}
        </View>
      )}

      {/* Insights */}
      {hasAIInsights && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color="#9333EA" />
            <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Insights</Text>
          </View>
          
          {data.ai_insights?.wind_strategy && (
            <View style={styles.aiRow}>
              <Text style={styles.aiLabel}>Wind:</Text>
              <Text style={styles.aiText}>{data.ai_insights.wind_strategy}</Text>
            </View>
          )}
          
          {data.ai_insights?.tide_strategy && (
            <View style={styles.aiRow}>
              <Text style={styles.aiLabel}>Tide:</Text>
              <Text style={styles.aiText}>{data.ai_insights.tide_strategy}</Text>
            </View>
          )}
          
          {data.ai_insights?.current_strategy && (
            <View style={styles.aiRow}>
              <Text style={styles.aiLabel}>Current:</Text>
              <Text style={styles.aiText}>{data.ai_insights.current_strategy}</Text>
            </View>
          )}
          
          {(data.ai_insights?.start_line_bias || data.ai_insights?.favored_end) && (
            <View style={styles.startLineInfo}>
              {data.ai_insights.start_line_bias && (
                <View style={styles.startLineItem}>
                  <Text style={styles.startLineLabel}>Bias</Text>
                  <Text style={styles.startLineValue}>{data.ai_insights.start_line_bias}</Text>
                </View>
              )}
              {data.ai_insights.favored_end && (
                <View style={styles.startLineItem}>
                  <Text style={styles.startLineLabel}>Favored End</Text>
                  <Text style={styles.startLineValue}>{data.ai_insights.favored_end}</Text>
                </View>
              )}
            </View>
          )}
          
          {data.ai_insights?.upwind_tactics && (
            <View style={styles.aiTacticsCard}>
              <Text style={styles.aiTacticsTitle}>Upwind Tactics</Text>
              <Text style={styles.aiTacticsText}>{data.ai_insights.upwind_tactics}</Text>
            </View>
          )}
          
          {data.ai_insights?.downwind_tactics && (
            <View style={styles.aiTacticsCard}>
              <Text style={styles.aiTacticsTitle}>Downwind Tactics</Text>
              <Text style={styles.aiTacticsText}>{data.ai_insights.downwind_tactics}</Text>
            </View>
          )}
          
          {data.ai_insights?.contextual_insights && data.ai_insights.contextual_insights.length > 0 && (
            <View style={styles.contextualInsights}>
              <Text style={styles.contextualTitle}>Key Insights</Text>
              {data.ai_insights.contextual_insights.map((insight, idx) => (
                <View key={idx} style={styles.insightItem}>
                  <Text style={styles.insightBullet}>•</Text>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by RegattaFlow</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://regattaflow.com')}>
          <Text style={styles.footerLink}>Create your own strategy →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Phase Card Component
function PhaseCard({ icon, title, content }: { icon: string; title: string; content: string }) {
  return (
    <View style={styles.phaseCard}>
      <View style={styles.phaseCardHeader}>
        <MaterialCommunityIcons name={icon as any} size={16} color="#3B82F6" />
        <Text style={styles.phaseCardTitle}>{title}</Text>
        <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
      </View>
      <Text style={styles.phaseCardContent}>{content}</Text>
    </View>
  );
}

// Phase Placeholder Component
function PhasePlaceholder({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.phasePlaceholder}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#CBD5E1" />
      <Text style={styles.phasePlaceholderTitle}>{title}</Text>
      <Text style={styles.phasePlaceholderHint}>Not set</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  // Header
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sailorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sailorName: {
    fontSize: 13,
    color: '#0EA5E9',
    fontWeight: '500',
  },
  shareButton: {
    padding: 8,
  },
  raceName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  headerMeta: {
    gap: 8,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  regattaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  regattaText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '500',
  },
  // Strategy Overview
  overviewCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  overviewLabelEmpty: {
    color: '#94A3B8',
  },
  // Section
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  // Empty Section
  emptySection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptySectionContent: {
    flex: 1,
  },
  emptySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptySectionHint: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  // Weather
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  weatherItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  weatherValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  weatherLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // Rig Tuning
  rigPreset: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  rigWindRange: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  rigSettingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  rigSettingItem: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rigSettingLabel: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  rigSettingValue: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '500',
  },
  rigNotes: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  // Notes
  notesContent: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  // Phase Cards
  phaseCard: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  phaseCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  phaseCardContent: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
  },
  // Phase Placeholder
  phasePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  phasePlaceholderTitle: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  phasePlaceholderHint: {
    fontSize: 11,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  // Distance race styles
  distanceOverview: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
  },
  waypointsList: {
    marginBottom: 16,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  waypointNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  waypointName: {
    fontSize: 14,
    color: '#1E293B',
  },
  // Insights
  aiRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  aiLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginRight: 8,
    minWidth: 60,
  },
  aiText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  startLineInfo: {
    flexDirection: 'row',
    gap: 24,
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  startLineItem: {},
  startLineLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  startLineValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  aiTacticsCard: {
    backgroundColor: '#FAF5FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  aiTacticsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 4,
  },
  aiTacticsText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  contextualInsights: {
    marginTop: 12,
  },
  contextualTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  insightBullet: {
    color: '#9333EA',
    fontSize: 14,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  // Footer
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerLink: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500',
    marginTop: 4,
  },
});
