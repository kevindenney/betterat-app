import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isUuid } from '@/utils/uuid';

const logger = createLogger('moduleArtifactService');

export type ModuleArtifactEventType = 'regatta' | 'race_event' | 'timeline_step';

export interface ModuleArtifactContent {
  toolValues: Record<string,string>;
  notes: string;
  attachments: {id: string; type: string; label: string; uri?: string}[];
  mappedCompetencyIds?: string[];
}

export interface ModuleArtifactRow {
  artifact_id: string;
  event_type: ModuleArtifactEventType;
  event_id: string;
  user_id: string;
  module_id: string;
  artifact_version: number;
  content: ModuleArtifactContent;
  created_at: string;
  updated_at: string;
}

export interface ModuleArtifactScope {
  eventType: ModuleArtifactEventType;
  eventId: string;
  userId: string;
  moduleId: string;
  artifactVersion?: number;
}

const DEFAULT_ARTIFACT_VERSION = 1;

export async function getModuleArtifact(scope: ModuleArtifactScope): Promise<ModuleArtifactRow | null> {
  if (!isUuid(scope.eventId) || !isUuid(scope.userId)) {
    return null;
  }

  const artifactVersion = scope.artifactVersion ?? DEFAULT_ARTIFACT_VERSION;
  const { data, error } = await supabase
    .from('betterat_module_artifacts')
    .select('artifact_id,event_type,event_id,user_id,module_id,artifact_version,content,created_at,updated_at')
    .eq('event_type', scope.eventType)
    .eq('event_id', scope.eventId)
    .eq('user_id', scope.userId)
    .eq('module_id', scope.moduleId)
    .eq('artifact_version', artifactVersion)
    .maybeSingle();

  if (error) {
    logger.error('[getModuleArtifact] Failed to load artifact', {
      eventType: scope.eventType,
      eventId: scope.eventId,
      moduleId: scope.moduleId,
      error,
    });
    throw error;
  }

  return (data as ModuleArtifactRow | null) ?? null;
}

export async function upsertModuleArtifact(scope: ModuleArtifactScope, content: ModuleArtifactContent): Promise<ModuleArtifactRow> {
  const artifactVersion = scope.artifactVersion ?? DEFAULT_ARTIFACT_VERSION;
  const payload = {
    event_type: scope.eventType,
    event_id: scope.eventId,
    user_id: scope.userId,
    module_id: scope.moduleId,
    artifact_version: artifactVersion,
    content,
  };

  const { data, error } = await supabase
    .from('betterat_module_artifacts')
    .upsert(payload, { onConflict: 'event_type,event_id,user_id,module_id,artifact_version' })
    .select('artifact_id,event_type,event_id,user_id,module_id,artifact_version,content,created_at,updated_at')
    .single();

  if (error) {
    logger.error('[upsertModuleArtifact] Failed to save artifact', {
      eventType: scope.eventType,
      eventId: scope.eventId,
      moduleId: scope.moduleId,
      error,
    });
    throw error;
  }

  return data as ModuleArtifactRow;
}
