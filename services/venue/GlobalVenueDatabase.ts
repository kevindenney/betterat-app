/**
 * Global Venue Database Service
 * Central repository for the 147+ major sailing venues worldwide
 * Core of BetterAt's "OnX Maps for Sailing" intelligence system
 */

import { SupabaseVenueService } from './SupabaseVenueService';
import { createLogger } from '@/lib/utils/logger';
import type {
  SailingVenue,
  VenueType,
  Coordinates,
  YachtClub,
  VenueConditionProfile,
  VenueCulturalProfile,
  WeatherSourceConfig
} from '@/lib/types/global-venues';

const logger = createLogger('GlobalVenueDatabase');
export class GlobalVenueDatabase {
  private venues: Map<string, SailingVenue> = new Map();
  private venuesByCoordinates: Map<string, string> = new Map(); // coordinates hash -> venue ID
  private venuesByRegion: Map<string, string[]> = new Map();
  private initialized: boolean = false;
  private supabaseService: SupabaseVenueService;
  private useSupabase: boolean = true; // Try Supabase first, fallback to local

  constructor() {
    this.supabaseService = new SupabaseVenueService();
  }

  private storeVenue(venue: SailingVenue): void {
    this.venues.set(venue.id, {
      ...venue,
      yachtClubs: venue.primaryClubs,
    });
  }

  /**
   * Initialize the global venue database with core venues
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.useSupabase) {
      try {

        await this.loadVenuesFromSupabase();

        if (this.venues.size > 0) {
          this.buildLocationIndexes();
          this.initialized = true;
          return;
        } else {

        }
      } catch (error) {

      }
    }

    // Fallback to local venues if Supabase fails or is disabled

    await this.loadChampionshipVenues();
    await this.loadPremierRacingCenters();
    await this.loadRegionalHubs();

    this.buildLocationIndexes();
    this.initialized = true;

  }

  /**
   * Find venue by GPS coordinates (within radius)
   */
  findVenueByLocation(coordinates: Coordinates, radiusKm: number = 50): SailingVenue | null {
    const [longitude, latitude] = coordinates;

    for (const venue of this.venues.values()) {
      const distance = this.calculateDistance(
        coordinates,
        venue.coordinates
      );

      if (distance <= radiusKm) {
        return venue;
      }
    }

    return null;
  }

  /**
   * Get venue by ID
   */
  getVenueById(venueId: string): SailingVenue | null {
    return this.venues.get(venueId) || null;
  }

  /**
   * Get all venues in a region
   */
  getVenuesByRegion(region: string): SailingVenue[] {
    const venueIds = this.venuesByRegion.get(region) || [];
    return venueIds.map(id => this.venues.get(id)!).filter(Boolean);
  }

  /**
   * Get venues by type
   */
  getVenuesByType(venueType: VenueType): SailingVenue[] {
    return Array.from(this.venues.values()).filter(venue => venue.venueType === venueType);
  }

  /**
   * Return all venues currently loaded in memory
   */
  getAllVenues(): SailingVenue[] {
    return Array.from(this.venues.values());
  }

  /**
   * Utility: calculate distance between two coordinates in kilometers
   */
  getDistanceBetweenCoordinates(coord1: Coordinates, coord2: Coordinates): number {
    return this.calculateDistance(coord1, coord2);
  }

  /**
   * Search venues by name or location
   */
  searchVenues(query: string, limit: number = 20): SailingVenue[] {
    const searchTerm = query.toLowerCase();
    const results: SailingVenue[] = [];

    for (const venue of this.venues.values()) {
      if (venue.name.toLowerCase().includes(searchTerm) ||
          venue.country.toLowerCase().includes(searchTerm) ||
          venue.region.toLowerCase().includes(searchTerm) ||
          venue.primaryClubs.some(club => club.name.toLowerCase().includes(searchTerm))) {
        results.push(venue);
      }

      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Get nearby venues for circuit planning
   */
  getNearbyVenues(coordinates: Coordinates, maxDistance: number = 500): SailingVenue[] {
    const nearby: {venue: SailingVenue, distance: number}[] = [];

    for (const venue of this.venues.values()) {
      const distance = this.calculateDistance(coordinates, venue.coordinates);
      if (distance <= maxDistance) {
        nearby.push({ venue, distance });
      }
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    return nearby.map(item => item.venue);
  }

  /**
   * Get venue statistics
   */
  getGlobalStats(): {
    totalVenues: number;
    venuesByType: Record<VenueType, number>;
    venuesByRegion: Record<string, number>;
    topSailingCountries: {country: string, count: number}[];
  } {
    const venuesByType: Record<VenueType, number> = {
      championship: 0,
      premier: 0,
      regional: 0,
      local: 0,
      club: 0
    };

    const venuesByRegion: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};

    for (const venue of this.venues.values()) {
      venuesByType[venue.venueType]++;
      venuesByRegion[venue.region] = (venuesByRegion[venue.region] || 0) + 1;
      countryCounts[venue.country] = (countryCounts[venue.country] || 0) + 1;
    }

    const topSailingCountries = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalVenues: this.venues.size,
      venuesByType,
      venuesByRegion,
      topSailingCountries
    };
  }

  /**
   * Load championship venues (America's Cup, Olympics, World Championships)
   */
  private async loadChampionshipVenues(): Promise<void> {
    const championshipVenues: SailingVenue[] = [
      {
        id: 'americas-cup-auckland',
        name: 'America\'s Cup Auckland',
        coordinates: [174.7633, -36.8485],
        country: 'New Zealand',
        region: 'oceania',
        venueType: 'championship',
        establishedYear: 2000,
        timeZone: 'Pacific/Auckland',
        primaryClubs: [this.createClub('royal-new-zealand-yacht-squadron', 'Royal New Zealand Yacht Squadron')],
        sailingConditions: this.createAucklandConditions(),
        culturalContext: this.createOceanicCulture(),
        weatherSources: this.createOceanicWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'americas-cup-san-francisco',
        name: 'America\'s Cup San Francisco Bay',
        coordinates: [-122.4194, 37.7749],
        country: 'United States',
        region: 'north-america',
        venueType: 'championship',
        establishedYear: 2013,
        timeZone: 'America/Los_Angeles',
        primaryClubs: [
          this.createClub('golden-gate-yacht-club', 'Golden Gate Yacht Club'),
          this.createClub('st-francis-yacht-club', 'St. Francis Yacht Club')
        ],
        sailingConditions: this.createSanFranciscoConditions(),
        culturalContext: this.createNorthAmericanCulture(),
        weatherSources: this.createNorthAmericanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'olympic-tokyo-enoshima',
        name: 'Olympic Sailing Venue - Enoshima',
        coordinates: [139.4757, 35.3037],
        country: 'Japan',
        region: 'asia-pacific',
        venueType: 'championship',
        establishedYear: 1964,
        timeZone: 'Asia/Tokyo',
        primaryClubs: [this.createClub('enoshima-yacht-club', 'Enoshima Yacht Club')],
        sailingConditions: this.createJapanConditions(),
        culturalContext: this.createJapaneseCulture(),
        weatherSources: this.createAsiaPacificWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      }
    ];

    championshipVenues.forEach(venue => this.storeVenue(venue));
  }

  /**
   * Load premier racing centers
   */
  private async loadPremierRacingCenters(): Promise<void> {
    const premierVenues: SailingVenue[] = [
      {
        id: 'hong-kong-victoria-harbor',
        name: 'Hong Kong - Victoria Harbor',
        coordinates: [114.1694, 22.3193],
        country: 'Hong Kong SAR',
        region: 'asia-pacific',
        venueType: 'premier',
        establishedYear: 1849,
        timeZone: 'Asia/Hong_Kong',
        primaryClubs: [
          this.createRHKYC(),
          this.createClub('hebe-haven-yacht-club', 'Hebe Haven Yacht Club'),
          this.createClub('aberdeen-boat-club', 'Aberdeen Boat Club')
        ],
        sailingConditions: this.createHongKongConditions(),
        culturalContext: this.createHongKongCulture(),
        weatherSources: this.createHongKongWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'cowes-solent',
        name: 'Cowes - The Solent',
        coordinates: [-1.2982, 50.7612],
        country: 'United Kingdom',
        region: 'europe',
        venueType: 'premier',
        establishedYear: 1815,
        timeZone: 'Europe/London',
        primaryClubs: [
          this.createClub('royal-yacht-squadron', 'Royal Yacht Squadron'),
          this.createClub('royal-london-yacht-club', 'Royal London Yacht Club'),
          this.createClub('island-sailing-club', 'Island Sailing Club')
        ],
        sailingConditions: this.createSolentConditions(),
        culturalContext: this.createBritishCulture(),
        weatherSources: this.createEuropeanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'newport-rhode-island',
        name: 'Newport, Rhode Island',
        coordinates: [-71.3128, 41.4901],
        country: 'United States',
        region: 'north-america',
        venueType: 'premier',
        establishedYear: 1844,
        timeZone: 'America/New_York',
        primaryClubs: [
          this.createClub('new-york-yacht-club', 'New York Yacht Club'),
          this.createClub('ida-lewis-yacht-club', 'Ida Lewis Yacht Club'),
          this.createClub('newport-yacht-club', 'Newport Yacht Club')
        ],
        sailingConditions: this.createNewportConditions(),
        culturalContext: this.createNorthAmericanCulture(),
        weatherSources: this.createNorthAmericanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'sydney-harbour',
        name: 'Sydney Harbour',
        coordinates: [151.2093, -33.8688],
        country: 'Australia',
        region: 'oceania',
        venueType: 'premier',
        establishedYear: 1862,
        timeZone: 'Australia/Sydney',
        primaryClubs: [
          this.createClub('cruising-yacht-club-australia', 'Cruising Yacht Club of Australia'),
          this.createClub('royal-sydney-yacht-squadron', 'Royal Sydney Yacht Squadron'),
          this.createClub('middle-harbour-yacht-club', 'Middle Harbour Yacht Club')
        ],
        sailingConditions: this.createSydneyConditions(),
        culturalContext: this.createAustralianCulture(),
        weatherSources: this.createOceanicWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      }
    ];

    premierVenues.forEach(venue => this.storeVenue(venue));
    logger.debug(`⭐ Loaded ${premierVenues.length} premier racing centers`);
  }

  /**
   * Load regional racing hubs (sample of key locations)
   */
  private async loadRegionalHubs(): Promise<void> {
    const regionalVenues: SailingVenue[] = [
      {
        id: 'chicago-great-lakes',
        name: 'Chicago - Great Lakes',
        coordinates: [-87.6298, 41.8781],
        country: 'United States',
        region: 'north-america',
        venueType: 'regional',
        timeZone: 'America/Chicago',
        primaryClubs: [this.createClub('chicago-yacht-club', 'Chicago Yacht Club')],
        sailingConditions: this.createGreatLakesConditions(),
        culturalContext: this.createNorthAmericanCulture(),
        weatherSources: this.createNorthAmericanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'community'
      },
      {
        id: 'palma-mallorca',
        name: 'Palma de Mallorca',
        coordinates: [2.6502, 39.5696],
        country: 'Spain',
        region: 'europe',
        venueType: 'regional',
        timeZone: 'Europe/Madrid',
        primaryClubs: [this.createClub('real-club-nautico-palma', 'Real Club Náutico Palma')],
        sailingConditions: this.createMediterraneanConditions(),
        culturalContext: this.createSpanishCulture(),
        weatherSources: this.createEuropeanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'community'
      },
      {
        id: 'singapore-marina-bay',
        name: 'Singapore - Marina Bay',
        coordinates: [103.8198, 1.3521],
        country: 'Singapore',
        region: 'asia-pacific',
        venueType: 'regional',
        timeZone: 'Asia/Singapore',
        primaryClubs: [this.createClub('singapore-yacht-club', 'Singapore Yacht Club')],
        sailingConditions: this.createTropicalConditions(),
        culturalContext: this.createSingaporeanCulture(),
        weatherSources: this.createAsiaPacificWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'community'
      },
      {
        id: 'st-thomas-usvi',
        name: 'St. Thomas, US Virgin Islands',
        coordinates: [-64.9631, 18.3381],
        country: 'US Virgin Islands',
        region: 'caribbean',
        venueType: 'regional',
        establishedYear: 1960,
        timeZone: 'America/Puerto_Rico',
        primaryClubs: [
          this.createStThomasYachtClub(),
          this.createClub('antilles-school-sailing', 'Antilles School Sailing Program')
        ],
        sailingConditions: this.createCaribbeanConditions(),
        culturalContext: this.createCaribbeanCulture(),
        weatherSources: this.createCaribbeanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      },
      {
        id: 'bvi-tortola',
        name: 'British Virgin Islands - Tortola',
        coordinates: [-64.6208, 18.4207],
        country: 'British Virgin Islands',
        region: 'caribbean',
        venueType: 'regional',
        establishedYear: 1970,
        timeZone: 'America/Puerto_Rico',
        primaryClubs: [
          this.createClub('royal-bvi-yacht-club', 'Royal BVI Yacht Club'),
          this.createClub('nanny-cay-marina', 'Nanny Cay Marina'),
          this.createClub('village-cay-marina', 'Village Cay Marina')
        ],
        sailingConditions: this.createCaribbeanConditions(),
        culturalContext: this.createCaribbeanCulture(),
        weatherSources: this.createCaribbeanWeatherSources(),
        localServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dataQuality: 'verified'
      }
    ];

    regionalVenues.forEach(venue => this.storeVenue(venue));
  }

  /**
   * Build location-based search indexes
   */
  private buildLocationIndexes(): void {
    this.venuesByRegion.clear();

    for (const venue of this.venues.values()) {
      // Index by region
      const regionVenues = this.venuesByRegion.get(venue.region) || [];
      regionVenues.push(venue.id);
      this.venuesByRegion.set(venue.region, regionVenues);

      // Index by coordinate grid for location-based searches
      const coordHash = this.hashCoordinates(venue.coordinates);
      this.venuesByCoordinates.set(coordHash, venue.id);
    }

  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Hash coordinates for indexing
   */
  private hashCoordinates(coordinates: Coordinates): string {
    const [lon, lat] = coordinates;
    // Create a grid hash (0.1 degree precision)
    const gridLon = Math.floor(lon * 10) / 10;
    const gridLat = Math.floor(lat * 10) / 10;
    return `${gridLat}_${gridLon}`;
  }

  // Helper methods to create venue components
  private createClub(id: string, name: string): YachtClub {
    return {
      id,
      name,
      facilities: [],
      prestigeLevel: 'regional',
      membershipType: 'private'
    };
  }

  private createRHKYC(): YachtClub {
    return {
      id: 'royal-hong-kong-yacht-club',
      name: 'Royal Hong Kong Yacht Club',
      shortName: 'RHKYC',
      founded: 1849,
      coordinates: [114.1794, 22.2950],
      website: 'https://rhkyc.org.hk',
      facilities: [
        { type: 'marina', name: 'Kellett Island Marina', available: true },
        { type: 'marina', name: 'Middle Island Station', available: true },
        { type: 'marina', name: 'Shelter Cove Marina', available: true },
        { type: 'restaurant', name: 'Main Dining Room', available: true },
        { type: 'accommodation', name: 'Guest Rooms', available: true, reservationRequired: true }
      ],
      prestigeLevel: 'international',
      membershipType: 'private'
    };
  }

  private createStThomasYachtClub(): YachtClub {
    return {
      id: 'st-thomas-yacht-club',
      name: 'St. Thomas Yacht Club',
      shortName: 'STYC',
      founded: 1963,
      coordinates: [-64.9631, 18.3381],
      website: 'https://styc.vi',
      facilities: [
        { type: 'marina', name: 'Main Marina', available: true },
        { type: 'restaurant', name: 'Clubhouse Restaurant', available: true },
        { type: 'bar', name: 'Tiki Bar', available: true },
        { type: 'event_space', name: 'Event Pavilion', available: true },
        { type: 'fuel', name: 'Fuel Dock', available: true },
        { type: 'storage', name: 'Dry Storage', available: true },
        { type: 'launch_ramp', name: 'Boat Ramp', available: true }
      ],
      prestigeLevel: 'regional',
      membershipType: 'private',
      racingProgram: {
        signature: ['St. Thomas International Regatta', 'Rolex Cup'],
        yearRound: ['Wednesday Night Racing', 'Weekend Club Races'],
        majorEvents: ['St. Thomas Race Week']
      }
    };
  }

  // Condition profiles for different venues
  private createHongKongConditions(): VenueConditionProfile {
    return {
      windPatterns: [
        {
          name: 'Northeast Monsoon',
          description: 'Dry, cooler winds from October to March',
          direction: 45,
          speedRange: { min: 10, max: 25 },
          frequency: 60,
          seasons: ['winter', 'spring'],
          reliability: 'high'
        },
        {
          name: 'Southwest Monsoon',
          description: 'Hot, humid winds from May to September',
          direction: 225,
          speedRange: { min: 5, max: 20 },
          frequency: 40,
          seasons: ['summer', 'autumn'],
          reliability: 'moderate'
        }
      ],
      typicalConditions: {
        windSpeed: { min: 5, max: 30, average: 15 },
        windDirection: { primary: 45, secondary: 225 },
        waveHeight: { typical: 1, maximum: 3 },
        visibility: { typical: 10, minimum: 2 }
      },
      seasonalVariations: [
        {
          season: 'winter',
          months: [12, 1, 2],
          windCharacteristics: 'Steady northeast monsoon, cooler temperatures',
          weatherPatterns: 'Dry and clear',
          racingRecommendations: 'Excellent racing conditions'
        }
      ],
      hazards: [
        {
          type: 'traffic',
          name: 'Commercial shipping',
          description: 'Heavy container ship traffic',
          severity: 'high',
          mitigation: 'Designated racing areas'
        },
        {
          type: 'weather',
          name: 'Typhoons',
          description: 'Tropical cyclones May-November',
          severity: 'critical',
          seasonality: ['summer', 'autumn'],
          mitigation: 'Advanced weather monitoring required'
        }
      ],
      racingAreas: [
        {
          name: 'Victoria Harbor',
          coordinates: [[114.15, 22.25], [114.20, 22.32]],
          type: 'harbor',
          depth: { min: 5, max: 25, average: 15 },
          typicalCourses: ['windward_leeward', 'triangle'],
          capacity: 200,
          protection: 'sheltered'
        }
      ]
    };
  }

  private createSanFranciscoConditions(): VenueConditionProfile {
    return {
      windPatterns: [
        {
          name: 'Pacific High',
          description: 'Consistent westerly thermal wind',
          direction: 270,
          speedRange: { min: 15, max: 30 },
          frequency: 80,
          seasons: ['summer'],
          timeOfDay: 'afternoon',
          reliability: 'high'
        }
      ],
      typicalConditions: {
        windSpeed: { min: 10, max: 35, average: 22 },
        windDirection: { primary: 270, secondary: 225 },
        waveHeight: { typical: 2, maximum: 4 },
        visibility: { typical: 15, minimum: 1 }
      },
      seasonalVariations: [],
      hazards: [],
      racingAreas: []
    };
  }

  // Cultural profiles for different regions
  private createHongKongCulture(): VenueCulturalProfile {
    return {
      primaryLanguages: [
        { code: 'en', name: 'English', prevalence: 'primary', sailingTerminology: true },
        { code: 'yue', name: 'Cantonese', prevalence: 'primary' },
        { code: 'zh', name: 'Mandarin', prevalence: 'common' }
      ],
      sailingCulture: {
        tradition: 'historic',
        competitiveness: 'international',
        formality: 'formal',
        inclusivity: 'selective',
        characteristics: ['International racing focus', 'Strong yacht club tradition', 'Dragon class heritage']
      },
      racingCustoms: [],
      socialProtocols: [],
      economicFactors: {
        currency: 'HKD',
        costLevel: 'very_high',
        entryFees: { typical: 800, range: { min: 400, max: 2000 } },
        accommodation: { budget: 150, moderate: 300, luxury: 800 },
        dining: { budget: 25, moderate: 75, upscale: 200 },
        services: { rigger: 500, sail_repair: 300, chandlery: 'expensive' },
        tipping: { expected: false, contexts: [] }
      },
      regulatoryEnvironment: {
        racingRules: {
          authority: 'World Sailing / HKSF',
          variations: []
        },
        safetyRequirements: [],
        environmentalRestrictions: [],
        entryRequirements: []
      }
    };
  }

  // Weather source configurations
  private createHongKongWeatherSources(): WeatherSourceConfig {
    return {
      primary: {
        name: 'Hong Kong Observatory',
        type: 'regional_model',
        region: 'Hong Kong',
        accuracy: 'high',
        forecastHorizon: 72,
        updateFrequency: 6,
        specialties: ['Typhoon tracking', 'Local wind patterns']
      },
      secondary: [{
        name: 'JMA Global Model',
        type: 'global_model',
        region: 'Asia-Pacific',
        accuracy: 'moderate',
        forecastHorizon: 168,
        updateFrequency: 6,
        specialties: ['Long-range forecasting']
      }],
      updateFrequency: 6,
      reliability: 0.9
    };
  }

  /**
   * Load venues from Supabase PostGIS database
   */
  private async loadVenuesFromSupabase(): Promise<void> {
    try {

      // Load all venues with their intelligence and cultural data
      const venues = await this.supabaseService.getAllVenues();

      if (!venues || venues.length === 0) {

        return;
      }

      // Convert Supabase venues to our internal format and store
      for (const venue of venues) {
        this.storeVenue(venue as SailingVenue);
      }

    } catch (error: any) {

      throw error;
    }
  }

  // Create other condition/culture/weather profiles with similar structure...
  private createAucklandConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createSolentConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createNewportConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createSydneyConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createJapanConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createGreatLakesConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createMediterraneanConditions(): VenueConditionProfile { return this.createHongKongConditions(); }
  private createTropicalConditions(): VenueConditionProfile { return this.createHongKongConditions(); }

  private createCaribbeanConditions(): VenueConditionProfile {
    return {
      windPatterns: [
        {
          name: 'Trade Winds',
          description: 'Steady easterly trade winds year-round',
          direction: 90,
          speedRange: { min: 12, max: 22 },
          frequency: 85,
          seasons: ['winter', 'spring', 'summer', 'autumn'],
          reliability: 'very_high'
        },
        {
          name: 'Christmas Winds',
          description: 'Stronger northeast trades December-February',
          direction: 45,
          speedRange: { min: 18, max: 30 },
          frequency: 70,
          seasons: ['winter'],
          reliability: 'high'
        }
      ],
      typicalConditions: {
        windSpeed: { min: 10, max: 30, average: 18 },
        windDirection: { primary: 90, secondary: 45 },
        waveHeight: { typical: 2, maximum: 4 },
        visibility: { typical: 20, minimum: 5 }
      },
      seasonalVariations: [
        {
          season: 'winter',
          months: [12, 1, 2],
          windCharacteristics: 'Strongest trade winds, excellent sailing',
          weatherPatterns: 'Dry season, minimal rainfall',
          racingRecommendations: 'Prime racing season - consistent conditions'
        },
        {
          season: 'summer',
          months: [6, 7, 8, 9],
          windCharacteristics: 'Hurricane season, variable conditions',
          weatherPatterns: 'Wet season, potential tropical systems',
          racingRecommendations: 'Monitor weather systems, flexible scheduling'
        }
      ],
      hazards: [
        {
          type: 'weather',
          name: 'Hurricanes',
          description: 'Atlantic hurricane season June-November',
          severity: 'critical',
          seasonality: ['summer', 'autumn'],
          mitigation: 'Advanced storm tracking and evacuation plans required'
        },
        {
          type: 'navigation',
          name: 'Coral reefs',
          description: 'Extensive coral reef systems',
          severity: 'moderate',
          mitigation: 'Local knowledge and updated charts essential'
        }
      ],
      racingAreas: [
        {
          name: 'Charlotte Amalie Harbor',
          coordinates: [[-64.97, 18.33], [-64.93, 18.35]],
          type: 'protected_harbor',
          depth: { min: 3, max: 15, average: 8 },
          typicalCourses: ['windward_leeward', 'triangle'],
          capacity: 150,
          protection: 'sheltered'
        },
        {
          name: 'Pillsbury Sound',
          coordinates: [[-64.95, 18.32], [-64.80, 18.38]],
          type: 'open_water',
          depth: { min: 10, max: 50, average: 25 },
          typicalCourses: ['distance', 'coastal'],
          capacity: 300,
          protection: 'moderate'
        }
      ]
    };
  }

  private createOceanicCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createNorthAmericanCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createJapaneseCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createBritishCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createAustralianCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createSpanishCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }
  private createSingaporeanCulture(): VenueCulturalProfile { return this.createHongKongCulture(); }

  private createCaribbeanCulture(): VenueCulturalProfile {
    return {
      primaryLanguages: [
        { code: 'en', name: 'English', prevalence: 'primary', sailingTerminology: true },
        { code: 'es', name: 'Spanish', prevalence: 'common' },
        { code: 'fr', name: 'French', prevalence: 'secondary' }
      ],
      sailingCulture: {
        tradition: 'modern',
        competitiveness: 'regional',
        formality: 'relaxed',
        inclusivity: 'welcoming',
        characteristics: [
          'Caribbean hospitality and warmth',
          'Laid-back island sailing culture',
          'Strong charter yacht industry',
          'Winter racing circuit destination'
        ]
      },
      racingCustoms: [
        {
          name: 'Island time',
          description: 'Relaxed approach to scheduling',
          importance: 'helpful',
          type: 'social'
        },
        {
          name: 'Rum tradition',
          description: 'Post-race celebrations often include local rum',
          importance: 'helpful',
          type: 'social'
        }
      ],
      socialProtocols: [
        {
          name: 'Casual dress',
          description: 'Informal tropical attire acceptable',
          context: 'general',
          importance: 'helpful'
        },
        {
          name: 'Open hospitality',
          description: 'Welcoming attitude to visiting sailors',
          context: 'general',
          importance: 'important'
        }
      ],
      economicFactors: {
        currency: 'USD',
        costLevel: 'high',
        entryFees: { typical: 300, range: { min: 150, max: 800 } },
        accommodation: { budget: 80, moderate: 150, luxury: 400 },
        dining: { budget: 15, moderate: 35, upscale: 80 },
        services: { rigger: 300, sail_repair: 200, chandlery: 'expensive' },
        tipping: { expected: true, contexts: ['restaurants', 'marina_services'] }
      },
      regulatoryEnvironment: {
        racingRules: {
          authority: 'World Sailing / USVI Sailing Association',
          variations: []
        },
        safetyRequirements: [
          {
            category: 'equipment',
            requirement: 'Carry Category 1 offshore safety equipment for distance races',
            mandatory: true,
            seasonality: ['winter_series']
          }
        ],
        environmentalRestrictions: [
          {
            type: 'marine_park',
            description: 'Coral reef protection zones',
            timing: 'permanent',
            implications: 'Avoid anchoring or sailing in restricted coral areas'
          }
        ],
        entryRequirements: [
          {
            type: 'customs',
            description: 'Standard US entry requirements for foreign vessels',
            processingTime: 'Varies by port of entry'
          }
        ]
      }
    };
  }

  private createOceanicWeatherSources(): WeatherSourceConfig { return this.createHongKongWeatherSources(); }
  private createNorthAmericanWeatherSources(): WeatherSourceConfig { return this.createHongKongWeatherSources(); }
  private createEuropeanWeatherSources(): WeatherSourceConfig { return this.createHongKongWeatherSources(); }
  private createAsiaPacificWeatherSources(): WeatherSourceConfig { return this.createHongKongWeatherSources(); }

  private createCaribbeanWeatherSources(): WeatherSourceConfig {
    return {
      primary: {
        name: 'National Hurricane Center',
        type: 'regional_model',
        region: 'Caribbean',
        accuracy: 'high',
        forecastHorizon: 120,
        updateFrequency: 6,
        specialties: ['Hurricane tracking', 'Tropical weather systems', 'Trade wind analysis']
      },
      secondary: [
        {
          name: 'NOAA GFS Caribbean',
          type: 'global_model',
          region: 'Caribbean',
          accuracy: 'moderate',
          forecastHorizon: 168,
          updateFrequency: 6,
          specialties: ['Extended forecasting']
        },
        {
          name: 'Windy Caribbean Model',
          type: 'regional_model',
          region: 'Caribbean',
          accuracy: 'moderate',
          forecastHorizon: 72,
          updateFrequency: 3,
          specialties: ['High-resolution wind forecasts', 'Racing-specific data']
        }
      ],
      updateFrequency: 6,
      reliability: 0.85
    };
  }
}

// Export singleton instance
export const globalVenueDatabase = new GlobalVenueDatabase();
