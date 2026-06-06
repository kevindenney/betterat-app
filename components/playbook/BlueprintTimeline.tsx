import React from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { useBlueprintWithAuthor, useBlueprintSubscribers, useBlueprintSubscription } from '@/hooks/useBlueprint';
import { addToTimeline, saveToDeck, type TimelineAddPreview } from '@/services/AddToTimelineService';
import { AddToTimelineSheet, FilterStrip } from '@/components/timelines';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { StepCollaborator, StepPlanData, RacePlan, SubStep } from '@/types/step-detail';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type BlueprintStepTimelineRow = {
  blueprintStepId: string;
  sortOrder: number;
  step: TimelineStepRecord;
  progressStatus: string | null;
  adoptedStepId: string | null;
};

type BlueprintFilter = 'all' | 'in-progress' | 'settled';
type StepPhase = 'plan' | 'do' | 'review' | 'discuss';
type PillState = 'settled' | 'current' | 'planned';

/** Lighten (amount > 0) or darken (amount < 0) a hex colour for the hero gradient. */
function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const to = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = (c: number) => Math.round(c + (to - c) * t);
  const r = ch(parseInt(m[1], 16));
  const g = ch(parseInt(m[2], 16));
  const b = ch(parseInt(m[3], 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Resolve the hero accent: the author's stored colour, else a stable hash tone. */
function accentFor(color: string | null | undefined, seed: string): string {
  if (color && /^#?[a-f\d]{6}$/i.test(color.trim())) {
    return color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`;
  }
  const palette = ['#28406B', '#8B5A3C', '#B8855A', '#6E8B5A', '#7A5A8B'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function toPillState(row: BlueprintStepTimelineRow): PillState {
  if (row.progressStatus === 'settled' || row.progressStatus === 'completed') return 'settled';
  if (row.progressStatus === 'current' || row.progressStatus === 'in_progress' || row.progressStatus === 'started') return 'current';
  return 'planned';
}

/**
 * Per-step phase tag. The legend explains the loop every step runs (plan → do
 * → review → discuss); the tag shows where THIS step sits in that loop for the
 * viewer right now, derived from their own progress. There is no stored phase
 * field — `planned → plan`, `in motion → do`, `settled → review`.
 */
function derivePhase(pill: PillState): StepPhase {
  if (pill === 'current') return 'do';
  if (pill === 'settled') return 'review';
  return 'plan';
}

const PHASE_META: Record<StepPhase, { label: string; color: string; bg: string }> = {
  plan: { label: 'Plan', color: '#0A4E40', bg: '#E2F2EE' },
  do: { label: 'Do', color: '#1D4ED8', bg: '#E6EDFD' },
  review: { label: 'Review', color: '#B7791F', bg: '#FBF3E2' },
  discuss: { label: 'Discuss', color: '#7A2D9E', bg: '#F3E8FB' },
};

const STATUS_META: Record<PillState, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  settled: { label: 'Settled', icon: 'checkmark-circle', color: '#0A4E40' },
  current: { label: 'In motion', icon: 'time', color: '#B7791F' },
  planned: { label: 'Not started', icon: 'ellipse-outline', color: '#667085' },
};

const LEGEND: { phase: StepPhase; sub: string }[] = [
  { phase: 'plan', sub: 'the what' },
  { phase: 'do', sub: 'work it' },
  { phase: 'review', sub: 'how it went' },
  { phase: 'discuss', sub: 'with crew' },
];

function planOf(step: TimelineStepRecord): StepPlanData {
  return (step.metadata?.plan ?? {}) as StepPlanData;
}

function capabilitiesOf(plan: StepPlanData): string[] {
  const p = plan as StepPlanData & { competency_labels?: string[] };
  return [
    ...((plan.capability_goals ?? []).filter(Boolean)),
    ...((p.competency_labels ?? []).filter(Boolean)),
  ];
}

function racePlanOf(step: TimelineStepRecord): RacePlan | null {
  if (!step.is_race) return null;
  const rp = (step.metadata?.race_plan ?? null) as RacePlan | null;
  return rp;
}

function extractPreview(step: TimelineStepRecord, sourceLabel: string): TimelineAddPreview {
  const plan = planOf(step);
  return {
    sourceLabel,
    title: step.title ?? 'Untitled step',
    body:
      String(plan.what_will_you_do || '').trim() ||
      String(plan.why_reasoning || '').trim() ||
      step.description ||
      '',
    capabilities: capabilitiesOf(plan).slice(0, 5),
  };
}

function collaboratorInitials(c: StepCollaborator): string {
  if (c.avatar_emoji) return c.avatar_emoji;
  const parts = c.display_name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function loadBlueprintTimeline(
  blueprintId: string,
  userId: string,
): Promise<BlueprintStepTimelineRow[]> {
  const { data: bpSteps, error: bpErr } = await supabase
    .from('blueprint_steps')
    .select('id, step_id, sort_order')
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  if (bpErr) throw bpErr;

  const blueprintSteps = (bpSteps ?? []) as { id: string; step_id: string; sort_order: number }[];
  if (blueprintSteps.length === 0) return [];

  const stepIds = blueprintSteps.map((row) => row.step_id);
  const blueprintStepIds = blueprintSteps.map((row) => row.id);

  const [stepsRes, progressRes, adoptedRes] = await Promise.all([
    supabase.from('timeline_steps').select('*').in('id', stepIds),
    supabase
      .from('step_user_progress')
      .select('blueprint_step_id, status')
      .eq('user_id', userId)
      .in('blueprint_step_id', blueprintStepIds),
    supabase
      .from('timeline_steps')
      .select('id, source_id')
      .eq('user_id', userId)
      .eq('source_type', 'blueprint')
      .in('source_id', blueprintStepIds),
  ]);

  if (stepsRes.error) throw stepsRes.error;
  if (progressRes.error) throw progressRes.error;
  if (adoptedRes.error) throw adoptedRes.error;

  const stepMap = new Map((stepsRes.data ?? []).map((step: any) => [step.id, step as TimelineStepRecord]));
  const progressMap = new Map((progressRes.data ?? []).map((row: any) => [row.blueprint_step_id, row.status as string]));
  const adoptedMap = new Map((adoptedRes.data ?? []).map((row: any) => [row.source_id, row.id as string]));

  return blueprintSteps
    .map((row) => {
      const step = stepMap.get(row.step_id);
      if (!step) return null;
      return {
        blueprintStepId: row.id,
        sortOrder: row.sort_order,
        step,
        progressStatus: progressMap.get(row.id) ?? null,
        adoptedStepId: adoptedMap.get(row.id) ?? null,
      } satisfies BlueprintStepTimelineRow;
    })
    .filter(Boolean) as BlueprintStepTimelineRow[];
}

// ───────────────────────────────────────────────────────────
// Step card — the connected timeline row that expands to its interior
// ───────────────────────────────────────────────────────────

function BlueprintStepCard({
  row,
  index,
  isLast,
  accent,
  open,
  authorView,
  subscriberCount,
  onToggle,
  onPrimary,
  onEdit,
}: {
  row: BlueprintStepTimelineRow;
  index: number;
  isLast: boolean;
  accent: string;
  open: boolean;
  authorView: boolean;
  subscriberCount: number;
  onToggle: () => void;
  onPrimary: () => void;
  onEdit: () => void;
}) {
  const pill = toPillState(row);
  const phase = derivePhase(pill);
  const phaseMeta = PHASE_META[phase];
  const statusMeta = STATUS_META[pill];
  const plan = planOf(row.step);
  const what = String(plan.what_will_you_do || '').trim();
  const desc = (row.step.description || what || '').trim();
  const subSteps: SubStep[] = [...(plan.how_sub_steps ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const collaborators: StepCollaborator[] = plan.collaborators ?? [];
  const legacyWho: string[] = (plan.who_collaborators ?? []).filter(Boolean);
  const caps = capabilitiesOf(plan);
  const why = String(plan.why_reasoning || '').trim() || (caps.length ? caps.join(' · ') : '');
  const race = racePlanOf(row.step);

  const adopted = row.adoptedStepId != null;
  const primaryLabel = authorView
    ? 'Open this step'
    : adopted
      ? 'Open this step'
      : 'Add to my plan';
  const primaryIcon: keyof typeof Ionicons.glyphMap = !authorView && !adopted ? 'add' : 'arrow-forward';

  return (
    <View style={styles.tstep}>
      <View style={styles.rail}>
        <View
          style={[
            styles.node,
            pill === 'settled' && { backgroundColor: accent, borderColor: accent },
            pill === 'current' && { borderColor: accent, backgroundColor: '#FFFFFF' },
          ]}
        >
          {pill === 'settled' ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : (
            <Text style={[styles.nodeNum, pill === 'current' && { color: accent }]}>{index + 1}</Text>
          )}
        </View>
        {!isLast && (
          <View
            style={[styles.line, pill === 'settled' && { backgroundColor: shade(accent, 0.45) }]}
          />
        )}
      </View>

      <View style={styles.card}>
        <Pressable style={styles.cardhead} onPress={onToggle}>
          <View style={styles.chMain}>
            <View style={styles.chTop}>
              <View style={[styles.phtag, { backgroundColor: phaseMeta.bg }]}>
                <Text style={[styles.phtagText, { color: phaseMeta.color }]}>
                  {phaseMeta.label}
                </Text>
              </View>
              <View style={styles.chStatus}>
                <Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} />
                <Text style={[styles.chStatusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>
            <Text style={styles.chTitle}>{row.step.title ?? 'Untitled step'}</Text>
            {desc ? (
              <Text style={styles.chDesc} numberOfLines={open ? undefined : 2}>
                {desc}
              </Text>
            ) : null}
            {caps.length > 0 && (
              <View style={styles.chMeta}>
                {caps.slice(0, 3).map((c, i) => (
                  <View key={`${c}-${i}`} style={styles.cap}>
                    <Text style={styles.capText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
            {authorView && (
              <View style={styles.authorStat}>
                <Ionicons name="people" size={13} color={PHASE_META.plan.color} />
                <Text style={styles.authorStatText}>
                  {row.adoptedStepId ? 'In subscribers’ plans' : 'Published step'} ·{' '}
                  {subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}
                </Text>
              </View>
            )}
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#667085"
            style={styles.caret}
          />
        </Pressable>

        {open && (
          <View style={styles.interior}>
            {/* THE WHAT */}
            {what ? (
              <View style={styles.facetFull}>
                <View style={styles.fk}>
                  <Ionicons name="information-circle-outline" size={12} color={accent} />
                  <Text style={[styles.fkText, { color: accent }]}>The what</Text>
                </View>
                <Text style={styles.fv}>{what}</Text>
              </View>
            ) : null}

            {/* HOW · sub-steps */}
            {subSteps.length > 0 && (
              <>
                <Text style={styles.facetLead}>How · sub-steps</Text>
                <View style={styles.subs}>
                  {subSteps.map((s) => (
                    <View key={s.id} style={styles.sub}>
                      <View
                        style={[
                          styles.subBox,
                          s.completed && { backgroundColor: accent, borderColor: accent },
                        ]}
                      >
                        {s.completed && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.subText, s.completed && styles.subTextDone]}>
                        {s.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* RACE → Atlas course */}
            {race && (
              <View style={styles.course}>
                <View style={styles.courseBadge}>
                  <Ionicons name="boat-outline" size={12} color="#0A4E40" />
                  <Text style={styles.courseBadgeText}>Race step · course on Atlas</Text>
                </View>
                <Text style={styles.courseMarks}>
                  {[race.area_name, race.course_label].filter(Boolean).join(' · ') ||
                    'Course mapped on Atlas'}
                </Text>
              </View>
            )}

            {/* WHY / WHO */}
            <View style={styles.facetGrid}>
              {why ? (
                <View style={styles.facetBox}>
                  <View style={styles.fk}>
                    <Ionicons name="layers-outline" size={12} color={accent} />
                    <Text style={[styles.fkText, { color: accent }]}>Why</Text>
                  </View>
                  <Text style={styles.fv}>{why}</Text>
                </View>
              ) : null}
              {(collaborators.length > 0 || legacyWho.length > 0) && (
                <View style={styles.facetBox}>
                  <View style={styles.fk}>
                    <Ionicons name="people-outline" size={12} color={accent} />
                    <Text style={[styles.fkText, { color: accent }]}>Who</Text>
                  </View>
                  <View style={styles.who}>
                    {collaborators.map((c) => (
                      <View key={c.id} style={styles.person}>
                        <View
                          style={[
                            styles.personAv,
                            { backgroundColor: c.avatar_color || accent },
                          ]}
                        >
                          <Text style={styles.personAvText}>{collaboratorInitials(c)}</Text>
                        </View>
                        <Text style={styles.personName}>
                          {c.display_name}
                          {c.role ? ` · ${c.role}` : ''}
                        </Text>
                      </View>
                    ))}
                    {collaborators.length === 0 &&
                      legacyWho.map((name, i) => (
                        <View key={`${name}-${i}`} style={styles.person}>
                          <View style={[styles.personAv, { backgroundColor: accent }]}>
                            <Text style={styles.personAvText}>
                              {name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.personName}>{name}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </View>

            {/* footer action */}
            <View style={styles.interiorFoot}>
              <Pressable
                style={[styles.stepBtn, styles.stepBtnPrimary, { backgroundColor: accent }]}
                onPress={onPrimary}
              >
                <Ionicons name={primaryIcon} size={16} color="#FFFFFF" />
                <Text style={styles.stepBtnPrimaryText}>{primaryLabel}</Text>
              </Pressable>
              {authorView && (
                <Pressable style={[styles.stepBtn, styles.stepBtnGhost]} onPress={onEdit}>
                  <Ionicons name="create-outline" size={16} color="#344054" />
                  <Text style={styles.stepBtnGhostText}>Edit</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export function BlueprintTimeline({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const { data: subscribers = [] } = useBlueprintSubscribers(blueprintId);
  const { data: subscription } = useBlueprintSubscription(blueprintId);
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['phase7-blueprint-timeline', blueprintId, user?.id],
    queryFn: () => loadBlueprintTimeline(blueprintId, user!.id),
    enabled: Boolean(blueprintId && user?.id),
  });
  const [pendingRow, setPendingRow] = React.useState<BlueprintStepTimelineRow | null>(null);
  const [filter, setFilter] = React.useState<BlueprintFilter>('all');
  const [openIds, setOpenIds] = React.useState<Set<string>>(new Set());
  const [legendOpen, setLegendOpen] = React.useState(false);

  const isAuthor = Boolean(user?.id && blueprint?.user_id && user.id === blueprint.user_id);
  // Authors land in the author view (edit + subscriber-reach), but can flip to
  // see exactly what a subscriber sees. Non-authors are always subscribers.
  const [authorView, setAuthorView] = React.useState(false);
  React.useEffect(() => {
    setAuthorView(isAuthor);
  }, [isAuthor]);

  const counts = React.useMemo(() => {
    const inProgress = rows.filter((row) => toPillState(row) === 'current').length;
    const settled = rows.filter((row) => toPillState(row) === 'settled').length;
    const adopted = rows.filter((row) => row.adoptedStepId != null).length;
    return { all: rows.length, inProgress, settled, adopted };
  }, [rows]);

  const visibleRows = React.useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'in-progress') return rows.filter((row) => toPillState(row) === 'current');
    return rows.filter((row) => toPillState(row) === 'settled');
  }, [rows, filter]);

  const allOpen = visibleRows.length > 0 && visibleRows.every((row) => openIds.has(row.blueprintStepId));

  const toggleStep = React.useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIds((prev) => {
      const everyOpen = visibleRows.length > 0 && visibleRows.every((row) => prev.has(row.blueprintStepId));
      if (everyOpen) return new Set();
      return new Set(visibleRows.map((row) => row.blueprintStepId));
    });
  }, [visibleRows]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const authorName = blueprint?.author_name ?? 'Author';
  const authorEmoji = blueprint?.author_avatar_emoji ?? '👤';
  const orgName = blueprint?.organization_name;
  // Prefer the denormalized count (authoritative, ranks the catalog) — the
  // subscribers list is RLS-gated so a non-owner viewer sees zero rows.
  const subscriberCount = blueprint?.subscriber_count ?? subscribers.length;

  // Tint the hero from the author's stored avatar colour (their blueprints all
  // read one tone); fall back to a stable hash if it's unset.
  const accent = accentFor(blueprint?.author_avatar_color, blueprint?.author_name ?? blueprintId);

  const handlePrimary = (row: BlueprintStepTimelineRow) => {
    if (authorView) {
      router.push(`/step/${row.step.id}` as any);
      return;
    }
    if (row.adoptedStepId) {
      router.push(`/step/${row.adoptedStepId}` as any);
      return;
    }
    setPendingRow(row);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[accent, shade(accent, -0.4)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <Text style={styles.eyebrow}>Blueprint</Text>
            <View style={styles.heroTopRight}>
              {isAuthor && (
                <View style={styles.viewTog}>
                  <Pressable
                    onPress={() => setAuthorView(false)}
                    style={[styles.viewTogBtn, !authorView && styles.viewTogBtnOn]}
                  >
                    <Text style={[styles.viewTogText, !authorView && styles.viewTogTextOn]}>
                      Subscriber
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAuthorView(true)}
                    style={[styles.viewTogBtn, authorView && styles.viewTogBtnOn]}
                  >
                    <Text style={[styles.viewTogText, authorView && styles.viewTogTextOn]}>
                      Author
                    </Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => router.push(`/(tabs)/library/blueprints/${blueprintId}/co-practitioners` as any)}
                hitSlop={8}
              >
                <Text style={styles.coPractitionersLink}>Co-practitioners ›</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.title}>{blueprint?.title ?? 'Blueprint'}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{authorEmoji}</Text>
            </View>
            <Text style={styles.heroMeta}>by {authorName}</Text>
            {orgName ? (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.heroMeta}>{orgName}</Text>
              </>
            ) : null}
            <View style={styles.metaDot} />
            <Text style={styles.heroMeta}>
              {subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}
            </Text>
            {(subscription || isAuthor) && (
              <View style={styles.subscribedPill}>
                <Text style={styles.subscribedPillText}>
                  {isAuthor && authorView ? 'Your blueprint' : 'Subscribed'}
                </Text>
              </View>
            )}
          </View>

          {/* PHASE LEGEND — the loop every step runs (reframed band) */}
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              {LEGEND.map(({ phase, sub }) => (
                <View key={phase} style={styles.ph}>
                  <Text style={styles.phLabel}>{PHASE_META[phase].label}</Text>
                  <Text style={styles.phSub}>{sub}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.legendNote} onPress={() => setLegendOpen((v) => !v)}>
              <Ionicons name="help-circle-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.legendNoteText}>What do these mean?</Text>
            </Pressable>
            {legendOpen && (
              <Text style={styles.legendExplain}>
                Every step you adopt runs this loop: you <Text style={styles.legendBold}>plan</Text> what
                it is, <Text style={styles.legendBold}>do</Text> it,{' '}
                <Text style={styles.legendBold}>review</Text> how it went, then{' '}
                <Text style={styles.legendBold}>discuss</Text> it with your crew or coach. The tag on
                each step shows where it sits in that loop for you right now — the blueprint isn’t in
                one phase, each step is.
              </Text>
            )}
          </View>

          {/* SUBSCRIBER PROGRESS */}
          {!authorView && (subscription || !isAuthor) && counts.all > 0 ? (
            <View style={styles.ovr}>
              <View style={styles.ovrTop}>
                <Text style={styles.ovrLabel}>Your progress</Text>
                <Text style={styles.ovrCount}>
                  {counts.settled} of {counts.all} settled
                  {counts.inProgress > 0 ? ` · ${counts.inProgress} in motion` : ''}
                </Text>
              </View>
              <View style={styles.ovrBar}>
                <View
                  style={[
                    styles.ovrFill,
                    {
                      width: `${counts.all > 0 ? Math.round((counts.settled / counts.all) * 100) : 0}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </LinearGradient>

        {/* AUTHOR BANNER */}
        {authorView && (
          <View style={styles.authbar}>
            <View style={styles.authbarIcon}>
              <Ionicons name="create-outline" size={17} color="#FFFFFF" />
            </View>
            <Text style={styles.authbarText}>
              You published this plan.{' '}
              <Text style={styles.authbarBold}>
                {subscriberCount} {subscriberCount === 1 ? 'person' : 'people'} subscribed.
              </Text>{' '}
              Tap any step to open its what / how / why / who — changes flow to everyone on the path.
            </Text>
          </View>
        )}

        <FilterStrip
          options={[
            { key: 'all', label: `All ${counts.all}` },
            { key: 'in-progress', label: `In motion ${counts.inProgress}` },
            { key: 'settled', label: `Settled ${counts.settled}` },
          ]}
          selectedKey={filter}
          onSelect={(key) => setFilter(key as BlueprintFilter)}
        />

        <View style={styles.seclead}>
          <Text style={styles.secleadTitle}>
            The path · {counts.all} step{counts.all === 1 ? '' : 's'}
          </Text>
          {visibleRows.length > 0 && (
            <Pressable onPress={toggleAll} hitSlop={6}>
              <Text style={[styles.secleadHint, { color: accent }]}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Text>
            </Pressable>
          )}
        </View>

        {visibleRows.length === 0 ? (
          <Text style={styles.empty}>
            {filter === 'all'
              ? 'This blueprint has no steps yet.'
              : `No ${filter === 'in-progress' ? 'in-motion' : 'settled'} steps yet.`}
          </Text>
        ) : (
          <View style={styles.timeline}>
            {visibleRows.map((row, idx) => (
              <BlueprintStepCard
                key={row.blueprintStepId}
                row={row}
                index={idx}
                isLast={idx === visibleRows.length - 1}
                accent={accent}
                open={openIds.has(row.blueprintStepId)}
                authorView={authorView}
                subscriberCount={subscriberCount}
                onToggle={() => toggleStep(row.blueprintStepId)}
                onPrimary={() => handlePrimary(row)}
                onEdit={() => router.push(`/step/${row.step.id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AddToTimelineSheet
        visible={Boolean(pendingRow)}
        preview={
          pendingRow
            ? extractPreview(
                pendingRow.step,
                blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
              )
            : { sourceLabel: '', title: '', body: '', capabilities: [] }
        }
        onDismiss={() => setPendingRow(null)}
        onAdd={async (placement, date) => {
          if (!pendingRow || !user?.id) return;
          if (!pendingRow.step.interest_id) {
            toast.show("This step isn't linked to an interest yet — can't add it.", 'error');
            return;
          }
          try {
            await addToTimeline({
              userId: user.id,
              interestId: pendingRow.step.interest_id,
              preview: extractPreview(
                pendingRow.step,
                blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
              ),
              placement,
              sourceType: 'blueprint',
              sourceId: pendingRow.blueprintStepId,
              date,
            });
            setPendingRow(null);
            await refetch();
            toast.show('Added to timeline', 'success');
          } catch (err) {
            console.warn('[BlueprintTimeline] add to timeline failed', err);
            toast.show('Could not add to timeline. Please try again.', 'error');
          }
        }}
        onSaveToDeck={async () => {
          if (!pendingRow || !user?.id) return;
          if (!pendingRow.step.interest_id) {
            toast.show("This step isn't linked to an interest yet — can't add it.", 'error');
            return;
          }
          try {
            await saveToDeck({
              userId: user.id,
              interestId: pendingRow.step.interest_id,
              preview: extractPreview(
                pendingRow.step,
                blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
              ),
              sourceType: 'blueprint',
              sourceId: pendingRow.blueprintStepId,
            });
            setPendingRow(null);
            toast.show('Saved to deck', 'success');
          } catch (err) {
            console.warn('[BlueprintTimeline] save to deck failed', err);
            toast.show('Could not save to deck. Please try again.', 'error');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6FA',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // ── hero ──
  hero: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 11,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.82)',
  },
  viewTog: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    padding: 3,
  },
  viewTogBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  viewTogBtnOn: {
    backgroundColor: '#FFFFFF',
  },
  viewTogText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  viewTogTextOn: {
    color: '#101828',
  },
  coPractitionersLink: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  title: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 13,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  subscribedPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  subscribedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ── legend ──
  legend: {
    marginTop: 7,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ph: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  phLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.82)',
  },
  phSub: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    marginTop: 2,
  },
  legendNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
  },
  legendNoteText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  legendExplain: {
    fontSize: 12.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
    marginTop: 7,
  },
  legendBold: {
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── subscriber progress ──
  ovr: {
    marginTop: 4,
    gap: 7,
  },
  ovrTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  ovrLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ovrCount: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ovrBar: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  ovrFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },

  // ── author banner ──
  authbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FBF3E2',
    borderWidth: 1,
    borderColor: '#EAD9AE',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  authbarIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#B7791F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authbarText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#6B4A08',
  },
  authbarBold: {
    fontWeight: '800',
  },

  // ── section lead ──
  seclead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  secleadTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#667085',
  },
  secleadHint: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── timeline ──
  timeline: {
    flexDirection: 'column',
  },
  tstep: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: 34,
    alignItems: 'center',
  },
  node: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E7ECF3',
  },
  nodeNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#667085',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#E7ECF3',
    marginTop: 3,
  },

  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7ECF3',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardhead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  chMain: {
    flex: 1,
    minWidth: 0,
  },
  chTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  phtag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phtagText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  chStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
    color: '#101828',
  },
  chDesc: {
    fontSize: 13.5,
    color: '#344054',
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 7,
  },
  chMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  cap: {
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#E7ECF3',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  capText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#344054',
  },
  authorStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  authorStatText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0A4E40',
  },
  caret: {
    marginTop: 1,
  },

  // ── interior ──
  interior: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  facetFull: {
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#E7ECF3',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  facetGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  facetBox: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#E7ECF3',
    borderRadius: 12,
    padding: 12,
  },
  fk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fkText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fv: {
    fontSize: 13,
    fontWeight: '600',
    color: '#101828',
    marginTop: 5,
    lineHeight: 18,
  },
  facetLead: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#667085',
    marginTop: 16,
    marginBottom: 8,
  },
  subs: {
    gap: 8,
  },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subBox: {
    width: 17,
    height: 17,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E7ECF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subText: {
    flex: 1,
    fontSize: 13.5,
    color: '#344054',
    fontWeight: '500',
  },
  subTextDone: {
    color: '#667085',
    textDecorationLine: 'line-through',
  },

  // ── race course ──
  course: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E7ECF3',
    borderRadius: 12,
    overflow: 'hidden',
    height: 96,
    backgroundColor: '#BFDDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  courseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#0A4E40',
  },
  courseMarks: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0A4E40',
    paddingHorizontal: 12,
    textAlign: 'center',
  },

  // ── who ──
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 7,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7ECF3',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 11,
  },
  personAv: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  personName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#101828',
  },

  // ── interior footer ──
  interiorFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  stepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 11,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stepBtnPrimary: {
    flex: 1,
  },
  stepBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  stepBtnGhost: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7ECF3',
    paddingHorizontal: 14,
  },
  stepBtnGhostText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#344054',
    letterSpacing: -0.2,
  },

  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
