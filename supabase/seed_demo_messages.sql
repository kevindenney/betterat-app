-- Seed demo messages and notifications for demo-sailor
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  demo_sailor_id UUID;
  demo_coach_id UUID;
  thread1_id UUID;
  thread2_id UUID;
BEGIN
  -- Get demo-sailor user ID
  SELECT id INTO demo_sailor_id
  FROM auth.users
  WHERE email = 'demo-sailor@better.at'
  LIMIT 1;

  -- Try alternative email if not found
  IF demo_sailor_id IS NULL THEN
    SELECT id INTO demo_sailor_id
    FROM auth.users
    WHERE email ILIKE '%demo-sailor%'
    LIMIT 1;
  END IF;

  IF demo_sailor_id IS NULL THEN
    RAISE NOTICE 'Demo sailor not found!';
    RETURN;
  END IF;

  RAISE NOTICE 'Found demo-sailor: %', demo_sailor_id;

  -- Get another user to be a conversation partner (demo-coach or any other user)
  SELECT id INTO demo_coach_id
  FROM auth.users
  WHERE email ILIKE '%demo-coach%' OR email ILIKE '%coach%'
  LIMIT 1;

  -- Fallback to any other user
  IF demo_coach_id IS NULL THEN
    SELECT id INTO demo_coach_id
    FROM auth.users
    WHERE id != demo_sailor_id
    LIMIT 1;
  END IF;

  -- ============================================
  -- CREATE CREW THREADS
  -- ============================================

  -- Thread 1: Weekend Crew
  INSERT INTO crew_threads (id, name, owner_id, avatar_emoji, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Weekend Racing Crew',
    demo_sailor_id,
    '⛵',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 hours'
  )
  RETURNING id INTO thread1_id;

  -- Add demo-sailor as owner
  INSERT INTO crew_thread_members (thread_id, user_id, role, joined_at, last_read_at)
  VALUES (thread1_id, demo_sailor_id, 'owner', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

  -- Add second user as member if exists
  IF demo_coach_id IS NOT NULL THEN
    INSERT INTO crew_thread_members (thread_id, user_id, role, joined_at, last_read_at)
    VALUES (thread1_id, demo_coach_id, 'member', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');
  END IF;

  -- Add messages to thread 1
  INSERT INTO crew_thread_messages (thread_id, user_id, message, message_type, created_at)
  VALUES
    (thread1_id, demo_sailor_id, 'Hey team! Ready for Saturday''s race?', 'text', NOW() - INTERVAL '2 days'),
    (thread1_id, demo_coach_id, 'Absolutely! Checked the forecast - looking like 12-15 knots from the SW', 'text', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
    (thread1_id, demo_sailor_id, 'Perfect conditions! I''ll bring the new jib', 'text', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes'),
    (thread1_id, demo_coach_id, 'Great. Meet at the club at 9am?', 'text', NOW() - INTERVAL '1 day'),
    (thread1_id, demo_sailor_id, 'See you then! 🏁', 'text', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
    (thread1_id, demo_coach_id, 'Don''t forget the new tiller extension', 'text', NOW() - INTERVAL '2 hours');

  -- Thread 2: Dragon Fleet Chat
  INSERT INTO crew_threads (id, name, owner_id, avatar_emoji, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Dragon Fleet Chat',
    demo_sailor_id,
    '🐉',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '30 minutes'
  )
  RETURNING id INTO thread2_id;

  -- Add demo-sailor as owner
  INSERT INTO crew_thread_members (thread_id, user_id, role, joined_at, last_read_at)
  VALUES (thread2_id, demo_sailor_id, 'owner', NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days');

  -- Add messages to thread 2
  INSERT INTO crew_thread_messages (thread_id, user_id, message, message_type, created_at)
  VALUES
    (thread2_id, demo_sailor_id, 'Welcome to the Dragon Fleet chat!', 'text', NOW() - INTERVAL '7 days'),
    (thread2_id, demo_sailor_id, 'Use this thread to coordinate fleet activities', 'system', NOW() - INTERVAL '7 days' + INTERVAL '1 minute'),
    (thread2_id, demo_sailor_id, 'Anyone up for practice Wednesday evening?', 'text', NOW() - INTERVAL '3 days'),
    (thread2_id, demo_sailor_id, 'Reminder: Fleet AGM next month', 'text', NOW() - INTERVAL '30 minutes');

  -- ============================================
  -- CREATE NOTIFICATIONS
  -- ============================================

  -- Clear existing notifications for demo-sailor (optional)
  -- DELETE FROM social_notifications WHERE user_id = demo_sailor_id;

  -- Add sample notifications
  INSERT INTO social_notifications (user_id, type, actor_id, reference_type, reference_id, message, is_read, created_at)
  VALUES
    (demo_sailor_id, 'new_follower', demo_coach_id, 'user', demo_coach_id, NULL, false, NOW() - INTERVAL '1 hour'),
    (demo_sailor_id, 'race_like', demo_coach_id, 'race', gen_random_uuid(), 'liked your race notes', false, NOW() - INTERVAL '3 hours'),
    (demo_sailor_id, 'comment', demo_coach_id, 'activity_comment', gen_random_uuid(), 'Great race! What was your start strategy?', false, NOW() - INTERVAL '5 hours'),
    (demo_sailor_id, 'new_follower', demo_coach_id, 'user', demo_coach_id, NULL, true, NOW() - INTERVAL '1 day'),
    (demo_sailor_id, 'race_like', demo_coach_id, 'race', gen_random_uuid(), 'liked your tuning notes', true, NOW() - INTERVAL '2 days');

  RAISE NOTICE 'Demo data created successfully!';
  RAISE NOTICE 'Thread 1 ID: %', thread1_id;
  RAISE NOTICE 'Thread 2 ID: %', thread2_id;

END $$;
