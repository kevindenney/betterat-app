/**
 * Venue Intelligence Service
 * Unified service for GPS-based venue detection and regional adaptation
 * Integrates with existing SupabaseVenueService for data operations
 */

import { Platform } from 'react-native';
import { supabaseVenueService } from '@/services/venue/SupabaseVenueService';
import { offlineService } from '@/services/offlineService';
import type {
  SailingVenue,
  Coordinates,
  CulturalBriefing,
  AdaptationRequirement,
  Language,
} from '@/lib/types/global-venues';

// Dynamic import helper for expo-location (native only)
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

// ==================== Type Definitions ====================

export interface VenueDetectionResult {
  venue: SailingVenue | null;
  distance_km: number;
  confidence: number;
  method: 'gps' | 'manual' | 'network';
}

export interface RegionalAdaptation {
  currency: string;
  timezone: string;
  language: string;
  weather_sources: string[];
  date_format: string;
  temperature_unit: 'celsius' | 'fahrenheit';
  distance_unit: 'nautical_miles' | 'kilometers';
  speed_unit: 'knots' | 'kmh';
}

export interface VenueSwitchResult {
  previous_venue: SailingVenue | null;
  new_venue: SailingVenue;
  adaptations: RegionalAdaptation;
  cultural_briefing: CulturalBriefing;
  offline_data_cached: boolean;
}

// ==================== Weather Source Configuration ====================

const REGIONAL_WEATHER_SOURCES: Record<string, string[]> = {
  'north-america': ['NOAA', 'Environment Canada', 'NWS'],
  europe: ['ECMWF', 'Met Office', 'Météo-France', 'DWD'],
  'asia-pacific': ['JMA', 'Hong Kong Observatory', 'BOM', 'Korea Meteorological Administration'],
  oceania: ['BOM', 'MetService NZ'],
  'south-america': ['INMET', 'SMN Argentina'],
  africa: ['SAWS'],
  'middle-east': ['ECMWF', 'Met Office'],
  global: ['ECMWF', 'GFS'],
};

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  'Hong Kong': 'HKD',
  'Australia': 'AUD',
  'New Zealand': 'NZD',
  'Singapore': 'SGD',
  'Japan': 'JPY',
  'France': 'EUR',
  'Germany': 'EUR',
  'Italy': 'EUR',
  'Spain': 'EUR'
};

// ==================== Venue Service ====================

export class VenueService {
  private static currentVenue: SailingVenue | null = null;
  private static locationSubscription: any | null = null;

  /**
   * Detect venue from current GPS position
   */
  static async detectVenueFromGPS(
    userId: string,
    radiusKm: number = 50
  ): Promise<VenueDetectionResult> {
    const Location = await getLocationModule();
    if (!Location) {
      throw new Error('Location detection not available on web');
    }

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Get current position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const coordinates: Coordinates = [
        location.coords.longitude,
        location.coords.latitude
      ];

      // Search for venues in database
      const venue = await supabaseVenueService.findVenueByLocation(
        coordinates,
        radiusKm,
        userId
      );

      if (venue) {
        const distance = this.calculateDistance(
          coordinates,
          venue.coordinates as Coordinates
        );

        return {
          venue,
          distance_km: distance,
          confidence: this.calculateConfidence(distance, radiusKm),
          method: 'gps'
        };
      }

      return {
        venue: null,
        distance_km: 0,
        confidence: 0,
        method: 'gps'
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Switch to a new venue with full regional adaptation
   */
  static async switchVenue(
    venueId: string,
    userId: string,
    options?: {
      cacheOffline?: boolean;
      loadIntelligence?: boolean;
    }
  ): Promise<VenueSwitchResult> {
    try {

      const previousVenue = this.currentVenue;

      // Get venue with intelligence
      const venue = await supabaseVenueService.getVenueWithIntelligence(venueId, userId);

      if (!venue) {
        throw new Error('Venue not found');
      }

      // Calculate regional adaptations
      const adaptations = this.calculateRegionalAdaptations(venue);

      // Generate cultural briefing
      const cultural_briefing = this.generateCulturalBriefing(venue, previousVenue);

      // Cache for offline use
      let offline_data_cached = false;
      if (options?.cacheOffline !== false) {
        await offlineService.cacheVenue(venue.id);
        offline_data_cached = true;
      }

      // Record venue transition
      if (previousVenue) {
        const transitionType: 'first_visit' | 'returning' | 'traveling' | 'relocating' =
          previousVenue.id === venue.id ? 'returning' : 'traveling';

        await supabaseVenueService.recordVenueTransition(userId, {
          fromVenue: previousVenue,
          toVenue: venue,
          transitionType,
          adaptationRequired: this.identifyAdaptations(previousVenue, venue),
          culturalBriefing: cultural_briefing
        });
      }

      // Update current venue
      this.currentVenue = venue;

      return {
        previous_venue: previousVenue,
        new_venue: venue,
        adaptations,
        cultural_briefing,
        offline_data_cached
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Start automatic venue detection
   */
  static async startAutoDetection(
    userId: string,
    onVenueDetected: (result: VenueDetectionResult) => void
  ): Promise<void> {
    const Location = await getLocationModule();
    if (!Location) {
      throw new Error('Auto-detection not available on web');
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Watch position with moderate accuracy
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Check every 30 seconds
          distanceInterval: 500 // Or when moved 500m
        },
        async (location) => {
          const coordinates: Coordinates = [
            location.coords.longitude,
            location.coords.latitude
          ];

          // Check if we're near a different venue
          const venue = await supabaseVenueService.findVenueByLocation(
            coordinates,
            50, // 50km radius
            userId
          );

          if (venue && venue.id !== this.currentVenue?.id) {
            const distance = this.calculateDistance(coordinates, venue.coordinates as Coordinates);

            onVenueDetected({
              venue,
              distance_km: distance,
              confidence: this.calculateConfidence(distance, 50),
              method: 'gps'
            });
          }
        }
      );

    } catch (error) {

      throw error;
    }
  }

  /**
   * Stop automatic venue detection
   */
  static stopAutoDetection(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;

    }
  }

  /**
   * Get current venue
   */
  static getCurrentVenue(): SailingVenue | null {
    return this.currentVenue;
  }

  /**
   * Search venues globally
   */
  static async searchVenues(
    query: string,
    filters?: {
      venueType?: any[];
      region?: string;
      country?: string;
      limit?: number;
    }
  ): Promise<SailingVenue[]> {
    return supabaseVenueService.searchVenues(query, filters);
  }

  /**
   * Get nearby venues for circuit planning
   */
  static async getNearbyVenues(
    coordinates: Coordinates,
    maxDistanceKm: number = 500,
    limit: number = 10
  ): Promise<(SailingVenue & { distance_km: number })[]> {
    return supabaseVenueService.getNearbyVenues(coordinates, maxDistanceKm, limit);
  }

  // ==================== Regional Adaptation ====================

  private static calculateRegionalAdaptations(venue: SailingVenue): RegionalAdaptation {
    const region = venue.region;
    const country = venue.country;

    // Determine currency
    const currency = CURRENCY_BY_COUNTRY[country] || 'USD';

    // Determine timezone
    const timezone = venue.timeZone || 'UTC';

    // Determine language (from cultural context)
    const language = venue.culturalContext?.primaryLanguages?.[0]?.code || 'en';

    // Select weather sources for region
    const weather_sources = REGIONAL_WEATHER_SOURCES[region] || ['Generic'];

    // Regional preferences
    const useMetric = region !== 'north-america';

    return {
      currency,
      timezone,
      language,
      weather_sources,
      date_format: useMetric ? 'DD/MM/YYYY' : 'MM/DD/YYYY',
      temperature_unit: useMetric ? 'celsius' : 'fahrenheit',
      distance_unit: 'nautical_miles', // Always nautical for sailing
      speed_unit: 'knots' // Always knots for sailing
    };
  }

  private static generateCulturalBriefing(
    newVenue: SailingVenue,
    previousVenue: SailingVenue | null
  ): CulturalBriefing {
    const culturalContext = newVenue.culturalContext;

    const fallbackLanguage: Language = {
      code: 'en',
      name: 'English',
      prevalence: 'common',
      sailingTerminology: true,
    };

    const primaryLanguage = culturalContext?.primaryLanguages?.[0] ?? fallbackLanguage;

    const languageInfo: CulturalBriefing['languageInfo'] = {
      primaryLanguage,
      commonPhrases: [],
      sailingTerminology: [],
      pronunciationGuide: undefined,
    };

    const culturalProtocols: CulturalBriefing['culturalProtocols'] = (culturalContext?.socialProtocols ?? [])
      .slice(0, 5)
      .map(protocol => ({
        situation: protocol.context,
        expectedBehavior: protocol.protocol ?? 'Follow local customs and etiquette.',
        importance: protocol.importance,
        consequences: protocol.consequences,
      }));

    const tippingInfo = culturalContext?.economicFactors?.tipping;
    const tippingCustoms: CulturalBriefing['economicInfo']['tippingCustoms'] = tippingInfo
      ? tippingInfo.contexts.map(contextName => ({
          service: contextName,
          expected: tippingInfo.expected,
          rate: tippingInfo.rate,
          rateType: tippingInfo.rate ? 'percentage' : 'discretionary',
          notes: tippingInfo.expected ? undefined : 'Tipping typically not expected',
        }))
      : [];

    const economicFactors = culturalContext?.economicFactors;
    const typicalCosts: CulturalBriefing['economicInfo']['typicalCosts'] = economicFactors
      ? [
          {
            category: 'entry_fees',
            description: 'Typical regatta entry fee',
            cost: economicFactors.entryFees.typical,
            currency: economicFactors.currency,
            notes: `Range ${economicFactors.entryFees.range.min}-${economicFactors.entryFees.range.max}`,
          },
          {
            category: 'accommodation',
            description: 'Moderate accommodation per night',
            cost: economicFactors.accommodation.moderate,
            currency: economicFactors.currency,
          },
          {
            category: 'dining',
            description: 'Average dining cost',
            cost: economicFactors.dining.moderate,
            currency: economicFactors.currency,
          },
        ]
      : [];

    const paymentMethods: CulturalBriefing['economicInfo']['paymentMethods'] = [
      {
        type: 'card',
        acceptance: 'common',
        notes: `Credit cards are generally accepted in ${newVenue.country}`,
      },
      {
        type: 'cash',
        acceptance: 'common',
        notes: `Carry local currency (${economicFactors?.currency ?? CURRENCY_BY_COUNTRY[newVenue.country] ?? 'USD'}) for smaller vendors.`,
      },
    ];

    const economicInfo: CulturalBriefing['economicInfo'] = {
      currency: economicFactors?.currency ?? CURRENCY_BY_COUNTRY[newVenue.country] ?? 'USD',
      exchangeRate: undefined,
      tippingCustoms,
      typicalCosts,
      paymentMethods,
    };

    const practicalTips: CulturalBriefing['practicalTips'] = [];

    if (previousVenue && previousVenue.region !== newVenue.region) {
      practicalTips.push({
        category: 'cultural',
        tip: 'Regional change detected – review local race protocols and weather sources.',
        importance: 'important',
        source: 'estimated',
      });
    }

    if (culturalContext?.racingCustoms?.length) {
      practicalTips.push({
        category: 'cultural',
        tip: `Key racing customs: ${culturalContext.racingCustoms.slice(0, 3).map(c => c.name).join(', ')}`,
        importance: 'helpful',
        source: 'verified',
      });
    }

    return {
      venueId: newVenue.id,
      languageInfo,
      culturalProtocols,
      economicInfo,
      practicalTips,
      localContacts: undefined,
    };
  }

  private static identifyAdaptations(
    fromVenue: SailingVenue,
    toVenue: SailingVenue
  ): AdaptationRequirement[] {
    const adaptations: AdaptationRequirement[] = [];

    // Region change
    if (fromVenue.region !== toVenue.region) {
      adaptations.push(
        this.createAdaptationRequirement(
          'weather_source',
          `Weather sources should be updated for ${toVenue.region}`,
          'important',
          'Enable region-specific weather feeds'
        )
      );
      adaptations.push(
        this.createAdaptationRequirement(
          'cultural',
          `Regional protocols differ between ${fromVenue.region} and ${toVenue.region}`,
          'helpful',
          'Review updated cultural briefing'
        )
      );
    }

    // Country change
    if (fromVenue.country !== toVenue.country) {
      adaptations.push(
        this.createAdaptationRequirement(
          'currency',
          `Local currency changes from ${fromVenue.country} to ${toVenue.country}`,
          'important',
          'Update onboard pricing and budgeting settings'
        )
      );
      adaptations.push(
        this.createAdaptationRequirement(
          'language',
          `Primary language now ${toVenue.culturalContext?.primaryLanguages?.[0]?.name ?? 'English'}`,
          'helpful',
          'Share local language quick-reference with crew'
        )
      );
      adaptations.push(
        this.createAdaptationRequirement(
          'regulatory',
          `Racing regulations may differ in ${toVenue.country}`,
          'critical',
          'Confirm notice of race and local sailing instructions'
        )
      );
    }

    // Venue type change
    if (fromVenue.venueType !== toVenue.venueType) {
      adaptations.push(
        this.createAdaptationRequirement(
          'equipment',
          `Venue shifts from ${fromVenue.venueType} to ${toVenue.venueType}`,
          'helpful',
          'Review equipment lists and facility availability'
        )
      );
    }

    return adaptations;
  }

  private static createAdaptationRequirement(
    category: AdaptationRequirement['category'],
    description: string,
    priority: AdaptationRequirement['priority'],
    actionRequired: string,
    userCanConfigure = true
  ): AdaptationRequirement {
    return {
      category,
      description,
      priority,
      actionRequired,
      userCanConfigure,
    };
  }

  // ==================== Utility Methods ====================

  private static calculateDistance(from: Coordinates, to: Coordinates): number {
    const [lon1, lat1] = from;
    const [lon2, lat2] = to;

    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
      Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private static calculateConfidence(distance: number, maxRadius: number): number {
    // Confidence decreases with distance
    // 100% at 0km, 50% at half radius, 0% at max radius
    return Math.max(0, 100 - (distance / maxRadius) * 100);
  }
}

export default VenueService;
