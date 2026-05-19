export type StepPhaseTab = 'plan' | 'do' | 'reflect' | 'discuss';

export type SubStepKind = 'plain' | 'resource' | 'concept';

export interface SubStep {
  id: string;
  kind: SubStepKind;
  text: string;
  done: boolean;
  /** For resource-linked: title of resource + source label */
  resourceTitle?: string;
  resourceSource?: string;
  resourceFormat?: 'video' | 'article' | 'book' | 'pdf' | 'audio' | 'drill';
  /** For concept-linked: concept title + state */
  conceptTitle?: string;
  conceptSource?: string;
  conceptState?: 'forming' | 'testing' | 'settled';
}

export interface CapabilityChip {
  id: string;
  icon?: string;
  label: string;
}

export interface NetworkSuggestion {
  id: string;
  kind: 'followee' | 'mentor';
  fromInitials: string;
  fromTint?: string;
  fromName: string;
  fromContext: string;
  title: string;
  fromLine?: string;
}

export interface WithCollaborator {
  id: string;
  initials: string;
  tint?: string;
  name: string;
  role?: string;
}

export interface StepV2 {
  id: string;
  title: string;
  stepNumber: number;
  totalSteps: number;
  state: 'done' | 'current' | 'next';
  stateLabel: string;
  contextLine?: string;
  planChip?: { label: string; color: string; subtitle: string };
  what?: string;
  why?: string;
  subSteps: SubStep[];
  withCollaborators: WithCollaborator[];
  where?: string;
  capabilities: CapabilityChip[];
  suggestions: NetworkSuggestion[];
  discussCount?: number;
  hasSharedAccess?: boolean;
}
