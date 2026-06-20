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

import type { StepPlanData, StepCollaborator, StepReviewData, StepActData } from '@/types/step-detail';
import type { Season } from '@/types/season';
import type { TimelineStepRecord, TimelineStepStatus } from '@/types/timeline-steps';
import { CAPABILITY_PALETTE } from './sampleData';
import {
  isCrossInterestCapabilityLabel,
  resolveCapabilityVisuals,
  resolveInterestVocab,
  type InterestVocab,
} from './interestVocab';
import { formatMoney, resolveLoanTier, moneyConfigForCurrency } from './interestMoney';
import type { HeadlineMetricValue } from './interestHeadline';
import type {
  Capability,
  CohortAvatar,
  DayKey,
  LifetimeAnalysis,
  LifetimePeer,
  LifetimeQuant,
  LifetimeReflection,
  LifetimeSession,
  LifetimeTrophy,
  QuantCapabilityStat,
  QuantCrewMember,
  QuantNextAction,
  QuantReflectionWeek,
  QuantStatTile,
  SeasonAnalysis,
  SeasonLibrarianPrompt,
  SeasonMarker,
  SeasonPeer,
  SeasonPhase,
  SeasonQuant,
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

// First-run suppression: don't surface "the librarian noticed" / "-heavy"
// analysis (or cross-interest AI suggestions) until there's enough practice
// to actually have a pattern. Below this threshold a brand-new user just
// sees their steps, not premature coaching about trends that don't exist yet.
export const ANALYSIS_MIN_STEPS = 4;

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

// Generic categories that aren't useful as "drift" signal — every
// uncategorised step lands here, so showing them as the dominant
// capability for a season produces noise instead of information.
const GENERIC_CATEGORIES = new Set([
  '',
  'general',
  'uncategorized',
  'uncategorised',
  'misc',
  'other',
]);

/**
 * Display label for a step category in the persona's own vocabulary.
 * Returns null for generic / placeholder categories so they don't leak
 * into librarian sentences as "you've drifted from general toward general."
 *
 * Phase D direction: this becomes a vocab-table lookup keyed off the
 * active interest. Today it's a tasteful titlecase pass over the raw
 * category — already better than reverse-mapping from a 6-colour
 * palette baked with nursing terms.
 */
function categoryToLabel(category: string | null | undefined): string | null {
  const raw = (category ?? '').trim().toLowerCase();
  if (!raw || GENERIC_CATEGORIES.has(raw)) return null;
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
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

/**
 * Done-card digest — distills the Reflect tab's output into the three
 * strands the L2 nearby cover surfaces for steps left of NOW: the key
 * takeaway headline, a lead reflection line, and how many evidence
 * artifacts were captured. Returns empty strands for unreflected steps.
 */
function getReviewDigest(metadata: Record<string, unknown> | null | undefined): {
  keyTakeaway?: string;
  reflectionSummary?: string;
  evidenceCount?: number;
  review?: StepReviewData;
} {
  if (!metadata) return {};
  const review = (metadata as { review?: unknown }).review as StepReviewData | undefined;
  const act = (metadata as { act?: unknown }).act as StepActData | undefined;

  const keyTakeaway = review?.key_takeaway?.trim() || undefined;

  // Lead reflection line — prefer the "what did you learn" section, then
  // "what worked", then the legacy flat learning field.
  const sections = Array.isArray(review?.sections) ? review!.sections : [];
  const sectionContent = (prompt: string) =>
    sections.find((s) => s.prompt === prompt)?.content?.trim() || undefined;
  const reflectionSummary =
    sectionContent('what_did_you_learn') ??
    sectionContent('what_worked') ??
    review?.what_learned?.trim() ??
    undefined;

  const evidenceCount =
    (act?.media_uploads?.length ?? 0) + (act?.media_links?.length ?? 0);

  return {
    keyTakeaway,
    reflectionSummary,
    evidenceCount: evidenceCount > 0 ? evidenceCount : undefined,
    review,
  };
}

/**
 * True when the viewer has written their OWN reflection on this step —
 * any review section with content, a distilled takeaway, a legacy learning
 * field, or a recorded compose timestamp. Distinct from peer_reflections
 * (others reflecting on you); this is what makes "reflect on your own step"
 * count toward your reflection cadence.
 */
export function stepHasOwnerReflection(step: TimelineStep): boolean {
  const review = step.review;
  if (!review) return false;
  const sections = Array.isArray(review.sections) ? review.sections : [];
  if (sections.some((s) => (s.content ?? '').trim().length > 0)) return true;
  if ((review.key_takeaway ?? '').trim().length > 0) return true;
  if ((review.what_learned ?? '').trim().length > 0) return true;
  if ((review.teaching_reflection ?? '').trim().length > 0) return true;
  if (review.composed_at) return true;
  return false;
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
    name: c.display_name?.trim() || undefined,
    role: c.role?.trim() || undefined,
  };
}

const ROLE_HONORIFIC_REGEX = /^(preceptor|coach|mentor|instructor|teacher|guide|attending)$/i;

function isStepCollaborator(value: unknown): value is StepCollaborator {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StepCollaborator>;
  return typeof candidate.id === 'string' && typeof candidate.display_name === 'string';
}

function getPlanCollaborators(plan: StepPlanData | null): StepCollaborator[] {
  return Array.isArray(plan?.collaborators)
    ? plan.collaborators.filter(isStepCollaborator)
    : [];
}

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
  const planCollaborators = getPlanCollaborators(plan);
  const metadata = rec.metadata as { race_plan?: unknown } | null | undefined;

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
    .filter((sub) => sub.text?.trim())
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sub) => ({ id: sub.id, label: sub.text.trim(), checked: sub.completed }));
  const linkedResourceCount = plan?.linked_resource_ids?.length ?? 0;
  const whyReasoning = plan?.why_reasoning?.trim() || undefined;
  const whenLabel = formatWhenLabel(scheduleAnchor);
  const reviewDigest = getReviewDigest(rec.metadata);

  // Meta row — "Wed · <location>" left, "Preceptor: <name>" right
  const locName = plan?.where_location?.name ?? rec.location_name ?? null;
  const metaLeft = scheduleAnchor
    ? locName
      ? `${DAY_LABEL[dayKey]} · ${locName}`
      : DAY_LABEL[dayKey]
    : locName || undefined;
  const roleCollab = findRoleCollab(planCollaborators);
  const metaRight = roleCollab
    ? `${capitalize(roleCollab.role!)}: ${roleCollab.display_name}`
    : undefined;

  // Cohort avatars (excluding the role-tagged collab — they're called out
  // separately on the right of the meta row).
  const cohortAvatars: CohortAvatar[] | undefined = planCollaborators
    .filter((c) => !roleCollab || c.id !== roleCollab.id)
    .slice(0, 3)
    .map(collabToAvatar);
  const cohortLabel =
    planCollaborators.length > 0
      ? `${planCollaborators.length} ${planCollaborators.length === 1 ? 'collab' : 'collabs'}`
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

  // Titles are single-line. Some seed/capture rows appended "When: …\nWhere: …"
  // metadata into the title with newlines; keep only the first line so the L1
  // headline (and L3/L4 node labels) don't render that junk in big serif.
  const cleanTitle = (rec.title || 'Untitled step').split('\n')[0].trim() || 'Untitled step';

  return {
    id: rec.id,
    title: cleanTitle,
    preTitle,
    dayOfWeek: dayKey,
    weekId,
    seasonId,
    status: statusFromRecord(rec),
    originKind,
    metaLeft,
    metaRight,
    locationName: locName ?? undefined,
    whatBody: plan?.what_will_you_do || rec.description || undefined,
    whyReasoning,
    whenLabel,
    startsAt: rec.starts_at,
    endsAt: rec.ends_at,
    howItems,
    plan,
    review: reviewDigest.review,
    linkedResourceCount,
    keyTakeaway: reviewDigest.keyTakeaway,
    reflectionSummary: reviewDigest.reflectionSummary,
    evidenceCount: reviewDigest.evidenceCount,
    capabilities: stepCapabilities,
    from,
    cohortAvatars,
    cohortLabel,
    roleCollaborator: roleCollab ? collabToAvatar(roleCollab) : undefined,
    marker:
      typeof (rec.metadata as { season_marker?: unknown } | null)?.season_marker === 'string'
        ? ((rec.metadata as { season_marker?: string }).season_marker || undefined)
        : undefined,
    pinnedFromOtherInterest,
    isRace: rec.is_race === true,
    racePlan:
      metadata?.race_plan && typeof metadata.race_plan === 'object'
        ? (metadata.race_plan as TimelineStep['racePlan'])
        : undefined,
    metadata: rec.metadata ?? {},
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

/**
 * Re-project a week list's capability bands into ranked planned-vs-proven
 * stats for the Numbers view. Sums plannedVolume + provenVolume per
 * capability across weeks 1..maxWeek, computes each capability's share of
 * total volume, and sorts by total descending. Pure re-projection of data
 * the river already carries — no new schema.
 */
function aggregateCapabilityStats(
  weeklyCapabilities: WeeklyCapabilityMix[],
  maxWeek: number,
): QuantCapabilityStat[] {
  const byCap = new Map<
    string,
    { label: string; color: string; planned: number; proven: number }
  >();
  for (const week of weeklyCapabilities) {
    if (week.weekNumber > maxWeek) continue;
    for (const band of week.bands) {
      const id = band.capabilityId ?? band.capabilityLabel ?? band.capabilityColor;
      const planned = band.plannedVolume ?? 0;
      const proven = band.provenVolume ?? 0;
      const existing = byCap.get(id);
      if (existing) {
        existing.planned += planned;
        existing.proven += proven;
      } else {
        byCap.set(id, {
          label: band.capabilityLabel ?? 'Capability',
          color: band.capabilityColor,
          planned,
          proven,
        });
      }
    }
  }
  const rows = Array.from(byCap.entries()).map(([id, info]) => ({
    id,
    label: info.label,
    color: info.color,
    planned: info.planned,
    proven: info.proven,
    total: Math.max(info.planned, info.proven),
  }));
  const grandTotal = rows.reduce((n, r) => n + r.total, 0);
  return rows
    .map((r) => ({ ...r, share: grandTotal > 0 ? r.total / grandTotal : 0 }))
    .sort((a, b) => b.total - a.total);
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
      // A step pinned in from another interest is a cross-link, not part
      // of this sketchbook's capability development — its goals (e.g. a
      // sailing step's "Sail Racing") must not bleed into this chart.
      if (step.pinnedFromOtherInterest) continue;
      const caps = step.capabilities;
      const onlyFallback =
        !caps ||
        caps.length === 0 ||
        (caps.length === 1 && (caps[0]!.label === 'Practice' || caps[0]!.label === 'General'));
      // Planned layer — capability_goals from the Plan tab.
      if (!onlyFallback) {
        for (const cap of caps!) {
          if (cap.label === 'Practice' || cap.label === 'General') continue;
          if (isCrossInterestCapabilityLabel(cap.label)) continue;
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
      // Channel 1 — direct "with who?" tags. The honorific collaborator
      // (preceptor / coach) is excluded from the card crowd but carried
      // on `roleCollaborator`, so fold them back in here: the season
      // cohort lane wants the preceptor as a first-class peer (they
      // often shaped the rotation most), and their role drives the
      // legend ("Peer AN · preceptor").
      const channelOne = [
        ...(step.cohortAvatars ?? []),
        ...(step.roleCollaborator ? [step.roleCollaborator] : []),
      ];
      for (const avatar of channelOne) {
        bumpPeer(avatar.id, weekNumber, {
          initials: avatar.initials,
          name: avatar.name,
          color: avatar.color,
          role: avatar.role,
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
  // Owner reflections — the viewer's own review notes count toward their
  // reflection cadence, not just peers reflecting on them. Without this,
  // reflecting on your own step never lit a cadence cell (the cadence saw
  // only peer_reflections above).
  weeks.forEach((w, i) => {
    let owned = 0;
    for (const s of w.steps) {
      if (s.pinnedFromOtherInterest) continue;
      if (stepHasOwnerReflection(s)) owned += 1;
    }
    if (owned > 0) {
      const wk = i + 1;
      reflectionsPerWeek.set(wk, (reflectionsPerWeek.get(wk) ?? 0) + owned);
    }
  });
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
      if (step.pinnedFromOtherInterest) continue;
      const caps = step.capabilities && step.capabilities.length > 0
        ? step.capabilities
        : [capabilityForStep(step)];
      for (const capability of caps) {
        if (isCrossInterestCapabilityLabel(capability.label)) continue;
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
  const period = interestVocab.periodNoun;

  const phases = computeSeasonPhases(weeks, interestVocab);

  // Markers — named moments the user stamped on a step (metadata.season_marker),
  // floated above the river at that step's week.
  const markers: SeasonMarker[] = [];
  weeks.forEach((week, weekIdx) => {
    for (const step of week.steps) {
      if (!step.marker) continue;
      markers.push({
        id: `mk:${step.id}`,
        weekNumber: weekIdx + 1,
        kind: 'trophy',
        label: step.marker,
        capabilityColor: stepCapabilityColor(step),
      });
    }
  });

  // Cohort headline — the peer who shaped this season most. peers is
  // already sorted by total appearances, so peers[0] is the lead. Count
  // distinct weeks they showed up in for the "N of M weeks" framing.
  let cohortHeadline: SeasonAnalysis['cohortHeadline'];
  const lead = peers[0];
  if (lead && lead.name) {
    const weeksPresent = lead.weeklyAppearances.filter((w) => w.count > 0).length;
    cohortHeadline = {
      name: lead.name,
      weeksPresent,
      elapsed: currentWeekNumber,
      color: lead.capabilityColor ?? lead.color,
    };
  }

  // ── D-Numbers: quantified re-projection of the elapsed window ──────────
  // Everything below re-uses data already computed above (capability
  // bands, reflectionDensity, peers) — no new queries.
  const elapsedWeeks = Math.max(1, Math.min(currentWeekNumber, weeks.length));
  const quantCapabilities = aggregateCapabilityStats(weeklyCapabilities, elapsedWeeks);
  const totalPlanned = quantCapabilities.reduce((n, c) => n + c.planned, 0);
  const totalProven = quantCapabilities.reduce((n, c) => n + c.proven, 0);
  const elapsedStepCount = weeks
    .slice(0, elapsedWeeks)
    .reduce((n, w) => n + w.steps.filter((s) => !s.pinnedFromOtherInterest).length, 0);
  const evidenceRate = totalPlanned > 0 ? Math.round((totalProven / totalPlanned) * 100) : 0;
  const stepsPerWeek = elapsedWeeks > 0 ? elapsedStepCount / elapsedWeeks : 0;
  const provenEmpty = totalProven === 0;
  const quantStats: QuantStatTile[] = [
    provenEmpty
      ? {
          value: '—',
          label: 'evidence rate',
          note: totalPlanned > 0 ? `0 of ${totalPlanned} proven yet` : 'no evidence yet',
        }
      : {
          value: `${evidenceRate}%`,
          label: 'evidence rate',
          note: `${totalProven} of ${totalPlanned} proven`,
        },
    { value: stepsPerWeek.toFixed(1), label: 'steps / week' },
    { value: `${quantCapabilities.length}`, label: 'capabilities' },
  ];
  const cadence: QuantReflectionWeek[] = reflectionDensity
    .filter((d) => d.weekNumber <= elapsedWeeks)
    .map((d) => ({
      weekNumber: d.weekNumber,
      count: d.count,
      isNow: d.weekNumber === elapsedWeeks,
      filled: d.count > 0,
    }));
  const reflectedWeeks = cadence.filter((c) => c.filled).length;
  const cadenceLabel = `${reflectedWeeks} of ${cadence.length} weeks logged`;
  const quantCrew: QuantCrewMember[] = peers
    .map((p) => {
      const weeksPresent = p.weeklyAppearances.filter(
        (w) => w.weekNumber <= elapsedWeeks && w.count > 0,
      ).length;
      return {
        id: p.id,
        initials: p.initials,
        name: p.name ?? p.initials,
        role: p.role,
        color: p.capabilityColor ?? p.color,
        value: weeksPresent,
        ratio: elapsedWeeks > 0 ? weeksPresent / elapsedWeeks : 0,
        valueLabel: `${weeksPresent}/${elapsedWeeks} wks`,
      };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const nextActions: QuantNextAction[] = [];
  const openLoop = quantCapabilities
    .filter((c) => c.planned > 0 && c.proven === 0)
    .sort((a, b) => b.planned - a.planned)[0];
  if (openLoop) {
    nextActions.push({
      id: `open:${openLoop.id}`,
      color: openLoop.color,
      title: `${openLoop.label} is an open loop`,
      detail: `${openLoop.planned} planned, none proven yet — log evidence to close it.`,
      capture: true,
    });
  }
  const emptyWeek = cadence.find((c) => !c.filled && !c.isNow) ?? cadence.find((c) => !c.filled);
  if (emptyWeek) {
    nextActions.push({
      id: `refl:${emptyWeek.weekNumber}`,
      color: '#AF52DE',
      title: `Week ${emptyWeek.weekNumber} has no reflection`,
      detail: `Add a note so the ${period} shows what you learned, not just what you did.`,
      capture: true,
    });
  }
  const thin = quantCapabilities.filter((c) => c.total > 0 && c.total <= 1);
  if (thin.length > 0 && nextActions.length < 3) {
    const names = thin.slice(0, 2).map((c) => c.label);
    nextActions.push({
      id: 'thin',
      color: thin[0]!.color,
      title: `${names.join(' & ')} ${names.length > 1 ? 'are' : 'is'} thin`,
      detail: `Only a touch so far — a couple more steps would round out your mix.`,
    });
  }
  // Cap the displayed capability list; the long tail of single-touch
  // capabilities rolls up into a "+N more" row. Stats/actions above are
  // already computed over the full set, so capping is display-only.
  const CAP_LIMIT = 6;
  const quant: SeasonQuant = {
    kind: 'season',
    capabilities: quantCapabilities.slice(0, CAP_LIMIT),
    capabilitiesMore: Math.max(0, quantCapabilities.length - CAP_LIMIT),
    provenEmpty,
    stats: quantStats,
    cadence,
    cadenceLabel,
    cadenceEmpty: reflectedWeeks === 0,
    crew: quantCrew,
    crewHeader: interestVocab.crewHeader,
    nextActions,
  };

  // ── Story prose ────────────────────────────────────────────────────────
  // Draw on the same signals the Numbers view surfaces so the qualitative
  // voice is specific to this arc, not a fixed template: pace + breadth,
  // the dominant thread (with its runner-up), the lead crew member, and an
  // honest read on the doing-vs-proving gap.
  const secondLabel =
    quantCapabilities[1] && quantCapabilities[1]!.label !== dominantLabel
      ? quantCapabilities[1]!.label
      : null;
  const leadCrew = quantCrew[0];
  const stepNoun = elapsedStepCount === 1 ? 'step' : 'steps';

  const bodyParts: string[] = [];
  bodyParts.push(
    seasonName
      ? `You're ${currentWeekNumber} of ${weeks.length} weeks into ${seasonName}, ${elapsedStepCount} ${stepNoun} in.`
      : `You're ${currentWeekNumber} of ${weeks.length} weeks in, ${elapsedStepCount} ${stepNoun} logged.`,
  );
  if (dominantLabel) {
    bodyParts.push(
      secondLabel
        ? `${dominantLabel} is the thread you keep returning to, with ${secondLabel} close behind.`
        : `${dominantLabel} is the thread you keep returning to.`,
    );
  }
  const promptBody = bodyParts.join(' ');

  let emphasisLine: string | undefined;
  if (leadCrew && leadCrew.value > 0) {
    const firstName = leadCrew.name.split(' ')[0];
    emphasisLine = `${firstName} has been alongside ${leadCrew.value} of ${elapsedWeeks} ${
      elapsedWeeks === 1 ? 'week' : 'weeks'
    }.`;
  } else if (quantCapabilities.length > 0) {
    emphasisLine = `${quantCapabilities.length} capabilities touched, about ${stepsPerWeek.toFixed(
      1,
    )} a week.`;
  }

  let supportingLine: string;
  if (provenEmpty && reflectedWeeks === 0) {
    supportingLine = `Plenty done — but nothing proven or reflected on yet. That's the gap worth closing.`;
  } else if (nextActions[0]) {
    supportingLine = nextActions[0]!.detail;
  } else {
    supportingLine = `What do you want this ${period} to add up to?`;
  }

  return {
    weeklyCapabilities,
    phases,
    peers,
    reflections: [],
    reflectionDensity,
    markers: markers.length > 0 ? markers : undefined,
    cohortHeadline,
    quant,
    librarianPrompt: {
      eyebrow: interestVocab.librarianEyebrow,
      body: promptBody,
      emphasisLine,
      supportingLine,
      primaryCta: { label: `Review this ${period}`, intent: 'open-season-check-in' },
      secondaryCta: { label: 'Not now' },
    },
  };
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
  interestVocab: InterestVocab,
): SeasonLibrarianPrompt | undefined {
  const period = interestVocab.periodNoun;
  const currentWeek = weeks[currentWeekIdx];
  if (!currentWeek) return undefined;

  const seenCounts = new Map<string, { label: string; count: number }>();
  for (const week of weeks.slice(0, currentWeekIdx + 1)) {
    for (const step of week.steps) {
      const capability = capabilityForStep(step);
      if (isCrossInterestCapabilityLabel(capability.label)) continue;
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
        ? `This gap has been open for ${weeksSinceSeen} weeks. Use the next slot to rebalance the ${period} before the pattern hardens.`
        : `Use the next slot to rebalance the ${period} before the pattern hardens.`,
      primaryCta: { label: missingLabel ? `Add ${missingLabel}` : 'Add a step', intent: 'add-step' },
      secondaryCta: { label: 'Not now' },
    };
  }

  const dominantLabel = Array.from(seenCounts.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => (entry.label === 'Practice' || entry.label === 'General' ? null : entry.label))
    .find(Boolean) ?? null;
  const seasonCopy = seasonName ?? `this ${period}`;
  return {
    eyebrow: 'The librarian noticed',
    body: dominantLabel
      ? `${dominantLabel} is carrying most of the nearby weight in ${seasonCopy}.`
      : `This nearby run is clustering around one thread in ${seasonCopy}.`,
    emphasisLine: 'What should the next move add?',
    supportingLine: 'Use the next slot to add contrast, not more of the same.',
    primaryCta: { label: `Review this ${period}`, intent: 'open-season-check-in' },
    secondaryCta: { label: 'Not now' },
  };
}

/**
 * Rank the season's capabilities by volume across the weeks elapsed so
 * far — the same canonicalized capability-goal vocabulary and elapsed-week
 * window the L3 chip row uses (see L3SeasonView.capabilityFamilies). Lets
 * the L4 "through-line" speak "Boat handling / Tactics" instead of the
 * coarse category fallback ("Training / Preparation") that otherwise lets
 * pending blueprint categories dominate. Tiebreak alphabetically so L3 and
 * L4 pick the same lead among ties.
 */
function rankSeasonCapabilities(
  analysis: SeasonAnalysis | undefined,
  elapsedWeeks: number,
): { label: string; color: string; volume: number }[] {
  if (!analysis) return [];
  const tally = new Map<string, { label: string; color: string; volume: number }>();
  for (const wk of analysis.weeklyCapabilities) {
    if (wk.weekNumber > elapsedWeeks) continue;
    for (const band of wk.bands) {
      const label = band.capabilityLabel?.trim();
      if (!label || label === 'Practice' || label === 'General') continue;
      const vol = band.volume ?? (band.plannedVolume ?? 0) + (band.provenVolume ?? 0);
      if (vol <= 0) continue;
      const key = band.capabilityId ?? label;
      const entry = tally.get(key);
      if (entry) entry.volume += vol;
      else tally.set(key, { label, color: band.capabilityColor, volume: vol });
    }
  }
  return Array.from(tally.values()).sort((a, b) =>
    b.volume !== a.volume ? b.volume - a.volume : a.label.localeCompare(b.label),
  );
}

/**
 * Re-project the lifetime layer into quantified stats for the Numbers
 * view (L4). Distribution comes from the same canonicalized capability
 * ranking the through-line uses (so Story and Numbers agree); peers and
 * trajectory re-use the sessions/peers already on `lifetime`. No new
 * queries — pure re-projection.
 */
function computeLifetimeQuant(
  lifetime: LifetimeAnalysis,
  capabilityRanking: { label: string; color: string; volume: number }[],
  totalSteps: number,
  interestVocab: InterestVocab,
): LifetimeQuant {
  const totalVolume = capabilityRanking.reduce((n, c) => n + c.volume, 0);
  const capabilities: QuantCapabilityStat[] = capabilityRanking.map((c) => ({
    id: c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: c.label,
    color: c.color,
    planned: 0,
    proven: 0,
    total: c.volume,
    share: totalVolume > 0 ? c.volume / totalVolume : 0,
  }));
  const topCap = capabilities[0];
  const topShare = topCap ? Math.round(topCap.share * 100) : 0;
  const arcCount = lifetime.sessions.length;
  const period = interestVocab.periodNoun;
  const stats: QuantStatTile[] = [
    { value: `${totalSteps}`, label: 'steps logged' },
    { value: `${arcCount}`, label: arcCount === 1 ? period : `${period}s` },
    topCap
      ? { value: `${topShare}%`, label: 'top capability', note: topCap.label }
      : { value: `${capabilities.length}`, label: 'capabilities' },
  ];

  // Trajectory — drift from the first session's dominant capability to the
  // latest when they differ; otherwise the steady through-line.
  const first = lifetime.sessions[0];
  const last = lifetime.sessions[lifetime.sessions.length - 1];
  let trajectoryNote: string | undefined;
  if (first && last && first.dominantCapabilityLabel && last.dominantCapabilityLabel && first.dominantCapabilityLabel !== last.dominantCapabilityLabel) {
    trajectoryNote = `${first.dominantCapabilityLabel} → ${last.dominantCapabilityLabel}`;
  } else if (lifetime.throughLine) {
    trajectoryNote = `${lifetime.throughLine.label} is the through-line`;
  }

  // Peer constancy — total appearances across all sessions.
  const crew: QuantCrewMember[] = lifetime.peers
    .map((p) => {
      const value = p.sessionAppearances.reduce((n, s) => n + s.count, 0);
      return {
        id: p.id,
        initials: p.initials,
        name: p.name ?? p.initials,
        role: p.role,
        color: p.color,
        value,
        ratio: 0,
        valueLabel: `${value} step${value === 1 ? '' : 's'}`,
      };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const maxCrew = crew.reduce((m, c) => Math.max(m, c.value), 0);
  for (const c of crew) c.ratio = maxCrew > 0 ? c.value / maxCrew : 0;

  const nextActions: QuantNextAction[] = [];
  if (topCap) {
    nextActions.push({
      id: `through:${topCap.id}`,
      color: topCap.color,
      title: `Lean into ${topCap.label}`,
      detail: `It's ${topShare}% of your practice — your clearest through-line. Keep proving it with evidence.`,
    });
  }
  if (arcCount === 1) {
    nextActions.push({
      id: 'second-arc',
      color: '#AF52DE',
      title: `Log a second ${period}`,
      detail: `One ${period} so far — a second gives the trajectory something to compare against.`,
    });
  }
  const thin = capabilities.filter((c) => c.share > 0 && c.share < 0.12);
  if (thin.length > 0 && nextActions.length < 3) {
    const names = thin.slice(0, 2).map((c) => c.label);
    nextActions.push({
      id: 'breadth',
      color: thin[0]!.color,
      title: `${names.join(' & ')} ${names.length > 1 ? 'are' : 'is'} underweight`,
      detail: 'A few focused steps would broaden your base.',
    });
  }

  // Cap the displayed distribution; the long tail rolls into "+N more".
  // share/stats/actions above are computed over the full set.
  const CAP_LIMIT = 6;
  return {
    kind: 'lifetime',
    capabilities: capabilities.slice(0, CAP_LIMIT),
    capabilitiesMore: Math.max(0, capabilities.length - CAP_LIMIT),
    capabilitiesHeader: interestVocab.capabilityHeader,
    stats,
    trajectoryNote,
    crew,
    crewHeader: interestVocab.crewHeader,
    nextActions,
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
  capabilityRanking: { label: string; color: string; volume: number }[] = [],
): LifetimeAnalysis | undefined {
  if (seasons.length === 0) return undefined;

  // Sessions oldest → newest. The dataset's `seasons` array lists the
  // current rotation first then archived; reverse for chronological
  // order so the river reads left-to-right as past → present.
  const chronoSeasons = [...seasons].reverse();

  // Per-session dominant capability. Tracked by (label || color) so we
  // keep the real persona-vocab label when it's available, and fall back
  // to color-only dominance when the bricks are unlabelled. Phase D
  // D3 — stop reverse-mapping from colour to a nursing-coded palette.
  const sessionDominantLabels = new Map<number, string | null>();
  const sessions: LifetimeSession[] = chronoSeasons.map((season, idx) => {
    type Bucket = { color: string; label: string | null; count: number };
    const buckets = new Map<string, Bucket>();
    for (const brick of season.bricks) {
      const labelKey = brick.capabilityLabel?.trim() || `__color:${brick.capabilityColor}`;
      const existing = buckets.get(labelKey);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(labelKey, {
          color: brick.capabilityColor,
          label: brick.capabilityLabel ?? null,
          count: 1,
        });
      }
    }
    let dominant: Bucket | null = null;
    for (const bucket of buckets.values()) {
      if (!dominant || bucket.count > dominant.count) dominant = bucket;
    }
    const dominantColor = dominant?.color ?? CAPABILITY_PALETTE.procedural.color;
    sessionDominantLabels.set(idx + 1, dominant?.label ?? null);
    return {
      sessionIndex: idx + 1,
      seasonId: season.id,
      label: shortenSeasonLabel(season.title),
      dominantCapabilityColor: dominantColor,
      dominantCapabilityLabel: dominant?.label ?? null,
      volume: Math.max(1, season.bricks.length),
    };
  });

  const sessionCapabilityLabels = sessions.map((session) => ({
    sessionIndex: session.sessionIndex,
    label: sessionDominantLabels.get(session.sessionIndex) ?? null,
  }));

  // Peer union — same input channels as L3 (see computeSeasonAnalysis):
  // direct "with who?" tags + blueprint authors. Accumulated per session
  // instead of per week.
  const peerMap = new Map<
    string,
    {
      initials: string;
      color: string;
      name?: string;
      firstSessionIndex: number;
      perSession: Map<number, number>;
    }
  >();
  const bumpLifetimePeer = (
    id: string,
    sessionIndex: number,
    seed: { initials: string; color: string; name?: string },
  ) => {
    const entry = peerMap.get(id);
    if (entry) {
      entry.perSession.set(sessionIndex, (entry.perSession.get(sessionIndex) ?? 0) + 1);
      // First-seen name wins, but fill if we didn't have one before
      // (cohort avatars carry display_name; blueprint authors carry it
      // via the bp:slug branch).
      if (!entry.name && seed.name) entry.name = seed.name;
    } else {
      peerMap.set(id, {
        initials: seed.initials,
        color: seed.color,
        name: seed.name,
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
            name: avatar.name,
          });
        }
        const author = step.from?.suggestedBy?.trim();
        if (author) {
          bumpLifetimePeer(`bp:${author.toLowerCase()}`, sessionIndex, {
            initials: initialsFromName(author),
            color: deterministicPeerColor(author),
            name: author,
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
      name: p.name,
      firstSessionIndex: p.firstSessionIndex,
      sessionAppearances: Array.from(p.perSession.entries())
        .map(([sessionIndex, count]) => ({ sessionIndex, count }))
        .sort((a, b) => a.sessionIndex - b.sessionIndex),
    }))
    // Sort by arcs-spanned first (constancy is the L4 story), then by
    // raw step volume as a tiebreak. The journey chart used to sort by
    // volume only; with the constancy list landing alongside it, arcs-
    // spanned is the more honest primary signal.
    .sort((a, b) => {
      const arcsA = a.sessionAppearances.length;
      const arcsB = b.sessionAppearances.length;
      if (arcsA !== arcsB) return arcsB - arcsA;
      const volA = a.sessionAppearances.reduce((n, s) => n + s.count, 0);
      const volB = b.sessionAppearances.reduce((n, s) => n + s.count, 0);
      return volB - volA;
    })
    .slice(0, 12);

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
  // capability to the latest. Reads the dominant *label* carried up
  // from the brick layer, not reverse-mapped from a 6-colour palette,
  // so the sentence speaks the persona's actual category vocabulary
  // ("Race" / "Cardiac" / "Production") instead of leaking nursing
  // terms onto sailing or entrepreneur surfaces. Falls back to a
  // vocab-neutral sentence whenever the dominant labels are missing
  // (generic categories, sparse data).
  const firstSession = sessions[0];
  const lastSession = sessions[sessions.length - 1];
  const firstLabel = firstSession
    ? sessionDominantLabels.get(firstSession.sessionIndex) ?? null
    : null;
  const lastLabel = lastSession
    ? sessionDominantLabels.get(lastSession.sessionIndex) ?? null
    : null;
  const sinceLabel = firstSession?.label ?? 'you started';
  const drift =
    firstLabel && lastLabel && firstLabel !== lastLabel
      ? `Since ${sinceLabel} you've drifted from ${firstLabel.toLowerCase()} toward ${lastLabel.toLowerCase()}.`
      : firstLabel
        ? `${firstLabel} has been the steady thread across your practice.`
        : `Since ${sinceLabel} the texture of your practice has shifted.`;
  // Real conclusion even when the practice still lives in a single arc:
  // keying the "early in your practice" fallback off arc-count alone
  // mislabels a busy one-season practice (24 steps, one rotation) as empty.
  // Drive the conclusion off the canonicalized capability ranking (same
  // vocabulary + elapsed window as the L3 chips) so L3 and L4 agree, and
  // gate the early-practice fallback on real step volume.
  const totalBricks = chronoSeasons.reduce((n, s) => n + s.bricks.length, 0);
  const [topCap, secondCap] = capabilityRanking;
  const throughLine = topCap
    ? { label: topCap.label, color: topCap.color, secondLabel: secondCap?.label ?? null }
    : undefined;

  let promptBody: string;
  if (sessions.length > 1) {
    promptBody = `${drift} Worth a reflection on what you're becoming?`;
  } else if (topCap && totalBricks >= ANALYSIS_MIN_STEPS) {
    promptBody = secondCap
      ? `Across ${totalBricks} steps, ${topCap.label.toLowerCase()} and ${secondCap.label.toLowerCase()} are the through-line so far. Worth a reflection on what's emerging?`
      : `Across ${totalBricks} steps, ${topCap.label.toLowerCase()} is your clear through-line so far. Worth a reflection on widening the mix?`;
  } else {
    promptBody =
      "You're early in your practice. Keep going — patterns will emerge over the next few sessions.";
  }

  return {
    sessions,
    peers,
    reflections: reflections.slice(-3),
    trophies,
    throughLine,
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

/**
 * Arcs are date-bound, so every arc list orders chronologically: earlier
 * start_date first. Overlapping windows (university terms, cross-institution
 * arcs) tie-break on end_date, then created_at, then name; undated arcs sink
 * to the end. Shared by the dataset lanes, the Switch-arc picker, and the
 * Move-to-arc sheet so the order reads the same everywhere.
 */
export function compareSeasonsByStartDate(
  a: Pick<Season, 'name'> & Partial<Pick<Season, 'start_date' | 'end_date' | 'created_at'>>,
  b: Pick<Season, 'name'> & Partial<Pick<Season, 'start_date' | 'end_date' | 'created_at'>>,
): number {
  const t = (iso?: string | null) => {
    const v = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(v) ? Number.POSITIVE_INFINITY : v;
  };
  // NaN from Infinity-Infinity is falsy, so ties fall through each `||`.
  return (
    t(a.start_date) - t(b.start_date) ||
    t(a.end_date) - t(b.end_date) ||
    t(a.created_at) - t(b.created_at) ||
    (a.name ?? '').localeCompare(b.name ?? '')
  );
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
    /** Distinct from the season-bound statement — drives the L4
     *  lifetime banner. Null when the user hasn't set one. */
    lifetimeStatement?: string | null;
    competencyIds: string[];
  };
  /**
   * The user's active plan id for this interest. Drives the vision
   * edit write path: when set, VisionEditSheet updates this plan;
   * when null, it creates a new plan + writes vision to it.
   */
  activePlanId?: string | null;
  /**
   * Optional weekly business outcomes (entrepreneur interest only).
   * When supplied for an entrepreneurial persona, drives the D11
   * headline metric: current-season turnover ("₹X earned") on L3
   * and lifetime turnover + Mudra loan tier on L4. revenueMinor is
   * the smallest currency unit (paise for INR) — turnover, not net.
   */
  businessOutcomes?: BusinessOutcomeInput[];
  /**
   * Optional competency-attestation progress (nursing interest only).
   * Drives the PROGRAM headline: "6 of 8 signed" on L3 (competencies
   * worked this rotation that a preceptor validated) and "32% through
   * the program · 28 of 86 attested" on L4. Real accounts without
   * attestations leave this undefined → headline slot stays hidden.
   */
  competencyProgress?: CompetencyProgressInput;
}

export interface BusinessOutcomeInput {
  weekStart: string;
  revenueMinor: number;
  currency: string;
}

export interface CompetencyProgressInput {
  /** Total competencies in the interest's framework — the lifetime denominator. */
  totalCompetencies: number;
  /** One row per competency the user has any progress on. */
  rows: {
    status: string;
    validatedAt: string | null;
    lastAttemptAt: string | null;
  }[];
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
  businessOutcomes,
  competencyProgress,
}: AdapterInput): TimelineDataset {
  // Sort steps by sort_order, then starts_at. Stable ordering matters for
  // week bucketing fallback and L4 brick layout.
  // Resolve the persona vocab up-front so brick construction can tag
  // each brick with the canonical persona-vocab label + a palette
  // colour (instead of hashing the raw category to a 6-colour nursing
  // palette). Phase D D1 — vocab pass.
  const interestVocab = resolveInterestVocab(interestId, interestLabel, interestSlug);

  const sorted = [...steps].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const sa = a.starts_at ? Date.parse(a.starts_at) : 0;
    const sb = b.starts_at ? Date.parse(b.starts_at) : 0;
    return sa - sb;
  });

  // Suppress trend/coaching analysis until there's enough practice to have a
  // real pattern (first-run mode). See ANALYSIS_MIN_STEPS.
  const showAnalysis = sorted.length >= ANALYSIS_MIN_STEPS;

  // Group steps into rotation-relative buckets of 3, ordered by sort_order.
  const seasonIdForSteps = currentSeason?.id ?? 'current';

  // Canonical arc order — chronological by start_date (see
  // compareSeasonsByStartDate). dataset.seasons, the arc picker, and the
  // L4 chapter stack all read in this order.
  const orderedSeasons = [...allSeasons].sort(compareSeasonsByStartDate);
  const seasonRank = new Map(orderedSeasons.map((s, i) => [s.id, i]));

  // ---- Arc membership ------------------------------------------------
  // A step belongs to ONE arc; creating or switching arcs must not absorb
  // existing steps into the new current lane. Resolution order:
  //   1. metadata.season_id — explicit Move-to-arc intent (Section E).
  //   2. Date containment — the newest-starting arc whose [start, end]
  //      contains starts_at (created_at for unscheduled steps). The date
  //      is ground truth: a race dated June 13 belongs in the June arc
  //      even if it was composed while an earlier arc was active.
  //   3. season_id column — the race composer's creation-time default
  //      (active season at compose time). Only decides undated steps.
  //   4. NEAREST arc in time — an arc is a calendar block, so a May step
  //      belongs with the arc that starts in June, never with a
  //      brand-new Sep–Dec arc that happens to be current.
  //   5. The current arc — only when no dated arcs exist at all.
  // Explicit ids pointing at a season we can't render (deleted) fall
  // through to the date tiers.
  const knownSeasonIds = new Set<string>(allSeasons.map((s) => s.id));
  if (currentSeason) knownSeasonIds.add(currentSeason.id);
  const movedSeasonIdOf = (rec: TimelineStepRecord): string | null => {
    const meta = rec.metadata as { season_id?: unknown } | null | undefined;
    return typeof meta?.season_id === 'string' && knownSeasonIds.has(meta.season_id)
      ? meta.season_id
      : null;
  };
  const stampedSeasonIdOf = (rec: TimelineStepRecord): string | null =>
    rec.season_id && knownSeasonIds.has(rec.season_id) ? rec.season_id : null;
  const DAY_MS = 24 * 3600 * 1000;
  const windowSeasons = allSeasons
    .filter((s) => s.start_date && s.end_date)
    .sort((a, b) => Date.parse(b.start_date!) - Date.parse(a.start_date!));
  const dateSeasonIdsOf = (
    rec: TimelineStepRecord,
  ): { contained: string | null; nearest: string | null } => {
    const iso = rec.starts_at ?? rec.created_at;
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(t) || windowSeasons.length === 0) {
      return { contained: null, nearest: null };
    }
    let best: { id: string; dist: number } | null = null;
    for (const s of windowSeasons) {
      const start = Date.parse(s.start_date!);
      // end_date is a bare date (midnight) — make it inclusive.
      const end = Date.parse(s.end_date!) + DAY_MS;
      // Containment wins immediately; windowSeasons is newest-first so
      // overlapping arcs resolve to the newest one.
      if (t >= start && t < end) return { contained: s.id, nearest: s.id };
      const dist = t < start ? start - t : t - end;
      if (!best || dist < best.dist) best = { id: s.id, dist };
    }
    return { contained: null, nearest: best!.id };
  };
  const recordsByArc = new Map<string, TimelineStepRecord[]>();
  for (const rec of sorted) {
    const byDate = dateSeasonIdsOf(rec);
    const arcId =
      movedSeasonIdOf(rec) ??
      byDate.contained ??
      stampedSeasonIdOf(rec) ??
      byDate.nearest ??
      seasonIdForSteps;
    const bucket = recordsByArc.get(arcId);
    if (bucket) bucket.push(rec);
    else recordsByArc.set(arcId, [rec]);
  }
  const currentStepRecords = recordsByArc.get(seasonIdForSteps) ?? [];

  // The NOW anchor tracks the *viewer's own* progression. A step shared by
  // a collaborator (a peer's in_progress step surfaced via
  // collaborator_user_ids) must never reset the viewer's rotation clock —
  // otherwise a peer who is early in their own arc drags NOW back to week 1
  // and throttles the elapsed-week analysis. Prefer the viewer's own active
  // step, then fall back to any active step, then the first step.
  const isViewerStep = (s: TimelineStepRecord) =>
    !user.id || s.user_id === user.id;
  const isActive = (s: TimelineStepRecord) =>
    s.status === 'in_progress' || s.status === 'pending';
  const actualFocusId =
    focusStepId ??
    currentStepRecords.find((s) => isViewerStep(s) && isActive(s))?.id ??
    currentStepRecords.find(isActive)?.id ??
    currentStepRecords[0]?.id ??
    sorted[0]?.id ??
    '';

  const bucketGroups: TimelineStepRecord[][] = [];
  currentStepRecords.forEach((rec, i) => {
    const bucketIdx = Math.floor(i / 3);
    if (!bucketGroups[bucketIdx]) bucketGroups[bucketIdx] = [];
    bucketGroups[bucketIdx].push(rec);
  });

  // The "current" bucket is the one holding the focus step (first
  // in_progress/pending). Only fall back to bucket 0 when the focus
  // can't be located — otherwise every season reads as week 1, which
  // stalls the NOW marker and throttles the elapsed-week analysis
  // (capability counts + WHO SHAPED IT) to the opening week.
  const focusBucketIdx = bucketGroups.findIndex((g) =>
    g.some((r) => r.id === actualFocusId),
  );
  const currentBucketIdx = focusBucketIdx >= 0 ? focusBucketIdx : 0;

  const weeks: TimelineWeek[] = bucketGroups.map((bucketRecs, bucketIdx) => {
    const id = weekKeyOf(bucketIdx * 3);
    const { number, range } = weekRangeLabel(
      bucketRecs.map((r) => ({ starts_at: r.starts_at })),
      bucketIdx,
    );
    return {
      id,
      number,
      dateRange: range,
      isCurrent: bucketIdx === currentBucketIdx,
      steps: bucketRecs.map((r) => recordToStep(r, seasonIdForSteps, id, blueprintsById, user.id)),
    };
  });

  // One brick per step, capability-hashed. Carrying the step id lets L4's
  // brick tap navigate to the right step at L1, and lets Section D's
  // drag-reorder identify the lifted brick.
  const brickOf = (rec: TimelineStepRecord) => {
    const fallbackLabel = categoryToLabel(rec.category);
    const visuals = fallbackLabel
      ? resolveCapabilityVisuals(fallbackLabel, interestVocab)
      : null;
    return {
      capabilityColor: visuals?.color ?? hashCategoryToColor(rec.category),
      capabilityLabel: visuals?.canonicalLabel ?? fallbackLabel,
      title: rec.title ?? null,
      stepId: rec.id,
      status: STATUS_MAP[rec.status],
      withOthers: (rec.collaborator_user_ids?.length ?? 0) > 0,
    };
  };
  const currentBricks = currentStepRecords.map(brickOf);

  const currentWeekIdx = Math.max(
    0,
    weeks.findIndex((w) => w.isCurrent),
  );
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

  // First-run: below the maturity threshold there's no real trend to report,
  // so drop the "the librarian noticed" prompt rather than coach a newcomer
  // about patterns that don't exist yet.
  if (!showAnalysis && currentSeasonAnalysis) {
    currentSeasonAnalysis.librarianPrompt = undefined;
    currentSeasonAnalysis.quant = undefined;
  }

  // L2 context strip — "{Season} has been {capability}-heavy." Drives
  // the italic-serif sentence above the L2 carousel title. Same
  // dominant-capability derivation as the librarian prompt; computed
  // once and stamped on the current week.
  if (showAnalysis && currentSeasonAnalysis && weeks[currentWeekIdx]) {
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
    const realSeasonName = currentSeason?.short_name ?? currentSeason?.name ?? null;
    if (dominantLabel) {
      // Sentence-initial: capitalized fallback is correct here.
      const capPeriod =
        interestVocab.periodNoun.charAt(0).toUpperCase() +
        interestVocab.periodNoun.slice(1);
      weeks[currentWeekIdx].contextStrip = `${realSeasonName ?? `This ${capPeriod}`} has been ${dominantLabel.toLowerCase()}-heavy.`;
    }
    // Mid-sentence inside the hint: pass the real name (or null) so the
    // builder's own lowercase 'this <period>' fallback applies — never the
    // capitalized form mid-sentence.
    weeks[currentWeekIdx].planningHint =
      buildWeekPlanningHint(weeks, currentWeekIdx, realSeasonName, interestVocab);
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
    currentStepRecords.forEach((rec, i) => {
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

  // D11 headline (entrepreneur only) — turnover from the real
  // business_outcomes table. revenueMinor is paise; ÷100 → rupees.
  // Turnover (gross), NOT net: the table has revenue only, no cost
  // column, so the wording is "earned" / "/wk" — never "net".
  let seasonHeadline: HeadlineMetricValue | undefined;
  let lifetimeHeadline: HeadlineMetricValue | undefined;
  if (interestVocab.id === 'entrepreneur' && businessOutcomes && businessOutcomes.length > 0) {
    const moneyConfig = moneyConfigForCurrency(businessOutcomes[0]?.currency);
    if (moneyConfig) {
      const toMajor = (rows: BusinessOutcomeInput[]) =>
        rows.reduce((sum, r) => sum + r.revenueMinor / 100, 0);

      const lifetimeTurnover = toMajor(businessOutcomes);
      const tier = resolveLoanTier(lifetimeTurnover, moneyConfig);
      const lifetimeCaption = tier
        ? tier.next
          ? `${tier.current.label} active · ${Math.round(tier.fraction * 100)}% to ${tier.next.label}`
          : `${tier.current.label} — top tier reached`
        : `${businessOutcomes.length} weeks tracked`;
      lifetimeHeadline = {
        value: formatMoney(lifetimeTurnover, moneyConfig),
        caption: lifetimeCaption,
        tone: 'positive',
      };

      // Season scope: weeks whose week_start falls inside the current
      // season window. Fall back to all rows when the season has no
      // dates (single-block accounts) so the figure is never empty.
      const seasonStart = currentSeason?.start_date
        ? Date.parse(currentSeason.start_date)
        : null;
      const seasonEnd = currentSeason?.end_date
        ? Date.parse(currentSeason.end_date)
        : null;
      const inWindow =
        seasonStart != null && seasonEnd != null
          ? businessOutcomes.filter((r) => {
              const t = Date.parse(r.weekStart);
              return !Number.isNaN(t) && t >= seasonStart && t <= seasonEnd;
            })
          : businessOutcomes;
      const seasonRows = inWindow.length > 0 ? inWindow : businessOutcomes;
      const seasonTurnover = toMajor(seasonRows);
      const weeklyAvg = seasonTurnover / seasonRows.length;
      seasonHeadline = {
        value: `${formatMoney(seasonTurnover, moneyConfig)} earned`,
        caption: `${seasonRows.length} ${seasonRows.length === 1 ? 'week' : 'weeks'} · ${formatMoney(weeklyAvg, moneyConfig)}/wk avg`,
        tone: 'positive',
      };
    }
  }

  // PROGRAM headline (nursing only) — preceptor attestations from the
  // real betterat_competency_progress table. "Signed" = a competency
  // whose progress row has been validated/attested by a preceptor
  // (status validated|competent, with validated_by + validated_at set).
  // Season scope counts attestations whose validated_at falls inside the
  // rotation window; lifetime counts all attested rows against the full
  // competency framework for the interest.
  if (interestVocab.id === 'nursing' && competencyProgress) {
    const ATTESTED = new Set(['validated', 'competent']);
    const attestedRows = competencyProgress.rows.filter((r) =>
      ATTESTED.has(r.status),
    );

    // Lifetime: attested competencies vs the full framework.
    const totalCompetencies = Math.max(
      competencyProgress.totalCompetencies,
      attestedRows.length,
    );
    if (totalCompetencies > 0) {
      const pct = Math.round((attestedRows.length / totalCompetencies) * 100);
      lifetimeHeadline = {
        value: `${pct}% through program`,
        caption: `${attestedRows.length} of ${totalCompetencies} competencies attested`,
        tone: 'positive',
      };
    }

    // Season: competencies worked this rotation (last attempt inside the
    // window) and how many of those were signed off inside the window.
    const seasonStart = currentSeason?.start_date
      ? Date.parse(currentSeason.start_date)
      : null;
    const seasonEnd = currentSeason?.end_date
      ? Date.parse(currentSeason.end_date)
      : null;
    const inWindow = (iso: string | null): boolean => {
      if (!iso) return false;
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return false;
      if (seasonStart != null && t < seasonStart) return false;
      if (seasonEnd != null && t > seasonEnd) return false;
      return true;
    };
    const hasWindow = seasonStart != null && seasonEnd != null;
    const workedThisRotation = hasWindow
      ? competencyProgress.rows.filter((r) => inWindow(r.lastAttemptAt))
      : competencyProgress.rows;
    const signedThisRotation = workedThisRotation.filter(
      (r) =>
        ATTESTED.has(r.status) &&
        (hasWindow ? inWindow(r.validatedAt) : r.validatedAt != null),
    );
    if (workedThisRotation.length > 0) {
      seasonHeadline = {
        value: `${signedThisRotation.length} of ${workedThisRotation.length} signed`,
        caption: 'rotation competencies attested by preceptor',
        delta:
          signedThisRotation.length > 0
            ? {
                direction: 'up',
                text: `+${signedThisRotation.length} this ${interestVocab.periodNoun}`,
              }
            : undefined,
        tone: 'positive',
      };
    }
  }

  const currentSeasonNode: TimelineSeason = {
    id: seasonIdForSteps,
    title:
      currentSeason?.name ??
      currentSeason?.short_name ??
      `Current ${interestVocab.periodNoun}`,
    dateRange:
      currentSeason && currentSeason.start_date && currentSeason.end_date
        ? formatDateRange(currentSeason.start_date, currentSeason.end_date)
        : '',
    startDateISO: currentSeason?.start_date ?? undefined,
    endDateISO: currentSeason?.end_date ?? undefined,
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
    headline: seasonHeadline,
  };

  // Non-current season lanes — dedupe by (name + start_date) so users with
  // duplicate-row data don't see the same rotation listed dozens of times.
  // Each lane gets REAL weeks + bricks from the steps that resolved to it,
  // so switching the picker to a past arc shows its steps instead of an
  // empty lane.
  const seenArchiveKeys = new Set<string>();
  const archivedSeasons: TimelineSeason[] = [];
  for (const s of orderedSeasons) {
    if (s.id === currentSeason?.id) continue;
    const name = s.name ?? s.short_name ?? 'Past arc';
    const key = `${name}::${s.start_date ?? ''}::${s.end_date ?? ''}`;
    if (seenArchiveKeys.has(key)) continue;
    seenArchiveKeys.add(key);
    const laneRecords = recordsByArc.get(s.id) ?? [];
    const laneGroups: TimelineStepRecord[][] = [];
    laneRecords.forEach((rec, i) => {
      const bucketIdx = Math.floor(i / 3);
      if (!laneGroups[bucketIdx]) laneGroups[bucketIdx] = [];
      laneGroups[bucketIdx].push(rec);
    });
    const laneWeeks: TimelineWeek[] = laneGroups.map((bucketRecs, bucketIdx) => {
      const id = weekKeyOf(bucketIdx * 3);
      const { number, range } = weekRangeLabel(
        bucketRecs.map((r) => ({ starts_at: r.starts_at })),
        bucketIdx,
      );
      return {
        id,
        number,
        dateRange: range,
        // Past arcs have no live NOW; anchor it on the closing bucket so
        // the lane reads as fully elapsed.
        isCurrent: bucketIdx === laneGroups.length - 1,
        steps: bucketRecs.map((r) =>
          recordToStep(r, s.id, id, blueprintsById, user.id),
        ),
      };
    });
    archivedSeasons.push({
      id: s.id,
      title: name,
      dateRange:
        s.start_date && s.end_date ? formatDateRange(s.start_date, s.end_date) : '',
      startDateISO: s.start_date ?? undefined,
      endDateISO: s.end_date ?? undefined,
      // Badge from the REAL status — a non-current lane is often just
      // another active arc (e.g. one created a moment ago), and labeling
      // it "archived" reads as data loss to the user.
      archived: s.status === 'archived',
      weeks: laneWeeks,
      // Placeholder bricks only when the lane has no resolvable steps
      // (legacy arcs that predate step tracking, until the archive RPC
      // ships).
      bricks:
        laneRecords.length > 0
          ? laneRecords.map(brickOf)
          : Array.from({ length: 8 }, () => ({
              capabilityColor: CAPABILITY_PALETTE.procedural.color,
            })),
    });
  }

  // dataset.seasons reads chronologically — current arc sits at its date
  // position, not pinned first. Consumers look it up by currentSeasonId.
  const orderedLanes = [currentSeasonNode, ...archivedSeasons].sort(
    (a, b) => (seasonRank.get(a.id) ?? -1) - (seasonRank.get(b.id) ?? -1),
  );

  const lifetimeCapabilityRanking = rankSeasonCapabilities(
    currentSeasonAnalysis,
    currentWeekIdx + 1,
  );
  const lifetime = computeLifetimeAnalysis(
    [currentSeasonNode, ...archivedSeasons],
    lifetimeCapabilityRanking,
  );
  // All real steps (every lane) + placeholder estimates for legacy lanes
  // with no resolvable steps.
  const totalSteps =
    sorted.length +
    archivedSeasons.reduce(
      (n, s) => n + (s.weeks.length === 0 && s.bricks.length > 0 ? s.bricks.length : 0),
      0,
    );
  // First-run: suppress the lifetime "worth a reflection?" / "you're early in
  // your practice" prompt until there's enough history to mean something.
  if (!showAnalysis && lifetime) {
    lifetime.librarianPrompt = undefined;
    lifetime.quant = undefined;
  } else if (lifetime) {
    lifetime.quant = computeLifetimeQuant(
      lifetime,
      lifetimeCapabilityRanking,
      totalSteps,
      interestVocab,
    );
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
    totalSteps,
    sinceDate: orderedSeasons[0]?.start_date
      ? new Date(orderedSeasons[0].start_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        })
      : '',
    sinceTimestamp: orderedSeasons[0]?.start_date ?? undefined,
    lifetimeVisionStatement: interestVision?.lifetimeStatement ?? null,
    lifetimeHeadline,
    seasons: orderedLanes,
    capabilityFilters: [{ id: 'all', label: 'All' }],
    lifetime,
  };
}
