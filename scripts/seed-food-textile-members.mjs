/**
 * Seed real women-member rows for the two PRADAN livelihood orgs that shipped
 * with blueprints but no members, so the public org showcase
 * (app/org/[slug].web.tsx) shows a real "N women running their own business"
 * count instead of 0.
 *
 * - PRADAN — Ranchi Food Hub  (food-processing)   → pickle / spice / snack makers
 * - PRADAN — Hazaribagh Textiles (textile-weaving) → handloom / tussar weavers
 *
 * Creates auth users via the admin API (the safe, established path — same as
 * seed-india-demo.ts), upserts a profile, and adds an ACTIVE non-staff
 * membership. Idempotent: re-running matches existing accounts by email.
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD.
 *   node scripts/seed-food-textile-members.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_PASSWORD || 'BetterAtDemo!2026';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORGS = [
  {
    label: 'PRADAN — Ranchi Food Hub',
    orgId: 'a1b2c3d4-1111-4000-8000-000000000001',
    emailTag: 'food',
    // Public showcase reads metadata.is_demo to stamp a "Demo data" badge and
    // metadata.public_evidence_count to drive the "wins logged" stat.
    evidenceCount: 19,
    women: [
      'Sunita Devi',
      'Lakshmi Mahto',
      'Rekha Kumari',
      'Anita Oraon',
      'Pramila Devi',
      'Sarita Munda',
      'Geeta Kumari',
    ],
  },
  {
    label: 'PRADAN — Hazaribagh Textiles',
    orgId: 'a1b2c3d4-2222-4000-8000-000000000002',
    emailTag: 'textile',
    evidenceCount: 14,
    women: [
      'Manju Devi',
      'Kavita Kumari',
      'Sushma Oraon',
      'Renu Devi',
      'Pushpa Mahto',
      'Sangita Kumari',
    ],
  },
];

function emailFor(tag, fullName) {
  const slug = fullName.toLowerCase().replace(/[^a-z]+/g, '-');
  return `demo-${tag}-${slug}@betterat.app`;
}

async function existingUserIdByEmail(email) {
  // listUsers is paginated; the demo project is small enough that page 1 covers
  // our re-run lookups, but page through to be safe.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function run() {
  for (const org of ORGS) {
    console.log(`\n=== ${org.label} (${org.orgId}) ===`);

    // Stamp the org as demo data so the public showcase labels it honestly.
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('metadata')
      .eq('id', org.orgId)
      .maybeSingle();
    const nextMeta = {
      ...(orgRow?.metadata ?? {}),
      is_demo: true,
      public_evidence_count: org.evidenceCount,
    };
    const { error: metaErr } = await supabase
      .from('organizations')
      .update({ metadata: nextMeta })
      .eq('id', org.orgId);
    if (metaErr) console.warn(`  ⚠️  metadata:`, metaErr.message);
    else console.log(`  🏷️  is_demo=true, public_evidence_count=${org.evidenceCount}`);

    for (const fullName of org.women) {
      const email = emailFor(org.emailTag, fullName);

      let userId = await existingUserIdByEmail(email);
      if (userId) {
        console.log(`  ♻️  ${fullName} (${email}) exists: ${userId}`);
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, name: fullName, role: 'member' },
        });
        if (createErr || !created?.user) {
          console.error(`  ❌ create ${email}:`, createErr?.message);
          continue;
        }
        userId = created.user.id;
        console.log(`  ✅ created ${fullName}: ${userId}`);
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, email, full_name: fullName }, { onConflict: 'id' });
      if (profileErr) console.warn(`  ⚠️  profile ${fullName}:`, profileErr.message);

      const { error: memErr } = await supabase.from('organization_memberships').upsert(
        {
          organization_id: org.orgId,
          user_id: userId,
          role: 'member',
          status: 'active',
          membership_status: 'active',
        },
        { onConflict: 'organization_id,user_id' },
      );
      if (memErr) console.warn(`  ⚠️  membership ${fullName}:`, memErr.message);
    }

    const { data: count, error: countErr } = await supabase.rpc('org_active_member_count', {
      p_org_id: org.orgId,
    });
    if (countErr) console.warn(`  ⚠️  count:`, countErr.message);
    else console.log(`  → org_active_member_count = ${count}`);
  }
  console.log('\nDone.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
