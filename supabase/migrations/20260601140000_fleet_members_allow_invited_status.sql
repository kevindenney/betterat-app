-- fleet_members.status needs an 'invited' value: owners/captains invite
-- existing users (invite_fleet_member, invite_fleet_member_by_email,
-- claim_fleet_invites) by inserting a row that is not yet 'active'. The
-- original CHECK only allowed active/inactive/pending, so every invite RPC
-- failed the constraint. 'pending' is unused (joinFleet writes 'active'
-- directly), so 'invited' is the semantically correct state: invited by a
-- leader, awaiting the member's acceptance.
ALTER TABLE fleet_members DROP CONSTRAINT IF EXISTS fleet_members_status_check;
ALTER TABLE fleet_members ADD CONSTRAINT fleet_members_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'invited'::text]));
