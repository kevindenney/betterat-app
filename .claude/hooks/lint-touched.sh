#!/usr/bin/env bash
# Lint the single file that was just Edit'd or Write'n.
# Reads the PostToolUse payload from stdin (Claude Code hooks contract).
#
# Exit codes:
#   0 = pass / not applicable
#   2 = lint failed, block and send stderr back to Claude

set -u

INPUT="$(cat)"
FILE="$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')"

# Only lint .ts / .tsx files inside this project
case "$FILE" in
  "$CLAUDE_PROJECT_DIR"/*.ts|"$CLAUDE_PROJECT_DIR"/*.tsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Skip if eslint isn't installed (don't break the session)
if ! command -v npx >/dev/null 2>&1; then exit 0; fi
if [ ! -d node_modules/eslint ] && [ ! -d node_modules/.bin ]; then exit 0; fi

# Single-file lint with the same strictness as the repo's lint-staged config
if ! OUTPUT="$(npx --no-install eslint --max-warnings 0 "$FILE" 2>&1)"; then
  echo "ESLint failed on $FILE:" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
