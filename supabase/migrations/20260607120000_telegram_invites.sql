-- Telegram-first onboarding for livelihood/rural-entrepreneur personas.
--
-- A facilitator (e.g. a PRADAN field worker) mints an invite token and shares
-- t.me/betterat_bot?start=invite_<token>. When the woman taps "Start" in
-- Telegram, the webhook auto-provisions a BetterAt account, links her Telegram
-- identity, and seeds her interest — no app round-trip, no signup form.
--
-- Tokens are single-use, expiring, and unguessable. Only the service role
-- (webhook + mint script) touches this table; RLS is enabled with no policies
-- so anon/authenticated clients cannot read or write it.

create table if not exists public.telegram_invites (
  token            text primary key,
  interest_slug    text not null default 'lac-craft-business',
  organization_id  uuid references public.organizations(id) on delete set null,
  full_name        text,
  created_by       uuid references auth.users(id) on delete set null,
  expires_at       timestamptz not null default (now() + interval '30 days'),
  used_at          timestamptz,
  created_user_id  uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.telegram_invites is
  'Single-use invite tokens that auto-provision + link a BetterAt user when redeemed via t.me/betterat_bot?start=invite_<token>. Service-role only.';

alter table public.telegram_invites enable row level security;
-- Intentionally no policies: service role bypasses RLS; everyone else is denied.

create index if not exists idx_telegram_invites_unused
  on public.telegram_invites (token)
  where used_at is null;
