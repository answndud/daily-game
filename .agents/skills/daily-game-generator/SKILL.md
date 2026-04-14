---
name: daily-game-generator
description: Generate one daily game in this repository after the concept is stable. Use when Codex needs to implement a new game folder under games/YYYY-MM-DD-slug using only HTML, CSS, and JavaScript, while preserving the static-hosting and metadata rules defined in AGENTS.md.
---

# Daily Game Generator

Read `AGENTS.md` and use `daily-game-planner` first if the concept is not already fixed.

## Workflow
1. Confirm the target date and final slug.
2. Create `games/YYYY-MM-DD-slug/`.
3. Add `index.html`, `style.css`, `script.js`, and `meta.json`.
4. Keep the game mobile-first and playable without external assets.
5. Rebuild the catalog after the game files are in place.
6. Run repository verification before finishing.

## Implementation Rules
- Keep gameplay to one primary mechanic.
- Prefer direct DOM or a single canvas over complex UI structure.
- Add restart and clear feedback for success or failure.
- Use only relative paths.
- Fail instead of overwriting an existing game for the same date.
