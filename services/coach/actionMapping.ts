/**
 * Maps tool results to channel-agnostic CoachAction[] rows.
 *
 * Mirrors the logic in lib/telegram/tools.ts:getToolResponseKeyboard but emits
 * CoachAction shapes instead of Telegram InlineKeyboardButton. The Telegram
 * adapter (services/coach/telegramAdapter.ts) re-encodes these into Telegram
 * callback_data strings; the in-app composer renders them as native buttons.
 *
 * Behaviour parity with the original keyboard helper:
 *   - null  → no opinion; keep prior buttons
 *   - []    → explicitly clear prior buttons (e.g. after successful attach)
 *   - non-empty rows → replace prior buttons
 */

import type { CoachActionRow } from './types';

const MAX_BUTTONS = 5;

function truncate(label: string, maxLen: number): string {
  return label.length > maxLen ? `${label.slice(0, maxLen - 3)}...` : label;
}

interface StepLite {
  id: string;
  title: string;
  status: string;
}

function actionableSteps(steps: StepLite[]): StepLite[] {
  return steps.filter(s => s.status === 'pending' || s.status === 'in_progress').slice(0, MAX_BUTTONS);
}

function buildStepRows(steps: StepLite[]): CoachActionRow[] {
  return actionableSteps(steps).map<CoachActionRow>(step => {
    const label = truncate(step.title, 25);
    if (step.status === 'pending') {
      return [{ kind: 'status', target: 'in_progress', stepId: step.id, label: `▶️ Start: ${label}` }];
    }
    return [{ kind: 'status', target: 'completed', stepId: step.id, label: `✅ Done: ${label}` }];
  });
}

function buildPhotoAttachRows(steps: StepLite[]): CoachActionRow[] {
  return actionableSteps(steps).map<CoachActionRow>(step => {
    const label = truncate(step.title, 22);
    return [{ kind: 'attach', stepId: step.id, label: `📎 Attach to: ${label}` }];
  });
}

function buildCreatedStepRows(stepId: string): CoachActionRow[] {
  return [
    [{ kind: 'status', target: 'in_progress', stepId, label: '▶️ Start now' }],
    [{ kind: 'view_step', stepId, label: '📋 View Step' }],
  ];
}

function buildSubStepRows(
  stepId: string,
  subSteps: { id: string; text: string; completed: boolean }[],
): CoachActionRow[] {
  return subSteps
    .filter(ss => !ss.completed)
    .slice(0, MAX_BUTTONS)
    .map<CoachActionRow>(ss => {
      const label = truncate(ss.text, 22);
      return [{ kind: 'substep_done', stepId, subStepId: ss.id, label: `☑️ Done: ${label}` }];
    });
}

/**
 * Inspect a tool result and return CoachActionRow[].
 *  - Returns `null` to keep prior buttons.
 *  - Returns `[]` to explicitly clear prior buttons.
 */
export function getToolResponseActions(
  toolName: string,
  resultJson: string,
  hasPendingPhoto = false,
): CoachActionRow[] | null {
  let result: any;
  try {
    result = JSON.parse(resultJson);
  } catch {
    return null;
  }
  if (!result || result.error) return null;

  switch (toolName) {
    case 'get_student_timeline':
    case 'get_today_plan': {
      const steps = result.steps as StepLite[] | undefined;
      if (!steps?.length) return null;
      const rows = hasPendingPhoto ? buildPhotoAttachRows(steps) : buildStepRows(steps);
      return rows.length > 0 ? rows : null;
    }

    case 'get_inbox_status': {
      const totalPending = (result.total_pending as number) ?? 0;
      if (totalPending === 0) return null;
      const byPlaybook =
        (result.by_playbook as { playbook_id: string; name: string; pending_count: number }[]) ?? [];
      return byPlaybook.slice(0, 3).map<CoachActionRow>(p => [
        { kind: 'process_inbox', playbookId: p.playbook_id, label: `⚙️ Process ${p.name} (${p.pending_count})` },
      ]);
    }

    case 'save_url_to_playbook': {
      if (!result.saved) return null;
      const playbookId = result.playbook_id as string | undefined;
      if (!playbookId) return null;
      return [[{ kind: 'process_inbox', playbookId, label: '⚙️ Process inbox now' }]];
    }

    case 'create_step': {
      const stepId = result.step?.id as string | undefined;
      if (!stepId) return null;
      return buildCreatedStepRows(stepId);
    }

    case 'get_step_detail': {
      const subSteps = result.sub_steps as { id: string; text: string; completed: boolean }[] | undefined;
      if (!subSteps?.length) return null;
      const stepId = result.id as string | undefined;
      if (!stepId) return null;
      const rows = buildSubStepRows(stepId, subSteps);
      return rows.length > 0 ? rows : null;
    }

    case 'update_step': {
      const stepId = result.step?.id as string | undefined;
      if (!stepId) return null;
      return [[{ kind: 'view_step', stepId, label: '📋 View Step' }]];
    }

    case 'attach_step_evidence': {
      // Photo attached — clear any prior "Attach to:" buttons.
      if (result.attached) return [];
      return null;
    }

    case 'log_observation':
    case 'log_debrief':
    case 'save_competency_assessment': {
      const stepId = result.step_id as string | undefined;
      if (stepId) return [[{ kind: 'view_step', stepId, label: '📋 View Step' }]];
      return [];
    }

    case 'bulk_toggle_sub_steps':
      // Debrief in progress — clear timeline buttons.
      return [];

    default:
      return null;
  }
}
