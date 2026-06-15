import { supabase } from '@/services/supabase';

export type GearStatus = 'active' | 'loaned' | 'retired' | 'backup';

export interface GearItem {
  id: string;
  user_id: string;
  interest_id: string;
  kind: string;
  name: string;
  spec: Record<string, unknown>;
  parent_id: string | null;
  is_primary: boolean;
  status: GearStatus;
  photo_url: string | null;
  acquired_on: string | null;
  retired_on: string | null;
  notes: string | null;
  legacy_source_table: string | null;
  legacy_source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepGearRow {
  id: string;
  step_id: string;
  gear_item_id: string;
  role: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  gear_item?: GearItem | null;
}

export interface GearKindOption {
  value: string;
  label: string;
}

export interface GearSpecField {
  key: string;
  label: string;
  placeholder: string;
}

export interface GearLabels {
  railLabel: string;
  itemNoun: string;
  addLabel: string;
  pickerTitle: string;
  pickerSubtitle: string;
  primaryKind: string;
  stepRole: string;
  emptyLabel: string;
  kindOptions: GearKindOption[];
  specFields: GearSpecField[];
}

export function gearErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const maybe = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [maybe.message, maybe.details, maybe.hint]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
    if (parts.length > 0) return parts.join('\n');
    if (typeof maybe.code === 'string' && maybe.code.trim()) {
      return `Database error ${maybe.code}`;
    }
  }
  return 'Something went wrong. Please try again.';
}

function throwIfSupabaseError(error: unknown): void {
  if (!error) return;
  throw new Error(gearErrorMessage(error));
}

function slugIncludes(slug: string | null | undefined, fragment: string): boolean {
  return String(slug ?? '').toLowerCase().includes(fragment);
}

export function getGearLabels(slug: string | null | undefined): GearLabels {
  const normalized = String(slug ?? '').toLowerCase();
  if (normalized === 'sail-racing' || slugIncludes(normalized, 'sail')) {
    return {
      railLabel: 'Boats & Gear',
      itemNoun: 'boat',
      addLabel: 'Add boat',
      pickerTitle: 'Which boat?',
      pickerSubtitle: 'Saved to this step for results and evidence.',
      primaryKind: 'boat',
      stepRole: 'vessel',
      emptyLabel: 'No boats yet',
      kindOptions: [
        { value: 'boat', label: 'Boat' },
        { value: 'sail', label: 'Sail' },
        { value: 'rig', label: 'Rig' },
        { value: 'gear', label: 'Other' },
      ],
      specFields: [
        { key: 'class_name', label: 'Class', placeholder: 'J/70' },
        { key: 'sail_number', label: 'Sail number', placeholder: 'HKG 1417' },
      ],
    };
  }
  if (normalized === 'golf' || slugIncludes(normalized, 'golf')) {
    return {
      railLabel: 'Your Bag',
      itemNoun: 'club',
      addLabel: 'Add club',
      pickerTitle: 'Which club?',
      pickerSubtitle: 'Saved to this practice step.',
      primaryKind: 'club',
      stepRole: 'club',
      emptyLabel: 'No clubs yet',
      kindOptions: [
        { value: 'set', label: 'Set / bag' },
        { value: 'club', label: 'Club' },
        { value: 'ball', label: 'Ball' },
        { value: 'gear', label: 'Other' },
      ],
      specFields: [
        { key: 'model', label: 'Model', placeholder: 'Stealth 2 Driver' },
        { key: 'subcategory', label: 'Type', placeholder: 'Driver · 10.5° · stiff' },
      ],
    };
  }
  if (normalized === 'nursing' || slugIncludes(normalized, 'clinical')) {
    return {
      railLabel: 'Your Kit',
      itemNoun: 'item',
      addLabel: 'Add item',
      pickerTitle: 'Kit check',
      pickerSubtitle: 'Saved as a checklist for this shift.',
      primaryKind: 'kit',
      stepRole: 'kit',
      emptyLabel: 'No kit items yet',
      kindOptions: [
        { value: 'kit', label: 'Kit item' },
        { value: 'instrument', label: 'Instrument' },
        { value: 'reference', label: 'Reference' },
        { value: 'gear', label: 'Other' },
      ],
      specFields: [
        { key: 'model', label: 'Model / edition', placeholder: 'Littmann CORE' },
      ],
    };
  }
  if (
    normalized === 'fitness' ||
    normalized === 'health-and-fitness' ||
    slugIncludes(normalized, 'fitness')
  ) {
    return {
      railLabel: 'Gear',
      itemNoun: 'gear',
      addLabel: 'Add gear',
      pickerTitle: 'Which gear?',
      pickerSubtitle: 'Saved to this step.',
      primaryKind: 'gear',
      stepRole: 'gear',
      emptyLabel: 'No gear yet',
      kindOptions: [
        { value: 'equipment', label: 'Equipment' },
        { value: 'wearable', label: 'Wearable' },
        { value: 'apparel', label: 'Apparel' },
        { value: 'gear', label: 'Other' },
      ],
      specFields: [
        { key: 'model', label: 'Model', placeholder: 'Garmin Forerunner' },
        { key: 'manufacturer', label: 'Brand', placeholder: '' },
      ],
    };
  }
  if (
    slugIncludes(normalized, 'draw') ||
    slugIncludes(normalized, 'sketch') ||
    slugIncludes(normalized, 'paint') ||
    slugIncludes(normalized, 'illustrat')
  ) {
    return {
      railLabel: 'Tools & Materials',
      itemNoun: 'item',
      addLabel: 'Add item',
      pickerTitle: 'Which item?',
      pickerSubtitle: 'Saved to this step.',
      primaryKind: 'tool',
      stepRole: 'tool',
      emptyLabel: 'No tools yet',
      kindOptions: [
        { value: 'tool', label: 'Tool' },
        { value: 'material', label: 'Material' },
        { value: 'device', label: 'Device' },
        { value: 'gear', label: 'Other' },
      ],
      specFields: [
        { key: 'model', label: 'Model', placeholder: 'iPad Pro · Procreate' },
        { key: 'manufacturer', label: 'Maker', placeholder: '' },
      ],
    };
  }
  return {
    railLabel: 'Equipment',
    itemNoun: 'equipment',
    addLabel: 'Add equipment',
    pickerTitle: 'Which equipment?',
    pickerSubtitle: 'Saved to this step.',
    primaryKind: 'equipment',
    stepRole: 'gear',
    emptyLabel: 'No equipment yet',
    kindOptions: [
      { value: 'equipment', label: 'Equipment' },
      { value: 'tool', label: 'Tool' },
      { value: 'machine', label: 'Machine' },
      { value: 'vehicle', label: 'Vehicle' },
    ],
    specFields: [
      { key: 'model', label: 'Model', placeholder: 'Usha Janome' },
      { key: 'manufacturer', label: 'Maker', placeholder: '' },
    ],
  };
}

// Interests whose practice has no physical equipment to track. The Equipment
// panel is hidden for these so academic/reflective interests don't show an
// empty "Equipment" rail.
const GEARLESS_INTEREST_SLUGS = new Set([
  'self-mastery',
  'lifelong-learning',
  'college-career-planning',
]);

export function hasGearConcept(slug: string | null | undefined): boolean {
  return !GEARLESS_INTEREST_SLUGS.has(String(slug ?? '').toLowerCase());
}

function sortGearItems(a: GearItem, b: GearItem): number {
  if (a.status === 'retired' && b.status !== 'retired') return 1;
  if (a.status !== 'retired' && b.status === 'retired') return -1;
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export async function listGearItems(userId: string, interestId: string): Promise<GearItem[]> {
  const { data, error } = await supabase
    .from('gear_items')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as GearItem[]).sort(sortGearItems);
}

export async function createGearItem(input: {
  userId: string;
  interestId: string;
  kind: string;
  name: string;
  parentId?: string | null;
  isPrimary?: boolean;
  status?: GearStatus;
  spec?: Record<string, unknown>;
  notes?: string | null;
}): Promise<GearItem> {
  const { data, error } = await supabase.rpc('create_gear_item', {
    p_user_id: input.userId,
    p_interest_id: input.interestId,
    p_kind: input.kind,
    p_name: input.name,
    p_parent_id: input.parentId ?? null,
    p_is_primary: Boolean(input.isPrimary),
    p_status: input.status ?? 'active',
    p_spec: input.spec ?? {},
    p_notes: input.notes ?? null,
  });

  throwIfSupabaseError(error);
  return data as GearItem;
}

export async function updateGearItem(
  id: string,
  patch: Partial<Pick<GearItem, 'name' | 'kind' | 'parent_id' | 'is_primary' | 'status' | 'spec' | 'notes'>>,
): Promise<GearItem> {
  const { data, error } = await supabase
    .from('gear_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  throwIfSupabaseError(error);
  return data as GearItem;
}

export async function setPrimaryGearItem(item: GearItem): Promise<GearItem> {
  const { error } = await supabase
    .from('gear_items')
    .update({ is_primary: false })
    .eq('user_id', item.user_id)
    .eq('interest_id', item.interest_id)
    .eq('kind', item.kind);
  throwIfSupabaseError(error);
  return updateGearItem(item.id, { is_primary: true, status: item.status === 'retired' ? 'active' : item.status });
}

export async function deleteGearItem(id: string): Promise<void> {
  const { error } = await supabase.from('gear_items').delete().eq('id', id);
  if (error) throw error;
}

export async function listStepGear(stepId: string): Promise<StepGearRow[]> {
  const { data, error } = await supabase
    .from('step_gear')
    .select('*, gear_item:gear_items(*)')
    .eq('step_id', stepId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as StepGearRow[];
}

export async function setStepGearSelection(input: {
  stepId: string;
  role: string;
  gearItemId: string | null;
}): Promise<void> {
  const { error: deleteError } = await supabase
    .from('step_gear')
    .delete()
    .eq('step_id', input.stepId)
    .eq('role', input.role);
  if (deleteError) throw deleteError;

  if (!input.gearItemId) return;

  const { error: insertError } = await supabase
    .from('step_gear')
    .insert({
      step_id: input.stepId,
      gear_item_id: input.gearItemId,
      role: input.role,
    });
  if (insertError) throw insertError;
}

export async function addStepGearItem(input: {
  stepId: string;
  role: string;
  gearItemId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('step_gear')
    .upsert(
      {
        step_id: input.stepId,
        gear_item_id: input.gearItemId,
        role: input.role,
      },
      { onConflict: 'step_id,gear_item_id,role' },
    );
  if (error) throw error;
}

export async function removeStepGearItem(input: {
  stepId: string;
  role: string;
  gearItemId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('step_gear')
    .delete()
    .eq('step_id', input.stepId)
    .eq('role', input.role)
    .eq('gear_item_id', input.gearItemId);
  if (error) throw error;
}
