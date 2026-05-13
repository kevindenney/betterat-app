/**
 * Venue Adaptive Map Service
 *
 * Automatically adapts map data sources, environmental layers, and visualization
 * based on current sailing venue. OnX Maps-style intelligent venue switching.
 *
 * Features:
 * - GPS-based venue detection
 * - Automatic data source selection (NOAA/GEBCO/EMODnet)
 * - Weather API switching (HKO/NOAA/ECMWF by region)
 * - Environmental layer auto-configuration
 * - Offline data prioritization
 */

import type { SailingVenue } from '@/lib/types/global-venues';

/**
 * Regional data source configuration
 */
export interface RegionalDataSources {
  bathymetry: 'GEBCO' | 'EMODnet' | 'NOAA';
  nauticalCharts: 'OpenSeaMap' | 'NOAA_ENC' | 'UK_Admiralty';
  weather: 'OpenWeatherMap' | 'NOAA' | 'HKO' | 'ECMWF' | 'BOM';
  tidal: 'NOAA_COOPS' | 'UK_Admiralty' | 'JMA' | 'BOM' | null;
  current: 'NOAA_Currents' | 'RTOFS' | null;
}

/**
 * Venue adaptation configuration
 */
export interface VenueAdaptation {
  venue: SailingVenue;
  dataSources: RegionalDataSources;
  environmentalLayers: {
    tidalEnabled: boolean;
    currentEnabled: boolean;
    windEnabled: boolean;
  };
  recommendedZoomRange: { min: number; max: number };
  offlineAvailable: boolean;
}

/**
 * Venue detection result
 */
export interface VenueDetectionResult {
  venue: SailingVenue | null;
  distance: number; // km from user to venue
  confidence: 'high' | 'medium' | 'low';
  isWithinBounds: boolean;
}

/**
 * Venue Adaptive Map Service
 */
export class VenueAdaptiveMapService {
  private currentVenue: SailingVenue | null = null;
  private currentAdaptation: VenueAdaptation | null = null;
  private venueChangeCallbacks: ((venue: SailingVenue) => void)[] = [];

  /**
   * Detect venue from GPS coordinates
   */
  async detectVenueFromGPS(
    latitude: number,
    longitude: number,
    venues: SailingVenue[]
  ): Promise<VenueDetectionResult> {
    let closestVenue: SailingVenue | null = null;
    let minDistance = Infinity;

    // Find closest venue
    for (const venue of venues) {
      const distance = this.calculateDistance(
        [longitude, latitude],
        venue.coordinates
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestVenue = venue;
      }
    }

    if (!closestVenue) {
      return {
        venue: null,
        distance: 0,
        confidence: 'low',
        isWithinBounds: false
      };
    }

    // Determine confidence based on distance
    const isWithinBounds = minDistance <= 20; // Within 20km
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (minDistance <= 5) confidence = 'high';
    else if (minDistance <= 15) confidence = 'medium';

    return {
      venue: closestVenue,
      distance: minDistance,
      confidence,
      isWithinBounds
    };
  }

  /**
   * Switch to a venue and adapt map configuration
   */
  async switchToVenue(venue: SailingVenue): Promise<VenueAdaptation> {
    const adaptation = this.createVenueAdaptation(venue);

    this.currentVenue = venue;
    this.currentAdaptation = adaptation;

    // Notify listeners
    this.venueChangeCallbacks.forEach(callback => callback(venue));

    return adaptation;
  }

  /**
   * Create venue-specific adaptation configuration
   */
  createVenueAdaptation(venue: SailingVenue): VenueAdaptation {
    const dataSources = this.getRegionalDataSources(venue);
    const environmentalLayers = this.getEnvironmentalLayerConfig(venue);
    const recommendedZoomRange = this.getRecommendedZoomRange(venue);

    return {
      venue,
      dataSources,
      environmentalLayers,
      recommendedZoomRange,
      offlineAvailable: false // Would check VenuePackageService
    };
  }

  /**
   * Get regional data sources for venue
   */
  private getRegionalDataSources(venue: SailingVenue): RegionalDataSources {
    const { country, region } = venue;

    // United States
    if (country === 'US') {
      return {
        bathymetry: 'NOAA',
        nauticalCharts: 'NOAA_ENC',
        weather: 'NOAA',
        tidal: 'NOAA_COOPS',
        current: 'NOAA_Currents'
      };
    }

    // Hong Kong
    if (country === 'HK') {
      return {
        bathymetry: 'GEBCO',
        nauticalCharts: 'OpenSeaMap',
        weather: 'HKO',
        tidal: null,
        current: null
      };
    }

    // Europe
    if (region === 'europe') {
      return {
        bathymetry: 'EMODnet',
        nauticalCharts: country === 'UK' ? 'UK_Admiralty' : 'OpenSeaMap',
        weather: 'ECMWF',
        tidal: country === 'UK' ? 'UK_Admiralty' : null,
        current: null
      };
    }

    // Australia
    if (country === 'AU') {
      return {
        bathymetry: 'GEBCO',
        nauticalCharts: 'OpenSeaMap',
        weather: 'BOM',
        tidal: 'BOM',
        current: null
      };
    }

    // Japan
    if (country === 'JP') {
      return {
        bathymetry: 'GEBCO',
        nauticalCharts: 'OpenSeaMap',
        weather: 'OpenWeatherMap',
        tidal: 'JMA',
        current: null
      };
    }

    // Default (global)
    return {
      bathymetry: 'GEBCO',
      nauticalCharts: 'OpenSeaMap',
      weather: 'OpenWeatherMap',
      tidal: null,
      current: null
    };
  }

  /**
   * Get environmental layer configuration
   */
  private getEnvironmentalLayerConfig(venue: SailingVenue): {
    tidalEnabled: boolean;
    currentEnabled: boolean;
    windEnabled: boolean;
  } {
    const { country } = venue;

    // Enable all layers for US venues (NOAA data available)
    if (country === 'US') {
      return {
        tidalEnabled: true,
        currentEnabled: true,
        windEnabled: true
      };
    }

    // Tidal data available for UK, AU, JP
    const tidalCountries = ['UK', 'AU', 'JP'];
    const tidalEnabled = tidalCountries.includes(country);

    // Wind always available (global weather APIs)
    return {
      tidalEnabled,
      currentEnabled: country === 'US', // Only US has current predictions
      windEnabled: true
    };
  }

  /**
   * Get recommended zoom range for venue
   */
  private getRecommendedZoomRange(venue: SailingVenue): { min: number; max: number } {
    // Larger venues need wider zoom range
    const venueSize = this.estimateVenueSize(venue);

    if (venueSize === 'small') {
      return { min: 12, max: 16 }; // Small harbor
    } else if (venueSize === 'medium') {
      return { min: 10, max: 15 }; // Bay
    } else {
      return { min: 8, max: 14 }; // Large area
    }
  }

  /**
   * Estimate venue size category
   */
  private estimateVenueSize(venue: SailingVenue): 'small' | 'medium' | 'large' {
    const name = venue.name.toLowerCase();

    if (name.includes('harbor') || name.includes('marina')) {
      return 'small';
    }

    if (name.includes('bay') || name.includes('sound')) {
      return 'medium';
    }

    return 'large';
  }

  /**
   * Register callback for venue changes
   */
  onVenueChange(callback: (venue: SailingVenue) => void): () => void {
    this.venueChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.venueChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.venueChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current venue
   */
  getCurrentVenue(): SailingVenue | null {
    return this.currentVenue;
  }

  /**
   * Get current adaptation
   */
  getCurrentAdaptation(): VenueAdaptation | null {
    return this.currentAdaptation;
  }

  /**
   * Get tile URL for venue-specific source
   */
  getTileUrl(
    layerType: 'bathymetry' | 'nautical' | 'satellite',
    venue: SailingVenue
  ): string {
    const sources = this.getRegionalDataSources(venue);

    switch (layerType) {
      case 'bathymetry':
        switch (sources.bathymetry) {
          case 'NOAA':
            return 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer/tile/{z}/{y}/{x}';
          case 'EMODnet':
            return 'https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.3.0&request=GetMap&layers=mean_atlas_land&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&format=image/png';
          case 'GEBCO':
          default:
            return 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?request=GetMap&service=WMS&version=1.3.0&layers=GEBCO_LATEST&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png';
        }

      case 'nautical':
        switch (sources.nauticalCharts) {
          case 'NOAA_ENC':
            return 'https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/rest/services/RNC/NOAA_RNC/MapServer/tile/{z}/{y}/{x}';
          case 'UK_Admiralty':
            // Would use UK Admiralty API if available
            return 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
          case 'OpenSeaMap':
          default:
            return 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
        }

      case 'satellite':
        return 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=YOUR_API_KEY';
    }
  }

  /**
   * Get weather API endpoint for venue
   */
  getWeatherApiEndpoint(venue: SailingVenue): {
    provider: string;
    endpoint: string;
    requiresApiKey: boolean;
  } {
    const sources = this.getRegionalDataSources(venue);

    switch (sources.weather) {
      case 'NOAA':
        return {
          provider: 'NOAA',
          endpoint: 'https://api.weather.gov',
          requiresApiKey: false
        };

      case 'HKO':
        return {
          provider: 'Hong Kong Observatory',
          endpoint: 'https://data.weather.gov.hk/weatherAPI',
          requiresApiKey: true
        };

      case 'ECMWF':
        return {
          provider: 'ECMWF',
          endpoint: 'https://api.ecmwf.int',
          requiresApiKey: true
        };

      case 'BOM':
        return {
          provider: 'Australia BOM',
          endpoint: 'http://www.bom.gov.au/fwo',
          requiresApiKey: false
        };

      case 'OpenWeatherMap':
      default:
        return {
          provider: 'OpenWeatherMap',
          endpoint: 'https://api.openweathermap.org/data/2.5',
          requiresApiKey: true
        };
    }
  }

  /**
   * Check if venue has multi-location racing areas
   */
  isMultiVenueClub(venue: SailingVenue): boolean {
    // Check for known multi-venue clubs
    const multiVenueKeywords = [
      'royal hong kong yacht club', // RHKYC has 3 locations
      'royal yacht squadron', // Multiple racing areas
      'new york yacht club' // Multiple stations
    ];

    const name = venue.name.toLowerCase();
    return multiVenueKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Get racing areas for multi-venue club
   */
  getMultiVenueRacingAreas(venue: SailingVenue): {
    name: string;
    coordinates: [number, number];
    description: string;
  }[] {
    const name = venue.name.toLowerCase();

    // RHKYC has 3 racing areas
    if (name.includes('royal hong kong yacht club')) {
      return [
        {
          name: 'Middle Island',
          coordinates: [114.3025, 22.2847],
          description: 'Offshore racing area east of Hong Kong Island'
        },
        {
          name: 'Clearwater Bay',
          coordinates: [114.3167, 22.2667],
          description: 'Sheltered bay racing area with Dragon course'
        },
        {
          name: 'Kellett Island',
          coordinates: [114.1833, 22.2833],
          description: 'Club headquarters and harbor racing'
        }
      ];
    }

    return [];
  }

  // Private helper methods

  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(coord2[1] - coord1[1]);
    const dLon = this.toRad(coord2[0] - coord1[0]);
    const lat1 = this.toRad(coord1[1]);
    const lat2 = this.toRad(coord2[1]);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
