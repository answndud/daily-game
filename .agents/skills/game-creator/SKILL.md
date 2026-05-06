---
name: game-creator
description: Create, verify, commit, and push one daily static web game in this game_maker repository. Use when the user gives only a target date such as "2026년 5월 5일", "2026-05-05", or asks to make today's game and publish it.
---

# Game Creator

Use this skill to turn a target date into the complete daily game workflow: concept selection, implementation, catalog rebuild, verification, commit, and push.

## Target Date

- Parse Korean or ISO date prompts into `YYYY-MM-DD`.
- If the prompt is just a date, treat it as: "Create that date's daily game and push it to `origin/main`."
- Use commit timestamps as `YYYY-MM-DDT12:00:00+09:00` unless the user asks otherwise.

## Workflow

1. Check `git status --short --branch`.
2. Read `AGENTS.md`, `design-guidelines.md`, and recent `games/*/meta.json`.
3. Read `docs/24-game-retrospective.md` and run `node tools/review-games.js` when choosing a concept.
4. Run `node tools/plan-game.js --date YYYY-MM-DD` only as a starting candidate.
5. Reject candidates that repeat a recent genre/control family or retrospective avoid-pattern.
6. Choose a compact single-screen concept from an underused direction when possible.
7. Create `games/YYYY-MM-DD-slug/` with `index.html`, `style.css`, `script.js`, and `meta.json`.
8. Ensure round rules: clear advances immediately to a harder next round; failure resets the run to round 1.
9. Rebuild the catalog with `node tools/build-catalog.js`.
10. Verify with:
    - `node --check games/YYYY-MM-DD-slug/script.js`
    - `node tools/verify-game.js games/YYYY-MM-DD-slug`
    - `node tools/verify-repo.js`
    - `node tools/verify-skills.js`
    - `node tools/review-games.js`
11. Stage only the new game folder and generated catalog changes.
12. Commit with `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` set to the target date at noon KST.
13. Push `main` to `origin/main`.
14. Finish by reporting the game path, checks run, commit hash, and clean sync status.

## Concept Guardrails

- Do not overwrite an existing date unless the user explicitly asks.
- Prefer mobile-first controls and static HTML/CSS/JS only.
- Avoid by default: timing stack, plain left/right sorting, drag balance, hold-band maintenance.
- Prefer underused directions: rhythm input, compact strategy/choice, spatial reasoning, priority juggling, resource management.
- If recent 10 games include the same genre or control family, pick another structure.

## Commit Message

Use:

```sh
Add YYYY-MM-DD daily game
```
