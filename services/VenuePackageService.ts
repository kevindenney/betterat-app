/**
 * Venue Package Service
 *
 * Provides OnX Maps-style venue-based offline download packages.
 * Creates pre-configured bundles for specific sailing venues with
 * appropriate zoom levels and layer combinations.
 *
 * Features:
 * - Venue-specific download packages
 * - Smart zoom level selection
 * - Multi-layer downloads (satellite + nautical + bathymetry)
 * - Storage size estimation
 * - Download progress tracking
 */

import type { SailingVenue } from '@/lib/types/global-venues';
import { OfflineTileCacheService, type TileLayerType, type DownloadProgress } from './OfflineTileCacheService';

/**
 * Venue package configuration
 */
export interface VenuePackage {
  venue: SailingVenue;
  layers: TileLayerType[];
  zoomLevels: number[];
  radiusKm: number;
  estimatedSizeMB: number;
  tileCount: number;
}

/**
 * Package download status
 */
export interface PackageDownloadStatus {
  venueId: string;
  venueName: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: DownloadProgress | null;
  downloadedAt: Date | null;
  layers: TileLayerType[];
  sizeOnDiskMB: number;
}

/**
 * Package preset (different use cases)
 */
export type PackagePreset = 'essential' | 'standard' | 'premium' | 'championship';

/**
 * Venue Package Service
 */
export class VenuePackageService {
  private cacheService: OfflineTileCacheService;
  private readonly PACKAGE_METADATA_KEY = '@venue_packages';

  constructor() {
    this.cacheService = new OfflineTileCacheService();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.cacheService.initialize();
  }

  /**
   * Create venue package configuration
   */
  createVenuePackage(
    venue: SailingVenue,
    preset: PackagePreset = 'standard'
  ): VenuePackage {
    const config = this.getPresetConfiguration(preset);
    const bounds = this.getVenueBounds(venue, config.radiusKm);

    // Estimate size for each layer
    let totalTiles = 0;
    let totalSizeMB = 0;

    for (const layer of config.layers) {
      const estimate = this.cacheService.estimateDownloadSize(
        bounds,
        config.zoomLevels,
        this.getAvgTileSizeKB(layer)
      );
      totalTiles += estimate.tileCount;
      totalSizeMB += estimate.estimatedSizeMB;
    }

    return {
      venue,
      layers: config.layers,
      zoomLevels: config.zoomLevels,
      radiusKm: config.radiusKm,
      estimatedSizeMB: Math.round(totalSizeMB * 10) / 10,
      tileCount: totalTiles
    };
  }

  /**
   * Download venue package
   */
  async downloadVenuePackage(
    venuePackage: VenuePackage,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const bounds = this.getVenueBounds(venuePackage.venue, venuePackage.radiusKm);

    // Download each layer sequentially
    for (const layerType of venuePackage.layers) {
      const tileUrlTemplate = this.getTileUrlTemplate(layerType, venuePackage.venue);

      await this.cacheService.downloadArea(
        bounds,
        venuePackage.zoomLevels,
        layerType,
        tileUrlTemplate,
        onProgress
      );
    }

    // Save package metadata
    await this.savePackageMetadata(venuePackage);
  }

  /**
   * Get download status for a venue
   */
  async getPackageStatus(venueId: string): Promise<PackageDownloadStatus | null> {
    const metadata = await this.getPackageMetadata(venueId);
    if (!metadata) return null;

    const stats = await this.cacheService.getCacheStatistics();

    // Calculate size on disk for this venue's layers
    let sizeOnDiskMB = 0;
    metadata.layers.forEach((layer: TileLayerType) => {
      const breakdown = stats.layerBreakdown[layer];
      if (breakdown) {
        sizeOnDiskMB += breakdown.bytes / (1024 * 1024);
      }
    });

    return {
      venueId,
      venueName: metadata.venue.name,
      isDownloaded: true,
      isDownloading: false,
      progress: null,
      downloadedAt: metadata.downloadedAt || null,
      layers: metadata.layers,
      sizeOnDiskMB: Math.round(sizeOnDiskMB * 10) / 10
    };
  }

  /**
   * Get all downloaded packages
   */
  async getAllPackages(): Promise<PackageDownloadStatus[]> {
    const allMetadata = await this.getAllPackageMetadata();
    const packages: PackageDownloadStatus[] = [];

    for (const metadata of allMetadata) {
      const status = await this.getPackageStatus(metadata.venue.id);
      if (status) {
        packages.push(status);
      }
    }

    return packages;
  }

  /**
   * Delete venue package
   */
  async deleteVenuePackage(venueId: string): Promise<void> {
    const metadata = await this.getPackageMetadata(venueId);
    if (!metadata) return;

    // Delete tiles for each layer
    for (const layer of metadata.layers) {
      await this.cacheService.clearCache(layer);
    }

    // Remove metadata
    await this.removePackageMetadata(venueId);
  }

  /**
   * Get recommended package preset for venue type
   */
  getRecommendedPreset(venue: SailingVenue): PackagePreset {
    // Check if this is a championship venue
    const championshipKeywords = ['worlds', 'nationals', 'championship', 'olympic'];
    const isChampionship = championshipKeywords.some(keyword =>
      venue.name.toLowerCase().includes(keyword)
    );

    if (isChampionship) return 'championship';

    // Check if it's a major regatta venue
    const majorVenueKeywords = ['yacht club', 'sailing center', 'marina'];
    const isMajorVenue = majorVenueKeywords.some(keyword =>
      venue.name.toLowerCase().includes(keyword)
    );

    if (isMajorVenue) return 'premium';

    // Default based on venue size/importance
    return 'standard';
  }

  /**
   * Estimate total storage for multiple venues
   */
  estimateMultiVenueStorage(
    venues: SailingVenue[],
    preset: PackagePreset = 'standard'
  ): {
    totalSizeMB: number;
    totalTiles: number;
    perVenue: { venue: SailingVenue; sizeMB: number; tiles: number }[];
  } {
    let totalSizeMB = 0;
    let totalTiles = 0;
    const perVenue: { venue: SailingVenue; sizeMB: number; tiles: number }[] = [];

    for (const venue of venues) {
      const pkg = this.createVenuePackage(venue, preset);
      totalSizeMB += pkg.estimatedSizeMB;
      totalTiles += pkg.tileCount;
      perVenue.push({
        venue,
        sizeMB: pkg.estimatedSizeMB,
        tiles: pkg.tileCount
      });
    }

    return {
      totalSizeMB: Math.round(totalSizeMB * 10) / 10,
      totalTiles,
      perVenue
    };
  }

  /**
   * Check if device has enough storage
   */
  async hasEnoughStorage(requiredMB: number): Promise<boolean> {
    // Try to estimate available storage (browser API)
    if (typeof navigator !== 'undefined' && (navigator as any).storage?.estimate) {
      const estimate = await (navigator as any).storage.estimate();
      const availableMB = (estimate.quota - estimate.usage) / (1024 * 1024);
      return availableMB >= requiredMB * 1.2; // 20% buffer
    }

    // If we can't estimate, assume we have enough (mobile will show system dialog)
    return true;
  }

  // Private helper methods

  private getPresetConfiguration(preset: PackagePreset): {
    layers: TileLayerType[];
    zoomLevels: number[];
    radiusKm: number;
  } {
    switch (preset) {
      case 'essential':
        // Minimal package for quick downloads
        return {
          layers: ['nautical', 'bathymetry'],
          zoomLevels: [10, 11, 12, 13],
          radiusKm: 5
        };

      case 'standard':
        // Balanced package for most sailors
        return {
          layers: ['satellite', 'nautical', 'bathymetry'],
          zoomLevels: [10, 11, 12, 13, 14],
          radiusKm: 10
        };

      case 'premium':
        // Comprehensive package for serious racers
        return {
          layers: ['satellite', 'nautical', 'bathymetry', 'basemap'],
          zoomLevels: [9, 10, 11, 12, 13, 14, 15],
          radiusKm: 15
        };

      case 'championship':
        // Maximum detail for championship events
        return {
          layers: ['satellite', 'nautical', 'bathymetry', 'basemap'],
          zoomLevels: [8, 9, 10, 11, 12, 13, 14, 15, 16],
          radiusKm: 20
        };
    }
  }

  private getVenueBounds(
    venue: SailingVenue,
    radiusKm: number
  ): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const [lng, lat] = venue.coordinates;

    // Convert radius to degrees (approximate)
    const kmPerDegreeLat = 111; // Roughly constant
    const kmPerDegreeLng = 111 * Math.cos((lat * Math.PI) / 180);

    const latDelta = radiusKm / kmPerDegreeLat;
    const lngDelta = radiusKm / kmPerDegreeLng;

    return {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lng + lngDelta,
      west: lng - lngDelta
    };
  }

  private getTileUrlTemplate(layerType: TileLayerType, venue: SailingVenue): string {
    switch (layerType) {
      case 'satellite':
        // Maptiler satellite imagery
        return 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=YOUR_API_KEY';

      case 'nautical':
        // OpenSeaMap
        return 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

      case 'bathymetry':
        // GEBCO or EMODnet based on venue region
        if (venue.region === 'europe') {
          return 'https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.3.0&request=GetMap&layers=mean_atlas_land&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&format=image/png';
        } else {
          return 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?request=GetMap&service=WMS&version=1.3.0&layers=GEBCO_LATEST&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png';
        }

      case 'basemap':
        // Carto Positron (clean basemap)
        return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png';
    }
  }

  private getAvgTileSizeKB(layerType: TileLayerType): number {
    switch (layerType) {
      case 'satellite':
        return 80; // JPEG satellite imagery
      case 'nautical':
        return 30; // PNG with transparency
      case 'bathymetry':
        return 40; // PNG bathymetry
      case 'basemap':
        return 25; // Vector basemap
    }
  }

  private async savePackageMetadata(pkg: VenuePackage): Promise<void> {
    const allMetadata = await this.getAllPackageMetadata();

    const newMetadata = {
      venue: pkg.venue,
      layers: pkg.layers,
      zoomLevels: pkg.zoomLevels,
      radiusKm: pkg.radiusKm,
      downloadedAt: new Date()
    };

    // Add or update
    const index = allMetadata.findIndex(m => m.venue.id === pkg.venue.id);
    if (index >= 0) {
      allMetadata[index] = newMetadata;
    } else {
      allMetadata.push(newMetadata);
    }

    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(this.PACKAGE_METADATA_KEY, JSON.stringify(allMetadata));
  }

  private async getPackageMetadata(venueId: string): Promise<any | null> {
    const allMetadata = await this.getAllPackageMetadata();
    return allMetadata.find(m => m.venue.id === venueId) || null;
  }

  private async getAllPackageMetadata(): Promise<any[]> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const json = await AsyncStorage.getItem(this.PACKAGE_METADATA_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  private async removePackageMetadata(venueId: string): Promise<void> {
    const allMetadata = await this.getAllPackageMetadata();
    const filtered = allMetadata.filter(m => m.venue.id !== venueId);

    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(this.PACKAGE_METADATA_KEY, JSON.stringify(filtered));
  }
}
