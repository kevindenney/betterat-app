import { supabase } from './supabase';
import type { EvidenceStrength } from '@/components/step/reflect-tab/CapabilitiesPracticed';
import { levelIndexForEvidenceRows } from './CapabilityAggregationService';

export interface EvidencePoint {
  capturedAt: string;
  capabilityId: string;
  capabilityName: string;
  strength: EvidenceStrength;
  levelAtTime: 0 | 1 | 2 | 3 | 4;
}

export interface SettledRange {
  startAt: string;
  endAt: string;
  pathName: string;
}

export interface ArcPlotPoint {
  x: number;
  y: number;
  strength: EvidenceStrength;
  capturedAt: string;
  capabilityId: string;
  capabilityName: string;
}

export interface SettledMarker {
  x: number;
  y: number;
  pathName: string;
  capturedAt: string;
}

export interface BecomingArcData {
  startedAt: string;
  evidencePoints: EvidencePoint[];
  settledRanges: SettledRange[];
  nowAt: string;
  bezierPath: string;
  settledWashPath: string | null;
  plotPoints: ArcPlotPoint[];
  settledMarkers: SettledMarker[];
  nowPoint: { x: number; y: number };
  yearTicks: { x: number; label: string }[];
}

interface TimelineStepArcRecord {
  id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  status: string;
}

interface CapabilityEvidenceRowRecord {
  capability_id: string;
  capability_name: string;
  strength: EvidenceStrength;
  created_at: string;
  step_id: string;
}

const BASELINE_Y = 100;
const PLOT_LEFT = 4;
const PLOT_RIGHT = 316;

export async function getArcData(
  userId: string,
  interestId: string,
): Promise<BecomingArcData> {
  const { data: stepsData, error: stepsError } = await supabase
    .from('timeline_steps')
    .select('id, created_at, updated_at, completed_at, status')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .order('created_at', { ascending: true });

  if (stepsError) throw stepsError;

  const steps = (stepsData ?? []) as TimelineStepArcRecord[];
  const startedAt = steps[0]?.created_at ?? new Date().toISOString();
  const nowAt = new Date().toISOString();
  const stepIds = steps.map((step) => step.id);

  const { data: evidenceData, error: evidenceError } = stepIds.length
    ? await supabase
        .from('step_capability_evidence')
        .select('capability_id, capability_name, strength, created_at, step_id')
        .eq('confirmed', true)
        .in('step_id', stepIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null };

  if (evidenceError) throw evidenceError;

  const evidencePoints = buildEvidencePoints(
    (evidenceData ?? []) as CapabilityEvidenceRowRecord[],
  );
  const plotPoints = evidencePoints.map((point) => ({
    x: xForDate(point.capturedAt, startedAt, nowAt),
    y: yForLevel(point.levelAtTime),
    strength: point.strength,
    capturedAt: point.capturedAt,
    capabilityId: point.capabilityId,
    capabilityName: point.capabilityName,
  }));
  const settledRanges = buildSettledRanges(steps);
  const bezierPath = buildSmoothPath(plotPoints);
  const settledWashPath = plotPoints.length > 0 ? buildWashPath(plotPoints) : null;
  const settledMarkers = settledRanges.map((range) => {
    const x = xForDate(range.endAt, startedAt, nowAt);
    const nearestPoint =
      [...plotPoints]
        .reverse()
        .find((point) => point.capturedAt <= range.endAt) ?? plotPoints[plotPoints.length - 1];
    return {
      x,
      y: nearestPoint?.y ?? BASELINE_Y,
      pathName: range.pathName,
      capturedAt: range.endAt,
    };
  });
  const nowPoint = plotPoints.length
    ? { x: xForDate(nowAt, startedAt, nowAt), y: plotPoints[plotPoints.length - 1].y }
    : { x: xForDate(nowAt, startedAt, nowAt), y: BASELINE_Y };

  return {
    startedAt,
    evidencePoints,
    settledRanges,
    nowAt,
    bezierPath,
    settledWashPath,
    plotPoints,
    settledMarkers,
    nowPoint,
    yearTicks: buildYearTicks(startedAt, nowAt),
  };
}

function buildEvidencePoints(rows: CapabilityEvidenceRowRecord[]): EvidencePoint[] {
  const counts = new Map<string, number>();
  const levels = new Map<string, 0 | 1 | 2 | 3 | 4>();

  return rows.map((row) => {
    const nextCount = (counts.get(row.capability_id) ?? 0) + 1;
    counts.set(row.capability_id, nextCount);
    const nextLevel = levelIndexForEvidenceRows(nextCount);
    levels.set(row.capability_id, nextLevel);
    const avgLevel = averageLevel(Array.from(levels.values()));
    return {
      capturedAt: row.created_at,
      capabilityId: row.capability_id,
      capabilityName: row.capability_name || row.capability_id,
      strength: row.strength,
      levelAtTime: avgLevel,
    };
  });
}

function buildSettledRanges(steps: TimelineStepArcRecord[]): SettledRange[] {
  void steps;
  return [];
}

function averageLevel(levels: (0 | 1 | 2 | 3 | 4)[]): 0 | 1 | 2 | 3 | 4 {
  if (levels.length === 0) return 0;
  const avg = levels.reduce<number>((sum, level) => sum + level, 0) / levels.length;
  return Math.max(0, Math.min(4, Math.round(avg))) as 0 | 1 | 2 | 3 | 4;
}

function yForLevel(level: number) {
  return BASELINE_Y - level * 18;
}

function xForDate(dateLike: string, startedAt: string, nowAt: string) {
  const start = new Date(startedAt).getTime();
  const current = new Date(dateLike).getTime();
  const end = new Date(nowAt).getTime();
  const span = Math.max(end - start, 1);
  const ratio = Math.max(0, Math.min(1, (current - start) / span));
  return PLOT_LEFT + ratio * (PLOT_RIGHT - PLOT_LEFT);
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return `M ${PLOT_LEFT} ${BASELINE_Y} L ${PLOT_RIGHT} ${BASELINE_Y}`;
  if (points.length === 1) {
    return `M ${PLOT_LEFT} ${BASELINE_Y} L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${PLOT_RIGHT} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = ((current.x + next.x) / 2).toFixed(2);
    path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX} ${((current.y + next.y) / 2).toFixed(2)}`;
  }
  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return path;
}

function buildWashPath(points: { x: number; y: number }[]) {
  const line = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(2)} ${BASELINE_Y} L ${first.x.toFixed(2)} ${BASELINE_Y} Z`;
}

function buildYearTicks(startedAt: string, nowAt: string) {
  const start = new Date(startedAt);
  const end = new Date(nowAt);
  const ticks: { x: number; label: string }[] = [];
  const firstYear = start.getFullYear();
  const lastYear = end.getFullYear();

  for (let year = firstYear; year <= lastYear; year += 1) {
    const anchor = new Date(Date.UTC(year, 0, 1)).toISOString();
    ticks.push({
      x: xForDate(anchor, startedAt, nowAt),
      label: String(year),
    });
  }

  return ticks;
}
