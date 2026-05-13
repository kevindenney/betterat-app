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

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  # Can't determine diff (first commit, shallow clone edge case): build to be safe.
  echo "✅ Cannot determine changes — proceeding with build"
  exit 1
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
