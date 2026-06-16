/**
 * Profile descriptors — interest-aware "who this person is in their craft".
 *
 * The public face's hero subtitle ("Dragon Helm · Hong Kong") and the
 * "Where X practises" section are built from a small set of craft-specific
 * facts. Those facts differ per interest — a sailor has a Class and a Club,
 * a drawer has a Medium and a Studio — so the *field config* is interest-aware
 * here, mirroring the slug-keyed registries in `lib/vocabulary.ts`.
 *
 * Storage is a single flat `profiles.descriptors` jsonb bag keyed by field
 * `key`. Keys are kept distinct across crafts so a multi-craft person's values
 * coexist without collision; `location` is intentionally shared (a person's
 * city is the same fact whichever craft they're describing). The public face
 * only ever renders the fields the *active interest's* config asks for, so a
 * value left over from another craft is simply never surfaced.
 */

export type DescriptorValues = Record<string, string>;

export type DescriptorFieldType = 'text' | 'number';

export interface DescriptorField {
  /** jsonb key in profiles.descriptors. Distinct per craft except `location`. */
  key: string;
  /** Label in the Edit Profile form. */
  label: string;
  placeholder: string;
  type?: DescriptorFieldType;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Row label in the public "Where X practises" section. */
  whereLabel: string;
  /** Singular unit noun for numeric fields: 'season' → "3 seasons". */
  unit?: string;
}

const SAILING_FIELDS: DescriptorField[] = [
  { key: 'class', label: 'Class', placeholder: 'e.g. Dragon, Etchells, ILCA 7', autoCapitalize: 'words', whereLabel: 'Class' },
  { key: 'position', label: 'Position', placeholder: 'e.g. Helm, Trimmer, Bow', autoCapitalize: 'words', whereLabel: 'Position' },
  { key: 'location', label: 'Home waters', placeholder: 'e.g. Hong Kong', autoCapitalize: 'words', whereLabel: 'Home waters' },
  { key: 'club', label: 'Club', placeholder: 'e.g. RHKYC', autoCapitalize: 'characters', whereLabel: 'Club' },
  { key: 'seasons', label: 'Seasons active', placeholder: 'e.g. 3', type: 'number', unit: 'season', whereLabel: 'Seasons active' },
];

const DRAWING_FIELDS: DescriptorField[] = [
  { key: 'focus', label: 'Focus', placeholder: 'e.g. Figure drawing, urban sketching', autoCapitalize: 'sentences', whereLabel: 'Focus' },
  { key: 'medium', label: 'Medium', placeholder: 'e.g. Charcoal, ink, watercolour', autoCapitalize: 'sentences', whereLabel: 'Medium' },
  { key: 'location', label: 'Based in', placeholder: 'e.g. Brooklyn, NY', autoCapitalize: 'words', whereLabel: 'Based in' },
  { key: 'studio', label: 'Studio / space', placeholder: 'e.g. home studio, Atelier X', autoCapitalize: 'sentences', whereLabel: 'Studio' },
];

const NURSING_FIELDS: DescriptorField[] = [
  { key: 'unit', label: 'Unit / specialty', placeholder: 'e.g. ICU, Med-Surg, ED', autoCapitalize: 'words', whereLabel: 'Unit' },
  { key: 'site', label: 'Hospital / site', placeholder: 'e.g. Johns Hopkins', autoCapitalize: 'words', whereLabel: 'Site' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Baltimore', autoCapitalize: 'words', whereLabel: 'Based in' },
  { key: 'shift', label: 'Usual shift', placeholder: 'e.g. Nights, rotating', autoCapitalize: 'sentences', whereLabel: 'Shift' },
];

const GENERIC_FIELDS: DescriptorField[] = [
  { key: 'focus', label: 'Focus', placeholder: "What you're working on", autoCapitalize: 'sentences', whereLabel: 'Focus' },
  { key: 'location', label: 'Based in', placeholder: 'e.g. your city', autoCapitalize: 'words', whereLabel: 'Based in' },
];

const FIELDS_BY_SLUG: Record<string, DescriptorField[]> = {
  'sail-racing': SAILING_FIELDS,
  sailing: SAILING_FIELDS,
  drawing: DRAWING_FIELDS,
  'painting-printing': DRAWING_FIELDS,
  nursing: NURSING_FIELDS,
  'global-health': NURSING_FIELDS,
};

const SECTION_TITLE_BY_SLUG: Record<string, string> = {
  'sail-racing': 'Sailing Profile',
  sailing: 'Sailing Profile',
  drawing: 'Studio Profile',
  'painting-printing': 'Studio Profile',
  nursing: 'Clinical Profile',
  'global-health': 'Clinical Profile',
};

/** The descriptor fields to capture/render for an interest. */
export function getDescriptorFields(interestSlug?: string | null): DescriptorField[] {
  if (!interestSlug) return GENERIC_FIELDS;
  return FIELDS_BY_SLUG[interestSlug] ?? GENERIC_FIELDS;
}

/** Section title for the Edit Profile descriptor block. */
export function getDescriptorSectionTitle(interestSlug?: string | null): string {
  if (!interestSlug) return 'Practice Profile';
  return SECTION_TITLE_BY_SLUG[interestSlug] ?? 'Practice Profile';
}

function val(values: DescriptorValues, key: string): string | undefined {
  const v = values[key]?.trim();
  return v ? v : undefined;
}

/** Craft-specific identity portion (no location), e.g. "Dragon Helm". */
function getCraftIdentity(
  interestSlug: string | null | undefined,
  values: DescriptorValues,
): string | undefined {
  switch (interestSlug) {
    case 'sail-racing':
    case 'sailing':
      return [val(values, 'class'), val(values, 'position')].filter(Boolean).join(' ') || undefined;
    case 'nursing':
    case 'global-health':
      return val(values, 'unit');
    default:
      return val(values, 'focus') ?? val(values, 'medium');
  }
}

/**
 * Hero subtitle, e.g. "Dragon Helm · Hong Kong". Identity facts join with a
 * space; location is appended after a middot. Returns undefined when there's
 * nothing to show so the caller can fall back to interest + location.
 */
export function getDescriptorIdentity(
  interestSlug: string | null | undefined,
  values: DescriptorValues,
): string | undefined {
  return [getCraftIdentity(interestSlug, values), val(values, 'location')]
    .filter(Boolean)
    .join(' · ') || undefined;
}

/**
 * Hero subtitle for a multi-craft person. Takes the person's interest slugs in
 * priority order (primary first) and uses the first craft that has a filled
 * identity, so a drawer-who-also-sails still gets "Figure drawing" even if
 * sailing is alphabetically primary but unfilled. Location (shared across
 * crafts) is appended once.
 */
export function getDescriptorIdentityForInterests(
  interestSlugs: (string | null | undefined)[],
  values: DescriptorValues,
): string | undefined {
  const slugs = interestSlugs.length ? interestSlugs : [null];
  let craft: string | undefined;
  for (const slug of slugs) {
    craft = getCraftIdentity(slug, values);
    if (craft) break;
  }
  return [craft, val(values, 'location')].filter(Boolean).join(' · ') || undefined;
}

export interface DescriptorWhereRow {
  k: string;
  v: string;
}

/**
 * Rows for the public "Where X practises" section, built from the union of
 * every interest the person has, in priority order (primary first). A
 * multi-craft person surfaces each craft's filled facts; keys are deduped
 * (shared `location` appears once, labelled by the first craft that claims it).
 * Numeric fields render with their unit ("3 seasons"). Empty values are
 * dropped, so a sparse profile yields fewer rows (and the caller hides the
 * section entirely when none remain).
 */
export function getDescriptorWhereRowsForInterests(
  interestSlugs: (string | null | undefined)[],
  values: DescriptorValues,
): DescriptorWhereRow[] {
  const rows: DescriptorWhereRow[] = [];
  const seen = new Set<string>();
  const slugs = interestSlugs.length ? interestSlugs : [null];
  for (const slug of slugs) {
    for (const field of getDescriptorFields(slug)) {
      if (seen.has(field.key)) continue;
      const v = val(values, field.key);
      if (!v) continue;
      seen.add(field.key);
      if (field.type === 'number' && field.unit) {
        const n = parseInt(v, 10);
        const display = Number.isFinite(n) ? `${n} ${field.unit}${n === 1 ? '' : 's'}` : v;
        rows.push({ k: field.whereLabel, v: display });
      } else {
        rows.push({ k: field.whereLabel, v });
      }
    }
  }
  return rows;
}
