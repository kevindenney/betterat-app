#!/usr/bin/env node

/**
 * Community Feed Demo Data Seed Script
 *
 * Creates sample community posts, topic tag associations, condition tags,
 * and comments for the Victoria Harbour venue so the venue tab has
 * realistic-looking content.
 *
 * Run: node scripts/seed-community-feed-demo.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// =====================================================
// CONSTANTS
// =====================================================

const VENUE_ID = 'hong-kong-victoria-harbor';

// Profile IDs (from existing demo users)
const AUTHORS = {
  demoSailor: 'f6f6a7f6-7755-412b-a87b-3a7617721cc7',
  clubAdmin: '8a910b64-e4ff-43e7-950c-6d7d92ec2bec',
  demoCoach: 'b0539d0f-11b3-4119-8e18-57d142bb7247',
  kyle: '51241049-02ed-4e31-b8c6-39af7c9d4d50',
  kyleE: 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
  testUser: '4df47a13-d2a8-4acb-a812-3f8488c9034e',
};

// Racing area IDs
const AREAS = {
  victoriaHarbour: '3fb021f2-8654-4dd2-869e-dbda5629f085',
  portShelter: '753d26f9-e58c-41f4-bdad-7fbdfcc7be61',
  lammaChannel: '3cbb9164-a35b-4708-bfb7-cbdfd84fb1a2',
};

// Post IDs (deterministic for idempotency)
const POST_IDS = {
  p1: 'a1000000-0000-0000-0000-000000000001',
  p2: 'a1000000-0000-0000-0000-000000000002',
  p3: 'a1000000-0000-0000-0000-000000000003',
  p4: 'a1000000-0000-0000-0000-000000000004',
  p5: 'a1000000-0000-0000-0000-000000000005',
  p6: 'a1000000-0000-0000-0000-000000000006',
  p7: 'a1000000-0000-0000-0000-000000000007',
  p8: 'a1000000-0000-0000-0000-000000000008',
  p9: 'a1000000-0000-0000-0000-000000000009',
  p10: 'a1000000-0000-0000-0000-000000000010',
  p11: 'a1000000-0000-0000-0000-000000000011',
  p12: 'a1000000-0000-0000-0000-000000000012',
};

const COMMENT_IDS = {
  c1: 'c1000000-0000-0000-0000-000000000001',
  c2: 'c1000000-0000-0000-0000-000000000002',
  c3: 'c1000000-0000-0000-0000-000000000003',
  c4: 'c1000000-0000-0000-0000-000000000004',
  c5: 'c1000000-0000-0000-0000-000000000005',
  c6: 'c1000000-0000-0000-0000-000000000006',
  c7: 'c1000000-0000-0000-0000-000000000007',
  c8: 'c1000000-0000-0000-0000-000000000008',
  c9: 'c1000000-0000-0000-0000-000000000009',
  c10: 'c1000000-0000-0000-0000-000000000010',
  c11: 'c1000000-0000-0000-0000-000000000011',
  c12: 'c1000000-0000-0000-0000-000000000012',
  c13: 'c1000000-0000-0000-0000-000000000013',
  c14: 'c1000000-0000-0000-0000-000000000014',
  c15: 'c1000000-0000-0000-0000-000000000015',
};

// =====================================================
// HELPERS
// =====================================================

function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// =====================================================
// SEED DATA
// =====================================================

const POSTS = [
  {
    id: POST_IDS.p1,
    venue_id: VENUE_ID,
    author_id: AUTHORS.demoSailor,
    title: 'Current patterns near Green Island — local knowledge',
    body: 'The ebb current near Green Island creates a significant back-eddy on the western side that many visiting sailors miss. During spring tides, you can gain 200+ metres by staying within 100m of the island on port tack. The effect is strongest 2-3 hours after high water. I have sailed here for 15 years and this is consistently one of the biggest tactical advantages in Victoria Harbour racing.',
    post_type: 'tip',
    category: 'tactics',
    is_public: true,
    poi_id: AREAS.victoriaHarbour,
    location_lat: 22.2855,
    location_lng: 114.129,
    location_label: 'Green Island',
    upvotes: 24,
    downvotes: 1,
    comment_count: 8,
    view_count: 312,
    pinned: true,
    is_resolved: false,
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
    last_activity_at: hoursAgo(4),
  },
  {
    id: POST_IDS.p2,
    venue_id: VENUE_ID,
    author_id: AUTHORS.kyle,
    title: 'Best sail configuration for 15-20kt ENE in the harbour?',
    body: 'Racing my J/80 this weekend and the forecast shows 15-20kt ENE with gusts to 25. The race area is between Kellett Island and Green Island. Should I go with the #3 jib or try the blade? Any local tips on pointing angles in these conditions?',
    post_type: 'question',
    category: 'gear',
    is_public: true,
    poi_id: AREAS.victoriaHarbour,
    location_lat: null,
    location_lng: null,
    location_label: null,
    upvotes: 18,
    downvotes: 0,
    comment_count: 6,
    view_count: 187,
    pinned: false,
    is_resolved: true,
    created_at: daysAgo(5),
    updated_at: daysAgo(4),
    last_activity_at: daysAgo(2),
  },
  {
    id: POST_IDS.p3,
    venue_id: VENUE_ID,
    author_id: AUTHORS.demoCoach,
    title: 'Post-race conditions report: Wednesday evening series',
    body: 'Wind: 8-12kt from the East, shifting NE by the 3rd race. Sea state: Choppy 0.5m swell from ferry wash near the start line. Current: Weak flood, maybe 0.3kt pushing NW. The right side was favoured in races 1 and 2, but the shift made the left pay in race 3. Watch out for the Star Ferry schedule — the wash is brutal near the pin end.',
    post_type: 'report',
    category: 'conditions',
    is_public: true,
    poi_id: AREAS.victoriaHarbour,
    location_lat: 22.293,
    location_lng: 114.168,
    location_label: 'Kellett Island start area',
    upvotes: 15,
    downvotes: 0,
    comment_count: 4,
    view_count: 98,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    last_activity_at: hoursAgo(8),
  },
  {
    id: POST_IDS.p4,
    venue_id: VENUE_ID,
    author_id: AUTHORS.clubAdmin,
    title: 'Unlit construction barge near Stonecutters Bridge — heads up!',
    body: 'Spotted a large unlit construction barge anchored approximately 200m south of Stonecutters Bridge. It is sitting right at the edge of the fairway and is very hard to see after dark. Reported to Marine Department but no response yet. Keep well clear, especially during evening races or practice sessions.',
    post_type: 'safety_alert',
    category: 'safety',
    is_public: true,
    poi_id: null,
    location_lat: 22.321,
    location_lng: 114.147,
    location_label: 'Stonecutters Bridge',
    upvotes: 31,
    downvotes: 0,
    comment_count: 5,
    view_count: 245,
    pinned: false,
    is_resolved: false,
    created_at: hoursAgo(12),
    updated_at: hoursAgo(10),
    last_activity_at: hoursAgo(3),
  },
  {
    id: POST_IDS.p5,
    venue_id: VENUE_ID,
    author_id: AUTHORS.kyleE,
    title: 'Anyone sailing the Around the Island Race in February?',
    body: 'Looking for crew or co-skipper opportunities for the Around the Island Race. I have done it twice on a Beneteau 40.7 and once on a TP52. Happy to crew or co-skip on anything 35ft+. Also interested in hearing strategies for the Lamma Channel section — that is where I always lose time.',
    post_type: 'discussion',
    category: 'racing',
    is_public: true,
    poi_id: AREAS.lammaChannel,
    location_lat: null,
    location_lng: null,
    location_label: null,
    upvotes: 12,
    downvotes: 0,
    comment_count: 7,
    view_count: 156,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    last_activity_at: hoursAgo(6),
  },
  {
    id: POST_IDS.p6,
    venue_id: VENUE_ID,
    author_id: AUTHORS.demoCoach,
    title: 'Tide timing cheat sheet for Port Shelter racing',
    body: 'After coaching here for 8 seasons, here is my simplified tide timing guide for Port Shelter: The flood starts about 1hr after the Quarry Bay tide table HW. Best current advantage is along the eastern shore heading north. The ebb is weaker but watch the outflow near Hebe Haven entrance — it can push you off the layline to the windward mark.',
    post_type: 'tip',
    category: 'conditions',
    is_public: true,
    poi_id: AREAS.portShelter,
    location_lat: null,
    location_lng: null,
    location_label: null,
    upvotes: 20,
    downvotes: 0,
    comment_count: 3,
    view_count: 134,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
    last_activity_at: daysAgo(3),
  },
  {
    id: POST_IDS.p7,
    venue_id: VENUE_ID,
    author_id: AUTHORS.testUser,
    title: 'Where to get emergency rigging repairs in Causeway Bay?',
    body: 'My forestay toggle is showing cracks and I need it replaced before Saturday. Anyone know a rigger in the Causeway Bay / RHKYC area who can turn this around in 2-3 days? Last time I went to the yard in Aberdeen but that took 2 weeks.',
    post_type: 'question',
    category: 'services',
    is_public: true,
    poi_id: null,
    location_lat: null,
    location_lng: null,
    location_label: null,
    upvotes: 9,
    downvotes: 0,
    comment_count: 3,
    view_count: 67,
    pinned: false,
    is_resolved: false,
    created_at: hoursAgo(18),
    updated_at: hoursAgo(16),
    last_activity_at: hoursAgo(5),
  },
  {
    id: POST_IDS.p8,
    venue_id: VENUE_ID,
    author_id: AUTHORS.demoSailor,
    title: 'NE monsoon wind bend around ICC Tower — measured data',
    body: 'I have been logging wind data from my masthead unit near ICC Tower over the past month. The NE monsoon flow consistently bends 15-25 degrees to the east as it funnels through the gap between ICC and the West Kowloon reclamation. Wind speed accelerates 3-5kt in the channel compared to readings at RHKYC.',
    post_type: 'report',
    category: 'conditions',
    is_public: true,
    poi_id: AREAS.victoriaHarbour,
    location_lat: 22.3035,
    location_lng: 114.16,
    location_label: 'ICC Tower channel',
    upvotes: 27,
    downvotes: 2,
    comment_count: 5,
    view_count: 203,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(4),
    updated_at: daysAgo(3),
    last_activity_at: daysAgo(1),
  },
  {
    id: POST_IDS.p9,
    venue_id: VENUE_ID,
    author_id: AUTHORS.clubAdmin,
    title: 'RHKYC visitor berthing — book early for regatta weekends',
    body: 'For anyone planning to visit RHKYC for the Spring Regatta, the visitor berths fill up fast. Book at least 3 weeks ahead through the club office. There are also temporary moorings available in the typhoon shelter, but you need to register with Marine Department. Pro tip: the fuel dock queue is shortest before 0800.',
    post_type: 'tip',
    category: 'general',
    is_public: true,
    poi_id: null,
    location_lat: 22.2835,
    location_lng: 114.188,
    location_label: 'RHKYC Kellett Island',
    upvotes: 11,
    downvotes: 0,
    comment_count: 2,
    view_count: 89,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(8),
    updated_at: daysAgo(7),
    last_activity_at: daysAgo(5),
  },
  {
    id: POST_IDS.p10,
    venue_id: VENUE_ID,
    author_id: AUTHORS.kyle,
    title: 'Summer afternoon sea breeze — how reliable is it?',
    body: 'New to HK sailing and trying to understand the summer thermal patterns. I have heard there is a reliable SSE sea breeze that fills in around 1400 on sunny days. How consistent is this? Does it work better on the harbour side or out in Port Shelter? And what kills it — cloud cover, or the urban heat island effect?',
    post_type: 'discussion',
    category: 'conditions',
    is_public: true,
    poi_id: null,
    location_lat: null,
    location_lng: null,
    location_label: null,
    upvotes: 14,
    downvotes: 0,
    comment_count: 5,
    view_count: 142,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(10),
    updated_at: daysAgo(9),
    last_activity_at: daysAgo(4),
  },
  {
    id: POST_IDS.p11,
    venue_id: VENUE_ID,
    author_id: AUTHORS.demoCoach,
    title: 'Strong cross-current at Lei Yue Mun during spring tides',
    body: 'Reminder for anyone racing near Lei Yue Mun: the spring tide current can exceed 3 knots through the narrows. We had two boats in our training group get swept into the commercial shipping lane last weekend. The current is strongest 1 hour before and after max ebb. Recommend staying well north of the channel markers.',
    post_type: 'safety_alert',
    category: 'safety',
    is_public: true,
    poi_id: null,
    location_lat: 22.279,
    location_lng: 114.2345,
    location_label: 'Lei Yue Mun Narrows',
    upvotes: 19,
    downvotes: 0,
    comment_count: 3,
    view_count: 178,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(14),
    updated_at: daysAgo(13),
    last_activity_at: daysAgo(10),
  },
  {
    id: POST_IDS.p12,
    venue_id: VENUE_ID,
    author_id: AUTHORS.kyleE,
    title: 'Windward mark approach — favour the Kowloon side in easterlies',
    body: 'When the breeze is East to ENE, the Kowloon shore delivers a persistent lift on starboard tack approaching the windward mark. The buildings create a channeling effect that bends the wind about 10 degrees to the left. Works best in 10-18kt. Above 20kt the gradient wind dominates and the shore effect disappears.',
    post_type: 'tip',
    category: 'tactics',
    is_public: true,
    poi_id: AREAS.victoriaHarbour,
    location_lat: 22.305,
    location_lng: 114.175,
    location_label: 'Kowloon shore approach',
    upvotes: 16,
    downvotes: 1,
    comment_count: 4,
    view_count: 121,
    pinned: false,
    is_resolved: false,
    created_at: daysAgo(7),
    updated_at: daysAgo(6),
    last_activity_at: daysAgo(3),
  },
];

// =====================================================
// COMMENTS
// =====================================================

const COMMENTS = [
  // Post 1 comments (pinned tip — 8 comments, we seed a few)
  {
    id: COMMENT_IDS.c1,
    discussion_id: POST_IDS.p1,
    parent_id: null,
    author_id: AUTHORS.demoCoach,
    body: 'Can confirm this. I coach junior sailors here and we use the Green Island eddy as a teaching point for current awareness. The effect is even more pronounced during the first spring tide of each lunar cycle.',
    upvotes: 7,
    downvotes: 0,
    created_at: daysAgo(2.5),
    updated_at: daysAgo(2.5),
  },
  {
    id: COMMENT_IDS.c2,
    discussion_id: POST_IDS.p1,
    parent_id: null,
    author_id: AUTHORS.kyle,
    body: 'Great tip! I sailed past there last Sunday and noticed the water was visibly different on the lee side. Would you say this works for dinghies as well, or mainly keelboats?',
    upvotes: 3,
    downvotes: 0,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
  {
    id: COMMENT_IDS.c3,
    discussion_id: POST_IDS.p1,
    parent_id: COMMENT_IDS.c2,
    author_id: AUTHORS.demoSailor,
    body: 'Works for both, but dinghies benefit even more since they can get closer to the island. Keelboats need to watch the depth on the western shelf — it shoals to about 3m.',
    upvotes: 5,
    downvotes: 0,
    created_at: daysAgo(1.5),
    updated_at: daysAgo(1.5),
  },

  // Post 2 comments (sail config question)
  {
    id: COMMENT_IDS.c4,
    discussion_id: POST_IDS.p2,
    parent_id: null,
    author_id: AUTHORS.demoSailor,
    body: '#3 jib all the way in those conditions. The blade is fast in flat water but Victoria Harbour chop will kill your VMG. Also, ease the traveller down and foot for speed — the waves make pointing very expensive.',
    upvotes: 10,
    downvotes: 0,
    created_at: daysAgo(4.5),
    updated_at: daysAgo(4.5),
  },
  {
    id: COMMENT_IDS.c5,
    discussion_id: POST_IDS.p2,
    parent_id: null,
    author_id: AUTHORS.demoCoach,
    body: 'Agree with the #3. One more tip: in 15-20 ENE the harbour gets very shifty near Wan Chai. Keep your head out of the boat and be ready to tack on the lifts — the shifts can be 15-20 degrees.',
    upvotes: 8,
    downvotes: 0,
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
  },

  // Post 4 comments (safety alert)
  {
    id: COMMENT_IDS.c6,
    discussion_id: POST_IDS.p4,
    parent_id: null,
    author_id: AUTHORS.kyle,
    body: 'Thanks for the heads up. Can you share the approximate GPS coordinates? I want to mark it on my chart plotter before Saturday.',
    upvotes: 4,
    downvotes: 0,
    created_at: hoursAgo(10),
    updated_at: hoursAgo(10),
  },
  {
    id: COMMENT_IDS.c7,
    discussion_id: POST_IDS.p4,
    parent_id: COMMENT_IDS.c6,
    author_id: AUTHORS.clubAdmin,
    body: 'Approximately 22.321N, 114.147E. I have marked it on the post map pin. Marine Dept reference number is CB-2026-0142 if anyone wants to follow up.',
    upvotes: 6,
    downvotes: 0,
    created_at: hoursAgo(9),
    updated_at: hoursAgo(9),
  },

  // Post 5 comments (Around Island Race discussion)
  {
    id: COMMENT_IDS.c8,
    discussion_id: POST_IDS.p5,
    parent_id: null,
    author_id: AUTHORS.demoSailor,
    body: 'The Lamma Channel is all about current timing. If you can hit the channel with the last of the flood, you get a free ride south. Miss the timing and you are fighting 2+ knots of ebb the whole way. Check the tide tables for your target time window.',
    upvotes: 9,
    downvotes: 0,
    created_at: daysAgo(1.5),
    updated_at: daysAgo(1.5),
  },
  {
    id: COMMENT_IDS.c9,
    discussion_id: POST_IDS.p5,
    parent_id: null,
    author_id: AUTHORS.testUser,
    body: 'We need crew on our First 40.7. DM me if interested — we are a mixed experience crew and very welcoming to new joiners.',
    upvotes: 5,
    downvotes: 0,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },

  // Post 7 comments (rigging repairs question)
  {
    id: COMMENT_IDS.c10,
    discussion_id: POST_IDS.p7,
    parent_id: null,
    author_id: AUTHORS.clubAdmin,
    body: 'Try Cheung Kee Marine on Shelter Street — they did my spreader bracket in 48 hours. Tell them RHKYC sent you. Phone: 2572-XXXX.',
    upvotes: 6,
    downvotes: 0,
    created_at: hoursAgo(14),
    updated_at: hoursAgo(14),
  },
  {
    id: COMMENT_IDS.c11,
    discussion_id: POST_IDS.p7,
    parent_id: null,
    author_id: AUTHORS.demoSailor,
    body: 'Seconding Cheung Kee. Also, if it is just the toggle, check with the RHKYC bosun — they sometimes have spares in the workshop. Saved me once before a race day.',
    upvotes: 4,
    downvotes: 0,
    created_at: hoursAgo(12),
    updated_at: hoursAgo(12),
  },

  // Post 8 comments (wind data report)
  {
    id: COMMENT_IDS.c12,
    discussion_id: POST_IDS.p8,
    parent_id: null,
    author_id: AUTHORS.demoCoach,
    body: 'Fantastic data. Can you share the raw logs? I would love to overlay this with our coaching GPS tracks to correlate boat speed differences in the ICC channel vs open harbour.',
    upvotes: 5,
    downvotes: 0,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  },
  {
    id: COMMENT_IDS.c13,
    discussion_id: POST_IDS.p8,
    parent_id: COMMENT_IDS.c12,
    author_id: AUTHORS.demoSailor,
    body: 'Sure — I will export the CSV from my Expedition log and post a link. The most interesting finding is how consistently the acceleration zone sits at the same coordinates regardless of gradient wind speed.',
    upvotes: 3,
    downvotes: 0,
    created_at: daysAgo(2.5),
    updated_at: daysAgo(2.5),
  },

  // Post 10 comments (sea breeze discussion)
  {
    id: COMMENT_IDS.c14,
    discussion_id: POST_IDS.p10,
    parent_id: null,
    author_id: AUTHORS.demoCoach,
    body: 'The sea breeze is very reliable June through September on clear days. It typically fills from SSE around 1330-1430. Cloud cover kills it — you need direct solar heating on the land. The harbour is more reliable than Port Shelter because the tall buildings amplify the thermal effect.',
    upvotes: 8,
    downvotes: 0,
    created_at: daysAgo(9),
    updated_at: daysAgo(9),
  },
  {
    id: COMMENT_IDS.c15,
    discussion_id: POST_IDS.p10,
    parent_id: null,
    author_id: AUTHORS.demoSailor,
    body: 'One thing to add — the sea breeze fights the prevailing SW monsoon flow in summer. When both are present you get an oscillating pattern that can be very tactical. Watch for the flags on the Wan Chai waterfront for real-time clues.',
    upvotes: 6,
    downvotes: 0,
    created_at: daysAgo(8),
    updated_at: daysAgo(8),
  },
];

// =====================================================
// TOPIC TAG ASSOCIATIONS
// =====================================================

// Tag IDs from the database
const TAGS = {
  tactics: 'd75a07a3-9a28-4ce0-be48-34b469ac2100',
  currents: 'b8df6a55-cd63-48e6-8b3e-5191254109db',
  safety: '6e8b7a1d-a0a1-44e7-980a-077497a456de',
  marks: '3c664690-be89-4b14-8b21-5fc2edb910eb',
  logistics: '6241bba0-ca36-4e9b-8fae-66933fe71fd9',
  weather: '0ecdaa92-93b4-4e0f-ad3b-66d9e7fc3e6b',
  rules: 'd3a55fe4-ae21-4bda-b17f-8f81e21070e9',
  gear: '4e37c26f-0ccc-4d58-b649-4833ed04aabf',
};

const TAG_ASSOCIATIONS = [
  // Post 1: tip about currents + tactics
  { discussion_id: POST_IDS.p1, tag_id: TAGS.tactics },
  { discussion_id: POST_IDS.p1, tag_id: TAGS.currents },
  // Post 2: sail config question — gear
  { discussion_id: POST_IDS.p2, tag_id: TAGS.gear },
  { discussion_id: POST_IDS.p2, tag_id: TAGS.tactics },
  // Post 3: conditions report — weather + currents
  { discussion_id: POST_IDS.p3, tag_id: TAGS.weather },
  { discussion_id: POST_IDS.p3, tag_id: TAGS.currents },
  // Post 4: safety alert
  { discussion_id: POST_IDS.p4, tag_id: TAGS.safety },
  // Post 5: Around Island Race — tactics
  { discussion_id: POST_IDS.p5, tag_id: TAGS.tactics },
  { discussion_id: POST_IDS.p5, tag_id: TAGS.currents },
  // Post 6: tide timing — currents + weather
  { discussion_id: POST_IDS.p6, tag_id: TAGS.currents },
  { discussion_id: POST_IDS.p6, tag_id: TAGS.weather },
  // Post 7: rigging repairs — gear
  { discussion_id: POST_IDS.p7, tag_id: TAGS.gear },
  // Post 8: wind data — weather + tactics
  { discussion_id: POST_IDS.p8, tag_id: TAGS.weather },
  { discussion_id: POST_IDS.p8, tag_id: TAGS.tactics },
  // Post 9: visitor berthing — logistics
  { discussion_id: POST_IDS.p9, tag_id: TAGS.logistics },
  // Post 10: sea breeze — weather
  { discussion_id: POST_IDS.p10, tag_id: TAGS.weather },
  // Post 11: cross-current safety — safety + currents
  { discussion_id: POST_IDS.p11, tag_id: TAGS.safety },
  { discussion_id: POST_IDS.p11, tag_id: TAGS.currents },
  // Post 12: windward mark tactics
  { discussion_id: POST_IDS.p12, tag_id: TAGS.tactics },
  { discussion_id: POST_IDS.p12, tag_id: TAGS.weather },
];

// =====================================================
// CONDITION TAGS
// =====================================================

const CONDITION_TAGS = [
  // Post 1: applies during ebb tide
  {
    discussion_id: POST_IDS.p1,
    tide_phase: 'ebb',
    wind_speed_min: 5,
    wind_speed_max: 25,
    label: 'Ebb tide, any wind',
  },
  // Post 2: ENE 15-20kt
  {
    discussion_id: POST_IDS.p2,
    wind_direction_min: 50,
    wind_direction_max: 80,
    wind_speed_min: 15,
    wind_speed_max: 25,
    label: 'ENE 15-25kt',
  },
  // Post 3: E 8-12kt, flood
  {
    discussion_id: POST_IDS.p3,
    wind_direction_min: 80,
    wind_direction_max: 100,
    wind_speed_min: 8,
    wind_speed_max: 12,
    tide_phase: 'flood',
    label: 'E 8-12kt, flood tide',
  },
  // Post 6: flood tide for Port Shelter
  {
    discussion_id: POST_IDS.p6,
    tide_phase: 'flood',
    label: 'Flood tide timing',
  },
  // Post 8: NE monsoon
  {
    discussion_id: POST_IDS.p8,
    wind_direction_min: 30,
    wind_direction_max: 60,
    wind_speed_min: 10,
    wind_speed_max: 25,
    season: 'winter',
    label: 'NE monsoon, 10-25kt',
  },
  // Post 11: spring tides
  {
    discussion_id: POST_IDS.p11,
    tide_phase: 'ebb',
    current_speed_min: 2,
    current_speed_max: 4,
    label: 'Spring ebb, >2kt current',
  },
  // Post 12: E to ENE
  {
    discussion_id: POST_IDS.p12,
    wind_direction_min: 70,
    wind_direction_max: 100,
    wind_speed_min: 10,
    wind_speed_max: 18,
    label: 'E-ENE 10-18kt',
  },
];

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('Seeding community feed demo data for Victoria Harbour...\n');

  // 1. Upsert posts
  console.log(`Inserting ${POSTS.length} posts...`);
  const { error: postsError } = await supabase
    .from('venue_discussions')
    .upsert(POSTS, { onConflict: 'id' });

  if (postsError) {
    console.error('Error inserting posts:', postsError.message);
    process.exit(1);
  }
  console.log(`  ${POSTS.length} posts inserted\n`);

  // 2. Upsert comments
  console.log(`Inserting ${COMMENTS.length} comments...`);
  const { error: commentsError } = await supabase
    .from('venue_discussion_comments')
    .upsert(COMMENTS, { onConflict: 'id' });

  if (commentsError) {
    console.error('Error inserting comments:', commentsError.message);
    process.exit(1);
  }
  console.log(`  ${COMMENTS.length} comments inserted\n`);

  // 3. Insert topic tag associations (delete first to be idempotent)
  const postIds = Object.values(POST_IDS);
  console.log(`Setting topic tags for ${postIds.length} posts...`);
  const { error: deleteTagsError } = await supabase
    .from('venue_discussion_tags')
    .delete()
    .in('discussion_id', postIds);

  if (deleteTagsError) {
    console.error('Error clearing old tags:', deleteTagsError.message);
  }

  const { error: tagsError } = await supabase
    .from('venue_discussion_tags')
    .insert(TAG_ASSOCIATIONS);

  if (tagsError) {
    console.error('Error inserting tags:', tagsError.message);
  } else {
    console.log(`  ${TAG_ASSOCIATIONS.length} tag associations created\n`);
  }

  // 4. Insert condition tags (delete first to be idempotent)
  console.log(`Setting condition tags...`);
  const { error: deleteCondError } = await supabase
    .from('venue_post_condition_tags')
    .delete()
    .in('discussion_id', postIds);

  if (deleteCondError) {
    console.error('Error clearing old condition tags:', deleteCondError.message);
  }

  const { error: condError } = await supabase
    .from('venue_post_condition_tags')
    .insert(CONDITION_TAGS);

  if (condError) {
    console.error('Error inserting condition tags:', condError.message);
  } else {
    console.log(`  ${CONDITION_TAGS.length} condition tags created\n`);
  }

  console.log('Done! Community feed is now populated with sample data.');
  console.log('Open the Venue tab to see the posts in Overview, Feed, and Map segments.');
}

main().catch(console.error);
