/**
 * rigTune — static, per-class rig-tuning baselines keyed by wind band.
 *
 * Race strategy already reads the live/forecast wind for a race; this turns
 * that wind speed into a class-specific starting point for the rig (shroud
 * tension, mast rake/butt, and the one trim move that matters most in that
 * band). It is deliberately a lookup table, not a model: tuning guides are
 * published per class by sailmakers, and the right move at 6 kn in a Dragon
 * has nothing to do with 6 kn in a J/70.
 *
 * These are conservative *starting points* meant to orient a sailor, not
 * replace their sailmaker's guide — every entry surfaces with that caveat.
 * Classes without a table return null and the UI shows nothing.
 */

export interface RigTuneSetting {
  label: string;
  value: string;
}

export interface RigTuneBand {
  /** Short band name shown as the pill, e.g. "Light". */
  label: string;
  /** Human range for display, e.g. "0–8 kn". */
  windRange: string;
  /** Inclusive upper bound (knots) used to match a measured wind speed. */
  maxKnots: number;
  settings: RigTuneSetting[];
  /** The single highest-leverage trim move for this band. */
  note: string;
}

export interface RigTuneGuide {
  /** Canonical class name as stored in boat_classes.name. */
  boatClass: string;
  /** Attribution / scope caveat shown under the card. */
  source: string;
  bands: RigTuneBand[];
}

/**
 * Class name → guide. Keys are matched case-insensitively against the
 * sailor's primary class. Bands MUST be ordered ascending by maxKnots.
 */
const GUIDES: RigTuneGuide[] = [
  {
    boatClass: 'Dragon',
    source: 'Class baseline — confirm against your sailmaker’s Dragon guide.',
    bands: [
      {
        label: 'Light',
        windRange: '0–8 kn',
        maxKnots: 8,
        settings: [
          { label: 'Cap shrouds', value: 'Soft · ~24 (Loos PT-2)' },
          { label: 'Lowers', value: 'Just snug — let the rig breathe' },
          { label: 'Mast rake', value: 'Forward — max headstay length' },
        ],
        note: 'Power up: deep main, twist eased, crew to leeward to heel and load the foils.',
      },
      {
        label: 'Medium',
        windRange: '8–14 kn',
        maxKnots: 14,
        settings: [
          { label: 'Cap shrouds', value: 'Base · ~30 (Loos PT-2)' },
          { label: 'Lowers', value: 'Set to hold ~20 mm pre-bend' },
          { label: 'Mast rake', value: 'Base — full-hike groove' },
        ],
        note: 'Sail to the base numbers; trim mainsheet hard, traveller near centreline.',
      },
      {
        label: 'Heavy',
        windRange: '14+ kn',
        maxKnots: 99,
        settings: [
          { label: 'Cap shrouds', value: 'On hard · ~36 (Loos PT-2)' },
          { label: 'Lowers', value: 'Eased to free the lower mast' },
          { label: 'Mast rake', value: 'Aft — shorten headstay to depower' },
        ],
        note: 'Depower: backstay on, flatten the main, drop the traveller to hold the boat flat.',
      },
    ],
  },
  {
    boatClass: 'J/70',
    source: 'Class baseline — confirm against your sailmaker’s J/70 guide.',
    bands: [
      {
        label: 'Light',
        windRange: '0–7 kn',
        maxKnots: 7,
        settings: [
          { label: 'Uppers', value: 'Soft · base −2 turns' },
          { label: 'Lowers', value: 'Snug — keep some mast bend out' },
          { label: 'Forestay', value: 'Long — bow up, headstay sag for power' },
        ],
        note: 'Power up: ease backstay, sail flat, weight forward and inboard to reduce wetted area.',
      },
      {
        label: 'Medium',
        windRange: '8–15 kn',
        maxKnots: 15,
        settings: [
          { label: 'Uppers', value: 'Base tension' },
          { label: 'Lowers', value: 'Base — straight spreaders' },
          { label: 'Forestay', value: 'Base pin' },
        ],
        note: 'Full hike, mainsheet trimmed hard; use backstay to keep the top telltale just flicking.',
      },
      {
        label: 'Heavy',
        windRange: '16+ kn',
        maxKnots: 99,
        settings: [
          { label: 'Uppers', value: 'Max · base +2 turns' },
          { label: 'Lowers', value: 'Firm — control lower-mast sag' },
          { label: 'Forestay', value: 'Short — rake aft to depower' },
        ],
        note: 'Depower hard: backstay max, vang on, big mainsheet ease in the puffs to stay flat.',
      },
    ],
  },
];

const GUIDE_BY_CLASS = new Map(
  GUIDES.map((g) => [g.boatClass.toLowerCase(), g] as const),
);

/** The guide for a class, or null when the class has no published table here. */
export function rigTuneGuideFor(boatClass?: string | null): RigTuneGuide | null {
  if (!boatClass) return null;
  return GUIDE_BY_CLASS.get(boatClass.trim().toLowerCase()) ?? null;
}

/**
 * The rig-tune band a measured wind speed falls into for a class, plus the
 * guide it came from. Returns null when the class is unknown or no band
 * matches (it shouldn't — the top band is open-ended).
 */
export function rigTuneFor(
  boatClass: string | null | undefined,
  windSpeedKn: number | null | undefined,
): { guide: RigTuneGuide; band: RigTuneBand } | null {
  const guide = rigTuneGuideFor(boatClass);
  if (!guide || windSpeedKn == null || Number.isNaN(windSpeedKn)) return null;
  const band = guide.bands.find((b) => windSpeedKn <= b.maxKnots);
  if (!band) return null;
  return { guide, band };
}
