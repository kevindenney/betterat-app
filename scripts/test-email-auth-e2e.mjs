#!/usr/bin/env node
/**
 * End-to-end harness for the email-dependent Supabase auth flows.
 *
 * Spins up disposable AgentMail inboxes, drives the real GoTrue auth REST API
 * (signup-confirmation + password-recovery), then reads the resulting email out
 * of the inbox to assert the link is well-formed. This is the only way to catch
 * regressions in the implicit-flow callback, the redirect allowlist fallback
 * (feedback_supabase_redirect_allowlist), and signup confirmation — none of which
 * surface until a real link from a real email is inspected.
 *
 * OPT-IN. Hits LIVE dev Supabase + LIVE AgentMail. Run manually:
 *   npm run test:email-auth-e2e
 *
 * Cleans up after itself: deletes the test auth users (service role) and the
 * disposable inboxes. Keep the run small — GoTrue email sends are rate-limited.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(REPO_ROOT, '.env.local') });
dotenv.config({ path: path.resolve(REPO_ROOT, '.env') });

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

const SITE_BASE = (process.env.EXPO_PUBLIC_SITE_URL || 'http://localhost:8082').replace(/\/$/, '');
const TEST_PASSWORD = `Tst!${Math.random().toString(36).slice(2, 10)}A9`;

const EMAIL_TIMEOUT_MS = 90_000;
const EMAIL_POLL_MS = 3_000;

// ---------------------------------------------------------------------------
// result tracking
// ---------------------------------------------------------------------------
const results = [];
const record = (status, label, detail = '') => {
  results.push({ status, label, detail });
  const icon = { PASS: '✅', FAIL: '❌', WARN: '⚠️ ', SKIP: '⏭️ ' }[status] || '  ';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
};
const pass = (l, d) => record('PASS', l, d);
const fail = (l, d) => record('FAIL', l, d);
const warn = (l, d) => record('WARN', l, d);
const skip = (l, d) => record('SKIP', l, d);
const check = (l, cond, d) => (cond ? pass(l, d) : fail(l, d));

// ---------------------------------------------------------------------------
// http helpers
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url, init = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jsonOrText(res) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

const amHeaders = () => ({ Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' });

// ---------------------------------------------------------------------------
// AgentMail
// ---------------------------------------------------------------------------
async function createInbox() {
  const res = await fetchWithTimeout(`${AGENTMAIL_BASE}/inboxes`, {
    method: 'POST',
    headers: amHeaders(),
    body: '{}',
  });
  const body = await jsonOrText(res);
  if (!res.ok || !body?.email) throw new Error(`createInbox failed (${res.status}): ${JSON.stringify(body)}`);
  return body.email;
}

async function deleteInbox(email) {
  try {
    await fetchWithTimeout(`${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: amHeaders(),
    });
  } catch {
    /* best-effort cleanup */
  }
}

/** Polls a fresh inbox until any message lands, then returns its full detail. */
async function waitForMessage(email) {
  const deadline = Date.now() + EMAIL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetchWithTimeout(`${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(email)}/messages`, {
      headers: amHeaders(),
    });
    const body = await jsonOrText(res);
    const msg = body?.messages?.[0];
    if (msg?.message_id) {
      const detailRes = await fetchWithTimeout(
        `${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(email)}/messages/${encodeURIComponent(msg.message_id)}`,
        { headers: amHeaders() },
      );
      return jsonOrText(detailRes);
    }
    await new Promise((r) => setTimeout(r, EMAIL_POLL_MS));
  }
  return null;
}

/** Pulls the GoTrue confirm/recover link out of an email body. */
function extractAuthLink(message) {
  const raw = `${message?.text || ''}\n${(message?.html || '').replace(/&amp;/g, '&')}`;
  const urls = raw.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  return (
    urls.find((u) => /\/auth\/v1\/verify/.test(u)) ||
    urls.find((u) => /[?&](token|token_hash)=/.test(u)) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Supabase GoTrue REST
// ---------------------------------------------------------------------------
const anonHeaders = () => ({ apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' });
const adminHeaders = () => ({ apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' });

async function adminCreateUser(email) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password: TEST_PASSWORD, email_confirm: true }),
  });
  return jsonOrText(res);
}

async function adminDeleteUser(id) {
  if (!id) return;
  try {
    await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
  } catch {
    /* best-effort cleanup */
  }
}

async function authSignup(email, redirectTo) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
    { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ email, password: TEST_PASSWORD }) },
  );
  return jsonOrText(res);
}

async function authRecover(email, redirectTo) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ email }) },
  );
  return { status: res.status, body: await jsonOrText(res) };
}

async function passwordGrant(email) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  return { status: res.status, body: await jsonOrText(res) };
}

function assertLinkShape(label, link, expectedRedirect, expectedType) {
  let u;
  try {
    u = new URL(link);
  } catch {
    fail(`${label}: link parses`, link);
    return;
  }
  check(`${label}: link points at Supabase`, u.origin === new URL(SUPABASE_URL).origin, u.origin);
  if (expectedType) {
    check(`${label}: link type=${expectedType}`, u.searchParams.get('type') === expectedType, u.searchParams.get('type') || '(none)');
  }
  const redirectTo = u.searchParams.get('redirect_to');
  if (redirectTo === expectedRedirect) {
    pass(`${label}: redirect_to preserved`, redirectTo);
  } else {
    warn(`${label}: redirect_to NOT preserved (allowlist fallback to Site URL?)`, `got ${redirectTo || '(none)'}, wanted ${expectedRedirect}`);
  }
}

// ---------------------------------------------------------------------------
// flows
// ---------------------------------------------------------------------------
async function testPasswordRecovery(created) {
  console.log('\n── Password recovery email round-trip ──');
  const inbox = await createInbox();
  created.inboxes.push(inbox);
  pass('recovery: disposable inbox created', inbox);

  const user = await adminCreateUser(inbox);
  if (user?.id) created.userIds.push(user.id);
  check('recovery: confirmed test user created', !!user?.id, user?.id || JSON.stringify(user));

  const redirect = `${SITE_BASE}/(auth)/reset-password`;
  const { status } = await authRecover(inbox, redirect);
  if (status === 429) {
    skip('recovery: email send rate-limited (HTTP 429)', 'built-in SMTP hourly cap — rerun later or configure custom SMTP');
    return;
  }
  check('recovery: POST /auth/v1/recover accepted', status >= 200 && status < 300, `HTTP ${status}`);
  if (status < 200 || status >= 300) return;

  const msg = await waitForMessage(inbox);
  if (!msg) {
    fail('recovery: email received', `none within ${EMAIL_TIMEOUT_MS / 1000}s`);
    return;
  }
  pass('recovery: email received', msg.subject || '(no subject)');

  const link = extractAuthLink(msg);
  check('recovery: link present in email', !!link);
  if (link) assertLinkShape('recovery', link, redirect, 'recovery');
}

async function testSignupConfirmation(created) {
  console.log('\n── Signup confirmation email round-trip ──');
  const inbox = await createInbox();
  created.inboxes.push(inbox);
  pass('signup: disposable inbox created', inbox);

  const redirect = `${SITE_BASE}/callback`;
  const res = await authSignup(inbox, redirect);

  if (res?.access_token) {
    if (res?.user?.id) created.userIds.push(res.user.id);
    skip('signup: confirmation flow', 'project auto-confirms (email confirmation disabled) — no email sent');
    return;
  }
  const userId = res?.id || res?.user?.id;
  if (userId) created.userIds.push(userId);
  check('signup: user created pending confirmation', !!userId, userId || JSON.stringify(res));

  const msg = await waitForMessage(inbox);
  if (!msg) {
    fail('signup: confirmation email received', `none within ${EMAIL_TIMEOUT_MS / 1000}s`);
    return;
  }
  pass('signup: confirmation email received', msg.subject || '(no subject)');

  const link = extractAuthLink(msg);
  check('signup: confirmation link present', !!link);
  if (!link) return;
  assertLinkShape('signup', link, redirect, 'signup');

  const verifyRes = await fetchWithTimeout(link, { redirect: 'manual' }, 15_000).catch(() => null);
  check('signup: verify link returns redirect (3xx)', !!verifyRes && verifyRes.status >= 300 && verifyRes.status < 400, verifyRes ? `HTTP ${verifyRes.status}` : 'no response');

  const grant = await passwordGrant(inbox);
  check('signup: sign-in succeeds after confirm', grant.status === 200 && !!grant.body?.access_token, `HTTP ${grant.status}`);
}

async function cleanup(created) {
  console.log('\n── Cleanup ──');
  for (const id of created.userIds) await adminDeleteUser(id);
  for (const inbox of created.inboxes) await deleteInbox(inbox);
  console.log(`  removed ${created.userIds.length} test user(s), ${created.inboxes.length} inbox(es)`);
}

function validateEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!AGENTMAIL_KEY) missing.push('AGENTMAIL_API_KEY');
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}. Set them in .env.local / .env.`);
    process.exit(2);
  }
}

async function main() {
  validateEnv();
  console.log(`Email-auth E2E harness → ${SUPABASE_URL}`);
  const created = { inboxes: [], userIds: [] };
  try {
    await testPasswordRecovery(created);
    await testSignupConfirmation(created);
  } catch (err) {
    fail('harness crashed', err?.message || String(err));
  } finally {
    await cleanup(created);
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  const warnings = results.filter((r) => r.status === 'WARN');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Result: ${results.filter((r) => r.status === 'PASS').length} passed, ${failures.length} failed, ${warnings.length} warning(s), ${results.filter((r) => r.status === 'SKIP').length} skipped`);
  if (warnings.length) console.log('Warnings often indicate the redirect allowlist — see feedback_supabase_redirect_allowlist.');
  process.exit(failures.length ? 1 : 0);
}

main();
