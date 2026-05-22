/**
 * InsightsMapView — geographic projection of the competency-evidence grid.
 *
 * Same data as the heatmap, plotted as markers at real lat/lng instead of
 * cells. Each marker sized by total cohort evidence at the site + intensity
 * filled by coverage density. Toggleable from the grid view; the two
 * answer different questions:
 *
 *   Grid:  "which competencies are covered everywhere?"
 *   Map:   "where is my program physically active?"
 *
 * Renders with react-native-svg (already in deps). Bounds auto-fit to the
 * sites in view. Optional layer outlines render major US state borders
 * approximated for the Maryland/DC clinical region — generic enough that
 * non-JHSON orgs still get a reasonable canvas.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect, G } from 'react-native-svg';
import {
  Competency,
  SiteSummary,
  EvidenceCell,
} from '@/hooks/useAdminCompetencyEvidence';

export interface InsightsMapViewProps {
  cohortSize: number;
  sites: SiteSummary[];
  competencies: Competency[];
  evidence: Map<string, EvidenceCell>;
  colTotals: Map<string, { count: number; pct: number }>;
  sitesGeo: Map<string, { lat: number; lng: number }>;
}

export function InsightsMapView({
  cohortSize,
  sites,
  competencies,
  evidence,
  colTotals,
  sitesGeo,
}: InsightsMapViewProps) {
  const [filteredCompetency, setFilteredCompetency] = useState<string | null>(null);

  // Compute bounding box for the sites with geo
  const projected = useMemo(() => {
    const points: { id: string; site: SiteSummary; lat: number; lng: number }[] = [];
    for (const s of sites) {
      const geo = sitesGeo.get(s.id);
      if (!geo) continue;
      points.push({ id: s.id, site: s, lat: geo.lat, lng: geo.lng });
    }
    if (points.length === 0) {
      return { points: [], project: () => ({ x: 0, y: 0 }), bounds: null };
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    // Pad bounds so markers aren't at canvas edges
    const padLat = Math.max(0.05, (maxLat - minLat) * 0.18);
    const padLng = Math.max(0.05, (maxLng - minLng) * 0.18);
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;
    return {
      points,
      bounds: { minLat, maxLat, minLng, maxLng },
      project: (lat: number, lng: number, W: number, H: number) => ({
        x: ((lng - minLng) / (maxLng - minLng)) * W,
        y: H - ((lat - minLat) / (maxLat - minLat)) * H,
      }),
    };
  }, [sites, sitesGeo]);

  // Coverage per site (filtered or total)
  function siteCoverageNum(siteId: string): { count: number; intensity: number; label: string } {
    if (filteredCompetency) {
      const cell = evidence.get(`${filteredCompetency}::${siteId}`);
      return {
        count: cell?.count ?? 0,
        intensity: cell?.intensity ?? 0,
        label: `${cell?.count ?? 0} of ${cohortSize}`,
      };
    }
    const total = colTotals.get(siteId) ?? { count: 0, pct: 0 };
    return {
      count: total.count,
      intensity: total.pct,
      label: `${total.count} steps logged`,
    };
  }

  const VIEW_W = 820;
  const VIEW_H = 420;

  return (
    <View style={s.wrap}>
      {/* Competency filter pills */}
      <View style={s.filterRow}>
        <FilterPill
          label="All competencies"
          active={!filteredCompetency}
          onPress={() => setFilteredCompetency(null)}
        />
        {competencies.map((c) => (
          <FilterPill
            key={c.id}
            label={c.shortLabel}
            active={filteredCompetency === c.id}
            onPress={() => setFilteredCompetency(c.id)}
          />
        ))}
      </View>

      <View style={s.canvasWrap}>
        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%">
          {/* Soft warm-cream backdrop */}
          <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#FAFAF7" />

          {/* Lat/Lng gridlines */}
          {projected.bounds ? (
            <G>
              {[0.25, 0.5, 0.75].map((p, i) => (
                <Line
                  key={`vl-${i}`}
                  x1={p * VIEW_W}
                  y1={0}
                  x2={p * VIEW_W}
                  y2={VIEW_H}
                  stroke="#E5E5EA"
                  strokeWidth={0.5}
                  strokeDasharray="3 5"
                />
              ))}
              {[0.25, 0.5, 0.75].map((p, i) => (
                <Line
                  key={`hl-${i}`}
                  x1={0}
                  y1={p * VIEW_H}
                  x2={VIEW_W}
                  y2={p * VIEW_H}
                  stroke="#E5E5EA"
                  strokeWidth={0.5}
                  strokeDasharray="3 5"
                />
              ))}
            </G>
          ) : null}

          {/* Connecting lines between sites — implies "program network" */}
          {projected.points.length > 1 ? (
            <G opacity={0.18}>
              {projected.points.map((p, i) =>
                projected.points.slice(i + 1).map((q, j) => {
                  const a = projected.project(p.lat, p.lng, VIEW_W, VIEW_H);
                  const b = projected.project(q.lat, q.lng, VIEW_W, VIEW_H);
                  return (
                    <Line
                      key={`con-${i}-${j}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#28406B"
                      strokeWidth={1}
                    />
                  );
                }),
              )}
            </G>
          ) : null}

          {/* Site markers */}
          {projected.points.map((p) => {
            const { x, y } = projected.project(p.lat, p.lng, VIEW_W, VIEW_H);
            const cov = siteCoverageNum(p.id);
            const radius = 18 + cov.intensity * 28;
            const fill = intensityFill(cov.intensity);
            return (
              <G key={p.id}>
                {/* Soft halo */}
                <Circle cx={x} cy={y} r={radius + 6} fill={fill} opacity={0.18} />
                {/* Inner disc */}
                <Circle cx={x} cy={y} r={radius} fill={fill} opacity={0.85} />
                {/* Count text */}
                <SvgText
                  x={x}
                  y={y + 5}
                  fontSize={14}
                  fontWeight="700"
                  fill={cov.intensity > 0.45 ? '#FFFFFF' : '#1C1C1E'}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {cov.count}
                </SvgText>
                {/* Site short name */}
                <SvgText
                  x={x}
                  y={y + radius + 16}
                  fontSize={11}
                  fontWeight="600"
                  fill="#1C1C1E"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {p.site.short}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={s.legend}>
        <View style={s.legendCol}>
          <Text style={s.legendLabel}>Marker size + color</Text>
          <Text style={s.legendCaption}>
            {filteredCompetency
              ? 'Cohort members who evidenced this competency at each site'
              : 'Total step activity across all competencies at each site'}
          </Text>
        </View>
        <View style={s.legendStats}>
          <View style={s.legendStat}>
            <Text style={s.legendStatNum}>{projected.points.length}</Text>
            <Text style={s.legendStatLabel}>Sites in view</Text>
          </View>
          <View style={s.legendStat}>
            <Text style={s.legendStatNum}>
              {Array.from(sitesGeo.values()).length}
            </Text>
            <Text style={s.legendStatLabel}>With coords</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.pill, active && s.pillActive]}
    >
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function intensityFill(v: number): string {
  if (v <= 0) return '#D1D1D6';
  if (v < 0.15) return 'rgba(40, 64, 107, 0.30)';
  if (v < 0.3) return 'rgba(40, 64, 107, 0.45)';
  if (v < 0.5) return 'rgba(40, 64, 107, 0.6)';
  if (v < 0.7) return 'rgba(40, 64, 107, 0.75)';
  return '#28406B';
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    padding: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAF7',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  pillActive: { backgroundColor: '#28406B', borderColor: '#28406B' },
  pillText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  canvasWrap: {
    height: 420,
    backgroundColor: '#FAFAF7',
  },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FAFAF7',
  },
  legendCol: { flex: 1, minWidth: 0 },
  legendLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  legendCaption: {
    marginTop: 3,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.85)',
  },
  legendStats: { flexDirection: 'row', gap: 18 },
  legendStat: { alignItems: 'flex-end' },
  legendStatNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  legendStatLabel: {
    fontSize: 10,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
