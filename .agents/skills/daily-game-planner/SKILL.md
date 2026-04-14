---
name: daily-game-planner
description: Plan and scope a single day’s web game before coding. Use when Codex needs to propose or refine today’s game idea for this repository, especially to generate a mobile-first concept, reduce scope, choose a single mechanic, and produce a build-ready mini spec that matches the rules in AGENTS.md.
---

# Daily Game Planner

Read `AGENTS.md` first.

Use this skill to create a buildable game concept for the current date or a requested date.

## Workflow
1. Run `node tools/plan-game.js --date YYYY-MM-DD` to get a starting concept.
2. Review the concept against repository constraints.
3. Reduce the design until it clearly fits a one-screen, one-mechanic game.
4. Produce a concise implementation plan before writing game files.

## Planning Output
- Title
- Core mechanic
- Win or score condition
- Control scheme
- Screen layout
- Failure state
- Restart flow
- Visual direction using only code-generated assets

## Guardrails
- Prefer tap, drag, hold, or simple swipe controls.
- Keep tutorials minimal; first interaction should be obvious.
- Remove extra systems rather than explaining them.
- If the random concept feels too large, keep the genre and cut the twist first.
