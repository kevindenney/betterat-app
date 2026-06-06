import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import type {
  CapabilityEvidenceRow,
  EvidenceStrength,
} from '@/components/step/reflect-tab/CapabilitiesPracticed';

interface SuggestCapabilityTagsInput {
  /** interests.id — used to constrain suggestions to that interest's competency catalog. */
  interestId?: string | null;
  captures: string[];
  reflection: string;
  /** Capability names already on the row list — never re-suggested. */
  existingNames: string[];
  capturesCount: number;
}

interface CatalogRow {
  id: string;
  title: string | null;
}

const STRENGTHS: EvidenceStrength[] = ['worth-noting', 'material', 'strong'];

/**
 * Reads a step's captures + reflection text and asks the model which competencies the
 * learner demonstrably practiced. When the interest has a competency catalog
 * (`betterat_competencies`), suggestions are constrained to it; otherwise the model
 * proposes short free-form capability names. Returns unconfirmed rows; interactive
 * callers can ask the learner to confirm, while completion can auto-confirm the
 * model-sourced rows before writing evidence. Returns [] on any failure.
 */
export async function suggestCapabilityTags(
  input: SuggestCapabilityTagsInput,
): Promise<CapabilityEvidenceRow[]> {
  const captures = input.captures.map((c) => c.trim()).filter(Boolean);
  const reflection = input.reflection.trim();
  if (captures.length === 0 && !reflection) return [];

  const catalog = await fetchCatalog(input.interestId);
  const hasCatalog = catalog.length > 0;

  const system = hasCatalog
    ? 'You map a learner’s session notes to competencies they demonstrably practiced. ' +
      'Choose only competencies from the provided catalog that have clear textual evidence in the notes. ' +
      'Never invent competencies outside the catalog. Be conservative — omit weak or speculative matches. ' +
      'Respond with ONLY a JSON array, no prose.'
    : 'You identify capabilities a learner demonstrably practiced from their session notes. ' +
      'Be conservative — only include capabilities with clear textual evidence. ' +
      'Respond with ONLY a JSON array, no prose.';

  const catalogBlock = hasCatalog
    ? `Competency catalog (choose only from these):\n${catalog
        .map((c) => `- [${c.id}] ${c.title}`)
        .join('\n')}\n\n`
    : '';

  const notesBlock =
    `Session captures:\n${captures.map((c) => `- ${c}`).join('\n') || '- (none)'}\n\n` +
    (reflection ? `Reflection:\n${reflection}\n\n` : '');

  const existingBlock = input.existingNames.length
    ? `Already tagged (do not repeat): ${input.existingNames.join(', ')}\n\n`
    : '';

  const shape = hasCatalog
    ? '[{"competency_id":"<id from catalog>","strength":"worth-noting|material|strong"}]'
    : '[{"capability_name":"<short skill name>","strength":"worth-noting|material|strong"}]';

  const prompt =
    `${catalogBlock}${notesBlock}${existingBlock}` +
    `Return up to 4 capabilities the learner clearly practiced, as JSON: ${shape}. ` +
    `If nothing is clearly evidenced, return [].`;

  let text = '';
  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system, prompt, max_tokens: 512 },
    });
    if (error) throw error;
    text = typeof data?.text === 'string' ? data.text : '';
  } catch (err) {
    logger.warn('Capability tagger unavailable', err);
    return [];
  }

  const parsed = parseJsonArray(text);
  if (!parsed) return [];

  const titleById = new Map(
    catalog.map((c) => [c.id, (c.title ?? '').trim()] as const),
  );
  const taken = new Set(input.existingNames.map(normalize));
  const rows: CapabilityEvidenceRow[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const strength = normalizeStrength((item as Record<string, unknown>).strength);
    let id: string;
    let name: string;

    if (hasCatalog) {
      const cid = String((item as Record<string, unknown>).competency_id ?? '').trim();
      const title = titleById.get(cid);
      if (!cid || !title) continue; // not in catalog → drop hallucination
      id = cid;
      name = title;
    } else {
      name = String((item as Record<string, unknown>).capability_name ?? '').trim();
      if (!name) continue;
      id = `ai-${normalize(name)}`;
    }

    const key = normalize(name);
    if (taken.has(key)) continue;
    taken.add(key);

    rows.push({
      capabilityId: id,
      capabilityName: name,
      confirmed: false,
      strength,
      pipLevel: strength === 'strong' ? 5 : strength === 'material' ? 3 : 2,
      evidenceCount: input.capturesCount,
      source: 'ai',
    });
    if (rows.length >= 4) break;
  }

  return rows;
}

async function fetchCatalog(interestId?: string | null): Promise<CatalogRow[]> {
  if (!interestId) return [];
  const { data, error } = await supabase
    .from('betterat_competencies')
    .select('id, title')
    .eq('interest_id', interestId)
    .order('sort_order', { ascending: true });
  if (error) {
    logger.warn('Capability catalog fetch failed', error);
    return [];
  }
  return ((data ?? []) as CatalogRow[]).filter((c) => (c.title ?? '').trim());
}

function parseJsonArray(text: string): unknown[] | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function normalizeStrength(value: unknown): EvidenceStrength {
  const s = String(value ?? '').toLowerCase().replace(/\s+/g, '-');
  return STRENGTHS.includes(s as EvidenceStrength) ? (s as EvidenceStrength) : 'worth-noting';
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
