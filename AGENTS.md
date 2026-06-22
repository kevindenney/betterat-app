# BetterAt Agent Instructions

## Project
BetterAt is a React/Firebase app for interest-based personal improvement.

## Style
- Use parentheses around arrow function parameters.
- Use minimal spaces inside object braces.
- Keep changes small and reviewable.
- Prefer existing project patterns.

## Do Not
- Do not rewrite architecture without explicit instruction.
- Do not change Firebase rules casually.
- Do not invent product behavior.
- Do not delete working features.

## Verification
Before marking work complete, run the existing available commands from package.json:
- lint
- typecheck
- test
- build

If a command does not exist, document that instead of inventing one.
