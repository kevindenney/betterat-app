-- Group messaging channels are separate from personal capture bots.
--
-- whatsapp_invite_url remains the simple WhatsApp group link-out.
-- telegram_invite_url adds the equivalent Telegram group/channel link.
--
-- Telegram can later grow a true bot-in-group connection by storing the bot
-- chat id/title on this same row. For now those columns are nullable metadata:
-- invite links are user-managed, bot connection is server-managed when added.

BEGIN;

ALTER TABLE public.affinity_groups
  ADD COLUMN IF NOT EXISTS telegram_invite_url TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bot_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_bot_chat_title TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bot_connected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.affinity_groups.telegram_invite_url IS
  'Telegram group/channel invite link (https://t.me/... or https://telegram.me/...). Link-out until a bot chat id is connected.';
COMMENT ON COLUMN public.affinity_groups.telegram_bot_chat_id IS
  'Telegram chat id for a connected BetterAt group bot. NULL until the bot is connected inside a Telegram group.';
COMMENT ON COLUMN public.affinity_groups.telegram_bot_chat_title IS
  'Last known Telegram chat title for the connected BetterAt group bot.';
COMMENT ON COLUMN public.affinity_groups.telegram_bot_connected_at IS
  'When the BetterAt bot was connected to this Telegram group chat.';

-- Supersede the WhatsApp-only metadata RPC with both messaging channels.
DROP FUNCTION IF EXISTS public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.set_affinity_group_meta(
  p_group_id UUID,
  p_goal_at TIMESTAMPTZ DEFAULT NULL,
  p_goal_label TEXT DEFAULT NULL,
  p_affiliations JSONB DEFAULT NULL,
  p_whatsapp_invite_url TEXT DEFAULT NULL,
  p_telegram_invite_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa TEXT := p_whatsapp_invite_url;
  v_tg TEXT := p_telegram_invite_url;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can edit this group';
  END IF;

  IF v_wa IS NOT NULL AND btrim(v_wa) <> ''
     AND btrim(v_wa) !~ '^https://chat\.whatsapp\.com/' THEN
    RAISE EXCEPTION 'Enter a WhatsApp group link (https://chat.whatsapp.com/...)';
  END IF;

  IF v_tg IS NOT NULL AND btrim(v_tg) <> ''
     AND btrim(v_tg) !~ '^https://(t\.me|telegram\.me)/' THEN
    RAISE EXCEPTION 'Enter a Telegram group link (https://t.me/...)';
  END IF;

  UPDATE public.affinity_groups
  SET goal_at = COALESCE(p_goal_at, goal_at),
      goal_label = COALESCE(p_goal_label, goal_label),
      affiliations = COALESCE(p_affiliations, affiliations),
      whatsapp_invite_url = CASE
        WHEN v_wa IS NULL THEN whatsapp_invite_url
        WHEN btrim(v_wa) = '' THEN NULL
        ELSE btrim(v_wa)
      END,
      telegram_invite_url = CASE
        WHEN v_tg IS NULL THEN telegram_invite_url
        WHEN btrim(v_tg) = '' THEN NULL
        ELSE btrim(v_tg)
      END,
      updated_at = now()
  WHERE id = p_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT) TO authenticated;

COMMIT;
