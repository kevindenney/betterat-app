#!/usr/bin/env tsx
/**
 * Mint a Telegram-first onboarding invite.
 *
 * Generates a single-use token row in `telegram_invites` and prints the
 * t.me/betterat_bot?start=invite_<token> link a facilitator shares with a
 * rural-entrepreneur. When she taps Start, the webhook auto-provisions and
 * links her BetterAt account (see services/capture/telegramInvite.ts).
 *
 * Usage:
 *   tsx scripts/mint-telegram-invite.ts \
 *     --interest lac-craft-business \
 *     --name "Suman Tirkey" \
 *     --org <organization_id> \
 *     --days 30
 *
 * All flags optional; interest defaults to lac-craft-business.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function randomToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const interestSlug = arg('--interest') ?? 'lac-craft-business';
  const fullName = arg('--name') ?? null;
  const organizationId = arg('--org') ?? null;
  const days = Number(arg('--days') ?? '30');
  const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'betterat_bot';

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('telegram_invites').insert({
    token,
    interest_slug: interestSlug,
    full_name: fullName,
    organization_id: organizationId,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('❌ Failed to mint invite:', error.message);
    process.exit(1);
  }

  const link = `https://t.me/${botUsername}?start=invite_${token}`;
  console.log('\n✅ Invite minted\n');
  console.log(`   interest : ${interestSlug}`);
  if (fullName) console.log(`   name     : ${fullName}`);
  if (organizationId) console.log(`   org      : ${organizationId}`);
  console.log(`   expires  : ${expiresAt}`);
  console.log(`\n   Share this link:\n   ${link}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
