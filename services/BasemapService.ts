/**
 * Basemap Service
 *
 * Manages basemap styles for the nautical mapping system.
 * Provides 4 basemap types similar to OnX Maps: Satellite, Nautical Chart, Hybrid, and Vector.
 *
 * Integrates with MapLibre GL JS to provide professional-grade map visualization.
 */

export type BasemapType = 'satellite' | 'nautical' | 'hybrid' | 'vector';

export interface BasemapStyle {
  id: BasemapType;
  name: string;
  description: string;
  style: any; // MapLibre Style Specification
  attribution: string;
  icon: string;
}

export interface BasemapConfig {
  preferredBasemap: BasemapType;
  satelliteProvider: 'maptiler' | 'esri' | 'custom';
  nauticalProvider: 'openseamap' | 'noaa' | 'custom';
  showAttribution: boolean;
}

/**
 * Basemap Service
 */
export class BasemapService {
  private currentBasemap: BasemapType = 'nautical';
  private config: BasemapConfig;

  constructor(config?: Partial<BasemapConfig>) {
    this.config = {
      preferredBasemap: 'nautical',
      satelliteProvider: 'maptiler',
      nauticalProvider: 'openseamap',
      showAttribution: true,
      ...config
    };

    this.currentBasemap = this.config.preferredBasemap;
  }

  /**
   * Get all available basemap styles
   */
  getAvailableBasemaps(): BasemapStyle[] {
    return [
      {
        id: 'satellite',
        name: 'Satellite',
        description: 'High-resolution aerial imagery',
        style: this.getSatelliteStyle(),
        attribution: this.getSatelliteAttribution(),
        icon: '🛰️'
      },
      {
        id: 'nautical',
        name: 'Nautical Chart',
        description: 'Marine navigation chart with depth contours',
        style: this.getNauticalStyle(),
        attribution: this.getNauticalAttribution(),
        icon: '⚓'
      },
      {
        id: 'hybrid',
        name: 'Hybrid',
        description: 'Satellite imagery with nautical overlays',
        style: this.getHybridStyle(),
        attribution: this.getHybridAttribution(),
        icon: '🗺️'
      },
      {
        id: 'vector',
        name: 'Vector',
        description: 'Clean minimal base for racing overlays',
        style: this.getVectorStyle(),
        attribution: this.getVectorAttribution(),
        icon: '📍'
      }
    ];
  }

  /**
   * Get basemap by type
   */
  getBasemap(type: BasemapType): BasemapStyle | undefined {
    return this.getAvailableBasemaps().find(b => b.id === type);
  }

  /**
   * Get current basemap type
   */
  getCurrentBasemap(): BasemapType {
    return this.currentBasemap;
  }

  /**
   * Set current basemap
   */
  setCurrentBasemap(type: BasemapType): void {
    this.currentBasemap = type;
  }

  /**
   * Get next basemap in rotation
   */
  getNextBasemap(): BasemapType {
    const basemaps: BasemapType[] = ['satellite', 'nautical', 'hybrid', 'vector'];
    const currentIndex = basemaps.indexOf(this.currentBasemap);
    const nextIndex = (currentIndex + 1) % basemaps.length;
    return basemaps[nextIndex];
  }

  // ==================== STYLE GENERATORS ====================

  /**
   * Satellite basemap style
   */
  private getSatelliteStyle(): any {
    if (this.config.satelliteProvider === 'maptiler') {
      return {
        version: 8,
        name: 'Satellite',
        sources: {
          'satellite': {
            type: 'raster',
            tiles: [
              'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=get_own_OpIi9ZULNHzrRTmY'
            ],
            tileSize: 512,
            attribution: '© MapTiler © OpenStreetMap contributors',
            maxzoom: 19
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#0a1929'
            }
          },
          {
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-opacity': 1.0,
              'raster-fade-duration': 300
            }
          }
        ]
      };
    }

    // ESRI World Imagery (free, no API key required)
    return {
      version: 8,
      name: 'Satellite',
      sources: {
        'satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri',
          maxzoom: 18
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#0a1929'
          }
        },
        {
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
          paint: {
            'raster-opacity': 1.0
          }
        }
      ]
    };
  }

  /**
   * Nautical chart basemap style
   */
  private getNauticalStyle(): any {
    return {
      version: 8,
      name: 'Nautical Chart',
      sources: {
        'osm-base': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19
        },
        'openseamap': {
          type: 'raster',
          tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenSeaMap contributors',
          maxzoom: 18
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#E8F4FD' // Light blue ocean color
          }
        },
        {
          id: 'osm-base',
          type: 'raster',
          source: 'osm-base',
          paint: {
            'raster-opacity': 0.8
          }
        },
        {
          id: 'openseamap',
          type: 'raster',
          source: 'openseamap',
          paint: {
            'raster-opacity': 1.0
          }
        }
      ]
    };
  }

  /**
   * Hybrid basemap style (Satellite + Nautical overlays)
   */
  private getHybridStyle(): any {
    return {
      version: 8,
      name: 'Hybrid',
      sources: {
        'satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri',
          maxzoom: 18
        },
        'openseamap': {
          type: 'raster',
          tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenSeaMap contributors',
          maxzoom: 18
        },
        'osm-labels': {
          type: 'raster',
          tiles: [
            'https://tiles.stadiamaps.com/tiles/stamen_terrain_labels/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© Stamen Design © OpenStreetMap contributors',
          maxzoom: 18
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#0a1929'
          }
        },
        {
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
          paint: {
            'raster-opacity': 1.0
          }
        },
        {
          id: 'openseamap',
          type: 'raster',
          source: 'openseamap',
          paint: {
            'raster-opacity': 0.9
          }
        },
        {
          id: 'labels',
          type: 'raster',
          source: 'osm-labels',
          paint: {
            'raster-opacity': 0.8
          }
        }
      ]
    };
  }

  /**
   * Vector basemap style (Clean minimal base for racing overlays)
   */
  private getVectorStyle(): any {
    return {
      version: 8,
      name: 'Vector',
      sources: {
        'carto-positron': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© CARTO © OpenStreetMap contributors',
          maxzoom: 20
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#f8f9fa'
          }
        },
        {
          id: 'carto-positron',
          type: 'raster',
          source: 'carto-positron',
          paint: {
            'raster-opacity': 1.0,
            'raster-saturation': -0.5 // Reduce saturation for cleaner look
          }
        }
      ]
    };
  }

  // ==================== ATTRIBUTION ====================

  private getSatelliteAttribution(): string {
    if (this.config.satelliteProvider === 'maptiler') {
      return '© MapTiler © OpenStreetMap contributors';
    }
    return '© Esri © DigitalGlobe © GeoEye © Earthstar Geographics';
  }

  private getNauticalAttribution(): string {
    return '© OpenStreetMap contributors © OpenSeaMap';
  }

  private getHybridAttribution(): string {
    return '© Esri © OpenSeaMap © Stamen Design';
  }

  private getVectorAttribution(): string {
    return '© CARTO © OpenStreetMap contributors';
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get basemap name for display
   */
  getBasemapName(type: BasemapType): string {
    const basemap = this.getBasemap(type);
    return basemap?.name || 'Unknown';
  }

  /**
   * Get basemap icon for UI
   */
  getBasemapIcon(type: BasemapType): string {
    const basemap = this.getBasemap(type);
    return basemap?.icon || '🗺️';
  }

  /**
   * Check if basemap supports bathymetry overlay
   */
  supportsBathymetry(type: BasemapType): boolean {
    return type === 'nautical' || type === 'hybrid';
  }

  /**
   * Check if basemap supports satellite imagery
   */
  supportsSatellite(type: BasemapType): boolean {
    return type === 'satellite' || type === 'hybrid';
  }

  /**
   * Get recommended basemap for venue
   */
  getRecommendedBasemapForVenue(venueType: 'coastal' | 'offshore' | 'harbor'): BasemapType {
    switch (venueType) {
      case 'coastal':
        return 'hybrid'; // Satellite + nautical is best for coastal
      case 'offshore':
        return 'nautical'; // Pure nautical chart for offshore
      case 'harbor':
        return 'satellite'; // Satellite for detailed harbor views
      default:
        return 'nautical';
    }
  }

  /**
   * Save basemap preference
   */
  savePreference(type: BasemapType): void {
    this.currentBasemap = type;
    // In a real implementation, this would persist to localStorage or user preferences
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('preferredBasemap', type);
    }
  }

  /**
   * Load basemap preference
   */
  loadPreference(): BasemapType {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('preferredBasemap') as BasemapType | null;
      if (saved && ['satellite', 'nautical', 'hybrid', 'vector'].includes(saved)) {
        this.currentBasemap = saved;
        return saved;
      }
    }
    return this.config.preferredBasemap;
  }
}

/**
 * Default basemap service instance
 */
export const basemapService = new BasemapService();

/**
 * Get basemap style for MapLibre GL JS
 */
export function getBasemapStyle(type: BasemapType): any {
  const basemap = basemapService.getBasemap(type);
  return basemap?.style;
}

/**
 * Get all basemap options for UI
 */
export function getBasemapOptions(): {
  id: BasemapType;
  name: string;
  icon: string;
  description: string;
}[] {
  return basemapService.getAvailableBasemaps().map(b => ({
    id: b.id,
    name: b.name,
    icon: b.icon,
    description: b.description
  }));
}
