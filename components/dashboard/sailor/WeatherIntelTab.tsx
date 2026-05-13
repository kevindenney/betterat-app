import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DashboardSection } from '../shared';

interface WeatherData {
  current: {
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    temperature: number;
    pressure: number;
    humidity: number;
    visibility: number;
  };
  forecast: {
    time: string;
    windSpeed: number;
    windDirection: number;
    temperature: number;
    conditions: string;
    confidence: number;
  }[];
  marine: {
    waveHeight: number;
    waveDirection: number;
    wavePeriod: number;
    tideHeight: number;
    tidalFlow: 'incoming' | 'outgoing' | 'slack';
    nextTideChange: string;
  };
  regional: {
    source: string;
    accuracy: number;
    lastUpdate: string;
    alerts: string[];
  };
}

interface WeatherIntelTabProps {
  weatherData?: WeatherData;
  venueName?: string;
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetailedForecast: () => void;
}

export function WeatherIntelTab({
  weatherData,
  venueName,
  isLoading,
  onRefresh,
  onViewDetailedForecast
}: WeatherIntelTabProps) {
  const getWindDirectionText = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const getWindColor = (speed: number) => {
    if (speed < 5) return '#94A3B8';
    if (speed < 15) return '#10B981';
    if (speed < 25) return '#F59E0B';
    return '#EF4444';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10B981';
    if (confidence >= 60) return '#F59E0B';
    return '#EF4444';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="weather-windy" size={48} color="#3B82F6" />
          <Text style={styles.loadingTitle}>Loading Weather Intelligence</Text>
          <Text style={styles.loadingText}>
            Fetching regional weather data and marine conditions...
          </Text>
        </View>
      </View>
    );
  }

  if (!weatherData) {
    return (
      <View style={styles.container}>
        <DashboardSection title="🌤️ Weather Intelligence">
          <View style={styles.noDataContainer}>
            <MaterialCommunityIcons name="weather-cloudy-alert" size={48} color="#CBD5E1" />
            <Text style={styles.noDataTitle}>Weather Data Unavailable</Text>
            <Text style={styles.noDataText}>
              Unable to fetch weather data. Check your connection or try refreshing.
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={16} color="#3B82F6" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </DashboardSection>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Current Conditions */}
      <DashboardSection
        title="🌤️ Current Conditions"
        subtitle={venueName ? `At ${venueName}` : 'Local conditions'}
        headerAction={{
          label: 'Refresh',
          onPress: onRefresh,
          icon: 'refresh'
        }}
      >
        <LinearGradient
          colors={['#4facfe', '#00f2fe']}
          style={styles.currentWeatherCard}
        >
          <View style={styles.currentWeatherContent}>
            <View style={styles.primaryConditions}>
              <View style={styles.windData}>
                <Text style={styles.windSpeed}>{weatherData.current.windSpeed}</Text>
                <Text style={styles.windUnit}>kts</Text>
                <Text style={styles.windDirection}>
                  {getWindDirectionText(weatherData.current.windDirection)}
                </Text>
              </View>
              <View style={styles.temperature}>
                <Text style={styles.tempValue}>{weatherData.current.temperature}°</Text>
                <Text style={styles.tempUnit}>C</Text>
              </View>
            </View>

            <View style={styles.secondaryConditions}>
              <View style={styles.conditionItem}>
                <Ionicons name="speedometer" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.conditionLabel}>Gusts</Text>
                <Text style={styles.conditionValue}>{weatherData.current.windGusts} kts</Text>
              </View>
              <View style={styles.conditionItem}>
                <Ionicons name="thermometer" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.conditionLabel}>Pressure</Text>
                <Text style={styles.conditionValue}>{weatherData.current.pressure} hPa</Text>
              </View>
              <View style={styles.conditionItem}>
                <Ionicons name="water" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.conditionLabel}>Humidity</Text>
                <Text style={styles.conditionValue}>{weatherData.current.humidity}%</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </DashboardSection>

      {/* Marine Conditions */}
      <DashboardSection title="🌊 Marine Conditions">
        <View style={styles.marineGrid}>
          <View style={styles.marineCard}>
            <MaterialCommunityIcons name="wave" size={24} color="#3B82F6" />
            <Text style={styles.marineTitle}>Wave Height</Text>
            <Text style={styles.marineValue}>{weatherData.marine.waveHeight}m</Text>
          </View>
          <View style={styles.marineCard}>
            <MaterialCommunityIcons name="compass-rose" size={24} color="#3B82F6" />
            <Text style={styles.marineTitle}>Wave Direction</Text>
            <Text style={styles.marineValue}>{getWindDirectionText(weatherData.marine.waveDirection)}</Text>
          </View>
          <View style={styles.marineCard}>
            <MaterialCommunityIcons name="timer-sand" size={24} color="#3B82F6" />
            <Text style={styles.marineTitle}>Wave Period</Text>
            <Text style={styles.marineValue}>{weatherData.marine.wavePeriod}s</Text>
          </View>
        </View>

        <View style={styles.tidalSection}>
          <Text style={styles.tidalTitle}>🌊 Tidal Information</Text>
          <View style={styles.tidalData}>
            <View style={styles.tidalItem}>
              <Text style={styles.tidalLabel}>Current Height</Text>
              <Text style={styles.tidalValue}>{weatherData.marine.tideHeight}m</Text>
            </View>
            <View style={styles.tidalItem}>
              <Text style={styles.tidalLabel}>Flow</Text>
              <Text style={[
                styles.tidalValue,
                { color: weatherData.marine.tidalFlow === 'incoming' ? '#10B981' :
                         weatherData.marine.tidalFlow === 'outgoing' ? '#EF4444' : '#6B7280' }
              ]}>
                {weatherData.marine.tidalFlow}
              </Text>
            </View>
            <View style={styles.tidalItem}>
              <Text style={styles.tidalLabel}>Next Change</Text>
              <Text style={styles.tidalValue}>{weatherData.marine.nextTideChange}</Text>
            </View>
          </View>
        </View>
      </DashboardSection>

      {/* Weather Forecast */}
      <DashboardSection
        title="📈 24-Hour Forecast"
        headerAction={{
          label: 'Detailed View',
          onPress: onViewDetailedForecast,
          icon: 'calendar-outline'
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastScroll}>
          {weatherData.forecast.slice(0, 8).map((item, index) => (
            <View key={index} style={styles.forecastItem}>
              <Text style={styles.forecastTime}>{item.time}</Text>
              <View style={styles.forecastWind}>
                <Text style={[
                  styles.forecastWindSpeed,
                  { color: getWindColor(item.windSpeed) }
                ]}>
                  {item.windSpeed}
                </Text>
                <Text style={styles.forecastWindUnit}>kts</Text>
                <Text style={styles.forecastWindDir}>
                  {getWindDirectionText(item.windDirection)}
                </Text>
              </View>
              <Text style={styles.forecastTemp}>{item.temperature}°</Text>
              <View style={styles.forecastConfidence}>
                <View style={[
                  styles.confidenceBar,
                  {
                    width: `${item.confidence}%`,
                    backgroundColor: getConfidenceColor(item.confidence)
                  }
                ]} />
              </View>
              <Text style={styles.forecastConfidenceText}>{item.confidence}%</Text>
            </View>
          ))}
        </ScrollView>
      </DashboardSection>

      {/* Regional Intelligence */}
      <DashboardSection title="🌍 Regional Weather Intelligence">
        <View style={styles.regionalCard}>
          <View style={styles.regionalHeader}>
            <View style={styles.regionalInfo}>
              <Text style={styles.regionalSource}>Source: {weatherData.regional.source}</Text>
              <Text style={styles.regionalAccuracy}>
                Accuracy: {weatherData.regional.accuracy}%
              </Text>
              <Text style={styles.regionalUpdate}>
                Updated: {weatherData.regional.lastUpdate}
              </Text>
            </View>
            <View style={[
              styles.accuracyIndicator,
              { backgroundColor: getConfidenceColor(weatherData.regional.accuracy) }
            ]}>
              <Text style={styles.accuracyText}>{weatherData.regional.accuracy}%</Text>
            </View>
          </View>

          {weatherData.regional.alerts.length > 0 && (
            <View style={styles.alertsSection}>
              <Text style={styles.alertsTitle}>⚠️ Weather Alerts</Text>
              {weatherData.regional.alerts.map((alert, index) => (
                <View key={index} style={styles.alertItem}>
                  <Ionicons name="warning" size={16} color="#F59E0B" />
                  <Text style={styles.alertText}>{alert}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </DashboardSection>

      {/* Racing Implications */}
      <DashboardSection title="⛵ Racing Implications">
        <View style={styles.racingImplications}>
          <View style={styles.implicationCard}>
            <Ionicons name="flag" size={20} color="#10B981" />
            <Text style={styles.implicationTitle}>Race Conditions</Text>
            <Text style={styles.implicationText}>
              {weatherData.current.windSpeed >= 5 && weatherData.current.windSpeed <= 25
                ? 'Good racing conditions expected'
                : weatherData.current.windSpeed < 5
                ? 'Light air - may be challenging'
                : 'Strong winds - prepare for heavy weather'}
            </Text>
          </View>

          <View style={styles.implicationCard}>
            <Ionicons name="compass" size={20} color="#3B82F6" />
            <Text style={styles.implicationTitle}>Wind Strategy</Text>
            <Text style={styles.implicationText}>
              {weatherData.current.windGusts > weatherData.current.windSpeed * 1.3
                ? 'Gusty conditions - expect significant wind shifts'
                : 'Steady conditions - consistent wind direction expected'}
            </Text>
          </View>

          <View style={styles.implicationCard}>
            <Ionicons name="waves" size={20} color="#6366F1" />
            <Text style={styles.implicationTitle}>Sea State</Text>
            <Text style={styles.implicationText}>
              {weatherData.marine.waveHeight < 1
                ? 'Calm seas - ideal for tactical racing'
                : weatherData.marine.waveHeight < 2
                ? 'Moderate seas - some boat handling challenges'
                : 'Rough seas - focus on boat speed and safety'}
            </Text>
          </View>
        </View>
      </DashboardSection>
    </ScrollView>
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
    padding: 40,
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  currentWeatherCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  currentWeatherContent: {
    padding: 20,
    gap: 20,
  },
  primaryConditions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windData: {
    alignItems: 'center',
  },
  windSpeed: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  windUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: -8,
  },
  windDirection: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  temperature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tempValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tempUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: -8,
  },
  secondaryConditions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  conditionItem: {
    alignItems: 'center',
    gap: 4,
  },
  conditionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  marineGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  marineCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  marineTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  marineValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  tidalSection: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
  },
  tidalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  tidalData: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tidalItem: {
    alignItems: 'center',
  },
  tidalLabel: {
    fontSize: 12,
    color: '#1E40AF',
    marginBottom: 4,
  },
  tidalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  forecastScroll: {
    paddingVertical: 8,
  },
  forecastItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 80,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  forecastTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  forecastWind: {
    alignItems: 'center',
    marginBottom: 8,
  },
  forecastWindSpeed: {
    fontSize: 18,
    fontWeight: '700',
  },
  forecastWindUnit: {
    fontSize: 10,
    color: '#64748B',
    marginTop: -2,
  },
  forecastWindDir: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  forecastTemp: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  forecastConfidence: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 4,
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 2,
  },
  forecastConfidenceText: {
    fontSize: 10,
    color: '#64748B',
  },
  regionalCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  regionalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  regionalInfo: {
    flex: 1,
  },
  regionalSource: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  regionalAccuracy: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  regionalUpdate: {
    fontSize: 12,
    color: '#64748B',
  },
  accuracyIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertsSection: {
    gap: 8,
  },
  alertsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  racingImplications: {
    gap: 12,
  },
  implicationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  implicationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    flex: 1,
  },
  implicationText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    flex: 1,
  },
});