#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 0 = skip build, Exit 1 = proceed with build
#
# ┌─────────────────────────────────────────────────────────────────────┐
# │ PAUSED-MODE ALLOWLIST                                               │
# │                                                                     │
# │ The betterat-app production domain is currently paused (503 on      │
# │ every public route). The SPA bundle in dist/ serves no real         │
# │ traffic. The only deploys that matter are ones that affect the      │
# │ Vercel-side serverless config (crons + their handlers).             │
# │                                                                     │
# │ While paused, we ONLY build when one of these changes:              │
# │   - vercel.json                  (crons / rewrites / headers)       │
# │   - api/cron/**                  (cron handlers themselves)         │
# │   - package*.json                (cron handler dependencies)        │
# │   - scripts/ignore-build-step.sh (this script, for self-test)       │
# │                                                                     │
# │ TO RESTORE NORMAL BUILDS WHEN THE DOMAIN IS UNPAUSED:               │
# │   1. Revert this script to the previous deny-list version, OR       │
# │   2. Broaden BUILD_PATTERNS below to include the SPA surface        │
# │      (app/, components/, services/, hooks/, lib/, providers/,       │
# │      types/, public/, etc.).                                        │
# └─────────────────────────────────────────────────────────────────────┘

set -u

echo "🔍 Vercel Ignored Build Step (paused-mode allowlist)"

# Preview branches: never build while paused.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  echo "⏭️  Skipping preview deployment (paused-mode)"
  exit 0
fi

# Vercel shallow-clones the repo, so HEAD~1 frequently doesn't exist. Use
# VERCEL_GIT_PREVIOUS_SHA (the previous successful deploy's SHA, injected by
# Vercel) — fetch it if missing from the local clone, then diff against it.
PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -n "$PREV" ]; then
  if ! git cat-file -e "$PREV^{commit}" 2>/dev/null; then
    git fetch --depth=1 origin "$PREV" 2>/dev/null || true
  fi
  CHANGED=$(git diff --name-only "$PREV" HEAD 2>/dev/null || echo "")
else
  CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
fi

if [ -z "$CHANGED" ]; then
  # Genuinely can't determine diff (first deploy, or fetch failed). Skip
  # rather than fall through to a build — the explicit allowlist will catch
  # the next commit that actually needs to build.
  echo "⏭️  Cannot determine changes — skipping build (paused-mode default)"
  exit 0
fi

# Paths that DO require a Vercel rebuild while the SPA is paused.
BUILD_PATTERNS='^(vercel\.json$|api/cron/|package(-lock)?\.json$|scripts/ignore-build-step\.sh$)'

BUILD_HITS=$(echo "$CHANGED" | grep -E "$BUILD_PATTERNS" || true)

if [ -n "$BUILD_HITS" ]; then
  echo "✅ Build-relevant files changed — proceeding with build:"
  echo "$BUILD_HITS"
  exit 1
fi

echo "⏭️  No cron/config changes — skipping build (paused-mode):"
echo "$CHANGED" | head -20
exit 0
