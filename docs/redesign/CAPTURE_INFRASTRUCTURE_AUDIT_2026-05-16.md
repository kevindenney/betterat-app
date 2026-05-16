# Capture Infrastructure Audit — BetterAt

Date: 2026-05-16

Scope:

- Read-only inventory for Phase B.7 Frames 2-4.
- Searched practice capture, bot capture, coach capture, media libraries, package dependencies, and Supabase migrations/schema dump.
- Did not touch `components/step/do-tab/`; existing uncommitted work there was left alone.

## Voice/audio capture

- `services/ai/VoiceNoteService.ts`
  - What it does: Native `expo-av` audio recording service with start/stop/cancel, m4a/webm recording options, local file cleanup, simulated transcription, and race-specific tactical insight extraction.
  - Usage: Actively imported by `components/ai/VoiceNoteRecorder.tsx`; not wired into `StepDrawContent` or current Practice Do tab.
  - Tests: No direct tests found.

- `components/ai/VoiceNoteRecorder.tsx`
  - What it does: Race-day voice recorder UI around `VoiceNoteService`, with large record button, duration timer, processing state, local voice-note list, and simulated tactical insight callbacks.
  - Usage: Actively imported by `components/ai/AIRaceAnalysisDashboard.tsx`, which is imported by `components/dashboard/RaceDashboard.tsx`. Practice Do does not use it.
  - Tests: No direct tests found.

- `services/voiceCommandService.ts`
  - What it does: Wake-phrase and command-recognition service using `@react-native-voice/voice`; supports commands like tack/gybe/note/wind/tide/timer, queues offline commands in AsyncStorage, and requests microphone permission through `expo-av`.
  - Usage: No active app imports found besides the file itself; appears stale or unmounted.
  - Tests: No direct tests found.

- `components/races/QuickActionDrawer.tsx`
  - What it does: Exposes an `onVoiceNote` callback in race-day quick actions.
  - Usage: Callback surface exists; docs indicate prior wiring was debug/logging rather than implemented recording.
  - Tests: No direct tests found.

- `app.config.js`
  - What it does: Declares iOS microphone and speech-recognition usage strings.
  - Usage: Active app config.
  - Tests: Not applicable.

## Photo/image capture

- `components/step/StepDrawContent.tsx`
  - What it does: Current Practice Do/Act media owner. Uses `expo-image-picker` for native camera/gallery and web file input for web. Uploads photos/videos to Supabase Storage bucket `step-media`, then appends `metadata.act.media_uploads[]` with `{ id, uri, type, caption, created_at }`.
  - Usage: Actively rendered by `components/step/ActTab.tsx` and `components/cards/content/RaceSummaryCard.tsx`.
  - Tests: No direct tests found for `StepDrawContent` media upload. B.7 do-tab model tests cover normalizing `media_uploads`, but not the upload handler.

- `components/step/CaptureTimeline.tsx`
  - What it does: Renders merged observations and media uploads with timestamps, thumbnails, video badge, caption editing, delete controls, and photo preview callback.
  - Usage: Actively used only inside `StepDrawContent`.
  - Tests: No direct tests found.

- `supabase/migrations/20260316130000_create_step_media_bucket.sql`
  - What it does: Creates public `step-media` storage bucket with 5 MB limit and image/video MIME allowlist; authenticated users can upload/delete in their own user folder, public can read.
  - Usage: Active persistence path for `StepDrawContent`.
  - Tests: No migration tests found.

- `api/telegram/webhook.ts` and `api/whatsapp/webhook.ts`
  - What they do: Download inbound channel photos, upload them, keep `pending_photo_url`, and pass uploaded URLs through shared capture/coach tooling.
  - Usage: Active webhooks; share tool paths with `services/capture/*`.
  - Tests: No direct tests found for photo ingest.

- `lib/telegram/tools.ts` / `attach_step_evidence`
  - What it does: Appends uploaded photos into `timeline_steps.metadata.act.media_uploads[]`; can also append notes; stamps `started_at` and advances pending steps to `in_progress`.
  - Usage: Active through Telegram, WhatsApp, CoachService, and the shared CaptureService tool loop.
  - Tests: No direct tests found.

- Other image-picker usage
  - Files: onboarding/profile photo, settings profile photo, boat add/edit, coach profile, sailor media carousel, sail inspection photo capture, course map wizard, module detail bottom sheet, computer vision service.
  - What it does: Domain-specific profile/media/photo flows with their own upload targets and data models; useful for picker patterns, not Practice Do persistence.
  - Usage: Mixed active app usage.
  - Tests: No direct capture tests found.

## Text/note capture

- `components/step/ObservationLog.tsx`
  - What it does: Inline typed observation input. Creates `Observation` objects with `id`, `text`, ISO `timestamp`, and `source: 'note'`.
  - Usage: Actively used by `StepDrawContent`.
  - Tests: No direct tests found.

- `components/step/StepDrawContent.tsx`
  - What it does: Persists typed observations into `metadata.act.observations[]` and also appends formatted text into legacy `metadata.act.notes` for compatibility. Also has a plain notes fallback textarea and `TrainChatPanel` path that updates notes.
  - Usage: Active current Practice Do/Act implementation.
  - Tests: No direct tests found.

- `lib/telegram/tools.ts` / `log_observation`
  - What it does: Writes bot/voice observations into `metadata.act.notes` and `metadata.act.observations[]` with `source: 'voice'`; stamps `started_at` and advances pending steps to `in_progress`.
  - Usage: Active through Telegram/WhatsApp/coach tool loops.
  - Tests: No direct tests found.

- `components/practice/phases/TrainChatPanel.tsx`
  - What it does: In-session AI coaching chat; persists user messages back into `metadata.act.notes` via parent `onUpdateNotes`, but does not create structured `observations[]`.
  - Usage: Active inside `StepDrawContent` when interest context exists.
  - Tests: No direct tests found.

- `hooks/useAIConversation.ts`
  - What it does: Generic AI chat persistence against `ai_conversations`; calls `step-plan-suggest`/`race-coaching-chat` and async insight/measurement/nutrition extraction on completion.
  - Usage: Active for TrainChatPanel and other AI chat surfaces.
  - Tests: No direct capture tests found.

- `components/playbook/QuickCaptureModal.tsx` and `components/playbook/sidebar/QuickCapture.tsx`
  - What they do: Raw Inbox capture for Playbook resources. Modal supports URL/YouTube/text; sidebar has file/link/voice buttons, but file/voice show "ships later" alerts.
  - Usage: Active in Playbook home/sidebar; separate from Practice Do.
  - Tests: No direct tests found.

## Time markers and pinning

- `metadata.act.started_at`
  - What it does: Current Do start signal. `StepDrawContent` auto-stamps it when owner opens Do and step is pending/non-completed. Bot `attach_step_evidence` and `log_observation` also stamp it if absent.
  - Usage: Active in current Practice Do and bot capture.
  - Tests: B.7 `doState` tests cover deriving live state from `started_at`, but not the actual writer.

- `metadata.act.observations[].timestamp`
  - What it does: Timestamp for typed/bot observations; used by `CaptureTimeline`, B.7 do-tab models, and iOS race water/debrief screens.
  - Usage: Active.
  - Tests: B.7 model tests cover sorting normalized captures; no direct writer tests.

- `metadata.act.media_uploads[].created_at`
  - What it does: Timestamp for uploaded media. `StepDrawContent` sets it; Telegram `attach_step_evidence` currently does not set `created_at`, so some bot-attached media cannot sort/render in timestamp-dependent surfaces.
  - Usage: Active but inconsistent across writers.
  - Tests: B.7 model tests cover media with `created_at`; no test catches missing timestamps from `attach_step_evidence`.

- `metadata.act.sub_step_progress`, `sub_step_deviations`, `sub_step_overrides`
  - What it does: Checklist completion, "did instead" deviations, and in-session edits keyed by sub-step ID.
  - Usage: Active in `StepDrawContent`; bot tools can toggle sub-steps and log deviations.
  - Tests: No direct tests found for the UI writer.

- `public.step_recent_activity`
  - What it does: Cross-surface recency table with `(user_id, step_id)` PK, `last_active_at`, and source enum. Written through `mark_step_active()` from bot/tool paths for context inference.
  - Usage: Active in bot tool hooks; useful for choosing "current step" but not a capture stream table.
  - Tests: No direct tests found.

- Pinning
  - Finding: No Practice Do capture "pin" or "flag for debrief" persistence exists in the current stable capture model. There are unrelated UI pin concepts in sidebar/race conditions and B.7 work-in-progress types, but no established act-level pin/evidence flag.

## Transcription

- `lib/telegram/transcription.ts`
  - What it does: Server-side `transcribeVoiceNote(audioBuffer, mimeType)` using Google Gemini 2.0 Flash via `GOOGLE_AI_API_KEY`; returns text or null.
  - Usage: Actively imported by Telegram and WhatsApp webhooks for inbound `voice`/`audio` messages.
  - Tests: No direct tests found.

- `api/telegram/webhook.ts` and `api/whatsapp/webhook.ts`
  - What they do: Download channel audio, call `transcribeVoiceNote`, then process the transcript as text with `[Voice note]:` history prefix.
  - Usage: Active webhook path.
  - Tests: No direct transcription tests found.

- `services/ai/VoiceNoteService.ts`
  - What it does: Has a `transcribeAudio` method, but it returns a simulated hardcoded transcript and does not call real transcription.
  - Usage: Only via race-day recorder; should not be reused as-is for B.7 transcription.
  - Tests: No direct tests found.

- OpenAI / Whisper
  - Finding: No active Whisper transcription path found. "OpenAI-compatible" providers exist for generic AI infra, but voice transcription currently uses Gemini, not OpenAI Whisper.

## Storage and persistence

- Primary Practice Do persistence
  - Shape: `timeline_steps.metadata.act` JSONB.
  - Typed in: `types/step-detail.ts`.
  - Fields: `started_at`, `notes`, `observations[]`, `media_uploads[]`, `media_links[]`, `sub_step_progress`, `sub_step_deviations`, `sub_step_overrides`, `conversation_id`, `measurements`, `nutrition`.

- `types/step-detail.ts`
  - What it does: Defines `Observation`, `MediaUpload`, `MediaLink`, and `StepActData`.
  - Usage: Active across StepDrawContent, public step views, B.7 models, race iOS water/debrief screens.
  - Tests: Indirect B.7 tests cover normalization; no type-level runtime tests.

- Storage bucket: `step-media`
  - What it stores: Step photos/videos uploaded from current Practice Do.
  - Constraint: Public bucket, 5 MB per file, MIME allowlist for common image/video formats.

- Bot/conversation storage
  - Tables: `telegram_conversations` and `whatsapp_conversations` carry `pending_photo_url`.
  - Purpose: Temporary photo attach workflow before the user/model chooses a step.

- Playbook raw inbox
  - Table: `playbook_inbox_items`, kind enum includes `file`, `url`, `photo`, `voice`, `text`.
  - Current behavior: text/url/photo ingest exists; voice rows are explicitly failed with metadata `"Voice transcription ships in v2"`.
  - Relevance: Good separate inbox model, but not the right persistence target for Practice Do capture.

- Capture-related dedicated tables
  - Finding: No general `captures`, `voice_notes`, `practice_photos`, or act-evidence table found for Practice Do.
  - Existing domain-specific tables: `sail_inspection_photos`, `sailor_media`, `protest_evidence`, program/assessment evidence JSONB. These are not Practice Do capture streams.

- Package dependencies
  - `expo-image-picker`: present, used by StepDrawContent and many image flows.
  - `expo-camera`: present, used by QR scanner through dynamic import; not used by Practice Do capture.
  - `expo-av`: present, used by voice note service, voice command permissions, race committee audio, and video playback.
  - `@react-native-voice/voice`: present, used only by `voiceCommandService.ts`.
  - `expo-file-system`: present, used by voice note service and other file flows.
  - `expo-media-library`: present; no Practice Do usage found.

## Recommendation: extend vs rebuild for B.7

- Extend `StepDrawContent` persistence and handlers. The existing `metadata.act` model, `step-media` bucket, `ObservationLog`, `CaptureTimeline`, and bot `log_observation` / `attach_step_evidence` tools already converge on the same data shape. Rebuilding a parallel capture store would fragment Practice Do, bot, coach, public share, and future Reflect evidence paths.

- Extract a controller rather than duplicate `StepDrawContent`. For B.7, move reusable operations into a hook such as `useStepActCaptureController`: add typed observation, pick/upload media, remove/update media, add/update media link, toggle/deviate sub-step, mark started. Keep storage and metadata writes in one place.

- Keep `metadata.act.observations[]` and `metadata.act.media_uploads[]` as the Frame 2 stream source. Add optional metadata only if needed for Frames 3-4, e.g. `flagged_for_debrief`, `capability_ids`, `voice_duration_sec`, `voice_peaks`, but avoid a new Supabase table before the capability/evidence model is settled.

- Do not reuse `VoiceNoteRecorder` wholesale. It is race-day tactical UI with simulated transcription and local-only voice-note state. If native voice is needed for B.7, extract or write a small recording primitive, then send the audio to a real transcription path or route the transcript through `log_observation` semantics.

- Reuse server transcription ideas, not exact implementation, for in-app voice. Telegram/WhatsApp Gemini transcription is proven server-side for buffers, but the app currently has no upload/audio endpoint for raw Do voice clips. B.7 can initially route voice affordance to typed note / coach chat, or add a small audio upload + transcription endpoint explicitly.

- Fix timestamp consistency before relying on reverse chronology. `StepDrawContent` media writes `created_at`; `attach_step_evidence` currently appends media without `created_at`. B.7 Frame 2 should either tolerate missing timestamps or update the shared tool writer in a separate safe commit.

- Build Frame 4 evidence marking on capture-level optional metadata first. There is no durable generic evidence table for Practice Do. Use local/current-step metadata for selected captures, then let Reflect / competency assessment consume those selections until the long-term capability trophy persistence model is locked.
