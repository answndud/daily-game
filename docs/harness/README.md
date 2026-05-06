# Harness Overview

This repository uses a minimal Codex-first harness for generating one static web game per day.

## Goals
- Keep the agent workflow predictable.
- Encode the repository rules in files and scripts instead of relying on memory.
- Minimize moving parts: no hooks, no MCP, no heavy browser stack in v1.

## Harness Pieces
- `AGENTS.md`
  - Repository-wide product rules and execution constraints.
- `.agents/skills/`
  - Local workflow skill for the full daily game creation and publishing loop.
- `tools/plan-game.js`
  - Generates a scoped game concept for a given day.
- `tools/build-catalog.js`
  - Rebuilds the root `index.html` from `games/*/meta.json`.
- `tools/verify-game.js`
  - Verifies one game directory against repository rules.
- `tools/verify-repo.js`
  - Verifies repository-wide consistency.
- `tools/verify-skills.js`
  - Verifies local skill frontmatter and basic repository-skill structure.

## Default Workflow
1. Use the `game-creator` skill with the target date.
2. Let it plan the concept, create `games/YYYY-MM-DD-slug/`, rebuild the catalog, verify the repository, commit with the target date, and push `main`.
3. If a date already exists, stop unless the user explicitly asks to update that game.

## Why This Shape
- Codex already follows repository instructions well when the rules are explicit.
- A single local skill is enough for the daily end-to-end workflow; smaller phase skills caused unnecessary prompt/UI noise.
- Scripts provide the deterministic layer for validation and file generation.
- Browser-level automation can be added later only if static checks stop being sufficient.

## Command Reference
```bash
node tools/plan-game.js --date 2026-04-13
node tools/build-catalog.js
node tools/verify-game.js games/2026-04-13-some-slug
node tools/verify-repo.js
node tools/verify-skills.js
```
