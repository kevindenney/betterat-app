/**
 * Seed authored step templates for the live marketplace blueprints that
 * shipped with zero steps. 15 of 24 live independent blueprints had no
 * blueprint_step_templates, so their detail pages had nothing to preview and
 * read as "subscribe is your only option." This fills each with real,
 * craft-specific steps in the same voice as the hand-authored ones
 * (title + description + category + a sharp what_question; sub_steps and
 * capability_tags left empty to match house style), then updates step_count.
 *
 * Matches blueprints by exact title within access_mode='independent'.
 * Idempotent: replaces templates for each targeted blueprint, so re-running
 * re-seeds cleanly. Only touches the titles listed below.
 *
 *   node scripts/seed-marketplace-empty-blueprint-steps.mjs
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

// title -> ordered steps [{ title, description, category, what }]
const BY_TITLE = {
  'A design portfolio that lands interviews': [
    { c: 'reasoning', t: 'Cut to three projects that show range', d: 'Reviewers spend about ninety seconds on a portfolio. Three sharp case studies beat eight thin ones — pick the projects where you made a real decision, not just a pretty screen.', w: 'Which project best shows how you think, not just what you shipped?' },
    { c: 'communication', t: 'Write each case study as problem → process → outcome', d: 'Lead with the problem and who had it. Show the messy middle, including a direction you tried and dropped. End with a result you can defend out loud in the interview.', w: 'What number or change proves this project worked?' },
    { c: 'procedural', t: 'Show the process, not just the final UI', d: 'Include the sketches, the rejected directions, the user feedback that moved you. Hiring managers are buying your thinking, not your final screens.', w: 'What rejected direction taught you the most?' },
    { c: 'assessment', t: 'Get three designers to tear it apart', d: 'Send it to people who will be honest before you send it to recruiters. Ask exactly where they got confused and what made them stop reading.', w: 'Where did your harshest reviewer lose interest?' },
    { c: 'procedural', t: 'Tighten the homepage to a ten-second scan', d: 'Name, what you do, three projects, a way to reach you. If a stranger can’t get that in ten seconds, cut more until they can.', w: 'Can a stranger say what you do after ten seconds?' },
  ],
  'Break 90: course management': [
    { c: 'assessment', t: 'Chart your real misses for three rounds', d: 'Before you change a swing, find out where the strokes actually go. Track fairways, greens, putts, and penalties — the pattern usually surprises you.', w: 'Where do your double-bogeys actually start?' },
    { c: 'reasoning', t: 'Play to the fat side of every green', d: 'Aim at the center, never the flag tucked behind a bunker. Most amateurs lose strokes short-siding themselves, not by being too cautious.', w: 'What’s the safe miss on this green?' },
    { c: 'reasoning', t: 'Take driver out of your hands on tight holes', d: 'A bogey from the fairway beats a triple from the trees. Where driver brings trouble into play, hit the club that keeps you in the short grass.', w: 'What’s the widest landing area you can find off this tee?' },
    { c: 'procedural', t: 'Build a reliable 100-yards-and-in routine', d: 'Most of your scoring happens inside a hundred yards. Own three wedge distances and one repeatable pre-shot routine, and pars start appearing.', w: 'Which wedge distance do you trust under pressure?' },
    { c: 'reasoning', t: 'Keep a bogey-is-fine scorecard', d: 'Breaking 90 is bogey golf. Stop chasing the hero shot after a bad one — take your medicine, make bogey, and move to the next tee.', w: 'Did the last blow-up come from the first mistake or the second?' },
  ],
  'Community health worker fundamentals': [
    { c: 'assessment', t: 'Map the households on your beat', d: 'Walk your area and list every household, who lives there, and the obvious risks — pregnant mothers, newborns, elderly, chronic illness. You can’t follow up on what you haven’t counted.', w: 'Which households need a visit this week, not this month?' },
    { c: 'communication', t: 'Run a respectful first home visit', d: 'Introduce yourself, explain why you’re there, and ask permission before anything else. Trust earned on the first visit decides whether they call you in an emergency.', w: 'Would this family call you if a child got sick tonight?' },
    { c: 'procedural', t: 'Take and record basic vitals accurately', d: 'Temperature, pulse, breathing rate, and for mothers weight and blood pressure where you can. A number written wrong is worse than no number at all.', w: 'Did you record the reading before moving to the next person?' },
    { c: 'assessment', t: 'Spot the danger signs that need referral', d: 'Know the short list that means go to the clinic now — fast breathing in a child, bleeding, high fever, a baby who won’t move. Your job is to catch these early, not treat them.', w: 'What sign would make you walk this person to the clinic yourself?' },
    { c: 'procedural', t: 'Keep records the clinic can actually use', d: 'Write every visit the same way, with dates and what you found. A clear record is what turns your rounds into care the whole system can act on.', w: 'Could the clinic nurse read your notes and know what happened?' },
  ],
  'Hand-dyeing natural fibers': [
    { c: 'procedural', t: 'Scour and mordant so color holds', d: 'Wash the grease and dirt out, then mordant with alum so the dye can bond. Skip this and your beautiful color rinses straight down the drain.', w: 'Is the fiber truly clean, or just wet?' },
    { c: 'procedural', t: 'Source dyestuff you can get again', d: 'Madder, indigo, onion skins, marigold — pick dyes you can resupply locally. A color you can only make once isn’t a product.', w: 'Can you get this dyestuff again next season?' },
    { c: 'assessment', t: 'Dye a graded sample card from one bath', d: 'Pull samples at intervals from a single pot to learn the full range one bath gives you. That card becomes your recipe book.', w: 'How many usable shades came from one pot?' },
    { c: 'assessment', t: 'Test wash- and light-fastness honestly', d: 'Wash one sample and tape another in a sunny window for two weeks. Better to find the fade yourself than have a customer find it.', w: 'Did the color survive a wash and two weeks of sun?' },
    { c: 'procedural', t: 'Record every recipe so you can repeat it', d: 'Weights, water, time, temperature, mordant. “It came out lovely” is not a recipe you can sell twice.', w: 'Could you hit this exact shade again from your notes?' },
  ],
  'Handloom weaving for income': [
    { c: 'procedural', t: 'Warp the loom for clean selvedges', d: 'Even tension across the warp is the difference between cloth that sells and cloth that puckers. Slow down here; it pays back on every yard.', w: 'Is the tension even from edge to edge?' },
    { c: 'procedural', t: 'Weave a consistent sample yard', d: 'Weave a full yard at a steady beat and measure your picks per inch. Consistency is what a buyer is really paying for.', w: 'Does the start of the yard match the end?' },
    { c: 'reasoning', t: 'Cost a yard honestly', d: 'Add up yarn, the hours you wove, and a real margin. If you’re not counting your time, you’re paying to work.', w: 'What does an hour of your weaving need to earn?' },
    { c: 'assessment', t: 'Inspect for the faults buyers reject', d: 'Hold the cloth to the light and find the floats, the skipped picks, the tension lines — before the buyer does.', w: 'What would make a buyer hand this back?' },
    { c: 'communication', t: 'Find your first repeat buyer', d: 'One buyer who comes back beats ten one-time sales. Ask the haat seller or shop what their customers actually want, and weave that.', w: 'Who would buy your second yard, not just your first?' },
  ],
  'Lac bangle micro-enterprise': [
    { c: 'procedural', t: 'Source clean lac and color it evenly', d: 'Start with good raw lac and work the color all the way through. Patchy color is the first thing a buyer rejects.', w: 'Is the color even all the way through, not just on the surface?' },
    { c: 'procedural', t: 'Shape a batch of crack-free bangles', d: 'Even heat and steady hands give you round, crack-free bangles. Work in small batches until the shape is reliable.', w: 'How many in the last batch were sellable?' },
    { c: 'reasoning', t: 'Cost a batch and set an honest price', d: 'Count lac, color, fuel, and your hours. Price below that and every bangle is a small loss you can’t see.', w: 'What does a dozen bangles need to sell for?' },
    { c: 'assessment', t: 'Check each piece for buyer faults', d: 'Cracks, rough edges, uneven color, loose stones. Sort the seconds out yourself before market day.', w: 'Would you pay full price for this one?' },
    { c: 'communication', t: 'Sell a first lot and note what moves', d: 'Take a mixed tray to the haat and watch which colors and sizes sell out. Then make more of what moved.', w: 'Which design sold out first?' },
  ],
  'Learn anything: a self-study system': [
    { c: 'reasoning', t: 'Define what “good enough” looks like', d: 'Name the concrete thing you want to do — hold a ten-minute conversation, ship a small app, play one song start to finish. Vague goals never finish.', w: 'What’s the specific thing you’ll be able to do?' },
    { c: 'reasoning', t: 'Break the skill into a weekly ladder', d: 'Turn the goal into rungs you can climb one week at a time. A ladder beats a mountain you just stand and stare at.', w: 'What’s the smallest rung you could climb this week?' },
    { c: 'procedural', t: 'Run short, daily, deliberate blocks', d: 'Twenty-five focused minutes a day beats a four-hour weekend cram. Practice the part you’re worst at, not the part that’s comfortable.', w: 'Did today’s block work on the thing you’re worst at?' },
    { c: 'assessment', t: 'Test yourself instead of re-reading', d: 'Close the book and try to do it from memory. Recall, not review, is what moves a skill into your hands.', w: 'Can you do it without looking?' },
    { c: 'assessment', t: 'Keep a friction log and cut what stalls you', d: 'Note where you keep getting stuck or bored. Most quitting is a fixable friction, not a lack of talent.', w: 'What keeps making you stop?' },
  ],
  'Oil painting: alla prima portraits': [
    { c: 'procedural', t: 'Mix a limited flesh palette first', d: 'Set out a small, deliberate palette before you touch the canvas. Fewer colors mixed with intent read truer than a full rainbow.', w: 'Can you hit a skin tone from these few colors?' },
    { c: 'procedural', t: 'Block in big shapes and values fast', d: 'Start with the large light and shadow masses, not the eyelashes. Get the whole head right before any detail goes in.', w: 'Does the block-in read as a face from across the room?' },
    { c: 'assessment', t: 'Check the drawing with measured comparisons', d: 'Compare angles and distances against each other — eye to nose, nose to chin. Trust measurement over what you think you see.', w: 'Is the spacing measured, or guessed?' },
    { c: 'procedural', t: 'Push the edges, not the details', d: 'Soft edges turn away, hard edges snap forward. Control the light-shadow edge and the form appears without fussing over features.', w: 'Which edge should be lost, and which found?' },
    { c: 'procedural', t: 'Finish wet-in-wet in one sitting', d: 'Alla prima means alive and direct. Commit to finishing while the paint is wet rather than overworking it dead.', w: 'Are you refining, or just fiddling?' },
  ],
  'Spice processing for market': [
    { c: 'procedural', t: 'Clean and dry the raw spice properly', d: 'Sort out stones and stems, then dry it fully. Moisture left in is mould waiting to happen on the shelf.', w: 'Is it dry enough to store for months?' },
    { c: 'procedural', t: 'Grind to a consistent, fragrant grade', d: 'Grind in small lots so it doesn’t heat up and lose aroma. Consistent texture is what makes a packet look professional.', w: 'Does every packet feel the same in the hand?' },
    { c: 'assessment', t: 'Test moisture so it doesn’t spoil', d: 'Under-dried spice clumps and spoils. Learn the simple checks before you pack a single bag for sale.', w: 'Will this still be good in three months?' },
    { c: 'procedural', t: 'Pack and label to pass inspection', d: 'Clean packaging with name, ingredients, weight, and date. This is what lets a shop legally put you on the shelf.', w: 'Would a shopkeeper feel safe stocking this?' },
    { c: 'reasoning', t: 'Price a packet with your real costs', d: 'Raw spice, fuel, packaging, and your time, then margin. A price guessed is a profit quietly lost.', w: 'What does one packet actually cost you to make?' },
  ],
  'Starting-line tactics': [
    { c: 'reasoning', t: 'Read line bias before the gun', d: 'Sail the line and check which end is favored. Starting at the right end is free distance you don’t have to fight for upwind.', w: 'Which end is closer to the wind?' },
    { c: 'procedural', t: 'Run a clean time-and-distance approach', d: 'Know how long your run to the line takes, then time it so you hit the line at full speed on the gun — not early, not stalled.', w: 'Are you arriving at full speed exactly on zero?' },
    { c: 'procedural', t: 'Hold your lane in traffic', d: 'Defend the gap to leeward and keep your bow out. A lane held off the line is worth more than a flashy port-tack flyer.', w: 'Can you hold this lane for thirty seconds after the gun?' },
    { c: 'assessment', t: 'Debrief every start on video', d: 'Film the starts and watch them back. The gap between what you felt and what actually happened is where you improve.', w: 'Were you where you thought you were at the gun?' },
    { c: 'reasoning', t: 'Pick your end for the first shift', d: 'The favored end and the first expected shift don’t always agree. Decide which one you’re betting this start on.', w: 'Are you starting for the line, or for the first beat?' },
  ],
  'Strength foundations: a 12-week base': [
    { c: 'procedural', t: 'Groove the big lifts with light, clean reps', d: 'Squat, hinge, press, pull — drill the patterns light until they’re automatic. Technique built now is strength you keep later.', w: 'Is the bar path the same every rep?' },
    { c: 'assessment', t: 'Set honest starting loads from a test', d: 'Find a weight you can move well, not the most you can grind out. Ego loading is how base blocks end in injury.', w: 'Could you do two more clean reps in the tank?' },
    { c: 'reasoning', t: 'Progress weight in small weekly steps', d: 'Add a little, often. Small jumps you can recover from beat big jumps that stall you and wreck the week.', w: 'Is this week’s jump small enough to repeat next week?' },
    { c: 'procedural', t: 'Build recovery on purpose', d: 'Sleep, protein, and rest days are where strength is actually built. Train hard, then recover harder.', w: 'Are you sleeping enough to adapt to this work?' },
    { c: 'assessment', t: 'Re-test at week 12 and plan the next block', d: 'Repeat the opening test and see the gain in black and white. Then decide what the next twelve weeks build on.', w: 'What got stronger, and what’s the next focus?' },
  ],
  'The daily-practice operating system': [
    { c: 'reasoning', t: 'Pick one keystone practice, not five', d: 'Choose the single daily habit that drags the others up with it. Five new habits at once is five chances to quit.', w: 'Which one habit makes the rest easier?' },
    { c: 'procedural', t: 'Anchor it to an existing cue', d: 'Attach the new practice to something you already do — after coffee, before the commute. Cues beat willpower every time.', w: 'What existing routine can carry the new one?' },
    { c: 'procedural', t: 'Shrink it until it’s impossible to skip', d: 'Make the minimum version laughably small — one page, two minutes. You can always do more; you can never do zero.', w: 'Is the floor small enough for your worst day?' },
    { c: 'assessment', t: 'Track the streak where you’ll see it', d: 'A visible chain you don’t want to break is a quiet, powerful motivator. Put it somewhere you can’t ignore it.', w: 'Will you see the streak tomorrow without looking for it?' },
    { c: 'reasoning', t: 'Plan for the miss before it happens', d: 'You will miss a day. Decide now that one miss is fine and two in a row is the real rule you never break.', w: 'What’s your plan for the day you slip?' },
  ],
  'The regenerative market garden': [
    { c: 'reasoning', t: 'Map beds, sun, and water first', d: 'Before a single seed, know where the sun falls and the water reaches. A garden planned on paper saves a whole season of mistakes.', w: 'Which beds get full sun, and which dry out first?' },
    { c: 'procedural', t: 'Build soil with compost and no-dig beds', d: 'Feed the soil, not the plant. Compost and minimal digging build the living soil that does the work for you.', w: 'Is the soil getting richer or poorer each season?' },
    { c: 'reasoning', t: 'Plan a succession so beds never sit empty', d: 'As one crop comes out, the next goes in. Empty beds are lost income and an open invitation to weeds.', w: 'What follows this crop the day it’s pulled?' },
    { c: 'procedural', t: 'Sow, transplant, and keep a planting log', d: 'Record what you sowed and when. Memory fails; the log is what makes next year better than this one.', w: 'Could you repeat this season’s timing from your notes?' },
    { c: 'procedural', t: 'Harvest, wash, and bunch for market', d: 'Pick at the right size, wash cold, and present it well. Half of selling vegetables is how they look on the table.', w: 'Would you buy this bunch over the stall next door?' },
  ],
  'Your first finished sweater': [
    { c: 'assessment', t: 'Knit a gauge swatch and actually measure it', d: 'Knit a real swatch in the round, wash it, and measure. Skip this and you’ll knit a sweater for someone else’s body.', w: 'Does your gauge match the pattern, washed?' },
    { c: 'reasoning', t: 'Pick a size from real measurements', d: 'Measure a sweater that already fits you and choose by those numbers, not by S/M/L. Ease is a choice, not a guess.', w: 'How much room do you actually want?' },
    { c: 'procedural', t: 'Work the body to a tried-on length', d: 'Try it on as you go. A body knit to your torso beats a body knit to the pattern’s idea of you.', w: 'Does it hit where you want when you hold it up?' },
    { c: 'procedural', t: 'Set in the sleeves without puckering', d: 'Pick up evenly and ease the cap in. Tidy sleeve joins are what separate “handmade” from “homemade.”', w: 'Are the stitches picked up evenly all the way around?' },
    { c: 'procedural', t: 'Block it so it finally fits', d: 'Wash and pin to measurements. Blocking is the magic step that turns lumpy knitting into a finished garment.', w: 'Did blocking even out the stitches and the fit?' },
  ],
};

async function run() {
  let seeded = 0;
  for (const [title, steps] of Object.entries(BY_TITLE)) {
    const { data: rows, error } = await supabase
      .from('blueprints')
      .select('id, title, step_count')
      .eq('title', title)
      .eq('access_mode', 'independent');
    if (error) { console.warn(`  ⚠️  lookup "${title}":`, error.message); continue; }
    if (!rows || rows.length === 0) { console.warn(`  ⚠️  no blueprint titled "${title}"`); continue; }
    if (rows.length > 1) { console.warn(`  ⚠️  ${rows.length} blueprints titled "${title}" — seeding all`); }

    for (const bp of rows) {
      // Replace any existing templates so re-runs are clean.
      await supabase.from('blueprint_step_templates').delete().eq('blueprint_id', bp.id);
      const inserts = steps.map((s, i) => ({
        blueprint_id: bp.id,
        sort_order: i + 1,
        title: s.t,
        description: s.d,
        category: s.c,
        what_question: s.w,
      }));
      const { error: insErr } = await supabase.from('blueprint_step_templates').insert(inserts);
      if (insErr) { console.warn(`  ⚠️  insert "${title}":`, insErr.message); continue; }
      const { error: cntErr } = await supabase
        .from('blueprints')
        .update({ step_count: steps.length })
        .eq('id', bp.id);
      if (cntErr) console.warn(`  ⚠️  step_count "${title}":`, cntErr.message);
      console.log(`  ✅ ${title} — ${steps.length} steps`);
      seeded++;
    }
  }
  console.log(`\nSeeded ${seeded} blueprint(s).`);
}

run().catch((e) => { console.error(e); process.exit(1); });
