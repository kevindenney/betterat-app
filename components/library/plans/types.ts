export interface PlanSummary {
  id: string;
  title: string;
  authorName: string;
  authorInitials: string;
  authorRole?: string;
  stepCount: number;
  subscriberCount: number;
  resourceCount: number;
  meta?: string;
}

export interface SubscriberRow {
  id: string;
  name: string;
  initials: string;
  avatarTint?: string;
  where?: string;
  boat?: string;
  currentStepLabel: string;
  currentStepNumber: number;
  totalSteps: number;
  progressPct: number;
}

export interface PlanResourceRow {
  id: string;
  kind: 'video' | 'article' | 'drill' | 'book' | 'audio' | 'link' | 'pdf';
  title: string;
  durationMin?: number;
  pageCount?: number;
  linkedStepNumber?: number;
}
