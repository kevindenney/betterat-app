/**
 * Backfill rich step metadata for the PRADAN "pickle-chutney-first-product"
 * blueprint so the redesigned blueprint page (app/blueprint/[slug].tsx) renders
 * its Why/Who facets, sub-step checklists, capability tiles, and the
 * "~N wks" hero meta with REAL content instead of empty shells.
 *
 * The demo steps shipped with only a description and empty metadata {}, so the
 * richer UI had nothing to show for exactly the blueprint reviewers open first.
 * This fills metadata.plan.{what_will_you_do, how_sub_steps, why_reasoning,
 * capability_goals, collaborators} per step and sets duration_weeks + tagline
 * on the blueprint.
 *
 * Idempotent: matches steps by title, merges (does not clobber) existing
 * metadata. Re-running overwrites only the plan fields below.
 *
 *   node scripts/seed-pickle-blueprint-richness.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SLUG = 'pickle-chutney-first-product';
const DURATION_WEEKS = 6;
const TAGLINE = 'Turn a recipe you already make into your first jars of income.';

// Keyed by a substring of the step title (titles are stable demo seed copy).
const PLAN_BY_TITLE = [
  {
    match: 'Pick one recipe',
    plan: {
      what_will_you_do: 'Commit to a single pickle you can already make consistently.',
      why_reasoning:
        'Starting with a recipe your family already trusts means the taste is consistent from day one — no costly experimenting with strangers as your testers.',
      how_sub_steps: [
        { text: 'Choose one: mango, chilli, or mixed-vegetable pickle' },
        { text: 'Write down the exact quantities you actually use' },
        { text: 'Make one test batch and taste it cold after 3 days' },
      ],
      capability_goals: ['Recipe standardisation', 'Costing a batch'],
      collaborators: 'A senior SHG member who already sells pickle',
    },
  },
  {
    match: 'hygiene and shelf life',
    plan: {
      what_will_you_do: 'Make your jars safe to store and safe to sell.',
      why_reasoning:
        'Clean jars and the right salt-and-oil ratio are what keep pickle good for months — and the first thing a careful buyer checks before they trust you.',
      how_sub_steps: [
        { text: 'Sterilise jars in boiling water and dry them fully' },
        { text: 'Keep oil 1 cm above the pickle to seal out air' },
        { text: 'Date each test jar and check weekly for spoilage' },
      ],
      capability_goals: ['Food safety & hygiene', 'Shelf-life testing'],
      collaborators: 'PRADAN trainer or block resource person',
    },
  },
  {
    match: 'sample jars',
    plan: {
      what_will_you_do: 'Get honest feedback before you spend on stock.',
      why_reasoning:
        'Free samples to neighbours buy you honest feedback and your first word-of-mouth — before you risk any money producing in bulk.',
      how_sub_steps: [
        { text: 'Fill 10 small jars from one standard batch' },
        { text: 'Give them to 10 households you trust to be honest' },
        { text: 'Ask each: too salty, too sour, or just right?' },
      ],
      capability_goals: ['Customer feedback', 'Small-batch production'],
      collaborators: '10 neighbour households you trust',
    },
  },
  {
    match: 'simple label',
    plan: {
      what_will_you_do: 'Make the jar look like a product, not a favour.',
      why_reasoning:
        'A clear label with your name, ingredients, and date turns a jar into a product buyers can recognise — and find you again to reorder.',
      how_sub_steps: [
        { text: 'Write the product name, your name, and a phone number' },
        { text: 'List the ingredients and the made-on date' },
        { text: 'Print at the block CSC or hand-write neatly on plain stickers' },
      ],
      capability_goals: ['Basic branding', 'Labelling for trust'],
      collaborators: 'Block Common Service Centre (CSC) operator',
    },
  },
  {
    match: 'weekly haat',
    plan: {
      what_will_you_do: 'Prove the business with one real selling day.',
      why_reasoning:
        'The haat is where your customers already are. One good stall day proves the business and tells you exactly what to make more of next week.',
      how_sub_steps: [
        { text: 'Book or share a spot at the next weekly haat' },
        { text: 'Carry 20–30 jars priced at your cost plus a margin' },
        { text: 'Note what sells out and what is left, to plan next week' },
      ],
      capability_goals: ['Market selling', 'Pricing for profit'],
      collaborators: 'Fellow SHG sellers at the haat',
    },
  },
];

function planFor(title) {
  const t = (title || '').toLowerCase();
  return PLAN_BY_TITLE.find((p) => t.includes(p.match.toLowerCase()))?.plan ?? null;
}

async function run() {
  const { data: bp, error: bpErr } = await supabase
    .from('timeline_blueprints')
    .select('id, title')
    .eq('slug', SLUG)
    .single();
  if (bpErr || !bp) {
    console.error('Blueprint not found:', SLUG, bpErr?.message);
    process.exit(1);
  }
  console.log(`=== ${bp.title} (${bp.id}) ===`);

  const { error: metaErr } = await supabase
    .from('timeline_blueprints')
    .update({ duration_weeks: DURATION_WEEKS, tagline: TAGLINE })
    .eq('id', bp.id);
  if (metaErr) console.warn('  ⚠️  blueprint meta:', metaErr.message);
  else console.log(`  🏷️  duration_weeks=${DURATION_WEEKS}, tagline set`);

  const { data: links } = await supabase
    .from('blueprint_steps')
    .select('step_id, sort_order')
    .eq('blueprint_id', bp.id)
    .order('sort_order');
  const ids = (links || []).map((l) => l.step_id);
  const { data: steps } = await supabase
    .from('timeline_steps')
    .select('id, title, metadata')
    .in('id', ids);

  for (const step of steps || []) {
    const plan = planFor(step.title);
    if (!plan) {
      console.warn(`  ⚠️  no plan match for "${step.title}" — skipped`);
      continue;
    }
    const existing = (step.metadata && typeof step.metadata === 'object') ? step.metadata : {};
    const nextMeta = { ...existing, plan: { ...(existing.plan ?? {}), ...plan } };
    const { error: upErr } = await supabase
      .from('timeline_steps')
      .update({ metadata: nextMeta })
      .eq('id', step.id);
    if (upErr) console.warn(`  ⚠️  ${step.title}:`, upErr.message);
    else console.log(`  ✅ ${step.title} — ${plan.how_sub_steps.length} sub-steps, ${plan.capability_goals.length} caps`);
  }
  console.log('\nDone.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
