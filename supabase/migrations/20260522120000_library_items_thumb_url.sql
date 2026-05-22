-- ============================================================================
-- library_items.thumb_url — Phase 11 polish
-- ============================================================================
-- Link captures (esp. YouTube / Vimeo) carry a thumbnail URL via oEmbed.
-- Storing it lets the resource detail screen render an actual preview image
-- instead of the flat colored spine that's the current fallback for videos.
-- ============================================================================

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS thumb_url text;
