#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 0 = skip build, Exit 1 = proceed with build
#
# ┌─────────────────────────────────────────────────────────────────────┐
# │ MANUAL-DEPLOY MODE                                                  │
# │                                                                     │
# │ ALL git-triggered production deployments are skipped. The only way  │
# │ to ship is to run `npm run deploy:web` locally (which uses the      │
# │ Vercel CLI; CLI deploys do NOT run this script).                    │
# │                                                                     │
# │ This is the cost-minimization mode: zero accidental builds on push, │
# │ explicit human action to spend build minutes.                       │
# │                                                                     │
# │ Escape hatch: set FORCE_VERCEL_BUILD=1 in the project's Environment │
# │ Variables to override and let git deploys build again. Useful for   │
# │ hotfixes where you can't get to a terminal.                         │
# └─────────────────────────────────────────────────────────────────────┘

set -u

echo "🔍 Vercel Ignored Build Step (manual-deploy mode)"

if [ "${FORCE_VERCEL_BUILD:-}" = "1" ]; then
  echo "✅ FORCE_VERCEL_BUILD=1 — proceeding with build"
  exit 1
fi

echo "⏭️  Manual-deploy mode — skipping git-triggered build"
echo "    To ship, run \`npm run deploy:web\` locally."
exit 0
