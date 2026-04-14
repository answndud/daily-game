# AGENTS.md

## Purpose
- This repository is for a local-first daily pipeline that produces one small web game per day.
- Each game must be fully playable as static files and suitable for simple hosting such as GitHub Pages.
- The generation target is consistency over ambition: short, clear, and reliably finishable.
- This repository is configured for Codex-first development, not Claude-specific workflows.

## Core Product Rules
- Use only `html`, `css`, and `javascript` for shipped game files.
- Do not require a server, database, build step, external libraries, image assets, or sound assets.
- Prefer mobile-first design. Desktop fallback should remain playable.
- Every game should be understandable within 5 minutes and playable within 30 seconds.
- Scope each game to a single screen or a very short flow.

## Output Structure
- Store each generated game at `games/YYYY-MM-DD-slug/`.
- Every game directory must contain at least:
  - `index.html`
  - `style.css`
  - `script.js`
  - `meta.json`
- The repository root must contain an `index.html` catalog page that lists all generated games in date order.

## Metadata Contract
- Each `meta.json` must include:
  - `title`
  - `date`
  - `slug`
  - `tagline`
  - `genre`
  - `controls`
  - `sessionLength`
  - `description`
- Keep metadata human-readable because it will also power the root catalog.

## Daily Generation Workflow
1. Generate a concept by combining a genre pool, mechanic pool, input pool, and objective pool.
2. Filter out incompatible combinations before selecting the final concept.
3. Reduce the concept until it fits the repository rules and daily scope.
4. Create the game folder and all required static files.
5. Regenerate the root `index.html` catalog so the new game appears automatically.
6. Run repository verification before treating the game as complete.

## Randomization Rules
- “Random” does not mean unconstrained freeform output.
- Maintain internal pools for genres, mechanics, controls, and win/survival goals.
- Exclude combinations that create multi-scene scope, heavy UI, or unclear controls.
- Prefer concepts that work well with taps, holds, drags, swipes, or simple keyboard fallback.
- If a concept feels too large, simplify it before writing code.

## UX and Design Constraints
- Design for portrait mobile layouts first.
- Use CSS shapes, gradients, text, and canvas drawing instead of external art assets.
- Keep controls obvious on first load.
- Include a restart path and clear win/loss or score feedback.
- Use relative paths only so the game works on static hosting and local file layouts.
- Use `design-guidelines.md` as the default visual baseline for the root catalog and shared shell UI.
- Apply that guide selectively: preserve readability, restrained surfaces, and scan-friendly metadata layout, while allowing game-specific color only when the mechanic truly needs it.

## Catalog Rules
- The root catalog must show, at minimum, the title, date, one-line description, and link for each game.
- Sort games by date, newest first unless a different rule is explicitly introduced later.
- Do not require client-side fetching for the catalog if a static render is practical.

## Duplicate-Date Policy
- Default behavior is to fail when a game for the same date already exists.
- Do not overwrite or mutate an existing daily game unless explicitly instructed by the user.

## Quality Bar
- Each generated game must launch from files alone and avoid obvious runtime errors.
- The first interaction should work on touch devices.
- Desktop keyboard or mouse fallback is allowed when helpful, but mobile remains the primary target.
- Favor one polished mechanic over multiple weak mechanics.
- Prefer deterministic script-based checks over long natural-language review loops.

## v1 Non-Goals
- No deployment automation.
- No audio pipeline.
- No external asset management.
- No framework migration, bundling, or package-heavy frontend stack.
- No MCP integration.
- No heavy browser automation.
- No hook-based orchestration unless it becomes clearly necessary later.

## Agent Instructions
- When adding or updating pipeline code, preserve the static-hosting constraint.
- When generating a game, update both the game folder and the root catalog in the same task.
- When uncertain between novelty and reliability, choose reliability.
- Keep implementation simple enough that another agent can inspect and extend it quickly.
- When making visual changes, consult `design-guidelines.md` first and keep new screens consistent with it unless the user explicitly requests a deliberate exception.
- Use repository skills from `.agents/skills/` when they match the task.
- Prefer `tools/*.js` scripts for repeatable checks and generation steps.
