-- Phase 5b · independent authors with no org affiliation
-- blueprints.org_id was NOT NULL because the original schema assumed
-- every blueprint belonged to an institution. Marketplace listings
-- by pure-independent authors (no JHSON-style affiliation) don't have
-- an org, so the column is now nullable. Existing rows unchanged.

ALTER TABLE public.blueprints ALTER COLUMN org_id DROP NOT NULL;
