/**
 * OrgLocationsMap (web) — mini MapLibre instance for the org detail
 * page. Mirrors the native sibling at OrgLocationsMap.tsx. Loads
 * maplibre-gl lazily, auto-fits to the location bounds, and renders
 * a labeled HTML marker per organization_locations row.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ensureMapLibreCss, ensureMapLibreScript } from '@/lib/maplibreWeb';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface OrgLocation {
  id?: string;
  name: string;
  lat: number;
  lng: number;
}

export interface OrgLocationsMapProps {
  locations: OrgLocation[];
  height?: number;
}

function makeMarkerElement(name: string): HTMLDivElement {
  const root = document.createElement('div');
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.gap = '5px';
  root.style.padding = '3px 8px 3px 4px';
  root.style.borderRadius = '10px';
  root.style.background = 'rgba(255,255,255,0.96)';
  root.style.boxShadow = '0 2px 6px rgba(0,0,0,0.16)';
  root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.fontSize = '11px';
  root.style.fontWeight = '600';
  root.style.color = 'rgba(28, 28, 30, 0.92)';
  root.style.letterSpacing = '-0.1px';
  root.style.whiteSpace = 'nowrap';
  root.style.maxWidth = '180px';
  root.style.overflow = 'hidden';
  root.style.textOverflow = 'ellipsis';

  const dot = document.createElement('span');
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.borderRadius = '4px';
  dot.style.background = '#E7893C';
  dot.style.border = '1.5px solid #FFFFFF';
  dot.style.flexShrink = '0';
  root.appendChild(dot);

  const label = document.createElement('span');
  label.textContent = name;
  label.style.overflow = 'hidden';
  label.style.textOverflow = 'ellipsis';
  root.appendChild(label);

  return root;
}

export function OrgLocationsMap({ locations, height = 220 }: OrgLocationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const bounds = useMemo(() => {
    if (locations.length === 0) return null;
    let minLat = locations[0].lat;
    let maxLat = locations[0].lat;
    let minLng = locations[0].lng;
    let maxLng = locations[0].lng;
    for (const l of locations) {
      if (l.lat < minLat) minLat = l.lat;
      if (l.lat > maxLat) maxLat = l.lat;
      if (l.lng < minLng) minLng = l.lng;
      if (l.lng > maxLng) maxLng = l.lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [locations]);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || !bounds) return;

    const init = async () => {
      let maplibregl: any = null;
      try {
        const m = await import('maplibre-gl');
        maplibregl = (m as any).default || m;
      } catch {
        await ensureMapLibreScript('maplibre-gl-script-org');
        maplibregl =
          typeof window !== 'undefined' ? (window as any).maplibregl : null;
      }
      try {
        await import('maplibre-gl/dist/maplibre-gl.css');
      } catch {
        ensureMapLibreCss('maplibre-gl-css-org');
      }
      if (cancelled || !containerRef.current || !maplibregl?.Map) return;

      const center: [number, number] = [
        (bounds.minLng + bounds.maxLng) / 2,
        (bounds.minLat + bounds.maxLat) / 2,
      ];
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center,
        zoom: 13,
        attributionControl: false,
        interactive: true,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        // Fit bounds with a small padding so labels don't clip the edge.
        const { minLat: a, minLng: b, maxLat: c, maxLng: d } = bounds;
        if (a !== c || b !== d) {
          map.fitBounds(
            [
              [b, a],
              [d, c],
            ],
            { padding: 40, maxZoom: 15, duration: 0 },
          );
        }
        markersRef.current = locations.map((loc) =>
          new maplibregl.Marker({ element: makeMarkerElement(loc.name) })
            .setLngLat([loc.lng, loc.lat])
            .addTo(map),
        );
        setIsLoaded(true);
      });
    };

    void init();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [bounds, locations]);

  if (locations.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No mapped locations yet.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!isLoaded ? (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.emptyText}>Loading map…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E9EEF4',
  },
  empty: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#E9EEF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.65)',
  },
});
