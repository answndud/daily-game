---
name: catalog-updater
description: Rebuild the repository catalog from game metadata. Use when Codex has added or updated a game and needs to regenerate the root index.html so all games appear in date order with title, description, and play link.
---

# Catalog Updater

Use the repository metadata as the source of truth.

## Workflow
1. Ensure each game folder has a valid `meta.json`.
2. Run `node tools/build-catalog.js`.
3. Run `node tools/verify-repo.js` if a game was added or changed.

## Rules
- Do not hand-edit the root catalog if it can be regenerated.
- Keep the catalog static and relative-path only.
- Let metadata drive card text instead of duplicating content elsewhere.
