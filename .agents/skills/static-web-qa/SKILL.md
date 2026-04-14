---
name: static-web-qa
description: Verify that a generated game and the repository meet the static-web rules for this project. Use when Codex needs to check required files, metadata, relative paths, banned asset references, and catalog consistency for one game or the full repository.
---

# Static Web QA

Read `AGENTS.md` before running checks.

## Workflow
1. For one game, run `node tools/verify-game.js games/YYYY-MM-DD-slug`.
2. For repository-wide checks, run `node tools/verify-repo.js`.
3. For skill validation, run `node tools/verify-skills.js`.
4. If validation fails, fix the files before treating the task as complete.

## What These Checks Cover
- Required file presence
- Metadata field completeness
- Directory naming consistency
- Viewport meta tag presence
- Relative-path-only references
- No external libraries or image/audio asset references
- Root catalog linkage for generated games

## Limits
- These checks do not replace manual playtesting.
- v1 does not include heavy browser automation.
