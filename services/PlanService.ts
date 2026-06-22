/**
 * PlanService — first-class "journey" CRUD.
 *
 * A Plan is the user's tailored copy of work, optionally derived from
 * a Blueprint (template). One user can have multiple plans per
 * interest (e.g. "Winter Dragon" + "Fitness for sailing", both under
 * sail-racing).
 *
 * Vision + competency anchors live on the plan — they describe what
 * THIS journey is building toward.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PlanService');

export type PlanStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface Plan {
  id: string;
  user_id: string;
  interest_id: string;
  source_blueprint_id: string | null;
  title: string | null;
  vision_statement: string | null;
  vision_competency_ids: string[];
  started_at: string;
  ended_at: string | null;
  status: PlanStatus;
  /** ISO currency code for this plan's money (entrepreneur vocab). Defaults USD. */
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  interest_id: string;
  source_blueprint_id?: string | null;
  title?: string | null;
  vision_statement?: string | null;
  vision_competency_ids?: string[];
  started_at?: string;
  status?: PlanStatus;
  currency?: string;
}

export interface UpdatePlanInput {
  title?: string | null;
  vision_statement?: string | null;
  vision_competency_ids?: string[];
  status?: PlanStatus;
  ended_at?: string | null;
  currency?: string;
}

function mapPlanRow(row: any): Plan {
  return {
    id: row.id,
    user_id: row.user_id,
    interest_id: row.interest_id,
    source_blueprint_id: row.source_blueprint_id ?? null,
    title: row.title ?? null,
    vision_statement: row.vision_statement ?? null,
    vision_competency_ids: Array.isArray(row.vision_competency_ids)
      ? (row.vision_competency_ids as string[])
      : [],
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    status: (row.status as PlanStatus) ?? 'active',
    currency: row.currency ?? 'USD',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class PlanServiceClass {
  /**
   * List the viewer's plans for an interest, newest active first.
   */
  async listByInterest(userId: string, interestId: string): Promise<Plan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('status', { ascending: true }) // active before paused/completed
      .order('started_at', { ascending: false });
    if (error) {
      logger.error('listByInterest failed', { interestId, error });
      throw error;
    }
    return (data ?? []).map(mapPlanRow);
  }

  /**
   * The viewer's most recently started active plan for an interest.
   * Returns null when no active plan exists.
   */
  async getActiveForInterest(userId: string, interestId: string): Promise<Plan | null> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.error('getActiveForInterest failed', { interestId, error });
      throw error;
    }
    return data ? mapPlanRow(data) : null;
  }

  async create(userId: string, input: CreatePlanInput): Promise<Plan> {
    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        interest_id: input.interest_id,
        source_blueprint_id: input.source_blueprint_id ?? null,
        title: input.title ?? null,
        vision_statement: input.vision_statement ?? null,
        vision_competency_ids: input.vision_competency_ids ?? [],
        started_at: input.started_at ?? new Date().toISOString(),
        status: input.status ?? 'active',
        ...(input.currency ? { currency: input.currency } : {}),
      })
      .select('*')
      .single();
    if (error) {
      logger.error('create failed', { input, error });
      throw error;
    }
    return mapPlanRow(data);
  }

  /**
   * Resolve the interest's active plan, creating one only when none
   * exists. The lookup happens server-side immediately before the
   * insert, so a stale/loading client cache can't spawn a duplicate
   * plan — the vision-edit save used to create a fresh plan whenever
   * its captured activePlanId was momentarily null, orphaning the real
   * seeded plan behind a pile of titleless copies.
   */
  async getOrCreateActiveForInterest(
    userId: string,
    interestId: string,
    createInput: Omit<CreatePlanInput, 'interest_id'> = {},
  ): Promise<Plan> {
    const existing = await this.getActiveForInterest(userId, interestId);
    if (existing) return existing;
    return this.create(userId, { interest_id: interestId, ...createInput });
  }

  async update(planId: string, input: UpdatePlanInput): Promise<Plan> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.vision_statement !== undefined)
      updateData.vision_statement = input.vision_statement;
    if (input.vision_competency_ids !== undefined)
      updateData.vision_competency_ids = input.vision_competency_ids;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.ended_at !== undefined) updateData.ended_at = input.ended_at;
    if (input.currency !== undefined) updateData.currency = input.currency;

    const { data, error } = await supabase
      .from('plans')
      .update(updateData)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) {
      logger.error('update failed', { planId, error });
      throw error;
    }

    // Keep the plan's money denomination and its weekly rollups in lockstep.
    // The EARNINGS readout prefers plans.currency over business_outcomes.currency,
    // so leaving the rows on the old code would silently relabel the same figures
    // in two currencies. We relabel, NOT FX-convert: the recorded amounts are the
    // founder's real turnover and stay put; only the denomination changes.
    if (input.currency !== undefined) {
      const { error: outcomeError } = await supabase
        .from('business_outcomes')
        .update({ currency: input.currency })
        .eq('plan_id', planId);
      if (outcomeError) {
        logger.error('currency sync to business_outcomes failed', { planId, outcomeError });
        throw outcomeError;
      }
    }

    return mapPlanRow(data);
  }

  async delete(planId: string): Promise<void> {
    const { data, error } = await supabase
      .from('plans')
      .delete()
      .eq('id', planId)
      .select('id')
      .maybeSingle();
    if (error) {
      logger.error('delete failed', { planId, error });
      throw error;
    }
    if (!data) {
      throw new Error('Plan not found.');
    }
  }
}

export const PlanService = new PlanServiceClass();
