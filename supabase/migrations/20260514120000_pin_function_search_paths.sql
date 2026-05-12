-- Pin search_path on public functions flagged by Supabase advisor 0011
-- (function_search_path_mutable).
--
-- Setting a fixed `search_path = pg_catalog, public` prevents a hostile
-- caller from creating a same-named object in a schema earlier in the
-- search path to shadow built-ins (CVE-2018-1058 class). Trigger and
-- helper functions in `public` should always resolve unqualified
-- identifiers to pg_catalog (system built-ins) and public (our tables).
--
-- Functions that already cross schemas (e.g., reference `auth.uid()`)
-- continue to work because they qualify those references explicitly.

ALTER FUNCTION public.auto_curate_blueprint_step()                                                                                                                                  SET search_path = pg_catalog, public;
ALTER FUNCTION public.betterat_update_updated_at()                                                                                                                                  SET search_path = pg_catalog, public;
ALTER FUNCTION public.create_timeline_step(p_input jsonb)                                                                                                                            SET search_path = pg_catalog, public;
ALTER FUNCTION public.expire_pending_booking_requests()                                                                                                                              SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_race_participants(race_name text, race_date date, race_venue text, exclude_user_id uuid)                                                                  SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_invite_token()                                                                                                                                        SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_class_experts(target_class_id uuid, exclude_user_id uuid, result_limit integer)                                                                            SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_org_blueprint_count(org_uuid uuid)                                                                                                                          SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_suggested_next_steps(p_subscriber_id uuid, p_interest_id uuid)                                                                                              SET search_path = pg_catalog, public;
ALTER FUNCTION public.increment_unread_count(p_conversation_id uuid, p_sender_id uuid, p_last_message_at timestamp with time zone, p_last_message_preview text)                       SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_co_subscriber(p_blueprint_id uuid)                                                                                                                          SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_competency_validator()                                                                                                                                      SET search_path = pg_catalog, public;
ALTER FUNCTION public.mark_expiration_warnings()                                                                                                                                     SET search_path = pg_catalog, public;
ALTER FUNCTION public.notify_blueprint_subscribers()                                                                                                                                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.notify_discuss_reply()                                                                                                                                         SET search_path = pg_catalog, public;
ALTER FUNCTION public.org_playbooks_set_updated_at()                                                                                                                                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.playbook_touch_updated_at()                                                                                                                                    SET search_path = pg_catalog, public;
ALTER FUNCTION public.record_coach_pricing_change()                                                                                                                                  SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_booking_expiration()                                                                                                                                       SET search_path = pg_catalog, public;
ALTER FUNCTION public.step_arch_e_backfill_batch(batch_size integer)                                                                                                                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.step_review_parse_telegram_stamp(content text)                                                                                                                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_new_member_org_tier()                                                                                                                                     SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_org_member_tiers()                                                                                                                                        SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_betterat_timeline_steps_updated_at()                                                                                                                    SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_blueprint_subscriber_count()                                                                                                                            SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_competency_progress_updated_at()                                                                                                                        SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_creator_stripe_accounts_updated_at()                                                                                                                    SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_crew_members_updated_at()                                                                                                                               SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_nutrition_entries_updated_at()                                                                                                                          SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_race_shared_checklist_items_updated_at()                                                                                                                SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_step_annotations_updated_at()                                                                                                                           SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_timeline_steps_updated_at()                                                                                                                             SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_user_skill_goals_updated_at()                                                                                                                           SET search_path = pg_catalog, public;
