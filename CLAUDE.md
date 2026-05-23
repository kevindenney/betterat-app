# CLAUDE.md — BetterAt

> The repo directory is `betterat-app` and the codebase was previously called RegattaFlow.
> Sailing-specific code (races, fleets, venues, weather, tides) is the **first** vertical built
> on BetterAt's platform primitives, not the product itself. New work should generalize.

## What BetterAt actually is

BetterAt is a learning-and-doing platform organized around a **four-tier social model**:

1. **Interests** — what a person is working on (sail racing, JHU MD program, marathon training…). Users **add** interests.
2. **Organizations** — clubs, schools, programs that issue blueprints/cohorts. Users **join** orgs.
3. **Programs** — curricula / training plans inside an org. Users **subscribe** to programs.
4. **People** — coaches, peers, mentors. Users **follow** people.

> Terminology is load-bearing — see `feedback_interest_terminology.md`. Never say "follow a program".

## Core domain primitives

| Concept | What it is | Where it lives |
| --- | --- | --- |
| **Step** | Atomic unit of planned or completed activity. Has plan ("what"), sub-steps ("how"), capability mapping ("why"), people ("who"), optional timing. | `step_*` tables, `components/steps`, `hooks/useSteps*` |
| **Blueprint** | Reusable template of steps an org/program publishes. Subscribers receive steps from it. | `blueprints`, `blueprint_steps` |
| **Competency** | Skill or capability tied to evidence. Steps log attempts; review surfaces gap vs framework. | `competencies`, `competency_attempts` |
| **Evidence** | Artifacts that demonstrate a competency was actually exercised. | `evidence_*` tables, review flow |
| **Cohort** | Group of people moving through a blueprint together. | `cohorts`, `cohort_members` |
| **Atlas** | 5th top-level tab — the universal "where" lens. Not sailing-only. Brief at `docs/redesign/ios-register/atlas-tab-brief.md` |
| **Playbook / Library** | User's saved concepts and references. UI-rename pending (`feedback_playbook_v1_scope`, `project_playbook_to_library_rename`). |

Sailing tables (`races`, `race_series`, `race_entries`, `race_results`, `fleets`, `venues`, `racing_areas`, `coaching_sessions`) sit *alongside* these, not above them. Sailing-only code is being moved into explicit `sailing/` subdirs over time (`project_sailing_namespace_consolidation`).

## Stack at a glance

Expo SDK 54 / RN 0.81, Expo Router, TypeScript strict, NativeWind + Gluestack, TanStack Query, Supabase (Postgres + Auth + Edge Functions + Realtime), Anthropic + Google Generative AI, MapLibre GL, Stripe. Web via `react-native-web` → Vercel. Native via EAS.

Most stack details and the file tree are discoverable from `package.json` and `app/`. Read those when you need specifics rather than trusting a stale list here.

## Commands that aren't obvious

```bash
npm start                # Expo dev (runs with --max-old-space-size=12288, needed for our build)
npm run start:reset      # Clear Metro cache when bundles get weird
npm run typecheck        # ALWAYS run before declaring done
npm run lint             # ALWAYS run before declaring done (lint-staged uses --max-warnings 0)
npm run seed:rhkyc       # Seed RHKYC sailing demo data
npm run build:web        # Vercel build
npx supabase db push     # Push migrations to remote dev project
```

> Vercel is currently **paused at project level** — see `project_vercel_deployment_paused`. No deploys, no crons, no serverless. Deployment Smoke CI fails by design.

## Web compatibility (critical)

⚠️ **Never use `Alert.alert()` directly** — silently no-ops on web.

```typescript
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';

showAlert('Error', 'Something went wrong');
showConfirm('Delete', 'Are you sure?', () => handleDelete(), { destructive: true });
```

Full reference: `docs/WEB_COMPATIBILITY.md`.

## Patterns worth knowing

- **Data fetching**: `hooks/useData.ts` is the primary TanStack Query wrapper. New query hooks **must** be added to relevant mutation `invalidateQueries` lists — see `feedback_query_cache_key_invalidation_audit`.
- **Services**: Singleton classes with static methods under `services/` (`MyService.getData()`).
- **Platform splits**: `Component.tsx` / `Component.native.tsx` / `Component.web.tsx`.
- **Env vars**: `EXPO_PUBLIC_*` for anything the client reads.
- **Migrations**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Wrap `auth.uid()` as `(SELECT auth.uid())` in RLS — see `feedback_rls_auth_uid_must_be_wrapped`.

## Memory is the authoritative source for quirks

This file gives the shape of the project. The lived gotchas — RLS recursion patterns, Supabase PKCE defaults, Pressable layout traps, Gemini thinking-budget quirks, the playbook-vs-library naming standoff, sailing direction conventions, etc. — are in `MEMORY.md`. **Check memory first when you hit something weird;** it's almost certainly already documented.

## Working Standards

### Plan Before Building
- For any non-trivial task (3+ steps or architectural decisions), use plan mode first
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### Verify Before Done
- Never consider a task complete without proving it works
- Run `npm run typecheck` and `npm run lint` before finishing any code change
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"

### Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### Learn From Corrections
- After ANY user correction, save a `feedback` memory so the same mistake is never repeated
- Include **why** the correction was given and **how to apply** it in future work
- Review saved feedback memories when starting tasks in areas where past corrections were made

### Autonomous Bug Fixing
- When given a bug report: just fix it — don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- For routine fixes with a confirmed root cause (including dev-Supabase schema patches), don't ask permission — commit and push (`feedback_autonomous_commit_push`, `feedback_dont_ask_for_ok_on_routine_fixes`)

### Git hygiene
- Stage by explicit path. **Never** `git add -u` or `git add .` — `.pen` files are user WIP (`feedback_pen_files_are_user_wip`).
- Create new commits rather than amending. Standard safety: no `--no-verify`, no force-push to main.
