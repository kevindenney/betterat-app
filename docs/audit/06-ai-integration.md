# Pass 6 — AI Integration

**Scope.** How the app talks to LLMs: client wrappers, edge functions, provider routing, prompt construction, fallback/circuit-breaker logic, and observability. Identifies the gaps that would surface in a Johns Hopkins School of Nursing demo where AI features (plan suggest, critique insight, brain dump → plan, clinical-reasoning evaluation) are the primary value prop.

**Cited as `file:line` only**; no behavior was changed.

---

## TL;DR

The provider story is **"Gemini 2.5 Flash for everything"** (`lib/config/aiModels.ts:148`, `supabase/functions/_shared/gemini.ts:8`), but the codebase still presents itself as a Claude/Anthropic stack: `AIClient` re-exports a `ClaudeClient` alias (`services/ai/AIClient.ts:171`), the circuit breaker is named `"Claude API"` (`lib/utils/aiCircuitBreaker.ts:204`), fallback messages say *"Anthropic API overloaded"* (`lib/utils/aiFallback.ts:177-178`), and the mock-fallback captions point users to *console.anthropic.com* (`lib/utils/aiFallback.ts:247, 281`) even though no Anthropic call ever fires through the main path.

Underneath, **two parallel edge-function stacks** coexist. `step-plan-suggest` calls `callGemini` directly with no fallback chain (`supabase/functions/step-plan-suggest/index.ts:80`); `race-coaching-chat` goes through the unified `complete()` abstraction with optional fallback providers (`supabase/functions/race-coaching-chat/index.ts:59`, `supabase/functions/_shared/ai/provider.ts:81`). **Every BetterAt service tries `step-plan-suggest` first and falls back to `race-coaching-chat` on failure** — 14 such pairs across `services/ai/StepPlanAIService.ts` alone — which means the *server-side* fallback chain (`AI_FALLBACK_CHAIN` env var) only protects half the surface.

For the nursing demo specifically, the most demo-fragile finding is that **`clinical-reasoning-evaluate` does not call AI at all** (`supabase/functions/clinical-reasoning-evaluate/index.ts:192`). It runs a hand-coded heuristic on text length + completed-tool-step count and returns canned "strengths / improvements" strings. A reviewer who probes it will see the same evaluation regardless of clinical content.

Other notable surface findings: a fake "Monte Carlo simulation" with hardcoded 65% win probability (`services/aiService.ts:631-647`), an unused string constant masquerading as an API URL (`services/ai/AIClient.ts:42`), brittle regex JSON extraction repeated across ~6 callers, an `isSailing` substring heuristic that gates ~80 lines of equipment context (`services/ai/StepPlanAIService.ts:1244`), and an `AIActivityLogger` whose insert path is bypassed by ~80 direct `supabase.functions.invoke` calls so there is no centralised usage telemetry.

---

## 1. Architecture overview

### Client side (React Native / Web)

```
services/ai/
├── AIClient.ts                    # base wrapper around supabase.functions.invoke('race-coaching-chat')
├── EnhancedAIClient.ts            # adds Skills/MCP placeholders (no real MCP wiring)
├── ClaudeClient.ts                # 11-line re-export shim — deprecated
├── EnhancedClaudeClient.ts        # (re-export, not read in this pass)
├── invokeAIEdgeFunction.ts        # auth-aware fetch with 60 s timeout
├── StepPlanAIService.ts           # the heart of BetterAt AI (1455 lines)
├── BrainDumpAIService.ts          # client-side URL/people extraction
├── PlaybookAIService.ts           # thin RPC wrapper around 6 playbook-* edge fns
├── CompetencyExtractionService.ts # one-shot extractors
├── NutritionExtractionService.ts
├── MeasurementExtractionService.ts
├── SkillExtractionService.ts
├── DateEnrichmentService.ts
├── ClinicalReasoningEvaluationService.ts
├── ... 18 more sailing-specific services
```

`services/ai/index.ts:7-55` re-exports the modern names (`AIClient`, `EnhancedAIClient`, ...) **and** their `Claude*` aliases. Both names point at the same class. This bloats the surface and lies about what's underneath.

### Edge functions (Deno)

Two competing shapes:

| Function | Entry point | Routing |
|----------|-------------|---------|
| `race-coaching-chat` | `complete()` from `_shared/ai/provider.ts:81` | Gemini default → optional fallback chain via `AI_FALLBACK_CHAIN` env var |
| `step-plan-suggest` | `callGemini()` from `_shared/gemini.ts:50` | Gemini only, no fallback chain, no model selection |

20 edge functions use the unified `complete()` provider (`race-analysis`, `extract-course-from-url`, `playbook-*`, `inspiration-extract`, `generate-race-briefing`, etc.). One — `race-conditions-brief` — uses `callGemini` directly (`supabase/functions/race-conditions-brief/index.ts:128`).

Three more use the **Anthropic SDK in-process**: `club-onboarding/index.ts:138`, `coach-matching/index.ts:34`, and the standalone `anthropic-skills-proxy`. These do not go through `complete()` and don't share its fallback behaviour.

### Hosting-layer (Vercel serverless)

`api/whatsapp/webhook.ts:639` and `api/telegram/webhook.ts:737` instantiate `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` directly. They share no code or fallback strategy with the in-app AI calls.

### Two Gemini clients

`supabase/functions/_shared/gemini.ts` (168 lines) and `supabase/functions/_shared/ai/providers/gemini.ts` (148 lines) are near-duplicates. Both throw on missing `GOOGLE_AI_API_KEY` at module load (`_shared/gemini.ts:13`, `_shared/ai/providers/gemini.ts:66`), both pin `thinkingBudget: 0` (`_shared/gemini.ts:79`, `_shared/ai/providers/gemini.ts:86`), and both retry once on 429 with a 2 s backoff (`_shared/gemini.ts:87`, `_shared/ai/providers/gemini.ts:100-103`). When prompt or generation behaviour needs to change, two files need editing.

---

## 2. Provider routing and model selection

### Client-side (lies about provider)

`lib/config/aiModels.ts:38-79` defines a model registry with `provider`, `inputCostPer1M`, `outputCostPer1M`, etc. It then unconditionally returns `'gemini-2.5-flash'` from `getModelForTask` (`lib/config/aiModels.ts:148`) and notes in the comment that the registry is only used "for cost estimation and display purposes." The deprecated `AIModelId` union in `services/ai/AIClient.ts:12` only lists Claude model IDs (`'claude-3-5-sonnet-20240620' | 'claude-3-5-haiku-20241022'`), so any consumer that types `AIRequest.model` claims to call Claude even though the request transparently goes to Gemini.

`aiService.ts:548` stores `ai_model: getModelForTask(taskType)` on every persisted `race_strategies` row — the database will therefore record `gemini-2.5-flash` as the model for strategies that were *built locally* using `runMonteCarloSimulation` (a hardcoded fake — see §6).

### Server-side (real routing)

`supabase/functions/_shared/ai/config.ts:52-59` maps tasks to Gemini for everything:
```
extraction, analysis, generation, chat, briefing, playbook → gemini-2.5-flash
```
With per-task override available via `AI_TASK_<TASK>` env (`config.ts:101`). The default provider can be flipped via `AI_PROVIDER=anthropic` (`config.ts:83-88`) and a comma-separated fallback chain via `AI_FALLBACK_CHAIN` (`config.ts:118-129`). None of the checked-in `.env*` files show these set, so the live behaviour is "Gemini Flash, retry once on 429, otherwise fail."

### Step-plan-suggest is *not* in this routing system

`supabase/functions/step-plan-suggest/index.ts:80` calls `callGemini(...)` directly, bypassing `complete()` entirely. Consequence: there is no way to switch BetterAt's step-planning AI to Anthropic via env var without code changes — even though that's the most-called AI endpoint in the app. The provider abstraction exists but isn't applied at the highest-traffic entry point.

---

## 3. Edge-function inventory

Edge functions that **actually call an LLM** (from the grep across `supabase/functions/**/index.ts`):

| Function | Path | LLM |
|----------|------|-----|
| step-plan-suggest | unified BetterAt planning AI | Gemini via `callGemini` |
| race-coaching-chat | generic chat completion | provider via `complete()` |
| extract-course-from-document | course extraction from PDF/image | provider via `complete()` |
| extract-course-from-text | course extraction from text | provider via `complete()` |
| extract-course-from-url | URL → course | provider via `complete()` |
| extract-course-image | image → course | provider via `complete()` |
| extract-race-details | regatta details from URL | provider via `complete()` |
| extract-race-info | onboarding race extraction | provider via `complete()` |
| extract-ssi-details | sailing skills info extraction | provider via `complete()` |
| generate-race-briefing | pre-race briefing | provider via `complete()` |
| generate-race-coaching | coaching analysis | Anthropic SDK direct (read pending) |
| race-analysis | post-race analysis | provider via `complete()` |
| race-conditions-brief | wind/tide brief | Gemini via `callGemini` |
| sail-analysis-chat | sail photo Q&A | provider via `complete()` |
| inspiration-extract | extract action items from URL | provider via `complete()` |
| playbook-ingest-debrief | timeline-step → playbook concepts | provider via `complete()` |
| playbook-ingest-inbox | raw inbox → playbook | provider via `complete()` |
| playbook-weekly-review | weekly playbook review | provider via `complete()` |
| playbook-pattern-detect | pattern detection across debriefs | provider via `complete()` |
| playbook-cross-interest | cross-interest insight | provider via `complete()` |
| playbook-qa | playbook Q&A | provider via `complete()` |
| club-scrape | club detail extraction | Anthropic SDK direct |
| club-onboarding | club onboarding chat | Anthropic SDK direct (line 138) |
| coach-matching | sailor↔coach matching | Anthropic SDK direct (line 34) |
| anthropic-skills-proxy | Claude Skills proxy | Anthropic SDK direct |

Functions that **claim to be AI** but contain **no LLM call**:
- `clinical-reasoning-evaluate/index.ts:192` — pure heuristic; see §7.

---

## 4. Client → server call patterns

### Pattern A: AIClient wrapper (rare)

`services/ai/AIClient.ts:117-156` — wraps the call in the circuit breaker, redacts and logs failures, syncs sticky fallback mode. The `apiUrl` field at `services/ai/AIClient.ts:42` is a label literal (`'supabase.functions.race-coaching-chat'`), not an actual URL — it is never referenced anywhere. It exists only because the comment at `:5` claims to share its value with `invokeAIEdgeFunction.ts`, which it does not.

**Real users of `AIClient.createMessage`**: grep finds zero callers in the codebase. The base class is functionally dead code; only `EnhancedAIClient` (used by `RaceStrategyEngine`, `RaceTuningEngine`, a few sailing services) extends it.

### Pattern B: direct `supabase.functions.invoke` (dominant)

83 call sites bypass the wrapper entirely:
- `services/ai/StepPlanAIService.ts` alone has 14 invokes (`:620, :630, :677, :687, :805, :814, :942, :953, :1033, :1147, :1157, :1394, :1404` ...).
- `hooks/useAIConversation.ts:126`, `:140`
- `components/step/ConversationalCapture.tsx:240`
- ...etc.

None of these go through the client-side circuit breaker or the activity logger. **The result is that the circuit breaker only protects the dead `AIClient.createMessage` path and the few `EnhancedAIClient`-using sailing services.** BetterAt's core AI surface (plan suggest, critique, brain dump, suggestions) has **no client-side rate-limit protection** beyond what the edge function provides.

### Pattern C: dual-endpoint try-fallback

The dominant BetterAt pattern across `StepPlanAIService.ts`:
```ts
try {
  const { data, error } = await supabase.functions.invoke('step-plan-suggest', { ... });
  if (!error && data?.text) return data.text;
} catch { /* fall through */ }

const { data, error } = await supabase.functions.invoke('race-coaching-chat', { ... });
```
Repeated 7 times in this file. The fallback packs `system` + `prompt` into a single concatenated string because `race-coaching-chat` doesn't accept a `system` param separately (`supabase/functions/race-coaching-chat/index.ts:47-54`). This means the system prompt is duplicated as plain user input on fallback, which changes the model's interpretation; for JSON-output prompts (e.g. `generatePlanFromResource` at `:1147` or `structureBrainDump` at `:1394`) this can produce subtly worse parse rates on the fallback path.

---

## 5. Resilience: circuit breaker + sticky fallback mode

### Circuit breaker (`lib/utils/aiCircuitBreaker.ts`)

Standard CLOSED/OPEN/HALF_OPEN state machine. Defaults: 3 consecutive failures opens, 30 s cooldown, ×2 backoff up to 5 min (`:35-38`). Wrapped around `AIClient.createMessage` only (`services/ai/AIClient.ts:118-120`).

Two problems:
1. **Almost no traffic touches it.** Per §4, the breaker only sees calls that go through `AIClient`. None of the BetterAt AI flows do.
2. **The name says "Claude API"** (`:204`) but the actual provider is Gemini. UI surfaces that read `getStatus().name` will show misleading copy.

### Sticky fallback mode (`lib/utils/aiFallback.ts`)

Process-global flag (`:14-16`). Activated when an error matches credit-exhaustion or overload patterns (`:19-36`). Once flipped, every subsequent `withAIFallback` call short-circuits to a hardcoded mock without trying the API (`:152-158`).

Issues:
- **Hardcoded "Anthropic" branding.** `:177-178` returns the reason string *"Anthropic API overloaded"* even when the failing provider is Gemini. `:247` puts *"AI credits exhausted - showing fallback recommendations"* and *"For precise settings, please add credits at console.anthropic.com"* in front of the user.
- **Pattern matching is string-based.** Gemini's actual 429 response body shape and message format may not match any of the `CREDIT_EXHAUSTION_PATTERNS` or `API_OVERLOAD_PATTERNS` at `:19-36`. The HTTP status-code branch at `:58-61` catches 503/502/529 — but Gemini's `_shared/gemini.ts:94` throws `Error('Gemini API request failed with status ${response.status}')` (a generic message), so the message-match branch will land on `:73` (the `.includes('529')` substring fallback). It works but it's fragile.
- **Mock data is sailing-only.** `generateMockRigTuning` (`:193-249`) and `generateMockStrategy` (`:254-283`) are the only mock generators. There is no fallback content for nursing, knitting, drawing, or other interests; the affected services on those interests just throw or return generic text.

---

## 6. Hidden non-AI fakery

### Monte Carlo simulation is hardcoded

`services/aiService.ts:631-647`:
```ts
return {
  scenarios_analyzed: 1000,
  optimal_path: course.marks.map(m => m.coordinates),
  win_probability: 0.65,
  risk_zones: []
};
```
Returned only for `strategy_type === 'championship'` (`:421`). This is presented as "Monte Carlo simulation" in the data model (`:131-136`), with `scenarios_analyzed` and `win_probability` fields suggesting real stochastic analysis. Reality: it copies the course mark positions verbatim, returns 65% win probability for every race ever generated, and reports 1000 scenarios. The function is named `runMonteCarloSimulation` and lives in `services/aiService.ts` — a reviewer searching the diff for "Monte Carlo" finds this and reasonably assumes there's a real model behind it.

### Hand-written strategy text disguised as AI output

`services/aiService.ts:374-417` builds the `strategyData` object by indexing into the briefing's `keyPoints[0..2]` array with hardcoded English defaults like *"Tack on persistent shifts and protect lane"* and *"Gybe on pressure lines and mark transitions."* If the AI returns fewer than 3 `keyPoints`, the user sees these canned strings; if it returns three, the user sees parts of those plus the canned strings — and the strategy is persisted with `ai_generated: true` (`:547`).

---

## 7. `clinical-reasoning-evaluate` is not actually AI

`supabase/functions/clinical-reasoning-evaluate/index.ts:50-89` defines `buildFallbackEvaluation` — a deterministic function of `(combined.length, completedSteps)`. The handler at `:192` calls it unconditionally:
```ts
const evaluation = buildFallbackEvaluation(content, competencyIds);
```
There is no LLM call anywhere in the file. The competency level (`developing | proficient | advanced`) is chosen at `:37-41` based purely on:
- `combined.length >= 500 && completedSteps >= 4` → advanced
- `combined.length >= 220 && completedSteps >= 3` → proficient
- otherwise → developing

The `strengths`/`improvements` arrays are picked from a small list of canned strings at `:64-76`. The same input always produces the same output.

The function name (`clinical-reasoning-evaluate`) and its client wrapper (`services/ai/ClinicalReasoningEvaluationService.ts:23`, which is inside `services/ai/`) both suggest AI is involved. For a Johns Hopkins demo this is a likely landing spot for evaluators wanting to test the AI's clinical judgement — they'll find it returns the same evaluation regardless of clinical content.

---

## 8. Prompt construction

### Concentration in StepPlanAIService

`services/ai/StepPlanAIService.ts` carries 6 distinct prompt templates (`generateEnrichedPlanSuggestion`, `generateChatPlanSuggestion`, `generateCritiqueInsight`, `generateCrossInterestSuggestions`, `generatePlanFromResource`, `structureBrainDump`). Each one is ~50-100 lines of inline template strings with embedded JSON-shape requirements and few-shot guidance.

Common issues:
- **No central prompt registry.** Changes to the system prompt for "the BetterAt platform" (a phrase used in 4 of the 6 templates) must be hand-edited in every location.
- **Brand-string drift potential.** `generateEnrichedPlanSuggestion` system prompt at `:584` opens with *"You are an expert learning coach on the BetterAt platform."* Other prompts open with *"You are a creative learning coach on the BetterAt platform"* (`:915`), *"You are an expert learning coach on BetterAt"* (`:1112, :1337`). Inconsistent voicing across surfaces.
- **Hand-rolled JSON extraction.** Every JSON-output prompt parses the response with the same regex (`responseText.match(/\[[\s\S]*\]/)` or `/\{[\s\S]*\}/`) after stripping markdown fences (`:1164-1167, :1411-1414, :960-962`). This is duplicated ~6 times. A `parseAIJson` helper would consolidate this; today, each caller silently drops the response on any parse failure.

### `isSailing` substring gating

`services/ai/StepPlanAIService.ts:1244`:
```ts
const isSailing = interestSlug?.includes('sail') || interestName.toLowerCase().includes('sail');
```
Gates ~85 lines of equipment-context fetching (`:1262-1316`) and the "recognize boats, sails, rigging..." entity hint at `:1321`. Fragile string-match: matches `sailing` ✓ but also matches a user-proposed interest titled *"Sailmaking"* or *"Sail repair"*. Also matches *"Wholesaling"* (substring `sale`? no — `sail` not `sale`, so this one's fine) and *"Knot tying for sailors"*. More importantly, **no equivalent path exists for nursing**: the `interestEquipmentHint` at `:1325` mentions *"medical equipment, diagnostic tools, clinical supplies"* but no user-equipment table is queried for nursing, so the AI never sees the user's actual stethoscope/penlight/equipment inventory the way it sees a sailor's boat.

### Brain-dump max-tokens cap

`services/ai/StepPlanAIService.ts:1395, :1405` cap `max_tokens` at 1024 for the brain-dump → plan conversion. A realistic nursing case dump ("patient HX includes…, meds…, social context…") plus the structured JSON skeleton (`suggested_title`, `what_will_you_do`, `how_sub_steps[3-7]`, `why_reasoning`, `who_collaborators[]`, `capability_goals[2-5]`, `extracted_entities` with people/equipment/locations/dates) will routinely exceed 1024 output tokens. When it does, Gemini returns truncated JSON, the regex match at `:1413` finds an unclosed brace, and `buildFallbackPlan` at `:1430` silently returns a sparse plan. The user has no visible signal that truncation happened.

---

## 9. Observability

### `AIActivityLogger` is bypassed

`services/ai/AIActivityLogger.ts:43-114` inserts into `ai_activity_logs`, `ai_generated_documents`, and `ai_notifications`. It's only called from:
- A few sailing-specific services (RaceCoachingService, RaceAnalysisService — read pending).
- Vercel API routes (`api/whatsapp`, `api/telegram` — service-role context).

It is **not** called from `StepPlanAIService`, `BrainDumpAIService`, `PlaybookAIService`, `CompetencyExtractionService`, `MeasurementExtractionService`, `NutritionExtractionService`, `SkillExtractionService`, `DateEnrichmentService`, `ManifestoService`, `AIMemoryService`, or any other BetterAt AI surface. There is no central record of:
- How many step-plan-suggest calls fired per user per day.
- Which interests use AI most.
- Failure rates per task.

Edge functions log to Supabase console logs (`console.error` at `supabase/functions/step-plan-suggest/index.ts:86, :98`) but there's no aggregation into the `ai_activity_logs` table that the admin UIs (if any) would query.

### No tenant scoping on the activity table

`AIActivityLogger.logActivity` payload (`:51-62`) has `club_id` (sailing-era), `user_id`, `skill` — but **no `organization_id`**. For a Johns Hopkins admin who wants to see "how much AI activity happened in our org last week," there is no scoping field to filter on; only individual users.

---

## 10. Findings (summary)

1. **`clinical-reasoning-evaluate` is non-AI.** Hand-coded heuristic based on text length and step-count. Returns canned strengths/improvements. (`supabase/functions/clinical-reasoning-evaluate/index.ts:192`)
2. **Monte Carlo simulation is a hardcoded fake.** `scenarios_analyzed: 1000`, `win_probability: 0.65` always. (`services/aiService.ts:631-647`)
3. **Anthropic-branded UX copy on a Gemini-only stack.** Circuit breaker named `"Claude API"`, fallback messages say *"Anthropic API overloaded"*, mock copy points users to *console.anthropic.com*. (`lib/utils/aiCircuitBreaker.ts:204`, `lib/utils/aiFallback.ts:177-247-281`)
4. **Provider abstraction skipped at the highest-traffic endpoint.** `step-plan-suggest` calls `callGemini` directly; cannot be re-routed via `AI_PROVIDER` env. (`supabase/functions/step-plan-suggest/index.ts:80`)
5. **Two duplicate Gemini implementations.** `_shared/gemini.ts` and `_shared/ai/providers/gemini.ts` — near-identical, fork risk.
6. **Circuit breaker protects dead code.** Wraps `AIClient.createMessage`, which has zero callers; 83 direct `supabase.functions.invoke` sites bypass it.
7. **Dual-endpoint try-fallback duplicates the system prompt.** When `step-plan-suggest` fails, `race-coaching-chat` gets `system + '\n\n' + user` as a single prompt; the system prompt is no longer modelled as a system message, changing the output for JSON-shape prompts. (`services/ai/StepPlanAIService.ts:629-630, :686-687, :813-814, :952-953, :1156-1157, :1403-1404`)
8. **`isSailing` is substring-matched.** No equivalent equipment-context fetch path for nursing or other interests. (`services/ai/StepPlanAIService.ts:1244`)
9. **JSON parsing duplicated as regex.** `/\{[\s\S]*\}/` after fence-strip, repeated ~6 times across `StepPlanAIService` and `crossInterestSuggestions`. Silent failure to a fallback plan/empty array.
10. **Brain-dump truncation is silent.** 1024-token cap on a JSON-output prompt that grows with extracted entities. (`services/ai/StepPlanAIService.ts:1395`)
11. **`AIClient.apiUrl` is a dead string.** Comment claims it's shared with `invokeAIEdgeFunction.ts`; it is not. (`services/ai/AIClient.ts:42`)
12. **`AIActivityLogger` is bypassed by ~95% of AI traffic.** No tenant scoping on the activity table; no `organization_id`. (`services/ai/AIActivityLogger.ts:51-62`)
13. **Triple-naming AI client classes.** `AIClient`/`EnhancedAIClient` + `ClaudeClient`/`EnhancedClaudeClient` aliases shipped in `services/ai/index.ts:7-18`. New code can pick either, increasing the search surface.
14. **WhatsApp/Telegram bots use Anthropic directly.** `api/whatsapp/webhook.ts:639`, `api/telegram/webhook.ts:737`. Bypass the provider abstraction and the circuit breaker entirely.
15. **`generate-race-coaching` and `club-onboarding`/`coach-matching` use the Anthropic SDK directly.** Inside the edge-function tree but outside the unified `complete()` abstraction. Mixed model selection logic.
16. **Edge-function names lock in the sailing vocabulary.** `race-coaching-chat`, `race-conditions-brief`, `sail-analysis-chat`, `race-analysis`, `generate-race-coaching`. Renaming these requires both edge-function redeploy and client invoke-string updates — there are 36 call sites of `'race-coaching-chat'` alone.
17. **API keys validated at module load.** `_shared/gemini.ts:13` throws on import; a cold-started function with a missing env var becomes a hard 500 until redeploy.
18. **`ai_model` field on persisted strategies records 'gemini-2.5-flash' for handwritten content.** Hand-built strategy text from canned defaults gets persisted with `ai_generated: true, ai_model: getModelForTask(...)`. (`services/aiService.ts:547-548`)
19. **`thinkingBudget: 0` is correct but is hardcoded in two places.** A future change to enable thinking would need to be made twice. Already memoised as a known gotcha. (`_shared/gemini.ts:79`, `_shared/ai/providers/gemini.ts:86`)
20. **No usage telemetry from edge functions back to client.** Functions return `{text}` only; no input/output token counts, no model name surfaced for display, no cost estimation — even though the client-side `estimateCost()` exists at `lib/config/aiModels.ts:161`. The Gemini provider does parse `usageMetadata` (`_shared/ai/providers/gemini.ts:125-136`) but `complete()` only re-emits this in a few callers; the BetterAt edge functions (`step-plan-suggest`, `race-coaching-chat`) discard it before returning to the client.
