# BetterAt Redesign — Saved Design Work

Package generated May 12, 2026 from the redesign session of May 11-12.

## Files

- **`betterat-redesign-spec.md`** — The main design specification. Reference-altitude. ~7,500 words. Read this first.
- **`decisions-log.md`** — Architectural decisions extracted, plus unresolved questions. Useful when revisiting "why did we decide X."
- **`mockups/`** — Visual mockups as standalone HTML files. Open `mockups/index.html` to navigate.
- **`mockups/index.html`** — Index of all mockups with descriptions.

## How to use

**To read the design**: start with `betterat-redesign-spec.md`. Open `mockups/index.html` in a browser when you want to see specific surfaces.

**To re-enter a design session**: bring this folder into context (or paste the relevant section of the spec). The architecture is well-documented enough that future Claude conversations can pick up from here without re-deriving decisions.

**To share with collaborators**: the spec is the artifact. Engineers, designers, potential funders can read it without needing the full conversation history.

**To integrate into your repo**: drop the folder into `betterat-app/docs/redesign/` (or wherever your design docs live). The markdown files are self-contained.

**To integrate into Obsidian (Kevin's Brain)**: convert the spec sections into linked notes. The architectural concepts (Interest, Path, Step, Playbook, Vision, Concept, Capability) all want to be first-class notes that cross-link to your existing knowledge.

## Status

The first 16 mockups (in `mockups/01_*` through `16_*`) are recovered from the earlier session transcript. The continuation session produced approximately 27 additional mockups that are described in the index but not yet saved as standalone HTML files — see `mockups/index.html` for descriptions and references to the spec sections.

The conversation transcript itself is preserved in the Claude chat history. Future Claude sessions can read the transcript at `/mnt/transcripts/2026-05-11-23-39-49-betterat-redesign-playbook-architecture.txt` (and the continuation, which will be auto-archived when this session ends).

## Open work

See "Unresolved questions" in `decisions-log.md` for the map of design and architectural work still to do.

## How this fits with your current codebase

- `betterat-app` — React Native / Expo app, Supabase backend. The redesign target.
- `audit/codebase-recon` — long-lived audit reference branch
- `fix/demo-blockers-day1` — Day 1 demo blocker fixes, pushed to origin

Next likely engineering steps (in order, per the spec):

1. Voice-first capture for step During tab
2. State of Mind iOS Health integration
3. Capability sparkline visualization
4. Step Before/During/After architecture per spec
5. Playbook with concept ingestion from reflections

The redesign is a substantial undertaking. The point of this saved work is to make resumption possible — the architecture is stable enough that you can build against it.
