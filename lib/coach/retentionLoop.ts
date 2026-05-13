export type CoachReminderSeverity = 'normal' | 'warning';

export type CoachReminder = {
  id: string;
  label: string;
  href: string;
  severity: CoachReminderSeverity;
};

export type CoachWeeklyRecap = {
  completedActions: number;
  pendingActions: number;
  activeDays: number;
  trendDelta: number | null;
  signatureInsight: CoachSignatureInsight;
};

export type CoachSignatureInsight = {
  skill: string;
  evidence: string;
  principle: string;
  eventId?: string | null;
  outcome?: 'pending' | 'accepted' | 'edited' | 'dismissed' | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDayKey(value: Date): string {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function computeDailyStreak(
  activityTimestamps: (string | null | undefined)[],
  now: Date = new Date()
): number {
  const dayKeys = new Set<string>();
  for (const timestamp of activityTimestamps) {
    const parsed = parseTimestamp(timestamp);
    if (!parsed) continue;
    dayKeys.add(toUtcDayKey(parsed));
  }
  if (dayKeys.size === 0) return 0;

  let streak = 0;
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (dayKeys.has(toUtcDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function countActiveDaysWithin(
  activityTimestamps: (string | null | undefined)[],
  days: number,
  now: Date = new Date()
): number {
  const clampedDays = Math.max(1, Math.min(90, Math.floor(days)));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowStart = new Date(todayStart.getTime() - (clampedDays - 1) * DAY_MS);

  const dayKeys = new Set<string>();
  for (const timestamp of activityTimestamps) {
    const parsed = parseTimestamp(timestamp);
    if (!parsed) continue;
    if (parsed < windowStart || parsed > now) continue;
    dayKeys.add(toUtcDayKey(parsed));
  }
  return dayKeys.size;
}

export function buildCoachReminders(input: {
  overdueAssessments: number;
  dueTodayAssessments: number;
  unreadThreads: number;
}): CoachReminder[] {
  const reminders: CoachReminder[] = [];

  if (input.overdueAssessments > 0) {
    reminders.push({
      id: 'overdue-assessments',
      label: `${input.overdueAssessments} overdue assessment${input.overdueAssessments === 1 ? '' : 's'}`,
      href: '/assessments?status=all&focus=overdue',
      severity: 'warning',
    });
  }
  if (input.dueTodayAssessments > 0) {
    reminders.push({
      id: 'due-today-assessments',
      label: `${input.dueTodayAssessments} due today`,
      href: '/assessments?status=all&focus=due_today',
      severity: 'normal',
    });
  }
  if (input.unreadThreads > 0) {
    reminders.push({
      id: 'unread-threads',
      label: `${input.unreadThreads} unread thread${input.unreadThreads === 1 ? '' : 's'}`,
      href: '/communications?focus=unread',
      severity: 'normal',
    });
  }

  return reminders;
}

export function buildCoachWeeklyRecap(input: {
  completedActions: number;
  pendingActions: number;
  activeDays: number;
  trendDelta: number | null;
  signatureInsight?: CoachSignatureInsight;
}): CoachWeeklyRecap {
  const completedActions = Math.max(0, Math.floor(input.completedActions));
  const pendingActions = Math.max(0, Math.floor(input.pendingActions));
  const activeDays = Math.max(0, Math.floor(input.activeDays));
  const trendDelta = Number.isFinite(input.trendDelta as number) ? Number(input.trendDelta) : null;

  const signatureInsight =
    input.signatureInsight ||
    buildCoachSignatureInsight({
      completedActions,
      pendingActions,
      activeDays,
      trendDelta,
    });

  return {
    completedActions,
    pendingActions,
    activeDays,
    trendDelta,
    signatureInsight,
  };
}

export function buildCoachSignatureInsight(input: {
  completedActions: number;
  pendingActions: number;
  activeDays: number;
  trendDelta: number | null;
}): CoachSignatureInsight {
  if (input.completedActions >= 5 && input.activeDays >= 4) {
    return {
      skill: 'consistent execution under workload',
      evidence: `${input.completedActions} completed actions across ${input.activeDays} active days this week`,
      principle: 'Close one high-value assessment block early each day to keep momentum.',
    };
  }

  if (input.trendDelta !== null && input.trendDelta > 0) {
    return {
      skill: 'raising assessment quality',
      evidence: `weekly trend improved by +${input.trendDelta.toFixed(2)} versus prior period`,
      principle: 'Reuse what worked last week and apply it to the next participant review.',
    };
  }

  if (input.pendingActions > input.completedActions) {
    return {
      skill: 'recovery prioritization',
      evidence: `${input.pendingActions} pending actions versus ${input.completedActions} completed`,
      principle: 'Clear overdue items first, then batch due-today work in one focused window.',
    };
  }

  return {
    skill: 'steady coaching consistency',
    evidence: `${input.completedActions} completed actions with ${input.activeDays} active days this week`,
    principle: 'Keep a repeatable cadence: review, assess, and close the loop before context switching.',
  };
}
