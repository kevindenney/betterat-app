/**
 * Thin wrapper around the audit_log_event RPC.
 *
 * Best-effort: fires forget — errors are logged but never thrown back to
 * the caller. Audit is observational, never on the critical path of the
 * mutation that triggered it.
 */

import { supabase } from '@/services/supabase';

export type AuditVerb =
  | 'role_changed'
  | 'published'
  | 'invited'
  | 'edited'
  | 'claimed'
  | 'removed'
  | 'sso_config'
  | 'cohort_edit'
  | 'blueprint_publish'
  | 'site_claim'
  | 'membership_added'
  | 'membership_removed'
  | 'login'
  | 'config_change';

export interface AuditEventInput {
  orgId: string;
  verb: AuditVerb;
  verbLabel: string;
  description: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  payload?: Record<string, unknown>;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const { error } = await supabase.rpc('audit_log_event', {
      p_org_id: input.orgId,
      p_verb: input.verb,
      p_verb_label: input.verbLabel,
      p_description: input.description,
      p_target_type: input.targetType ?? null,
      p_target_id: input.targetId ?? null,
      p_target_label: input.targetLabel ?? null,
      p_payload: input.payload ?? {},
    });
    if (error) console.warn('[auditLog] rpc failed', error);
  } catch (err) {
    console.warn('[auditLog] threw', err);
  }
}
