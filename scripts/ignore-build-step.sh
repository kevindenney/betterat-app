#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 0 = skip build, Exit 1 = proceed with build
#
# ┌─────────────────────────────────────────────────────────────────────┐
# │ POST-PAUSE: DENY-LIST MODE                                          │
# │                                                                     │
# │ The betterat-app SPA is serving traffic again — production builds   │
# │ must run for any commit that touches the bundle. To keep avoidable  │
# │ build minutes off the bill, we still SKIP builds for commits that   │
# │ only touch paths Vercel doesn't ship (docs, supabase/, markdown,    │
# │ pencil files, tests, claude-side tooling).                          │
# │                                                                     │
# │ If a commit touches ANY non-skipped path → build.                   │
# │ If a commit touches ONLY skipped paths → skip.                      │
# │                                                                     │
# │ Preview branches still skip — production-only deploys for now.      │
# └─────────────────────────────────────────────────────────────────────┘

set -u

echo "🔍 Vercel Ignored Build Step (deny-list mode)"

# Preview branches: skip — production-only.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  echo "⏭️  Skipping preview deployment"
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
  # Genuinely can't determine diff — build to be safe (we don't want to
  # silently miss SPA changes after unpausing).
  echo "✅ Cannot determine changes — building (default after unpause)"
  exit 1
fi

# Paths that NEVER require a Vercel rebuild (Vercel doesn't serve them).
# If every changed file matches one of these, skip the build.
SKIP_PATTERNS='^(docs/|supabase/|memory/|\.claude/|.*\.md$|.*\.pen$|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.mov$|__tests__/|tests/|.*\.test\.(t|j)sx?$)'

NON_SKIPPED=$(echo "$CHANGED" | grep -vE "$SKIP_PATTERNS" || true)

if [ -z "$NON_SKIPPED" ]; then
  echo "⏭️  Only skip-listed paths changed — skipping build:"
  echo "$CHANGED" | head -20
  exit 0
fi

echo "✅ Build-relevant files changed — proceeding with build:"
echo "$NON_SKIPPED" | head -20
exit 1
