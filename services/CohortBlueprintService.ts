/**
 * CohortBlueprintService — student-side delivery for institution-managed
 * Studio blueprints (System B: public.blueprints + blueprint_step_templates).
 *
 * The new admin Studio authors institutional blueprints into `blueprints`
 * (access_mode='institutional') and attaches them to cohorts via
 * `blueprint_cohorts`. The legacy student paths (discoverBlueprints /
 * subscribeToBlueprint / adoptStep) all operate on System A
 * (timeline_blueprints + blueprint_steps), and the marketplace catalog only
 * lists independent + Stripe-priced blueprints — so an institutional Studio
 * blueprint a professor publishes had no way to reach the assigned student.
 *
 * This service is that bridge. A student is "assigned" a blueprint when they
 * belong (betterat_org_cohort_members) to a cohort the blueprint is linked to
 * (blueprint_cohorts). Materializing copies each blueprint_step_templates row
 * into a per-user timeline_steps row — the same shape adoptStep produces, so
 * the Do/Reflect/complete loop (and the org-competency evidence linking it
 * feeds) works unchanged.
 *
 * RLS already permits all reads here for any active org member
 * (blueprints_org_member_read, blueprint_cohorts_org_member_read,
 * blueprint_step_templates_org_read), so no SECURITY DEFINER RPC is needed.
 */

import { supabase } from './supabase';
import { logger } from '@/lib/logger';

export interface AssignedBlueprint {
  id: string;
  title: string;
  description: string | null;
  orgId: string;
  orgName: string | null;
  cohortName: string | null;
  /** The blueprint's authored interest — the subscribe sheet's strong default. */
  interestId: string | null;
  interestSlug: string | null;
  interestName: string | null;
  /** Faculty author of the blueprint — shown + linked on the preview. */
  authorUserId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  totalSteps: number;
  /** How many of this blueprint's templates the student has already
   *  materialized into their own timeline. */
  adoptedSteps: number;
  /** Of the adopted steps, how many the student has completed — drives the
   *  "X of Y" progress on the Library Plans card. */
  doneSteps: number;
}

export interface AssignedBlueprintStep {
  id: string;
  sortOrder: number;
  title: string;
  description: string | null;
  preceptorRole: string | null;
  /** Whether the student has already materialized this template into their
   *  own timeline (drives "Added" vs nothing in the detail step list). */
  adopted: boolean;
}

export interface AssignedBlueprintDetail extends AssignedBlueprint {
  steps: AssignedBlueprintStep[];
}

interface TemplateRow {
  id: string;
  blueprint_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  category: string | null;
  what_question: string | null;
  sub_steps: { n?: number; text?: string }[] | null;
  preceptor_role: string | null;
  capability_tags: string[] | null;
  capability_competency_ids: string[] | null;
  plan_metadata: Record<string, unknown> | null;
}

interface MarketplaceMaterializeRpcResult {
  count?: number;
  first_step_id?: string | null;
  step_ids?: string[];
  step_ids_by_template_id?: Record<string, string>;
}

const TEMPLATE_SELECT_BASE =
  'id, blueprint_id, sort_order, title, description, category, what_question, sub_steps, preceptor_role, capability_tags, plan_metadata';
const TEMPLATE_SELECT_WITH_COMPETENCY_IDS = `${TEMPLATE_SELECT_BASE}, capability_competency_ids`;

function isMissingCapabilityCompetencyColumn(error: unknown): boolean {
  const text =
    typeof error === 'object' && error !== null
      ? `${(error as { message?: unknown }).message ?? ''} ${(error as { details?: unknown }).details ?? ''}`
      : String(error);
  return text.includes('capability_competency_ids');
}

async function fetchTemplatesForMaterialization(blueprintId: string): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('blueprint_step_templates')
    .select(TEMPLATE_SELECT_WITH_COMPETENCY_IDS)
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  if (!error) return (data ?? []) as TemplateRow[];
  if (!isMissingCapabilityCompetencyColumn(error)) throw error;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('blueprint_step_templates')
    .select(TEMPLATE_SELECT_BASE)
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  if (fallbackError) throw fallbackError;
  return ((fallbackData ?? []) as Omit<TemplateRow, 'capability_competency_ids'>[]).map((row) => ({
    ...row,
    capability_competency_ids: null,
  }));
}

async function fetchStudentCohortIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('betterat_org_cohort_members')
    .select('cohort_id')
    .eq('user_id', userId);
  if (error) {
    logger.warn('Failed to read student cohort memberships', error);
    return [];
  }
  return Array.from(
    new Set((data ?? []).map((r) => (r as { cohort_id: string }).cohort_id).filter(Boolean)),
  );
}

/**
 * The institutional blueprints assigned to the student through any of their
 * cohorts, scoped to one interest. Each row carries the student's adoption
 * progress so the surface can show "Add" vs "Added · N steps".
 */
export async function fetchAssignedBlueprints(
  userId: string,
  interestId?: string | null,
): Promise<AssignedBlueprint[]> {
  try {
    const cohortIds = await fetchStudentCohortIds(userId);
    if (cohortIds.length === 0) return [];

    // cohort → blueprint links
    const { data: links, error: linkErr } = await supabase
      .from('blueprint_cohorts')
      .select('blueprint_id, cohort_id')
      .in('cohort_id', cohortIds);
    if (linkErr) throw linkErr;
    const blueprintIds = Array.from(
      new Set((links ?? []).map((l) => (l as { blueprint_id: string }).blueprint_id)),
    );
    if (blueprintIds.length === 0) return [];

    // live blueprints in this interest
    let bpQuery = supabase
      .from('blueprints')
      .select('id, title, description, org_id, interest_id, author_user_id')
      .in('id', blueprintIds)
      .eq('status', 'live');
    if (interestId) bpQuery = bpQuery.eq('interest_id', interestId);
    const { data: bps, error: bpErr } = await bpQuery;
    if (bpErr) throw bpErr;
    const blueprints = (bps ?? []) as {
      id: string;
      title: string;
      description: string | null;
      org_id: string;
      interest_id: string | null;
      author_user_id: string | null;
    }[];
    if (blueprints.length === 0) return [];

    const liveIds = blueprints.map((b) => b.id);

    // templates → total step count + which template ids belong to which bp
    const { data: templates, error: tplErr } = await supabase
      .from('blueprint_step_templates')
      .select('id, blueprint_id')
      .in('blueprint_id', liveIds);
    if (tplErr) throw tplErr;
    const totalByBp = new Map<string, number>();
    const templateBpById = new Map<string, string>();
    for (const t of (templates ?? []) as { id: string; blueprint_id: string }[]) {
      totalByBp.set(t.blueprint_id, (totalByBp.get(t.blueprint_id) ?? 0) + 1);
      templateBpById.set(t.id, t.blueprint_id);
    }

    // org names + cohort names for labels
    const orgIds = Array.from(new Set(blueprints.map((b) => b.org_id)));
    const [{ data: orgs }, { data: cohorts }] = await Promise.all([
      supabase.from('organizations').select('id, name').in('id', orgIds),
      supabase.from('betterat_org_cohorts').select('id, name').in('id', cohortIds),
    ]);
    const orgNameById = new Map(
      ((orgs ?? []) as { id: string; name: string | null }[]).map((o) => [o.id, o.name]),
    );
    const cohortNameById = new Map(
      ((cohorts ?? []) as { id: string; name: string | null }[]).map((c) => [c.id, c.name]),
    );

    // interest slug/name for the subscribe sheet's author-interest default
    const interestIds = Array.from(
      new Set(blueprints.map((b) => b.interest_id).filter((v): v is string => Boolean(v))),
    );
    const interestById = new Map<string, { slug: string | null; name: string | null }>();
    if (interestIds.length > 0) {
      const { data: interestRows } = await supabase
        .from('interests')
        .select('id, slug, name')
        .in('id', interestIds);
      for (const r of (interestRows ?? []) as { id: string; slug: string | null; name: string | null }[]) {
        interestById.set(r.id, { slug: r.slug, name: r.name });
      }
    }
    // faculty author profile (name + avatar) for the preview's author row
    const authorIds = Array.from(
      new Set(blueprints.map((b) => b.author_user_id).filter((v): v is string => Boolean(v))),
    );
    const authorById = new Map<string, { name: string | null; avatarUrl: string | null }>();
    if (authorIds.length > 0) {
      // users.full_name is the app-editable display name ("Dr. Evelyn Reyes");
      // profiles.full_name often holds the raw signup email. Studio reads users,
      // so the preview must too or the author shows as "jhu2+denneyke@gmail.com".
      const [usersRes, profilesRes] = await Promise.all([
        supabase.from('users').select('id, full_name').in('id', authorIds),
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', authorIds),
      ]);
      for (const r of (profilesRes.data ?? []) as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }[]) {
        authorById.set(r.id, { name: r.full_name, avatarUrl: r.avatar_url });
      }
      for (const r of (usersRes.data ?? []) as { id: string; full_name: string | null }[]) {
        const existing = authorById.get(r.id);
        authorById.set(r.id, {
          name: r.full_name || existing?.name || null,
          avatarUrl: existing?.avatarUrl ?? null,
        });
      }
    }

    // first cohort that surfaced each blueprint, for a "via {cohort}" label
    const cohortNameByBp = new Map<string, string | null>();
    for (const l of (links ?? []) as { blueprint_id: string; cohort_id: string }[]) {
      if (!cohortNameByBp.has(l.blueprint_id)) {
        cohortNameByBp.set(l.blueprint_id, cohortNameById.get(l.cohort_id) ?? null);
      }
    }

    // how many templates the student has already adopted, and of those how
    // many they've completed (drives the Plans-card progress)
    const templateIds = Array.from(templateBpById.keys());
    const adoptedByBp = new Map<string, number>();
    const doneByBp = new Map<string, number>();
    if (templateIds.length > 0) {
      const { data: adopted, error: adoptedErr } = await supabase
        .from('timeline_steps')
        .select('source_id, status')
        .eq('user_id', userId)
        .eq('source_type', 'marketplace_copy')
        .in('source_id', templateIds);
      if (adoptedErr) throw adoptedErr;
      for (const r of (adopted ?? []) as { source_id: string | null; status: string }[]) {
        if (!r.source_id) continue;
        const bpId = templateBpById.get(r.source_id);
        if (!bpId) continue;
        adoptedByBp.set(bpId, (adoptedByBp.get(bpId) ?? 0) + 1);
        if (r.status === 'completed' || r.status === 'settled') {
          doneByBp.set(bpId, (doneByBp.get(bpId) ?? 0) + 1);
        }
      }
    }

    return blueprints
      .map<AssignedBlueprint>((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        orgId: b.org_id,
        orgName: orgNameById.get(b.org_id) ?? null,
        cohortName: cohortNameByBp.get(b.id) ?? null,
        interestId: b.interest_id,
        interestSlug: b.interest_id ? interestById.get(b.interest_id)?.slug ?? null : null,
        interestName: b.interest_id ? interestById.get(b.interest_id)?.name ?? null : null,
        authorUserId: b.author_user_id,
        authorName: b.author_user_id ? authorById.get(b.author_user_id)?.name ?? null : null,
        authorAvatarUrl: b.author_user_id ? authorById.get(b.author_user_id)?.avatarUrl ?? null : null,
        totalSteps: totalByBp.get(b.id) ?? 0,
        adoptedSteps: adoptedByBp.get(b.id) ?? 0,
        doneSteps: doneByBp.get(b.id) ?? 0,
      }))
      // a blueprint with no authored steps has nothing to add yet
      .filter((b) => b.totalSteps > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch (err) {
    logger.error('Failed to fetch assigned blueprints', err);
    return [];
  }
}

/**
 * One assigned blueprint plus its ordered step templates, each flagged with
 * whether the student has already adopted it. Powers the read-only preview a
 * student opens before (or after) adding the plan. Returns null when the
 * blueprint isn't live or isn't assigned to this student.
 */
export async function fetchAssignedBlueprintDetail(
  userId: string,
  blueprintId: string,
): Promise<AssignedBlueprintDetail | null> {
  // Reuse the list builder (org/cohort labels + adoption/progress counts) so
  // the detail header never disagrees with the row that opened it.
  const all = await fetchAssignedBlueprints(userId, null);
  const base = all.find((b) => b.id === blueprintId);
  if (!base) return null;

  const { data: tpls, error: tplErr } = await supabase
    .from('blueprint_step_templates')
    .select('id, sort_order, title, description, preceptor_role')
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  if (tplErr) {
    logger.warn('Failed to read assigned blueprint templates', tplErr);
    return { ...base, steps: [] };
  }
  const templates = (tpls ?? []) as {
    id: string;
    sort_order: number;
    title: string;
    description: string | null;
    preceptor_role: string | null;
  }[];

  const templateIds = templates.map((t) => t.id);
  const adoptedIds = new Set<string>();
  if (templateIds.length > 0) {
    const { data: adopted } = await supabase
      .from('timeline_steps')
      .select('source_id')
      .eq('user_id', userId)
      .eq('source_type', 'marketplace_copy')
      .in('source_id', templateIds);
    for (const r of (adopted ?? []) as { source_id: string | null }[]) {
      if (r.source_id) adoptedIds.add(r.source_id);
    }
  }

  return {
    ...base,
    steps: templates.map((t) => ({
      id: t.id,
      sortOrder: t.sort_order,
      title: t.title,
      description: t.description,
      preceptorRole: t.preceptor_role,
      adopted: adoptedIds.has(t.id),
    })),
  };
}

export interface InstitutionalNextStep {
  blueprintId: string;
  blueprintTitle: string;
  orgName: string | null;
  interestId: string | null;
  templateId: string;
  templateTitle: string;
  templateDescription: string | null;
  /** Remaining unadopted templates in this blueprint, including this one. */
  remaining: number;
}

/**
 * The next pullable template from every institutional/marketplace blueprint the
 * student has a relationship with but hasn't fully adopted — the composer's
 * per-step pull surface (spec §5, decision 3). One entry per blueprint (its
 * lowest-sort_order not-yet-adopted template), so "From your blueprints" lists
 * institutional plans alongside System-A ones.
 */
export async function fetchInstitutionalNextSteps(
  userId: string,
  interestId?: string | null,
): Promise<InstitutionalNextStep[]> {
  const assigned = await fetchAssignedBlueprints(userId, interestId ?? null);
  const pullable = assigned.filter((b) => b.adoptedSteps < b.totalSteps);
  if (pullable.length === 0) return [];

  const results: InstitutionalNextStep[] = [];
  for (const bp of pullable) {
    const { data: tpls, error: tplErr } = await supabase
      .from('blueprint_step_templates')
      .select('id, sort_order, title, description')
      .eq('blueprint_id', bp.id)
      .order('sort_order', { ascending: true });
    if (tplErr || !tpls || tpls.length === 0) continue;
    const templates = tpls as {
      id: string;
      sort_order: number;
      title: string;
      description: string | null;
    }[];

    const templateIds = templates.map((t) => t.id);
    const adoptedIds = new Set<string>();
    const { data: adopted } = await supabase
      .from('timeline_steps')
      .select('source_id')
      .eq('user_id', userId)
      .eq('source_type', 'marketplace_copy')
      .in('source_id', templateIds);
    for (const r of (adopted ?? []) as { source_id: string | null }[]) {
      if (r.source_id) adoptedIds.add(r.source_id);
    }

    const next = templates.find((t) => !adoptedIds.has(t.id));
    if (!next) continue;
    results.push({
      blueprintId: bp.id,
      blueprintTitle: bp.title,
      orgName: bp.orgName,
      interestId: bp.interestId,
      templateId: next.id,
      templateTitle: next.title,
      templateDescription: next.description,
      remaining: templates.filter((t) => !adoptedIds.has(t.id)).length,
    });
  }
  return results;
}

export interface InstitutionalBlueprintMeta {
  id: string;
  title: string;
  orgName: string | null;
}

/**
 * Minimal title + org label for one institutional blueprint, by id. Powers the
 * "From {blueprint}" provenance row on a materialized step (whose metadata only
 * carries the blueprint_id, not its title). Returns null if not found.
 */
export async function fetchInstitutionalBlueprintMeta(
  blueprintId: string,
): Promise<InstitutionalBlueprintMeta | null> {
  const { data: bp } = await supabase
    .from('blueprints')
    .select('id, title, org_id')
    .eq('id', blueprintId)
    .maybeSingle();
  if (!bp) return null;
  const b = bp as { id: string; title: string; org_id: string | null };
  let orgName: string | null = null;
  if (b.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', b.org_id)
      .maybeSingle();
    orgName = (org as { name: string | null } | null)?.name ?? null;
  }
  return { id: b.id, title: b.title, orgName };
}

function newSubStepId(index: number): string {
  return `ss_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Which templates a materialize call should pull into the timeline:
 * - 'all'  — every not-yet-adopted template (the legacy "whole plan" behavior).
 * - 'first' — only the lowest-sort_order template not yet adopted (gentle start
 *   and the per-step "pull the next one" action both use this).
 * - 'none' — materialize nothing (subscribe relationship only).
 * - { stepIds } — an explicit subset of template ids.
 */
export type MaterializeStepMode = 'all' | 'first' | 'none' | { stepIds: string[] };

export interface MaterializeOptions {
  stepMode?: MaterializeStepMode;
  /** Interest to file the steps under; overrides the blueprint's authored interest. */
  interestId?: string | null;
}

export interface MaterializeAssignedBlueprintResult {
  count: number;
  firstStepId: string | null;
  stepIds: string[];
  stepIdsByTemplateId: Record<string, string>;
}

/**
 * Copy the blueprint's authored templates into the student's timeline as real,
 * pending steps. The starting set is chosen by `stepMode` (default 'all').
 * Idempotent: templates already adopted (matched by source_type='marketplace_copy'
 * + source_id=template.id) are skipped, so re-running only fills in steps added
 * since — which is exactly how "add the next step" / "add remaining" work.
 * Returns the number created.
 */
export async function materializeAssignedBlueprint(
  userId: string,
  blueprintId: string,
  options?: MaterializeOptions,
): Promise<number> {
  const result = await materializeAssignedBlueprintDetailed(userId, blueprintId, options);
  return result.count;
}

/**
 * Same materialization path as materializeAssignedBlueprint, but returns the
 * created timeline step ids so caller surfaces can focus the exact new step.
 */
export async function materializeAssignedBlueprintDetailed(
  userId: string,
  blueprintId: string,
  options?: MaterializeOptions,
): Promise<MaterializeAssignedBlueprintResult> {
  const stepMode: MaterializeStepMode = options?.stepMode ?? 'all';
  const interestId = options?.interestId ?? null;
  if (stepMode === 'none') {
    return { count: 0, firstStepId: null, stepIds: [], stepIdsByTemplateId: {} };
  }
  // blueprint (for org + interest), gated to live so a student can't
  // materialize a draft pulled out from under them.
  const { data: bp, error: bpErr } = await supabase
    .from('blueprints')
    .select('id, org_id, interest_id, status, access_mode')
    .eq('id', blueprintId)
    .eq('status', 'live')
    .maybeSingle();
  if (bpErr) throw bpErr;
  if (!bp) throw new Error('Blueprint is not available.');
  const blueprint = bp as {
    org_id: string | null;
    interest_id: string | null;
    access_mode: string | null;
  };
  if (blueprint.access_mode === 'independent') {
    return materializeIndependentMarketplaceBlueprint(blueprintId, stepMode);
  }
  const resolvedInterestId = blueprint.interest_id ?? interestId ?? null;
  if (!resolvedInterestId) throw new Error('Blueprint has no interest to add into.');

  const templates = await fetchTemplatesForMaterialization(blueprintId);
  if (templates.length === 0) {
    return { count: 0, firstStepId: null, stepIds: [], stepIdsByTemplateId: {} };
  }

  // idempotency — skip templates already in the student's timeline
  const templateIds = templates.map((t) => t.id);
  const { data: existing, error: existErr } = await supabase
    .from('timeline_steps')
    .select('id, source_id')
    .eq('user_id', userId)
    .eq('source_type', 'marketplace_copy')
    .in('source_id', templateIds);
  if (existErr) throw existErr;
  const existingStepIdsByTemplateId = new Map(
    (existing ?? [])
      .map((r) => {
        const row = r as { id: string; source_id: string | null };
        return row.source_id ? [row.source_id, row.id] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );
  const existingTemplateIds = new Set(
    existingStepIdsByTemplateId.keys(),
  );

  // not-yet-adopted templates, lowest sort_order first (templates were already
  // ordered by sort_order in the query above).
  const unadopted = templates.filter((t) => !existingTemplateIds.has(t.id));

  let toCreate = unadopted;
  if (stepMode === 'first') {
    toCreate = unadopted.slice(0, 1);
  } else if (typeof stepMode === 'object' && Array.isArray(stepMode.stepIds)) {
    const wanted = new Set(stepMode.stepIds);
    toCreate = unadopted.filter((t) => wanted.has(t.id));
  }
  if (toCreate.length === 0) {
    const stepIdsByTemplateId: Record<string, string> = {};
    for (const template of templates) {
      const existingStepId = existingStepIdsByTemplateId.get(template.id);
      if (existingStepId) stepIdsByTemplateId[template.id] = existingStepId;
    }
    return {
      count: 0,
      firstStepId: null,
      stepIds: [],
      stepIdsByTemplateId,
    };
  }

  // place new steps after the student's current max for this interest
  const { data: maxRow } = await supabase
    .from('timeline_steps')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('interest_id', resolvedInterestId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const createTemplateIds: string[] = [];
  const rows = toCreate.map((t) => {
    createTemplateIds.push(t.id);
    const meta = t.plan_metadata ?? {};
    const subSteps = (t.sub_steps ?? [])
      .map((s, i) => ({
        id: newSubStepId(i),
        text: typeof s?.text === 'string' ? s.text : '',
        completed: false,
        sort_order: typeof s?.n === 'number' ? s.n - 1 : i,
      }))
      .filter((s) => s.text.trim().length > 0);

    return {
      user_id: userId,
      interest_id: resolvedInterestId,
      organization_id: blueprint.org_id,
      // Reuse the existing System-B materialization marker (source_id =
      // template id) so the Library "Plans" progress reader counts these.
      // source_blueprint_id/step_id are System-A FKs, so they stay null and
      // the provenance lives in metadata instead.
      source_type: 'marketplace_copy',
      source_id: t.id,
      title: t.title,
      description: t.description,
      category: 'general',
      status: 'pending',
      visibility: 'private',
      sort_order: nextSort++,
      metadata: {
        plan: {
          what_will_you_do: t.title,
          why_reasoning: textOrNull(meta.why),
          how_sub_steps: subSteps,
          capability_goals: t.capability_tags ?? [],
          competency_ids: t.capability_competency_ids ?? [],
          when_label: textOrNull(meta.when_label ?? (meta as { whenLabel?: unknown }).whenLabel),
          where_label: textOrNull(meta.where_label ?? (meta as { whereLabel?: unknown }).whereLabel),
          what_question: textOrNull(t.what_question),
        },
        source: 'institutional_blueprint',
        blueprint_id: blueprintId,
        blueprint_template_id: t.id,
        preceptor_role: textOrNull(t.preceptor_role),
      },
    };
  });

  const { data: createdRows, error: insertErr } = await supabase
    .from('timeline_steps')
    .insert(rows)
    .select('id');
  if (insertErr) throw insertErr;
  const stepIds = ((createdRows ?? []) as { id: string }[]).map((row) => row.id);
  const stepIdsByTemplateId: Record<string, string> = {};
  for (const [templateId, stepId] of existingStepIdsByTemplateId.entries()) {
    stepIdsByTemplateId[templateId] = stepId;
  }
  for (let i = 0; i < createTemplateIds.length; i++) {
    const stepId = stepIds[i];
    if (stepId) stepIdsByTemplateId[createTemplateIds[i]] = stepId;
  }
  return {
    count: stepIds.length,
    firstStepId: stepIds[0] ?? null,
    stepIds,
    stepIdsByTemplateId,
  };
}

async function materializeIndependentMarketplaceBlueprint(
  blueprintId: string,
  stepMode: MaterializeStepMode,
): Promise<MaterializeAssignedBlueprintResult> {
  const templateIds =
    typeof stepMode === 'object' && Array.isArray(stepMode.stepIds)
      ? stepMode.stepIds
      : null;
  const { data, error } = await supabase.rpc('materialize_marketplace_blueprint_steps', {
    p_blueprint_id: blueprintId,
    p_step_mode: stepMode === 'first' ? 'first' : 'all',
    p_template_ids: templateIds,
  });
  if (error) throw error;
  const result = (data ?? {}) as MarketplaceMaterializeRpcResult;
  return {
    count: Number(result.count ?? 0),
    firstStepId: result.first_step_id ?? null,
    stepIds: Array.isArray(result.step_ids) ? result.step_ids : [],
    stepIdsByTemplateId: result.step_ids_by_template_id ?? {},
  };
}
