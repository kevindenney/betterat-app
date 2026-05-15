# BlueprintService auto-subscribe failure

## Summary

During Get Inspired flow testing on 2026-05-15, a `[BlueprintService]
Failed to subscribe to blueprint` error surfaced as a red RN dev-mode
LogBox overlay during plan creation (after the wizard reached "Creating
your plan…" and through the "You're all set!" success state). The plan
itself was created successfully — all 11 timeline_steps landed in the
user's Playbook, the interest was created, the wizard advanced. The
auto-subscribe-creator-to-own-blueprint step is what failed.

Investigation found this is pre-existing (not a Get Inspired Commits 1–3
regression) and cosmetic in dev / invisible in prod.

## Source

- Error log: [`services/BlueprintService.ts:546`](../../services/BlueprintService.ts) — `logger.error('Failed to subscribe to blueprint', err)` inside the `subscribe()` function's outer try/catch. The catch re-throws after logging.
- Trigger: [`services/InspirationService.ts:130`](../../services/InspirationService.ts) — `activateInspiration` calls `subscribeToBlueprint(userId, blueprint.id)` for the creator's own freshly-minted blueprint, inside its own try/catch that downgrades the rethrow to `logger.warn('Failed to auto-subscribe to blueprint (non-fatal):')`. The wizard continues to the success state.
- Surface: `logger.error` calls `console.error('[BlueprintService]', ...)` (`lib/utils/logger.ts:90`). In RN dev mode, `console.error` renders the LogBox red overlay; in production builds it's logged-only, no UI.

## Hypothesis

**RLS on `blueprint_subscriptions` rejects self-subscribing to an unpublished blueprint.**

Evidence chain:

- Personal blueprints created by `createBlueprintFromCurriculum` are persisted with `is_published: false` (`BlueprintService.ts:1442` — "Personal blueprints start as drafts").
- The in-app `checkBlueprintAccess()` permits `access_level === 'public'` (line 876), and personal blueprints get `effectiveAccessLevel = 'public'` (line 1384) — so the app-layer access check passes.
- The next step is the `INSERT INTO blueprint_subscriptions` (line 492-504). The error is raised after that line, before the auto-adopt block. The most plausible cause is a Postgres-level rejection — i.e. RLS policy on `blueprint_subscriptions` requires the referenced blueprint to satisfy a `is_published = true` predicate (typical pattern for "subscribe to others' blueprints" RLS).
- Less likely alternative: `getBlueprintById` returns null on the just-created row because RLS on `timeline_blueprints` SELECT filters drafts. Less likely because the user is the row's owner and there's no `is_published` filter inside `getBlueprintById` itself.

The investigation was read-only — RLS policies were not inspected directly via the Supabase MCP. Confirming the exact failing predicate would take a 30-second `mcp__claude_ai_Supabase__execute_sql` call when fix work begins.

## Severity

- **Dev:** cosmetic RN LogBox overlay during plan creation. Persists from "Creating your plan…" through the "You're all set!" state. Dismissable via the LogBox X.
- **Prod:** invisible — `console.error` does not render an overlay in production builds. Telemetry records the error but the user sees nothing.
- **Functional:** the creator doesn't have a `blueprint_subscriptions` row pointing to their own blueprint. Downstream effects: blueprint detail page may render "Subscribe" instead of "Subscribed" for the creator viewing their own work; FOR YOU ranking signals tied to subscription state miss the self-subscribe; future "blueprint updated" notifications wouldn't fire for the creator. Doesn't affect plan creation, step visibility, or interest activation.

## Three fix options to discuss before implementing

1. **Bypass RLS for self-subscribe-on-own-draft.** Add an explicit code path in `createBlueprintFromCurriculum` (or `activateInspiration`) that writes the `blueprint_subscriptions` row using a `SECURITY DEFINER` RPC or the user's own service-role-scoped insert. The creator's auto-subscription becomes a system-owned write, not a user-driven RLS-gated one. Smallest semantic change; requires a new RPC.
2. **Publish personal blueprints immediately.** Set `is_published: true` for personal blueprints (drop the draft state). Eliminates the unpublished-draft predicate problem. Largest semantic change — personal blueprints become discoverable immediately by anyone with `access_level = 'public'` visibility, which may not match intent. Needs product decision.
3. **Relax `blueprint_subscriptions` RLS for self-subscribe regardless of publish state.** Add an OR clause to the insert policy: `auth.uid() = (SELECT user_id FROM timeline_blueprints WHERE id = NEW.blueprint_id)`. Creator can always subscribe to own work; others still require `is_published`. Smallest schema-level change; no app code touched.

## Recommendation

**Queue as follow-up. Not a Commit 4 blocker.** The auto-subscribe failure does not affect the user-visible Get Inspired success path. Production users won't see the overlay. Fixing it touches RLS policy and/or blueprint publishing semantics — each option has design tradeoffs (draft visibility, RPC surface area, schema migration) that warrant discussion before code lands.

## Not affected

- Plan creation completes successfully.
- All 11 `timeline_steps` for the generated plan land in the user's Playbook (`createBlueprintFromCurriculum` writes them directly, not via the subscription's auto-adopt code path).
- Interest creation (e.g. "Underwater Exploration") succeeds.
- Wizard step advancement reaches the success state.
- Abort, error-state, and running-state surfaces shipped in Get Inspired Commits 1–3 (`1e0c331b`, `9580a317`, `95c9a4aa`) operate independently of this code path.
