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
  - Reusable task guides for planning, generating, cataloging, and QA.
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
1. Use the `daily-game-planner` skill to generate and refine today's game concept.
2. Use the `daily-game-generator` skill to implement the game in `games/YYYY-MM-DD-slug/`.
3. Use the `catalog-updater` skill to regenerate the root catalog.
4. Use the `static-web-qa` skill to verify the new game and the repository.

## Why This Shape
- Codex already follows repository instructions well when the rules are explicit.
- Skills are enough for reusable workflows in this project.
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
