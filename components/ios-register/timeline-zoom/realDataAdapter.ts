/**
 * Real-data adapter — maps the live timeline-step + season schema into the
 * TimelineDataset shape the zoom canvas expects.
 *
 * v2 mapping (2026-05-22):
 *   • Rotation-relative week bucketing (3 per bucket, sort_order ordered).
 *   • status → StepStatus.
 *   • metadata.plan.how_sub_steps → L1 how-checklist.
 *   • metadata.plan.collaborators → cohort avatars + meta-row preceptor/coach
 *     callout. Free-text `role` matched against /preceptor|coach|mentor/i.
 *   • metadata.plan.where_location.name → meta-row left ("Wed · JHH Bloomberg").
 *   • Time-of-day modifier derived from starts_at hour:
 *       4–8  → PRE-SHIFT,    8–12 → AM SHIFT,
 *       12–17 → AFTERNOON,   17–21 → EVENING,
 *       21–4 → NIGHT.
 *   • source_blueprint_id → blueprint title (looked up in the
 *     `blueprintsById` map passed in by the screen wrapper).
 *
 * Still deferred to follow-ups: multi-capability tagging (schema gap),
 * blueprint author "suggested by" name (needs per-step author query),
 * archived season real brick counts (needs RPC).
 */

import type { StepPlanData, StepCollaborator } from '@/types/step-detail';
import type { Season } from '@/types/season';
import type { TimelineStepRecord, TimelineStepStatus } from '@/types/timeline-steps';
import { CAPABILITY_PALETTE } from './sampleData';
import {
  resolveCapabilityVisuals,
  resolveInterestVocab,
  type InterestVocab,
} from './interestVocab';
import type {
  Capability,
  CohortAvatar,
  DayKey,
  LifetimeAnalysis,
  LifetimePeer,
  LifetimeReflection,
  LifetimeSession,
  LifetimeTrophy,
  SeasonAnalysis,
  SeasonLibrarianPrompt,
  SeasonPeer,
  SeasonPhase,
  StepHowItem,
  StepStatus,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
  TimelineWeek,
  WeeklyCapabilityMix,
} from './types';

/**
 * Derive named phases from the bucketed week list. The phase labels
 * are what answer "what does this color mean" for the user — written
 * in domain vernacular and placed directly under the river in L3.
 *
 * Strategy:
 *   1. Look for race-block structure in step titles ("Race 3", "Race 4"…).
 *      Consecutive race weeks collapse into "Race N" or "Race N–M".
 *   2. Outside race weeks, group consecutive weeks with the same
 *      dominant capability into a single phase, labeled with the
 *      capability name ("Tactics", "Boatspeed").
 *   3. First week with mixed prep work labels as "entry"; the trailing
 *      week of a season labels as "finale" when not race-locked.
 *
 * Sailing is the first vertical, so race-vernacular wins when present;
 * nursing / non-sailing data falls back to capability-block phases.
 */
function computeSeasonPhases(
  weeks: TimelineWeek[],
  interestVocab: InterestVocab,
): SeasonPhase[] {
  if (weeks.length === 0) return [];

  // Per-week dominant capability mapped through the interest's palette
  // (same lookup the chart bands use). Phase labels mirror band colors
  // because both flow through resolveCapabilityVisuals — no contradictions.
  const dominantPerWeek: { weekNumber: number; capability: Capability | null }[] =
    weeks.map((week, idx) => {
      const counts = new Map<string, { cap: Capability; count: number }>();
      for (const step of week.steps) {
        const caps = step.capabilities ?? [];
        for (const cap of caps) {
          const v = resolveCapabilityVisuals(cap.label, interestVocab);
          const canonId = v.canonicalLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const entry = counts.get(canonId);
          if (entry) entry.count += 1;
          else counts.set(canonId, {
            cap: { id: canonId, label: v.canonicalLabel, color: v.color },
            count: 1,
          });
        }
      }
      const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
      return { weekNumber: idx + 1, capability: sorted[0]?.cap ?? null };
    });

  const phases: SeasonPhase[] = [];
  const fallbackColor = CAPABILITY_PALETTE.procedural.color;
  let i = 0;
  while (i < dominantPerWeek.length) {
    const head = dominantPerWeek[i]!;
    const capId = head.capability?.id ?? '__none__';
    let j = i;
    while (
      j + 1 < dominantPerWeek.length &&
      (dominantPerWeek[j + 1]!.capability?.id ?? '__none__') === capId
    ) {
      j += 1;
    }
    phases.push({
      id: `phase-${i}-${capId}`,
      label: head.capability?.label ?? 'prep',
      startWeek: head.weekNumber,
      endWeek: dominantPerWeek[j]!.weekNumber,
      color: head.capability?.color ?? fallbackColor,
    });
    i = j + 1;
  }

  // Cap the phase count for short seasons. The raw heuristic emits one
  // phase whenever the dominant capability changes between consecutive
  // weeks, which over-segments short or high-variety seasons (8 weeks ×
  // 7 phases = labels colliding under the river). Target ~3-weeks per
  // phase as a readable density and merge the smallest internal phases
  // first to get there.
  const targetPhaseCount = Math.max(3, Math.ceil(weeks.length / 3));
  while (phases.length > targetPhaseCount) {
    let smallestIdx = -1;
    let smallestSize = Infinity;
    for (let k = 0; k < phases.length; k++) {
      const phase = phases[k]!;
      const isProtected =
        (k === 0 && phase.label === 'wk 1 · entry') ||
        (k === phases.length - 1 && phase.label === 'finale');
      if (isProtected) continue;
      const size = phase.endWeek - phase.startWeek + 1;
      if (size < smallestSize) {
        smallestSize = size;
        smallestIdx = k;
      }
    }
    if (smallestIdx === -1) break;
    // Merge the smallest into its longer neighbor so the absorbed range
    // disappears into a meaningful block. Prefer the previous neighbor
    // for visual continuity unless it's protected or smaller.
    const target = phases[smallestIdx]!;
    const prev = phases[smallestIdx - 1];
    const next = phases[smallestIdx + 1];
    const mergeIntoPrev =
      prev != null &&
      (next == null ||
        prev.endWeek - prev.startWeek >= next.endWeek - next.startWeek);
    if (mergeIntoPrev && prev) {
      phases[smallestIdx - 1] = { ...prev, endWeek: target.endWeek };
      phases.splice(smallestIdx, 1);
    } else if (next) {
      phases[smallestIdx + 1] = { ...next, startWeek: target.startWeek };
      phases.splice(smallestIdx, 1);
    } else {
      break;
    }
  }

  // De-duplicate phase labels: when two non-adjacent phases share a label
  // (e.g. "Practice" bookending the season), suffix the second occurrence
  // with "· late" and tag the first with "· early" so the user can tell
  // them apart in the legend strip under the river.
  const labelCounts = new Map<string, number>();
  for (const p of phases) {
    labelCounts.set(p.label, (labelCounts.get(p.label) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  for (let k = 0; k < phases.length; k++) {
    const phase = phases[k]!;
    const total = labelCounts.get(phase.label) ?? 1;
    if (total < 2) continue;
    // Skip suffixing for protected single-purpose labels.
    if (phase.label === 'wk 1 · entry' || phase.label === 'finale') continue;
    const idx = (seen.get(phase.label) ?? 0) + 1;
    seen.set(phase.label, idx);
    const suffix =
      total === 2 ? (idx === 1 ? '· early' : '· late') : `· ${idx}`;
    phases[k] = { ...phase, label: `${phase.label} ${suffix}` };
  }
  return phases;
}

export interface BlueprintLookup {
  title: string;
  author_name?: string;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const STATUS_MAP: Record<TimelineStepStatus, StepStatus> = {
  pending: 'plan',
  in_progress: 'do',
  completed: 'done',
  settled: 'reflected',
  skipped: 'done',
};

// Stable color palette — first chip uses purple (cardio), then cycles. The
// design's coral-system semantics aren't yet on the database side so we cycle
// a category → color map keyed by category string.
const CAPABILITY_COLORS = [
  CAPABILITY_PALETTE.cardio.color,
  CAPABILITY_PALETTE.assess.color,
  CAPABILITY_PALETTE.pharm.color,
  CAPABILITY_PALETTE.comm.color,
  CAPABILITY_PALETTE.sbar.color,
  CAPABILITY_PALETTE.procedural.color,
];

function hashCategoryToColor(category: string): string {
  if (!category) return CAPABILITY_COLORS[0];
  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = ((h << 5) - h + category.charCodeAt(i)) | 0;
  }
  return CAPABILITY_COLORS[Math.abs(h) % CAPABILITY_COLORS.length];
}

// Avatar-bubble palette for input contributors we don't already have a
// stored color for (blueprint authors, suggestion senders). Picked to be
// perceptually distinct from each other and from the capability palette.
const PEER_PALETTE = ['#7BA0C4', '#A47A52', '#8FAE5C', '#C99632', '#B86EAA', '#5BA4A6'];
function deterministicPeerColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return PEER_PALETTE[Math.abs(h) % PEER_PALETTE.length];
}

function dayKeyFromIso(iso: string | null): DayKey {
  if (!iso) return 'wed';
  const d = new Date(iso);
  // Date.getDay: 0=Sun..6=Sat → DAY_KEYS index needs 0=Mon..6=Sun
  const idx = (d.getDay() + 6) % 7;
  return DAY_KEYS[idx];
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} — ${fmt(e)}`;
}

/**
 * Bucket steps into rotation-relative "weeks" — always 3 per bucket, ordered
 * by sort_order. Numbering is 1-indexed (Week 1, Week 2, …) regardless of
 * the calendar week the step actually falls in. This matches the design's
 * "Week 7 of 14" framing where the count is a position within the rotation,
 * not a calendar coordinate.
 *
 * The bucket key is just the bucket index, so steps with no starts_at still
 * cluster cleanly.
 */
function weekKeyOf(fallbackIndex: number): string {
  return `wk-${Math.floor(fallbackIndex / 3)}`;
}

function weekRangeLabel(
  bucketSteps: { starts_at: string | null }[],
  bucketIndex: number,
): { range: string; number: number } {
  const dated = bucketSteps.filter((s) => s.starts_at);
  if (dated.length === 0) {
    return {
      range: `Steps ${bucketIndex * 3 + 1}–${bucketIndex * 3 + Math.min(3, bucketSteps.length)}`,
      number: bucketIndex + 1,
    };
  }
  const sorted = [...dated].sort(
    (a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!),
  );
  const start = new Date(sorted[0].starts_at!);
  const end = new Date(sorted[sorted.length - 1].starts_at!);
  return {
    range: formatDateRange(start.toISOString(), end.toISOString()),
    number: bucketIndex + 1,
  };
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function timeOfDayModifier(iso: string | null): string | null {
  if (!iso) return null;
  const h = new Date(iso).getHours();
  if (h >= 4 && h < 8) return 'PRE-SHIFT';
  if (h >= 8 && h < 12) return 'AM SHIFT';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 21) return 'EVENING';
  return 'NIGHT';
}

function looksLikeCreationTimeFallback(rec: TimelineStepRecord): boolean {
  if (!rec.starts_at || !rec.created_at) return false;
  const startsAt = Date.parse(rec.starts_at);
  const createdAt = Date.parse(rec.created_at);
  if (Number.isNaN(startsAt) || Number.isNaN(createdAt)) return false;
  return Math.abs(startsAt - createdAt) <= 5 * 60 * 1000;
}

function resolveScheduleAnchor(rec: TimelineStepRecord): string | null {
  if (rec.due_at) return rec.due_at;

  if (!rec.starts_at) return null;

  const metadata = rec.metadata as { draft?: unknown; capture_source?: unknown } | null | undefined;
  const isQuickCaptureDraft =
    metadata?.draft === true &&
    metadata?.capture_source === 'universal_plus_sheet';

  if (isQuickCaptureDraft || looksLikeCreationTimeFallback(rec)) {
    return null;
  }

  return rec.starts_at;
}

function formatWhenLabel(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date
    .toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: date.getMinutes() === 0 ? undefined : '2-digit',
    })
    .replace(',', ' ·');
}

function getPlanData(metadata: Record<string, unknown> | null | undefined): StepPlanData | null {
  if (!metadata) return null;
  const plan = (metadata as { plan?: unknown }).plan;
  if (plan && typeof plan === 'object') return plan as StepPlanData;
  return null;
}

function initialsFromName(name: string): string {
  const parts = name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function collabToAvatar(c: StepCollaborator): CohortAvatar {
  return {
    id: c.id,
    initials: initialsFromName(c.display_name || ''),
    color: c.avatar_color || '#8E8E93',
  };
}

const ROLE_HONORIFIC_REGEX = /^(preceptor|coach|mentor|instructor|teacher|guide|attending)$/i;

function findRoleCollab(collabs: StepCollaborator[]): StepCollaborator | null {
  return collabs.find((c) => c.role && ROLE_HONORIFIC_REGEX.test(c.role)) ?? null;
}

function statusFromRecord(rec: TimelineStepRecord): StepStatus {
  return STATUS_MAP[rec.status] ?? 'plan';
}

function deriveCapability(category: string) {
  const normalized = category?.trim().toLowerCase();
  const color = hashCategoryToColor(category || 'general');
  if (!normalized || normalized === 'general') {
    return { id: 'general', label: 'Practice', color };
  }
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return { id: category || 'general', label, color };
}

function fallbackCapability(color?: string): Capability {
  return {
    id: 'general',
    label: 'Practice',
    color: color ?? CAPABILITY_PALETTE.procedural.color,
  };
}

function capabilityForStep(step: TimelineStep): Capability {
  return step.capabilities?.[0] ?? fallbackCapability();
}

function recordToStep(
  rec: TimelineStepRecord,
  seasonId: string,
  weekId: string,
  blueprintsById?: Map<string, BlueprintLookup>,
  viewerUserId?: string | null,
): TimelineStep {
  const cap = deriveCapability(rec.category);
  const scheduleAnchor = resolveScheduleAnchor(rec);
  const today = isToday(scheduleAnchor);
  const plan = getPlanData(rec.metadata);

  // Capability tags — metadata.plan.capability_goals holds the user-facing
  // chips ("Sail Selection", "Sail Design", "Sail Measurement"). A step
  // can have many; each one contributes its own band to the river so the
  // chart reads as a real river of *capability development*, not just
  // the dominant category. Falls back to the single category-derived
  // capability when the user hasn't tagged any goals yet.
  const goalLabels = Array.isArray(plan?.capability_goals)
    ? (plan!.capability_goals as string[]).filter((s) => typeof s === 'string' && s.trim().length > 0)
    : [];
  const goalCapabilities: Capability[] = goalLabels.map((label) => {
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'cap';
    return { id, label, color: hashCategoryToColor(label) };
  });
  const stepCapabilities: Capability[] = goalCapabilities.length > 0 ? goalCapabilities : [cap];

  // Eyebrow — [TODAY | DAY] · [TIME_OF_DAY?]
  const dayKey = dayKeyFromIso(scheduleAnchor);
  const dayPrefix = today
    ? 'TODAY'
    : scheduleAnchor
      ? DAY_LABEL[dayKey].toUpperCase()
      : null;
  const tod = timeOfDayModifier(scheduleAnchor);
  const preTitleParts = [dayPrefix, tod].filter(Boolean) as string[];
  const preTitle = preTitleParts.length > 0 ? preTitleParts.join(' · ') : undefined;

  // HOW WILL YOU DO IT? — from metadata.plan.how_sub_steps
  const howItems: StepHowItem[] | undefined = plan?.how_sub_steps
    ?.slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sub) => ({ label: sub.text, checked: sub.completed }));
  const whyReasoning = plan?.why_reasoning?.trim() || undefined;
  const whenLabel = formatWhenLabel(scheduleAnchor);

  // Meta row — "Wed · <location>" left, "Preceptor: <name>" right
  const locName = plan?.where_location?.name ?? rec.location_name ?? null;
  const metaLeft = scheduleAnchor
    ? locName
      ? `${DAY_LABEL[dayKey]} · ${locName}`
      : DAY_LABEL[dayKey]
    : locName || undefined;
  const roleCollab = plan?.collaborators ? findRoleCollab(plan.collaborators) : null;
  const metaRight = roleCollab
    ? `${capitalize(roleCollab.role!)}: ${roleCollab.display_name}`
    : undefined;

  // Cohort avatars (excluding the role-tagged collab — they're called out
  // separately on the right of the meta row).
  const cohortAvatars: CohortAvatar[] | undefined = plan?.collaborators
    ?.filter((c) => !roleCollab || c.id !== roleCollab.id)
    .slice(0, 3)
    .map(collabToAvatar);
  const cohortLabel =
    plan?.collaborators && plan.collaborators.length > 0
      ? `${plan.collaborators.length} ${plan.collaborators.length === 1 ? 'collab' : 'collabs'}`
      : undefined;

  // FROM provenance — blueprint title from id map when available
  let from: TimelineStep['from'] | undefined;
  if (rec.source_blueprint_id) {
    const bp = blueprintsById?.get(rec.source_blueprint_id);
    from = bp
      ? {
          source: bp.title,
          suggestedBy: bp.author_name,
        }
      : { source: 'Blueprint' };
  }

  // Cross-interest pin marker — TimelineStepService stamps `_pinned: true`
  // on steps surfaced via timeline_step_pins so the canvas can render a
  // pin indicator without re-querying the pin table.
  const pinnedFromOtherInterest =
    (rec as TimelineStepRecord & { _pinned?: boolean })._pinned === true;
  const isSharedWithViewer =
    Boolean(viewerUserId) &&
    rec.user_id !== viewerUserId &&
    rec.collaborator_user_ids?.includes(viewerUserId!);
  const originKind: TimelineStep['originKind'] = isSharedWithViewer
    ? 'shared'
    : rec.source_blueprint_id || rec.source_type === 'blueprint'
      ? 'blueprint'
      : 'mine';

  return {
    id: rec.id,
    title: rec.title || 'Untitled step',
    preTitle,
    dayOfWeek: dayKey,
    weekId,
    seasonId,
    status: statusFromRecord(rec),
    originKind,
    metaLeft,
    metaRight,
    whatBody: plan?.what_will_you_do || rec.description || undefined,
    whyReasoning,
    whenLabel,
    howItems,
    capabilities: stepCapabilities,
    from,
    cohortAvatars,
    cohortLabel,
    pinnedFromOtherInterest,
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Compute the L3 analysis layer (capability river + peer journey +
 * librarian prompt) from the already-bucketed week list.
 *
 * Reflections are left empty for v1 — we don't yet have a reflection-
 * text source on the step record. The prompt is a simple progress-based
 * sentence so L3 has something to surface even when no human-authored
 * librarian copy exists.
 */
/**
 * Suggestion-channel peer input: a step_suggestion the viewer sent or
 * received. Bucketed into the INPUT chart by created_at via linear
 * projection across the season's date range.
 */
export interface SuggestionInputRow {
  peerUserId: string;
  peerDisplayName: string | null;
  createdAt: string;
  direction: 'sent' | 'received';
  /** Sender's source step id when known and resolvable to one of the
   *  viewer's own steps (i.e. "sent" direction). Used for capability
   *  coloring. NULL for free-form / inbound suggestions. */
  sourceStepId?: string | null;
}

function computeSeasonAnalysis(
  weeks: TimelineWeek[],
  seasonName: string | null,
  currentWeekNumber: number,
  interestVocab: InterestVocab,
  stepEvidenceMap?: Map<
    string,
    { capabilityName: string; orgCompetencyId?: string | null }[]
  >,
  suggestionInputs?: SuggestionInputRow[],
  seasonStart?: string | null,
  seasonEnd?: string | null,
  stepReflectionsMap?: Map<
    string,
    { peerUserId: string; peerDisplayName: string | null }[]
  >,
): SeasonAnalysis | undefined {
  // Linear projection of an ISO timestamp into a 1-based week index
  // across the season's date range. Returns null when we can't anchor
  // the projection (missing range or unparseable date).
  const weekIndexFor = (iso: string): number | null => {
    if (!seasonStart || !seasonEnd || weeks.length === 0) return null;
    const t = Date.parse(iso);
    const a = Date.parse(seasonStart);
    const b = Date.parse(seasonEnd);
    if (!isFinite(t) || !isFinite(a) || !isFinite(b) || b <= a) return null;
    const ratio = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return Math.min(weeks.length, Math.max(1, Math.floor(ratio * weeks.length) + 1));
  };
  if (weeks.length === 0) return undefined;

  // Per-week capability mix. Each step contributes once to EVERY tagged
  // capability so "Sail Selection · Sail Design · Sail Measurement"
  // produces three contributions. We then map each raw capability label
  // through the interest's deliberate palette so the chart shows the
  // canonical family ("Sails", "Rig", "Tactics", …) with a stable color
  // — sister capabilities like "Sail Design" + "Sail Measurement" merge
  // into one "Sails" stream instead of fragmenting into adjacent
  // identical-color bands.
  // Untagged steps (no capability_goals AND category="general") are
  // hidden from the chart entirely. The chart's job is to show what
  // the user has actually tagged — pretending unknowns are "Practice"
  // would be dishonest. Steps with a non-"general" category still
  // contribute via the palette resolver, so "planning" / "boat" /
  // "fitness" categories count even if the user hasn't tagged
  // capability_goals explicitly.
  const weeklyCapabilities: WeeklyCapabilityMix[] = weeks.map((week, idx) => {
    const counts = new Map<
      string,
      { label: string; color: string; planned: number; proven: number }
    >();
    const bump = (
      label: string,
      color: string,
      kind: 'planned' | 'proven',
    ) => {
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existing = counts.get(id);
      if (existing) {
        if (kind === 'planned') existing.planned += 1;
        else existing.proven += 1;
      } else {
        counts.set(id, {
          label,
          color,
          planned: kind === 'planned' ? 1 : 0,
          proven: kind === 'proven' ? 1 : 0,
        });
      }
    };
    for (const step of week.steps) {
      const caps = step.capabilities;
      const onlyFallback =
        !caps ||
        caps.length === 0 ||
        (caps.length === 1 && (caps[0]!.label === 'Practice' || caps[0]!.label === 'General'));
      // Planned layer — capability_goals from the Plan tab.
      if (!onlyFallback) {
        for (const cap of caps!) {
          if (cap.label === 'Practice' || cap.label === 'General') continue;
          const v = resolveCapabilityVisuals(cap.label, interestVocab);
          bump(v.canonicalLabel, v.color, 'planned');
        }
      }
      // Proven layer — confirmed step_capability_evidence rows. Mapped
      // through the same palette so a planned "Sail Design" and a
      // proven "sail design" merge into one canonical "Sails" stream
      // (chart bands and evidence dots stay color-aligned).
      const evidenceRows = stepEvidenceMap?.get(step.id) ?? [];
      for (const ev of evidenceRows) {
        const label = (ev.capabilityName || '').trim();
        if (!label) continue;
        const v = resolveCapabilityVisuals(label, interestVocab);
        bump(v.canonicalLabel, v.color, 'proven');
      }
    }
    const bands = Array.from(counts.entries()).map(([id, info]) => ({
      capabilityId: id,
      capabilityLabel: info.label,
      capabilityColor: info.color,
      // Legacy `volume` is the max of planned/proven so any consumer
      // that doesn't read planned/proven still sees a sensible band
      // size. New consumers use plannedVolume + provenVolume.
      volume: Math.max(info.planned, info.proven),
      plannedVolume: info.planned,
      provenVolume: info.proven,
    }));
    return { weekNumber: idx + 1, bands };
  });

  // Peers — people who had INPUT into each step, not just attendance.
  // Union across all four channels:
  //   1. step.cohortAvatars      — tagged via "with who?" on the step
  //   2. step.from.suggestedBy   — blueprint author (the step came from
  //                                a blueprint they wrote)
  //   3. step_suggestions sender — someone suggested it to you (TODO,
  //                                needs a separate query)
  //   4. step_suggestions target — someone you suggested it to (TODO,
  //                                needs a separate query)
  // For now (3) and (4) are stubbed — channels 1+2 already pull in
  // coaches/instructors that authored the source blueprint, which is the
  // most common input signal beyond direct tagging.
  const peerMap = new Map<
    string,
    {
      initials: string;
      name?: string;
      color: string;
      role?: string;
      firstWeek: number;
      perWeek: Map<number, number>;
      /** Per-capability-color contribution count. Dominant color wins
       *  in the SeasonPeer mapping below. */
      capabilityCounts: Map<string, number>;
    }
  >();
  const bumpPeer = (
    id: string,
    weekNumber: number,
    seed: {
      initials: string;
      name?: string;
      color: string;
      role?: string;
      capabilityColor?: string;
    },
  ) => {
    const entry = peerMap.get(id);
    if (entry) {
      entry.perWeek.set(weekNumber, (entry.perWeek.get(weekNumber) ?? 0) + 1);
      // Preserve the first role we saw — direct tags beat blueprint roles
      // because they appear in week 1 of any step that has both.
      if (!entry.role && seed.role) entry.role = seed.role;
      if (!entry.name && seed.name) entry.name = seed.name;
      if (seed.capabilityColor) {
        entry.capabilityCounts.set(
          seed.capabilityColor,
          (entry.capabilityCounts.get(seed.capabilityColor) ?? 0) + 1,
        );
      }
    } else {
      const capabilityCounts = new Map<string, number>();
      if (seed.capabilityColor) capabilityCounts.set(seed.capabilityColor, 1);
      peerMap.set(id, {
        initials: seed.initials,
        name: seed.name,
        color: seed.color,
        role: seed.role,
        firstWeek: weekNumber,
        perWeek: new Map([[weekNumber, 1]]),
        capabilityCounts,
      });
    }
  };
  // Pre-build a stepId → TimelineStep lookup so reflection / suggestion
  // handlers can resolve the capability color of the step they reference
  // without re-walking weeks.
  const stepById = new Map<string, TimelineStep>();
  for (const week of weeks) {
    for (const step of week.steps) stepById.set(step.id, step);
  }
  // Derive the dominant in-palette capability color from a step.
  // Tries explicit capability tags first, then falls back to matching
  // the step's title against the palette — useful for demo / seed
  // steps that don't carry capabilities[] but whose titles are
  // descriptive ("Cohort seed · medication" → Pharmacology).
  // Returns undefined when neither tags nor title match a palette
  // family, so the peer dot stays at identity color (honest signal:
  // "we don't know what they shaped").
  const matchPaletteColor = (raw: string): string | undefined => {
    for (const entry of interestVocab.palette ?? []) {
      if (entry.pattern.test(raw)) return entry.color;
    }
    return undefined;
  };
  const stepCapabilityColor = (step: TimelineStep | undefined): string | undefined => {
    if (!step) return undefined;
    for (const cap of step.capabilities ?? []) {
      if (cap.label === 'Practice' || cap.label === 'General') continue;
      const c = matchPaletteColor(cap.label);
      if (c) return c;
    }
    if (step.title) {
      const c = matchPaletteColor(step.title);
      if (c) return c;
    }
    return undefined;
  };
  weeks.forEach((week, weekIdx) => {
    const weekNumber = weekIdx + 1;
    for (const step of week.steps) {
      const capColor = stepCapabilityColor(step);
      // Channel 1 — direct "with who?" tags.
      for (const avatar of step.cohortAvatars ?? []) {
        bumpPeer(avatar.id, weekNumber, {
          initials: avatar.initials,
          color: avatar.color,
          capabilityColor: capColor,
        });
      }
      // Channel 2 — blueprint author. Namespaced id keeps them distinct
      // from a real tagged collaborator who happens to share a name.
      const author = step.from?.suggestedBy?.trim();
      if (author) {
        bumpPeer(`bp:${author.toLowerCase()}`, weekNumber, {
          initials: initialsFromName(author),
          name: author,
          color: deterministicPeerColor(author),
          role: 'blueprint',
          capabilityColor: capColor,
        });
      }
    }
  });

  // Channels 3 + 4 — step_suggestions sent or received. Each
  // suggestion places its counterpart on the chart at the week of
  // created_at (projected linearly across the season's date range
  // because our buckets are sort_order-based, not calendar weeks).
  // Direction is encoded into the role so the chart can distinguish
  // "suggested to you" vs "you suggested to them".
  for (const sg of suggestionInputs ?? []) {
    const wk = weekIndexFor(sg.createdAt);
    if (!wk) continue;
    const peerName = sg.peerDisplayName?.trim() || 'Peer';
    const role = sg.direction === 'sent' ? 'you suggested' : 'suggested it';
    // For "sent" suggestions the source_step_id is one of OUR steps,
    // so we can resolve a capability color. For "received" suggestions
    // the source step lives in the sender's timeline — we don't have it
    // locally, so leave the color as identity.
    const sourceStep = sg.sourceStepId ? stepById.get(sg.sourceStepId) : undefined;
    bumpPeer(`sg:${sg.peerUserId}`, wk, {
      initials: initialsFromName(peerName),
      name: peerName,
      color: deterministicPeerColor(sg.peerUserId),
      role,
      capabilityColor: stepCapabilityColor(sourceStep),
    });
  }

  // Channel 5 — peer_reflections. target_step_id pins the reflection
  // to a specific step the viewer owns, so we look up that step's
  // week directly (no date projection). Adds the reflecting peer at
  // the step's week with role "reflected on it".
  // Per-week reflection count for the REFLECTIONS sparkline. Built up
  // alongside the peer bumping so we walk the reflection map once.
  const reflectionsPerWeek = new Map<number, number>();
  if (stepReflectionsMap && stepReflectionsMap.size > 0) {
    const stepWeekById = new Map<string, number>();
    weeks.forEach((w, i) => {
      for (const s of w.steps) stepWeekById.set(s.id, i + 1);
    });
    for (const [stepId, reflections] of stepReflectionsMap) {
      const wk = stepWeekById.get(stepId);
      if (!wk) continue;
      const reflectedStep = stepById.get(stepId);
      const reflectedColor = stepCapabilityColor(reflectedStep);
      reflectionsPerWeek.set(wk, (reflectionsPerWeek.get(wk) ?? 0) + reflections.length);
      for (const r of reflections) {
        const peerName = r.peerDisplayName?.trim() || 'Peer';
        bumpPeer(`rf:${r.peerUserId}`, wk, {
          initials: initialsFromName(peerName),
          name: peerName,
          color: deterministicPeerColor(r.peerUserId),
          role: 'reflected on it',
          capabilityColor: reflectedColor,
        });
      }
    }
  }
  const reflectionDensity = weeks.map((_w, i) => ({
    weekNumber: i + 1,
    count: reflectionsPerWeek.get(i + 1) ?? 0,
  }));

  const peers: SeasonPeer[] = Array.from(peerMap.entries())
    .map(([id, p]) => {
      // Dominant capability color across all contributions for this peer.
      // Undefined when nothing tagged in-palette was touched (e.g. all
      // contributions were on untagged or "Practice" fallback steps).
      let dominantColor: string | undefined;
      let dominantCount = 0;
      for (const [color, count] of p.capabilityCounts) {
        if (count > dominantCount) {
          dominantColor = color;
          dominantCount = count;
        }
      }
      return {
        id,
        initials: p.initials,
        name: p.name,
        color: p.color,
        capabilityColor: dominantColor,
        role: p.role,
        firstWeek: p.firstWeek,
        weeklyAppearances: Array.from(p.perWeek.entries())
          .map(([weekNumber, count]) => ({ weekNumber, count }))
          .sort((a, b) => a.weekNumber - b.weekNumber),
      };
    })
    // Most-frequent peers first so the chart's vertical order is meaningful.
    .sort(
      (a, b) =>
        b.weeklyAppearances.reduce((n, w) => n + w.count, 0) -
        a.weeklyAppearances.reduce((n, w) => n + w.count, 0),
    )
    .slice(0, 5);

  // Simple progress prompt — surfaced when the season has both a sense
  // of "where it is" (a current-week index) and at least one peer. Real
  // librarian copy lives in the agent loop; this is the always-on
  // baseline so L3 isn't empty for fresh seasons.
  // Count contributions from EVERY tagged capability on each step so a
  // multi-tagged step ("Sail Selection · Sail Design · Sail Measurement")
  // contributes to all three — same logic as the river bands above.
  const seenCapabilityCounts = new Map<string, { label: string; count: number }>();
  for (const week of weeks.slice(0, currentWeekNumber)) {
    for (const step of week.steps) {
      const caps = step.capabilities && step.capabilities.length > 0
        ? step.capabilities
        : [capabilityForStep(step)];
      for (const capability of caps) {
        const existing = seenCapabilityCounts.get(capability.id);
        if (existing) {
          existing.count += 1;
        } else {
          seenCapabilityCounts.set(capability.id, { label: capability.label, count: 1 });
        }
      }
    }
  }
  const dominantLabel = Array.from(seenCapabilityCounts.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => (entry.label === 'Practice' || entry.label === 'General' ? null : entry.label))
    .find(Boolean) ?? null;
  const promptBody = seasonName
    ? `You're at week ${currentWeekNumber} of ${weeks.length} in ${seasonName}.${
        dominantLabel ? ` ${dominantLabel} has been the dominant thread so far.` : ''
      } What do you want this arc to add up to?`
    : `You're at week ${currentWeekNumber} of ${weeks.length}. What do you want this arc to add up to?`;

  const phases = computeSeasonPhases(weeks, interestVocab);

  return {
    weeklyCapabilities,
    phases,
    peers,
    reflections: [],
    reflectionDensity,
    librarianPrompt: {
      eyebrow: 'This rotation · the librarian noticed',
      body: promptBody,
      primaryCta: { label: 'Review this arc', intent: 'open-season-check-in' },
      secondaryCta: { label: 'Not now' },
    },
  };
}

function colorToCapabilityLabel(color: string): string | null {
  for (const cap of Object.values(CAPABILITY_PALETTE)) {
    if (cap.color === color) return cap.label;
  }
  return null;
}

function shortenPromptAnchor(title: string | null | undefined): string | null {
  const raw = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const raceMatch = raw.match(/\b(Race\s+\d+)\b/i);
  if (raceMatch?.[1]) return raceMatch[1];
  const sessionMatch = raw.match(/\b(Session\s+\d+)\b/i);
  if (sessionMatch?.[1]) return sessionMatch[1];
  const firstSegment = raw.split(/ · | — |: |- /)[0]?.trim() ?? raw;
  if (firstSegment.length <= 28) return firstSegment;
  return firstSegment.split(/\s+/).slice(0, 4).join(' ');
}

function findPromptAnchorStep(currentWeek: TimelineWeek): TimelineStep | null {
  return (
    currentWeek.steps.find((step) => step.status === 'plan') ??
    currentWeek.steps.find((step) => step.status === 'do') ??
    currentWeek.steps.find((step) => step.status === 'reflect') ??
    currentWeek.steps[currentWeek.steps.length - 1] ??
    null
  );
}

function buildWeekPlanningHint(
  weeks: TimelineWeek[],
  currentWeekIdx: number,
  seasonName: string | null,
): SeasonLibrarianPrompt | undefined {
  const currentWeek = weeks[currentWeekIdx];
  if (!currentWeek) return undefined;

  const seenCounts = new Map<string, { label: string; count: number }>();
  for (const week of weeks.slice(0, currentWeekIdx + 1)) {
    for (const step of week.steps) {
      const capability = capabilityForStep(step);
      const existing = seenCounts.get(capability.id);
      if (existing) {
        existing.count += 1;
      } else {
        seenCounts.set(capability.id, { label: capability.label, count: 1 });
      }
    }
  }
  if (seenCounts.size === 0) return undefined;

  const currentCapabilityIds = new Set(
    currentWeek.steps.map((step) => capabilityForStep(step).id),
  );
  const anchorLabel = shortenPromptAnchor(findPromptAnchorStep(currentWeek)?.title);
  const missingCandidate = Array.from(seenCounts.entries())
    .filter(([capabilityId]) => !currentCapabilityIds.has(capabilityId))
    .sort((a, b) => b[1].count - a[1].count)[0];

  if (missingCandidate) {
    const [missingCapabilityId, missingCapability] = missingCandidate;
    const missingLabel =
      missingCapability.label === 'Practice' || missingCapability.label === 'General'
        ? null
        : missingCapability.label;
    let lastSeenWeekIdx = -1;
    for (let idx = currentWeekIdx - 1; idx >= 0; idx -= 1) {
      if (weeks[idx]?.steps.some((step) => capabilityForStep(step).id === missingCapabilityId)) {
        lastSeenWeekIdx = idx;
        break;
      }
    }
    const weeksSinceSeen =
      lastSeenWeekIdx >= 0 ? currentWeekIdx - lastSeenWeekIdx : null;
    const timeCopy =
      lastSeenWeekIdx >= 0
        ? ` since Week ${weeks[lastSeenWeekIdx]?.number ?? lastSeenWeekIdx + 1}`
        : '';

    return {
      eyebrow: 'The librarian noticed',
      body: missingLabel
        ? `${missingLabel} hasn't appeared in the nearby run${timeCopy}.`
        : `One capability thread hasn't appeared in the nearby run${timeCopy}.`,
      emphasisLine: anchorLabel
        ? `Slot a session before ${anchorLabel}?`
        : 'Slot a session into the next move?',
      supportingLine: weeksSinceSeen && weeksSinceSeen > 1
        ? `This gap has been open for ${weeksSinceSeen} weeks. Use the next slot to rebalance the arc before the pattern hardens.`
        : 'Use the next slot to rebalance the arc before the pattern hardens.',
      primaryCta: { label: missingLabel ? `Add ${missingLabel}` : 'Add a step', intent: 'add-step' },
      secondaryCta: { label: 'Not now' },
    };
  }

  const dominantLabel = Array.from(seenCounts.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => (entry.label === 'Practice' || entry.label === 'General' ? null : entry.label))
    .find(Boolean) ?? null;
  const seasonCopy = seasonName ?? 'this arc';
  return {
    eyebrow: 'The librarian noticed',
    body: dominantLabel
      ? `${dominantLabel} is carrying most of the nearby weight in ${seasonCopy}.`
      : `This nearby run is clustering around one thread in ${seasonCopy}.`,
    emphasisLine: 'What should the next move add?',
    supportingLine: 'Use the next slot to add contrast, not more of the same.',
    primaryCta: { label: 'Review this arc', intent: 'open-season-check-in' },
    secondaryCta: { label: 'Not now' },
  };
}

/**
 * Compute the L4 lifetime analysis (capability river spanning every
 * session + lifetime peer chart + librarian "worth a reflection?"
 * prompt) from the full season list.
 *
 * Each session = one TimelineSeason. Dominant capability per session
 * is the most-frequent brick color. Volume = brick count. Peers are
 * a union across every season's collaborators (which appear via the
 * cohort avatar union performed at the per-step level upstream, so
 * here we union by going through the season's step lists).
 *
 * Trophies and reflections are left empty for v1 — there's no
 * "milestone" or "reflection text" source wired into the live data
 * yet. The librarian prompt is a baseline sentence keyed off the
 * first→latest capability drift so L4 has something to surface.
 */
function computeLifetimeAnalysis(
  seasons: TimelineSeason[],
  interestSlug: string | null,
): LifetimeAnalysis | undefined {
  if (seasons.length === 0) return undefined;

  // Sessions oldest → newest. The dataset's `seasons` array lists the
  // current rotation first then archived; reverse for chronological
  // order so the river reads left-to-right as past → present.
  const chronoSeasons = [...seasons].reverse();

  const sessions: LifetimeSession[] = chronoSeasons.map((season, idx) => {
    const counts = new Map<string, number>();
    for (const brick of season.bricks) {
      counts.set(brick.capabilityColor, (counts.get(brick.capabilityColor) ?? 0) + 1);
    }
    let dominantColor = CAPABILITY_PALETTE.procedural.color;
    let dominantCount = 0;
    for (const [color, count] of counts) {
      if (count > dominantCount) {
        dominantColor = color;
        dominantCount = count;
      }
    }
    return {
      sessionIndex: idx + 1,
      seasonId: season.id,
      label: shortenSeasonLabel(season.title),
      dominantCapabilityColor: dominantColor,
      volume: Math.max(1, season.bricks.length),
    };
  });

  const sessionCapabilityLabels = sessions.map((session) => ({
    sessionIndex: session.sessionIndex,
    label: colorToCapabilityLabel(session.dominantCapabilityColor),
  }));

  // Peer union — same input channels as L3 (see computeSeasonAnalysis):
  // direct "with who?" tags + blueprint authors. Accumulated per session
  // instead of per week.
  const peerMap = new Map<
    string,
    {
      initials: string;
      color: string;
      firstSessionIndex: number;
      perSession: Map<number, number>;
    }
  >();
  const bumpLifetimePeer = (
    id: string,
    sessionIndex: number,
    seed: { initials: string; color: string },
  ) => {
    const entry = peerMap.get(id);
    if (entry) {
      entry.perSession.set(sessionIndex, (entry.perSession.get(sessionIndex) ?? 0) + 1);
    } else {
      peerMap.set(id, {
        initials: seed.initials,
        color: seed.color,
        firstSessionIndex: sessionIndex,
        perSession: new Map([[sessionIndex, 1]]),
      });
    }
  };
  chronoSeasons.forEach((season, idx) => {
    const sessionIndex = idx + 1;
    for (const week of season.weeks) {
      for (const step of week.steps) {
        for (const avatar of step.cohortAvatars ?? []) {
          bumpLifetimePeer(avatar.id, sessionIndex, {
            initials: avatar.initials,
            color: avatar.color,
          });
        }
        const author = step.from?.suggestedBy?.trim();
        if (author) {
          bumpLifetimePeer(`bp:${author.toLowerCase()}`, sessionIndex, {
            initials: initialsFromName(author),
            color: deterministicPeerColor(author),
          });
        }
      }
    }
  });

  const peers: LifetimePeer[] = Array.from(peerMap.entries())
    .map(([id, p]) => ({
      id,
      initials: p.initials,
      color: p.color,
      firstSessionIndex: p.firstSessionIndex,
      sessionAppearances: Array.from(p.perSession.entries())
        .map(([sessionIndex, count]) => ({ sessionIndex, count }))
        .sort((a, b) => a.sessionIndex - b.sessionIndex),
    }))
    .sort(
      (a, b) =>
        b.sessionAppearances.reduce((n, s) => n + s.count, 0) -
        a.sessionAppearances.reduce((n, s) => n + s.count, 0),
    )
    .slice(0, 6);

  const reflections: LifetimeReflection[] = [];
  for (let idx = 1; idx < sessionCapabilityLabels.length; idx += 1) {
    const prev = sessionCapabilityLabels[idx - 1];
    const current = sessionCapabilityLabels[idx];
    if (!prev.label || !current.label || prev.label === current.label) continue;
    reflections.push({
      id: `lifetime-shift-${current.sessionIndex}`,
      sessionIndex: current.sessionIndex,
      quote: `${current.label.toLowerCase()} took over`,
      capabilityColor: sessions[idx].dominantCapabilityColor,
    });
  }

  const peakSession = [...sessions].sort((a, b) => b.volume - a.volume)[0];
  const latestSession = sessions[sessions.length - 1];
  const trophies: LifetimeTrophy[] = [];
  if (peakSession) {
    trophies.push({
      id: `peak-volume-${peakSession.sessionIndex}`,
      sessionIndex: peakSession.sessionIndex,
      label: peakSession === latestSession ? 'peak now' : 'peak load',
      capabilityColor: peakSession.dominantCapabilityColor,
    });
  }
  if (latestSession && latestSession !== peakSession) {
    trophies.push({
      id: `current-arc-${latestSession.sessionIndex}`,
      sessionIndex: latestSession.sessionIndex,
      label: 'current arc',
      capabilityColor: latestSession.dominantCapabilityColor,
    });
  }

  // Baseline librarian sentence — drift from first session's dominant
  // capability to the latest. Honest about not knowing the user's
  // milestones yet.
  //
  // colorToCapabilityLabel reverse-maps off CAPABILITY_PALETTE, which is
  // nursing-specific. On a non-nursing interest those labels lie ("you've
  // drifted from procedural toward pharm" on a Sail Racing surface), so
  // we fall back to a vocab-neutral sentence whenever the viewer isn't
  // on the nursing rails.
  const firstCap = sessions[0]?.dominantCapabilityColor;
  const lastCap = sessions[sessions.length - 1]?.dominantCapabilityColor;
  const useNursingLabels = interestSlug === 'nursing';
  const firstLabel =
    useNursingLabels && firstCap ? colorToCapabilityLabel(firstCap) : null;
  const lastLabel =
    useNursingLabels && lastCap ? colorToCapabilityLabel(lastCap) : null;
  const drift = useNursingLabels
    ? firstLabel && lastLabel && firstLabel !== lastLabel
      ? `Since ${sessions[0].label} you've drifted from ${firstLabel.toLowerCase()} toward ${lastLabel.toLowerCase()}.`
      : firstLabel
        ? `${firstLabel} has been the steady thread across your practice.`
        : ''
    : `Since ${sessions[0]?.label ?? 'you started'} the texture of your practice has shifted.`;
  const promptBody =
    sessions.length > 1
      ? `${drift} Worth a reflection on what you're becoming?`
      : "You're early in your practice. Keep going — patterns will emerge over the next few sessions.";

  return {
    sessions,
    peers,
    reflections: reflections.slice(-3),
    trophies,
    librarianPrompt: {
      eyebrow: 'Across your practice · the librarian noticed',
      body: promptBody,
      primaryCta: { label: 'Start a reflection', intent: 'start-reflection' },
      secondaryCta: { label: 'Not now' },
    },
  };
}

function shortenSeasonLabel(title: string): string {
  // "Spring '26 clinical" → "Spring '26". Keep the first ≤ 2 tokens
  // that include a quote/digit so the L4 tick stays readable.
  const tokens = title.split(/\s+/);
  if (tokens.length <= 2) return title;
  return tokens.slice(0, 2).join(' ');
}

interface AdapterInput {
  interestId?: string | null;
  interestLabel: string;
  /**
   * Optional slug ("sail-racing", "nursing") for the user's current
   * interest. Used as an extra candidate when resolving interest vocab
   * so the resolver still matches even if `interestLabel` arrives as
   * the generic "Practice" fallback before currentInterest fully loads.
   */
  interestSlug?: string | null;
  user: { id?: string | null; initials: string; color: string };
  currentSeason: Season | null;
  allSeasons: Season[];
  steps: TimelineStepRecord[];
  focusStepId?: string;
  /** id → title (and optional author_name) lookup for FROM provenance row. */
  blueprintsById?: Map<string, BlueprintLookup>;
  /**
   * Optional step-id → confirmed step_capability_evidence rows. When
   * supplied, weeklyCapabilities carries a `provenVolume` per band
   * alongside `plannedVolume`, and the CapabilityMix chart renders
   * planned-as-ghost-outline + proven-as-solid-fill in each band.
   */
  stepEvidenceMap?: Map<
    string,
    { capabilityName: string; orgCompetencyId?: string | null }[]
  >;
  /**
   * Optional step_suggestions involving the viewer within the current
   * season's date range, with peer display info pre-resolved. When
   * supplied, each suggestion places its counterpart peer on the
   * INPUT lane at the week of created_at.
   */
  suggestionInputs?: SuggestionInputRow[];
  /**
   * Optional step-id → peer_reflections grouping. Each reflection on
   * one of the viewer's steps adds the reflecting peer to the INPUT
   * lane at the step's week (no date projection needed — the linkage
   * via target_step_id is exact).
   */
  stepReflectionsMap?: Map<
    string,
    { peerUserId: string; peerDisplayName: string | null }[]
  >;
  /**
   * Per-interest vision data. Sourced from the user's active plan
   * for this interest (falls back to legacy user_interests when no
   * plan exists yet — backfill should have moved most accounts over).
   */
  interestVision?: {
    statement: string | null;
    competencyIds: string[];
  };
  /**
   * The user's active plan id for this interest. Drives the vision
   * edit write path: when set, VisionEditSheet updates this plan;
   * when null, it creates a new plan + writes vision to it.
   */
  activePlanId?: string | null;
}

export function mapToTimelineDataset({
  interestId,
  interestLabel,
  interestSlug,
  user,
  currentSeason,
  allSeasons,
  steps,
  focusStepId,
  blueprintsById,
  stepEvidenceMap,
  suggestionInputs,
  stepReflectionsMap,
  interestVision,
  activePlanId,
}: AdapterInput): TimelineDataset {
  // Sort steps by sort_order, then starts_at. Stable ordering matters for
  // week bucketing fallback and L4 brick layout.
  const sorted = [...steps].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const sa = a.starts_at ? Date.parse(a.starts_at) : 0;
    const sb = b.starts_at ? Date.parse(b.starts_at) : 0;
    return sa - sb;
  });

  // Group steps into rotation-relative buckets of 3, ordered by sort_order.
  const seasonIdForSteps = currentSeason?.id ?? 'current';
  const actualFocusId =
    focusStepId ??
    sorted.find((s) => s.status === 'in_progress' || s.status === 'pending')?.id ??
    sorted[0]?.id ??
    '';

  const bucketGroups: TimelineStepRecord[][] = [];
  sorted.forEach((rec, i) => {
    const bucketIdx = Math.floor(i / 3);
    if (!bucketGroups[bucketIdx]) bucketGroups[bucketIdx] = [];
    bucketGroups[bucketIdx].push(rec);
  });

  const weeks: TimelineWeek[] = bucketGroups.map((bucketRecs, bucketIdx) => {
    const id = weekKeyOf(bucketIdx * 3);
    const { number, range } = weekRangeLabel(
      bucketRecs.map((r) => ({ starts_at: r.starts_at })),
      bucketIdx,
    );
    const containsFocus = bucketRecs.some((r) => r.id === actualFocusId);
    return {
      id,
      number,
      dateRange: range,
      isCurrent: containsFocus || bucketIdx === 0,
      steps: bucketRecs.map((r) => recordToStep(r, seasonIdForSteps, id, blueprintsById, user.id)),
    };
  });

  // Steps moved to an archived season via Section E's MoveToSeasonSheet
  // get `metadata.season_id` set to the target season's id. We use that
  // to bucket bricks here so the L4 lanes reflect the move immediately —
  // until/unless timeline_steps gains a real season_id column, this
  // metadata field is the source of truth for cross-rotation grouping.
  const seasonIdOf = (rec: TimelineStepRecord): string | null => {
    const meta = rec.metadata as { season_id?: unknown } | null | undefined;
    return typeof meta?.season_id === 'string' ? meta.season_id : null;
  };

  // Current-season bricks (one brick per step, capability-hashed). Only
  // steps that are NOT pinned to an archived season land in the current
  // rotation lane. Carrying the step id lets L4's brick tap navigate to
  // the right step at L1, and lets Section D's drag-reorder identify
  // the lifted brick.
  const currentStepRecords = sorted.filter(
    (rec) => !seasonIdOf(rec) || seasonIdOf(rec) === seasonIdForSteps,
  );
  const currentBricks = currentStepRecords.map((rec) => ({
    capabilityColor: hashCategoryToColor(rec.category),
    stepId: rec.id,
    status: STATUS_MAP[rec.status],
    withOthers: (rec.collaborator_user_ids?.length ?? 0) > 0,
  }));

  const currentWeekIdx = Math.max(
    0,
    weeks.findIndex((w) => w.isCurrent),
  );
  const interestVocab = resolveInterestVocab(interestId, interestLabel, interestSlug);
  const currentSeasonAnalysis = computeSeasonAnalysis(
    weeks,
    currentSeason?.name ?? currentSeason?.short_name ?? null,
    currentWeekIdx + 1,
    interestVocab,
    stepEvidenceMap,
    suggestionInputs,
    currentSeason?.start_date ?? null,
    currentSeason?.end_date ?? null,
    stepReflectionsMap,
  );

  // L2 context strip — "{Season} has been {capability}-heavy." Drives
  // the italic-serif sentence above the L2 carousel title. Same
  // dominant-capability derivation as the librarian prompt; computed
  // once and stamped on the current week.
  if (currentSeasonAnalysis && weeks[currentWeekIdx]) {
    const dominant = weeks
      .slice(0, currentWeekIdx + 1)
      .flatMap((week) => week.steps)
      .reduce<{ id: string; label: string; count: number }[]>((acc, step) => {
        const capability = capabilityForStep(step);
        const existing = acc.find((entry) => entry.id === capability.id);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ id: capability.id, label: capability.label, count: 1 });
        }
        return acc;
      }, [])
      .sort((a, b) => b.count - a.count)[0];
    const dominantLabel = dominant?.label ?? null;
    const seasonShortName =
      currentSeason?.short_name ?? currentSeason?.name ?? 'This arc';
    if (dominantLabel) {
      weeks[currentWeekIdx].contextStrip = `${seasonShortName} has been ${dominantLabel.toLowerCase()}-heavy.`;
    }
    weeks[currentWeekIdx].planningHint =
      buildWeekPlanningHint(weeks, currentWeekIdx, seasonShortName);
  }

  // Per-org-competency proven evidence counts across this season's
  // steps. Drives the VISION lane's per-competency mini-bars when the
  // user has anchored their vision to specific competencies. Only
  // counts evidence rows that carry an org_competency_id (i.e. the
  // user tagged the evidence against a formal framework entry).
  //
  // We also accumulate a weekly trend (one slot per L4 bucket) so the
  // VISION lane can render a per-competency sparkline alongside the
  // running total. Bucket index = floor(sorted-position / 3), matching
  // the L4 brick layout so the sparkline x-axis lines up with the rest
  // of the canvas.
  const visionEvidenceByCompetency: Record<string, number> = {};
  const visionEvidenceTrendByCompetency: Record<string, number[]> = {};
  const totalWeekBuckets = bucketGroups.length;
  // Aggregate weekly proven-evidence count across ALL current-season
  // steps — drives the sparkline on the no-competency-anchors path of
  // the VISION lane, and the "+N this week" footer in both paths.
  const visionEvidenceTrend: number[] = new Array(totalWeekBuckets).fill(0);
  if (stepEvidenceMap && stepEvidenceMap.size > 0 && totalWeekBuckets > 0) {
    const stepWeekIndex = new Map<string, number>();
    sorted.forEach((rec, i) => {
      stepWeekIndex.set(rec.id, Math.floor(i / 3));
    });
    for (const rec of currentStepRecords) {
      const rows = stepEvidenceMap.get(rec.id);
      if (!rows) continue;
      const wk = stepWeekIndex.get(rec.id) ?? 0;
      for (const row of rows) {
        visionEvidenceTrend[wk] = (visionEvidenceTrend[wk] ?? 0) + 1;
        const cid = row.orgCompetencyId;
        if (!cid) continue;
        visionEvidenceByCompetency[cid] =
          (visionEvidenceByCompetency[cid] ?? 0) + 1;
        let trend = visionEvidenceTrendByCompetency[cid];
        if (!trend) {
          trend = new Array(totalWeekBuckets).fill(0);
          visionEvidenceTrendByCompetency[cid] = trend;
        }
        trend[wk] = (trend[wk] ?? 0) + 1;
      }
    }
  }

  const currentSeasonNode: TimelineSeason = {
    id: seasonIdForSteps,
    title: currentSeason?.name ?? currentSeason?.short_name ?? 'Current arc',
    dateRange:
      currentSeason && currentSeason.start_date && currentSeason.end_date
        ? formatDateRange(currentSeason.start_date, currentSeason.end_date)
        : '',
    weekOfTotal:
      weeks.length > 1
        ? { current: currentWeekIdx + 1, total: weeks.length }
        : undefined,
    weeks,
    bricks: currentBricks,
    analysis: currentSeasonAnalysis,
    visionStatement: interestVision?.statement ?? null,
    visionCompetencyIds: interestVision?.competencyIds ?? [],
    visionEvidenceByCompetency,
    visionEvidenceTrendByCompetency,
    visionEvidenceTrend,
    activePlanId: activePlanId ?? null,
  };

  // Index moved-via-Section-E step records by their target season id so
  // archived lanes can show real bricks instead of placeholders.
  const movedByArchiveId = new Map<string, TimelineStepRecord[]>();
  for (const rec of sorted) {
    const sid = seasonIdOf(rec);
    if (!sid || sid === seasonIdForSteps) continue;
    const bucket = movedByArchiveId.get(sid) ?? [];
    bucket.push(rec);
    movedByArchiveId.set(sid, bucket);
  }

  // Archived season lanes — dedupe by (name + start_date) so users with
  // duplicate-row data don't see the same rotation listed dozens of times.
  // Bricks-only (no week data needed for L4 visuals).
  const seenArchiveKeys = new Set<string>();
  const archivedSeasons: TimelineSeason[] = [];
  for (const s of allSeasons) {
    if (s.id === currentSeason?.id) continue;
    const name = s.name ?? s.short_name ?? 'Past arc';
    const key = `${name}::${s.start_date ?? ''}::${s.end_date ?? ''}`;
    if (seenArchiveKeys.has(key)) continue;
    seenArchiveKeys.add(key);
    const moved = movedByArchiveId.get(s.id) ?? [];
    archivedSeasons.push({
      id: s.id,
      title: name,
      dateRange:
        s.start_date && s.end_date ? formatDateRange(s.start_date, s.end_date) : '',
      archived: true,
      weeks: [],
      // Real bricks for steps the user has moved here; placeholders only
      // when no moved steps exist (until the archive RPC ships).
      bricks:
        moved.length > 0
          ? moved.map((rec) => ({
              capabilityColor: hashCategoryToColor(rec.category),
              stepId: rec.id,
              status: STATUS_MAP[rec.status],
              withOthers: (rec.collaborator_user_ids?.length ?? 0) > 0,
            }))
          : Array.from({ length: 8 }, () => ({
              capabilityColor: CAPABILITY_PALETTE.procedural.color,
            })),
    });
  }

  return {
    interest: { id: interestId ?? 'live', label: interestLabel, slug: interestSlug },
    user,
    focusStepId: actualFocusId,
    currentSeasonId: seasonIdForSteps,
    stepCounter: actualFocusId
      ? {
          current: Math.max(1, sorted.findIndex((s) => s.id === actualFocusId) + 1),
          total: sorted.length,
        }
      : undefined,
    weekCounter:
      weeks.length > 0
        ? { current: currentWeekIdx + 1, total: weeks.length }
        : undefined,
    totalSeasons: 1 + archivedSeasons.length,
    totalSteps:
      sorted.length + archivedSeasons.reduce((n, s) => n + s.bricks.length, 0),
    sinceDate: allSeasons[allSeasons.length - 1]?.start_date
      ? new Date(allSeasons[allSeasons.length - 1].start_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        })
      : '',
    sinceTimestamp: allSeasons[allSeasons.length - 1]?.start_date ?? undefined,
    seasons: [currentSeasonNode, ...archivedSeasons],
    capabilityFilters: [{ id: 'all', label: 'All' }],
    lifetime: computeLifetimeAnalysis(
      [currentSeasonNode, ...archivedSeasons],
      interestSlug ?? null,
    ),
  };
}
