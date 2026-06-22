import { supabase } from '@/services/supabase';
import type { DescriptorValues } from '@/lib/profile-descriptors';

export interface PublicFaceProfileSettings {
  fullName: string;
  bio: string;
  avatarUrl: string | null;
  descriptors: DescriptorValues;
}

export interface PublicFaceInterestSettings {
  membershipId: string;
  interestId: string;
  name: string;
  slug: string | null;
  accentColor: string | null;
  isActive: boolean;
  isPrimary: boolean;
  sortOrder: number;
  stepCount: number;
}

export interface PublicFaceSettings {
  profile: PublicFaceProfileSettings;
  interests: PublicFaceInterestSettings[];
}

function normalizeProfile(data: any): PublicFaceProfileSettings {
  return {
    fullName: String(data?.full_name ?? ''),
    bio: String(data?.bio ?? ''),
    avatarUrl: data?.avatar_url ?? null,
    descriptors:
      data?.descriptors && typeof data.descriptors === 'object'
        ? { ...(data.descriptors as DescriptorValues) }
        : {},
  };
}

export async function getPublicFaceSettings(userId: string): Promise<PublicFaceSettings> {
  const [profileRes, interestsRes, stepsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, bio, avatar_url, descriptors')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_interests')
      .select(
        'interest_id, is_active, is_primary, sort_order, interests!inner(id, name, slug, accent_color)',
      )
      .eq('user_id', userId),
    supabase.from('timeline_steps').select('interest_id').eq('user_id', userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (interestsRes.error) throw interestsRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const stepCounts = new Map<string, number>();
  for (const row of stepsRes.data ?? []) {
    const interestId = (row as any).interest_id;
    if (!interestId) continue;
    stepCounts.set(interestId, (stepCounts.get(interestId) ?? 0) + 1);
  }

  const interests = ((interestsRes.data ?? []) as any[])
    .map((row): PublicFaceInterestSettings | null => {
      const interest = Array.isArray(row.interests) ? row.interests[0] : row.interests;
      if (!interest) return null;
      return {
        membershipId: row.interest_id,
        interestId: row.interest_id,
        name: interest.name,
        slug: interest.slug ?? null,
        accentColor: interest.accent_color ?? null,
        isActive: row.is_active ?? true,
        isPrimary: row.is_primary ?? false,
        sortOrder: row.sort_order ?? 0,
        stepCount: stepCounts.get(row.interest_id) ?? 0,
      };
    })
    .filter((row): row is PublicFaceInterestSettings => Boolean(row))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  if (!interests.some((interest) => interest.isActive && interest.isPrimary)) {
    const fallbackLead = interests.find((interest) => interest.isActive);
    if (fallbackLead) fallbackLead.isPrimary = true;
  }

  return {
    profile: normalizeProfile(profileRes.data),
    interests,
  };
}

export async function updatePublicFaceDescriptors(
  userId: string,
  email: string,
  descriptors: DescriptorValues,
): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      descriptors,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function setPublicFaceInterestActive(
  userId: string,
  membershipId: string,
  active: boolean,
): Promise<void> {
  const { data: current, error: currentError } = await supabase
    .from('user_interests')
    .select('interest_id, is_primary')
    .eq('user_id', userId)
    .eq('interest_id', membershipId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Interest not found.');

  const updatePayload: Record<string, unknown> = { is_active: active };
  if (!active && current?.is_primary) updatePayload.is_primary = false;

  const { data: updated, error } = await supabase
    .from('user_interests')
    .update(updatePayload)
    .eq('user_id', userId)
    .eq('interest_id', membershipId)
    .select('interest_id')
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error('Interest not found.');

  if (!active && current?.is_primary) {
    await ensureOneActivePrimary(userId);
  }
}

export async function setPublicFacePrimaryInterest(
  userId: string,
  membershipId: string,
): Promise<void> {
  const { data: target, error: targetError } = await supabase
    .from('user_interests')
    .select('interest_id')
    .eq('user_id', userId)
    .eq('interest_id', membershipId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error('Interest not found.');

  const { error: clearError } = await supabase
    .from('user_interests')
    .update({ is_primary: false })
    .eq('user_id', userId)
    .neq('interest_id', membershipId);
  if (clearError) throw clearError;

  const { data: updated, error: setError } = await supabase
    .from('user_interests')
    .update({ is_primary: true, is_active: true })
    .eq('user_id', userId)
    .eq('interest_id', membershipId)
    .select('interest_id')
    .maybeSingle();
  if (setError) throw setError;
  if (!updated) throw new Error('Interest not found.');
}

export async function movePublicFaceInterest(
  userId: string,
  membershipId: string,
  direction: -1 | 1,
): Promise<void> {
  const settings = await getPublicFaceSettings(userId);
  const ordered = [...settings.interests].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((interest) => interest.membershipId === membershipId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

  const [moved] = ordered.splice(index, 1);
  ordered.splice(nextIndex, 0, moved);

  await Promise.all(
    ordered.map((interest, sortOrder) =>
      supabase
        .from('user_interests')
        .update({ sort_order: sortOrder })
        .eq('user_id', userId)
        .eq('interest_id', interest.membershipId)
        .select('interest_id')
        .maybeSingle(),
    ),
  ).then((results) => {
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const missing = results.find((result) => !result.data);
    if (missing) throw new Error('Interest not found.');
  });
}

async function ensureOneActivePrimary(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_interests')
    .select('interest_id, is_active, is_primary, sort_order')
    .eq('user_id', userId);
  if (error) throw error;

  const rows = ((data ?? []) as any[]).filter((row) => row.is_active ?? true);
  if (rows.length === 0 || rows.some((row) => row.is_primary)) return;

  rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const { data: updated, error: setError } = await supabase
    .from('user_interests')
    .update({ is_primary: true })
    .eq('user_id', userId)
    .eq('interest_id', rows[0].interest_id)
    .select('interest_id')
    .maybeSingle();
  if (setError) throw setError;
  if (!updated) throw new Error('Interest not found.');
}
