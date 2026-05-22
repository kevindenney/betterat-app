/**
 * useStudioHomeData
 *
 * Data shape for Creator Studio · Home (Frame 4). Currently returns stub
 * empty arrays + zero counts — real queries land as the backing schema
 * settles. The component renders empty states gracefully so the surface
 * is testable before data arrives.
 *
 * Eventual queries (TODO):
 *   - blueprints: authored by user_id (via blueprint authorship table or
 *     blueprints.author_user_id)
 *   - threads: step_discussions where the user is a subscribed blueprint's
 *     mentor and the latest message is from a subscriber
 *   - kpis.activeSubscribers: distinct subscribers across authored blueprints
 *   - kpis.stepsReflected: 7d aggregate from step_reflections
 *   - kpis.needAttention: students with no step in last N days, or flagged
 *   - kpis.avgSession: average session duration across active subscribers
 */

import { useProfileMenuData } from '@/hooks/useProfileMenuData';

export type BlueprintStatus = 'live' | 'draft';

export interface StudioBlueprint {
  id: string;
  title: string;
  subtitle: string;
  status: BlueprintStatus;
  version: string | null;          // "v3.2" or null for drafts
  subscriberCount: number;
  stepCount: number;
  totalSteps: number | null;        // for drafts: "6 of 30"
  coAuthors: string[];              // ["Patel", "Choi"]
  coverGradient: [string, string];  // [from, to]
  orgShort: string | null;          // "JH" badge on cover
  lastEditLabel: string;            // "2h ago", "Tue", "Mon"
}

export interface StudioThread {
  id: string;
  fromInitials: string;
  fromName: string;
  blueprintLabel: string;           // "HF handoff" · "Telemetry" · "general"
  preview: string;
  ageLabel: string;                 // "14m ago", "Tue"
  awaiting: boolean;
  gradient: [string, string];
}

export interface StudioKpis {
  activeSubscribers: number;
  activeSubscribersDelta: number | null;   // +4 this week
  stepsReflectedPct: number | null;        // 87
  needAttention: number | null;
  avgSessionMinutes: number | null;
}

export interface StudioHomeData {
  loading: boolean;
  blueprints: StudioBlueprint[];
  threads: StudioThread[];
  kpis: StudioKpis;
  blueprintCount: number;
  draftCount: number;
  threadAwaitingCount: number;
}

export function useStudioHomeData(): StudioHomeData {
  // While stubbed we still pull the user's role so empty states can be
  // copy-tailored ("first blueprint" vs "your authored blueprints").
  const menu = useProfileMenuData();

  // TODO: replace stubs with real queries. Returning empty arrays today so the
  // home renders cleanly until the backing schema is decided.
  const blueprints: StudioBlueprint[] = [];
  const threads: StudioThread[] = [];

  const kpis: StudioKpis = {
    activeSubscribers: 0,
    activeSubscribersDelta: null,
    stepsReflectedPct: null,
    needAttention: null,
    avgSessionMinutes: null,
  };

  return {
    loading: menu.loading,
    blueprints,
    threads,
    kpis,
    blueprintCount: blueprints.length,
    draftCount: blueprints.filter((b) => b.status === 'draft').length,
    threadAwaitingCount: threads.filter((t) => t.awaiting).length,
  };
}
