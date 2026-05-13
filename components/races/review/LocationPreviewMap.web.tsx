/**
 * LocationPreviewMap (Web) - OpenStreetMap tiles showing race location
 * Loads a grid of tiles and offsets them so the exact coordinate is centered.
 * No API key required.
 */

import React from 'react';
import { View } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface LocationPreviewMapProps {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
}

const TILE_SIZE = 256;

/**
 * Convert lat/lng to fractional tile x/y at a given zoom level (Slippy Map convention).
 * Returns floating-point values — the integer part is the tile index,
 * the fractional part is where the coordinate falls within that tile.
 */
function latLngToTileFractional(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function LocationPreviewMap({ latitude, longitude, width, height }: LocationPreviewMapProps) {
  const zoom = 13;
  const { x: fracX, y: fracY } = latLngToTileFractional(latitude, longitude, zoom);

  // Integer tile indices
  const tileX = Math.floor(fracX);
  const tileY = Math.floor(fracY);

  // Pixel position of the coordinate within its tile (0–256)
  const pixelInTileX = (fracX - tileX) * TILE_SIZE;
  const pixelInTileY = (fracY - tileY) * TILE_SIZE;

  // We build a 3×3 grid of tiles. The center tile is (tileX, tileY).
  // The grid is 3*256 = 768px wide/tall.
  // The coordinate falls at pixel (256 + pixelInTileX, 256 + pixelInTileY) in the grid.
  // We want that pixel to be at the center of the visible container (width/2, height/2).
  const gridOffsetX = width / 2 - (TILE_SIZE + pixelInTileX);
  const gridOffsetY = height / 2 - (TILE_SIZE + pixelInTileY);

  const tiles: { dx: number; dy: number; url: string }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      tiles.push({
        dx,
        dy,
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
      });
    }
  }

  return (
    <View style={{ width, height, borderRadius: 10, overflow: 'hidden', position: 'relative' as const }}>
      {/* Tile grid — positioned so the coordinate is at the container center */}
      <div
        style={{
          position: 'absolute',
          left: gridOffsetX,
          top: gridOffsetY,
          width: TILE_SIZE * 3,
          height: TILE_SIZE * 3,
          filter: 'saturate(0.7) brightness(1.05)',
        }}
      >
        {tiles.map(({ dx, dy, url }) => (
          <img
            key={`${dx}_${dy}`}
            src={url}
            width={TILE_SIZE}
            height={TILE_SIZE}
            alt=""
            style={{
              position: 'absolute',
              left: (dx + 1) * TILE_SIZE,
              top: (dy + 1) * TILE_SIZE,
              display: 'block',
              width: TILE_SIZE,
              height: TILE_SIZE,
            }}
          />
        ))}
      </div>

      {/* Center pin marker — always at the visible center */}
      <View
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          // @ts-ignore web-only transform
          transform: 'translate(-50%, -100%)',
        }}
      >
        <MapPin size={28} color="#FF3B30" fill="#FF3B30" />
      </View>
    </View>
  );
}
