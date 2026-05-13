# Harness Decisions

## Accepted
- Codex-only setup
  - The repository will not carry Claude-specific settings or command abstractions.
- A single project-local skill lives under `.agents/skills/game-creator/`
  - This keeps the end-to-end daily workflow in-repo without exposing separate phase skills that users do not call directly.
- Scripts are the enforcement layer
  - Repeated checks and generation steps should live in `tools/` rather than in prompts.
- Local validation must not depend on extra global packages
  - Repository checks should run with the stock Node runtime already available in the workspace.
- Static verification first
  - v1 focuses on file structure, metadata, path, and content checks.
- Minimal planning support
  - Today’s game ideation starts from `tools/plan-game.js`, but final concept selection is governed by `game-creator`, `AGENTS.md`, and the retrospective.
- Separate flagship verification
  - The flagship game may use a multi-file local ES module structure, so it is verified with `tools/verify-flagship.js` instead of being forced into the daily game harness.

## Deferred
- MCP integration
  - Not needed for local-first static game generation.
- Hook orchestration
  - Adds complexity without clear payoff in v1.
- Heavy browser smoke tests
  - Deferred until static checks prove insufficient.
- Deployment automation
  - Kept out of the harness until the local pipeline is stable.

## Design Constraints
- Games must remain static-hostable.
- Generation must fail safely on duplicate dates.
- The root catalog must be reproducible from metadata alone.
- The harness must stay understandable by a fresh Codex instance.
