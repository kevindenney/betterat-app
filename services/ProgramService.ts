import { supabase } from './supabase';

export type WorkspaceDomain = 'sailing' | 'nursing' | 'drawing' | 'fitness' | 'generic';
export type ProgramStatus = 'draft' | 'planned' | 'active' | 'completed' | 'cancelled' | 'archived';
export type ProgramSessionStatus = 'planned' | 'live' | 'completed' | 'cancelled';
export type ParticipantStatus = 'invited' | 'active' | 'completed' | 'withdrawn' | 'inactive';
export type AssessmentStatus = 'draft' | 'submitted' | 'reviewed' | 'finalized';
export type ThreadType = 'announcement' | 'discussion' | 'support' | 'coordination';
export type ThreadVisibility = 'org_members' | 'program_participants' | 'private_staff';
export type ProgramTemplateType = 'program' | 'session' | 'checklist' | 'assessment' | 'message';
export type DomainCatalogType = 'label' | 'role' | 'template' | 'metric' | 'action';

export type ProgramRecord = {
  id: string;
  organization_id: string;
  domain: WorkspaceDomain;
  title: string;
  description: string | null;
  type: string;
  status: ProgramStatus;
  start_at: string | null;
  end_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramSessionRecord = {
  id: string;
  program_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  session_type: string;
  status: ProgramSessionStatus;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateProgramSessionInput = Partial<
  Pick<ProgramSessionRecord, 'title' | 'description' | 'session_type' | 'status' | 'starts_at' | 'ends_at' | 'location' | 'metadata'>
>;

export type ProgramParticipantRecord = {
  id: string;
  organization_id: string;
  program_id: string;
  session_id: string | null;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  status: ParticipantStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateProgramParticipantInput = {
  organization_id: string;
  program_id: string;
  session_id?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  role?: string;
  status?: ParticipantStatus;
  metadata?: Record<string, unknown>;
};

export type AssessmentRecord = {
  id: string;
  organization_id: string;
  program_id: string | null;
  session_id: string | null;
  participant_id: string | null;
  competency_id: string | null;
  evaluator_id: string;
  score: number | null;
  rubric_level: string | null;
  notes: string | null;
  evidence: Record<string, unknown>;
  status: AssessmentStatus;
  assessed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAssessmentInput = {
  organization_id: string;
  evaluator_id: string;
  program_id?: string | null;
  session_id?: string | null;
  participant_id?: string | null;
  competency_id?: string | null;
  score?: number | null;
  rubric_level?: string | null;
  notes?: string | null;
  evidence?: Record<string, unknown>;
  status?: AssessmentStatus;
  assessed_at?: string | null;
};

export type AssessmentRecordFilters = {
  status?: AssessmentStatus | readonly AssessmentStatus[] | null;
  program_id?: string | null;
  competency_id?: string | null;
  assessed_from?: string | null;
  assessed_to?: string | null;
  evaluator_id?: string | null;
};

export type OrganizationAssessmentSummary = {
  total: number;
  draft: number;
  submitted: number;
  reviewed: number;
  finalized: number;
};

export type CoachAssessmentDueSummary = {
  totalDue: number;
  dueToday: number;
  overdue: number;
  rows: AssessmentRecord[];
};

export type CompetencyProgressPoint = {
  periodStart: string;
  averageScore: number;
  assessmentCount: number;
};

export type CompetencyProgressTrend = {
  competency_id: string;
  competency_title: string;
  latest_average_score: number;
  previous_average_score: number | null;
  delta_from_previous: number | null;
  latest_period_start: string;
  total_assessments: number;
  points: CompetencyProgressPoint[];
};

export type CommunicationThreadRecord = {
  id: string;
  organization_id: string;
  program_id: string | null;
  session_id: string | null;
  title: string;
  thread_type: ThreadType;
  visibility: ThreadVisibility;
  created_by: string;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CommunicationMessageRecord = {
  id: string;
  thread_id: string;
  organization_id: string;
  sender_id: string;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CommunicationThreadReadRecord = {
  id: string;
  organization_id: string;
  thread_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateCommunicationThreadInput = {
  organization_id: string;
  title: string;
  created_by: string;
  program_id?: string | null;
  session_id?: string | null;
  thread_type?: ThreadType;
  visibility?: ThreadVisibility;
  metadata?: Record<string, unknown>;
};

export type CreateCommunicationMessageInput = {
  thread_id: string;
  organization_id: string;
  sender_id: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type CommunicationThreadFilters = {
  program_id?: string | null;
};

export type ProgramTemplateRecord = {
  id: string;
  organization_id: string | null;
  domain: WorkspaceDomain;
  template_type: ProgramTemplateType;
  title: string;
  description: string | null;
  content: Record<string, unknown>;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DomainCatalogRecord = {
  id: string;
  domain: WorkspaceDomain;
  catalog_type: DomainCatalogType;
  key: string;
  value: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateProgramTemplateInput = {
  created_by: string;
  organization_id?: string | null;
  domain: WorkspaceDomain;
  template_type: ProgramTemplateType;
  title: string;
  description?: string | null;
  content?: Record<string, unknown>;
  is_shared?: boolean;
};

export type UpdateProgramTemplateInput = Partial<
  Pick<ProgramTemplateRecord, 'title' | 'description' | 'content' | 'is_shared' | 'template_type'>
>;

export type ProgramListFilters = {
  status?: ProgramStatus[];
  domain?: WorkspaceDomain;
  startsAfter?: string;
  startsBefore?: string;
  search?: string;
};

type AssessmentDueDateRecord = {
  evidence?: Record<string, unknown> | null;
  assessed_at?: string | null;
  created_at?: string | null;
};

const DEFAULT_STAFF_ROLES = [
  'owner',
  'admin',
  'manager',
  'coordinator',
  'coach',
  'faculty',
  'preceptor',
  'instructor',
] as const;

const ACTIVE_PARTICIPANT_STATUSES = ['active', 'invited'] as const;
const DEFAULT_DUE_ASSESSMENT_STATUSES = ['draft', 'submitted'] as const;

type AssessmentRecordFilterableQuery = {
  eq(column: string, value: unknown): AssessmentRecordFilterableQuery;
  in(column: string, values: readonly unknown[]): AssessmentRecordFilterableQuery;
  gte(column: string, value: string): AssessmentRecordFilterableQuery;
  lte(column: string, value: string): AssessmentRecordFilterableQuery;
};

function parseAssessmentDueAt(row: AssessmentDueDateRecord): Date | null {
  const evidence = row.evidence || {};
  const dueAtSource = evidence.due_at ?? evidence.dueAt ?? row.assessed_at ?? row.created_at ?? null;
  if (typeof dueAtSource !== 'string' || !dueAtSource.trim()) return null;
  const dueAt = new Date(dueAtSource);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

function getWeekStartIso(value: Date): string {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return date.toISOString();
}

class ProgramService {
  private applyAssessmentRecordFilters<TQuery extends AssessmentRecordFilterableQuery>(
    baseQuery: TQuery,
    filters?: AssessmentRecordFilters
  ): TQuery {
    let query = baseQuery;

    const statusFilter = filters?.status;
    const statuses = Array.isArray(statusFilter)
      ? statusFilter
      : statusFilter
        ? [statusFilter]
        : [];
    const normalizedStatuses = statuses
      .map((value) => String(value || '').trim())
      .filter((value): value is AssessmentStatus => (
        value === 'draft' || value === 'submitted' || value === 'reviewed' || value === 'finalized'
      ));
    if (normalizedStatuses.length > 0) {
      query = query.in('status', normalizedStatuses) as TQuery;
    }

    const competencyId = String(filters?.competency_id || '').trim();
    if (competencyId) {
      query = query.eq('competency_id', competencyId) as TQuery;
    }

    const programId = String(filters?.program_id || '').trim();
    if (programId) {
      query = query.eq('program_id', programId) as TQuery;
    }

    const assessedFrom = String(filters?.assessed_from || '').trim();
    if (assessedFrom) {
      query = query.gte('assessed_at', assessedFrom) as TQuery;
    }

    const assessedTo = String(filters?.assessed_to || '').trim();
    if (assessedTo) {
      query = query.lte('assessed_at', assessedTo) as TQuery;
    }

    const evaluatorId = String(filters?.evaluator_id || '').trim();
    if (evaluatorId) {
      query = query.eq('evaluator_id', evaluatorId) as TQuery;
    }

    return query;
  }

  async listPrograms(organizationId: string, filters: ProgramListFilters = {}): Promise<ProgramRecord[]> {
    let query = supabase
      .from('programs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('start_at', { ascending: true, nullsFirst: false });

    if (filters.status?.length) query = query.in('status', filters.status);
    if (filters.domain) query = query.eq('domain', filters.domain);
    if (filters.startsAfter) query = query.gte('start_at', filters.startsAfter);
    if (filters.startsBefore) query = query.lte('start_at', filters.startsBefore);
    if (filters.search?.trim()) query = query.ilike('title', `%${filters.search.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProgramRecord[];
  }

  async getProgram(programId: string): Promise<ProgramRecord | null> {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .single();
    if (error) throw error;
    return (data as ProgramRecord) || null;
  }

  async listProgramsByIds(
    organizationId: string,
    programIds: string[],
    limit: number = 25
  ): Promise<ProgramRecord[]> {
    const uniqueIds = Array.from(new Set(programIds.filter(Boolean)));
    if (!uniqueIds.length) return [];
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('organization_id', organizationId)
      .in('id', uniqueIds)
      .order('start_at', { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ProgramRecord[];
  }

  async createProgram(
    input: Pick<ProgramRecord, 'organization_id' | 'domain' | 'title' | 'type'> &
      Partial<Pick<ProgramRecord, 'description' | 'status' | 'start_at' | 'end_at' | 'metadata'>>
  ): Promise<ProgramRecord> {
    const { data, error } = await supabase
      .from('programs')
      .insert({
        organization_id: input.organization_id,
        domain: input.domain,
        title: input.title,
        type: input.type,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        start_at: input.start_at ?? null,
        end_at: input.end_at ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramRecord;
  }

  async listProgramSessions(programId: string): Promise<ProgramSessionRecord[]> {
    const { data, error } = await supabase
      .from('program_sessions')
      .select('*')
      .eq('program_id', programId)
      .order('starts_at', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data || []) as ProgramSessionRecord[];
  }

  async createProgramSession(
    input: Pick<ProgramSessionRecord, 'program_id' | 'organization_id' | 'title'> &
      Partial<
        Pick<
          ProgramSessionRecord,
          'description' | 'session_type' | 'status' | 'starts_at' | 'ends_at' | 'location' | 'metadata'
        >
      >
  ): Promise<ProgramSessionRecord> {
    const { data, error } = await supabase
      .from('program_sessions')
      .insert({
        program_id: input.program_id,
        organization_id: input.organization_id,
        title: input.title,
        description: input.description ?? null,
        session_type: input.session_type ?? 'session',
        status: input.status ?? 'planned',
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        location: input.location ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramSessionRecord;
  }

  async listOrganizationProgramSessions(
    organizationId: string,
    limit: number = 20
  ): Promise<ProgramSessionRecord[]> {
    const { data, error } = await supabase
      .from('program_sessions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ProgramSessionRecord[];
  }

  async updateProgramSession(
    sessionId: string,
    updates: UpdateProgramSessionInput
  ): Promise<ProgramSessionRecord> {
    const { data, error } = await supabase
      .from('program_sessions')
      .update({
        title: updates.title,
        description: updates.description,
        session_type: updates.session_type,
        status: updates.status,
        starts_at: updates.starts_at,
        ends_at: updates.ends_at,
        location: updates.location,
        metadata: updates.metadata,
      })
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramSessionRecord;
  }

  async listProgramParticipants(
    programId: string,
    options?: {
      sessionId?: string | null;
      limit?: number;
    }
  ): Promise<ProgramParticipantRecord[]> {
    const limit = Math.max(1, Math.min(5000, options?.limit ?? 1000));
    let query = supabase
      .from('program_participants')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: true })
      .limit(limit);

    const sessionId = String(options?.sessionId || '').trim();
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProgramParticipantRecord[];
  }

  async listAssignedProgramIdsForStaff(
    organizationId: string,
    userId: string,
    roles: readonly string[] = DEFAULT_STAFF_ROLES,
    statuses: readonly ParticipantStatus[] = ACTIVE_PARTICIPANT_STATUSES
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('program_participants')
      .select('program_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .in('role', [...roles])
      .in('status', [...statuses]);
    if (error) throw error;

    return Array.from(
      new Set(
        (data || [])
          .map((row) => (row as { program_id?: string | null }).program_id)
          .filter((id): id is string => Boolean(id))
      )
    );
  }

  async listOrganizationProgramParticipants(
    organizationId: string,
    limit: number = 200
  ): Promise<ProgramParticipantRecord[]> {
    const { data, error } = await supabase
      .from('program_participants')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ProgramParticipantRecord[];
  }

  async listOrganizationProgramParticipantsByIds(
    organizationId: string,
    participantIds: readonly string[],
    limit: number = 200
  ): Promise<ProgramParticipantRecord[]> {
    const ids = Array.from(new Set(participantIds.filter(Boolean)));
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('program_participants')
      .select('*')
      .eq('organization_id', organizationId)
      .in('id', ids)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ProgramParticipantRecord[];
  }

  async createProgramParticipant(
    input: CreateProgramParticipantInput
  ): Promise<ProgramParticipantRecord> {
    const { data, error } = await supabase
      .from('program_participants')
      .insert({
        organization_id: input.organization_id,
        program_id: input.program_id,
        session_id: input.session_id ?? null,
        user_id: input.user_id ?? null,
        display_name: input.display_name ?? null,
        email: input.email ?? null,
        role: input.role ?? 'learner',
        status: input.status ?? 'active',
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramParticipantRecord;
  }

  async updateProgramParticipant(
    participantId: string,
    updates: Partial<Pick<ProgramParticipantRecord, 'role' | 'status' | 'session_id' | 'display_name' | 'email' | 'metadata'>>
  ): Promise<ProgramParticipantRecord> {
    const { data, error } = await supabase
      .from('program_participants')
      .update({
        role: updates.role,
        status: updates.status,
        session_id: updates.session_id,
        display_name: updates.display_name,
        email: updates.email,
        metadata: updates.metadata,
      })
      .eq('id', participantId)
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramParticipantRecord;
  }

  async removeProgramParticipant(participantId: string): Promise<void> {
    const { error } = await supabase
      .from('program_participants')
      .delete()
      .eq('id', participantId);
    if (error) throw error;
  }

  async getProgramParticipantCounts(
    organizationId: string
  ): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('program_participants')
      .select('program_id,status')
      .eq('organization_id', organizationId);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      const programId = (row as { program_id: string | null }).program_id;
      const status = String((row as { status?: string }).status || '');
      if (!programId) continue;
      if (!['invited', 'active', 'completed'].includes(status)) continue;
      counts[programId] = (counts[programId] || 0) + 1;
    }
    return counts;
  }

  async listAssessmentRecords(
    programId: string,
    options?: {
      sessionId?: string | null;
      limit?: number;
    }
  ): Promise<AssessmentRecord[]> {
    const limit = Math.max(1, Math.min(5000, options?.limit ?? 1000));
    let query = supabase
      .from('assessment_records')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const sessionId = String(options?.sessionId || '').trim();
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AssessmentRecord[];
  }

  async listOrganizationAssessmentRecords(
    organizationId: string,
    limit: number = 200,
    filters?: AssessmentRecordFilters
  ): Promise<AssessmentRecord[]> {
    let query = supabase
      .from('assessment_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    query = this.applyAssessmentRecordFilters(query, filters);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AssessmentRecord[];
  }

  async listEvaluatorAssessmentRecords(
    organizationId: string,
    evaluatorId: string,
    limit: number = 500,
    filters?: AssessmentRecordFilters
  ): Promise<AssessmentRecord[]> {
    let query = supabase
      .from('assessment_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    query = this.applyAssessmentRecordFilters(query, {
      ...filters,
      evaluator_id: evaluatorId,
    });

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AssessmentRecord[];
  }

  async getEvaluatorDueAssessmentSummary(
    organizationId: string,
    evaluatorId: string,
    statuses: readonly AssessmentStatus[] = DEFAULT_DUE_ASSESSMENT_STATUSES,
    limit: number = 500
  ): Promise<CoachAssessmentDueSummary> {
    const rows = await this.listEvaluatorAssessmentRecords(organizationId, evaluatorId, limit, {
      status: statuses,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dueToday = 0;
    let overdue = 0;

    for (const row of rows) {
      const dueAt = parseAssessmentDueAt(row);
      if (!dueAt) continue;
      if (dueAt >= today && dueAt < tomorrow) {
        dueToday += 1;
      } else if (dueAt < today) {
        overdue += 1;
      }
    }

    return {
      totalDue: rows.length,
      dueToday,
      overdue,
      rows,
    };
  }

  async listCompetencyProgressTrendsForEvaluator(
    organizationId: string,
    evaluatorId: string,
    options?: {
      weeks?: number;
      limitCompetencies?: number;
      statuses?: readonly AssessmentStatus[];
    }
  ): Promise<CompetencyProgressTrend[]> {
    const weeks = Math.max(1, Math.min(24, options?.weeks ?? 8));
    const limitCompetencies = Math.max(1, Math.min(50, options?.limitCompetencies ?? 5));
    const statuses = options?.statuses;

    let query = supabase
      .from('assessment_records')
      .select('competency_id,score,assessed_at,created_at,status')
      .eq('organization_id', organizationId)
      .eq('evaluator_id', evaluatorId)
      .not('competency_id', 'is', null)
      .not('score', 'is', null)
      .order('assessed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(4000);

    if (statuses?.length) {
      query = query.in('status', [...statuses]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (weeks * 7));

    type AggregationRow = {
      sum: number;
      count: number;
    };

    const byCompetency = new Map<
      string,
      {
        buckets: Map<string, AggregationRow>;
        latestAt: number;
        totalAssessments: number;
      }
    >();

    for (const row of data || []) {
      const entry = row as {
        competency_id?: string | null;
        score?: number | string | null;
        assessed_at?: string | null;
        created_at?: string | null;
      };

      if (!entry.competency_id) continue;
      const rawScore = typeof entry.score === 'number' ? entry.score : Number(entry.score);
      if (!Number.isFinite(rawScore)) continue;

      const timestampSource = entry.assessed_at || entry.created_at;
      if (!timestampSource) continue;
      const scoredAt = new Date(timestampSource);
      if (Number.isNaN(scoredAt.getTime())) continue;
      if (scoredAt < cutoff) continue;

      const weekStartIso = getWeekStartIso(scoredAt);
      const existing = byCompetency.get(entry.competency_id) || {
        buckets: new Map<string, AggregationRow>(),
        latestAt: 0,
        totalAssessments: 0,
      };
      const bucket = existing.buckets.get(weekStartIso) || { sum: 0, count: 0 };
      bucket.sum += rawScore;
      bucket.count += 1;
      existing.buckets.set(weekStartIso, bucket);
      existing.latestAt = Math.max(existing.latestAt, scoredAt.getTime());
      existing.totalAssessments += 1;
      byCompetency.set(entry.competency_id, existing);
    }

    const competencyIds = Array.from(byCompetency.keys());
    if (!competencyIds.length) return [];

    const { data: competencyRows, error: competenciesError } = await supabase
      .from('betterat_competencies')
      .select('id,title')
      .in('id', competencyIds);
    if (competenciesError) throw competenciesError;

    const competencyTitleById = new Map<string, string>();
    for (const row of competencyRows || []) {
      const entry = row as { id?: string | null; title?: string | null };
      if (!entry.id) continue;
      competencyTitleById.set(entry.id, entry.title || 'Competency');
    }

    const trends: CompetencyProgressTrend[] = [];
    for (const competencyId of competencyIds) {
      const aggregate = byCompetency.get(competencyId);
      if (!aggregate) continue;

      const points = Array.from(aggregate.buckets.entries())
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([periodStart, value]) => ({
          periodStart,
          averageScore: value.count > 0 ? Number((value.sum / value.count).toFixed(2)) : 0,
          assessmentCount: value.count,
        }));

      if (!points.length) continue;

      const latestPoint = points[points.length - 1];
      const previousPoint = points.length > 1 ? points[points.length - 2] : null;
      const delta = previousPoint
        ? Number((latestPoint.averageScore - previousPoint.averageScore).toFixed(2))
        : null;

      trends.push({
        competency_id: competencyId,
        competency_title: competencyTitleById.get(competencyId) || 'Competency',
        latest_average_score: latestPoint.averageScore,
        previous_average_score: previousPoint?.averageScore ?? null,
        delta_from_previous: delta,
        latest_period_start: latestPoint.periodStart,
        total_assessments: aggregate.totalAssessments,
        points,
      });
    }

    return trends
      .sort((a, b) => {
        const latestA = byCompetency.get(a.competency_id)?.latestAt ?? 0;
        const latestB = byCompetency.get(b.competency_id)?.latestAt ?? 0;
        return latestB - latestA;
      })
      .slice(0, limitCompetencies);
  }

  async createAssessmentRecord(input: CreateAssessmentInput): Promise<AssessmentRecord> {
    const { data, error } = await supabase
      .from('assessment_records')
      .insert({
        organization_id: input.organization_id,
        evaluator_id: input.evaluator_id,
        program_id: input.program_id ?? null,
        session_id: input.session_id ?? null,
        participant_id: input.participant_id ?? null,
        competency_id: input.competency_id ?? null,
        score: input.score ?? null,
        rubric_level: input.rubric_level ?? null,
        notes: input.notes ?? null,
        evidence: input.evidence ?? {},
        status: input.status ?? 'draft',
        assessed_at: input.assessed_at ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as AssessmentRecord;
  }

  async getOrganizationAssessmentSummary(
    organizationId: string
  ): Promise<OrganizationAssessmentSummary> {
    const rows = await this.listOrganizationAssessmentRecords(organizationId, 1000);
    const summary: OrganizationAssessmentSummary = {
      total: rows.length,
      draft: 0,
      submitted: 0,
      reviewed: 0,
      finalized: 0,
    };
    for (const row of rows) {
      const status = String(row.status || '').toLowerCase();
      if (status === 'draft') summary.draft += 1;
      if (status === 'submitted') summary.submitted += 1;
      if (status === 'reviewed') summary.reviewed += 1;
      if (status === 'finalized') summary.finalized += 1;
    }
    return summary;
  }

  async listOrganizationCommunicationThreads(
    organizationId: string,
    limit: number = 50,
    filters?: CommunicationThreadFilters
  ): Promise<CommunicationThreadRecord[]> {
    let query = supabase
      .from('communication_threads')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    const programId = String(filters?.program_id || '').trim();
    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommunicationThreadRecord[];
  }

  async createCommunicationThread(
    input: CreateCommunicationThreadInput
  ): Promise<CommunicationThreadRecord> {
    const { data, error } = await supabase
      .from('communication_threads')
      .insert({
        organization_id: input.organization_id,
        program_id: input.program_id ?? null,
        session_id: input.session_id ?? null,
        title: input.title,
        thread_type: input.thread_type ?? 'announcement',
        visibility: input.visibility ?? 'org_members',
        created_by: input.created_by,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunicationThreadRecord;
  }

  async listThreadMessages(
    threadId: string,
    limit: number = 200
  ): Promise<CommunicationMessageRecord[]> {
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []) as CommunicationMessageRecord[];
  }

  async createCommunicationMessage(
    input: CreateCommunicationMessageInput
  ): Promise<CommunicationMessageRecord> {
    const { data, error } = await supabase
      .from('communication_messages')
      .insert({
        thread_id: input.thread_id,
        organization_id: input.organization_id,
        sender_id: input.sender_id,
        body: input.body,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunicationMessageRecord;
  }

  async upsertThreadReads(
    organizationId: string,
    userId: string,
    threadIds: string[],
    lastReadAt: string = new Date().toISOString()
  ): Promise<void> {
    const uniqueThreadIds = Array.from(new Set(threadIds.filter(Boolean)));
    if (uniqueThreadIds.length === 0) return;

    const readRows = uniqueThreadIds.map((threadId) => ({
      organization_id: organizationId,
      thread_id: threadId,
      user_id: userId,
      last_read_at: lastReadAt,
    }));

    const { error } = await supabase
      .from('communication_thread_reads')
      .upsert(readRows, { onConflict: 'thread_id,user_id' });
    if (error) throw error;
  }

  async markThreadRead(
    organizationId: string,
    userId: string,
    threadId: string,
    lastReadAt: string = new Date().toISOString()
  ): Promise<void> {
    await this.upsertThreadReads(organizationId, userId, [threadId], lastReadAt);
  }

  async markAllThreadsRead(
    organizationId: string,
    userId: string,
    programId?: string | null
  ): Promise<void> {
    let query = supabase
      .from('communication_threads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .limit(1000);

    const scopedProgramId = String(programId || '').trim();
    if (scopedProgramId) {
      query = query.eq('program_id', scopedProgramId);
    }

    const { data: threadRows, error: threadsError } = await query;
    if (threadsError) throw threadsError;

    const threadIds = (threadRows || [])
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => Boolean(id));

    await this.upsertThreadReads(organizationId, userId, threadIds);
  }

  async listUnreadThreadIds(
    organizationId: string,
    userId: string,
    messageLimit: number = 800,
    programId?: string | null
  ): Promise<string[]> {
    const scopedProgramId = String(programId || '').trim();
    const { data: messageRows, error: messageError } = await supabase
      .from('communication_messages')
      .select('thread_id,created_at')
      .eq('organization_id', organizationId)
      .neq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(messageLimit);
    if (messageError) throw messageError;

    const latestIncomingByThread = new Map<string, string>();
    for (const row of messageRows || []) {
      const entry = row as { thread_id?: string | null; created_at?: string | null };
      if (!entry.thread_id || !entry.created_at) continue;
      if (!latestIncomingByThread.has(entry.thread_id)) {
        latestIncomingByThread.set(entry.thread_id, entry.created_at);
      }
    }

    const threadIds = Array.from(latestIncomingByThread.keys());
    if (threadIds.length === 0) return [];

    let visibleThreadQuery = supabase
      .from('communication_threads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .in('id', threadIds);
    if (scopedProgramId) {
      visibleThreadQuery = visibleThreadQuery.eq('program_id', scopedProgramId);
    }

    const { data: visibleThreadRows, error: visibleThreadError } = await visibleThreadQuery;
    if (visibleThreadError) throw visibleThreadError;

    const visibleThreadIds = new Set(
      (visibleThreadRows || [])
        .map((row) => (row as { id?: string | null }).id)
        .filter((id): id is string => Boolean(id))
    );
    if (visibleThreadIds.size === 0) return [];

    const scopedThreadIds = threadIds.filter((threadId) => visibleThreadIds.has(threadId));

    const { data: readRows, error: readError } = await supabase
      .from('communication_thread_reads')
      .select('thread_id,last_read_at')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .in('thread_id', scopedThreadIds);
    if (readError) throw readError;

    const readMap = new Map<string, string>();
    for (const row of readRows || []) {
      const entry = row as { thread_id?: string | null; last_read_at?: string | null };
      if (!entry.thread_id || !entry.last_read_at) continue;
      readMap.set(entry.thread_id, entry.last_read_at);
    }

    return scopedThreadIds.filter((threadId) => {
      const lastIncomingAt = latestIncomingByThread.get(threadId);
      const lastReadAt = readMap.get(threadId);
      if (!lastIncomingAt) return false;
      if (!lastReadAt) return true;
      return new Date(lastIncomingAt).getTime() > new Date(lastReadAt).getTime();
    });
  }

  async getUnreadThreadCount(
    organizationId: string,
    userId: string,
    messageLimit: number = 800,
    programId?: string | null
  ): Promise<number> {
    const unreadThreadIds = await this.listUnreadThreadIds(organizationId, userId, messageLimit, programId);
    return unreadThreadIds.length;
  }

  async getUnreadThreadCountsByProgram(
    organizationId: string,
    userId: string,
    messageLimit: number = 800,
    programId?: string | null
  ): Promise<Record<string, number>> {
    const unreadThreadIds = await this.listUnreadThreadIds(organizationId, userId, messageLimit, programId);
    if (unreadThreadIds.length === 0) return {};

    let threadsQuery = supabase
      .from('communication_threads')
      .select('id,program_id')
      .eq('organization_id', organizationId)
      .in('id', unreadThreadIds);
    const scopedProgramId = String(programId || '').trim();
    if (scopedProgramId) {
      threadsQuery = threadsQuery.eq('program_id', scopedProgramId);
    }
    const { data, error } = await threadsQuery;
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      const programId = String((row as { program_id?: string | null }).program_id || '').trim();
      if (!programId) continue;
      counts[programId] = (counts[programId] || 0) + 1;
    }
    return counts;
  }

  async listProgramTemplates(
    organizationId: string | null,
    domain?: WorkspaceDomain,
    templateType?: ProgramTemplateType,
    limit: number = 100
  ): Promise<ProgramTemplateRecord[]> {
    let query = supabase
      .from('program_templates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},is_shared.eq.true`);
    } else {
      query = query.eq('is_shared', true);
    }

    if (domain) query = query.eq('domain', domain);
    if (templateType) query = query.eq('template_type', templateType);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProgramTemplateRecord[];
  }

  async createProgramTemplate(input: CreateProgramTemplateInput): Promise<ProgramTemplateRecord> {
    const { data, error } = await supabase
      .from('program_templates')
      .insert({
        created_by: input.created_by,
        organization_id: input.organization_id ?? null,
        domain: input.domain,
        template_type: input.template_type,
        title: input.title,
        description: input.description ?? null,
        content: input.content ?? {},
        is_shared: input.is_shared ?? false,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramTemplateRecord;
  }

  async deleteProgramTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('program_templates')
      .delete()
      .eq('id', templateId);
    if (error) throw error;
  }

  async updateProgramTemplate(
    templateId: string,
    updates: UpdateProgramTemplateInput
  ): Promise<ProgramTemplateRecord> {
    const { data, error } = await supabase
      .from('program_templates')
      .update({
        title: updates.title,
        description: updates.description,
        content: updates.content,
        is_shared: updates.is_shared,
        template_type: updates.template_type,
      })
      .eq('id', templateId)
      .select('*')
      .single();
    if (error) throw error;
    return data as ProgramTemplateRecord;
  }

  async listDomainCatalog(
    domain: WorkspaceDomain,
    catalogType: DomainCatalogType,
    includeGenericFallback: boolean = true
  ): Promise<DomainCatalogRecord[]> {
    const domains = includeGenericFallback && domain !== 'generic'
      ? [domain, 'generic']
      : [domain];

    const { data, error } = await supabase
      .from('domain_catalog')
      .select('*')
      .in('domain', domains)
      .eq('catalog_type', catalogType)
      .eq('is_active', true)
      .order('domain', { ascending: false })
      .order('key', { ascending: true });
    if (error) throw error;
    return (data || []) as DomainCatalogRecord[];
  }

  // ---------------------------------------------------------------------------
  // Follow / Unfollow a Program
  // ---------------------------------------------------------------------------

  /**
   * Follow a program: enroll as a learner and copy the program's timeline
   * step templates into the user's personal timeline.
   *
   * Returns the number of timeline steps created.
   */
  async subscribeToProgram(
    userId: string,
    programId: string,
    interestId: string,
  ): Promise<{ participantId: string; stepsCreated: number }> {
    // 1. Fetch the program to get org_id and metadata.program_path
    const { data: program, error: progErr } = await supabase
      .from('programs')
      .select('id, organization_id, title, metadata')
      .eq('id', programId)
      .single();
    if (progErr || !program) throw progErr ?? new Error('Program not found');

    const orgId = program.organization_id as string;
    const programPath = (program.metadata as Record<string, unknown>)?.program_path as string | undefined;

    // 2. Create program_participants record (idempotent via unique constraint)
    const { data: participant, error: partErr } = await supabase
      .from('program_participants')
      .upsert(
        {
          organization_id: orgId,
          program_id: programId,
          user_id: userId,
          role: 'learner',
          status: 'active',
          metadata: { followed_at: new Date().toISOString() },
        },
        { onConflict: 'program_id,user_id,role' }
      )
      .select('id')
      .single();
    if (partErr) throw partErr;

    // 3. Fetch timeline_step_templates for this program
    //    Templates are keyed by (organization_id, path_name) where path_name
    //    matches the program's metadata.program_path.
    // Helper: auto-subscribe to the program's blueprint if one exists.
    // subscriber_id must be the auth uid (userId), NOT the profile_id.
    const autoSubscribeBlueprint = async () => {
      const { data: blueprint } = await supabase
        .from('timeline_blueprints')
        .select('id')
        .eq('program_id', programId)
        .eq('is_published', true)
        .maybeSingle();
      if (!blueprint?.id) return;
      await supabase
        .from('blueprint_subscriptions')
        .upsert(
          { blueprint_id: blueprint.id, subscriber_id: userId, auto_adopt: true },
          { onConflict: 'blueprint_id,subscriber_id' }
        );
    };

    if (!programPath) {
      // No templates configured — enroll only, no steps
      await autoSubscribeBlueprint();
      return { participantId: participant!.id, stepsCreated: 0 };
    }

    const { data: templates, error: tplErr } = await supabase
      .from('timeline_step_templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('path_name', programPath)
      .order('sort_order', { ascending: true });
    if (tplErr) throw tplErr;

    if (!templates || templates.length === 0) {
      await autoSubscribeBlueprint();
      return { participantId: participant!.id, stepsCreated: 0 };
    }

    // 4. Check which templates the user already has (avoid duplicates)
    const { data: existingSteps } = await supabase
      .from('timeline_steps')
      .select('source_id')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .eq('source_type', 'template');

    const existingSourceIds = new Set(
      (existingSteps ?? []).map((s: { source_id: string | null }) => s.source_id)
    );

    // 5. Get max sort_order for this user + interest
    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

    // 6. Create timeline_steps from templates
    const stepsToInsert = templates
      .filter((t: { id: string }) => !existingSourceIds.has(t.id))
      .map((t: { id: string; title: string; description: string | null; category: string; sort_order: number; metadata: Record<string, unknown> }) => ({
        user_id: userId,
        interest_id: interestId,
        organization_id: orgId,
        source_type: 'template',
        source_id: t.id,
        title: t.title,
        description: t.description,
        category: t.category ?? 'general',
        status: 'pending',
        visibility: 'fleet',
        sort_order: nextSort++,
        metadata: {
          ...t.metadata,
          program_id: programId,
          program_title: program.title,
          template_sort_order: t.sort_order,
        },
      }));

    if (stepsToInsert.length === 0) {
      await autoSubscribeBlueprint();
      return { participantId: participant!.id, stepsCreated: 0 };
    }

    const { error: insertErr } = await supabase
      .from('timeline_steps')
      .insert(stepsToInsert);
    if (insertErr) throw insertErr;

    // 7. Auto-subscribe to the program's blueprint (if one exists)
    await autoSubscribeBlueprint();

    return { participantId: participant!.id, stepsCreated: stepsToInsert.length };
  }

  /**
   * Unsubscribe from a program: remove the participant record, remove the
   * matching blueprint_subscriptions row (so the program's published
   * blueprint stops syncing new steps), and optionally remove any
   * template-sourced timeline steps the user has already received.
   */
  async unsubscribeFromProgram(
    userId: string,
    programId: string,
    removeSteps: boolean = false,
  ): Promise<void> {
    // Remove participant record
    const { error: delErr } = await supabase
      .from('program_participants')
      .delete()
      .eq('program_id', programId)
      .eq('user_id', userId)
      .eq('role', 'learner');
    if (delErr) throw delErr;

    // Remove the auto-subscribed blueprint subscription for this program
    // so the Clinical/timeline tab stops showing it. subscribeToProgram
    // writes this row via autoSubscribeBlueprint() with subscriber_id = auth uid.
    const { data: blueprint } = await supabase
      .from('timeline_blueprints')
      .select('id')
      .eq('program_id', programId)
      .eq('is_published', true)
      .maybeSingle();
    if (blueprint?.id) {
      const { error: subDelErr } = await supabase
        .from('blueprint_subscriptions')
        .delete()
        .eq('blueprint_id', blueprint.id)
        .eq('subscriber_id', userId);
      if (subDelErr) throw subDelErr;
    }

    // Optionally remove the template-sourced steps
    if (removeSteps) {
      const { data: program } = await supabase
        .from('programs')
        .select('metadata')
        .eq('id', programId)
        .single();
      const programPath = (program?.metadata as Record<string, unknown>)?.program_path as string | undefined;
      if (!programPath) return;

      // Get template IDs for this program
      const { data: templates } = await supabase
        .from('timeline_step_templates')
        .select('id')
        .eq('organization_id', (program as { organization_id?: string })?.organization_id ?? '')
        .eq('path_name', programPath);

      if (templates && templates.length > 0) {
        const templateIds = templates.map((t: { id: string }) => t.id);
        await supabase
          .from('timeline_steps')
          .delete()
          .eq('user_id', userId)
          .eq('source_type', 'template')
          .in('source_id', templateIds);
      }
    }
  }

  /**
   * Check if a user is subscribed to (enrolled in) a specific program.
   */
  async isSubscribedToProgram(
    userId: string,
    programId: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('program_participants')
      .select('id')
      .eq('program_id', programId)
      .eq('user_id', userId)
      .eq('role', 'learner')
      .maybeSingle();
    if (error) return false;
    return !!data;
  }
}

export const programService = new ProgramService();
