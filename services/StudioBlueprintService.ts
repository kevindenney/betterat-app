import { supabase } from '@/services/supabase';

export interface StudioBlueprintSummary {
  id: string;
  title: string;
}

export async function getStudioBlueprintById(
  blueprintId: string,
): Promise<StudioBlueprintSummary | null> {
  const { data, error } = await supabase
    .from('blueprints')
    .select('id, title')
    .eq('id', blueprintId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    return {
      id: data.id,
      title: data.title?.trim() || 'Untitled blueprint',
    };
  }

  // Temporary compatibility for groups already attached to a pre-Studio
  // timeline_blueprints row. New attach choices come from public.blueprints.
  const { data: legacyData, error: legacyError } = await supabase
    .from('timeline_blueprints')
    .select('id, title')
    .eq('id', blueprintId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  return legacyData ? {
    id: legacyData.id,
    title: legacyData.title?.trim() || 'Untitled blueprint',
  } : null;
}

export async function getAuthoredStudioBlueprints(
  userId: string,
): Promise<StudioBlueprintSummary[]> {
  const { data, error } = await supabase
    .from('blueprints')
    .select('id, title, last_edited_at, created_at')
    .eq('author_user_id', userId)
    .order('last_edited_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = ((data ?? []) as { id: string; title: string | null; last_edited_at: string | null; created_at: string | null }[])
    .map((row) => ({
      id: row.id,
      title: row.title?.trim() || 'Untitled blueprint',
      sortAt: row.last_edited_at ?? row.created_at ?? '',
    }));

  const seen = new Set<string>();
  return rows
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .map((row) => ({ id: row.id, title: row.title }));
}
