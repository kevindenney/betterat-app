-- pradan_khunti_step_content.sql
-- Flesh out the India demo personas' personal timelines with full,
-- persona-native plan content so the BUSINESS MIX capability river and the
-- step Plan tab render rich instead of a single generic "Lesson" chip.
--
-- Covers Suman Tirkey (demo-suman) — SHG coach whose personal timeline spans
-- finance/govt-scheme, food (murmura/pickle), handloom and tasar-silk crafts —
-- and Savitri Devi (demo-savitri) — tailoring + kitchen-garden + MUDRA finance.
--
-- The capability chips are read from metadata.plan.capability_goals (string[]);
-- what_will_you_do / why_reasoning / how_sub_steps render in the step Plan tab.
-- See components/ios-register/timeline-zoom/realDataAdapter.ts (recordToStep).
--
-- Idempotent: applies by (user, title) ONLY where capability_goals is still
-- NULL, so the hand-authored pickle/SBI steps are left untouched. Merges into
-- any existing metadata.plan rather than overwriting. Re-run safe.

BEGIN;

WITH content(title, plan) AS (
  VALUES
  -- ===== Finance / loans (MUDRA) =====
  ('Check if you qualify for MUDRA Shishu', '{
    "capability_goals": ["Loan eligibility","Government schemes"],
    "what_will_you_do": "Find out if your business fits the MUDRA Shishu loan (up to ₹50,000).",
    "why_reasoning": "MUDRA Shishu is the easiest first loan for a small enterprise — knowing you qualify before you apply saves a wasted trip to the bank.",
    "how_sub_steps": [{"text":"List what your business does and how long you have run it"},{"text":"Check you have an Aadhaar and a bank account in your name"},{"text":"Confirm the loan you need is under ₹50,000"}]
  }'::jsonb),
  ('Gather your MUDRA documents', '{
    "capability_goals": ["Document readiness","Loan application"],
    "what_will_you_do": "Collect every paper the bank will ask for before you go.",
    "why_reasoning": "Banks reject more applications for missing papers than for weak businesses — arriving complete is half the battle.",
    "how_sub_steps": [{"text":"Aadhaar, ration card and two photos"},{"text":"Bank passbook and any past business proof"},{"text":"Keep the originals and one photocopy of each"}]
  }'::jsonb),
  ('Fill the MUDRA application', '{
    "capability_goals": ["Loan application","Business planning"],
    "what_will_you_do": "Complete the MUDRA form with your business and loan details.",
    "why_reasoning": "A clean, honest form that matches your documents is what a loan officer can approve quickly.",
    "how_sub_steps": [{"text":"Write the loan amount and what you will spend it on"},{"text":"Make sure the name matches your Aadhaar exactly"},{"text":"Ask the SHG bookkeeper to check it before you sign"}]
  }'::jsonb),
  ('Submit and get your receipt', '{
    "capability_goals": ["Loan application","Record keeping"],
    "what_will_you_do": "Hand in your application and keep proof you submitted it.",
    "why_reasoning": "An acknowledgement receipt is your only leverage if the bank loses your file — never leave without it.",
    "how_sub_steps": [{"text":"Submit the form at the loan counter"},{"text":"Ask for a stamped acknowledgement or application number"},{"text":"Photograph the receipt and keep it safe"}]
  }'::jsonb),
  ('Follow up after 7-14 days', '{
    "capability_goals": ["Loan follow-up","Persistence"],
    "what_will_you_do": "Check on your application status after a fortnight.",
    "why_reasoning": "Files that get followed up move; files that sit silently get forgotten.",
    "how_sub_steps": [{"text":"Visit or call with your application number ready"},{"text":"Ask politely what is still pending"},{"text":"Note the officer name and the next date to check"}]
  }'::jsonb),
  ('What to do if MUDRA is rejected', '{
    "capability_goals": ["Loan troubleshooting","Government schemes"],
    "what_will_you_do": "Know your next options if the first answer is no.",
    "why_reasoning": "A rejection is rarely final — fixing one missing paper or trying another scheme often works.",
    "how_sub_steps": [{"text":"Ask exactly why it was refused"},{"text":"Fix the missing document and reapply"},{"text":"If refused again, try the state Mukhyamantri scheme"}]
  }'::jsonb),
  ('Visit the bank branch', '{
    "capability_goals": ["Bank linkage","Loan application"],
    "what_will_you_do": "Go in person to start your loan conversation.",
    "why_reasoning": "A face-to-face visit builds the trust that decides small rural loans far more than the form does.",
    "how_sub_steps": [{"text":"Go early when the branch is less crowded"},{"text":"Ask for the officer who handles MUDRA or SHG loans"},{"text":"Take your SHG bookkeeper if you can"}]
  }'::jsonb),
  -- ===== Govt schemes (Mukhyamantri / residency) =====
  ('Understand Mukhyamantri Protsahan Yojana', '{
    "capability_goals": ["Government schemes","Subsidy claims"],
    "what_will_you_do": "Learn what the state entrepreneur incentive scheme offers you.",
    "why_reasoning": "Jharkhand''s own schemes often add subsidy on top of a central loan — money you forfeit if you don''t ask.",
    "how_sub_steps": [{"text":"Read what the scheme pays and to whom"},{"text":"Note the subsidy amount and the deadline"},{"text":"Ask your PRADAN coordinator how others claimed it"}]
  }'::jsonb),
  ('Check Mukhyamantri eligibility', '{
    "capability_goals": ["Government schemes","Subsidy claims"],
    "what_will_you_do": "Confirm you meet the scheme conditions before applying.",
    "why_reasoning": "Each state scheme has its own caste, income and residence rules — checking first avoids a rejected claim.",
    "how_sub_steps": [{"text":"Check the income and category limits"},{"text":"Confirm your residence in the district qualifies"},{"text":"List which documents prove each condition"}]
  }'::jsonb),
  ('Get your residential certificate', '{
    "capability_goals": ["Document readiness","Government schemes"],
    "what_will_you_do": "Obtain the residence proof most schemes require.",
    "why_reasoning": "A residential certificate is the one paper that unlocks almost every Jharkhand benefit — get it once, use it everywhere.",
    "how_sub_steps": [{"text":"Apply at the block office or online on JharSewa"},{"text":"Carry Aadhaar and a voter or ration card"},{"text":"Keep several photocopies once it arrives"}]
  }'::jsonb),
  ('Apply online or at the block office', '{
    "capability_goals": ["Government schemes","Subsidy claims"],
    "what_will_you_do": "Submit your scheme application through the right channel.",
    "why_reasoning": "Knowing whether your block takes online or in-person forms saves a wasted day at the office.",
    "how_sub_steps": [{"text":"Ask whether your block accepts JharSewa online"},{"text":"Upload or attach the residential certificate"},{"text":"Save the application reference number"}]
  }'::jsonb),
  -- ===== SHG funds (NRLM / revolving / CIF / bank linkage / JSLPS) =====
  ('Confirm your SHG is NRLM-registered', '{
    "capability_goals": ["SHG finance","Government schemes"],
    "what_will_you_do": "Make sure your self-help group is on the NRLM rolls.",
    "why_reasoning": "NRLM registration is the gate to revolving funds, CIF and cheap bank linkage — without it your group is invisible to the system.",
    "how_sub_steps": [{"text":"Check the group is recorded with the village organisation"},{"text":"Confirm regular savings and meeting minutes are kept"},{"text":"Note your SHG code for every later application"}]
  }'::jsonb),
  ('Claim Revolving Fund (₹15,000 — free)', '{
    "capability_goals": ["SHG finance","Grant access"],
    "what_will_you_do": "Claim the one-time ₹15,000 revolving fund your SHG is owed.",
    "why_reasoning": "It is a grant, not a loan — leaving it unclaimed is leaving free working capital on the table.",
    "how_sub_steps": [{"text":"Confirm the group has six months of regular savings"},{"text":"Apply through the village organisation"},{"text":"Record how the fund rotates between members"}]
  }'::jsonb),
  ('Get bank linkage loan (up to 4x your savings)', '{
    "capability_goals": ["SHG finance","Bank linkage","Credit access"],
    "what_will_you_do": "Use your group savings to unlock a matched bank loan.",
    "why_reasoning": "Bank linkage multiplies your group''s own savings 4x at low interest — the cheapest growth capital a rural enterprise can get.",
    "how_sub_steps": [{"text":"Total the group''s savings to date"},{"text":"Apply for a cash-credit limit through the bank"},{"text":"Agree a fair repayment split among members"}]
  }'::jsonb),
  ('Apply for Community Investment Fund (up to ₹2.5 lakh)', '{
    "capability_goals": ["SHG finance","Grant access"],
    "what_will_you_do": "Apply for the cluster-level CIF for a bigger enterprise push.",
    "why_reasoning": "CIF funds the jump from a single member''s trade to a group enterprise — the capital that takes you past a one-woman shop.",
    "how_sub_steps": [{"text":"Write a short enterprise plan for the cluster"},{"text":"Apply through the cluster-level federation"},{"text":"Show how the fund will be repaid and reused"}]
  }'::jsonb),
  ('Apply through JSLPS', '{
    "capability_goals": ["Government schemes","SHG finance"],
    "what_will_you_do": "Route your request through the state livelihood mission.",
    "why_reasoning": "JSLPS is the official channel for SHG funds in Jharkhand — applying through it is what makes your claim count.",
    "how_sub_steps": [{"text":"Meet your block JSLPS coordinator"},{"text":"Submit the group documents they list"},{"text":"Track the file number they give you"}]
  }'::jsonb),
  ('Bank verification and disbursement', '{
    "capability_goals": ["Bank linkage","Loan follow-up"],
    "what_will_you_do": "Get through the bank checks so the money is released.",
    "why_reasoning": "Disbursement only happens after verification — staying available for the officer''s call is what gets cash in hand.",
    "how_sub_steps": [{"text":"Answer any verification call or visit promptly"},{"text":"Keep your phone reachable in the disbursement week"},{"text":"Confirm the amount credited matches the sanction"}]
  }'::jsonb),
  -- ===== Business basics (plan / costing / pricing) =====
  ('Prepare a simple business plan', '{
    "capability_goals": ["Business planning","Costing a batch"],
    "what_will_you_do": "Write a one-page plan of what you make, sell and earn.",
    "why_reasoning": "Even a single honest page shows a loan officer you have thought it through — and keeps you honest about your own numbers.",
    "how_sub_steps": [{"text":"Write what you make and who buys it"},{"text":"List monthly cost, sales and profit"},{"text":"State what the loan will be spent on"}]
  }'::jsonb),
  ('Calculate your real costs', '{
    "capability_goals": ["Costing a batch","Pricing for profit"],
    "what_will_you_do": "Add up every rupee that goes into one batch you make.",
    "why_reasoning": "If you don''t know your true cost — including your own time — you can''t tell whether a sale earned you money or lost it.",
    "how_sub_steps": [{"text":"Add raw material, packaging and transport"},{"text":"Add a fair value for your own labour"},{"text":"Divide by how many pieces the batch makes"}]
  }'::jsonb),
  ('Price for different markets', '{
    "capability_goals": ["Pricing for profit","Market selling"],
    "what_will_you_do": "Set the right price for the haat, shops and online buyers.",
    "why_reasoning": "The same product earns more in a city shop than at the village haat — pricing per market is how you capture that difference.",
    "how_sub_steps": [{"text":"Start from your real cost per piece"},{"text":"Add a margin the local haat will bear"},{"text":"Quote a higher price to Ranchi shops and online"}]
  }'::jsonb),
  -- ===== Selling / market access =====
  ('Find your first buyer', '{
    "capability_goals": ["Market selling","Buyer outreach"],
    "what_will_you_do": "Find the very first person who will pay for what you make.",
    "why_reasoning": "The first paying buyer turns a hobby into a business — and proves your product is worth money to someone outside your home.",
    "how_sub_steps": [{"text":"Offer to neighbours and at the next SHG meeting"},{"text":"Take one sample to the weekly haat"},{"text":"Ask the first buyer what they would pay again for"}]
  }'::jsonb),
  ('Find Ranchi shop buyers', '{
    "capability_goals": ["Market selling","Buyer outreach"],
    "what_will_you_do": "Find shops in Ranchi that will stock your product.",
    "why_reasoning": "City shops buy in bulk and pay steadier than walk-up customers — a few good shop buyers can carry your whole month.",
    "how_sub_steps": [{"text":"List shops that sell similar goods"},{"text":"Carry samples and a simple price list"},{"text":"Agree quantity, price and how often you supply"}]
  }'::jsonb),
  ('Explore online marketplaces', '{
    "capability_goals": ["Digital selling","Buyer outreach"],
    "what_will_you_do": "Look at selling through online platforms beyond your district.",
    "why_reasoning": "Online buyers reach past Khunti to all of India — even a few orders a week add a market your village can''t.",
    "how_sub_steps": [{"text":"See how others list a craft like yours"},{"text":"Take clear photos of your product"},{"text":"Start with one platform and a few items"}]
  }'::jsonb),
  ('Improve your packaging', '{
    "capability_goals": ["Packaging","Branding"],
    "what_will_you_do": "Make your product look safe, clean and worth more.",
    "why_reasoning": "Buyers pay more for the same goods in better packaging — it is the cheapest way to lift your price.",
    "how_sub_steps": [{"text":"Use a clean, sealed pack that travels well"},{"text":"Add a simple label with name and contact"},{"text":"Compare yours to the shop version side by side"}]
  }'::jsonb),
  -- ===== Food: murmura (puffed rice) =====
  ('Learn the basic murmura technique', '{
    "capability_goals": ["Murmura making","Batch production"],
    "what_will_you_do": "Learn to puff rice into crisp, sellable murmura.",
    "why_reasoning": "Getting the heat and timing right is the difference between crisp murmura that sells and soft batches you eat at home.",
    "how_sub_steps": [{"text":"Learn from someone who already makes it well"},{"text":"Practise the sand-and-heat method on a small lot"},{"text":"Note the timing that gives the crispest result"}]
  }'::jsonb),
  ('Source rice and packaging locally', '{
    "capability_goals": ["Sourcing","Costing a batch"],
    "what_will_you_do": "Find steady, cheap rice and packets near you.",
    "why_reasoning": "Your profit is set the day you buy raw material — a reliable local supplier keeps cost down and batches consistent.",
    "how_sub_steps": [{"text":"Compare rice rates from two or three sellers"},{"text":"Buy packets in bulk to lower the per-piece cost"},{"text":"Fix a supplier who keeps stock when you need it"}]
  }'::jsonb),
  ('Make your first batch and taste-test', '{
    "capability_goals": ["Batch production","Quality control"],
    "what_will_you_do": "Make one full batch and check it against the market.",
    "why_reasoning": "Tasting against what shops already sell tells you, before you spend on packaging, whether buyers will switch to yours.",
    "how_sub_steps": [{"text":"Make one full batch start to finish"},{"text":"Taste it next to a shop-bought packet"},{"text":"Adjust salt, crispness and size"}]
  }'::jsonb),
  ('Sell your first 10 packets', '{
    "capability_goals": ["Market selling","Customer feedback"],
    "what_will_you_do": "Sell ten packets and listen to what buyers say.",
    "why_reasoning": "The first ten real sales teach you more about price and taste than any amount of planning.",
    "how_sub_steps": [{"text":"Sell at the haat or to neighbours"},{"text":"Ask each buyer what they liked or missed"},{"text":"Note which price they paid without hesitation"}]
  }'::jsonb),
  -- ===== Food licensing (FSSAI) =====
  ('Understand which FSSAI license you need', '{
    "capability_goals": ["Food licensing","Compliance"],
    "what_will_you_do": "Work out which FSSAI category fits your food business.",
    "why_reasoning": "Most home food sellers only need the cheap Basic registration — knowing that saves you over-paying for a license you don''t need.",
    "how_sub_steps": [{"text":"Estimate your yearly sales"},{"text":"Confirm Basic registration covers small sellers"},{"text":"Note the fee and the renewal period"}]
  }'::jsonb),
  ('Gather documents for Basic registration', '{
    "capability_goals": ["Document readiness","Food licensing"],
    "what_will_you_do": "Collect the papers FSSAI Basic registration asks for.",
    "why_reasoning": "Basic registration needs only an ID and a photo — having them ready means you finish in one sitting.",
    "how_sub_steps": [{"text":"Aadhaar and a passport photo"},{"text":"Your address and business name"},{"text":"A working phone number and email"}]
  }'::jsonb),
  ('Get FSSAI basic registration', '{
    "capability_goals": ["Food licensing","Compliance"],
    "what_will_you_do": "Complete your FSSAI Basic registration.",
    "why_reasoning": "An FSSAI number is what lets a shop legally stock your food — without it you''re stuck selling jar to jar.",
    "how_sub_steps": [{"text":"Apply on the FSSAI site or at a CSC centre"},{"text":"Pay the small registration fee"},{"text":"Save the registration certificate and number"}]
  }'::jsonb),
  ('Put your FSSAI number on every product', '{
    "capability_goals": ["Food licensing","Branding"],
    "what_will_you_do": "Print your FSSAI number on each label.",
    "why_reasoning": "A visible FSSAI number turns a homemade jar into a product a careful buyer and a city shop will trust.",
    "how_sub_steps": [{"text":"Add the number to your label design"},{"text":"Include the make and best-before date"},{"text":"Check every pack carries it before you sell"}]
  }'::jsonb),
  -- ===== Handloom / weaving =====
  ('Understand warp and weft', '{
    "capability_goals": ["Weaving fundamentals","Loom setup"],
    "what_will_you_do": "Learn how the lengthwise and crosswise threads make cloth.",
    "why_reasoning": "Warp and weft are the alphabet of weaving — everything else on the loom builds on getting these two right.",
    "how_sub_steps": [{"text":"Identify the warp (length) and weft (cross) on a sample"},{"text":"See how tension holds the warp straight"},{"text":"Watch a weaver pass the weft through"}]
  }'::jsonb),
  ('Set up your first warp on a frame loom', '{
    "capability_goals": ["Loom setup","Weaving technique"],
    "what_will_you_do": "Thread your first warp onto a simple frame loom.",
    "why_reasoning": "An even, tight warp is what decides whether your cloth comes out straight — most beginner mistakes start here.",
    "how_sub_steps": [{"text":"Measure and cut the warp threads to length"},{"text":"Tie them on with even spacing and tension"},{"text":"Check there are no loose or crossed threads"}]
  }'::jsonb),
  ('Weave your first 6 inches', '{
    "capability_goals": ["Weaving technique","Quality control"],
    "what_will_you_do": "Weave a first short length and check it is even.",
    "why_reasoning": "Six honest inches show you your tension and rhythm before you commit a whole warp to a flaw.",
    "how_sub_steps": [{"text":"Pass the weft and beat it down evenly"},{"text":"Keep the edges straight, not pulled in"},{"text":"Check the spacing looks consistent"}]
  }'::jsonb),
  ('Complete a small gamcha (hand towel)', '{
    "capability_goals": ["Weaving technique","Finished product"],
    "what_will_you_do": "Weave one full gamcha start to finish.",
    "why_reasoning": "Finishing a whole gamcha proves you can carry a piece to a sellable end — your first real product.",
    "how_sub_steps": [{"text":"Weave the full length with a simple border"},{"text":"Finish and knot the ends neatly"},{"text":"Wash, dry and check it for flaws"}]
  }'::jsonb),
  ('Check if you qualify for a subsidised loom', '{
    "capability_goals": ["Government schemes","Weaver welfare"],
    "what_will_you_do": "See if you qualify for a government-subsidised loom.",
    "why_reasoning": "A subsidised loom can cut your biggest start-up cost by half — worth checking before you buy at full price.",
    "how_sub_steps": [{"text":"Ask the handloom office about current schemes"},{"text":"Check the eligibility and subsidy share"},{"text":"List the documents the scheme needs"}]
  }'::jsonb),
  ('Register for a Weaver ID card', '{
    "capability_goals": ["Government schemes","Weaver welfare"],
    "what_will_you_do": "Get the official weaver identity card.",
    "why_reasoning": "A Weaver ID is the key to yarn supply, subsidies and marketing schemes meant only for registered weavers.",
    "how_sub_steps": [{"text":"Apply at the weavers'' service centre"},{"text":"Carry Aadhaar and proof you weave"},{"text":"Keep the ID number for scheme applications"}]
  }'::jsonb),
  ('Apply for yarn supply through your SHG', '{
    "capability_goals": ["Sourcing","SHG finance"],
    "what_will_you_do": "Get subsidised yarn through your group.",
    "why_reasoning": "Buying yarn together through the SHG gets you a better rate than any single weaver can — and steady supply.",
    "how_sub_steps": [{"text":"Pool the group''s yarn requirement"},{"text":"Apply through the cooperative or depot"},{"text":"Agree how members share and repay the stock"}]
  }'::jsonb),
  ('Join the Handloom Marketing Assistance programme', '{
    "capability_goals": ["Government schemes","Market selling"],
    "what_will_you_do": "Enrol in the scheme that helps weavers sell.",
    "why_reasoning": "The marketing assistance scheme puts your cloth in front of exhibition and bulk buyers you''d never reach from the village.",
    "how_sub_steps": [{"text":"Register your products with the scheme"},{"text":"Ask about upcoming exhibitions and melas"},{"text":"Prepare stock and price lists for buyers"}]
  }'::jsonb),
  ('Learn about natural dyes from local plants', '{
    "capability_goals": ["Natural dyeing","Product differentiation"],
    "what_will_you_do": "Learn to dye thread with local plant colours.",
    "why_reasoning": "Natural-dyed cloth fetches a premium city buyers will pay for — and the plants grow free around you.",
    "how_sub_steps": [{"text":"Identify dye plants growing nearby"},{"text":"Test a colour on a small skein"},{"text":"Note the recipe that holds colour after washing"}]
  }'::jsonb),
  -- ===== Tasar silk (sericulture) =====
  ('Understand the tasar silk cycle', '{
    "capability_goals": ["Tasar value chain","Sericulture"],
    "what_will_you_do": "Learn how tasar silk goes from cocoon to thread.",
    "why_reasoning": "Knowing the whole cycle shows you where the money is made — and where you can add value instead of selling raw cocoons cheap.",
    "how_sub_steps": [{"text":"Trace the path: host tree to cocoon to reeled thread"},{"text":"Note who earns at each stage"},{"text":"Mark the stage you can take on yourself"}]
  }'::jsonb),
  ('Learn cocoon sorting and grading', '{
    "capability_goals": ["Cocoon grading","Quality control"],
    "what_will_you_do": "Sort cocoons by quality the way buyers do.",
    "why_reasoning": "Graded cocoons sell for far more than a mixed lot — sorting is the simplest way to lift what you earn per kilo.",
    "how_sub_steps": [{"text":"Separate by size, colour and damage"},{"text":"Set aside pierced or stained cocoons"},{"text":"Weigh each grade to know your mix"}]
  }'::jsonb),
  ('Practice reeling on a hand charkha', '{
    "capability_goals": ["Silk reeling","Sericulture"],
    "what_will_you_do": "Practise drawing thread from cocoons on a charkha.",
    "why_reasoning": "Reeling your own thread, instead of selling cocoons raw, is where a tasar grower captures the real value.",
    "how_sub_steps": [{"text":"Soften cocoons in warm water first"},{"text":"Find the thread end and feed the charkha"},{"text":"Keep an even, unbroken draw"}]
  }'::jsonb),
  ('Reel your first 100g of usable thread', '{
    "capability_goals": ["Silk reeling","Finished product"],
    "what_will_you_do": "Reel a first 100 grams of sellable silk thread.",
    "why_reasoning": "A clean 100g skein proves you can turn cocoons into thread buyers will pay for — your first value-added product.",
    "how_sub_steps": [{"text":"Reel steadily until you have 100 grams"},{"text":"Wind it into a clean, even skein"},{"text":"Show it to a buyer for a price"}]
  }'::jsonb),
  -- ===== Savitri: tailoring =====
  ('Practised straight-line stitching on scrap cloth', '{
    "capability_goals": ["Stitching technique","Tailoring basics"],
    "what_will_you_do": "Practise sewing a straight, even line on spare cloth.",
    "why_reasoning": "A straight seam is the foundation of every garment — getting your hands steady on scrap saves wasting good cloth.",
    "how_sub_steps": [{"text":"Draw a line and stitch along it"},{"text":"Keep an even speed on the pedal"},{"text":"Repeat until the seam stays straight"}]
  }'::jsonb),
  ('Cut & stitched a petticoat from measurements', '{
    "capability_goals": ["Garment construction","Measurement & cutting"],
    "what_will_you_do": "Cut and sew a petticoat to a customer''s measurements.",
    "why_reasoning": "A petticoat is simple enough to learn on but real enough to sell — the first garment that turns practice into income.",
    "how_sub_steps": [{"text":"Take waist and length measurements"},{"text":"Cut the panels with a seam allowance"},{"text":"Stitch, add the drawstring and hem"}]
  }'::jsonb),
  ('Sew my first blouse unaided', '{
    "capability_goals": ["Garment construction","Tailoring confidence"],
    "what_will_you_do": "Stitch a full blouse on your own, start to finish.",
    "why_reasoning": "A fitted blouse is the test piece every village tailor is judged on — finishing one alone means you can take paid orders.",
    "how_sub_steps": [{"text":"Cut front, back and sleeves to measurement"},{"text":"Fit the darts and stitch the seams"},{"text":"Finish with hooks and a neat hem"}]
  }'::jsonb),
  -- ===== Savitri: kitchen garden =====
  ('Planted tomato & chilli seedlings', '{
    "capability_goals": ["Crop planting","Kitchen garden"],
    "what_will_you_do": "Plant out tomato and chilli seedlings in your plot.",
    "why_reasoning": "Tomato and chilli sell year-round at the haat — a planted bed now is cash in two months.",
    "how_sub_steps": [{"text":"Prepare the bed with compost"},{"text":"Space the seedlings so they get sun"},{"text":"Water them in well on the first day"}]
  }'::jsonb),
  ('Set up drip watering from the tank', '{
    "capability_goals": ["Irrigation","Kitchen garden"],
    "what_will_you_do": "Run simple drip lines from your water tank to the beds.",
    "why_reasoning": "Drip watering keeps the garden alive through dry weeks with little labour — the difference between a crop and a loss.",
    "how_sub_steps": [{"text":"Lay the main pipe from the tank"},{"text":"Run drip lines along each bed"},{"text":"Check every plant gets a steady drip"}]
  }'::jsonb),
  ('Harvest first batch of greens', '{
    "capability_goals": ["Harvesting","Market selling"],
    "what_will_you_do": "Harvest and bundle your first greens for sale.",
    "why_reasoning": "Fresh greens are the quickest garden crop to cash — your first harvest proves the plot can earn.",
    "how_sub_steps": [{"text":"Pick in the cool early morning"},{"text":"Wash and tie into even bundles"},{"text":"Take them fresh to the haat the same day"}]
  }'::jsonb)
)
UPDATE timeline_steps ts
SET metadata = jsonb_set(
      coalesce(ts.metadata, '{}'::jsonb),
      '{plan}',
      coalesce(ts.metadata->'plan', '{}'::jsonb) || c.plan
    ),
    updated_at = now()
FROM content c
JOIN auth.users u ON u.email IN ('demo-suman@betterat.app', 'demo-savitri@betterat.app')
WHERE ts.user_id = u.id
  AND ts.title = c.title
  AND ts.metadata->'plan'->'capability_goals' IS NULL;

-- ===========================================================================
-- Sailing + nursing personas (kept here so every demo persona's timeline is
-- populated from one place). Markus & Yvonne weave three interests — Dragon
-- sailing, half-marathon running, and (Markus) marine painting; Szanton the
-- dean has one nursing practice step.
-- ===========================================================================
WITH content(title, plan) AS (
  VALUES
  ('Rig baseline & boat prep', '{"capability_goals":["Rig tuning","Boat preparation"],"what_will_you_do":"Set the boat to its baseline rig numbers and check it over.","why_reasoning":"A known baseline is what lets you tell a fast change from a wrong one — without it every tuning tweak is a guess.","how_sub_steps":[{"text":"Set shroud tension to the tuning-guide baseline"},{"text":"Check mast rake and spreader deflection"},{"text":"Inspect foils, sheets and fittings for wear"}]}'::jsonb),
  ('Boatspeed & tuning matrix', '{"capability_goals":["Boatspeed","Tuning matrix"],"what_will_you_do":"Build a matrix of fast settings across the wind range.","why_reasoning":"Racing is decided in the lanes you can''t see — a tested speed matrix means you''re never guessing your setup on the start line.","how_sub_steps":[{"text":"Two-boat line-up across light, medium and heavy"},{"text":"Log rig tension and sail trim against speed"},{"text":"Mark the settings that held a lane"}]}'::jsonb),
  ('Heavy-air downwind speed', '{"capability_goals":["Downwind speed","Heavy-air handling"],"what_will_you_do":"Hold the boat fast and safe downwind in a blow.","why_reasoning":"Most places are lost, not gained, downwind in heavy air — staying upright and pressed is free distance on the fleet.","how_sub_steps":[{"text":"Heat up to build apparent wind"},{"text":"Work the kite and rudder through the puffs"},{"text":"Rehearse the bear-away and gybe under load"}]}'::jsonb),
  ('Mark roundings & crew work', '{"capability_goals":["Mark roundings","Crew coordination"],"what_will_you_do":"Drill clean roundings with the crew moves timed.","why_reasoning":"A boatlength gained at every mark adds up to a place by the finish — and clean roundings keep you out of the pile-up.","how_sub_steps":[{"text":"Call the zone and the rounding early"},{"text":"Time the hoist, drop and trim to the turn"},{"text":"Debrief each rounding for the next one"}]}'::jsonb),
  ('Starts & first-beat lanes', '{"capability_goals":["Starting","Lane management"],"what_will_you_do":"Win the start and hold a clear lane up the first beat.","why_reasoning":"The first two minutes set your whole race — a clean lane off the line is worth more than any tactic later.","how_sub_steps":[{"text":"Time runs to the line at full speed"},{"text":"Pick the favoured end from the line bias"},{"text":"Defend a gap to leeward off the gun"}]}'::jsonb),
  ('Fleet tactics & rules scenarios', '{"capability_goals":["Fleet tactics","Racing rules"],"what_will_you_do":"Work through tactical and rules situations on the water.","why_reasoning":"Knowing the rule cold lets you take the aggressive line with confidence — and avoid the foul that ends a regatta.","how_sub_steps":[{"text":"Run mark-trap and lee-bow scenarios"},{"text":"Quiz the at-mark and crossing rules"},{"text":"Agree the calls so the crew acts as one"}]}'::jsonb),
  ('Dragon Worlds 2027 — regatta prep', '{"capability_goals":["Regatta preparation","Peak campaign"],"what_will_you_do":"Pull the campaign together for the Worlds.","why_reasoning":"A title is won in the months before, not the week of — this is where boat, body and plan all have to peak together.","how_sub_steps":[{"text":"Confirm logistics, measurement and entry"},{"text":"Map a training block to peak on event week"},{"text":"Set series goals with the crew"}]}'::jsonb),
  ('RHKYC · pre-race rigging', '{"capability_goals":["Rig tuning","Pre-race routine"],"what_will_you_do":"Rig and tune the boat at the club before racing.","why_reasoning":"A calm, repeatable rigging routine means you launch on time with the boat right — not scrambling at the dock.","how_sub_steps":[{"text":"Step the mast and set baseline tension"},{"text":"Bend on sails and check controls run free"},{"text":"Launch with time to tune on the water"}]}'::jsonb),
  ('Victoria Harbour · start line bias', '{"capability_goals":["Start-line strategy","Reading the line"],"what_will_you_do":"Read the line bias in Victoria Harbour''s shifty breeze.","why_reasoning":"Harbour breeze bends off the buildings and tide — the favoured end here can swing right up to the gun.","how_sub_steps":[{"text":"Shoot the line for the wind angle"},{"text":"Check current running across the line"},{"text":"Pick a start spot and a fallback"}]}'::jsonb),
  ('Victoria Harbour · upwind drill', '{"capability_goals":["Upwind technique","Boat handling"],"what_will_you_do":"Drill upwind speed and tacks in the harbour chop.","why_reasoning":"Short harbour chop kills a Dragon''s speed if you point too high — the groove here is lower and faster than open water.","how_sub_steps":[{"text":"Find the groove for the chop"},{"text":"Tack on the headers, hold through the lulls"},{"text":"Trim for power, not pinch"}]}'::jsonb),
  ('Aberdeen · sail loft pickup', '{"capability_goals":["Sail care","Equipment prep"],"what_will_you_do":"Collect serviced sails from the Aberdeen loft.","why_reasoning":"Sails come back from service with new shape — picking them up early means you can test them before they matter in a race.","how_sub_steps":[{"text":"Check the loft''s recut against the order"},{"text":"Inspect for repairs and batten fit"},{"text":"Log which sails are race-ready"}]}'::jsonb),
  ('Middle Island channel · downwind', '{"capability_goals":["Downwind speed","Local knowledge"],"what_will_you_do":"Practise the downwind run through Middle Island channel.","why_reasoning":"The channel funnels breeze and tide — knowing where the pressure runs is local gold on race day.","how_sub_steps":[{"text":"Find the pressure line down the channel"},{"text":"Time the gybe to the tide gate"},{"text":"Note the layline into the bottom mark"}]}'::jsonb),
  ('RHKYC · debrief w/ coach', '{"capability_goals":["Race debrief","Coaching feedback"],"what_will_you_do":"Review the day''s racing with the coach.","why_reasoning":"The race you just sailed is the best lesson you''ll get — a structured debrief turns mistakes into next week''s gains.","how_sub_steps":[{"text":"Walk through each start and beat"},{"text":"Pull two keeps and two fixes"},{"text":"Set one focus for next training"}]}'::jsonb),
  ('Long run: 18 km easy', '{"capability_goals":["Aerobic base","Endurance"],"what_will_you_do":"Run 18 km at an easy, conversational pace.","why_reasoning":"The long easy run builds the engine everything else sits on — going too hard here just steals from the quality days.","how_sub_steps":[{"text":"Hold an easy, conversational pace"},{"text":"Fuel and hydrate on the move"},{"text":"Finish feeling you could go further"}]}'::jsonb),
  ('Tempo intervals 6×1 km', '{"capability_goals":["Threshold pace","Interval training"],"what_will_you_do":"Run 6×1 km at threshold with short recoveries.","why_reasoning":"Threshold work lifts the pace you can hold for the half — the most race-specific session in the block.","how_sub_steps":[{"text":"Warm up thoroughly first"},{"text":"Hold an even, controlled threshold pace"},{"text":"Keep recoveries short and jogging"}]}'::jsonb),
  ('Taper week before race', '{"capability_goals":["Race taper","Recovery"],"what_will_you_do":"Cut volume and sharpen for race day.","why_reasoning":"Fitness is already banked — the taper turns fatigue into freshness, and overdoing it now only costs speed.","how_sub_steps":[{"text":"Drop weekly volume, keep some intensity"},{"text":"Sleep and eat well all week"},{"text":"Rehearse the race-morning routine"}]}'::jsonb),
  ('Base run 8 km', '{"capability_goals":["Aerobic base","Easy mileage"],"what_will_you_do":"Run an easy 8 km to build base mileage.","why_reasoning":"Steady easy miles are what make the hard sessions possible — consistency here beats any single big day.","how_sub_steps":[{"text":"Keep it relaxed and aerobic"},{"text":"Run on soft ground if you can"},{"text":"Note how the legs feel after"}]}'::jsonb),
  ('Hill repeats at Bowen Road', '{"capability_goals":["Hill strength","Power endurance"],"what_will_you_do":"Run hill repeats on Bowen Road.","why_reasoning":"Hills build strength and form with less impact than flat speed work — and Bowen Road''s steady grade is ideal for it.","how_sub_steps":[{"text":"Warm up to the hill"},{"text":"Drive the arms and keep form on each rep"},{"text":"Jog down easy to recover"}]}'::jsonb),
  ('Tempo run at the track', '{"capability_goals":["Threshold pace","Tempo"],"what_will_you_do":"Run a sustained tempo effort at the track.","why_reasoning":"The track''s even surface lets you lock into goal pace and feel it in the body — pacing discipline you''ll need on race day.","how_sub_steps":[{"text":"Warm up with strides"},{"text":"Lock into a steady, hard-but-controlled pace"},{"text":"Hold form as it gets tough"}]}'::jsonb),
  ('Register for the half-marathon', '{"capability_goals":["Race commitment","Goal setting"],"what_will_you_do":"Enter the half-marathon to lock in the goal.","why_reasoning":"Paying the entry turns a vague plan into a date on the calendar — commitment is what makes the training stick.","how_sub_steps":[{"text":"Pick the race and date"},{"text":"Complete the entry and payment"},{"text":"Set the goal time to train toward"}]}'::jsonb),
  ('Block in the junk-boat composition', '{"capability_goals":["Composition","Blocking in"],"what_will_you_do":"Block in the big shapes of the junk-boat scene.","why_reasoning":"Getting the composition and big masses right first is what holds a painting together — detail can''t rescue a weak layout.","how_sub_steps":[{"text":"Place the horizon and the junk''s hull"},{"text":"Block the main light and dark masses"},{"text":"Check the balance before any detail"}]}'::jsonb),
  ('Value study: harbour greys', '{"capability_goals":["Value study","Tonal control"],"what_will_you_do":"Paint a small value study of the harbour''s greys.","why_reasoning":"Reading values right is what makes a grey harbour feel like light and air — get the tones and the colour almost looks after itself.","how_sub_steps":[{"text":"Limit to a few greys, no colour"},{"text":"Match each value against the scene"},{"text":"Keep the lightest light for the focal point"}]}'::jsonb),
  ('Glaze pass on water reflections', '{"capability_goals":["Glazing","Rendering water"],"what_will_you_do":"Add a glaze pass to deepen the water reflections.","why_reasoning":"Thin transparent glazes give water its depth and shimmer — something you can''t get in one opaque pass.","how_sub_steps":[{"text":"Let the underpainting dry fully"},{"text":"Lay a thin transparent glaze over the water"},{"text":"Lift highlights back for sparkle"}]}'::jsonb),
  ('Pre-shift huddle: review the new lasix protocol', '{"capability_goals":["Medication safety","Protocol review"],"what_will_you_do":"Brief the team on the updated furosemide (lasix) protocol before shift.","why_reasoning":"A 60-second huddle on a changed protocol prevents the dosing errors that happen when half the team is working from the old one.","how_sub_steps":[{"text":"Walk through what changed in the protocol"},{"text":"Confirm dose, route and monitoring"},{"text":"Check who needs sign-off and when"}]}'::jsonb)
)
UPDATE timeline_steps ts
SET metadata = jsonb_set(
      coalesce(ts.metadata, '{}'::jsonb),
      '{plan}',
      coalesce(ts.metadata->'plan', '{}'::jsonb) || c.plan
    ),
    updated_at = now()
FROM content c
JOIN auth.users u ON u.email IN (
  'demo-markus@regattaflow.app',
  'demo-yvonne@regattaflow.app',
  'sarah.szanton@jhu-dean-demo.edu'
)
WHERE ts.user_id = u.id
  AND ts.title = c.title
  AND ts.metadata->'plan'->'capability_goals' IS NULL;

COMMIT;
